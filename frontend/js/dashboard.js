// Initialize Dark Mode theme from localStorage
(function() {
    if (localStorage.getItem("dark_theme") === "true") {
        document.body.classList.add("dark-theme");
    }
})();

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

// ========== SIDEBAR TOGGLE ==========
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Setup Socket.IO real-time connection
function initRealtimeNotifications(userId) {
    const script = document.createElement('script');
    script.src = '/socket.io/socket.io.js';
    script.onload = () => {
        if (typeof io !== 'undefined') {
            const socket = io();
            socket.emit('register', userId);
            
            socket.on('session_start_notification', (session) => {
                console.log("🔔 Real-time Notification: Session starting!", session);
                alert(`🔔 Real-time Notification: Your session "${session.skill}" is starting now! Click OK to join.`);
                window.location.reload();
            });

            socket.on('session_decline_notification', (data) => {
                console.log("🔔 Real-time Notification: Session request declined!", data);
                alert(`🔔 Session Request Declined: Your request for "${data.skill}" was declined by ${data.teacherName}.`);
                window.location.reload();
            });

            socket.on('session_status_update', (data) => {
                console.log("🔔 Real-time Notification: Session request status updated:", data);
                window.location.reload();
            });
        }
    };
    document.head.appendChild(script);
}

// Helper to calculate human-readable relative time string
function getRelativeTime(dateInput) {
    if (!dateInput) return 'Just now';

    let date;
    if (typeof dateInput === 'string' && dateInput.includes('T')) {
        date = new Date(dateInput);
    } else if (typeof dateInput === 'string' && dateInput.includes('-')) {
        const iso = dateInput.replace(' ', 'T');
        date = new Date(iso);
    } else if (!isNaN(Number(dateInput))) {
        date = new Date(Number(dateInput));
    } else {
        date = new Date(dateInput);
    }

    if (!date || isNaN(date.getTime())) {
        return 'Just now';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffWeeks <= 4 && diffDays < 30) {
        return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
    } else {
        const day = date.getDate();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    }
}

// ========== ANIMATED COUNTERS ==========
function animateCounter(element, target, duration = 1500) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Number.isInteger(target) ? Math.floor(current) : current.toFixed(1);
    }, 16);
}

