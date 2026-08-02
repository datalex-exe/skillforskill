// Admin Teacher Applications JavaScript Logic
let allApplications = [];
let currentFilter = 'all';
let searchQuery = '';
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Local session RBAC check
    try {
        currentUser = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
        currentUser = null;
    }

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    const userRole = (currentUser.role || '').toLowerCase();
    if (userRole === 'teacher') {
        window.location.href = 'teacher-dashboard.html';
        return;
    } else if (userRole !== 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }

    // 2. Fetch applications from backend with role verification
    fetchApplications();
});

function showAccessDenied() {
    const mainContent = document.getElementById('adminMainContent');
    const accessDeniedCard = document.getElementById('accessDeniedCard');
    if (mainContent) mainContent.style.display = 'none';
    if (accessDeniedCard) accessDeniedCard.style.display = 'flex';
}

// Fetch all applications from backend
async function fetchApplications() {
    const container = document.getElementById('applicationsContainer');
    try {
        const response = await fetch('/api/profile/admin/teacher-applications', {
            method: 'GET',
            headers: {
                'X-User-Id': currentUser ? currentUser.id : ''
            }
        });
        const data = await response.json();

        if (response.status === 403 || response.status === 401) {
            showAccessDenied();
            return;
        }

        if (response.ok && data.success) {
            allApplications = data.applications || [];
            updateCounts();
            renderApplications();
        } else {
            container.innerHTML = `<div class="no-apps-notice"><span>⚠️</span><p>Failed to load applications: ${data.message || 'Error occurred'}</p></div>`;
        }
    } catch (error) {
        console.error('Error fetching admin applications:', error);
        container.innerHTML = `<div class="no-apps-notice"><span>⚠️</span><p>Could not connect to server.</p></div>`;
    }
}

// Update filter badges counts
function updateCounts() {
    const countAll = allApplications.length;
    const countPending = allApplications.filter(a => a.status === 'pending').length;
    const countApproved = allApplications.filter(a => a.status === 'approved').length;
    const countRejected = allApplications.filter(a => a.status === 'rejected').length;

    if (document.getElementById('countAll')) document.getElementById('countAll').textContent = countAll;
    if (document.getElementById('countPending')) document.getElementById('countPending').textContent = countPending;
    if (document.getElementById('countApproved')) document.getElementById('countApproved').textContent = countApproved;
    if (document.getElementById('countRejected')) document.getElementById('countRejected').textContent = countRejected;
}

// Filter button click handler
function filterApplications(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.getAttribute('data-filter') === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderApplications();
}

// Search input handler
function handleAdminSearch() {
    const input = document.getElementById('adminSearchInput');
    searchQuery = input ? input.value.trim().toLowerCase() : '';
    renderApplications();
}

