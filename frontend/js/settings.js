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
    // 1. Sync User Header info
    try {
        currentUser = JSON.parse(localStorage.getItem('user'));
    } catch (err) {
        currentUser = null;
    }
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    renderRoleBasedNavigation('settings');

    if (currentUser) {
        document.getElementById('headerUserName').textContent = currentUser.firstName;
        if (document.getElementById('headerUserRole')) {
            const r = (currentUser.role || '').toLowerCase();
            document.getElementById('headerUserRole').innerHTML = r === 'teacher' ? '<span class="role-teacher-tag">Teacher 🎓</span>' : (currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1));
        }
        renderUserHeaderAvatar(currentUser);
        
        // 2. Fetch profile data from db
        fetchSettingsDetails(currentUser.id);
    }

    // 3. Load Dark mode preference
    initDarkMode();
});

// Render Dynamic Role-Based Sidebar Navigation
function renderRoleBasedNavigation(activePage) {
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

// Fetch active user records from SQLite
async function fetchSettingsDetails(userId) {
    try {
        const response = await fetch('/api/profile', {
            method: 'GET',
            headers: {
                'X-User-Id': userId
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            const p = data.profile;
            // Sync avatar in session
            if (p.avatar) {
                currentUser.avatar = p.avatar;
                localStorage.setItem('user', JSON.stringify(currentUser));
                renderUserHeaderAvatar(currentUser);
            }

            // Sync theme in session and UI toggle
            if (p.theme) {
                const isDark = p.theme === 'dark';
                currentUser.theme = p.theme;
                localStorage.setItem('user', JSON.stringify(currentUser));
                localStorage.setItem('dark_theme', isDark ? 'true' : 'false');
                document.body.classList.toggle('dark-theme', isDark);
                document.documentElement.classList.toggle('dark-theme', isDark);
                const toggle = document.getElementById('darkModeCheck');
                if (toggle) toggle.checked = isDark;
            }

            // Populate account fields
            document.getElementById('firstNameInput').value = p.firstName;
            document.getElementById('lastNameInput').value = p.lastName;
            document.getElementById('usernameInput').value = p.username;
            document.getElementById('emailInput').value = p.email;
            document.getElementById('roleSelect').value = p.role;
        }
    } catch (error) {
        console.error('Fetch settings details error:', error);
    }
}

// Tab Switching
function switchSettingsTab(e, tabId) {
    e.preventDefault();
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    e.currentTarget.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

// Dark Mode Toggle Logic
function initDarkMode() {
    const toggle = document.getElementById("darkModeCheck");
    if (!toggle) return;

    const isDark = localStorage.getItem("dark_theme") === "true" || (currentUser && currentUser.theme === "dark");
    toggle.checked = isDark;
    
    if (isDark) {
        document.body.classList.add("dark-theme");
        document.documentElement.classList.add("dark-theme");
    } else {
        document.body.classList.remove("dark-theme");
        document.documentElement.classList.remove("dark-theme");
    }

    toggle.addEventListener("change", async () => {
        const enableDark = toggle.checked;
        if (enableDark) {
            document.body.classList.add("dark-theme");
            document.documentElement.classList.add("dark-theme");
            localStorage.setItem("dark_theme", "true");
        } else {
            document.body.classList.remove("dark-theme");
            document.documentElement.classList.remove("dark-theme");
            localStorage.setItem("dark_theme", "false");
        }

        if (currentUser) {
            currentUser.theme = enableDark ? "dark" : "light";
            localStorage.setItem("user", JSON.stringify(currentUser));

            try {
                await fetch('/api/profile/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': currentUser.id
                    },
                    body: JSON.stringify({
                        theme: currentUser.theme
                    })
                });
            } catch (err) {
                console.error("Error saving theme preference to backend:", err);
            }
        }
    });
}

// Save Settings Form
async function saveSettings(e) {
    e.preventDefault();

    const firstName = document.getElementById("firstNameInput").value.trim();
    const lastName = document.getElementById("lastNameInput").value.trim();
    const role = document.getElementById("roleSelect").value;

    const currentPass = document.getElementById("currentPasswordInput").value;
    const newPass = document.getElementById("newPasswordInput").value;
    const confirmNewPass = document.getElementById("confirmNewPasswordInput").value;

    // 1. Password change validation
    if (newPass || currentPass || confirmNewPass) {
        if (!currentPass) {
            alert("Current password is required to change password.");
            return;
        }
        if (newPass !== confirmNewPass) {
            alert("New passwords do not match.");
            return;
        }
        if (newPass.length < 6) {
            alert("New password must be at least 6 characters.");
            return;
        }
    }

    // 2. Submit account detail changes to SQLite
    try {
        const response = await fetch('/api/profile/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser.id
            },
            body: JSON.stringify({
                firstName,
                lastName,
                role,
                currentPassword: currentPass || undefined,
                newPassword: newPass || undefined
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Update session data
            currentUser.firstName = firstName;
            currentUser.lastName = lastName;
            currentUser.role = role;
            localStorage.setItem('user', JSON.stringify(currentUser));

            // Sync Header
            document.getElementById('headerUserName').textContent = firstName;
            document.getElementById('headerUserRole').textContent = role.charAt(0).toUpperCase() + role.slice(1);
            document.getElementById('headerUserAvatar').textContent = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();

            // Clear password fields
            document.getElementById("currentPasswordInput").value = "";
            document.getElementById("newPasswordInput").value = "";
            document.getElementById("confirmNewPasswordInput").value = "";

            alert("Settings saved successfully!");
        } else {
            alert(data.message || "Error saving account details.");
        }

    } catch (error) {
        console.error("Save settings error:", error);
        alert("Could not connect to the server. Please check your connection.");
    }
}

// Perform Logout
function performLogout() {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.removeItem("user");
        alert("Logged out successfully! Redirecting to login page...");
        window.location.href = "login.html";
    }
}
