// Initialize Dark Mode theme from localStorage
(function () {
    if (localStorage.getItem("dark_theme") === "true") {
        document.body.classList.add("dark-theme");
    }
})();

let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Sync User info
    currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        alert("You must be logged in to view the Premium upgrade page.");
        window.location.href = "login.html";
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

    // Populate header User Metadata
    document.getElementById('headerUserName').textContent = `${currentUser.firstName} ${currentUser.lastName || ''}`.trim();
    document.getElementById('headerUserRole').textContent = (currentUser.role || 'Learner').toUpperCase();
    document.getElementById('headerUserAvatar').textContent = ((currentUser.firstName ? currentUser.firstName.charAt(0) : 'U') + (currentUser.lastName ? currentUser.lastName.charAt(0) : '')).toUpperCase();

    // 2. Fetch live daily call usage & payment request status
    await fetchPlanAndUsageStatus();
    await checkPaymentRequestStatus();
});

// Format seconds into readable string e.g. "1h 45m"
function formatTimeHoursMins(totalSec) {
    if (isNaN(totalSec) || totalSec < 0) return "0m";
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (hrs > 0) {
        return `${hrs}h ${mins < 10 ? '0' : ''}${mins}m`;
    }
    return `${mins}m`;
}

// Fetch Plan and Usage Status
async function fetchPlanAndUsageStatus() {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/profile/daily-call-usage', {
            headers: { 'X-User-Id': currentUser.id }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            renderPlanState(data);
        }
    } catch (err) {
        console.error("Error loading plan status:", err);
    }
}

// Fetch Payment Request Status from Backend
async function checkPaymentRequestStatus() {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/profile/payment-status', {
            headers: { 'X-User-Id': currentUser.id }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            if (data.isPremium) {
                currentUser.isPremium = true;
                localStorage.setItem("user", JSON.stringify(currentUser));
            }
            applyPaymentStatusUI(data);
        }
    } catch (err) {
        console.error("Error checking payment status:", err);
    }
}

// Render UI based on Plan status
function renderPlanState(data) {
    const badgeEl = document.getElementById("currentPlanBadge");
    const limitTextEl = document.getElementById("planLimitText");
    const usedTextEl = document.getElementById("planUsedTimeText");
    const percentTextEl = document.getElementById("meterPercentText");
    const meterFillEl = document.getElementById("meterBarFill");
    const btnPay = document.getElementById("btnPayUpgrade");

    if (data.isPremium || currentUser.isPremium) {
        if (badgeEl) {
            badgeEl.textContent = "PREMIUM MEMBER (PRO)";
            badgeEl.className = "plan-badge-pill pro";
        }
        if (limitTextEl) limitTextEl.textContent = "Unlimited Calls ♾️";
        if (usedTextEl) usedTextEl.textContent = `${formatTimeHoursMins(data.secondsUsed)} (No Limit)`;
        if (percentTextEl) percentTextEl.textContent = "Unlimited Access";
        if (meterFillEl) meterFillEl.style.width = "100%";
        if (btnPay) {
            btnPay.textContent = "✔️ Premium Unlocked";
            btnPay.style.background = "#10b981";
            btnPay.disabled = true;
            btnPay.style.cursor = "default";
        }
    } else {
        if (badgeEl) {
            badgeEl.textContent = "FREE PLAN";
            badgeEl.className = "plan-badge-pill";
        }
        if (limitTextEl) limitTextEl.textContent = "3 Hours / Day";
        
        const formattedUsed = formatTimeHoursMins(data.secondsUsed);
        if (usedTextEl) usedTextEl.textContent = `${formattedUsed} / 3h 00m`;

        const pct = Math.min(100, Math.round((data.secondsUsed / data.maxSeconds) * 100));
        if (percentTextEl) percentTextEl.textContent = `${pct}% Used Today`;
        if (meterFillEl) meterFillEl.style.width = `${pct}%`;
    }
}

