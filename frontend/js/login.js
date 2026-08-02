// Initialize Dark Mode theme & ensure form fields are cleared on page load
(function() {
    if (localStorage.getItem("dark_theme") === "true") {
        document.body.classList.add("dark-theme");
    }
})();

// Always initialize login page with empty email & password fields and clear credential prefill storage
document.addEventListener("DOMContentLoaded", function() {
    // Clear any stored prefill credential keys
    localStorage.removeItem("registeredEmail");
    localStorage.removeItem("savedEmail");
    sessionStorage.clear();

    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("emailInput");
    const passwordInput = document.getElementById("passwordInput");

    const setupInputNoAutofill = (input) => {
        if (!input) return;
        input.value = "";
        input.setAttribute("readonly", "readonly");
        
        const unlockInput = () => {
            input.removeAttribute("readonly");
        };

        input.addEventListener("focus", unlockInput);
        input.addEventListener("mousedown", unlockInput);
        input.addEventListener("touchstart", unlockInput);
        input.addEventListener("keydown", unlockInput);
    };

    setupInputNoAutofill(emailInput);
    setupInputNoAutofill(passwordInput);

    if (loginForm) loginForm.reset();
});

function togglePassword() {
    const input = document.getElementById('passwordInput');
    const btn = event.currentTarget;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

async function handleLogin(e) {
    e.preventDefault();

    // 1. Get input values
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;

    // 2. Disable submit button & show loading state
    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>Logging in...</span>';
    btn.disabled = true;

    try {
        // 3. Send request to backend
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Save user details to localStorage
            localStorage.setItem('user', JSON.stringify(data.user));

            // Sync user theme preference instantly on login
            const isDark = data.user && data.user.theme === 'dark';
            localStorage.setItem('dark_theme', isDark ? 'true' : 'false');
            if (isDark) {
                document.body.classList.add('dark-theme');
                document.documentElement.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
                document.documentElement.classList.remove('dark-theme');
            }

            alert('Login successful! Redirecting to dashboard...');
            // Redirect based on user role
            const userRole = (data.user && data.user.role) ? data.user.role.toLowerCase() : '';
            if (userRole === 'teacher') {
                window.location.href = 'teacher-dashboard.html';
            } else if (userRole === 'admin') {
                window.location.href = 'admin-teacher-applications.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        } else {
            alert(data.message || 'Login failed. Please check your credentials.');
        }

    } catch (error) {
        console.error('Login Fetch Error:', error);
        alert('Could not connect to the server. Please check your connection.');
    } finally {
        // 4. Restore submit button
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function handleGoogleLogin() {
    alert('Google login would open OAuth popup here.');
}
