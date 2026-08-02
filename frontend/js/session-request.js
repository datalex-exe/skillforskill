// Initialize Dark Mode theme from localStorage
(function() {
    if (localStorage.getItem("dark_theme") === "true") {
        document.body.classList.add("dark-theme");
    }
})();

// Synchronously/Asynchronously verify database instance to clear stale requests on server restart
function checkDbStatus() {
    fetch('/api/status')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const localDbId = localStorage.getItem("db_instance_id");
                localStorage.setItem("db_instance_id", data.dbInstanceId);
                if (localDbId && localDbId !== data.dbInstanceId) {
                    console.log("🔄 Database reset detected. Resetting local session requests...");
                    localStorage.removeItem("session_requests");
                    window.location.reload();
                }
            }
        })
        .catch(err => console.warn("Could not contact status endpoint:", err));
}

// Default Session Requests if localStorage is empty
const defaultRequests = [];

let activeTab = "incoming";
let requests = [];

// Render Header User Avatar (image or fallback initials)
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

document.addEventListener("DOMContentLoaded", async () => {
    // 0. Check Database instance status
    checkDbStatus();

    // 1. Sync User Header info
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    const userRole = (user.role || '').toLowerCase();
    if (userRole === 'teacher') {
        window.location.href = 'teacher-dashboard.html#requestsSec';
        return;
    } else if (userRole === 'admin') {
        window.location.href = 'admin-teacher-applications.html';
        return;
    }

    if (user) {
        document.getElementById('headerUserName').textContent = user.firstName;
        document.getElementById('headerUserRole').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        renderUserHeaderAvatar(user);
    }

    // 2. Fetch and render requests from database
    await fetchSessionRequests();
    if (user) initRealtimeSessionRequests(user.id);
});

// Setup Socket.IO real-time connection for session requests
function initRealtimeSessionRequests(userId) {
    const attachListeners = (socket) => {
        socket.emit('register', userId);
        socket.on('session_status_update', () => {
            fetchSessionRequests();
        });
        socket.on('session_decline_notification', (data) => {
            console.log("🔔 Real-time Notification: Session request declined!", data);
            alert(`🔔 Session Request Declined: Your request for "${data.skill}" was declined by ${data.teacherName}.`);
            fetchSessionRequests();
        });
    };

    if (typeof io !== 'undefined') {
        const socket = io();
        attachListeners(socket);
    } else {
        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = () => {
            if (typeof io !== 'undefined') {
                const socket = io();
                attachListeners(socket);
            }
        };
        document.head.appendChild(script);
    }
}

// Fetch session requests from backend SQLite
async function fetchSessionRequests() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    try {
        const response = await fetch('/api/profile/session-requests', {
            method: 'GET',
            headers: {
                'X-User-Id': user.id
            }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            requests = data.requests;
        }
    } catch (err) {
        console.error("Error fetching session requests:", err);
        // Fallback to local storage
        requests = JSON.parse(localStorage.getItem("session_requests")) || [];
    }

    renderRequests();
}

