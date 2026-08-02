// Teacher Dashboard JavaScript Logic
let currentUser = null;
let allSessionRequests = [];
let allActiveSessions = [];
let allTransactions = [];
let profileData = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Resolve logged-in user session
    try {
        currentUser = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
        currentUser = null;
    }

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Role check: Ensure user is a Teacher
    const userRole = (currentUser.role || '').toLowerCase();
    if (userRole === 'admin') {
        window.location.href = 'admin-teacher-applications.html';
        return;
    } else if (userRole !== 'teacher' && userRole !== 'both') {
        console.warn('⚠️ User is not a teacher. Redirecting to student dashboard...');
        window.location.href = 'dashboard.html';
        return;
    }

    // Header initial sync
    if (document.getElementById('headerUserName')) document.getElementById('headerUserName').textContent = currentUser.firstName;
    if (document.getElementById('teacherWelcomeTitle')) document.getElementById('teacherWelcomeTitle').textContent = `Welcome, ${currentUser.firstName}! 🎓`;
    renderUserHeaderAvatar(currentUser);

    // 2. Fetch data in parallel
    await Promise.all([
        fetchTeacherProfile(),
        fetchSessionRequests(),
        fetchActiveSessions(),
        fetchTransactions()
    ]);

    // 3. Render dashboard metrics and quick panels
    renderDashboardOverview();

    // 4. Handle deep linking tab navigation (#requestsSec or ?tab=requestsSec)
    const urlParams = new URLSearchParams(window.location.search);
    const targetTab = urlParams.get('tab') || (window.location.hash ? window.location.hash.replace('#', '') : null);
    if (targetTab && document.getElementById(targetTab)) {
        switchTeacherTab(null, targetTab);
    }
});