// ========== PROGRESS CIRCLE ANIMATION ==========
function animateProgressCircles(pct = 0) {
    const circles = document.querySelectorAll('.progress-circle-bar');
    circles.forEach(circle => {
        const circumference = 2 * Math.PI * 40;
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${circumference}`;

        setTimeout(() => {
            circle.style.transition = 'stroke-dashoffset 1.5s ease';
            const offset = circumference * (1 - (pct / 100));
            circle.style.strokeDashoffset = `${offset}`;
        }, 300);
    });
}

// ========== SKILL BAR ANIMATION ==========
function animateSkillBars() {
    const bars = document.querySelectorAll('.skill-bar-fill');
    bars.forEach((bar, index) => {
        const width = bar.style.width || getComputedStyle(bar).width;
        bar.style.width = '0%';
        setTimeout(() => {
            bar.style.transition = 'width 1s ease';
            bar.style.width = width;
        }, 500 + (index * 200));
    });
}

// ========== STAT CARDS ENTRANCE ==========
function animateStatCards() {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 200 + (index * 100));
    });
}

// ========== DARK CARDS ENTRANCE ==========
function animateDarkCards() {
    const cards = document.querySelectorAll('.dark-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            card.style.transition = 'all 0.6s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateX(0)';
        }, 400 + (index * 150));
    });
}

// ========== ACTIVITY ITEMS STAGGER ==========
function animateActivities() {
    const items = document.querySelectorAll('.activity-item');
    items.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-15px)';
        setTimeout(() => {
            item.style.transition = 'all 0.4s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, 600 + (index * 120));
    });
}

// ========== PERSON CARDS ENTRANCE ==========
function animatePersonCards() {
    const cards = document.querySelectorAll('.person-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => {
            card.style.transition = 'all 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
        }, 800 + (index * 100));
    });
}

// ========== SIDE CARDS ENTRANCE ==========
function animateSideCards() {
    const cards = document.querySelectorAll('.time-wallet, .calendar-card, .session-card, .contributors-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        setTimeout(() => {
            card.style.transition = 'all 0.6s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 300 + (index * 150));
    });
}

// ========== CONNECT BUTTON INTERACTION ==========
function setupConnectButtons() {
    document.querySelectorAll('.btn-connect').forEach(btn => {
        btn.addEventListener('click', function() {
            const originalText = this.textContent;
            this.textContent = '✓ Connected';
            this.style.background = '#10B981';
            this.style.pointerEvents = 'none';

            setTimeout(() => {
                this.textContent = originalText;
                this.style.background = '';
                this.style.pointerEvents = '';
            }, 2000);
        });
    });
}

// ========== CALENDAR COMPONENT LOGIC & STATE ==========
const todayDateObj = new Date();
let currentCalDate = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), 1);
let selectedDateStr = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`;
let cachedDashboardSessions = [];

function formatDateToYYYYMMDD(year, monthIndex, day) {
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
}

function normalizeDateStr(dateInput) {
    if (!dateInput) return '';
    const str = String(dateInput).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        return formatDateToYYYYMMDD(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
    return str;
}

function renderDynamicCalendar() {
    const monthYearEl = document.getElementById('calMonthYear');
    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) return;

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    if (monthYearEl) {
        monthYearEl.textContent = `${monthNames[month]} ${year}`;
    }

    // Clear previous day cells, keeping the 7 day headers
    const existingDays = calendarGrid.querySelectorAll('.calendar-day');
    existingDays.forEach(d => d.remove());

    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Monday start: (getDay() + 6) % 7
    const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Render Previous Month Trailing Days
    for (let i = startDayIndex - 1; i >= 0; i--) {
        const dayNum = prevMonthDays - i;
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other';
        dayDiv.textContent = dayNum;
        calendarGrid.appendChild(dayDiv);
    }

    const todayStr = formatDateToYYYYMMDD(todayDateObj.getFullYear(), todayDateObj.getMonth(), todayDateObj.getDate());
    const sessionDatesSet = new Set(
        cachedDashboardSessions.map(s => normalizeDateStr(s.date)).filter(Boolean)
    );

    // Render Current Month Days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDateToYYYYMMDD(year, month, day);
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.textContent = day;
        dayDiv.dataset.date = dateStr;

        if (dateStr === todayStr) {
            dayDiv.classList.add('today');
        }

        if (dateStr === selectedDateStr) {
            dayDiv.classList.add('active');
        }

        if (sessionDatesSet.has(dateStr)) {
            dayDiv.classList.add('has-session');
            const dot = document.createElement('span');
            dot.className = 'calendar-session-dot';
            dayDiv.appendChild(dot);
        }

        dayDiv.addEventListener('click', () => {
            selectedDateStr = dateStr;
            calendarGrid.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('active'));
            dayDiv.classList.add('active');
            updateUpcomingSessionsForSelectedDate(dateStr);
        });

        calendarGrid.appendChild(dayDiv);
    }

    // Render Next Month Leading Days
    const totalCells = startDayIndex + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other';
        dayDiv.textContent = i;
        calendarGrid.appendChild(dayDiv);
    }
}

function setupCalendarControls() {
    const prevBtn = document.getElementById('calPrevBtn');
    const nextBtn = document.getElementById('calNextBtn');

    if (prevBtn) {
        prevBtn.onclick = (e) => {
            e.preventDefault();
            currentCalDate.setMonth(currentCalDate.getMonth() - 1);
            renderDynamicCalendar();
        };
    }

    if (nextBtn) {
        nextBtn.onclick = (e) => {
            e.preventDefault();
            currentCalDate.setMonth(currentCalDate.getMonth() + 1);
            renderDynamicCalendar();
        };
    }

    renderDynamicCalendar();
}

