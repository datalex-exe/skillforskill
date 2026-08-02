// Initialize Dark Mode theme from localStorage
(function () {
    if (localStorage.getItem("dark_theme") === "true") {
        document.body.classList.add("dark-theme");
    }
})();

let sessionTimerInterval = null;
let heartbeatInterval = null;
let secondsElapsed = 0;
let currentSession = null;
let userSessionInfo = null;
let jitsiApiInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Sync User info
    userSessionInfo = JSON.parse(localStorage.getItem('user'));
    if (!userSessionInfo) {
        alert("You must be logged in to access the call room.");
        window.location.href = "login.html";
        return;
    }

    // 2. Parse Query Params (Check 'id', 'sessionId', and 'requestId')
    const urlParams = new URLSearchParams(window.location.search);
    const rawId = urlParams.get('id') || urlParams.get('sessionId') || urlParams.get('requestId');
    let sessionId = parseInt(rawId);

    let securityErrorMsg = null;

    // 3. Load Session from backend SQLite
    if (sessionId && !isNaN(sessionId)) {
        try {
            const response = await fetch(`/api/profile/session-details?id=${sessionId}`, {
                method: 'GET',
                headers: {
                    'X-User-Id': userSessionInfo.id
                }
            });
            const data = await response.json();
            if (response.status === 403 || data.isBlocked) {
                securityErrorMsg = data.message || "Access Denied: Payment verification required before entering the video call room.";
            } else if (response.ok && data.success && data.session) {
                currentSession = data.session;
            }
        } catch (err) {
            console.error("Error loading session details by ID:", err);
        }
    }

    if (securityErrorMsg) {
        const isTeacher = userSessionInfo.role && (userSessionInfo.role.toLowerCase() === 'teacher' || userSessionInfo.role.toLowerCase() === 'both');
        alert(`🔒 Call Access Blocked:\n\n${securityErrorMsg}`);
        window.location.href = isTeacher ? "teacher-dashboard.html" : "dashboard.html";
        return;
    }

    // Fallback 1: If session ID is missing or not found by ID, auto-fetch active/scheduled session for current user
    if (!currentSession) {
        try {
            const activeRes = await fetch('/api/profile/active-sessions', {
                method: 'GET',
                headers: {
                    'X-User-Id': userSessionInfo.id
                }
            });
            const activeData = await activeRes.json();
            if (activeRes.ok && activeData.success && activeData.sessions && activeData.sessions.length > 0) {
                currentSession = activeData.sessions[0];
                sessionId = currentSession.id || currentSession.requestId;
            }
        } catch (fallbackErr) {
            console.error("Error fetching fallback active sessions:", fallbackErr);
        }
    }

    // Fallback 2: Check localStorage
    if (!currentSession && sessionId) {
        const sessionsList = JSON.parse(localStorage.getItem("session_requests")) || [];
        currentSession = sessionsList.find(s => s.id == sessionId || s.requestId == sessionId);
    }

    if (!currentSession) {
        const isTeacher = userSessionInfo.role && (userSessionInfo.role.toLowerCase() === 'teacher' || userSessionInfo.role.toLowerCase() === 'both');
        alert("No active or confirmed session found. Payment verification required before entering the call room.");
        window.location.href = isTeacher ? "teacher-dashboard.html" : "dashboard.html";
        return;
    }

    // 4. Render Header metadata and panel rows
    setupSessionRoomDetails();

    // 5. Check Daily Video Call Limit before joining call
    const isBlocked = await checkAndFetchDailyLimitOnLoad();
    if (isBlocked) {
        console.warn("🚫 Daily video call limit reached (3 Hours Max). Blocking video call initialization.");
        return; // Do not initialize Jitsi/mock call or timer
    }

    // 6. Initialize Jitsi Meet Iframe Call & launch heartbeat + timer
    initJitsiCall(sessionId);
    startRoomTimer();
    startCallHeartbeat();
});

