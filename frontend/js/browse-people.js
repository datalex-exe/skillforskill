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

let selectedCategory = "all";
let activeProfilesList = [];
let savedRequests = [];

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

document.addEventListener("DOMContentLoaded", () => {
    // 0. Check Database instance status
    checkDbStatus();

    // 1. Sync User Header info & Role Navigation
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    const userRole = (user.role || '').toLowerCase();
    if (userRole === 'admin') {
        window.location.href = 'admin-teacher-applications.html';
        return;
    }

    renderRoleBasedNavigation('browse', user);

    if (user) {
        document.getElementById('headerUserName').textContent = user.firstName;
        if (document.getElementById('headerUserRole')) {
            document.getElementById('headerUserRole').innerHTML = userRole === 'teacher' ? '<span class="role-teacher-tag">Teacher 🎓</span>' : (user.role.charAt(0).toUpperCase() + user.role.slice(1));
        }
        renderUserHeaderAvatar(user);
    }

    // 2. Fetch and render initial list from database (checking for URL search query)
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search') || "";
    const searchInput = document.getElementById("searchInput");
    if (searchInput && searchParam) {
        searchInput.value = searchParam;
    }
    fetchProfiles(searchParam);
});

// Render Dynamic Role-Based Sidebar Navigation
function renderRoleBasedNavigation(activePage, currentUser) {
    const navContainer = document.querySelector('.sidebar-nav');
    if (!navContainer || !currentUser) return;

    const role = (currentUser.role || '').toLowerCase();
    const logoSub = document.querySelector('.logo-text span');

    if (role === 'teacher') {
        if (logoSub) logoSub.textContent = 'Teacher Portal';
        navContainer.innerHTML = `
            <a href="teacher-dashboard.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
                <span class="nav-icon">🏠</span>
                <span>Dashboard</span>
            </a>
            <a href="teacher-dashboard.html#requestsSec" class="nav-item ${activePage === 'requests' ? 'active' : ''}">
                <span class="nav-icon">📅</span>
                <span>Session Requests</span>
            </a>
            <a href="teacher-dashboard.html#upcomingSec" class="nav-item ${activePage === 'upcoming' ? 'active' : ''}">
                <span class="nav-icon">📖</span>
                <span>Upcoming Sessions</span>
            </a>
            <a href="teacher-dashboard.html#earningsSec" class="nav-item ${activePage === 'earnings' ? 'active' : ''}">
                <span class="nav-icon">💰</span>
                <span>Earnings</span>
            </a>
            <a href="withdraw-earnings.html" class="nav-item ${activePage === 'withdraw' ? 'active' : ''}">
                <span class="nav-icon">💸</span>
                <span>Withdraw Earnings</span>
            </a>
            <a href="teacher-dashboard.html#paymentsSec" class="nav-item ${activePage === 'payments' ? 'active' : ''}">
                <span class="nav-icon">📜</span>
                <span>Payment History</span>
            </a>
            <a href="browse-people.html" class="nav-item ${activePage === 'browse' ? 'active' : ''}">
                <span class="nav-icon">👥</span>
                <span>Browse People</span>
            </a>
            <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}">
                <span class="nav-icon">👤</span>
                <span>Teacher Profile</span>
            </a>
            <a href="settings.html" class="nav-item ${activePage === 'settings' ? 'active' : ''}">
                <span class="nav-icon">⚙️</span>
                <span>Settings</span>
            </a>
        `;
    } else {
        if (logoSub) logoSub.textContent = 'Skill for Skill, Grow Together';
        navContainer.innerHTML = `
            <a href="dashboard.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
                <span class="nav-icon">🏠</span>
                <span>Dashboard</span>
            </a>
            <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}">
                <span class="nav-icon">👤</span>
                <span>My Profile</span>
            </a>
            <a href="browse-people.html" class="nav-item ${activePage === 'browse' ? 'active' : ''}">
                <span class="nav-icon">👥</span>
                <span>Browse People</span>
            </a>
            <a href="session-request.html" class="nav-item ${activePage === 'requests' ? 'active' : ''}">
                <span class="nav-icon">📅</span>
                <span>Session Requests</span>
            </a>
            <a href="my-sessions.html" class="nav-item ${activePage === 'sessions' ? 'active' : ''}">
                <span class="nav-icon">📖</span>
                <span>My Sessions</span>
            </a>
            <a href="credits.html" class="nav-item ${activePage === 'credits' ? 'active' : ''}">
                <span class="nav-icon">💰</span>
                <span>Time Wallet</span>
            </a>
            <a href="messages.html" class="nav-item ${activePage === 'messages' ? 'active' : ''}">
                <span class="nav-icon">✉️</span>
                <span>Messages</span>
            </a>
            <a href="reviews.html" class="nav-item ${activePage === 'reviews' ? 'active' : ''}">
                <span class="nav-icon">⭐</span>
                <span>Reviews</span>
            </a>
            <a href="premium.html" class="nav-item ${activePage === 'premium' ? 'active' : ''}">
                <span class="nav-icon">💎</span>
                <span>Upgrade Premium</span>
            </a>
            <a href="settings.html" class="nav-item ${activePage === 'settings' ? 'active' : ''}">
                <span class="nav-icon">⚙️</span>
                <span>Settings</span>
            </a>
        `;
    }
}

