// Initialize Dark Mode theme from localStorage
(function() {
    if (localStorage.getItem("dark_theme") === "true") {
        document.body.classList.add("dark-theme");
    }
})();

// Mock Inbox Conversations Data
const inboxThreads = [
    {
        id: 401,
        name: "Sarah Jenkins",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80",
        online: true,
        unread: 2,
        messages: [
            { sender: "them", text: "Hey! Are we still on for our Figma layout secrets session?" },
            { sender: "me", text: "Yes, absolutely! I've prepared a landing page mockup to work on." },
            { sender: "them", text: "Fantastic! I will show you how to build responsive auto layouts and nested grids." }
        ],
        sessionReminder: {
            skill: "Figma Layout Secrets",
            date: "Friday, July 23",
            time: "16:00 - 17:00"
        }
    },
    {
        id: 402,
        name: "Mateo Silva",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80",
        online: false,
        unread: 0,
        messages: [
            { sender: "me", text: "Hey Mateo, did you see my session request for Python database schemas?" },
            { sender: "them", text: "Hi! Yes, I just saw it. I'd love to swap. I'm free on Saturday." },
            { sender: "me", text: "Perfect, Saturday morning works for me!" }
        ]
    },
    {
        id: 403,
        name: "Emily Chen",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&h=120&q=80",
        online: true,
        unread: 0,
        messages: [
            { sender: "them", text: "Nǐ hǎo! Thanks for scheduling the Mandarin conversational practice." },
            { sender: "me", text: "Nǐ hǎo Emily! Looking forward to learning basic greeting structures." }
        ],
        sessionReminder: {
            skill: "Conversational Mandarin",
            date: "Sunday, July 25",
            time: "09:00 - 10:00"
        }
    },
    {
        id: 404,
        name: "Jessica Taylor",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80",
        online: true,
        unread: 4,
        messages: [
            { sender: "them", text: "Hello! I saw you are teaching UI/UX design." },
            { sender: "them", text: "I'd love to review my app portfolio. Let me know if you have time credits available." }
        ]
    }
];

let activeThreadId = null;

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
            <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}">
                <span class="nav-icon">👤</span>
                <span>Teacher Profile</span>
            </a>
            <a href="settings.html" class="nav-item ${activePage === 'settings' ? 'active' : ''}">
                <span class="nav-icon">⚙️</span>
                <span>Settings</span>
            </a>
        `;
    } else if (role === 'admin') {
        if (logoSub) logoSub.textContent = 'Admin Portal';
        navContainer.innerHTML = `
            <a href="admin-teacher-applications.html" class="nav-item ${activePage === 'admin' ? 'active' : ''}">
                <span class="nav-icon">🎓</span>
                <span>Admin Portal</span>
            </a>
            <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}">
                <span class="nav-icon">👤</span>
                <span>Admin Profile</span>
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

document.addEventListener("DOMContentLoaded", () => {
    // 1. Sync User Header info
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    renderRoleBasedNavigation('messages', user);

    if (user) {
        document.getElementById('headerUserName').textContent = user.firstName;
        if (document.getElementById('headerUserRole')) {
            const r = (user.role || '').toLowerCase();
            document.getElementById('headerUserRole').innerHTML = r === 'teacher' ? '<span class="role-teacher-tag">Teacher 🎓</span>' : (user.role.charAt(0).toUpperCase() + user.role.slice(1));
        }
        renderUserHeaderAvatar(user);
    }

    // 2. Render Left sidebar inbox list
    renderInbox();
});

// Render user inbox list
function renderInbox() {
    const list = document.getElementById("usersList");
    list.innerHTML = "";

    inboxThreads.forEach(thread => {
        const card = document.createElement("div");
        card.className = `inbox-user-card ${thread.id === activeThreadId ? 'active' : ''}`;
        card.onclick = () => openConversation(thread.id);

        const onlineDot = thread.online ? `<div class="online-dot"></div>` : "";
        const unreadBadge = thread.unread > 0 ? `<div class="unread-msg-badge">${thread.unread}</div>` : "";
        const lastMsg = thread.messages.length > 0 ? thread.messages[thread.messages.length - 1].text : "No messages yet";

        card.innerHTML = `
            <div class="avatar-container">
                <img src="${thread.avatar}" alt="${thread.name}">
                ${onlineDot}
            </div>
            <div class="card-details-text">
                <h4>${thread.name}</h4>
                <p>${lastMsg}</p>
            </div>
            ${unreadBadge}
        `;

        list.appendChild(card);
    });
}

// Open active thread chat window
function openConversation(threadId) {
    activeThreadId = threadId;
    const thread = inboxThreads.find(t => t.id === threadId);
    if (!thread) return;

    // Clear unread badge
    thread.unread = 0;
    renderInbox();

    // Setup Active Header
    const avatarImg = document.getElementById("chatHeaderAvatar");
    avatarImg.src = thread.avatar;
    avatarImg.style.display = "block";

    document.getElementById("chatHeaderName").textContent = thread.name;
    const statusSpan = document.getElementById("chatHeaderStatus");
    statusSpan.textContent = thread.online ? "● Online" : "Offline";
    statusSpan.className = thread.online ? "user-status-text" : "user-status-text offline";

    // Show Chat input form
    document.getElementById("chatForm").style.display = "flex";

    // Render Messages feed
    renderMessages(thread);
}

// Render Messages thread list
function renderMessages(thread) {
    const feed = document.getElementById("chatMessagesFeed");
    feed.innerHTML = "";

    // Load reminder cards
    if (thread.sessionReminder) {
        const rem = thread.sessionReminder;
        const reminder = document.createElement("div");
        reminder.className = "message-reminder-card";
        reminder.innerHTML = `
            <div class="reminder-header">🔔 Scheduled Barter Call</div>
            <div class="reminder-body">
                <h4>${rem.skill}</h4>
                <p>Private session room with ${thread.name}</p>
                <div class="reminder-time">📅 ${rem.date} &nbsp;|&nbsp; 🕒 ${rem.time}</div>
            </div>
        `;
        feed.appendChild(reminder);
    }

    // Load bubbles
    thread.messages.forEach(msg => {
        const bubble = document.createElement("div");
        bubble.className = `message-bubble ${msg.sender === 'me' ? 'outgoing' : 'incoming'}`;
        bubble.textContent = msg.text;
        feed.appendChild(bubble);
    });

    // Scroll to bottom
    setTimeout(() => {
        feed.scrollTop = feed.scrollHeight;
    }, 50);
}

// Send Message handler
function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById("chatInput");
    const val = input.value.trim();
    if (!val || activeThreadId === null) return;

    const thread = inboxThreads.find(t => t.id === activeThreadId);
    if (!thread) return;

    // Append outgoing bubble
    thread.messages.push({ sender: "me", text: val });
    input.value = "";

    // Rerender chat window and list
    renderMessages(thread);
    renderInbox();

    // Emulate Automated chatbot reply after 1.5 seconds
    setTimeout(() => {
        if (activeThreadId === thread.id) {
            thread.messages.push({
                sender: "them",
                text: "Got it! Thanks for the update. Let's touch base soon!"
            });
            renderMessages(thread);
            renderInbox();
        }
    }, 1500);
}