// Populate headers
function setupSessionRoomDetails() {
    const isOutgoing = currentSession.senderId === userSessionInfo.id;
    const partnerNameVal = isOutgoing ? currentSession.recipientName : currentSession.senderName;
    const partnerAvatarVal = isOutgoing ? currentSession.recipientAvatar : currentSession.senderAvatar;
    const skillNameVal = currentSession.skill;

    document.getElementById("partnerAvatar").src = partnerAvatarVal;
    document.getElementById("partnerName").textContent = partnerNameVal;
    document.getElementById("skillName").textContent = `Topic: ${skillNameVal}`;

    const userName = `${userSessionInfo.firstName} ${userSessionInfo.lastName}`;
    const learnerName = isOutgoing ? userName : partnerNameVal;
    const teacherName = isOutgoing ? partnerNameVal : userName;

    document.getElementById("learnerName").textContent = learnerName;
    document.getElementById("teacherName").textContent = teacherName;
}

let isSessionEnding = false;

// Instantiate Jitsi Meet iframe inside call pane
function initJitsiCall(sessionId) {
    if (typeof JitsiMeetExternalAPI === 'undefined') {
        console.warn("Jitsi Meet External API not found. Loading local mock call room instead.");
        loadMockVideoCall();
        return;
    }

    // Create unique room name string identical for both sender and recipient
    const sanitizedRoom = currentSession.roomId || `BarterLearn_Room_${sessionId}`;
    const domain = "meet.jit.si";

    const options = {
        roomName: sanitizedRoom,
        width: "100%",
        height: "100%",
        parentNode: document.querySelector('#meetContainer'),
        userInfo: {
            displayName: `${userSessionInfo.firstName} ${userSessionInfo.lastName}`
        },
        configOverwrite: {
            startWithAudioMuted: true,
            startWithVideoMuted: true,
            disableDeepLinking: true // prevents opening store apps on desktop/mobiles
        },
        interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'embedmeeting', 'fullscreen',
                'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
                'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
                'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone'
            ]
        }
    };

    // Remove spinner on iframe load trigger
    setTimeout(() => {
        document.getElementById("connectingState").style.display = "none";
    }, 1500);

    const api = new JitsiMeetExternalAPI(domain, options);
    jitsiApiInstance = api;

    // Detect Jitsi meeting end events
    api.addEventListener('readyToClose', () => {
        console.log("Session ended: Jitsi readyToClose event triggered.");
        handleSessionEnd(false);
    });

    api.addEventListener('videoConferenceLeft', () => {
        console.log("Session ended: Jitsi videoConferenceLeft event triggered.");
        handleSessionEnd(false);
    });
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

// Fetch daily limit on load
async function checkAndFetchDailyLimitOnLoad() {
    if (!userSessionInfo) return false;
    try {
        const response = await fetch('/api/profile/daily-call-usage', {
            headers: { 'X-User-Id': userSessionInfo.id }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            updateDailyLimitUI(data);
            if (data.limitReached) {
                triggerCallBlockOverlay(data);
                return true;
            }
        }
    } catch (err) {
        console.error("Error checking daily call limit on load:", err);
    }
    return false;
}

// Update pill & overlay progress bar
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
        } else if (data.secondsUsed >= 9000) { // 2.5 hours warning
            pillEl.className = "daily-usage-pill warning";
        } else {
            pillEl.className = "daily-usage-pill";
        }
    }

    // Update overlay text & progress bar if present
    const limitProgressText = document.getElementById("limitProgressText");
    const limitProgressBarFill = document.getElementById("limitProgressBarFill");
    if (limitProgressText && limitProgressBarFill) {
        const pct = Math.min(100, Math.round((data.secondsUsed / data.maxSeconds) * 100));
        limitProgressText.textContent = `${formattedUsed} / 3h 00m (${pct}%)`;
        limitProgressBarFill.style.width = `${pct}%`;
    }
}

// Launch 5-second call heartbeat interval
function startCallHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(async () => {
        if (!userSessionInfo) return;
        try {
            const response = await fetch('/api/profile/call-heartbeat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userSessionInfo.id
                },
                body: JSON.stringify({ seconds: 5 })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                updateDailyLimitUI(data);

                if (data.limitReached) {
                    console.warn("🚫 Heartbeat limit reached! Stopping call and showing overlay.");
                    triggerCallBlockOverlay(data);
                }
            }
        } catch (err) {
            console.error("Error logging call heartbeat:", err);
        }
    }, 5000);
}