// Apply Payment Status UI Banner & Button State
function applyPaymentStatusUI(statusData) {
    const banner = document.getElementById("pendingStatusBanner");
    const btnPay = document.getElementById("btnPayUpgrade");
    const utrInput = document.getElementById("utrInput");

    if (statusData.isPremium) {
        if (banner) banner.style.display = "none";
        if (btnPay) {
            btnPay.textContent = "✔️ Premium Unlocked";
            btnPay.style.background = "#10b981";
            btnPay.disabled = true;
        }
        return;
    }

    if (statusData.paymentStatus === "Pending Verification") {
        if (banner) banner.style.display = "block";
        if (btnPay) {
            btnPay.textContent = "⏳ Payment Under Verification";
            btnPay.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
            btnPay.disabled = false;
        }
        if (utrInput && statusData.request && statusData.request.transaction_ref) {
            utrInput.value = statusData.request.transaction_ref;
        }
    } else if (statusData.paymentStatus === "Rejected") {
        if (banner) {
            banner.style.display = "block";
            banner.style.background = "rgba(239, 68, 68, 0.15)";
            banner.style.borderColor = "rgba(239, 68, 68, 0.4)";
            banner.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.5rem; color:#ef4444; font-weight:800; font-size:0.95rem; margin-bottom:0.3rem;">
                    <span>❌</span> <span>Status: Payment Verification Rejected</span>
                </div>
                <p style="font-size:0.83rem; color:#cbd5e1; margin:0; line-height:1.5;">
                    Your previous payment request could not be verified by Admin. Please check your transaction details and submit again.
                </p>
            `;
        }
        if (btnPay) {
            btnPay.textContent = "✅ Submit Payment Again";
            btnPay.style.background = "linear-gradient(135deg, #6366f1, #8b5cf6)";
            btnPay.disabled = false;
        }
    }
}

// Copy UPI ID to clipboard
function copyUpiId() {
    const upiText = document.getElementById("upiIdText").textContent;
    navigator.clipboard.writeText(upiText)
        .then(() => {
            alert("📋 UPI ID 'barterlearn@upi' copied to clipboard!");
        })
        .catch(err => {
            console.error("Copy error:", err);
            alert("UPI ID: " + upiText);
        });
}

// Submit Payment for Admin Verification ("I Have Paid")
async function submitPaymentForVerification() {
    if (!currentUser) return;

    const utrVal = document.getElementById("utrInput").value.trim();
    const btnPay = document.getElementById("btnPayUpgrade");
    const originalText = btnPay.textContent;

    if (!confirm("Confirm submitting payment request to Admin for verification?\n\nNote: Your account will be upgraded to Premium after the admin verifies your payment.")) {
        return;
    }

    try {
        btnPay.disabled = true;
        btnPay.textContent = "⏳ Submitting Request...";

        const response = await fetch('/api/profile/submit-payment-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': currentUser.id
            },
            body: JSON.stringify({
                transactionRef: utrVal
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message);
            await checkPaymentRequestStatus();
        } else {
            alert(data.message || "Failed to submit payment request.");
            btnPay.disabled = false;
            btnPay.textContent = originalText;
        }
    } catch (err) {
        console.error("Payment submission error:", err);
        alert("Server error submitting payment request. Please try again.");
        btnPay.disabled = false;
        btnPay.textContent = originalText;
    }
}

// Select Subscription Pricing Plan & Scroll to Payment QR Section
function selectPricingPlan(planName, price) {
    const paymentCard = document.querySelector(".payment-card");
    if (paymentCard) {
        paymentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight payment section visually
        paymentCard.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease';
        paymentCard.style.borderColor = '#fbbf24';
        paymentCard.style.boxShadow = '0 0 35px rgba(251, 191, 36, 0.7)';

        setTimeout(() => {
            paymentCard.style.borderColor = 'rgba(99, 102, 241, 0.3)';
            paymentCard.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
        }, 2200);
    }
}