function updateUpcomingSessionsForSelectedDate(targetDateStr) {
    const upcomingSessionContent = document.getElementById('upcomingSessionContent');
    if (!upcomingSessionContent) return;

    const matchingSessions = cachedDashboardSessions.filter(s => normalizeDateStr(s.date) === targetDateStr);

    if (matchingSessions.length > 0) {
        const upcoming = matchingSessions[0];
        const partner = upcoming.partnerName || 'Partner';
        const initials = (partner.charAt(0) + (partner.split(' ')[1]?.charAt(0) || '')).toUpperCase();

        upcomingSessionContent.innerHTML = `
            <div class="session-avatar">${initials}</div>
            <div class="session-info">
                <div class="session-title">${upcoming.skill || 'Skill Session'}</div>
                <div class="session-teacher">${upcoming.isOutgoing ? 'with' : 'for'} ${partner}</div>
                <div class="session-time">
                    <span>📅 ${upcoming.date}</span>
                    <span>⏱ ${upcoming.time || 'Scheduled'}</span>
                </div>
            </div>
            <button class="btn-join" onclick="window.location.href='session-room.html?id=${upcoming.requestId || upcoming.id}'">
                <span>▶</span>
                <span>Join Session</span>
                <span>→</span>
            </button>
        `;
    } else {
        const parts = targetDateStr.split('-');
        let readableDate = targetDateStr;
        if (parts.length === 3) {
            const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            readableDate = `${parts[2]} ${monthNames[dObj.getMonth()]} ${parts[0]}`;
        }
        upcomingSessionContent.innerHTML = `
            <div style="font-size:0.85rem;color:#94A3B8;font-style:italic;padding:20px 0;text-align:center;width:100%;">
                No sessions scheduled for ${readableDate}.
            </div>
        `;
    }
}

// ========== NAV ITEM CLICK ==========
function setupNavItems() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            // Let the page navigate normally. Just style it briefly before unload.
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// ========== PEOPLE CAROUSEL NAVIGATION ==========
function setupCarousel() {
    const prevBtn = document.querySelector('.people-nav.prev');
    const nextBtn = document.querySelector('.people-nav.next');
    const carousel = document.querySelector('.people-carousel');

    if (prevBtn && nextBtn && carousel) {
        prevBtn.addEventListener('click', () => {
            carousel.scrollBy({ left: -200, behavior: 'smooth' });
        });
        nextBtn.addEventListener('click', () => {
            carousel.scrollBy({ left: 200, behavior: 'smooth' });
        });
    }
}

// ========== SPARKLINE ANIMATION ==========
function animateSparklines() {
    const sparklines = document.querySelectorAll('.stat-sparkline path');
    sparklines.forEach((path, index) => {
        const length = path.getTotalLength ? path.getTotalLength() : 100;
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
        setTimeout(() => {
            path.style.transition = 'stroke-dashoffset 1s ease';
            path.style.strokeDashoffset = '0';
        }, 500 + (index * 200));
    });
}

// ========== HERO BANNER ENTRANCE ==========
function animateHero() {
    const hero = document.querySelector('.hero-banner');
    const heroContent = document.querySelector('.hero-content');
    const heroIllustration = document.querySelector('.hero-illustration');

    if (hero) {
        hero.style.opacity = '0';
        hero.style.transform = 'translateY(20px)';
        setTimeout(() => {
            hero.style.transition = 'all 0.8s ease';
            hero.style.opacity = '1';
            hero.style.transform = 'translateY(0)';
        }, 100);
    }

    if (heroContent) {
        heroContent.style.opacity = '0';
        heroContent.style.transform = 'translateX(-30px)';
        setTimeout(() => {
            heroContent.style.transition = 'all 0.6s ease 0.3s';
            heroContent.style.opacity = '1';
            heroContent.style.transform = 'translateX(0)';
        }, 300);
    }

    if (heroIllustration) {
        heroIllustration.style.opacity = '0';
        heroIllustration.style.transform = 'translateX(30px)';
        setTimeout(() => {
            heroIllustration.style.transition = 'all 0.6s ease 0.5s';
            heroIllustration.style.opacity = '1';
            heroIllustration.style.transform = 'translateX(0)';
        }, 500);
    }
}

// ========== WALLET CHART ANIMATION ==========
function animateWalletChart() {
    const chart = document.querySelector('.wallet-chart circle:last-child');
    if (chart) {
        const circumference = 2 * Math.PI * 40;
        chart.style.strokeDasharray = circumference;
        chart.style.strokeDashoffset = circumference;
        setTimeout(() => {
            chart.style.transition = 'stroke-dashoffset 1.5s ease';
            chart.style.strokeDashoffset = circumference * 0.25;
        }, 800);
    }
}

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