// Tab navigation handler
function selectTab(e, tabName) {
    const tabs = document.querySelectorAll('.session-tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    e.currentTarget.classList.add('active');

    activeTab = tabName;
    renderRequests();
}

// Render Request cards
function renderRequests() {
    const listContainer = document.getElementById("sessionsList");
    const currentUser = JSON.parse(localStorage.getItem('user'));

    if (!currentUser) {
        listContainer.innerHTML = `<div style="text-align:center; padding: 2rem;">Please log in to view session requests.</div>`;
        return;
    }

    // Update Counts
    const incomingCount = requests.filter(r => r.recipientId == currentUser.id && r.status === "pending").length;
    const outgoingCount = requests.filter(r => r.senderId == currentUser.id && (r.status === "pending" || r.status === "Waiting for Student Payment" || r.status === "Payment Pending Verification" || r.status === "Payment Rejected")).length;
    const scheduledCount = requests.filter(r => (r.status === "accepted" || r.status === "Confirmed" || r.status === "confirmed") && (r.senderId == currentUser.id || r.recipientId == currentUser.id)).length;
    const declinedCount = requests.filter(r => (r.senderId == currentUser.id || r.recipientId == currentUser.id) && (r.status === "Declined" || r.status === "declined" || r.status === "rejected" || r.status === "Rejected")).length;

    document.getElementById("incomingCount").textContent = incomingCount;
    document.getElementById("outgoingCount").textContent = outgoingCount;
    document.getElementById("scheduledCount").textContent = scheduledCount;
    const declinedElem = document.getElementById("declinedCount");
    if (declinedElem) declinedElem.textContent = declinedCount;

    listContainer.innerHTML = "";

    // Filter by active tab
    let filtered = [];
    if (activeTab === "incoming") {
        filtered = requests.filter(r => r.recipientId == currentUser.id && r.status === "pending");
    } else if (activeTab === "outgoing") {
        filtered = requests.filter(r => r.senderId == currentUser.id && (r.status === "pending" || r.status === "Waiting for Student Payment" || r.status === "Payment Pending Verification" || r.status === "Payment Rejected"));
    } else if (activeTab === "scheduled") {
        filtered = requests.filter(r => (r.status === "accepted" || r.status === "Confirmed" || r.status === "confirmed") && (r.senderId == currentUser.id || r.recipientId == currentUser.id));
    } else if (activeTab === "declined") {
        filtered = requests.filter(r => (r.senderId == currentUser.id || r.recipientId == currentUser.id) && (r.status === "Declined" || r.status === "declined" || r.status === "rejected" || r.status === "Rejected"));
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 4rem; color: var(--text-light); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius)">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📅</div>
                <h3>No sessions found in this category.</h3>
                <p style="font-size: 0.85rem; margin-top: 0.2rem;">Requests you interact with will display here.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(req => {
        const card = document.createElement("div");
        card.className = "session-card";

        // Date Display
        const dateObj = new Date(req.date);
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        const formattedDate = dateObj.toLocaleDateString('en-US', options);

        const isIncoming = req.recipientId == currentUser.id;
        const partnerName = isIncoming ? req.senderName : req.recipientName;
        const rawPartnerAvatar = isIncoming ? req.senderAvatar : req.recipientAvatar;
        const partnerInitials = (partnerName.charAt(0) + (partnerName.split(' ')[1]?.charAt(0) || '')).toUpperCase();
        
        const partnerAvatarHtml = (rawPartnerAvatar && rawPartnerAvatar.trim() !== '' && !rawPartnerAvatar.includes('avatar1.jpg'))
            ? `<img src="${rawPartnerAvatar}" alt="${partnerName}" class="session-user-img">`
            : `<div class="session-user-img" style="display:flex; align-items:center; justify-content:center; background:#ECE9FC; color:#5B21B6; font-weight:800; font-size:1.1rem; border-radius:50%; width:54px; height:54px;">${partnerInitials}</div>`;

        const roleLabel = isIncoming ? "Wants to learn" : "You requested to learn";
        const isPaidBadge = req.isPaid ? `<span style="background:#ECE9FC; color:#5B21B6; padding:0.15rem 0.5rem; border-radius:4px; font-weight:700; font-size:0.75rem; margin-left:0.4rem;">Paid Session (${req.feeAmount} Credits/hr)</span>` : '';

        // Action Buttons / Status layout
        let actionMarkup = "";
        if (activeTab === "incoming") {
            actionMarkup = `
                <button class="btn-action-accept" data-req-id="${req.id}" onclick="updateStatus('${req.id}', 'accepted')">Accept</button>
                <button class="btn-action-reject" data-req-id="${req.id}" onclick="updateStatus('${req.id}', 'Declined')">Decline</button>
            `;
        } else if (activeTab === "outgoing") {
            if (req.status === "Waiting for Student Payment" || req.status === "Payment Rejected") {
                actionMarkup = `
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem;">
                        <span class="status-badge" style="background:${req.status === 'Payment Rejected' ? '#FEE2E2' : '#EDE9FE'}; color:${req.status === 'Payment Rejected' ? '#DC2626' : '#6D28D9'}; padding:0.25rem 0.65rem; border-radius:12px; font-weight:700; font-size:0.75rem;">
                            ${req.status === 'Payment Rejected' ? '❌ Payment Rejected' : '💳 Waiting for Payment'}
                        </span>
                        <button type="button" class="btn-action-pay" data-req-id="${req.id}" style="background:#6D28D9; color:#ffffff; border:none; padding:0.5rem 1rem; border-radius:8px; font-weight:700; cursor:pointer;" onclick="openStudentPaymentModal('${req.id}')">Complete Payment 💳</button>
                    </div>
                `;
            } else if (req.status === "Payment Pending Verification") {
                actionMarkup = `<span class="status-badge" style="background:#FEF3C7; color:#B45309; padding:0.35rem 0.85rem; border-radius:12px; font-weight:700; font-size:0.75rem;">🛡️ Payment Pending Verification</span>`;
            } else {
                actionMarkup = `<span class="status-badge pending">Pending</span>`;
            }
        } else if (activeTab === "scheduled") {
            actionMarkup = `
                <button class="btn-action-meeting" data-req-id="${req.id}" onclick="launchMeeting('${req.id}')">💻 Launch Call</button>
            `;
        } else if (activeTab === "declined") {
            actionMarkup = `<span class="status-badge" style="background:#FEE2E2; color:#DC2626; padding:0.35rem 0.85rem; border-radius:12px; font-weight:700; font-size:0.75rem;">Declined</span>`;
        }

        card.innerHTML = `
            <div class="session-left-area">
                ${partnerAvatarHtml}
                <div class="session-info-details">
                    <h3>${partnerName} ${isPaidBadge}</h3>
                    <div class="session-skill-label">${roleLabel} <span>${req.skill}</span></div>
                    <div class="session-schedule">
                        <span>🕒</span>
                        <span>${formattedDate} &nbsp;|&nbsp; ${req.time} (${req.duration || 1} hr)</span>
                    </div>
                    ${req.message ? `<div style="font-size:0.75rem; color:var(--text-light); font-style:italic; margin-top:0.2rem;">💬 "${req.message}"</div>` : ''}
                </div>
            </div>
            <div class="session-right-area">
                ${actionMarkup}
            </div>
        `;

        // Attach explicit click event handlers
        const payBtn = card.querySelector('.btn-action-pay');
        if (payBtn) {
            payBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openStudentPaymentModal(req.id);
            };
        }

        const acceptBtn = card.querySelector('.btn-action-accept');
        if (acceptBtn) {
            acceptBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                updateStatus(req.id, 'accepted');
            };
        }

        const declineBtn = card.querySelector('.btn-action-reject');
        if (declineBtn) {
            declineBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                updateStatus(req.id, 'Declined');
            };
        }

        const meetingBtn = card.querySelector('.btn-action-meeting');
        if (meetingBtn) {
            meetingBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                launchMeeting(req.id);
            };
        }

        listContainer.appendChild(card);
    });
}

