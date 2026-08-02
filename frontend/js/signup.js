// Initialize Dark Mode theme from localStorage
(function() {
    if (localStorage.getItem("dark_theme") === "true") {
        document.body.classList.add("dark-theme");
    }
})();

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const btn = event.currentTarget;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

async function handleSignup(e) {
    e.preventDefault();

    // 1. Get input values
    const firstName = document.getElementById('firstNameInput').value.trim();
    const lastName = document.getElementById('lastNameInput').value.trim();
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;
    const username = document.getElementById('usernameInput').value.trim();
    const role = document.getElementById('roleSelect').value;

    // 2. Client-side check
    if (password !== confirmPassword) {
        alert('Passwords do not match.');
        return;
    }

    // 3. Disable submit button & show loading state
    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>Creating account...</span>';
    btn.disabled = true;

    try {
        // 4. Send request to backend
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstName,
                lastName,
                email,
                username,
                password,
                confirmPassword,
                role
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Ensure no credentials or prefill data are stored in browser storage
            localStorage.removeItem('registeredEmail');
            localStorage.removeItem('savedEmail');
            sessionStorage.clear();

            alert(data.message || 'Account created successfully! Welcome to BarterLearn.');
            // Redirect to login page
            window.location.href = 'login.html';
        } else {
            alert(data.message || 'Registration failed. Please try again.');
        }

    } catch (error) {
        console.error('Registration Fetch Error:', error);
        alert('Could not connect to the server. Please check your connection.');
    } finally {
        // 5. Restore submit button
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function handleGoogleSignup() {
    alert('Google signup would open OAuth popup here.');
}