// ========== INIT ALL ==========
document.addEventListener('DOMContentLoaded', async function() {
    // Check Database instance status
    checkDbStatus();

    // Entrance animations for static shell elements
    animateHero();
    animateSideCards();
    setupCalendarControls();
    setupNavItems();
    setupCarousel();

    // Resolve user session
    let currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Role-based route guard for Student Dashboard
    const userRole = (currentUser.role || '').toLowerCase();
    if (userRole === 'teacher') {
        window.location.href = 'teacher-dashboard.html';
        return;
    } else if (userRole === 'admin') {
        window.location.href = 'admin-teacher-applications.html';
        return;
    }

    // Sync header static items initially
    document.getElementById('headerUserName').textContent = currentUser.firstName;
    document.getElementById('headerUserRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    renderUserHeaderAvatar(currentUser);
    document.getElementById('greetingName').textContent = `${currentUser.firstName} ${currentUser.lastName} 👋`;

    // Admin Sidebar Nav visibility check
    const adminSidebarNav = document.getElementById('adminSidebarNav');
    if (adminSidebarNav) {
        if (currentUser.role && currentUser.role.toLowerCase() === 'admin') {
            adminSidebarNav.style.display = 'flex';
        } else {
            adminSidebarNav.style.display = 'none';
        }
    }

    // Initialize Real-time Notification Sockets
    initRealtimeNotifications(currentUser.id);

    let skillsTeachCount = 0;
    let skillsLearnCount = 0;
    
    // Calculate rating dynamically from local storage user reviews
    let rating = 0.0;
    try {
        const storedReviews = localStorage.getItem("user_reviews");
        const reviewsList = storedReviews ? JSON.parse(storedReviews) : [];
        if (reviewsList.length > 0) {
            const sum = reviewsList.reduce((acc, r) => acc + r.rating, 0);
            rating = parseFloat((sum / reviewsList.length).toFixed(1));
        }
    } catch (e) {
        rating = 0.0;
    }

    // Calculate completed sessions dynamically from backend session requests
    let allUserRequests = [];
    let completedSessions = 0;
    try {
        const response = await fetch('/api/profile/session-requests', {
            method: 'GET',
            headers: {
                'X-User-Id': currentUser.id
            }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            allUserRequests = data.requests || [];
            completedSessions = allUserRequests.filter(s => s.status === 'completed' || s.status === 'Completed').length;
        }
    } catch (e) {
        console.warn("Could not fetch session requests from backend, falling back to local storage:", e);
        try {
            allUserRequests = JSON.parse(localStorage.getItem("session_requests")) || [];
            completedSessions = allUserRequests.filter(s => s.status === 'completed' || s.status === 'Completed').length;
        } catch (localErr) {
            allUserRequests = [];
            completedSessions = 0;
        }
    }

    try {
        // Fetch real database profile
        const response = await fetch('/api/profile', {
            method: 'GET',
            headers: {
                'X-User-Id': currentUser.id
            }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            const p = data.profile;

            // Sync Header & Greeting
            document.getElementById('headerUserName').textContent = p.firstName;
            document.getElementById('headerUserRole').textContent = p.role.charAt(0).toUpperCase() + p.role.slice(1);
            document.getElementById('greetingName').textContent = `${p.firstName} ${p.lastName} 👋`;

            if (p.avatar) {
                currentUser.avatar = p.avatar;
            }
            currentUser.firstName = p.firstName;
            currentUser.lastName = p.lastName;
            currentUser.role = p.role;
            localStorage.setItem("user", JSON.stringify(currentUser));
            renderUserHeaderAvatar(currentUser);

            // Render Premium Badges
            if (p.isPremium) {
                currentUser.isPremium = true;
                localStorage.setItem("user", JSON.stringify(currentUser));

                const badgeEl = document.getElementById('headerPremiumBadge');
                if (badgeEl) badgeEl.style.display = 'inline-block';

                const headerBtn = document.querySelector('.btn-premium-header');
                if (headerBtn) {
                    headerBtn.innerHTML = `<span>💎</span><span>Premium Member</span>`;
                    headerBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                    headerBtn.style.color = '#ffffff';
                }
            }

            // Calculate skill counts
            skillsTeachCount = p.skillsTeach ? p.skillsTeach.split(',').map(s => s.trim()).filter(Boolean).length : 0;
            skillsLearnCount = p.skillsLearn ? p.skillsLearn.split(',').map(s => s.trim()).filter(Boolean).length : 0;
            
            // Add completed sessions count from database if higher
            completedSessions = Math.max(completedSessions, p.skillsTaughtCount || 0);

            // Set Time Wallet values dynamically from SQLite database
            try {
                const txRes = await fetch('/api/profile/transactions', {
                    method: 'GET',
                    headers: { 'X-User-Id': currentUser.id }
                });
                const txData = await txRes.json();
                const realBalance = Math.round((txData && txData.success) ? (txData.balance || 0) : (p.creditsEarned || 0));
                const realEarned = Math.round((txData && txData.success) ? (txData.totalEarned || 0) : (p.creditsEarned || 0));
                const realSpent = Math.round((txData && txData.success) ? (txData.totalSpent || 0) : 0);

                if (document.getElementById('walletAmount')) document.getElementById('walletAmount').textContent = realBalance;
                if (document.getElementById('walletEarned')) document.getElementById('walletEarned').textContent = realEarned;
                if (document.getElementById('walletSpent')) document.getElementById('walletSpent').textContent = realSpent;

                const walletCircle = document.getElementById('walletChartCircle');
                if (walletCircle) {
                    if (realEarned > 0) {
                        const pct = Math.min(1, realBalance / realEarned);
                        const offset = 251 * (1 - pct);
                        walletCircle.style.strokeDashoffset = offset;
                    } else {
                        walletCircle.style.strokeDashoffset = 251;
                    }
                }
            } catch (err) {
                if (document.getElementById('walletAmount')) document.getElementById('walletAmount').textContent = Math.round(p.creditsEarned || 0);
                if (document.getElementById('walletEarned')) document.getElementById('walletEarned').textContent = Math.round(p.creditsEarned || 0);
                if (document.getElementById('walletSpent')) document.getElementById('walletSpent').textContent = 0;
            }

            // Populate Skills Learn Progress List with REAL database data
            const progressSkillList = document.getElementById('progressSkillList');
            const percentEl = document.querySelector('.progress-text .percent');

            // Filter outgoing learning requests (where logged in user is the learner/sender)
            const learningRequests = allUserRequests.filter(r => String(r.senderId) === String(currentUser.id));

            // Extract profile learning skills
            const profileSkills = p.skillsLearn ? p.skillsLearn.split(',').map(s => s.trim()).filter(Boolean) : [];
            // Extract skills from learning requests
            const requestSkills = learningRequests.map(r => r.skill ? r.skill.trim() : '').filter(Boolean);

            // Unique combined list of learning skills
            const allLearningSkills = Array.from(new Set([...profileSkills, ...requestSkills]));

            // Check if user has any active/scheduled or completed learning sessions
            const activeOrCompletedReqs = learningRequests.filter(r => {
                const st = (r.status || '').toLowerCase();
                return st === 'completed' || st === 'finished' || st === 'active' || st === 'scheduled' || st === 'accepted' || st === 'confirmed';
            });

            if (allLearningSkills.length === 0 || learningRequests.length === 0 || activeOrCompletedReqs.length === 0) {
                if (percentEl) percentEl.textContent = '0%';
                if (progressSkillList) {
                    progressSkillList.innerHTML = '<div style="font-size:0.88rem; color:var(--text-muted, #94A3B8); font-style:italic; padding:1.5rem 0; text-align:center;">No learning progress yet</div>';
                }
                animateProgressCircles(0);
            } else {
                if (progressSkillList) progressSkillList.innerHTML = '';
                const colors = ['purple', 'pink', 'orange', 'cyan'];
                let totalCompletedSessions = 0;
                let totalRelevantSessions = 0;

                allLearningSkills.forEach((skill, index) => {
                    const color = colors[index % colors.length];
                    const skillReqs = learningRequests.filter(r => r.skill && r.skill.trim().toLowerCase() === skill.toLowerCase());

                    const validSkillReqs = skillReqs.filter(r => {
                        const st = (r.status || '').toLowerCase();
                        return st !== 'rejected' && st !== 'declined' && st !== 'cancelled';
                    });

                    const completedCount = validSkillReqs.filter(r => {
                        const st = (r.status || '').toLowerCase();
                        return st === 'completed' || st === 'finished';
                    }).length;

                    const totalCount = validSkillReqs.length;

                    totalCompletedSessions += completedCount;
                    totalRelevantSessions += totalCount;

                    let skillPct = 0;
                    if (totalCount > 0) {
                        skillPct = Math.round((completedCount / totalCount) * 100);
                    }

                    if (progressSkillList) {
                        progressSkillList.innerHTML += `
                            <div class="skill-item">
                                <div class="skill-header">
                                    <span class="skill-name"><span class="skill-dot ${color}"></span> ${skill}</span>
                                    <span class="skill-percent">${skillPct}%</span>
                                </div>
                                <div class="skill-bar"><div class="skill-bar-fill ${color}" style="width: ${skillPct}%"></div></div>
                            </div>
                        `;
                    }
                });

                const overallPct = totalRelevantSessions > 0 ? Math.round((totalCompletedSessions / totalRelevantSessions) * 100) : 0;
                if (percentEl) percentEl.textContent = `${overallPct}%`;
                animateProgressCircles(overallPct);
                animateSkillBars();
            }

            // Populate Recent Activity List
            const recentActivityList = document.getElementById('recentActivityList');
            if (recentActivityList) {
                recentActivityList.innerHTML = '';
                const activity = p.recentActivity || [];
                if (activity.length === 0) {
                    recentActivityList.innerHTML = '<div style="font-size:0.85rem;color:#94A3B8;font-style:italic;padding:10px 0;">No recent activity logs.</div>';
                } else {
                    const typeColors = {
                        'teach': 'purple',
                        'session': 'green',
                        'update': 'cyan',
                        'badge': 'pink',
                        'connect': 'blue'
                    };
                    activity.forEach(act => {
                        const color = typeColors[act.type] || 'purple';
                        const displayTime = getRelativeTime(act.createdAt || act.timestamp || act.date || act.time);
                        recentActivityList.innerHTML += `
                            <div class="activity-item">
                                <div class="activity-icon ${color}">${act.icon || '✓'}</div>
                                <div class="activity-content">
                                    <div class="activity-text">${act.text}</div>
                                    <div class="activity-time">${displayTime}</div>
                                </div>
                            </div>
                        `;
                    });
                }
            }

            // Populate Top Skill Contributors List dynamically
            const contributorsList = document.getElementById('contributorsList');
            if (contributorsList) {
                contributorsList.innerHTML = '';
                
                try {
                    const searchRes = await fetch('/api/profile/search', {
                        method: 'GET',
                        headers: {
                            'X-User-Id': currentUser.id
                        }
                    });
                    const searchData = await searchRes.json();
                    
                    if (searchRes.ok && searchData.success && searchData.profiles.length > 0) {
                        const topUsers = searchData.profiles
                            .sort((a, b) => (b.creditsEarned || 0) - (a.creditsEarned || 0))
                            .slice(0, 3);
                            
                        const ranks = ['gold', 'silver', 'bronze'];
                        topUsers.forEach((u, i) => {
                            const initials = (u.firstName.charAt(0) + (u.lastName ? u.lastName.charAt(0) : '')).toUpperCase();
                            const primarySkill = u.skillsTeach && u.skillsTeach.length > 0 ? u.skillsTeach[0] : 'Contributor';
                            const rankClass = ranks[i] || 'bronze';
                            
                            contributorsList.innerHTML += `
                                <div class="contributor-item">
                                    <div class="contributor-rank ${rankClass}">${i + 1}</div>
                                    <div class="contributor-avatar">${initials}</div>
                                    <div class="contributor-info">
                                        <div class="contributor-name">${u.firstName} ${u.lastName || ''}</div>
                                        <div class="contributor-skill">${primarySkill}</div>
                                    </div>
                                    <div class="contributor-points">
                                        <span>${u.creditsEarned || 0}</span>
                                        <span class="trophy">🏆</span>
                                    </div>
                                </div>
                            `;
                        });
                    } else {
                        contributorsList.innerHTML = '<div style="font-size:0.85rem;color:#94A3B8;font-style:italic;padding:20px;text-align:center;">No contributors this month yet.</div>';
                    }
                } catch (err) {
                    console.error('Error loading contributors:', err);
                    contributorsList.innerHTML = '<div style="font-size:0.85rem;color:#94A3B8;font-style:italic;padding:20px;text-align:center;">No contributors this month yet.</div>';
                }
            }

        } else {
            console.error('Error loading dashboard profile:', data.message);
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    } catch (err) {
        console.error('Error fetching dashboard profile data:', err);
        skillsTeachCount = 0;
        skillsLearnCount = 0;
        completedSessions = 0;
        rating = 0.0;
    }

    // Animate stats counter
    const statValues = document.querySelectorAll('.stat-value');
    const targets = [skillsTeachCount, skillsLearnCount, completedSessions, rating];
    statValues.forEach((el, i) => {
        animateCounter(el, targets[i]);
    });

    // Fetch upcoming sessions from SQLite backend
    const upcomingSessionContent = document.getElementById('upcomingSessionContent');
    if (upcomingSessionContent) {
        try {
            const sessionsResponse = await fetch('/api/profile/active-sessions', {
                method: 'GET',
                headers: {
                    'X-User-Id': currentUser.id
                }
            });
            const sessionsData = await sessionsResponse.json();

            const apiSessions = (sessionsResponse.ok && sessionsData.success) ? (sessionsData.sessions || []) : [];
            const reqSessions = (allUserRequests || []).filter(r => {
                const st = (r.status || '').toLowerCase();
                return st === 'scheduled' || st === 'active' || st === 'accepted' || st === 'confirmed';
            }).map(r => ({
                id: r.id,
                requestId: r.id,
                skill: r.skill,
                date: r.date,
                time: r.time,
                partnerName: (String(r.senderId) === String(currentUser.id)) ? r.recipientName : r.senderName,
                isOutgoing: String(r.senderId) === String(currentUser.id)
            }));

            const combinedMap = new Map();
            apiSessions.forEach(s => combinedMap.set(s.requestId || s.id, s));
            reqSessions.forEach(r => {
                if (!combinedMap.has(r.requestId)) {
                    combinedMap.set(r.requestId, r);
                }
            });

            cachedDashboardSessions = Array.from(combinedMap.values());
            renderDynamicCalendar();
            updateUpcomingSessionsForSelectedDate(selectedDateStr);

        } catch (sessionsErr) {
            console.error('Error fetching active sessions:', sessionsErr);
            renderDynamicCalendar();
            updateUpcomingSessionsForSelectedDate(selectedDateStr);
        }
    }

    // Fetch and populate People You May Want to Connect carousel
    try {
        // 1. Fetch saved session requests to see who we already sent requests to
        let sentRequestIds = new Set();
        try {
            const reqsRes = await fetch('/api/profile/session-requests', {
                headers: { 'X-User-Id': currentUser.id }
            });
            const reqsData = await reqsRes.json();
            if (reqsRes.ok && reqsData.success && reqsData.requests) {
                reqsData.requests.forEach(r => {
                    if (r.senderId == currentUser.id && r.status === 'pending') {
                        sentRequestIds.add(r.recipientId);
                    }
                });
            }
        } catch (rErr) {
            console.warn('Could not fetch existing requests:', rErr);
        }

        // 2. Fetch profiles from database
        const response = await fetch('/api/profile/search', {
            method: 'GET',
            headers: { 'X-User-Id': currentUser.id }
        });
        const data = await response.json();
        const carousel = document.querySelector('.people-carousel');

        if (carousel && response.ok && data.success) {
            const allProfiles = data.profiles || [];

            // Filter: Exclude logged-in user and admin role
            const profiles = allProfiles.filter(p => p.id != currentUser.id && (p.role || '').toLowerCase() !== 'admin');

            const prevBtn = carousel.querySelector('.people-nav.prev');
            const nextBtn = carousel.querySelector('.people-nav.next');

            // Setup Carousel Navigation Scrolling
            if (prevBtn) {
                prevBtn.onclick = (e) => {
                    e.stopPropagation();
                    carousel.scrollBy({ left: -240, behavior: 'smooth' });
                };
            }
            if (nextBtn) {
                nextBtn.onclick = (e) => {
                    e.stopPropagation();
                    carousel.scrollBy({ left: 240, behavior: 'smooth' });
                };
            }

            // Remove hardcoded/existing cards and empty messages
            carousel.querySelectorAll('.person-card, .no-people-msg').forEach(card => card.remove());

            if (profiles.length === 0) {
                const noPeople = document.createElement('div');
                noPeople.className = 'no-people-msg';
                noPeople.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 25px; color: var(--text-muted, #94A3B8); font-style: italic; width: 100%;';
                noPeople.innerHTML = '👥 No other matching users found to connect with right now.';
                if (nextBtn) nextBtn.before(noPeople);
                else carousel.appendChild(noPeople);
            } else {
                const colors = ['pink', 'green', 'orange', 'blue'];
                profiles.forEach((p, idx) => {
                    const color = colors[idx % colors.length];
                    const initials = ((p.firstName ? p.firstName.charAt(0) : '') + (p.lastName ? p.lastName.charAt(0) : '')).toUpperCase() || 'U';
                    const isRequestSent = sentRequestIds.has(p.id);

                    const card = document.createElement('div');
                    card.className = 'person-card';
                    card.style.cursor = 'pointer';

                    let avatarHtml = `<div class="person-avatar">${initials}</div>`;
                    if (p.avatar && p.avatar.trim() !== '') {
                        avatarHtml = `<img class="person-avatar" src="${p.avatar}" alt="${p.firstName}" style="object-fit: cover;">`;
                    }

                    const roleDisplay = p.role && p.role.toLowerCase() === 'teacher' 
                        ? 'Teacher 🎓' 
                        : (p.skillsTeach && p.skillsTeach.length > 0 ? p.skillsTeach[0] : 'Learner 📚');

                    card.innerHTML = `
                        ${avatarHtml}
                        <div class="person-name">${p.firstName} ${p.lastName}</div>
                        <div class="person-role">${roleDisplay}</div>
                        <div class="person-rating">
                            <span class="star">⭐</span>
                            <span>4.9 (12)</span>
                        </div>
                        <button class="btn-connect ${color} ${isRequestSent ? 'sent' : ''}" 
                                data-user-id="${p.id}" 
                                data-user-name="${p.firstName} ${p.lastName}"
                                data-user-avatar="${p.avatar || ''}"
                                data-skill="${p.skillsTeach && p.skillsTeach[0] ? p.skillsTeach[0] : 'Skill Swap'}"
                                ${isRequestSent ? 'disabled style="opacity:0.75; cursor:not-allowed;"' : ''}>
                            ${isRequestSent ? 'Request Sent' : 'Connect'}
                        </button>
                    `;

                    // Card click opens user profile on browse-people page
                    card.addEventListener('click', (e) => {
                        if (!e.target.closest('.btn-connect')) {
                            window.location.href = `browse-people.html?search=${encodeURIComponent(p.firstName + ' ' + p.lastName)}`;
                        }
                    });

                    // Connect button click handler
                    const connectBtn = card.querySelector('.btn-connect');
                    if (connectBtn && !isRequestSent) {
                        connectBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            await sendConnectionRequest(connectBtn, currentUser);
                        });
                    }

                    if (nextBtn) nextBtn.before(card);
                    else carousel.appendChild(card);
                });
            }
        }
    } catch (err) {
        console.error('Error loading people carousel:', err);
    }

    // Trigger remaining animations
    animateStatCards();
    animateDarkCards();
    animateActivities();
    animatePersonCards();

    // Progress animations trigger
    setTimeout(() => {
        animateProgressCircles();
        animateSkillBars();
        animateSparklines();
        animateWalletChart();
    }, 200);
});

// Send Connection/Session Request Action Handler
async function sendConnectionRequest(btn, currentUser) {
    const recipientId = btn.getAttribute('data-user-id');
    const recipientName = btn.getAttribute('data-user-name');
    const recipientAvatar = btn.getAttribute('data-user-avatar');
    const skill = btn.getAttribute('data-skill');

    if (!recipientId || !currentUser) return;

    btn.disabled = true;
    btn.textContent = 'Sending...';

    // Format tomorrow's date for session
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    try {
        const response = await fetch('/api/profile/session-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser.id
            },
            body: JSON.stringify({
                recipientId: parseInt(recipientId),
                recipientName,
                recipientAvatar,
                skill,
                date: dateStr,
                time: '14:00 - 15:00',
                startTime: '14:00',
                endTime: '15:00',
                message: `Hi ${recipientName}! I would like to connect and swap skills with you.`
            })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            btn.textContent = 'Request Sent';
            btn.classList.add('sent');
            btn.style.opacity = '0.75';
            btn.style.cursor = 'not-allowed';
            alert(`✨ Connection request sent to ${recipientName}!`);
        } else {
            alert(data.message || 'Could not send connection request.');
            btn.disabled = false;
            btn.textContent = 'Connect';
        }
    } catch (err) {
        console.error('Send connection request error:', err);
        alert('An error occurred while sending the request.');
        btn.disabled = false;
        btn.textContent = 'Connect';
    }
}
