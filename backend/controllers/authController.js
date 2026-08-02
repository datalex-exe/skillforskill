const bcrypt = require('bcryptjs');
const { dbQuery } = require('../config/db');

// Salt rounds for bcrypt
const SALT_ROUNDS = 10;

// Register Controller
exports.register = async (req, res) => {
    try {
        const { firstName, lastName, email, username, password, confirmPassword, role } = req.body;

        // 1. Validate required fields
        if (!firstName || !lastName || !email || !username || !password || !confirmPassword || !role) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        // 2. Validate passwords match
        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });
        }

        // 3. Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        }

        // 4. Check for duplicate email
        const existingEmail = await dbQuery.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingEmail) {
            return res.status(409).json({ success: false, message: 'Email is already registered.' });
        }

        // 5. Check for duplicate username
        const existingUsername = await dbQuery.get('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsername) {
            return res.status(409).json({ success: false, message: 'Username is already taken.' });
        }

        // 6. Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // 7. Save user to database
        await dbQuery.run(
            `INSERT INTO users (first_name, last_name, email, username, role, password) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [firstName, lastName, email, username, role, hashedPassword]
        );

        return res.status(201).json({
            success: true,
            message: 'Account created successfully! Welcome to BarterLearn.'
        });

    } catch (error) {
        console.error('❌ Registration Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Login Controller
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validate fields
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        // 2. Find user by email
        const user = await dbQuery.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // 3. Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // 4. Return success response (redirection will be handled by frontend)
        return res.status(200).json({
            success: true,
            message: 'Login successful! Welcome back.',
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                username: user.username,
                role: user.role,
                avatar: user.avatar || '',
                theme: user.theme || 'light',
                isPremium: Boolean(user.is_premium)
            }
        });

    } catch (error) {
        console.error('❌ Login Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};