// Update Request Status (Accept / Decline)
function updateStatus(reqId, newStatus) {
    if (newStatus === "accepted") {
        openScheduleModal(reqId);
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        alert("You must be logged in to decline session requests.");
        return;
    }

    const statusToUpdate = (newStatus === 'rejected' || newStatus === 'declined' || newStatus === 'Declined') ? 'Declined' : newStatus;

    const declineBtn = document.querySelector(`.btn-action-reject[data-req-id="${reqId}"]`);
    if (declineBtn) {
        declineBtn.disabled = true;
        declineBtn.textContent = "Declining...";
    }

    fetch('/api/profile/session-requests/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': currentUser.id
        },
        body: JSON.stringify({
            reqId: reqId,
            status: statusToUpdate
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const req = requests.find(r => r.id == reqId);
            if (req) req.status = statusToUpdate;
            renderRequests();
            alert("Session request declined successfully.");
            fetchSessionRequests();
        } else {
            alert(data.message || "Failed to decline session request. Please try again.");
            if (declineBtn) {
                declineBtn.disabled = false;
                declineBtn.textContent = "Decline";
            }
        }
    })
    .catch(err => {
        console.error("Error updating session request:", err);
        alert("Failed to connect to server.");
        if (declineBtn) {
            declineBtn.disabled = false;
            declineBtn.textContent = "Decline";
        }
    });
}

// Modal management for Teacher Schedule Fix
function openScheduleModal(reqId) {
    const req = requests.find(r => r.id == reqId);
    if (!req) return;

    const currentUser = JSON.parse(localStorage.getItem('user'));
    const isIncoming = req.recipientId == currentUser.id;
    const partnerName = isIncoming ? req.senderName : req.recipientName;
    const partnerAvatar = isIncoming ? req.senderAvatar : req.recipientAvatar;

    document.getElementById("modalReqId").value = reqId;
    document.getElementById("modalPartnerAvatar").src = partnerAvatar;
    document.getElementById("modalPartnerAvatar").alt = partnerName;
    document.getElementById("modalPartnerName").textContent = partnerName;

    const skillLabelElement = document.getElementById("modalSessionSkillLabel");
    const roleLabel = isIncoming ? "Wants to learn" : "You requested to learn";
    skillLabelElement.innerHTML = `${roleLabel} <span>${req.skill}</span>`;

    document.getElementById("scheduleDateInput").value = req.date || new Date().toISOString().split('T')[0];

    const timeParts = (req.time || "14:00 - 15:00").split(" - ");
    const startTime = timeParts[0] || "14:00";
    const endTime = timeParts[1] || "15:00";

    document.getElementById("scheduleStartTimeInput").value = startTime;
    document.getElementById("scheduleEndTimeInput").value = endTime;

    document.getElementById("scheduleModal").classList.add("active");
}

