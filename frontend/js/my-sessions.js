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

let activeSessionsTab = "upcoming";

const defaultRequests = [];
let sessions = [];

let currentUserDailyLimitData = null;

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
        window.location.href = 'teacher-dashboard.html#upcomingSec';
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

    // 2. Fetch sessions from backend
    await fetchMySessions();
    
    // 3. Handle URL parameter or Hash for tab selection (e.g. ?tab=completed)
    handleTabParamNavigation();

    if (user) {
        await fetchDailyCallUsage();
        initRealtimeMySessions(user.id);
    }
});

// Handle URL Tab deep linking (e.g. ?tab=completed)
function handleTabParamNavigation() {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = (urlParams.get('tab') || window.location.hash.replace('#', '')).toLowerCase();
    if (tabParam === 'completed') {
        activeSessionsTab = 'completed';
        const tabBtns = document.querySelectorAll('.session-tab-btn');
        tabBtns.forEach(t => t.classList.remove('active'));
        if (tabBtns[1]) tabBtns[1].classList.add('active');
        renderMySessions();
    }
}

// Format seconds into readable string e.g. "1h 45m" or "12m 30s"
function formatTimeHoursMins(totalSec) {
    if (isNaN(totalSec) || totalSec < 0) return "0m 00s";
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
        return `${hrs}h ${mins < 10 ? '0' : ''}${mins}m`;
    }
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
}

// Fetch daily call usage
async function fetchDailyCallUsage() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    try {
        const response = await fetch('/api/profile/daily-call-usage', {
            headers: { 'X-User-Id': user.id }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            currentUserDailyLimitData = data;
            updateDailyLimitUI(data);
        }
    } catch (err) {
        console.error("Error fetching daily call usage:", err);
    }
}

function updateDailyLimitUI(data) {
    const textEl = document.getElementById("dailyUsageTimeText");
    const pillEl = document.getElementById("dailyUsagePill");
    if (!textEl) return;

    if (data.isPremium) {
        textEl.textContent = "Unlimited (PRO)";
        if (pillEl) {
            pillEl.className = "daily-usage-pill";
            pillEl.style.borderColor = "rgba(245, 158, 11, 0.5)";
            pillEl.style.color = "#fbbf24";
        }
        return;
    }

    const formattedUsed = formatTimeHoursMins(data.secondsUsed);
    textEl.textContent = `${formattedUsed} / 3h`;

    if (pillEl) {
        if (data.limitReached) {
            pillEl.className = "daily-usage-pill blocked";
        } else if (data.secondsUsed >= 9000) {
            pillEl.className = "daily-usage-pill warning";
        } else {
            pillEl.className = "daily-usage-pill";
        }
    }
}