// Show call limit blocked overlay and cleanup streams
function triggerCallBlockOverlay(data) {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    // Dispose Jitsi API if active
    if (jitsiApiInstance && typeof jitsiApiInstance.dispose === 'function') {
        try {
            jitsiApiInstance.dispose();
        } catch (e) {
            console.warn("Error disposing Jitsi instance:", e);
        }
    }

    // Stop mock video streams if active
    const localVideo = document.getElementById("localCamStream");
    if (localVideo && localVideo.srcObject) {
        try {
            localVideo.srcObject.getTracks().forEach(track => track.stop());
        } catch (e) {}
    }

    // Hide meet container & display limit overlay modal
    const meetContainer = document.getElementById("meetContainer");
    if (meetContainer) {
        meetContainer.innerHTML = `
            <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#0b0f19; color:#94a3b8;">
                <p>🚫 Call Session Blocked - Daily Time Limit Reached (3 Hours Max)</p>
            </div>
        `;
    }

    const overlay = document.getElementById("limitOverlayModal");
    if (overlay) {
        overlay.style.display = "flex";
    }

    if (data) {
        updateDailyLimitUI(data);
    }

    // Automatically redirect to premium.html after brief delay
    setTimeout(() => {
        if (confirm("⏳ Daily Video Call Limit Reached (3 Hours Max)!\n\nRedirecting you to the Premium Upgrade page now...")) {
            window.location.href = "premium.html";
        } else {
            window.location.href = "premium.html";
        }
    }, 1200);
}

// Modal functions
function openPremiumModal() {
    window.location.href = "premium.html";
}

function closePremiumModal() {
    const modal = document.getElementById("premiumModal");
    if (modal) modal.style.display = "none";
}

async function confirmPremiumUpgrade() {
    if (!userSessionInfo) return;
    try {
        const response = await fetch('/api/profile/upgrade-premium', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userSessionInfo.id
            }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            alert(data.message || "🎉 Successfully upgraded to BarterLearn Premium!");
            userSessionInfo.isPremium = true;
            localStorage.setItem("user", JSON.stringify(userSessionInfo));
            window.location.reload();
        } else {
            alert(data.message || "Error upgrading to premium.");
        }
    } catch (err) {
        console.error("Error performing premium upgrade:", err);
        alert("Failed to connect to backend server.");
    }
}

// Timer counting seconds
function startRoomTimer() {
    const timerDisplay = document.getElementById("sessionTimer");
    secondsElapsed = 0;

    sessionTimerInterval = setInterval(() => {
        secondsElapsed++;
        const minutes = Math.floor(secondsElapsed / 60);
        const seconds = secondsElapsed % 60;

        const formattedMin = minutes < 10 ? `0${minutes}` : minutes;
        const formattedSec = seconds < 10 ? `0${seconds}` : seconds;

        timerDisplay.textContent = `${formattedMin}:${formattedSec}`;
    }, 1000);
}

