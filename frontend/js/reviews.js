// Initialize Dark Mode theme from localStorage
(function() {
    if (localStorage.getItem("dark_theme") === "true") {
        document.body.classList.add("dark-theme");
    }
})();

// Mock peer reviews list (loaded from localStorage for persistence)
let mockReviews = [];
try {
    const stored = localStorage.getItem("user_reviews");
    mockReviews = stored ? JSON.parse(stored) : [];
} catch (e) {
    mockReviews = [];
}

let currentUser = null;

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
    currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    const userRole = (currentUser.role || '').toLowerCase();
    if (userRole === 'teacher') {
        window.location.href = 'teacher-dashboard.html';
        return;
    } else if (userRole === 'admin') {
        window.location.href = 'admin-teacher-applications.html';
        return;
    }

    if (currentUser) {
        document.getElementById('headerUserName').textContent = currentUser.firstName;
        document.getElementById('headerUserRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
        renderUserHeaderAvatar(currentUser);
    }
        
    // Load barter partners from database search
    fetchBarterPartners();

    // 2. Setup interactive stars
    setupStars();

    // 3. Render reviews
    renderReviews();
});

// Setup star click listeners
function setupStars() {
    const stars = document.querySelectorAll(".star-interactive");
    const hiddenInput = document.getElementById("ratingInput");

    // Initialize all stars to gold (default 5 stars)
    updateStars(5);

    stars.forEach(star => {
        star.addEventListener("click", () => {
            const val = parseInt(star.getAttribute("data-val"));
            hiddenInput.value = val;
            updateStars(val);
        });
    });
}

function updateStars(rating) {
    const stars = document.querySelectorAll(".star-interactive");
    stars.forEach(s => {
        const val = parseInt(s.getAttribute("data-val"));
        if (val <= rating) {
            s.classList.add("gold");
        } else {
            s.classList.remove("gold");
        }
    });
}

// Update overall ratings card metrics dynamically based on current reviews
function updateScoreCard() {
    const total = mockReviews.length;
    const ratingBig = document.getElementById("ratingBig");
    const ratingStars = document.getElementById("ratingStars");
    const totalReviewsCount = document.getElementById("totalReviewsCount");
    
    const bar5Star = document.getElementById("bar5Star");
    const label5Star = document.getElementById("label5Star");
    const bar4Star = document.getElementById("bar4Star");
    const label4Star = document.getElementById("label4Star");
    const bar3Star = document.getElementById("bar3Star");
    const label3Star = document.getElementById("label3Star");

    if (total === 0) {
        if (ratingBig) ratingBig.textContent = "0.0";
        if (ratingStars) ratingStars.textContent = "☆☆☆☆☆";
        if (totalReviewsCount) totalReviewsCount.textContent = "Based on 0 reviews";
        
        if (bar5Star) bar5Star.style.width = "0%";
        if (label5Star) label5Star.textContent = "0%";
        if (bar4Star) bar4Star.style.width = "0%";
        if (label4Star) label4Star.textContent = "0%";
        if (bar3Star) bar3Star.style.width = "0%";
        if (label3Star) label3Star.textContent = "0%";
        return;
    }

    let sum = 0;
    let counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    mockReviews.forEach(r => {
        sum += r.rating;
        if (counts[r.rating] !== undefined) {
            counts[r.rating]++;
        }
    });

    const avg = (sum / total).toFixed(1);
    const avgStars = "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg));

    if (ratingBig) ratingBig.textContent = avg;
    if (ratingStars) ratingStars.textContent = avgStars;
    if (totalReviewsCount) totalReviewsCount.textContent = `Based on ${total} review${total > 1 ? 's' : ''}`;

    const pct5 = Math.round((counts[5] / total) * 100);
    const pct4 = Math.round((counts[4] / total) * 100);
    const pct3 = Math.round((counts[3] / total) * 100);

    if (bar5Star) bar5Star.style.width = `${pct5}%`;
    if (label5Star) label5Star.textContent = `${pct5}%`;
    if (bar4Star) bar4Star.style.width = `${pct4}%`;
    if (label4Star) label4Star.textContent = `${pct4}%`;
    if (bar3Star) bar3Star.style.width = `${pct3}%`;
    if (label3Star) label3Star.textContent = `${pct3}%`;
}