// Setup Socket.IO real-time listener for My Sessions
function initRealtimeMySessions(userId) {
    const attachListeners = (socket) => {
        socket.emit('register', userId);
        socket.on('session_status_update', () => {
            fetchMySessions();
        });
        socket.on('session_decline_notification', (data) => {
            console.log("🔔 Real-time Notification: Session request declined!", data);
            alert(`🔔 Session Request Declined: Your request for "${data.skill}" was declined by ${data.teacherName}.`);
            fetchMySessions();
        });
        socket.on('daily_limit_reset', () => {
            console.log("🌙 Midnight limit reset triggered!");
            fetchDailyCallUsage();
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

async function fetchMySessions() {
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
            sessions = data.requests;
        }
    } catch (err) {
        console.error("Error fetching sessions:", err);
        sessions = JSON.parse(localStorage.getItem("session_requests")) || [];
    }

    renderMySessions();
}

// Toggle Sessions Tabs
function selectSessionsTab(e, tabName) {
    const tabs = document.querySelectorAll(".session-tab-btn");
    tabs.forEach(t => t.classList.remove("active"));
    e.currentTarget.classList.add("active");

    activeSessionsTab = tabName;
    renderMySessions();
}

// Render Scheduled Sessions Feed
function renderMySessions() {
    const container = document.getElementById("sessionsFeedContainer");
    const currentUser = JSON.parse(localStorage.getItem('user'));

    if (!currentUser) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2rem;">Please log in to view sessions.</div>`;
        return;
    }

    // Filter sessions belonging to current user
    const mySessions = sessions.filter(s => s.senderId == currentUser.id || s.recipientId == currentUser.id);

    // Calculate tab stats
    const upcomingCount = mySessions.filter(s => s.status === 'Confirmed' || s.status === 'confirmed' || s.status === 'accepted' || s.status === 'scheduled' || s.status === 'active').length;
    const completedCount = mySessions.filter(s => s.status === 'completed' || s.status === 'Completed').length;
    const cancelledCount = mySessions.filter(s => s.status === 'rejected' || s.status === 'cancelled' || s.status === 'Declined' || s.status === 'declined' || s.status === 'Payment Rejected').length;

    document.getElementById("upcomingCount").textContent = upcomingCount;
    document.getElementById("completedCount").textContent = completedCount;
    document.getElementById("cancelledCount").textContent = cancelledCount;

    container.innerHTML = "";

    let filtered = [];
    if (activeSessionsTab === "upcoming") {
        filtered = mySessions.filter(s => s.status === 'Confirmed' || s.status === 'confirmed' || s.status === 'accepted' || s.status === 'scheduled' || s.status === 'active' || s.status === 'Waiting for Student Payment' || s.status === 'Payment Pending Verification');
    } else if (activeSessionsTab === "completed") {
        filtered = mySessions.filter(s => s.status === 'completed' || s.status === 'Completed');
    } else if (activeSessionsTab === "cancelled") {
        filtered = mySessions.filter(s => s.status === 'rejected' || s.status === 'cancelled' || s.status === 'Declined' || s.status === 'declined' || s.status === 'Payment Rejected');
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-light); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius)">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📖</div>
                <h3>No sessions found in this category.</h3>
                <p style="font-size: 0.85rem; margin-top: 0.2rem;">Scheduled classes will be listed here.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(session => {
        const card = document.createElement("div");
        card.className = "my-session-card";

        const dateObj = new Date(session.date);
        const options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
        const formattedDate = dateObj.toLocaleDateString('en-US', options);

        const isOutgoing = session.senderId == currentUser.id;
        const partnerName = isOutgoing ? session.recipientName : session.senderName;
        const rawPartnerAvatar = isOutgoing ? session.recipientAvatar : session.senderAvatar;
        const partnerInitials = (partnerName.charAt(0) + (partnerName.split(' ')[1]?.charAt(0) || '')).toUpperCase();

        const partnerAvatarHtml = (rawPartnerAvatar && rawPartnerAvatar.trim() !== '' && !rawPartnerAvatar.includes('avatar1.jpg'))
            ? `<img src="${rawPartnerAvatar}" alt="${partnerName}" class="partner-avatar">`
            : `<div class="partner-avatar" style="display:flex; align-items:center; justify-content:center; background:#ECE9FC; color:#5B21B6; font-weight:800; font-size:1.1rem; border-radius:50%; width:54px; height:54px;">${partnerInitials}</div>`;

        const teacherName = isOutgoing ? session.recipientName : "You (Teaching)";
        const learnerName = isOutgoing ? "You" : session.senderName;
        const roleLabel = isOutgoing ? "Learn Skill" : "Teach Skill";

        const sStatus = (session.status || '').trim();
        const isConfirmed = (sStatus === 'Confirmed' || sStatus === 'confirmed' || sStatus === 'accepted' || sStatus === 'scheduled' || sStatus === 'active');

        let actionAreaMarkup = '';
        if (isConfirmed) {
            actionAreaMarkup = `
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <button class="btn-start-session" onclick="startSession('${session.id}')">🎥 Start Call Now</button>
                    <button class="btn-cancel-session" onclick="cancelSession('${session.id}')" style="background:#FEE2E2; color:#DC2626; border:1px solid #FCA5A5; padding:0.45rem 0.9rem; border-radius:8px; font-weight:600; font-size:0.8rem; cursor:pointer;">Decline</button>
                </div>
            `;
        } else if (sStatus === 'Waiting for Student Payment' || sStatus === 'Payment Rejected') {
            actionAreaMarkup = `
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem;">
                    <span style="font-size:0.75rem; font-weight:700; color:${sStatus === 'Payment Rejected' ? '#DC2626' : '#6D28D9'};">
                        ${sStatus === 'Payment Rejected' ? '❌ Payment Rejected' : '💳 Waiting for Student Payment'}
                    </span>
                    ${isOutgoing ? `<button type="button" class="btn-action-pay" data-req-id="${session.id}" style="background:#6D28D9; color:#fff; border:none; padding:0.5rem 1rem; border-radius:8px; font-weight:700; cursor:pointer;" onclick="openStudentPaymentModal('${session.id}')">Complete Payment 💳</button>` : ''}
                </div>
            `;
        } else if (sStatus === 'Payment Pending Verification') {
            actionAreaMarkup = `
                <span class="status-badge" style="background:#FEF3C7; color:#B45309; padding:0.35rem 0.85rem; border-radius:12px; font-weight:700; font-size:0.75rem;">🛡️ Payment Pending Verification</span>
            `;
        } else {
            actionAreaMarkup = `
                <span style="font-size: 0.85rem; font-weight:600; color: var(--text-light); text-transform:capitalize;">Status: ${sStatus}</span>
            `;
        }

        card.innerHTML = `
            <div class="card-left">
                ${partnerAvatarHtml}
                <div class="session-main-meta">
                    <div class="session-header-badge">${roleLabel}</div>
                    <h3>${session.skill}</h3>
                    <div class="partner-role-line">
                        <span>Teacher: <strong>${teacherName}</strong></span>
                        <span style="margin: 0 8px; color:var(--border)">|</span>
                        <span>Learner: <strong>${learnerName}</strong></span>
                    </div>
                    <div class="schedule-line">
                        <span>🕒</span>
                        <span>${formattedDate} &nbsp;at&nbsp; <strong>${session.time}</strong></span>
                    </div>
                </div>
            </div>
            <div class="card-right">
                <span class="status-badge-indicator ${isConfirmed ? 'upcoming' : ''}">${session.status}</span>
                ${actionAreaMarkup}
            </div>
        `;

        container.appendChild(card);
    });
}

