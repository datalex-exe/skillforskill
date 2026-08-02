// Teacher Withdraw Earnings Logic
let currentUser = null;
let currentBalance = 0;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
        currentUser = null;
    }

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    const userRole = (currentUser.role || '').toLowerCase();
    if (userRole === 'admin') {
        window.location.href = 'admin-teacher-applications.html';
        return;
    } else if (userRole !== 'teacher' && userRole !== 'both') {
        alert('Access Denied: Only verified teachers can access the Payout Withdrawal page.');
        window.location.href = 'dashboard.html';
        return;
    }

    renderRoleBasedNavigation('withdraw');

    // Set header user info
    if (document.getElementById('headerUserName')) {
        document.getElementById('headerUserName').textContent = currentUser.firstName;
    }
    renderUserHeaderAvatar(currentUser);

    // Fetch withdrawals data
    await fetchWithdrawals();
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
    }
}

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

// Fetch Teacher Withdrawals Data
async function fetchWithdrawals() {
    try {
        const response = await fetch('/api/profile/withdrawals', {
            method: 'GET',
            headers: { 'X-User-Id': currentUser.id }
        });
        const data = await response.json();

        if (response.ok && data.success) {
            currentBalance = data.availableBalance !== undefined ? data.availableBalance : 0;
            if (document.getElementById('availableBalanceDisplay')) {
                document.getElementById('availableBalanceDisplay').textContent = `${currentBalance} Credits`;
            }

            renderPendingRequests(data.pendingRequests || []);
            renderWithdrawalHistory(data.history || []);
        } else {
            console.warn('Failed to load withdrawals data:', data.message);
        }
    } catch (err) {
        console.error('Error fetching withdrawals data:', err);
    }
}

// Fill input with max available balance
function useMaxBalance() {
    if (document.getElementById('withdrawAmountInput')) {
        document.getElementById('withdrawAmountInput').value = currentBalance > 0 ? currentBalance : 0;
    }
}

// Render Pending Requests List
function renderPendingRequests(pendingRequests) {
    const container = document.getElementById('pendingWithdrawalsList');
    if (!container) return;
    container.innerHTML = '';

    if (pendingRequests.length === 0) {
        container.innerHTML = `<div class="empty-notice">No pending payout requests.</div>`;
        return;
    }

    pendingRequests.forEach(req => {
        const card = document.createElement('div');
        card.className = 'pending-item-card';
        card.innerHTML = `
            <div class="pending-info">
                <h4>${req.amount} Credit(s) via ${req.payment_method}</h4>
                <p>Destination: <strong>${req.payout_details}</strong></p>
                <p style="font-size:0.72rem; opacity:0.8; margin-top:0.1rem;">Submitted on ${req.created_at ? req.created_at.split(' ')[0] : 'Today'}</p>
            </div>
            <span class="badge-pending">⏳ Pending Approval</span>
        `;
        container.appendChild(card);
    });
}

// Render Withdrawal History Table
function renderWithdrawalHistory(history) {
    const tbody = document.getElementById('withdrawalHistoryTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-notice">No past withdrawal history found.</td></tr>`;
        return;
    }

    history.forEach(req => {
        const tr = document.createElement('tr');
        const isApproved = req.status === 'approved';
        const badgeColor = isApproved ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
        const textColor = isApproved ? '#059669' : '#DC2626';

        tr.innerHTML = `
            <td>${req.created_at ? req.created_at.split(' ')[0] : 'Recent'}</td>
            <td style="font-weight:800; color:var(--text);">${req.amount} Credits</td>
            <td>${req.payment_method}</td>
            <td><span class="role-badge" style="background:${badgeColor}; color:${textColor}; font-weight:700;">${req.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Handle Payout Form Submission
async function handleWithdrawSubmit(event) {
    event.preventDefault();

    const amount = parseFloat(document.getElementById('withdrawAmountInput').value);
    const paymentMethod = document.getElementById('withdrawMethodSelect').value;
    const payoutDetails = document.getElementById('withdrawDetailsInput').value.trim();

    if (!amount || amount <= 0) {
        alert('Please enter a valid positive withdrawal credit amount.');
        return;
    }

    if (amount > currentBalance) {
        alert(`Requested amount (${amount} Credits) exceeds your available balance (${currentBalance} Credits).`);
        return;
    }

    if (!payoutDetails) {
        alert('Please provide your payout destination details (UPI ID or Bank Account info).');
        return;
    }

    const btn = document.getElementById('btnSubmitPayout');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ Submitting Payout Request...</span>`;

    try {
        const response = await fetch('/api/profile/withdraw-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser.id
            },
            body: JSON.stringify({ amount, paymentMethod, payoutDetails })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            alert(`Payout request submitted successfully!\n\nAmount: ${amount} Credits\nMethod: ${paymentMethod}\nDetails: ${payoutDetails}\n\nYour request has been recorded for payout processing.`);
            document.getElementById('withdrawForm').reset();
            await fetchWithdrawals();
        } else {
            alert(data.message || 'Failed to submit payout request.');
        }
    } catch (err) {
        console.error('Error submitting withdrawal request:', err);
        alert('Server connection error. Please try again.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
