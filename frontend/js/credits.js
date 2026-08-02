// Initialize Dark Mode theme from localStorage
(function() {
    if (localStorage.getItem("dark_theme") === "true") {
        document.body.classList.add("dark-theme");
    }
})();

let transactionsList = [];
let searchQuery = "";

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
    // 1. Sync User Header info and Fetch wallet details from db
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    const userRole = (user.role || '').toLowerCase();
    if (userRole === 'teacher') {
        window.location.href = 'teacher-dashboard.html#earningsSec';
        return;
    } else if (userRole === 'admin') {
        window.location.href = 'admin-teacher-applications.html';
        return;
    }

    if (user) {
        document.getElementById('headerUserName').textContent = user.firstName;
        document.getElementById('headerUserRole').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        renderUserHeaderAvatar(user);
        
        fetchWalletAndTransactions(user.id);
        initRealtimeWallet(user.id);
    }

    // 2. Bind search bar input listener
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            renderTransactions();
        });
    }

    // 3. Auto-update when tab gains focus or periodically every 5s
    window.addEventListener('focus', () => {
        if (user) fetchWalletAndTransactions(user.id);
    });

    setInterval(() => {
        if (user) fetchWalletAndTransactions(user.id);
    }, 5000);
});

// Fetch active profile metrics & transactions to keep wallet balances in sync with SQLite
async function fetchWalletAndTransactions(userId) {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = user ? (user.token || localStorage.getItem('token')) : null;

    try {
        const headers = {
            'X-User-Id': userId
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/profile/transactions', {
            method: 'GET',
            headers: headers
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Update balance indicators with real database values
            document.getElementById('walletBalance').textContent = Math.round(data.balance || 0);
            document.getElementById('earnedCredits').textContent = Math.round(data.totalEarned || 0);
            document.getElementById('spentCredits').textContent = Math.round(data.totalSpent || 0);

            // Update Learning Goal Progress card dynamically from DB data
            const goalLabel = document.getElementById('learningGoalLabel');
            const goalPercent = document.getElementById('learningGoalPercent');
            const goalFill = document.getElementById('learningGoalFill');
            const goalHint = document.getElementById('learningGoalHint');

            const completed = data.completedLearningHours || 0;
            const goal = data.targetLearningGoal || 0;
            const pct = data.learningProgressPct !== undefined ? data.learningProgressPct : 0;

            if (goalPercent) goalPercent.textContent = `${pct}%`;
            if (goalFill) goalFill.style.width = `${pct}%`;

            if (goal > 0) {
                if (goalPercent) goalPercent.textContent = `${pct}%`;
                if (goalFill) goalFill.style.width = `${pct}%`;
                if (goalLabel) goalLabel.textContent = `Learning Goal Progress (${completed}h / ${goal}h)`;
                if (goalHint) {
                    if (completed >= goal) {
                        goalHint.textContent = '🎉 Learning goal achieved and archived!';
                    } else {
                        goalHint.textContent = `Complete ${goal - completed} more hour(s) to reach your goal!`;
                    }
                }
            } else {
                if (goalPercent) goalPercent.textContent = '0%';
                if (goalFill) goalFill.style.width = '0%';
                if (goalLabel) goalLabel.textContent = 'Learning Goal Progress (0h / 0h)';
                if (goalHint) goalHint.textContent = 'No learning goal created yet.';
            }

            transactionsList = data.transactions || [];
            renderTransactions();
        } else {
            console.error('API Error fetching transactions:', data.message);
            showErrorState(data.message || "Failed to load transaction details from database.");
        }
    } catch (error) {
        console.error('Fetch wallet and transactions error:', error);
        showErrorState("Unable to connect to server. Please check your connection and try again.");
    }
}

// Render error message inside transaction log container
function showErrorState(message) {
    const tbody = document.getElementById("transactionLogBody");
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 2.5rem; color: #ef4444; font-weight: 500; background: rgba(239, 68, 68, 0.05);">
                ⚠️ ${message}
            </td>
        </tr>
    `;
}

// Connect Socket.IO for instant real-time SQLite updates
function initRealtimeWallet(userId) {
    if (typeof io !== 'undefined') {
        const socket = io();
        socket.emit('register', userId);
        socket.on('wallet_updated', () => {
            console.log("🔔 Real-time Notification: Wallet updated in SQLite!");
            fetchWalletAndTransactions(userId);
        });
    } else {
        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = () => {
            if (typeof io !== 'undefined') {
                const socket = io();
                socket.emit('register', userId);
                socket.on('wallet_updated', () => {
                    console.log("🔔 Real-time Notification: Wallet updated in SQLite!");
                    fetchWalletAndTransactions(userId);
                });
            }
        };
        document.head.appendChild(script);
    }
}

// Format session date & time for transaction history display
function formatTransactionDate(sessionDate, sessionTime, rawCreatedAt) {
    let datePart = "";
    if (sessionDate) {
        const parts = sessionDate.split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;
            const d = parseInt(parts[2]);
            const dObj = new Date(y, m, d);
            if (!isNaN(dObj.getTime())) {
                datePart = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }
        }
        if (!datePart) datePart = sessionDate;
    }

    if (datePart && sessionTime) {
        return `${datePart} (${sessionTime})`;
    } else if (datePart) {
        return datePart;
    }

    // Fallback using rawCreatedAt (SQLite timestamp: "YYYY-MM-DD HH:MM:SS" in IST)
    if (rawCreatedAt) {
        const isoStr = rawCreatedAt.includes('T') 
            ? rawCreatedAt 
            : rawCreatedAt.replace(' ', 'T');
        const dObj = new Date(isoStr);
        if (!isNaN(dObj.getTime())) {
            return dObj.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        return rawCreatedAt;
    }

    return 'N/A';
}

// Render Transaction table rows
function renderTransactions() {
    const tbody = document.getElementById("transactionLogBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    let filtered = transactionsList;
    if (searchQuery) {
        filtered = transactionsList.filter(tx => 
            (tx.partner && tx.partner.toLowerCase().includes(searchQuery)) ||
            (tx.skill && tx.skill.toLowerCase().includes(searchQuery)) ||
            (tx.type && tx.type.toLowerCase().includes(searchQuery))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-light); font-style: italic;">
                    ${searchQuery ? "No matching transactions found." : "No transactions recorded yet."}
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(tx => {
        const row = document.createElement("tr");

        const formattedDate = formatTransactionDate(tx.sessionDate, tx.sessionTime, tx.date);

        const typeLabel = tx.type === "earned" ? "🟢 Earned" : "🔴 Spent";
        const typeClass = tx.type === "earned" ? "type-cell earned" : "type-cell spent";

        const amountText = tx.amount > 0 ? `+${tx.amount}` : `${tx.amount}`;
        const amountClass = tx.amount > 0 ? "amount-val plus" : "amount-val minus";

        const displaySkill = (tx.skill && tx.skill !== 'undefined') ? tx.skill : 'N/A';

        row.innerHTML = `
            <td>
                <span class="${typeClass}">
                    ${typeLabel}
                </span>
            </td>
            <td>${tx.partner || 'N/A'}</td>
            <td>${displaySkill}</td>
            <td>${formattedDate}</td>
            <td>
                <span class="${amountClass}">
                    ${amountText}
                </span>
            </td>
        `;

        tbody.appendChild(row);
    });
}