// Chat functions
function sendRoomMessage(e) {
    e.preventDefault();
    const input = document.getElementById("roomChatInput");
    const text = input.value.trim();
    if (!text) return;

    appendBubble("me", text);
    input.value = "";

    // Partner mock auto responses
    setTimeout(() => {
        const replies = [
            "Makes perfect sense, let's proceed.",
            "Could you explain this step once more?",
            "Yes, I see the auto layout frame now!",
            "Thank you for sharing your screen."
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        appendBubble("them", randomReply);
    }, 3000);
}

function appendBubble(sender, text) {
    const feed = document.getElementById("roomChatFeed");
    const bubble = document.createElement("div");
    bubble.className = `room-msg-bubble ${sender}`;
    bubble.textContent = text;
    feed.appendChild(bubble);
    feed.scrollTop = feed.scrollHeight;
}

// Back to sessions exit logic
function backToSessions() {
    if (confirm("Exit call room? The call will remain active in the background.")) {
        clearInterval(sessionTimerInterval);
        window.location.href = "my-sessions.html";
    }
}

// End Session and Save Database Time Credits
function confirmEndSession() {
    handleSessionEnd(true);
}

async function handleSessionEnd(isManualConfirm = false) {
    if (isSessionEnding) return;

    if (isManualConfirm) {
        if (!confirm("Are you sure you want to end this barter session? Time credits will be updated inside SQLite.")) {
            return;
        }
    }

    isSessionEnding = true;
    clearInterval(sessionTimerInterval);

    // Determine type:
    // If outgoing request -> You are Learner (sessionType = 'learn')
    // If incoming request -> You are Teacher (sessionType = 'teach')
    const isOutgoing = currentSession.senderId == userSessionInfo.id;
    const sessionType = isOutgoing ? "learn" : "teach";
    const partnerNameVal = isOutgoing ? currentSession.recipientName : currentSession.senderName;

    // Log 1: Session ended
    console.log("Session ended:", {
        sessionId: currentSession.id,
        type: sessionType,
        partner: partnerNameVal,
        skill: currentSession.skill
    });

    try {
        const response = await fetch('/api/profile/complete-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userSessionInfo.id
            },
            body: JSON.stringify({
                sessionId: currentSession.id,
                sessionType: sessionType,
                partnerName: partnerNameVal,
                skillName: currentSession.skill
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Log 2: Wallet updated
            console.log("Wallet updated:", { creditsEarned: data.creditsEarned });
            // Log 3: Transaction created
            console.log("Transaction created: SQLite database updated with session credit transfer.");

            // Update local storage session list item state to completed
            const sessionsList = JSON.parse(localStorage.getItem("session_requests")) || [];
            const index = sessionsList.findIndex(s => s.id == currentSession.id);
            if (index !== -1) {
                sessionsList[index].status = "completed";
                localStorage.setItem("session_requests", JSON.stringify(sessionsList));
            }

            // Sync local user storage if returned
            if (userSessionInfo && data.creditsEarned !== undefined) {
                userSessionInfo.creditsEarned = data.creditsEarned;
                localStorage.setItem("user", JSON.stringify(userSessionInfo));
            }

            const creditText = sessionType === "teach" ? "+1 Time Credit awarded!" : "-1 Time Credit deducted.";
            if (isManualConfirm || !data.alreadyCompleted) {
                alert(`Session ended successfully!\n\nDatabase result: ${creditText}\nNew balance: ${data.creditsEarned} Credits.\n\nNow redirecting to review your barter partner...`);
            }
            window.location.href = "reviews.html";
        } else {
            alert(data.message || "Error updating session credits on backend.");
            window.location.href = "my-sessions.html";
        }
    } catch (error) {
        console.error("End Session transaction error:", error);
        alert("Failed to reach server. Session progress saved locally. Redirecting to reviews...");
        window.location.href = "reviews.html";
    }
}

// Fallback Mock Call
function loadMockVideoCall() {
    // Hide spinner
    document.getElementById("connectingState").style.display = "none";

    const isOutgoing = currentSession.senderId === userSessionInfo.id;
    const partnerNameVal = isOutgoing ? currentSession.recipientName : currentSession.senderName;
    const partnerAvatarVal = isOutgoing ? currentSession.recipientAvatar : currentSession.senderAvatar;

    const meetContainer = document.querySelector('#meetContainer');
    meetContainer.innerHTML = `
        <div class="mock-video-grid">
            <!-- Remote User Feed -->
            <div class="video-feed-box partner">
                <img src="${partnerAvatarVal}" alt="${partnerNameVal}" class="feed-avatar">
                <div class="feed-name-tag">${partnerNameVal}</div>
                <div class="feed-status-tag">Connected</div>
                <div class="audio-wave-bars">
                    <span class="bar"></span>
                    <span class="bar"></span>
                    <span class="bar"></span>
                </div>
            </div>
            <!-- Local User Feed -->
            <div class="video-feed-box local">
                <div class="feed-avatar-placeholder">${(userSessionInfo.firstName.charAt(0) + userSessionInfo.lastName.charAt(0)).toUpperCase()}</div>
                <div class="feed-name-tag">You</div>
                <div class="feed-status-tag" id="localCameraStatus">Camera On</div>
                <video id="localCamStream" autoplay playsinline style="width:100%; height:100%; object-fit:cover; display:none; border-radius:var(--radius-sm);"></video>
            </div>
        </div>
    `;

    // Add webcam stream if permission is granted
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            const videoEl = document.getElementById("localCamStream");
            if (videoEl) {
                videoEl.srcObject = stream;
                videoEl.style.display = "block";
                const placeholder = document.querySelector('.video-feed-box.local .feed-avatar-placeholder');
                if (placeholder) placeholder.style.display = "none";
            }
        })
        .catch(err => {
            console.log("Webcam not loaded or permission denied:", err.message);
            const statusTag = document.getElementById("localCameraStatus");
            if (statusTag) statusTag.textContent = "Camera Off";
        });
}