// Render applications list
function renderApplications() {
    const container = document.getElementById('applicationsContainer');
    container.innerHTML = '';

    // Apply Filter & Search
    let filtered = allApplications.filter(app => {
        // Status filter
        if (currentFilter !== 'all' && app.status !== currentFilter) {
            return false;
        }
        // Search filter
        if (searchQuery) {
            const matchName = app.applicantName.toLowerCase().includes(searchQuery);
            const matchEmail = app.email.toLowerCase().includes(searchQuery);
            const matchSkills = app.skills.toLowerCase().includes(searchQuery);
            const matchQual = app.qualifications.toLowerCase().includes(searchQuery);
            return matchName || matchEmail || matchSkills || matchQual;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="no-apps-notice">
                <span>🎓</span>
                <p>No teacher applications found ${currentFilter !== 'all' ? `with status "${currentFilter}"` : ''}.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(app => {
        const card = document.createElement('div');
        card.className = 'app-card';

        // Avatar
        let avatarHtml = '';
        if (app.avatar && app.avatar.trim() !== '') {
            avatarHtml = `<img src="${app.avatar}" alt="${app.applicantName}" class="applicant-avatar">`;
        } else {
            const initials = app.applicantName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            avatarHtml = `<div class="applicant-avatar-fallback">${initials}</div>`;
        }

        // Skills Pills
        const skillsArray = app.skills ? app.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
        const skillsPillsHtml = skillsArray.map(s => `<span class="skill-pill">${s}</span>`).join(' ');

        // Status Badge
        let statusBadgeHtml = '';
        if (app.status === 'approved') {
            statusBadgeHtml = `<span class="app-status-badge approved">✅ Approved (Role: Teacher)</span>`;
        } else if (app.status === 'rejected') {
            statusBadgeHtml = `<span class="app-status-badge rejected">❌ Rejected</span>`;
        } else {
            statusBadgeHtml = `<span class="app-status-badge pending">⏳ Pending Review</span>`;
        }

        // Action Buttons
        let actionButtonsHtml = '';
        if (app.status === 'pending') {
            actionButtonsHtml = `
                <button type="button" class="btn-approve" onclick="performAction(${app.id}, 'approve', '${app.applicantName}')">
                    <span>Approve ✅</span>
                </button>
                <button type="button" class="btn-reject" onclick="performAction(${app.id}, 'reject', '${app.applicantName}')">
                    <span>Reject ❌</span>
                </button>
            `;
        } else {
            actionButtonsHtml = `<span style="font-size:0.82rem; color:var(--text-light); font-style:italic;">Action Processed</span>`;
        }

        card.innerHTML = `
            <div class="app-header">
                <div class="applicant-info-group">
                    ${avatarHtml}
                    <div class="applicant-name-wrap">
                        <h3>${app.applicantName}</h3>
                        <div class="applicant-meta">
                            <span>@${app.username}</span>
                            <span>•</span>
                            <span>${app.email}</span>
                            <span>•</span>
                            <span class="role-badge">Current Role: ${app.currentRole}</span>
                        </div>
                    </div>
                </div>
                <div>${statusBadgeHtml}</div>
            </div>

            <div class="app-details-grid">
                <div class="detail-item">
                    <h4>📜 Qualifications</h4>
                    <p>${app.qualifications}</p>
                </div>
                <div class="detail-item">
                    <h4>💡 Teaching Skills</h4>
                    <div class="skill-pills">${skillsPillsHtml || '<span style="font-size:0.8rem; color:#94A3B8;">None specified</span>'}</div>
                </div>
                <div class="detail-item">
                    <h4>💼 Experience</h4>
                    <p>${app.experience}</p>
                </div>
                <div class="detail-item">
                    <h4>💰 Hourly Fee</h4>
                    <p><span class="fee-badge">${app.hourlyFee}</span> credit(s) / hr</p>
                </div>
            </div>

            <div class="app-footer">
                <div class="app-date">Submitted: ${app.createdAt}</div>
                <div class="action-btn-group">
                    ${actionButtonsHtml}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

// Perform Approve or Reject action
async function performAction(applicationId, action, applicantName) {
    const actionLabel = action === 'approve' ? 'Approve' : 'Reject';
    const confirmMsg = action === 'approve'
        ? `Are you sure you want to approve ${applicantName}'s application? Their user role will be updated to "Teacher" in the database.`
        : `Are you sure you want to reject ${applicantName}'s application?`;

    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch('/api/profile/admin/teacher-application/action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser ? currentUser.id : ''
            },
            body: JSON.stringify({
                applicationId,
                action
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message);
            // Refresh list
            fetchApplications();
        } else {
            alert(data.message || `Failed to ${actionLabel} application.`);
        }
    } catch (error) {
        console.error(`Error performing ${action} action:`, error);
        alert('Server connection error. Please try again.');
    }
}

// ========== SESSION PAYMENT VERIFICATION TAB (STEP 4) ==========
let allPaymentRequests = [];

function switchAdminTab(tab) {
    const secApps = document.getElementById('adminSecTeacherApps');
    const secPayments = document.getElementById('adminSecPaymentReqs');
    const btnApps = document.getElementById('tabBtnTeacherApps');
    const btnPayments = document.getElementById('tabBtnPaymentReqs');

    if (tab === 'payment-reqs') {
        if (secApps) secApps.style.display = 'none';
        if (secPayments) secPayments.style.display = 'block';
        if (btnApps) btnApps.classList.remove('active');
        if (btnPayments) btnPayments.classList.add('active');
        fetchPaymentRequests();
    } else {
        if (secApps) secApps.style.display = 'block';
        if (secPayments) secPayments.style.display = 'none';
        if (btnApps) btnApps.classList.add('active');
        if (btnPayments) btnPayments.classList.remove('active');
        fetchApplications();
    }
}

async function fetchPaymentRequests() {
    const container = document.getElementById('paymentRequestsContainer');
    if (!container) return;

    try {
        const response = await fetch('/api/profile/admin/payment-requests', {
            method: 'GET',
            headers: { 'X-User-Id': currentUser ? currentUser.id : '' }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            allPaymentRequests = data.requests || [];
            renderPaymentRequests();
        } else {
            container.innerHTML = `<div class="no-apps-notice"><span>⚠️</span><p>Failed to load payment requests.</p></div>`;
        }
    } catch (err) {
        console.error('Error fetching admin payment requests:', err);
        container.innerHTML = `<div class="no-apps-notice"><span>⚠️</span><p>Could not connect to server.</p></div>`;
    }
}

function renderPaymentRequests() {
    const container = document.getElementById('paymentRequestsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (allPaymentRequests.length === 0) {
        container.innerHTML = `
            <div class="no-apps-notice">
                <span>💳</span>
                <p>No session payment verification requests found.</p>
            </div>
        `;
        return;
    }

    allPaymentRequests.forEach(req => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.style.marginBottom = '1.2rem';

        const isApproved = req.status === 'Approved' || req.status === 'approved';
        const isRejected = req.status === 'Rejected' || req.status === 'rejected';
        const isPending = !isApproved && !isRejected;

        let statusBadgeHtml = '';
        if (isApproved) {
            statusBadgeHtml = `<span class="app-status-badge approved">✅ Approved (Session Confirmed)</span>`;
        } else if (isRejected) {
            statusBadgeHtml = `<span class="app-status-badge rejected">❌ Payment Rejected</span>`;
        } else {
            statusBadgeHtml = `<span class="app-status-badge pending" style="background:#FEF3C7; color:#B45309;">⏳ Payment Pending Verification</span>`;
        }

        let actionAreaHtml = '';
        if (isPending) {
            actionAreaHtml = `
                <button type="button" class="btn-approve" onclick="verifySessionPayment(${req.id}, 'approve', '${req.user_name}')">
                    <span>Approve Payment ✅</span>
                </button>
                <button type="button" class="btn-reject" onclick="verifySessionPayment(${req.id}, 'reject', '${req.user_name}')">
                    <span>Reject Payment ❌</span>
                </button>
            `;
        } else {
            actionAreaHtml = `<span style="font-size:0.82rem; color:var(--text-light); font-style:italic;">Action Processed (${req.status})</span>`;
        }

        let proofDisplayHtml = '';
        if (req.payment_proof && req.payment_proof.startsWith('data:image')) {
            proofDisplayHtml = `
                <div style="margin-top:0.6rem;">
                    <strong style="font-size:0.8rem; display:block; margin-bottom:0.3rem;">Uploaded Screenshot Proof:</strong>
                    <a href="${req.payment_proof}" target="_blank">
                        <img src="${req.payment_proof}" alt="Payment Proof Screenshot" style="max-width:240px; max-height:160px; border-radius:8px; border:1px solid var(--border);">
                    </a>
                </div>
            `;
        } else if (req.payment_proof) {
            proofDisplayHtml = `<p style="font-size:0.85rem; color:var(--text);">Proof / Ref: <code>${req.payment_proof}</code></p>`;
        }

        card.innerHTML = `
            <div class="app-header">
                <div class="applicant-info-group">
                    <div class="applicant-avatar-fallback">${(req.user_name || 'U').charAt(0)}</div>
                    <div class="applicant-name-wrap">
                        <h3>${req.user_name || 'Student'}</h3>
                        <div class="applicant-meta">
                            <span>Email: ${req.user_email}</span>
                            <span>•</span>
                            <span>Ref: ${req.transaction_ref || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                <div>${statusBadgeHtml}</div>
            </div>

            <div class="app-details-grid">
                <div class="detail-item">
                    <h4>🎓 Session Skill & Teacher</h4>
                    <p>Skill: <strong>${req.session_skill || 'Session'}</strong> | Teacher: <strong>${req.teacher_name || 'Teacher'}</strong></p>
                </div>
                <div class="detail-item">
                    <h4>📅 Date & Time</h4>
                    <p>${req.session_date || 'Date'} (${req.session_time || 'Time'})</p>
                </div>
                <div class="detail-item">
                    <h4>💰 Fee Amount</h4>
                    <p><span class="fee-badge">${req.session_fee || req.amount || 0}</span> Credit(s)</p>
                </div>
                <div class="detail-item">
                    <h4>📸 Payment Proof Verification</h4>
                    ${proofDisplayHtml}
                </div>
            </div>

            <div class="app-footer">
                <div class="app-date">Submitted: ${req.created_at || 'Recent'}</div>
                <div class="action-btn-group">
                    ${actionAreaHtml}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

async function verifySessionPayment(requestId, action, studentName) {
    const actionLabel = action === 'approve' ? 'Approve' : 'Reject';
    const confirmMsg = action === 'approve'
        ? `Are you sure you want to approve payment for ${studentName}? This will confirm the session booking and enable video call access.`
        : `Are you sure you want to reject payment for ${studentName}? The student will be asked to re-upload valid payment proof.`;

    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch('/api/profile/admin/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser ? currentUser.id : ''
            },
            body: JSON.stringify({ requestId, action })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            alert(data.message);
            fetchPaymentRequests();
        } else {
            alert(data.message || `Failed to ${actionLabel} payment.`);
        }
    } catch (err) {
        console.error(`Error verifying payment:`, err);
        alert('Server connection error.');
    }
}