// Fetch profiles list from SQLite database
async function fetchProfiles(searchQuery = "") {
    const user = JSON.parse(localStorage.getItem('user'));
    const userId = user ? user.id : 0;

    try {
        const reqsResponse = await fetch('/api/profile/session-requests', {
            method: 'GET',
            headers: {
                'X-User-Id': userId
            }
        });
        const reqsData = await reqsResponse.json();
        if (reqsResponse.ok && reqsData.success) {
            savedRequests = reqsData.requests;
        }
    } catch (err) {
        console.warn("Could not fetch session requests from backend:", err);
        savedRequests = [];
    }

    try {
        const response = await fetch(`/api/profile/search?query=${encodeURIComponent(searchQuery)}`, {
            method: 'GET',
            headers: {
                'X-User-Id': userId
            }
        });
        
        const data = await response.json();
        if (response.ok && data.success && data.profiles) {
            activeProfilesList = data.profiles;
        } else {
            activeProfilesList = [];
        }
    } catch (e) {
        console.error("Error fetching profiles:", e);
        activeProfilesList = [];
    }

    renderPeople();
}

// Category filtering selection
function selectCategory(e, category) {
    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(c => c.classList.remove('active'));
    e.currentTarget.classList.add('active');

    selectedCategory = category;
    renderPeople();
}

// Button search click trigger
function executeSearch() {
    const input = document.getElementById("searchInput");
    const query = input ? input.value.trim() : "";

    if (!query) {
        alert("Please enter a skill to search.");
        return;
    }

    fetchProfiles(query);
}

// Capture enter key on input
function handleSearchKey(event) {
    if (event.key === "Enter") {
        executeSearch();
    }
}