// Render reviews feed
function renderReviews() {
    const list = document.getElementById("reviewsFeedList");
    list.innerHTML = "";

    // Always update overall score metrics when rendering
    updateScoreCard();

    if (mockReviews.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-light); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius)">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">⭐</div>
                <h3>No reviews received yet.</h3>
                <p style="font-size: 0.85rem; margin-top: 0.2rem;">Reviews from your barter partners will show up here.</p>
            </div>
        `;
        return;
    }

    mockReviews.forEach(rev => {
        const item = document.createElement("div");
        item.className = "review-feed-item";

        // Date options
        const dateObj = new Date(rev.date);
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        const formattedDate = dateObj.toLocaleDateString('en-US', options);

        // Generate stars string
        const starsStr = "★".repeat(rev.rating) + "☆".repeat(5 - rev.rating);

        item.innerHTML = `
            <div class="review-item-header">
                <div class="review-user-info">
                    <img src="${rev.avatar}" alt="${rev.name}">
                    <div>
                        <h4>${rev.name}</h4>
                        <p>Traded on ${formattedDate}</p>
                    </div>
                </div>
                <div class="review-rating-stars">${starsStr}</div>
            </div>
            <div class="review-comment">"${rev.comment}"</div>
            <div class="review-badges-row">
                ${rev.badges.map(b => `<span class="badge-tag">${b}</span>`).join("")}
            </div>
        `;

        list.appendChild(item);
    });
}

// Submit Review Form
function submitReview(e) {
    e.preventDefault();

    const partnerSelect = document.getElementById("partnerSelect");
    const ratingInput = document.getElementById("ratingInput");

    const partnerName = partnerSelect.value;
    const rating = parseInt(ratingInput.value);
    const comment = ""; // Written feedback text area removed

    // Find avatar matching partner
    let avatar = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80"; // default
    if (partnerName === "Sarah Jenkins") {
        avatar = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80";
    } else if (partnerName === "Emily Chen") {
        avatar = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&h=120&q=80";
    }

    const newReview = {
        id: Date.now(),
        name: partnerName,
        avatar: avatar,
        rating: rating,
        date: new Date().toISOString().split('T')[0], // today
        comment: comment,
        badges: ["Swapped Partner"]
    };

    mockReviews.unshift(newReview);
    localStorage.setItem("user_reviews", JSON.stringify(mockReviews));
    renderReviews();

    // Reset Form
    partnerSelect.selectedIndex = 0;
    ratingInput.value = 5;
    updateStars(5);

    alert(`Feedback submitted successfully! Thanks for reviewing ${partnerName}.`);
}

// Fetch barter partners from backend (only those with whom a session has started/accepted or completed)
async function fetchBarterPartners() {
    const partnerSelect = document.getElementById("partnerSelect");
    if (!partnerSelect) return;

    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;

    try {
        const response = await fetch('/api/profile/session-requests', {
            method: 'GET',
            headers: {
                'X-User-Id': currentUser.id
            }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            const sessions = data.requests;
            
            // Filter sessions that are accepted (started/scheduled) or completed
            const activePartners = sessions
                .filter(s => s.status === 'accepted' || s.status === 'completed')
                .map(s => s.recipientId == currentUser.id ? s.senderName : s.recipientName);
                
            // Get unique names
            const uniquePartners = [...new Set(activePartners)];

            partnerSelect.innerHTML = '<option value="" disabled selected>Choose partner...</option>';
            if (uniquePartners.length > 0) {
                uniquePartners.forEach(name => {
                    partnerSelect.innerHTML += `<option value="${name}">${name}</option>`;
                });
            } else {
                partnerSelect.innerHTML += '<option value="" disabled>No eligible partners found</option>';
            }
        }
    } catch (e) {
        console.error("Error fetching barter partners:", e);
    }
}