// Render Header User Avatar
function renderUserHeaderAvatar(user) {
    const avatarEl = document.getElementById('headerUserAvatar');
    if (!avatarEl || !user) return;

    const initialLetters = (user.firstName.charAt(0) + (user.lastName ? user.lastName.charAt(0) : '')).toUpperCase();
    if (user.avatar && user.avatar.trim() !== '') {
        avatarEl.innerHTML = `<img src="${user.avatar}" alt="${user.firstName}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
        avatarEl.textContent = initialLetters;
    }
}

// Tab Switcher Handler
function switchTeacherTab(e, tabId) {
    if (e && e.preventDefault) e.preventDefault();

    document.querySelectorAll('.teacher-tab-content').forEach(sec => {
        sec.style.display = 'none';
        sec.classList.remove('active');
    });

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const targetSec = document.getElementById(tabId);
    if (targetSec) {
        targetSec.style.display = 'block';
        targetSec.classList.add('active');
    }

    const navLink = document.querySelector(`.sidebar-nav .nav-item[data-tab="${tabId}"]`);
    if (navLink) navLink.classList.add('active');
}

// 1. Fetch Teacher Profile
async function fetchTeacherProfile() {
    try {
        const response = await fetch('/api/profile', {
            method: 'GET',
            headers: { 'X-User-Id': currentUser.id }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            profileData = data.profile;
        }
    } catch (err) {
        console.error('Error fetching teacher profile:', err);
    }
}

// 2. Fetch Session Requests
async function fetchSessionRequests() {
    try {
        const response = await fetch('/api/profile/session-requests', {
            method: 'GET',
            headers: { 'X-User-Id': currentUser.id }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            // Filter incoming requests (where currentUser is recipient)
            allSessionRequests = (data.requests || []).filter(r => String(r.recipientId) === String(currentUser.id));
        }
    } catch (err) {
        console.error('Error fetching session requests:', err);
    }
}

// 3. Fetch Active & Upcoming Sessions
async function fetchActiveSessions() {
    try {
        const response = await fetch('/api/profile/active-sessions', {
            method: 'GET',
            headers: { 'X-User-Id': currentUser.id }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            allActiveSessions = data.sessions || [];
        }
    } catch (err) {
        console.error('Error fetching active sessions:', err);
    }
}

// 4. Fetch Transactions (Payment / Credits History)
async function fetchTransactions() {
    try {
        const response = await fetch('/api/profile/transactions', {
            method: 'GET',
            headers: { 'X-User-Id': currentUser.id }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            allTransactions = data.transactions || [];
        }
    } catch (err) {
        console.error('Error fetching transactions:', err);
    }
}

// Render Dashboard Overview Section
function renderDashboardOverview() {
    const pendingRequests = allSessionRequests.filter(r => r.status === 'pending');
    const upcomingSessions = allActiveSessions.filter(s => s.status === 'scheduled' || s.status === 'active' || s.status === 'confirmed' || s.status === 'accepted');
    const earnedTransactions = allTransactions.filter(t => t.type === 'earned' || (t.amount && t.amount > 0));

    // Calculate total earned credits
    const totalEarnedCredits = profileData && profileData.creditsEarned !== undefined
        ? profileData.creditsEarned 
        : earnedTransactions.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    // Calculate unique students taught
    const uniqueStudentSet = new Set();
    earnedTransactions.forEach(t => {
        if (t.partnerId || t.partner_id) uniqueStudentSet.add(t.partnerId || t.partner_id);
    });
    const totalStudentsTaught = (profileData && profileData.skillsTaughtCount !== undefined) 
        ? profileData.skillsTaughtCount 
        : uniqueStudentSet.size;

    // Update Metric Stats Cards
    if (document.getElementById('statTotalEarnings')) document.getElementById('statTotalEarnings').textContent = totalEarnedCredits;
    if (document.getElementById('statStudentsTaught')) document.getElementById('statStudentsTaught').textContent = totalStudentsTaught;
    if (document.getElementById('statPendingRequests')) document.getElementById('statPendingRequests').textContent = pendingRequests.length;
    if (document.getElementById('statActiveSessions')) document.getElementById('statActiveSessions').textContent = upcomingSessions.length;

    // Sidebar Badges
    const reqBadge = document.getElementById('sidebarRequestBadge');
    if (reqBadge) {
        if (pendingRequests.length > 0) {
            reqBadge.textContent = pendingRequests.length;
            reqBadge.style.display = 'inline-block';
        } else {
            reqBadge.style.display = 'none';
        }
    }

    const upBadge = document.getElementById('sidebarUpcomingBadge');
    if (upBadge) {
        if (upcomingSessions.length > 0) {
            upBadge.textContent = upcomingSessions.length;
            upBadge.style.display = 'inline-block';
        } else {
            upBadge.style.display = 'none';
        }
    }

    // Render Quick Lists on Dashboard tab
    renderQuickRequests(pendingRequests);
    renderQuickSessions(upcomingSessions);

    // Render Full Sections
    renderRequestsSection();
    renderUpcomingSection();
    renderEarningsSection(totalEarnedCredits, earnedTransactions);
    renderPaymentHistorySection(earnedTransactions);
}

// Helper to render standardized status badges
function renderStatusBadge(status) {
    const s = (status || '').trim();
    if (s === 'pending' || s === 'Pending') {
        return `<span class="status-badge badge-pending" style="background:#FEF3C7; color:#D97706; padding:0.25rem 0.65rem; border-radius:12px; font-weight:700; font-size:0.78rem;">⏳ Pending</span>`;
    } else if (s === 'Waiting for Student Payment') {
        return `<span class="status-badge badge-waiting" style="background:#EDE9FE; color:#6D28D9; padding:0.25rem 0.65rem; border-radius:12px; font-weight:700; font-size:0.78rem;">💳 Waiting for Student Payment</span>`;
    } else if (s === 'Payment Pending Verification') {
        return `<span class="status-badge badge-verifying" style="background:#FEF3C7; color:#B45309; padding:0.25rem 0.65rem; border-radius:12px; font-weight:700; font-size:0.78rem;">🛡️ Payment Pending Verification</span>`;
    } else if (s === 'Confirmed' || s === 'confirmed' || s === 'accepted') {
        return `<span class="status-badge badge-confirmed" style="background:#D1FAE5; color:#047857; padding:0.25rem 0.65rem; border-radius:12px; font-weight:700; font-size:0.78rem;">✅ Confirmed</span>`;
    } else if (s === 'Completed' || s === 'completed') {
        return `<span class="status-badge badge-completed" style="background:#CCFBF1; color:#0F766E; padding:0.25rem 0.65rem; border-radius:12px; font-weight:700; font-size:0.78rem;">🎉 Completed</span>`;
    } else if (s === 'Payment Rejected') {
        return `<span class="status-badge badge-rejected" style="background:#FEE2E2; color:#B91C1C; padding:0.25rem 0.65rem; border-radius:12px; font-weight:700; font-size:0.78rem;">❌ Payment Rejected</span>`;
    } else if (s === 'Rejected' || s === 'Declined' || s === 'declined') {
        return `<span class="status-badge badge-rejected" style="background:#FEE2E2; color:#B91C1C; padding:0.25rem 0.65rem; border-radius:12px; font-weight:700; font-size:0.78rem;">❌ Rejected</span>`;
    }
    return `<span class="status-badge" style="background:#E2E8F0; color:#475569; padding:0.25rem 0.65rem; border-radius:12px; font-weight:700; font-size:0.78rem;">${s}</span>`;
}

// Quick Requests on Dashboard
function renderQuickRequests(pendingRequests) {
    const container = document.getElementById('quickRequestsList');
    if (!container) return;
    container.innerHTML = '';

    if (pendingRequests.length === 0) {
        container.innerHTML = `<div class="empty-notice">No pending student requests.</div>`;
        return;
    }

    pendingRequests.slice(0, 3).forEach(req => {
        const item = document.createElement('div');
        item.className = 'request-item-card';

        let avatarHtml = req.senderAvatar
            ? `<img src="${req.senderAvatar}" class="student-avatar" alt="${req.senderName}">`
            : `<div class="student-avatar-fallback">${req.senderName.charAt(0)}</div>`;

        item.innerHTML = `
            <div class="student-info-meta">
                ${avatarHtml}
                <div class="student-text">
                    <h4>${req.senderName}</h4>
                    <p>Wants to learn <span class="skill-highlight">${req.skill}</span> ${req.isPaid ? `<strong style="color:#6D28D9;">(Paid: ${req.feeAmount} Credits)</strong>` : ''}</p>
                    <p style="font-size:0.72rem; color:#94A3B8;">${req.date} at ${req.time}</p>
                </div>
            </div>
            <div class="req-actions" style="display:flex; gap:0.4rem;">
                <button class="btn-accept" onclick="respondToRequest(${req.id}, 'accepted')">Accept ✅</button>
                <button class="btn-decline" onclick="respondToRequest(${req.id}, 'Declined')">Decline ❌</button>
            </div>
        `;
        container.appendChild(item);
    });
}

// Quick Sessions on Dashboard
function renderQuickSessions(upcomingSessions) {
    const container = document.getElementById('quickSessionsList');
    if (!container) return;
    container.innerHTML = '';

    if (upcomingSessions.length === 0) {
        container.innerHTML = `<div class="empty-notice">No upcoming sessions scheduled.</div>`;
        return;
    }

    upcomingSessions.slice(0, 3).forEach(s => {
        const item = document.createElement('div');
        item.className = 'session-item-card';

        item.innerHTML = `
            <div class="session-info">
                <h4>${s.skill} Session</h4>
                <p>Student: <strong>${s.partnerName}</strong></p>
                <p style="font-size:0.75rem; color:#94A3B8;">📅 ${s.date} • ⏰ ${s.time}</p>
            </div>
            <a href="session-room.html?id=${s.id}&requestId=${s.requestId}&roomId=${encodeURIComponent(s.roomId)}" class="btn-join-call">
                <span>🎥 Join Call</span>
            </a>
        `;
        container.appendChild(item);
    });
}

// Render Full Requests Section
function renderRequestsSection() {
    const container = document.getElementById('requestsFullContainer');
    if (!container) return;
    container.innerHTML = '';

    if (allSessionRequests.length === 0) {
        container.innerHTML = `<div class="empty-notice">No session requests found.</div>`;
        return;
    }

    allSessionRequests.forEach(req => {
        const item = document.createElement('div');
        item.className = 'request-item-card';
        item.style.marginBottom = '1rem';

        let avatarHtml = req.senderAvatar
            ? `<img src="${req.senderAvatar}" class="student-avatar" alt="${req.senderName}">`
            : `<div class="student-avatar-fallback">${req.senderName.charAt(0)}</div>`;

        let actionAreaHtml = '';
        if (req.status === 'pending') {
            actionAreaHtml = `
                <div class="req-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <button class="btn-accept" onclick="respondToRequest(${req.id}, 'accepted')">Accept ✅</button>
                    <button class="btn-accept" style="background:#4F46E5;" onclick="openTeacherEditModal(${req.id}, '${req.date}', '${req.startTime || ''}', '${req.endTime || ''}')">Edit & Accept ✏️</button>
                    <button class="btn-decline" onclick="respondToRequest(${req.id}, 'Declined')">Decline ❌</button>
                </div>
            `;
        } else {
            actionAreaHtml = renderStatusBadge(req.status);
        }

        const isPaidTag = req.isPaid ? `<span style="background:#ECE9FC; color:#5B21B6; padding:0.15rem 0.5rem; border-radius:4px; font-weight:700; font-size:0.75rem;">Paid Session (${req.feeAmount} Credits)</span>` : `<span style="background:#E2E8F0; color:#475569; padding:0.15rem 0.5rem; border-radius:4px; font-weight:700; font-size:0.75rem;">Free Barter</span>`;

        item.innerHTML = `
            <div class="student-info-meta">
                ${avatarHtml}
                <div class="student-text">
                    <h4>${req.senderName} ${isPaidTag}</h4>
                    <p>Requesting: <span class="skill-highlight">${req.skill}</span></p>
                    <p style="font-size:0.75rem; color:#94A3B8;">Date: ${req.date} • Time: ${req.time} (${req.duration || 1} hr)</p>
                    ${req.message ? `<p style="font-size:0.75rem; color:var(--text-light); font-style:italic;">💬 "${req.message}"</p>` : ''}
                </div>
            </div>
            <div>${actionAreaHtml}</div>
        `;
        container.appendChild(item);
    });
}

// Render Full Upcoming Section (Step 5: Disabled call button unless Confirmed)
function renderUpcomingSection() {
    const container = document.getElementById('upcomingFullContainer');
    if (!container) return;
    container.innerHTML = '';

    if (allActiveSessions.length === 0) {
        container.innerHTML = `<div class="empty-notice">No scheduled teaching sessions found.</div>`;
        return;
    }

    allActiveSessions.forEach(s => {
        const item = document.createElement('div');
        item.className = 'session-item-card';
        item.style.marginBottom = '1rem';

        // Check matching request status if available
        const matchedReq = allSessionRequests.find(r => r.id == s.requestId || r.id == s.id);
        const reqStatus = matchedReq ? matchedReq.status : s.status;
        const isConfirmed = (reqStatus === 'Confirmed' || reqStatus === 'confirmed' || reqStatus === 'active' || reqStatus === 'scheduled');

        let buttonHtml = '';
        if (isConfirmed) {
            buttonHtml = `
                <a href="session-room.html?id=${s.id}&requestId=${s.requestId}&roomId=${encodeURIComponent(s.roomId)}" class="btn-join-call">
                    <span>🎥 Start Call Now</span>
                </a>
            `;
        } else {
            buttonHtml = `
                <button class="btn-join-call disabled" disabled style="opacity:0.6; cursor:not-allowed; background:#94A3B8;">
                    <span>🔒 Call Disabled (${reqStatus})</span>
                </button>
            `;
        }

        item.innerHTML = `
            <div class="session-info">
                <h4>${s.skill} Teaching Session</h4>
                <p>Student: <strong>${s.partnerName}</strong></p>
                <p style="font-size:0.78rem; color:#94A3B8;">📅 ${s.date} • ⏰ ${s.time} • Status: ${renderStatusBadge(reqStatus)}</p>
            </div>
            ${buttonHtml}
        `;
        container.appendChild(item);
    });
}

// Render Earnings Section
function renderEarningsSection(totalCredits, earnedTransactions) {
    if (document.getElementById('earningsWalletBalance')) {
        document.getElementById('earningsWalletBalance').textContent = `${totalCredits} Credits`;
    }
    if (document.getElementById('earningsTotalHours')) {
        document.getElementById('earningsTotalHours').textContent = `${earnedTransactions.length} Hours`;
    }

    const container = document.getElementById('earningsBreakdownContainer');
    if (!container) return;
    container.innerHTML = '';

    if (earnedTransactions.length === 0) {
        container.innerHTML = `<div class="empty-notice">No completed session earnings recorded yet.</div>`;
        return;
    }

    const skillMap = {};
    earnedTransactions.forEach(t => {
        const skill = t.skill || 'Teaching Session';
        skillMap[skill] = (skillMap[skill] || 0) + t.amount;
    });

    Object.keys(skillMap).forEach(skill => {
        const amount = skillMap[skill];
        const item = document.createElement('div');
        item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.8rem; background:#FAF8FC; border-radius:8px; margin-bottom:0.6rem; font-size:0.9rem;';
        item.innerHTML = `
            <span style="font-weight:700; color:var(--text);">🎓 ${skill}</span>
            <span style="font-weight:800; color:var(--accent-purple);">${amount} Credit(s)</span>
        `;
        container.appendChild(item);
    });
}

// Render Payment History Table Section
function renderPaymentHistorySection(earnedTransactions) {
    const tbody = document.getElementById('paymentHistoryTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!allTransactions || allTransactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-notice">No payment or credit transaction logs found.</td></tr>`;
        return;
    }

    allTransactions.forEach(t => {
        const tr = document.createElement('tr');
        const isEarned = t.type === 'earned' || t.amount > 0;
        const amountDisplay = isEarned ? `+${t.amount}` : `${t.amount}`;
        const amountColor = isEarned ? '#059669' : '#DC2626';

        tr.innerHTML = `
            <td>${t.date ? t.date.split('T')[0] : 'Recent'}</td>
            <td>${t.partner || 'Student'}</td>
            <td>${t.skill || 'Session Barter'}</td>
            <td style="font-weight:800; color:${amountColor};">${amountDisplay} Credit(s)</td>
            <td><span class="role-badge" style="background:${isEarned ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}; color:${amountColor};">${isEarned ? 'Earned' : 'Spent'}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Respond to Request (Accept / Decline)
async function respondToRequest(reqId, status) {
    try {
        const response = await fetch('/api/profile/session-requests/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser.id
            },
            body: JSON.stringify({ reqId, status })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message);
            await Promise.all([
                fetchSessionRequests(),
                fetchActiveSessions()
            ]);
            renderDashboardOverview();
        } else {
            alert(data.message || 'Could not update request status.');
        }
    } catch (err) {
        console.error('Error updating request status:', err);
        alert('Server error. Please try again.');
    }
}

// Teacher Edit Modal Controls
function openTeacherEditModal(reqId, date, startTime, endTime) {
    document.getElementById('teacherEditReqId').value = reqId;
    document.getElementById('teacherEditDate').value = date || new Date().toISOString().split('T')[0];
    document.getElementById('teacherEditStartTime').value = startTime || '14:00';
    document.getElementById('teacherEditEndTime').value = endTime || '15:00';
    document.getElementById('teacherEditModal').style.display = 'flex';
}

function closeTeacherEditModal() {
    document.getElementById('teacherEditModal').style.display = 'none';
}

async function submitTeacherEditAndAccept(event) {
    event.preventDefault();
    const reqId = parseInt(document.getElementById('teacherEditReqId').value, 10);
    const date = document.getElementById('teacherEditDate').value;
    const startTime = document.getElementById('teacherEditStartTime').value;
    const endTime = document.getElementById('teacherEditEndTime').value;

    if (!reqId || !date || !startTime || !endTime) {
        alert('Please fill in all date and time fields.');
        return;
    }

    try {
        const response = await fetch('/api/profile/session-requests/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser.id
            },
            body: JSON.stringify({ reqId, status: 'accepted', date, startTime, endTime, time: `${startTime} - ${endTime}` })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            alert(data.message);
            closeTeacherEditModal();
            await Promise.all([
                fetchSessionRequests(),
                fetchActiveSessions()
            ]);
            renderDashboardOverview();
        } else {
            alert(data.message || 'Could not update request status.');
        }
    } catch (err) {
        console.error('Error submitting edit & accept:', err);
        alert('Server error.');
    }
}