// Redirect to Jitsi Session call room passing session ID
async function startSession(sessionId) {
    const session = sessions.find(s => s.id == sessionId);
    const currentUser = JSON.parse(localStorage.getItem('user'));

    if (!currentUser) {
        alert("You must be logged in to join a session call.");
        window.location.href = "login.html";
        return;
    }

    if (session && session.senderId == currentUser.id) {
        const sessionDateStr = session.date;
        const startTimeStr = session.time.split(" - ")[0];
        const scheduledDateTime = new Date(`${sessionDateStr}T${startTimeStr}:00`);

        if (new Date() < scheduledDateTime) {
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            const formattedDate = new Date(session.date).toLocaleDateString('en-US', options);
            alert(`This session is scheduled for ${formattedDate} at ${session.time.split(" - ")[0]}.\n\nYou can only start the session once the scheduled time is reached!`);
            return;
        }
    }

    // Check daily video call limit before redirecting
    try {
        const res = await fetch('/api/profile/daily-call-usage', {
            headers: { 'X-User-Id': currentUser.id }
        });
        const data = await res.json();
        if (res.ok && data.success && data.limitReached) {
            alert("⏳ Daily Video Call Limit Reached!\n\nYou have used your maximum allowed 3 hours of video calling for today. Please upgrade to Premium or return after midnight (12:00 AM) reset.");
            openPremiumModal();
            return;
        }
    } catch (err) {
        console.warn("Could not verify daily call limit prior to start:", err);
    }

    window.location.href = `session-room.html?id=${sessionId}`;
}

// Modal controls for Premium Upgrade
function openPremiumModal() {
    window.location.href = "premium.html";
}

function closePremiumModal() {
    const modal = document.getElementById("premiumModal");
    if (modal) modal.style.display = "none";
}

async function confirmPremiumUpgrade() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;
    try {
        const response = await fetch('/api/profile/upgrade-premium', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser.id
            }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            alert(data.message || "🎉 Successfully upgraded to BarterLearn Premium!");
            currentUser.isPremium = true;
            localStorage.setItem("user", JSON.stringify(currentUser));
            window.location.reload();
        } else {
            alert(data.message || "Error upgrading to premium.");
        }
    } catch (err) {
        console.error("Error confirming premium upgrade:", err);
        alert("Failed to connect to server.");
    }
}

// Decline / Cancel session handler
async function cancelSession(sessionId) {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;

    if (!confirm("Are you sure you want to decline / cancel this session?")) return;

    try {
        const response = await fetch('/api/profile/session-requests/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser.id
            },
            body: JSON.stringify({
                reqId: sessionId,
                status: 'Declined'
            })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            alert("Session request declined / cancelled successfully.");
            fetchMySessions();
        } else {
            alert(data.message || "Failed to decline session.");
        }
    } catch (err) {
        console.error("Error declining session:", err);
        alert("Failed to connect to server.");
    }
}

// ========== STUDENT PAYMENT MODAL CONTROLS ==========
function openStudentPaymentModal(reqId) {
    const session = sessions.find(s => s.id == reqId);
    if (!session) {
        window.location.href = `session-request.html?pay=${reqId}`;
        return;
    }

    const duration = session.duration || 1.0;
    const hourlyFee = session.feeAmount || 1;
    const sessionFee = hourlyFee * duration;
    const platformFee = 0;
    const totalAmount = sessionFee + platformFee;

    document.getElementById('payModalReqId').value = reqId;
    document.getElementById('payTeacherName').textContent = session.recipientName || session.teacherName || 'Teacher';
    document.getElementById('paySessionDateTime').textContent = `${session.date} (${session.time})`;
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
            fetchMySessions();
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