// Render cards
function renderPeople() {
    const grid = document.getElementById("peopleGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const currentUser = JSON.parse(localStorage.getItem('user'));
    const currentUserId = currentUser ? currentUser.id : null;
    const currentUserRole = currentUser && currentUser.role ? currentUser.role.toLowerCase() : '';

    // Apply category & role filters (excluding current logged-in user)
    const filtered = activeProfilesList.filter(person => {
        // Exclude currently logged in user
        if (currentUserId && person.id == currentUserId) {
            return false;
        }

        // Role-based filtering logic
        const targetRole = (person.role || '').toLowerCase();
        if (currentUserRole === 'teacher') {
            // Teacher viewing: show Students, Learners, Both, and other Teachers
            if (targetRole === 'admin') return false;
        } else {
            // Student viewing: show Teachers, Students, Learners, Both
            if (targetRole === 'admin') return false;
        }

        // Category filter
        if (selectedCategory === "all") return true;

        const catMap = {
            "Technology": ["javascript", "python", "react", "nodejs", "web", "sqlite", "postgresql", "programming", "code", "html", "css"],
            "Design": ["design", "figma", "wireframing", "ui", "ux", "web design", "layout"],
            "Languages": ["mandarin", "chinese", "conversational", "french", "spanish", "languages"],
            "Music": ["guitar", "music", "acoustic", "piano", "flute", "guitarist"],
            "Business": ["marketing", "seo", "copywriting", "ads", "digital marketing", "business"]
        };

        const targetSkills = (person.skillsTeach || []).map(s => s.toLowerCase());
        const mappedKeywords = catMap[selectedCategory] || [];
        
        return targetSkills.some(s => mappedKeywords.some(kw => s.includes(kw)));
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-light); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius)">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
                <h3>No users found matching your search.</h3>
                <p style="font-size: 0.85rem; margin-top: 0.2rem;">Try typing another skill or category query.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(person => {
        const card = document.createElement("div");
        card.className = "person-card";

        // Best Match Ribbon
        const ribbon = person.bestMatch ? `<div class="best-match-badge">Best Match</div>` : "";

        // Check if request was already sent to this person from current user
        const isSent = savedRequests.some(r => r.senderId == currentUserId && r.recipientId == person.id && r.status === 'pending');
        const btnText = isSent ? "Request Sent" : "Send Session Request";
        const btnClass = isSent ? "btn-request sent" : "btn-request";
        const btnDisabled = isSent ? "disabled" : "";

        const avatarHtml = (person.avatar && person.avatar.trim() !== '')
            ? `<img src="${person.avatar}" alt="${person.firstName}" class="card-avatar">`
            : `<div class="card-avatar" style="display:flex; align-items:center; justify-content:center; background:#ECE9FC; color:#5B21B6; font-weight:800; font-size:1.1rem; border-radius:50%; width:54px; height:54px;">${(person.firstName.charAt(0) + (person.lastName ? person.lastName.charAt(0) : '')).toUpperCase()}</div>`;

        const isTeacher = person.role && (person.role.toLowerCase() === 'teacher' || person.role.toLowerCase() === 'both');
        const hourlyFee = person.hourlyFee || 1;
        const rating = person.rating || 4.9;

        let paidBtnHtml = '';
        if (isTeacher) {
            const firstTeachSkill = (person.skillsTeach && person.skillsTeach.length > 0) ? person.skillsTeach[0] : 'Skill Barter';
            paidBtnHtml = `
                <button class="btn-paid-request" style="flex:1;" onclick="sendPaidRequest('${person.id}', '${person.firstName} ${person.lastName}', '${firstTeachSkill}', '${person.avatar}', ${hourlyFee})">
                    <span>Book Paid Session 💳</span>
                </button>
            `;
        }

        const teachSkillsHtml = (person.skillsTeach && person.skillsTeach.length > 0) 
            ? person.skillsTeach.map(s => `<span class="mini-tag teach">${s}</span>`).join("")
            : `<span style="font-size:0.8rem; color:#94A3B8;">General Skills</span>`;

        const learnSkillsHtml = (person.skillsLearn && person.skillsLearn.length > 0)
            ? person.skillsLearn.map(s => `<span class="mini-tag learn">${s}</span>`).join("")
            : `<span style="font-size:0.8rem; color:#94A3B8;">Exploring New Topics</span>`;

        const firstSkill = (person.skillsTeach && person.skillsTeach.length > 0) ? person.skillsTeach[0] : 'Skill Barter';

        card.innerHTML = `
            ${ribbon}
            <div class="card-profile-header">
                ${avatarHtml}
                <div class="profile-title-area">
                    <h3>${person.firstName} ${person.lastName}</h3>
                    <div class="username-tag">@${person.username}</div>
                    <div class="rating-bar">
                        <span class="star-icon">⭐</span>
                        <span>${rating}</span>
                    </div>
                </div>
            </div>
            <div class="card-bio">${person.bio || 'No bio provided.'}</div>
            
            <div class="skills-group">
                <h4>Teaches</h4>
                <div class="tags-wrap">
                    ${teachSkillsHtml}
                </div>
            </div>
            
            <div class="skills-group">
                <h4>Wants to Learn</h4>
                <div class="tags-wrap">
                    ${learnSkillsHtml}
                </div>
            </div>

            <div class="card-footer" style="flex-direction:column; gap:0.6rem; align-items:stretch;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="cost-rate">
                        <span>${hourlyFee}</span> Credit(s)/hr
                    </div>
                    ${isTeacher ? `<span class="teacher-badge-tag">🎓 Teacher</span>` : ''}
                </div>
                <div style="display:flex; gap:0.5rem; width:100%;">
                    <button class="${btnClass}" style="flex:1;" ${btnDisabled} onclick="sendRequest('${person.id}', '${person.firstName} ${person.lastName}', '${firstSkill}', '${person.avatar}')">
                        ${btnText}
                    </button>
                    ${paidBtnHtml}
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// Send request action
function sendRequest(personId, fullName, skill, avatar) {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;

    // Check duplicate first
    if (savedRequests.some(r => r.senderId == currentUser.id && r.recipientId == personId && r.status === 'pending')) {
        alert("A pending request was already sent to this user.");
        return;
    }

    openBookingModal(personId, fullName, skill, avatar);
}

// Booking Modal control
function openBookingModal(personId, fullName, skill, avatar) {
    document.getElementById("modalPersonId").value = personId;
    document.getElementById("modalPartnerFullName").value = fullName;
    document.getElementById("modalPartnerSkill").value = skill;
    document.getElementById("modalPartnerAvatarUrl").value = avatar;

    document.getElementById("modalPartnerAvatar").src = avatar;
    document.getElementById("modalPartnerAvatar").alt = fullName;
    document.getElementById("modalPartnerName").textContent = fullName;
    document.getElementById("modalSessionSkillLabel").innerHTML = `Teaches <span>${skill}</span>`;

    // Default values: 2 days from now
    const defaultDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.getElementById("bookingDateInput").value = defaultDate;
    document.getElementById("bookingStartTimeInput").value = "14:00";
    document.getElementById("bookingEndTimeInput").value = "15:00";

    document.getElementById("bookingModal").classList.add("active");
}

function closeBookingModal() {
    document.getElementById("bookingModal").classList.remove("active");
    document.getElementById("bookingForm").reset();
    
    // Restore button state
    const submitBtn = document.querySelector('#bookingForm .btn-modal-confirm');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Request";
    }
}

function confirmBooking(event) {
    event.preventDefault();

    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        alert("You must be logged in to book a session.");
        return;
    }

    const personId = parseInt(document.getElementById("modalPersonId").value, 10);
    const fullName = document.getElementById("modalPartnerFullName").value;
    const skill = document.getElementById("modalPartnerSkill").value;
    const avatar = document.getElementById("modalPartnerAvatarUrl").value;

    const selectedDate = document.getElementById("bookingDateInput").value;
    const startTime = document.getElementById("bookingStartTimeInput").value;
    const endTime = document.getElementById("bookingEndTimeInput").value;

    if (!selectedDate || !startTime || !endTime) {
        alert("Please fill in all booking fields.");
        return;
    }

    const formattedTimeRange = `${startTime} - ${endTime}`;

    // Prevent double submission from concurrent clicks or race conditions
    if (savedRequests.some(r => r.senderId == currentUser.id && r.recipientId == personId && r.status === 'pending')) {
        alert("A pending request was already sent to this user.");
        closeBookingModal();
        return;
    }

    // Disable the submit button
    const submitBtn = event.target.querySelector('.btn-modal-confirm');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
    }

    // Send request to backend
    fetch('/api/profile/session-requests', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': currentUser.id
        },
        body: JSON.stringify({
            recipientId: personId,
            recipientName: fullName,
            recipientAvatar: avatar,
            skill: skill,
            date: selectedDate,
            time: formattedTimeRange
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`Session Request sent to ${fullName} for learning ${skill} on ${selectedDate} at ${formattedTimeRange}!`);
            closeBookingModal();
            fetchProfiles(""); // Re-fetch to update button state
        } else {
            alert(data.message || "Failed to send session request.");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Send Request";
            }
        }
    })
    .catch(err => {
        console.error("Error sending session request:", err);
        alert("Failed to connect to the server.");
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Send Request";
        }
    });
}

// ========== PAID SESSION BOOKING HANDLERS ==========
function sendPaidRequest(personId, fullName, skill, avatar, feeAmount) {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        alert("You must be logged in to book a session.");
        return;
    }
    openPaidBookingModal(personId, fullName, skill, avatar, feeAmount);
}

function openPaidBookingModal(personId, fullName, skill, avatar, feeAmount) {
    document.getElementById("paidModalTeacherId").value = personId;
    document.getElementById("paidModalTeacherFullName").value = fullName;
    document.getElementById("paidModalSkill").value = skill;
    document.getElementById("paidModalAvatarUrl").value = avatar;
    document.getElementById("paidModalFeeAmount").value = feeAmount;

    document.getElementById("paidModalAvatar").src = avatar;
    document.getElementById("paidModalAvatar").alt = fullName;
    document.getElementById("paidModalTeacherName").textContent = fullName;
    document.getElementById("paidModalSkillLabel").innerHTML = `Teaches <span>${skill}</span>`;
    document.getElementById("paidModalFeeDisplay").textContent = `${feeAmount} Credit(s) / hour`;

    // Default date 2 days from now
    const defaultDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.getElementById("paidBookingDateInput").value = defaultDate;
    document.getElementById("paidBookingStartTimeInput").value = "14:00";
    document.getElementById("paidBookingEndTimeInput").value = "15:00";

    document.getElementById("paidBookingModal").classList.add("active");
}

function closePaidBookingModal() {
    document.getElementById("paidBookingModal").classList.remove("active");
    document.getElementById("paidBookingForm").reset();
    
    const submitBtn = document.querySelector('#paidBookingForm .btn-paid-confirm');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Send Request 📩</span>`;
    }
}

function confirmPaidBooking(event) {
    event.preventDefault();

    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        alert("You must be logged in to book a paid session.");
        return;
    }

    const teacherId = parseInt(document.getElementById("paidModalTeacherId").value, 10);
    const teacherName = document.getElementById("paidModalTeacherFullName").value;
    const skill = document.getElementById("paidModalSkill").value;
    const feeAmount = parseFloat(document.getElementById("paidModalFeeAmount").value);

    const selectedDate = document.getElementById("paidBookingDateInput").value;
    const startTime = document.getElementById("paidBookingStartTimeInput").value;
    const endTime = document.getElementById("paidBookingEndTimeInput").value;
    const messageInput = document.getElementById("paidBookingMessageInput");
    const message = messageInput ? messageInput.value.trim() : "";

    if (!selectedDate || !startTime || !endTime) {
        alert("Please fill in all booking date and time fields.");
        return;
    }

    const formattedTimeRange = `${startTime} - ${endTime}`;

    const submitBtn = event.target.querySelector('.btn-paid-confirm');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>⏳ Sending Request...</span>`;
    }

    fetch('/api/profile/book-paid-session', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': currentUser.id
        },
        body: JSON.stringify({
            teacherId,
            teacherName,
            skill,
            date: selectedDate,
            startTime,
            endTime,
            time: formattedTimeRange,
            feeAmount,
            message
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`Paid Session Request sent successfully to ${teacherName}!\n\nDate: ${selectedDate}\nTime: ${formattedTimeRange}\nFee Rate: ${feeAmount} Credit(s)/hr\n\nThe teacher will review your request. Once accepted, you will be notified to complete payment.`);
            closePaidBookingModal();
            fetchProfiles("");
        } else {
            alert(data.message || "Failed to send paid session request.");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>Send Request 📩</span>`;
            }
        }
    })
    .catch(err => {
        console.error("Error sending paid session request:", err);
        alert("Failed to connect to the server.");
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Send Request 📩</span>`;
        }
    });
}
