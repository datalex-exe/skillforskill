// Initialize Dark Mode theme from localStorage
(function() {
    if (localStorage.getItem("dark_theme") === "true") {
        document.body.classList.add("dark-theme");
    }
})();

// Active user session data
let currentUser = null;
let skillsTeachList = [];
let skillsLearnList = [];
let avatarBase64 = '';

const defaultAvatarSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%2394A3B8' style='background:%23F1F5F9;'><circle cx='50' cy='38' r='22'/><path d='M50 66c-20 0-36 12-36 24v5h72v-5c0-12-16-24-36-24z'/></svg>";

document.addEventListener('DOMContentLoaded', () => {
    // 1. Resolve active user session or redirect
    try {
        currentUser = JSON.parse(localStorage.getItem('user'));
    } catch (err) {
        currentUser = null;
    }
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Render Role-Based Navigation
    renderRoleBasedNavigation('profile');

    // Synchronously sync initial session details to avoid flashing dummy data
    if (document.getElementById('headerUserName')) document.getElementById('headerUserName').textContent = currentUser.firstName;
    if (document.getElementById('headerUserRole')) {
        const r = (currentUser.role || '').toLowerCase();
        document.getElementById('headerUserRole').innerHTML = r === 'teacher' ? '<span class="role-teacher-tag">Teacher 🎓</span>' : (currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1));
    }
    
    renderUserHeaderAvatar(currentUser);

    const mainAvatar = document.getElementById('avatarImage');
    if (mainAvatar) {
        if (currentUser.avatar && currentUser.avatar.trim() !== '') {
            mainAvatar.src = currentUser.avatar;
            avatarBase64 = currentUser.avatar;
        } else {
            mainAvatar.src = defaultAvatarSvg;
        }
    }

    if (document.getElementById('displayFullName')) document.getElementById('displayFullName').textContent = `${currentUser.firstName} ${currentUser.lastName || ''}`;
    if (document.getElementById('displayUsername')) document.getElementById('displayUsername').textContent = currentUser.username ? `@${currentUser.username}` : '';

    // 2. Fetch profile data
    fetchProfileData();

    // 3. Setup avatar upload listener
    setupAvatarUpload();
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

// Switch Tabs (Personal Details vs Skills Inventory)
function switchTab(e, tabId) {
    if (e && e.preventDefault) {
        e.preventDefault();
    }
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    const clickedBtn = (e && e.currentTarget) ? e.currentTarget : (e && e.target ? e.target : null);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    const tabContent = document.getElementById(tabId);
    if (tabContent) {
        tabContent.classList.add('active');
    }
}

// Fetch user profile from SQLite
async function fetchProfileData() {
    try {
        const response = await fetch('/api/profile', {
            method: 'GET',
            headers: {
                'X-User-Id': currentUser.id
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            const p = data.profile;

            // Update Header Display
            document.getElementById('headerUserName').textContent = p.firstName;
            document.getElementById('headerUserRole').textContent = p.role.charAt(0).toUpperCase() + p.role.slice(1);

            // Admin Sidebar Nav visibility check
            const adminSidebarNav = document.getElementById('adminSidebarNav');
            if (adminSidebarNav) {
                if (p.role && p.role.toLowerCase() === 'admin') {
                    adminSidebarNav.style.display = 'flex';
                } else {
                    adminSidebarNav.style.display = 'none';
                }
            }

            // Update Left Column Card
            document.getElementById('displayFullName').textContent = `${p.firstName} ${p.lastName}`;
            document.getElementById('displayUsername').textContent = `@${p.username}`;
            document.getElementById('displayBioShort').textContent = p.bio || 'No bio description set yet.';

            // Render Premium Badge on Profile Card
            if (p.isPremium) {
                currentUser.isPremium = true;
                const badgeEl = document.getElementById('displayPremiumBadge');
                if (badgeEl) badgeEl.style.display = 'block';
            }
            
            // Set Avatar image & sync user session state
            if (p.avatar && p.avatar.trim() !== '') {
                document.getElementById('avatarImage').src = p.avatar;
                avatarBase64 = p.avatar;
                currentUser.avatar = p.avatar;
            } else {
                // Default SVG avatar placeholder
                document.getElementById('avatarImage').src = defaultAvatarSvg;
                avatarBase64 = '';
                currentUser.avatar = '';
            }

            currentUser.firstName = p.firstName;
            currentUser.lastName = p.lastName;
            currentUser.role = p.role;
            localStorage.setItem('user', JSON.stringify(currentUser));

            renderUserHeaderAvatar(currentUser);

            // Update Statistics
            document.getElementById('statCredits').textContent = Math.round(p.creditsEarned || 0);
            document.getElementById('statTaught').textContent = p.skillsTaughtCount;
            document.getElementById('statLearned').textContent = p.hoursLearned;

            // Populate Form Fields
            document.getElementById('firstNameInput').value = p.firstName;
            document.getElementById('lastNameInput').value = p.lastName;
            document.getElementById('usernameInput').value = p.username;
            document.getElementById('emailInput').value = p.email;
            document.getElementById('roleSelect').value = p.role;
            document.getElementById('bioTextarea').value = p.bio;

            // Load Skills
            skillsTeachList = p.skillsTeach ? p.skillsTeach.split(',').map(s => s.trim()).filter(Boolean) : [];
            skillsLearnList = p.skillsLearn ? p.skillsLearn.split(',').map(s => s.trim()).filter(Boolean) : [];
            renderSkills('Teach');
            renderSkills('Learn');

            // Render Achievements
            renderAchievements(p.achievements);

            // Render Activity Timeline
            renderTimeline(p.recentActivity);

            // Fetch Teacher Application Status
            fetchTeacherApplicationStatus();

            // Handle URL Hash Navigation (e.g. #skills-teach or #skills-learn)
            handleHashNavigation();

        } else {
            console.error('Error fetching profile details:', data.message);
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }

    } catch (error) {
        console.error('Fetch Profile Error:', error);
    }
}

// Profile Tab Switcher
function switchTab(event, tabId) {
    if (event) {
        event.preventDefault();
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        if (event.currentTarget) event.currentTarget.classList.add('active');
    }
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
}

// Deep link hash navigation handler for Skills I Teach & Skills I Want to Learn
function handleHashNavigation() {
    const hash = (window.location.hash || '').toLowerCase();
    if (hash.includes('skills')) {
        switchTab(null, 'skillsTab');
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(b => b.classList.remove('active'));
        if (tabBtns[1]) tabBtns[1].classList.add('active');

        setTimeout(() => {
            if (hash.includes('learn')) {
                const target = document.getElementById('skillsLearnContainer');
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            } else if (hash.includes('teach')) {
                const target = document.getElementById('skillsTeachContainer');
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    }
}

// Render Skills tags
function renderSkills(type) {
    const container = document.getElementById(`skills${type}Container`);
    const list = type === 'Teach' ? skillsTeachList : skillsLearnList;
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = `<span style="font-size:0.8rem; color:#94A3B8; font-style:italic;">No skills added yet.</span>`;
        return;
    }

    list.forEach((skill, index) => {
        const tag = document.createElement('span');
        tag.className = 'skill-tag';
        tag.innerHTML = `
            <span>${skill}</span>
            <button type="button" class="btn-tag-remove" onclick="removeSkillTag('${type}', ${index})">✕</button>
        `;
        container.appendChild(tag);
    });
}

// Add Skill tag
function addSkillTag(type) {
    const input = document.getElementById(`skills${type}Input`);
    const val = input.value.trim();
    if (!val) return;

    const list = type === 'Teach' ? skillsTeachList : skillsLearnList;

    // Avoid duplicates
    if (!list.some(s => s.toLowerCase() === val.toLowerCase())) {
        list.push(val);
        renderSkills(type);
    }

    input.value = '';
}

// Remove Skill tag
function removeSkillTag(type, index) {
    const list = type === 'Teach' ? skillsTeachList : skillsLearnList;
    list.splice(index, 1);
    renderSkills(type);
}

// Render Achievements List
function renderAchievements(list) {
    const container = document.getElementById('achievementsList');
    container.innerHTML = '';

    if (!list || list.length === 0) {
        container.innerHTML = `<p style="font-size:0.8rem; color:#94A3B8; font-style:italic;">No achievements unlocked yet.</p>`;
        return;
    }

    list.forEach(ach => {
        const div = document.createElement('div');
        div.className = 'achievement-item';
        div.innerHTML = `
            <div class="achievement-icon">${ach.icon}</div>
            <div class="achievement-info">
                <h4>${ach.title}</h4>
                <p>${ach.description}</p>
            </div>
        `;
        container.appendChild(div);
    });
}

// Render Activity Timeline
function renderTimeline(list) {
    const container = document.getElementById('timelineContainer');
    container.innerHTML = '';

    if (!list || list.length === 0) {
        container.innerHTML = `<p style="font-size:0.8rem; color:#94A3B8; font-style:italic;">No activity logs found.</p>`;
        return;
    }

    list.forEach(act => {
        const div = document.createElement('div');
        div.className = 'timeline-item';
        
        let markerClass = '';
        if (act.type === 'update') markerClass = 'update';
        else if (act.type === 'session') markerClass = 'session';
        else if (act.type === 'teach') markerClass = 'teach';
        else if (act.type === 'badge') markerClass = 'badge';

        div.innerHTML = `
            <div class="timeline-marker ${markerClass}">${act.icon}</div>
            <div class="timeline-content">
                <div class="timeline-time">${act.time}</div>
                <div class="timeline-text">${act.text}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

// Setup Avatar photo selection and server upload
function setupAvatarUpload() {
    const fileInput = document.getElementById('avatarUploadInput');
    if (!fileInput) return;

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate image file type (JPG, JPEG, PNG, WEBP)
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!allowedTypes.includes(file.type.toLowerCase()) && !allowedExtensions.includes(fileExt)) {
            alert('Invalid file format. Please select a JPG, JPEG, PNG, or WEBP image.');
            fileInput.value = '';
            return;
        }

        // Validate file size limit (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Please select an image smaller than 5MB.');
            fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64String = event.target.result;

            try {
                // Show immediate temporary preview while uploading
                const avatarImg = document.getElementById('avatarImage');
                if (avatarImg) avatarImg.src = base64String;

                const response = await fetch('/api/profile/upload-avatar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': currentUser.id
                    },
                    body: JSON.stringify({ avatar: base64String })
                });

                const data = await response.json();

                if (response.ok && data.success && data.avatar) {
                    const savedAvatarUrl = data.avatar;

                    // Update UI image elements with saved server URL
                    if (avatarImg) avatarImg.src = savedAvatarUrl;
                    avatarBase64 = savedAvatarUrl;

                    // Update session user state & localStorage
                    currentUser.avatar = savedAvatarUrl;
                    localStorage.setItem('user', JSON.stringify(currentUser));

                    // Re-render header avatar
                    renderUserHeaderAvatar(currentUser);
                } else {
                    alert(data.message || 'Failed to upload avatar photo.');
                    // Revert preview if failed
                    if (avatarImg) avatarImg.src = currentUser.avatar || defaultAvatarSvg;
                }
            } catch (err) {
                console.error('Avatar upload fetch error:', err);
                alert('Could not upload image. Please try again.');
                const avatarImg = document.getElementById('avatarImage');
                if (avatarImg) avatarImg.src = currentUser.avatar || defaultAvatarSvg;
            }
        };

        reader.readAsDataURL(file);
    });
}

// Save Changes to SQLite DB
async function saveProfileChanges(e) {
    e.preventDefault();

    const firstName = document.getElementById('firstNameInput').value.trim();
    const lastName = document.getElementById('lastNameInput').value.trim();
    const role = document.getElementById('roleSelect').value;
    const bio = document.getElementById('bioTextarea').value.trim();

    // Serialize skills arrays into comma-separated strings
    const skillsTeach = skillsTeachList.join(',');
    const skillsLearn = skillsLearnList.join(',');

    // Disable Save button
    const saveBtn = document.getElementById('btnSaveProfile');
    const originalContent = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span>💾 Saving changes...</span>';
    saveBtn.disabled = true;

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
                bio,
                avatar: avatarBase64,
                role,
                skillsTeach,
                skillsLearn
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message || 'Profile saved successfully!');
            // Update session data
            currentUser.firstName = firstName;
            currentUser.lastName = lastName;
            currentUser.role = role;
            if (data.user && data.user.avatar) {
                currentUser.avatar = data.user.avatar;
            } else if (avatarBase64) {
                currentUser.avatar = avatarBase64;
            }
            localStorage.setItem('user', JSON.stringify(currentUser));

            renderUserHeaderAvatar(currentUser);

            // Reload profile data (updates logs, display stats and fields)
            fetchProfileData();
        } else {
            alert(data.message || 'Error updating profile. Please try again.');
        }

    } catch (error) {
        console.error('Update Profile Fetch Error:', error);
        alert('Could not save changes. Please try again.');
    } finally {
        saveBtn.innerHTML = originalContent;
        saveBtn.disabled = false;
    }
}

// --- Teacher Application Modal & Logic ---
let activeTeacherApp = null;

async function fetchTeacherApplicationStatus() {
    if (!currentUser || !currentUser.id) return;

    try {
        const response = await fetch('/api/profile/teacher-application', {
            method: 'GET',
            headers: {
                'X-User-Id': currentUser.id
            }
        });
        const data = await response.json();

        if (response.ok && data.success && data.hasApplied && data.application) {
            activeTeacherApp = data.application;
            updateTeacherCardUI(data.application);
        } else {
            activeTeacherApp = null;
        }
    } catch (err) {
        console.error('Error fetching teacher application:', err);
    }
}

function updateTeacherCardUI(app) {
    const btn = document.getElementById('btnOpenTeacherModal');
    const badgeContainer = document.getElementById('teacherAppStatusBadge');
    const titleEl = document.getElementById('teacherCardTitle');
    const descEl = document.getElementById('teacherCardDesc');

    if (!app) return;

    if (badgeContainer) badgeContainer.style.display = 'block';

    if (app.status === 'approved') {
        if (badgeContainer) badgeContainer.innerHTML = `<span class="status-badge-approved">✅ Approved Teacher</span>`;
        if (titleEl) titleEl.textContent = "Teacher Profile";
        if (descEl) descEl.textContent = `Fee: ${app.hourlyFee} credit(s)/hr | Status: Approved`;
        if (btn) btn.innerHTML = `<span>View Application 🎓</span>`;
    } else if (app.status === 'pending') {
        if (badgeContainer) badgeContainer.innerHTML = `<span class="status-badge-pending">⏳ Application Under Review</span>`;
        if (titleEl) titleEl.textContent = "Teacher Application";
        if (descEl) descEl.textContent = `Submitted on ${app.createdAt ? app.createdAt.split(' ')[0] : 'recently'}. Rate: ${app.hourlyFee} credit(s)/hr.`;
        if (btn) btn.innerHTML = `<span>Edit Application ✏️</span>`;
    }

    // Pre-fill form fields if app exists
    if (document.getElementById('teacherQualificationsInput')) document.getElementById('teacherQualificationsInput').value = app.qualifications || '';
    if (document.getElementById('teacherSkillsInput')) document.getElementById('teacherSkillsInput').value = app.skills || '';
    if (document.getElementById('teacherExperienceInput')) document.getElementById('teacherExperienceInput').value = app.experience || '';
    if (document.getElementById('teacherHourlyFeeInput')) document.getElementById('teacherHourlyFeeInput').value = app.hourlyFee || '';
}

function openTeacherModal() {
    const modal = document.getElementById('teacherModalOverlay');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeTeacherModal() {
    const modal = document.getElementById('teacherModalOverlay');
    if (modal) {
        modal.style.display = 'none';
    }
}

function handleTeacherModalOverlayClick(e) {
    if (e.target.id === 'teacherModalOverlay') {
        closeTeacherModal();
    }
}

async function submitTeacherApplication(e) {
    e.preventDefault();

    const qualifications = document.getElementById('teacherQualificationsInput').value.trim();
    const skills = document.getElementById('teacherSkillsInput').value.trim();
    const experience = document.getElementById('teacherExperienceInput').value.trim();
    const hourlyFee = document.getElementById('teacherHourlyFeeInput').value.trim();

    if (!qualifications || !skills || !experience || !hourlyFee) {
        alert('Please fill in all required fields.');
        return;
    }

    const submitBtn = document.getElementById('btnSubmitTeacherApp');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>⏳ Submitting...</span>';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/profile/become-teacher', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser.id
            },
            body: JSON.stringify({
                qualifications,
                skills,
                experience,
                hourlyFee: parseFloat(hourlyFee)
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message || 'Application submitted successfully!');
            closeTeacherModal();
            activeTeacherApp = data.application;
            updateTeacherCardUI(data.application);

            // Refresh profile data to show timeline activity update
            fetchProfileData();
        } else {
            alert(data.message || 'Could not submit application. Please check inputs and try again.');
        }

    } catch (err) {
        console.error('Submit Teacher Application Error:', err);
        alert('Failed to connect to server. Please try again.');
    } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
}