function closeScheduleModal() {
    document.getElementById("scheduleModal").classList.remove("active");
    document.getElementById("scheduleForm").reset();
}

function confirmSchedule(event) {
    event.preventDefault();

    const reqId = document.getElementById("modalReqId").value;
    const selectedDate = document.getElementById("scheduleDateInput").value;
    const startTime = document.getElementById("scheduleStartTimeInput").value;
    const endTime = document.getElementById("scheduleEndTimeInput").value;

    if (!selectedDate || !startTime || !endTime) {
        alert("Please fill in all schedule fields.");
        return;
    }

    const formattedTimeRange = `${startTime} - ${endTime}`;
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;

    fetch('/api/profile/session-requests/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': currentUser.id
        },
        body: JSON.stringify({
            reqId: reqId,
            status: "accepted",
            date: selectedDate,
            startTime,
            endTime,
            time: formattedTimeRange
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(data.message || `Session Accepted/Scheduled!`);
            closeScheduleModal();
            fetchSessionRequests();
        } else {
            alert(data.message || "Failed to confirm schedule.");
        }
    })
    .catch(err => {
        console.error("Error scheduling session:", err);
        alert("Failed to connect to server.");
        closeScheduleModal();
    });
}

// ========== STEP 3: STUDENT PAYMENT MODAL CONTROLS ==========
function openStudentPaymentModal(reqId) {
    const req = requests.find(r => r.id == reqId);
    if (!req) {
        alert("Session request not found.");
        return;
    }

    const duration = req.duration || 1.0;
    const hourlyFee = req.feeAmount || 1;
    const sessionFee = hourlyFee * duration;
    const platformFee = 0;
    const totalAmount = sessionFee + platformFee;

    document.getElementById('payModalReqId').value = reqId;
    document.getElementById('payTeacherName').textContent = req.recipientName;
    document.getElementById('paySessionDateTime').textContent = `${req.date} (${req.time})`;
    document.getElementById('payDuration').textContent = `${duration} Hour(s)`;
    document.getElementById('paySessionFee').textContent = `${sessionFee} Credits (${hourlyFee} Credits/hr)`;
    document.getElementById('payPlatformFee').textContent = `0 Credits (Free)`;
    document.getElementById('payTotalAmount').textContent = `${totalAmount} Credits`;

    document.getElementById('payTransactionRef').value = '';
    document.getElementById('payProofFile').value = '';
    document.getElementById('payProofBase64').value = '';
    document.getElementById('proofPreview').style.display = 'none';

    document.getElementById('studentPaymentModal').style.display = 'flex';
}

function closeStudentPaymentModal() {
    document.getElementById('studentPaymentModal').style.display = 'none';
    document.getElementById('studentPaymentForm').reset();
}

function handleProofFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('payProofBase64').value = e.target.result;
            document.getElementById('proofPreviewImg').src = e.target.result;
            document.getElementById('proofPreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

async function submitStudentPaymentProof(event) {
    event.preventDefault();

    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;

    const reqId = parseInt(document.getElementById('payModalReqId').value, 10);
    const transactionRef = document.getElementById('payTransactionRef').value.trim();
    const paymentProof = document.getElementById('payProofBase64').value.trim() || transactionRef;

    if (!reqId || !transactionRef) {
        alert('Please fill in the Transaction Reference / UTR ID.');
        return;
    }

    const btn = document.getElementById('btnSubmitPayment');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span>⏳ Submitting...</span>`;
    }

    try {
        const response = await fetch('/api/profile/submit-session-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser.id
            },
            body: JSON.stringify({
                reqId,
                transactionRef,
                paymentProof
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert('🎉 Payment proof submitted successfully!\n\nYour session status is now "Payment Pending Verification". Admin will verify your payment to confirm the booking.');
            closeStudentPaymentModal();
            fetchSessionRequests();
        } else {
            alert(data.message || 'Could not submit payment proof.');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<span>Submit Payment Proof 📤</span>`;
            }
        }
    } catch (err) {
        console.error('Error submitting payment proof:', err);
        alert('Server error. Please try again.');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span>Submit Payment Proof 📤</span>`;
        }
    }
}

// Redirect to meeting room
function launchMeeting(reqId) {
    window.location.href = `session-room.html?id=${reqId}`;
}
