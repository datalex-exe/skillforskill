/**
 * BarterLearn Central Top Navigation Bar Controller (navbar.js)
 * Manages real-time Search, Notification Bell dropdown & database notifications,
 * Messages icon navigation, and Profile Avatar dropdown.
 */

(function () {
    let activeDropdown = null;
    let searchDebounceTimer = null;

    function getLoggedInUser() {
        try {
            const raw = localStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function formatRelativeTime(dateStr) {
        if (!dateStr) return 'Just now';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Recently';
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    function closeAllNavbarDropdowns() {
        const dropdowns = document.querySelectorAll('.navbar-floating-dropdown');
        dropdowns.forEach(el => el.remove());
        activeDropdown = null;
    }

    // ==========================================
    // 1. SEARCH BAR FUNCTIONALITY
    // ==========================================
    function initSearchBar() {
        const searchBars = document.querySelectorAll('.search-bar');
        searchBars.forEach(bar => {
            const input = bar.querySelector('input');
            const icon = bar.querySelector('.search-icon');

            if (!input) return;

            // Handle Keypress Enter or Icon Click
            const triggerSearchRedirect = () => {
                const query = input.value.trim();
                if (query) {
                    closeAllNavbarDropdowns();
                    window.location.href = `browse-people.html?search=${encodeURIComponent(query)}`;
                } else {
                    window.location.href = `browse-people.html`;
                }
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    triggerSearchRedirect();
                }
            });

            if (icon) {
                icon.style.cursor = 'pointer';
                icon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    triggerSearchRedirect();
                });
            }

            // Real-time live search dropdown
            input.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                clearTimeout(searchDebounceTimer);

                if (!query) {
                    closeAllNavbarDropdowns();
                    return;
                }

                searchDebounceTimer = setTimeout(() => {
                    performLiveSearch(bar, input, query);
                }, 200);
            });
        });
    }

    async function performLiveSearch(container, input, query) {
        const user = getLoggedInUser();
        const userId = user ? user.id : 0;

        try {
            const res = await fetch(`/api/profile/search?query=${encodeURIComponent(query)}`, {
                headers: { 'X-User-Id': userId }
            });
            const data = await res.json();

            if (!data.success) return;

            const existingDropdown = container.querySelector('.search-results-dropdown');
            if (existingDropdown) existingDropdown.remove();

            const dropdown = document.createElement('div');
            dropdown.className = 'navbar-floating-dropdown search-results-dropdown';

            // Base styling for search dropdown
            Object.assign(dropdown.style, {
                position: 'absolute',
                top: '110%',
                left: '0',
                right: '0',
                minWidth: '300px',
                background: 'var(--surface, #1E293B)',
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                borderRadius: '12px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                zIndex: '9999',
                maxHeight: '380px',
                overflowY: 'auto',
                padding: '0.5rem 0'
            });

            if (!data.profiles || data.profiles.length === 0) {
                dropdown.innerHTML = `
                    <div style="padding: 1rem; text-align: center; color: var(--text-muted, #94A3B8); font-size: 0.85rem;">
                        🔍 No matching users or skills found for "${escapeHtml(query)}"
                    </div>
                `;
            } else {
                let html = `<div style="padding: 0.4rem 0.8rem; font-size: 0.72rem; font-weight: 700; color: var(--text-muted, #94A3B8); text-transform: uppercase; letter-spacing: 0.05em;">Search Results (${data.profiles.length})</div>`;

                data.profiles.slice(0, 6).forEach(p => {
                    const initials = ((p.firstName ? p.firstName.charAt(0) : '') + (p.lastName ? p.lastName.charAt(0) : '')).toUpperCase() || 'U';
                    const avatarHtml = p.avatar 
                        ? `<img src="${p.avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">`
                        : `<div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#8B5CF6,#EC4899); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem;">${initials}</div>`;

                    const skills = (p.skillsTeach || []).concat(p.skillsLearn || []).slice(0, 3).join(', ');

                    html += `
                        <div class="search-result-item" data-query="${escapeHtml(p.firstName + ' ' + p.lastName)}" style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0.9rem; cursor:pointer; transition:background 0.15s ease;">
                            ${avatarHtml}
                            <div style="flex:1; overflow:hidden;">
                                <div style="font-weight:600; font-size:0.88rem; color:var(--text-light, #F8FAFC); display:flex; align-items:center; gap:0.4rem;">
                                    <span>${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</span>
                                    ${p.isPremium ? '<span style="background:linear-gradient(135deg,#f59e0b,#d97706); color:#000; font-size:0.6rem; font-weight:800; padding:0.1rem 0.35rem; border-radius:8px;">💎 PRO</span>' : ''}
                                </div>
                                <div style="font-size:0.75rem; color:var(--text-muted, #94A3B8); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                    ${skills ? 'Skills: ' + escapeHtml(skills) : escapeHtml(p.role || 'Member')}
                                </div>
                            </div>
                        </div>
                    `;
                });

                html += `
                    <div class="search-see-all" style="padding:0.6rem; text-align:center; font-weight:600; font-size:0.8rem; color:var(--accent-purple, #A855F7); border-top:1px solid var(--border, rgba(255,255,255,0.08)); cursor:pointer;">
                        See all results for "${escapeHtml(query)}" →
                    </div>
                `;

                dropdown.innerHTML = html;

                // Item click handlers
                dropdown.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('mouseover', () => item.style.background = 'rgba(255,255,255,0.06)');
                    item.addEventListener('mouseout', () => item.style.background = 'transparent');
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const itemQuery = item.getAttribute('data-query');
                        window.location.href = `browse-people.html?search=${encodeURIComponent(itemQuery)}`;
                    });
                });

                const seeAllBtn = dropdown.querySelector('.search-see-all');
                if (seeAllBtn) {
                    seeAllBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.location.href = `browse-people.html?search=${encodeURIComponent(query)}`;
                    });
                }
            }

            container.style.position = 'relative';
            container.appendChild(dropdown);
            activeDropdown = dropdown;

        } catch (err) {
            console.warn('Live search error:', err);
        }
    }

    // ==========================================
    // 2. NOTIFICATION (BELL) ICON FUNCTIONALITY
    // ==========================================
    async function initNotificationBell() {
        const user = getLoggedInUser();
        if (!user) return;

        const iconBtns = document.querySelectorAll('.top-actions .icon-btn');
        let bellBtn = null;
        let messagesBtn = null;

        iconBtns.forEach(btn => {
            const txt = btn.textContent.trim();
            if (txt.includes('🔔')) bellBtn = btn;
            if (txt.includes('💬')) messagesBtn = btn;
        });

        // 3. MESSAGES ICON FUNCTIONALITY
        if (messagesBtn) {
            messagesBtn.style.cursor = 'pointer';
            messagesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.href = 'messages.html';
            });
        }

        if (!bellBtn) return;

        // Fetch initial unread count
        try {
            const res = await fetch('/api/profile/notifications', {
                headers: { 'X-User-Id': user.id }
            });
            const data = await res.json();
            if (data.success && data.unreadCount > 0) {
                updateBellBadge(bellBtn, data.unreadCount);
            }
        } catch (e) {
            console.warn('Notification fetch error:', e);
        }

        bellBtn.style.cursor = 'pointer';
        bellBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (activeDropdown && activeDropdown.classList.contains('notifications-dropdown')) {
                closeAllNavbarDropdowns();
                return;
            }
            closeAllNavbarDropdowns();
            await openNotificationsPanel(bellBtn, user);
        });
    }

    function updateBellBadge(btn, count) {
        let badge = btn.querySelector('.icon-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'icon-badge';
                btn.appendChild(badge);
            }
            badge.textContent = count > 99 ? '99+' : count;
        } else if (badge) {
            badge.remove();
        }
    }

    async function openNotificationsPanel(bellBtn, user) {
        const dropdown = document.createElement('div');
        dropdown.className = 'navbar-floating-dropdown notifications-dropdown';

        Object.assign(dropdown.style, {
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: '0',
            width: '340px',
            background: 'var(--surface, #1E293B)',
            border: '1px solid var(--border, rgba(255,255,255,0.12))',
            borderRadius: '16px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            zIndex: '9999',
            overflow: 'hidden'
        });

        dropdown.innerHTML = `
            <div style="display:flex; align-items:center; justify-space-between; padding:0.9rem 1.1rem; border-bottom:1px solid var(--border, rgba(255,255,255,0.08));">
                <div style="font-weight:700; font-size:0.95rem; color:var(--text-light, #F8FAFC); display:flex; align-items:center; gap:0.4rem;">
                    <span>🔔 Notifications</span>
                </div>
                <button class="mark-all-read-btn" style="background:none; border:none; color:var(--accent-purple, #A855F7); font-size:0.75rem; font-weight:600; cursor:pointer;">
                    Mark all read
                </button>
            </div>
            <div class="notifications-list-feed" style="max-height:340px; overflow-y:auto; padding:0.4rem 0;">
                <div style="padding:1.5rem; text-align:center; color:var(--text-muted, #94A3B8); font-size:0.85rem;">
                    Loading notifications...
                </div>
            </div>
        `;

        const parent = bellBtn.parentElement || bellBtn;
        parent.style.position = 'relative';
        parent.appendChild(dropdown);
        activeDropdown = dropdown;

        // Fetch Notifications from DB
        try {
            const res = await fetch('/api/profile/notifications', {
                headers: { 'X-User-Id': user.id }
            });
            const data = await res.json();

            const feed = dropdown.querySelector('.notifications-list-feed');

            if (!data.success || !data.notifications || data.notifications.length === 0) {
                feed.innerHTML = `
                    <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted, #94A3B8); font-size: 0.85rem;">
                        <div style="font-size: 2rem; margin-bottom: 0.4rem;">🔕</div>
                        <p>No notifications yet!</p>
                    </div>
                `;
            } else {
                let html = '';
                data.notifications.forEach(n => {
                    const iconMap = {
                        request: '📅',
                        success: '✨',
                        info: 'ℹ️',
                        warning: '⚠️'
                    };
                    const typeIcon = iconMap[n.type] || '🔔';
                    const isUnread = !n.is_read;

                    html += `
                        <div class="notification-item" data-link="${escapeHtml(n.link || '')}" style="display:flex; gap:0.75rem; padding:0.75rem 1rem; border-bottom:1px solid rgba(255,255,255,0.04); background:${isUnread ? 'rgba(168,85,247,0.08)' : 'transparent'}; cursor:pointer; transition:background 0.15s ease;">
                            <div style="font-size:1.2rem; flex-shrink:0; margin-top:2px;">${typeIcon}</div>
                            <div style="flex:1; overflow:hidden;">
                                <div style="font-weight:${isUnread ? '700' : '600'}; font-size:0.84rem; color:var(--text-light, #F8FAFC); margin-bottom:0.15rem;">
                                    ${escapeHtml(n.title)}
                                </div>
                                <div style="font-size:0.78rem; color:var(--text-muted, #94A3B8); line-height:1.3; margin-bottom:0.3rem;">
                                    ${escapeHtml(n.message)}
                                </div>
                                <div style="font-size:0.7rem; color:var(--accent-purple, #A855F7); font-weight:500;">
                                    ${formatRelativeTime(n.created_at)}
                                </div>
                            </div>
                            ${isUnread ? '<div style="width:8px; height:8px; border-radius:50%; background:#EC4899; flex-shrink:0; align-self:center;"></div>' : ''}
                        </div>
                    `;
                });

                feed.innerHTML = html;

                feed.querySelectorAll('.notification-item').forEach(item => {
                    item.addEventListener('mouseover', () => item.style.background = 'rgba(255,255,255,0.08)');
                    item.addEventListener('mouseout', () => item.style.background = item.querySelector('[style*="background:#EC4899"]') ? 'rgba(168,85,247,0.08)' : 'transparent');
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const link = item.getAttribute('data-link');
                        closeAllNavbarDropdowns();
                        if (link) window.location.href = link;
                    });
                });
            }

            // Mark read on open
            fetch('/api/profile/notifications/mark-read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id
                }
            }).then(() => {
                updateBellBadge(bellBtn, 0);
            }).catch(e => console.warn(e));

            // Mark all read button handler
            const markAllBtn = dropdown.querySelector('.mark-all-read-btn');
            if (markAllBtn) {
                markAllBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await fetch('/api/profile/notifications/mark-read', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-User-Id': user.id
                        }
                    });
                    updateBellBadge(bellBtn, 0);
                    dropdown.querySelectorAll('.notification-item').forEach(el => {
                        el.style.background = 'transparent';
                        const dot = el.querySelector('[style*="background:#EC4899"]');
                        if (dot) dot.remove();
                    });
                });
            }

        } catch (err) {
            console.warn('Error rendering notifications:', err);
        }
    }

    // ==========================================
    // 4. PROFILE AVATAR & USERNAME DROPDOWN
    // ==========================================
    function initProfileDropdown() {
        const userProfile = document.querySelector('.top-actions .user-profile') || document.querySelector('.user-profile');
        if (!userProfile) return;

        userProfile.style.cursor = 'pointer';

        userProfile.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activeDropdown && activeDropdown.classList.contains('profile-menu-dropdown')) {
                closeAllNavbarDropdowns();
                return;
            }
            closeAllNavbarDropdowns();
            openProfileMenu(userProfile);
        });
    }

    function openProfileMenu(container) {
        const user = getLoggedInUser() || { firstName: 'User', role: 'Learner' };
        const dropdown = document.createElement('div');
        dropdown.className = 'navbar-floating-dropdown profile-menu-dropdown';

        Object.assign(dropdown.style, {
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: '0',
            width: '220px',
            background: 'var(--surface, #1E293B)',
            border: '1px solid var(--border, rgba(255,255,255,0.12))',
            borderRadius: '14px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            zIndex: '9999',
            padding: '0.5rem 0',
            overflow: 'hidden'
        });

        dropdown.innerHTML = `
            <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-light, #F8FAFC);">
                    ${escapeHtml(user.firstName || 'User')} ${escapeHtml(user.lastName || '')}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted, #94A3B8); margin-top: 2px;">
                    ${escapeHtml(user.email || user.role || 'Member')}
                </div>
            </div>
            <div style="padding: 0.3rem 0;">
                <a href="profile.html" class="profile-menu-item" style="display:flex; align-items:center; gap:0.6rem; padding:0.6rem 1rem; text-decoration:none; color:var(--text-light, #F8FAFC); font-size:0.85rem; font-weight:500; transition:background 0.15s ease;">
                    <span>👤</span>
                    <span>My Profile</span>
                </a>
                <a href="settings.html" class="profile-menu-item" style="display:flex; align-items:center; gap:0.6rem; padding:0.6rem 1rem; text-decoration:none; color:var(--text-light, #F8FAFC); font-size:0.85rem; font-weight:500; transition:background 0.15s ease;">
                    <span>⚙️</span>
                    <span>Settings</span>
                </a>
                <div style="border-top:1px solid var(--border, rgba(255,255,255,0.08)); margin:0.3rem 0;"></div>
                <a href="#" class="profile-menu-item logout-btn" style="display:flex; align-items:center; gap:0.6rem; padding:0.6rem 1rem; text-decoration:none; color:#EF4444; font-size:0.85rem; font-weight:600; transition:background 0.15s ease;">
                    <span>🚪</span>
                    <span>Logout</span>
                </a>
            </div>
        `;

        container.style.position = 'relative';
        container.appendChild(dropdown);
        activeDropdown = dropdown;

        dropdown.querySelectorAll('.profile-menu-item').forEach(item => {
            item.addEventListener('mouseover', () => item.style.background = 'rgba(255,255,255,0.06)');
            item.addEventListener('mouseout', () => item.style.background = 'transparent');
        });

        const logoutBtn = dropdown.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                window.location.href = 'login.html';
            });
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (activeDropdown && !activeDropdown.contains(e.target)) {
            closeAllNavbarDropdowns();
        }
    });

    // Initialize when DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        initSearchBar();
        initNotificationBell();
        initProfileDropdown();
    });
})();
