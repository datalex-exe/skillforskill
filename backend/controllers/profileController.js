const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { dbQuery } = require('../config/db');

// Helper to calculate human-readable relative time string from ISO timestamp
function calculateRelativeTime(dateInput) {
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

// Middleware: Require Admin Role
exports.requireAdmin = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: User ID required in headers.' });
        }

        const user = await dbQuery.get('SELECT id, role FROM users WHERE id = ?', [userId]);
        if (!user || !user.role || user.role.toLowerCase() !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access Denied: Admin role required.' });
        }

        req.adminUser = user;
        next();
    } catch (error) {
        console.error('❌ Require Admin Middleware Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// Middleware: Require Teacher Role
exports.requireTeacher = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: User ID required in headers.' });
        }

        const user = await dbQuery.get('SELECT id, role FROM users WHERE id = ?', [userId]);
        if (!user || !user.role || user.role.toLowerCase() !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Access Denied: Teacher role required.' });
        }

        req.teacherUser = user;
        next();
    } catch (error) {
        console.error('❌ Require Teacher Middleware Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};


// Get Profile Controller
exports.getProfile = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Parse JSON fields or use defaults (ensuring they are arrays)
        let achievements = [];
        try {
            const parsed = user.achievements ? JSON.parse(user.achievements) : null;
            achievements = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            achievements = [];
        }

        let recentActivity = [];
        try {
            const parsed = user.recent_activity ? JSON.parse(user.recent_activity) : null;
            recentActivity = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            recentActivity = [];
        }

        const nowMs = Date.now();
        recentActivity = recentActivity.map((act, index) => {
            let actCreatedAt = act.createdAt || act.timestamp || act.date;
            if (!actCreatedAt || actCreatedAt === 'Just now') {
                const offsetHours = [0.133, 3, 48, 504, 720, 1000, 1500, 2000];
                const legacyMs = nowMs - ((offsetHours[index] || (index + 1) * 24) * 3600 * 1000);
                actCreatedAt = new Date(legacyMs).toISOString();
            }
            return {
                ...act,
                createdAt: actCreatedAt,
                time: calculateRelativeTime(actCreatedAt)
            };
        });

        // Calculate real unique students taught from completed sessions & transactions
        const uniqueStudentsRow = await dbQuery.get(
            `SELECT COUNT(DISTINCT learner_id) as cnt FROM session_completions WHERE teacher_id = ?`,
            [userId]
        );
        const uniqueTxStudentsRow = await dbQuery.get(
            `SELECT COUNT(DISTINCT partner_id) as cnt FROM transactions WHERE user_id = ? AND type = 'earned'`,
            [userId]
        );
        const realStudentsTaught = Math.max(
            uniqueStudentsRow ? uniqueStudentsRow.cnt : 0,
            uniqueTxStudentsRow ? uniqueTxStudentsRow.cnt : 0,
            user.skills_taught_count || 0
        );

        const realCreditsEarned = Math.round(user.credits_earned !== null && user.credits_earned !== undefined ? user.credits_earned : 0);

        return res.status(200).json({
            success: true,
            profile: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                email: user.email,
                role: user.role,
                bio: user.bio || '',
                avatar: user.avatar || '',
                skillsTeach: user.skills_teach || '',
                skillsLearn: user.skills_learn || '',
                creditsEarned: realCreditsEarned,
                skillsTaughtCount: realStudentsTaught,
                hoursLearned: user.hours_learned || 0,
                theme: user.theme || 'light',
                isPremium: Boolean(user.is_premium),
                achievements,
                recentActivity
            }
        });

    } catch (error) {
        console.error('❌ Get Profile Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Helper to save base64 avatar image to server storage and return relative URL
function saveAvatarFile(userId, base64Data) {
    if (!base64Data || typeof base64Data !== 'string') {
        throw new Error('Invalid image data provided.');
    }
    const matches = base64Data.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
    if (!matches) {
        throw new Error('Invalid image format. Only JPG, JPEG, PNG, and WEBP images are allowed.');
    }
    const ext = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
    const imageBuffer = Buffer.from(matches[2], 'base64');

    // Size limit check (5 MB)
    if (imageBuffer.length > 5 * 1024 * 1024) {
        throw new Error('Image file size exceeds the 5MB limit.');
    }

    const uploadsDir = path.join(__dirname, '..', 'uploads', 'profile-images');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Delete previous avatar file(s) for this user to save space and prevent stale images
    try {
        const files = fs.readdirSync(uploadsDir);
        files.forEach(file => {
            if (file.startsWith(`avatar-${userId}-`)) {
                try {
                    fs.unlinkSync(path.join(uploadsDir, file));
                } catch (e) {
                    console.warn('Could not remove previous avatar file:', e.message);
                }
            }
        });
    } catch (err) {
        console.warn('Error checking uploads directory for old avatar cleanup:', err.message);
    }

    const filename = `avatar-${userId}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, imageBuffer);

    return `/uploads/profile-images/${filename}`;
}

// Upload Profile Photo Controller
exports.uploadAvatar = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { avatar } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        if (!avatar) {
            return res.status(400).json({ success: false, message: 'Avatar image data is required.' });
        }

        const user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        let avatarUrl;
        try {
            avatarUrl = saveAvatarFile(userId, avatar);
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        // Save relative path URL to SQLite DB
        await dbQuery.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, userId]);

        return res.status(200).json({
            success: true,
            message: 'Profile photo updated successfully!',
            avatar: avatarUrl
        });

    } catch (error) {
        console.error('❌ Upload Avatar Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred while uploading profile photo.' });
    }
};

// Update Profile Controller
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { firstName, lastName, bio, avatar, role, skillsTeach, skillsLearn, theme, currentPassword, newPassword } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        // Fetch current user row for logs/activity
        const user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Allow theme-only updates if full profile form is not passed
        const updatedFirstName = firstName !== undefined ? firstName : user.first_name;
        const updatedLastName = lastName !== undefined ? lastName : user.last_name;
        const updatedRole = role !== undefined ? role : user.role;

        // Validate basic details if provided
        if (!updatedFirstName || !updatedLastName || !updatedRole) {
            return res.status(400).json({ success: false, message: 'First name, last name, and role are required.' });
        }

        // Validate and hash password update if requested
        let hashedPassword = user.password;
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ success: false, message: 'Current password is required to change password.' });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Incorrect current password.' });
            }
            hashedPassword = await bcrypt.hash(newPassword, 10);
        }

        // Preserve existing fields if they are not provided (e.g. when saving settings from settings tab)
        const updatedBio = bio !== undefined ? bio : (user.bio || '');
        let updatedAvatar = user.avatar || '';
        if (avatar && avatar.startsWith('data:image/')) {
            try {
                updatedAvatar = saveAvatarFile(userId, avatar);
            } catch (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
        } else if (avatar !== undefined) {
            updatedAvatar = avatar;
        }
        const updatedSkillsTeach = skillsTeach !== undefined ? skillsTeach : (user.skills_teach || '');
        const updatedSkillsLearn = skillsLearn !== undefined ? skillsLearn : (user.skills_learn || '');
        const updatedTheme = theme !== undefined ? theme : (user.theme || 'light');

        // Prepare new activity logs (ensuring it is an array)
        let recentActivity = [];
        try {
            const parsed = user.recent_activity ? JSON.parse(user.recent_activity) : null;
            recentActivity = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            recentActivity = [];
        }

        // Add update activity log at the top of timeline
        recentActivity.unshift({
            time: "Just now",
            icon: "⚙️",
            type: "update",
            text: "Updated profile details"
        });

        // Limit activity array size
        if (recentActivity.length > 8) {
            recentActivity = recentActivity.slice(0, 8);
        }

        // Run UPDATE SQL
        await dbQuery.run(
            `UPDATE users 
             SET first_name = ?, last_name = ?, bio = ?, avatar = ?, role = ?, skills_teach = ?, skills_learn = ?, recent_activity = ?, theme = ?, password = ?
             WHERE id = ?`,
            [updatedFirstName, updatedLastName, updatedBio, updatedAvatar, updatedRole, updatedSkillsTeach, updatedSkillsLearn, JSON.stringify(recentActivity), updatedTheme, hashedPassword, userId]
        );

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully!',
            user: {
                id: userId,
                firstName: updatedFirstName,
                lastName: updatedLastName,
                role: updatedRole,
                avatar: updatedAvatar,
                bio: updatedBio,
                theme: updatedTheme,
                isPremium: Boolean(user.is_premium)
            }
        });

    } catch (error) {
        console.error('❌ Update Profile Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Complete Session & Adjust Credits Controller
exports.completeSession = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { sessionId, sessionType, partnerName, skillName } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const sid = sessionId ? parseInt(sessionId) : null;
        if (!sid) {
            return res.status(400).json({ success: false, message: 'Valid sessionId is required.' });
        }

        // 1. Fetch Session from DB (or fallback to session_requests)
        let session = await dbQuery.get('SELECT * FROM sessions WHERE id = ? OR request_id = ?', [sid, sid]);
        let requestId = sid;
        let teacherId, learnerId, skill, sessionDate, sessionTime;

        if (session) {
            requestId = session.request_id || session.id;
            learnerId = session.sender_id;  // Sender is Learner
            teacherId = session.recipient_id; // Recipient is Teacher
            skill = session.skill;
            sessionDate = session.date;
            sessionTime = session.time;
        } else {
            const reqRow = await dbQuery.get('SELECT * FROM session_requests WHERE id = ?', [sid]);
            if (reqRow) {
                requestId = reqRow.id;
                learnerId = reqRow.sender_id;
                teacherId = reqRow.recipient_id;
                skill = reqRow.skill;
                sessionDate = reqRow.date;
                sessionTime = reqRow.time;
            } else {
                return res.status(404).json({ success: false, message: 'Session record not found.' });
            }
        }

        if ((!skill || skill === 'undefined') && skillName) {
            skill = skillName;
        }

        // 2. Check if completion record already exists in SQLite (Ensure single execution per session)
        const existingCompletion = await dbQuery.get('SELECT * FROM session_completions WHERE session_id = ?', [requestId]);
        if (existingCompletion || (session && session.status === 'completed')) {
            console.log(`⚠️ Session ${requestId} already completed previously. Skipping duplicate credit transfer.`);
            const callerUser = await dbQuery.get('SELECT credits_earned FROM users WHERE id = ?', [userId]);
            return res.status(200).json({
                success: true,
                alreadyCompleted: true,
                message: 'Session already completed previously.',
                creditsEarned: callerUser ? callerUser.credits_earned : 15
            });
        }

        // 3. Fetch Teacher and Learner user profiles
        const teacher = await dbQuery.get('SELECT * FROM users WHERE id = ?', [teacherId]);
        const learner = await dbQuery.get('SELECT * FROM users WHERE id = ?', [learnerId]);

        if (!teacher || !learner) {
            return res.status(404).json({ success: false, message: 'Teacher or Learner profile not found.' });
        }

        const teacherName = `${teacher.first_name} ${teacher.last_name}`;
        const learnerName = `${learner.first_name} ${learner.last_name}`;

        // Detect if session has an associated paid booking or teacher hourly fee rate
        const paidReq = await dbQuery.get(
            `SELECT * FROM payment_requests 
             WHERE user_id = ? AND transaction_ref LIKE '%PAID_SESSION%' AND transaction_ref LIKE ? 
             ORDER BY id DESC LIMIT 1`,
            [learnerId, `%TEACHER_${teacherId}%`]
        );

        let totalFee = 1;
        let isPaidSession = false;

        if (paidReq) {
            isPaidSession = true;
            const feeMatch = paidReq.transaction_ref ? paidReq.transaction_ref.match(/Fee:\s*([\d.]+)/) : null;
            if (feeMatch && feeMatch[1]) {
                totalFee = parseFloat(feeMatch[1]);
            }
        } else {
            const tApp = await dbQuery.get('SELECT hourly_fee FROM teacher_applications WHERE user_id = ? AND status = "approved"', [teacherId]);
            if (tApp && tApp.hourly_fee > 0) {
                totalFee = tApp.hourly_fee;
                isPaidSession = true;
            }
        }

        if (isPaidSession) {
            // PAID SESSION WORKFLOW (Preserves existing payment & 50/50 teacher earnings split)
            const teacherShare = totalFee * 0.5;
            const platformShare = totalFee * 0.5;

            // 4. Create Session Completion Record in SQLite
            await dbQuery.run(
                `INSERT INTO session_completions (session_id, teacher_id, learner_id, skill, credits_transferred)
                 VALUES (?, ?, ?, ?, ?)`,
                [requestId, teacherId, learnerId, skill, totalFee]
            );

            // 5. Update Teacher: +50% teacherShare credits
            let teacherActivity = [];
            try { teacherActivity = teacher.recent_activity ? JSON.parse(teacher.recent_activity) : []; } catch (e) { teacherActivity = []; }
            teacherActivity.unshift({
                time: "Just now",
                icon: "💰",
                type: "teach",
                text: `Taught "${skill}" to ${learnerName} (+${teacherShare} Credits, 50% Teacher Share)`
            });
            if (teacherActivity.length > 8) teacherActivity = teacherActivity.slice(0, 8);

            await dbQuery.run(
                `UPDATE users 
                 SET credits_earned = credits_earned + ?, skills_taught_count = skills_taught_count + 1, recent_activity = ?
                 WHERE id = ?`,
                [teacherShare, JSON.stringify(teacherActivity), teacherId]
            );

            // 6. Update Learner: -totalFee credits
            let learnerActivity = [];
            try { learnerActivity = learner.recent_activity ? JSON.parse(learner.recent_activity) : []; } catch (e) { learnerActivity = []; }
            learnerActivity.unshift({
                time: "Just now",
                icon: "✅",
                type: "session",
                text: `Completed "${skill}" with ${teacherName} (-${totalFee} Credits)`
            });
            if (learnerActivity.length > 8) learnerActivity = learnerActivity.slice(0, 8);

            await dbQuery.run(
                `UPDATE users 
                 SET credits_earned = credits_earned - ?, hours_learned = hours_learned + 1, recent_activity = ?
                 WHERE id = ?`,
                [totalFee, JSON.stringify(learnerActivity), learnerId]
            );

            // 7. Save Transactions in SQLite for Paid Session
            await dbQuery.run(
                `INSERT INTO transactions (user_id, partner_id, partner_name, session_id, type, amount, skill, session_date, session_time)
                 VALUES (?, ?, ?, ?, 'earned', ?, ?, ?, ?)`,
                [teacherId, learnerId, learnerName, requestId, teacherShare, `${skill} (50% Teacher Share)`, sessionDate, sessionTime]
            );

            await dbQuery.run(
                `INSERT INTO transactions (user_id, partner_id, partner_name, session_id, type, amount, skill, session_date, session_time)
                 VALUES (0, ?, ?, ?, 'platform_fee_share', ?, ?, ?, ?)`,
                [teacherId, teacherName, requestId, platformShare, `${skill} (50% Platform Fee Share)`, sessionDate, sessionTime]
            );

            await dbQuery.run(
                `INSERT INTO transactions (user_id, partner_id, partner_name, session_id, type, amount, skill, session_date, session_time)
                 VALUES (?, ?, ?, ?, 'spent', ?, ?, ?, ?)`,
                [learnerId, teacherId, teacherName, requestId, -totalFee, skill, sessionDate, sessionTime]
            );

            console.log(`💵 Paid Session ${requestId} completed! Total Fee: ${totalFee} Credits (Teacher +${teacherShare}, Platform +${platformShare})`);
        } else {
            // FREE BARTER SESSION WORKFLOW (Strictly +1 for Teacher, -1 for Learner)
            const creditAmount = 1;

            // 4. Create Session Completion Record in SQLite
            await dbQuery.run(
                `INSERT INTO session_completions (session_id, teacher_id, learner_id, skill, credits_transferred)
                 VALUES (?, ?, ?, ?, ?)`,
                [requestId, teacherId, learnerId, skill, creditAmount]
            );

            // 5. Update Teacher: +1 Time Credit
            let teacherActivity = [];
            try { teacherActivity = teacher.recent_activity ? JSON.parse(teacher.recent_activity) : []; } catch (e) { teacherActivity = []; }
            teacherActivity.unshift({
                time: "Just now",
                icon: "💰",
                type: "teach",
                text: `Taught "${skill}" to ${learnerName} (+1 Credit)`
            });
            if (teacherActivity.length > 8) teacherActivity = teacherActivity.slice(0, 8);

            await dbQuery.run(
                `UPDATE users 
                 SET credits_earned = credits_earned + 1, skills_taught_count = skills_taught_count + 1, recent_activity = ?
                 WHERE id = ?`,
                [JSON.stringify(teacherActivity), teacherId]
            );

            // 6. Update Learner: -1 Time Credit
            let learnerActivity = [];
            try { learnerActivity = learner.recent_activity ? JSON.parse(learner.recent_activity) : []; } catch (e) { learnerActivity = []; }
            learnerActivity.unshift({
                time: "Just now",
                icon: "✅",
                type: "session",
                text: `Completed "${skill}" with ${teacherName} (-1 Credit)`
            });
            if (learnerActivity.length > 8) learnerActivity = learnerActivity.slice(0, 8);

            await dbQuery.run(
                `UPDATE users 
                 SET credits_earned = credits_earned - 1, hours_learned = hours_learned + 1, recent_activity = ?
                 WHERE id = ?`,
                [JSON.stringify(learnerActivity), learnerId]
            );

            // 7. Save Transactions in SQLite for Free Barter Session
            await dbQuery.run(
                `INSERT INTO transactions (user_id, partner_id, partner_name, session_id, type, amount, skill, session_date, session_time)
                 VALUES (?, ?, ?, ?, 'earned', 1, ?, ?, ?)`,
                [teacherId, learnerId, learnerName, requestId, skill, sessionDate, sessionTime]
            );

            await dbQuery.run(
                `INSERT INTO transactions (user_id, partner_id, partner_name, session_id, type, amount, skill, session_date, session_time)
                 VALUES (?, ?, ?, ?, 'spent', -1, ?, ?, ?)`,
                [learnerId, teacherId, teacherName, requestId, skill, sessionDate, sessionTime]
            );

            console.log(`💵 Free Barter Session ${requestId} completed! Teacher +1 Credit, Learner -1 Credit.`);
        }

        // 8. Update session, request, and payment_requests status in SQLite
        await dbQuery.run('UPDATE sessions SET status = "completed" WHERE request_id = ? OR id = ?', [requestId, requestId]);
        await dbQuery.run('UPDATE session_requests SET status = "completed" WHERE id = ?', [requestId]);
        if (paidReq) {
            await dbQuery.run('UPDATE payment_requests SET status = "Completed & Paid" WHERE id = ?', [paidReq.id]);
        }

        // 9. Log verification details
        console.log(`💵 Session ${requestId} completion process finished for Teacher ID ${teacherId} & Learner ID ${learnerId}`);

        // 10. Notify clients via Socket.IO
        if (req.app && req.app.get('io')) {
            const io = req.app.get('io');
            io.to(`user_${teacherId}`).emit('wallet_updated', { sessionId: requestId });
            io.to(`user_${learnerId}`).emit('wallet_updated', { sessionId: requestId });
        }

        // 11. Return updated balance for caller
        const updatedCaller = await dbQuery.get('SELECT credits_earned FROM users WHERE id = ?', [userId]);

        return res.status(200).json({
            success: true,
            message: 'Session completed successfully! Wallet updated.',
            creditsEarned: updatedCaller ? updatedCaller.credits_earned : 15
        });

    } catch (error) {
        console.error('❌ Complete Session Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Get Transaction Log History Controller
exports.getTransactions = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const user = await dbQuery.get('SELECT credits_earned FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const transactions = await dbQuery.all(
            `SELECT t.*, 
                    s.date as s_date, s.time as s_time, s.skill as s_skill,
                    sr.date as sr_date, sr.time as sr_time, sr.skill as sr_skill
             FROM transactions t
             LEFT JOIN sessions s ON (t.session_id = s.id OR t.session_id = s.request_id)
             LEFT JOIN session_requests sr ON t.session_id = sr.id
             WHERE t.user_id = ?
             GROUP BY t.id
             ORDER BY t.created_at DESC`,
            [userId]
        );

        let totalEarned = 0;
        let totalSpent = 0;

        const mappedTransactions = transactions.map(t => {
            const roundedAmount = Math.round(t.amount || 0);
            if (roundedAmount > 0) {
                totalEarned += roundedAmount;
            } else {
                totalSpent += Math.abs(roundedAmount);
            }

            const rawSkill = t.skill;
            const validSkill = (rawSkill && rawSkill !== 'undefined') ? rawSkill : (t.s_skill || t.sr_skill || 'Skill Barter');
            const sessionDate = t.session_date || t.s_date || t.sr_date;
            const sessionTime = t.session_time || t.s_time || t.sr_time;

            return {
                id: t.id,
                sessionId: t.session_id,
                type: t.type,
                partner: t.partner_name,
                partnerId: t.partner_id,
                skill: validSkill,
                date: t.created_at,
                sessionDate: sessionDate,
                sessionTime: sessionTime,
                amount: roundedAmount
            };
        });

        // Calculate Learning Goal Progress dynamically from SQLite DB
        const userRow = await dbQuery.get('SELECT credits_earned, hours_learned FROM users WHERE id = ?', [userId]);

        const completedLearningRow = await dbQuery.get(
            `SELECT COUNT(*) as completed_count, SUM(duration) as total_duration 
             FROM session_requests 
             WHERE sender_id = ? AND (status = 'completed' OR status = 'Completed')`,
            [userId]
        );

        const totalLearningRequestsRow = await dbQuery.get(
            `SELECT COUNT(*) as total_count, SUM(duration) as total_duration 
             FROM session_requests 
             WHERE sender_id = ? AND status != 'declined' AND status != 'rejected' AND status != 'cancelled'`,
            [userId]
        );

        const completedLearningHours = (completedLearningRow && completedLearningRow.total_duration) 
            ? Math.round(completedLearningRow.total_duration) 
            : (completedLearningRow ? completedLearningRow.completed_count : 0);

        // Explicit target learning goal from database (NO auto-generated fallback)
        const targetLearningGoal = (userRow && userRow.hours_learned && Number(userRow.hours_learned) > 0)
            ? Number(userRow.hours_learned)
            : 0;

        const learningProgressPct = targetLearningGoal > 0 
            ? Math.min(100, Math.round((completedLearningHours / targetLearningGoal) * 100))
            : 0;

        return res.status(200).json({
            success: true,
            balance: Math.round(user.credits_earned || 0),
            totalEarned: Math.round(totalEarned),
            totalSpent: Math.round(totalSpent),
            completedLearningHours,
            targetLearningGoal,
            learningProgressPct,
            transactions: mappedTransactions
        });
    } catch (error) {
        console.error('❌ Get Transactions Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Search Profiles & Auto Seed Mock Users Controller
exports.searchProfiles = async (req, res) => {
    try {
        const userId = parseInt(req.headers['x-user-id']) || 0;
        const searchVal = req.query.query ? req.query.query.trim().toLowerCase() : "";

        // Fetch matches from database excluding active searcher and admin users
        let querySql = `
            SELECT u.*, ta.hourly_fee as teacher_hourly_fee 
            FROM users u 
            LEFT JOIN teacher_applications ta ON u.id = ta.user_id 
            WHERE u.id != ? AND LOWER(u.role) != 'admin'
        `;
        let params = [userId];

        if (searchVal) {
            querySql += ` AND (LOWER(u.first_name) LIKE ? OR LOWER(u.last_name) LIKE ? OR LOWER(u.username) LIKE ? OR LOWER(u.skills_teach) LIKE ? OR LOWER(u.skills_learn) LIKE ?)`;
            const wildcard = `%${searchVal}%`;
            params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
        }

        const users = await dbQuery.all(querySql, params);

        const parseSkills = (str) => str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];

        // Map database fields to front-end keys
        const mappedUsers = users.map(u => ({
            id: u.id,
            firstName: u.first_name,
            lastName: u.last_name,
            username: u.username,
            role: u.role,
            avatar: u.avatar || "",
            bio: u.bio || "",
            skillsTeach: parseSkills(u.skills_teach),
            skillsLearn: parseSkills(u.skills_learn),
            creditsEarned: u.credits_earned !== null ? u.credits_earned : 15,
            hourlyFee: u.teacher_hourly_fee !== null && u.teacher_hourly_fee !== undefined ? u.teacher_hourly_fee : 1,
            rating: 4.9,
            bestMatch: u.id % 2 === 1
        }));

        return res.status(200).json({
            success: true,
            profiles: mappedUsers
        });

    } catch (error) {
        console.error('❌ Search Profiles Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Helper function to calculate duration in hours from start time and end time
function calculateDurationInHours(startTime, endTime, timeStr) {
    try {
        let start = startTime;
        let end = endTime;
        if ((!start || !end) && timeStr && timeStr.includes(' - ')) {
            const parts = timeStr.split(' - ');
            start = parts[0].trim();
            end = parts[1].trim();
        }
        if (start && end) {
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
                let diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
                if (diffMins <= 0) diffMins += 24 * 60;
                return Math.max(0.5, Math.round((diffMins / 60) * 10) / 10);
            }
        }
    } catch (e) {}
    return 1.0;
}

// Book Paid Session Controller (Step 1: Send Request to Teacher)
exports.bookPaidSession = async (req, res) => {
    try {
        const callerUserId = req.headers['x-user-id'];
        const { teacherId, teacherName, skill, date, startTime, endTime, time, feeAmount, message } = req.body;

        if (!callerUserId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        if (!teacherId || !teacherName || !skill || !date || (!startTime && !time)) {
            return res.status(400).json({ success: false, message: 'All booking fields (teacherId, teacherName, skill, date, time) are required.' });
        }

        const student = await dbQuery.get('SELECT * FROM users WHERE id = ?', [callerUserId]);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found.' });
        }

        const teacher = await dbQuery.get('SELECT * FROM users WHERE id = ?', [teacherId]);
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
        }

        const studentName = `${student.first_name} ${student.last_name}`;
        const sTime = startTime || (time ? time.split(' - ')[0] : '14:00');
        const eTime = endTime || (time ? time.split(' - ')[1] : '15:00');
        const timeRangeStr = time || `${sTime} - ${eTime}`;
        const duration = calculateDurationInHours(sTime, eTime, timeRangeStr);
        const numericFee = parseFloat(feeAmount) || 1;

        // Create session request in 'pending' status with is_paid = 1
        const ins = await dbQuery.run(
            `INSERT INTO session_requests (sender_id, sender_name, sender_avatar, recipient_id, recipient_name, recipient_avatar, skill, date, time, start_time, end_time, duration, status, is_paid, fee_amount, message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?)`,
            [callerUserId, studentName, student.avatar || '', teacherId, teacherName, teacher.avatar || '', skill, date, timeRangeStr, sTime, eTime, duration, numericFee, message || '']
        );

        // Timeline activity log
        let recentActivity = [];
        try { recentActivity = student.recent_activity ? JSON.parse(student.recent_activity) : []; } catch (e) { recentActivity = []; }
        recentActivity.unshift({
            time: "Just now",
            icon: "💳",
            type: "update",
            text: `Sent Paid Session Request (${numericFee} Credits) to ${teacherName} (${skill})`
        });
        if (recentActivity.length > 8) recentActivity = recentActivity.slice(0, 8);
        await dbQuery.run(`UPDATE users SET recent_activity = ? WHERE id = ?`, [JSON.stringify(recentActivity), callerUserId]);

        // Realtime notification to Teacher
        if (req.app && req.app.get('io')) {
            const io = req.app.get('io');
            io.to(`user_${teacherId}`).emit('session_status_update', { reqId: ins.id, status: 'pending', isPaid: true });
        }

        return res.status(200).json({
            success: true,
            message: `Paid session request sent to ${teacherName}! Waiting for teacher response.`,
            requestId: ins.id,
            feeAmount: numericFee
        });

    } catch (error) {
        console.error('❌ Book Paid Session Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Get Session Requests Controller
exports.getSessionRequests = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const requests = await dbQuery.all(
            `SELECT * FROM session_requests WHERE sender_id = ? OR recipient_id = ? ORDER BY created_at DESC`,
            [userId, userId]
        );

        const mappedRequests = requests.map(r => ({
            id: r.id,
            senderId: r.sender_id,
            senderName: r.sender_name,
            senderAvatar: r.sender_avatar,
            recipientId: r.recipient_id,
            recipientName: r.recipient_name,
            recipientAvatar: r.recipient_avatar,
            skill: r.skill,
            date: r.date,
            time: r.time,
            startTime: r.start_time || (r.time ? r.time.split(' - ')[0] : ''),
            endTime: r.end_time || (r.time ? r.time.split(' - ')[1] : ''),
            duration: r.duration || 1.0,
            isPaid: Boolean(r.is_paid),
            feeAmount: r.fee_amount || 0,
            message: r.message || '',
            paymentProof: r.payment_proof || '',
            status: r.status
        }));

        return res.status(200).json({
            success: true,
            requests: mappedRequests
        });
    } catch (error) {
        console.error('❌ Get Session Requests Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Create Free Session Request Controller
exports.createSessionRequest = async (req, res) => {
    try {
        const senderId = req.headers['x-user-id'];
        const { recipientId, recipientName, recipientAvatar, skill, date, time, startTime, endTime, message } = req.body;

        if (!senderId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        if (!recipientId || !recipientName || !skill || !date || (!time && !startTime)) {
            return res.status(400).json({ success: false, message: 'Missing required session request fields.' });
        }

        const sender = await dbQuery.get('SELECT first_name, last_name, avatar FROM users WHERE id = ?', [senderId]);
        if (!sender) {
            return res.status(404).json({ success: false, message: 'Sender not found.' });
        }

        const senderName = `${sender.first_name} ${sender.last_name}`;
        const senderAvatar = sender.avatar || '';
        const sTime = startTime || (time ? time.split(' - ')[0] : '14:00');
        const eTime = endTime || (time ? time.split(' - ')[1] : '15:00');
        const timeRangeStr = time || `${sTime} - ${eTime}`;
        const duration = calculateDurationInHours(sTime, eTime, timeRangeStr);

        const ins = await dbQuery.run(
            `INSERT INTO session_requests (sender_id, sender_name, sender_avatar, recipient_id, recipient_name, recipient_avatar, skill, date, time, start_time, end_time, duration, status, is_paid, message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
            [senderId, senderName, senderAvatar, recipientId, recipientName, recipientAvatar || '', skill, date, timeRangeStr, sTime, eTime, duration, message || '']
        );

        // Save real-time Notification in DB for recipient
        try {
            await dbQuery.run(
                `INSERT INTO notifications (user_id, title, message, type, link, is_read, created_at)
                 VALUES (?, ?, ?, 'request', 'session-request.html', 0, datetime('now', '+5 hours', '+30 minutes'))`,
                [recipientId, `New Session Request from ${senderName}`, `${senderName} wants to connect and schedule a session for ${skill}.`]
            );
        } catch (nErr) {
            console.warn("Notification DB insert error:", nErr);
        }

        if (req.app && req.app.get('io')) {
            const io = req.app.get('io');
            io.to(`user_${recipientId}`).emit('session_status_update', { reqId: ins.id, status: 'pending' });
        }

        return res.status(201).json({
            success: true,
            message: 'Session request sent successfully!'
        });
    } catch (error) {
        console.error('❌ Create Session Request Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Update Session Request Status Controller (Teacher Accept/Reject/Time Edit)
exports.updateSessionRequestStatus = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        let { reqId, status, date, time, startTime, endTime } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        if (!reqId) {
            return res.status(400).json({ success: false, message: 'Invalid or missing Request ID.' });
        }

        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required.' });
        }

        let request = await dbQuery.get('SELECT * FROM session_requests WHERE id = ?', [reqId]);
        if (!request) {
            const sessionRow = await dbQuery.get('SELECT * FROM sessions WHERE id = ? OR request_id = ?', [reqId, reqId]);
            if (sessionRow) {
                reqId = sessionRow.request_id || sessionRow.id;
                request = await dbQuery.get('SELECT * FROM session_requests WHERE id = ?', [reqId]);
            }
        }

        if (!request) {
            return res.status(404).json({ success: false, message: 'Session request not found.' });
        }

        const isAccept = (status === 'accepted' || status === 'Accept' || status === 'Waiting for Student Payment' || status === 'Confirmed');
        const isDecline = (status === 'rejected' || status === 'declined' || status === 'Declined' || status === 'cancelled' || status === 'Cancel');

        if (isAccept) {
            const finalDate = date || request.date;
            const sTime = startTime || (time ? time.split(' - ')[0] : request.start_time || request.time.split(' - ')[0]);
            const eTime = endTime || (time ? time.split(' - ')[1] : request.end_time || request.time.split(' - ')[1]);
            const finalTime = `${sTime} - ${eTime}`;
            const duration = calculateDurationInHours(sTime, eTime, finalTime);

            const isPaidSession = Boolean(request.is_paid) || request.fee_amount > 0;

            if (isPaidSession) {
                // Step 2: Paid session accepted by Teacher -> Status becomes "Waiting for Student Payment"
                const targetStatus = 'Waiting for Student Payment';
                await dbQuery.run(
                    `UPDATE session_requests 
                     SET status = ?, date = ?, time = ?, start_time = ?, end_time = ?, duration = ?, updated_at = (datetime('now', '+5 hours', '+30 minutes')) 
                     WHERE id = ?`,
                    [targetStatus, finalDate, finalTime, sTime, eTime, duration, reqId]
                );

                if (req.app && req.app.get('io')) {
                    const io = req.app.get('io');
                    io.to(`user_${request.sender_id}`).emit('session_status_update', { 
                        reqId: request.id, 
                        status: targetStatus,
                        message: 'Your session has been accepted. Complete payment to confirm your booking.' 
                    });
                    io.to(`user_${request.recipient_id}`).emit('session_status_update', { reqId: request.id, status: targetStatus });
                }

                return res.status(200).json({
                    success: true,
                    status: targetStatus,
                    message: 'Session request accepted! Status set to Waiting for Student Payment.'
                });
            } else {
                // Free Session accepted -> Status becomes "Confirmed"
                const targetStatus = 'Confirmed';
                await dbQuery.run(
                    `UPDATE session_requests 
                     SET status = ?, date = ?, time = ?, start_time = ?, end_time = ?, duration = ?, updated_at = (datetime('now', '+5 hours', '+30 minutes')) 
                     WHERE id = ?`,
                    [targetStatus, finalDate, finalTime, sTime, eTime, duration, reqId]
                );

                // Create sessions room record
                const roomId = `BarterLearn_Room_${reqId}_${Math.random().toString(36).substring(2, 10)}`;
                const existingSession = await dbQuery.get('SELECT id FROM sessions WHERE request_id = ?', [reqId]);
                if (!existingSession) {
                    await dbQuery.run(
                        `INSERT INTO sessions (request_id, sender_id, recipient_id, skill, date, time, room_id, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
                        [reqId, request.sender_id, request.recipient_id, request.skill, finalDate, finalTime, roomId]
                    );
                }

                if (req.app && req.app.get('io')) {
                    const io = req.app.get('io');
                    io.to(`user_${request.sender_id}`).emit('session_status_update', { reqId: request.id, status: targetStatus });
                    io.to(`user_${request.recipient_id}`).emit('session_status_update', { reqId: request.id, status: targetStatus });
                }

                return res.status(200).json({
                    success: true,
                    status: targetStatus,
                    message: 'Free session accepted and Confirmed!'
                });
            }
        } else if (isDecline) {
            const targetStatus = 'Rejected';
            await dbQuery.run(
                `UPDATE session_requests SET status = ?, updated_at = (datetime('now', '+5 hours', '+30 minutes')) WHERE id = ?`,
                [targetStatus, reqId]
            );
            await dbQuery.run(`UPDATE sessions SET status = ? WHERE request_id = ? OR id = ?`, [targetStatus, reqId, reqId]);

            if (req.app && req.app.get('io')) {
                const io = req.app.get('io');
                io.to(`user_${request.sender_id}`).emit('session_decline_notification', {
                    reqId: request.id,
                    status: targetStatus,
                    skill: request.skill,
                    teacherName: request.recipient_name
                });
                io.to(`user_${request.sender_id}`).emit('session_status_update', { reqId: request.id, status: targetStatus });
                io.to(`user_${request.recipient_id}`).emit('session_status_update', { reqId: request.id, status: targetStatus });
            }

            return res.status(200).json({
                success: true,
                status: targetStatus,
                message: 'Session request rejected.'
            });
        }

        return res.status(400).json({ success: false, message: 'Invalid status specified.' });
    } catch (error) {
        console.error('❌ Update Session Request Status Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Step 3: Student Submit Payment Proof Controller
exports.submitSessionPayment = async (req, res) => {
    try {
        const studentId = req.headers['x-user-id'];
        const { reqId, transactionRef, paymentProof } = req.body;

        if (!studentId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }
        if (!reqId) {
            return res.status(400).json({ success: false, message: 'Request ID is required.' });
        }

        const request = await dbQuery.get('SELECT * FROM session_requests WHERE id = ?', [reqId]);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Session request not found.' });
        }

        const student = await dbQuery.get('SELECT * FROM users WHERE id = ?', [studentId]);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found.' });
        }

        const studentName = `${student.first_name} ${student.last_name}`;
        const proofStr = paymentProof || transactionRef || 'Uploaded Proof';

        // Update session_requests status to "Payment Pending Verification"
        await dbQuery.run(
            `UPDATE session_requests 
             SET status = 'Payment Pending Verification', payment_proof = ?, updated_at = (datetime('now', '+5 hours', '+30 minutes')) 
             WHERE id = ?`,
            [proofStr, reqId]
        );

        // Upsert into payment_requests table
        const existingPR = await dbQuery.get('SELECT id FROM payment_requests WHERE request_id = ?', [reqId]);
        if (existingPR) {
            await dbQuery.run(
                `UPDATE payment_requests 
                 SET transaction_ref = ?, payment_proof = ?, status = 'Payment Pending Verification', updated_at = (datetime('now', '+5 hours', '+30 minutes')) 
                 WHERE id = ?`,
                [transactionRef || proofStr, proofStr, existingPR.id]
            );
        } else {
            await dbQuery.run(
                `INSERT INTO payment_requests (user_id, user_name, user_email, request_id, teacher_id, teacher_name, amount, transaction_ref, payment_proof, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Payment Pending Verification')`,
                [studentId, studentName, student.email, reqId, request.recipient_id, request.recipient_name, request.fee_amount, transactionRef || proofStr, proofStr]
            );
        }

        // Notify client via sockets
        if (req.app && req.app.get('io')) {
            const io = req.app.get('io');
            io.to(`user_${request.sender_id}`).emit('session_status_update', { reqId: request.id, status: 'Payment Pending Verification' });
            io.to(`user_${request.recipient_id}`).emit('session_status_update', { reqId: request.id, status: 'Payment Pending Verification' });
        }

        return res.status(200).json({
            success: true,
            status: 'Payment Pending Verification',
            message: 'Payment proof submitted successfully! Status is now Payment Pending Verification.'
        });

    } catch (error) {
        console.error('❌ Submit Session Payment Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Get Scheduled or Active Sessions Controller
exports.getActiveSessions = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const querySql = `
            SELECT s.*, 
                   u1.first_name as sender_first_name, u1.last_name as sender_last_name, u1.avatar as sender_avatar,
                   u2.first_name as recipient_first_name, u2.last_name as recipient_last_name, u2.avatar as recipient_avatar
            FROM sessions s
            JOIN users u1 ON s.sender_id = u1.id
            JOIN users u2 ON s.recipient_id = u2.id
            WHERE (s.sender_id = ? OR s.recipient_id = ?) AND s.status IN ('scheduled', 'active')
            ORDER BY s.created_at DESC
        `;
        const list = await dbQuery.all(querySql, [userId, userId]);

        const mappedSessions = list.map(s => {
            const isOutgoing = s.sender_id == userId;
            const partnerName = isOutgoing 
                ? `${s.recipient_first_name} ${s.recipient_last_name}`
                : `${s.sender_first_name} ${s.sender_last_name}`;
            const partnerAvatar = isOutgoing ? s.recipient_avatar : s.sender_avatar;

            return {
                id: s.id,
                requestId: s.request_id,
                senderId: s.sender_id,
                recipientId: s.recipient_id,
                skill: s.skill,
                date: s.date,
                time: s.time,
                roomId: s.room_id,
                status: s.status,
                partnerName,
                partnerAvatar,
                isOutgoing
            };
        });

        return res.status(200).json({ success: true, sessions: mappedSessions });
    } catch (error) {
        console.error('❌ Get Active Sessions Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Get Session Details Controller (Includes direct call bypass security check)
exports.getSessionDetails = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const requestId = req.query.id || req.query.sessionId || req.query.requestId;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }
        if (!requestId) {
            return res.status(400).json({ success: false, message: 'Session ID is required.' });
        }

        let reqRow = await dbQuery.get('SELECT * FROM session_requests WHERE id = ?', [requestId]);
        let session = await dbQuery.get(
            `SELECT s.*, 
                    u1.first_name as sender_first_name, u1.last_name as sender_last_name, u1.avatar as sender_avatar,
                    u2.first_name as recipient_first_name, u2.last_name as recipient_last_name, u2.avatar as recipient_avatar
             FROM sessions s
             JOIN users u1 ON s.sender_id = u1.id
             JOIN users u2 ON s.recipient_id = u2.id
             WHERE (s.sender_id = ? OR s.recipient_id = ?) AND (s.request_id = ? OR s.id = ?)
             LIMIT 1`,
            [userId, userId, requestId, requestId]
        );

        if (!reqRow && session) {
            reqRow = await dbQuery.get('SELECT * FROM session_requests WHERE id = ?', [session.request_id]);
        }

        // Security Step 5 Check: Paid sessions MUST be Confirmed before call access
        if (reqRow) {
            const isPaid = Boolean(reqRow.is_paid) || reqRow.fee_amount > 0;
            const reqStatus = (reqRow.status || '').toLowerCase();
            
            if (isPaid && reqStatus !== 'confirmed' && reqStatus !== 'completed' && reqStatus !== 'active') {
                return res.status(403).json({
                    success: false,
                    isBlocked: true,
                    message: `Access Denied: Payment verification required before entering the video call room. Current status: "${reqRow.status}".`
                });
            }
        }

        if (!session && reqRow && (reqRow.status === 'Confirmed' || reqRow.status === 'accepted')) {
            const roomId = `BarterLearn_Room_${reqRow.id}_${Math.random().toString(36).substring(2, 10)}`;
            const ins = await dbQuery.run(
                `INSERT INTO sessions (request_id, sender_id, recipient_id, skill, date, time, room_id, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
                [reqRow.id, reqRow.sender_id, reqRow.recipient_id, reqRow.skill, reqRow.date, reqRow.time, roomId]
            );
            session = await dbQuery.get(
                `SELECT s.*, 
                        u1.first_name as sender_first_name, u1.last_name as sender_last_name, u1.avatar as sender_avatar,
                        u2.first_name as recipient_first_name, u2.last_name as recipient_last_name, u2.avatar as recipient_avatar
                 FROM sessions s
                 JOIN users u1 ON s.sender_id = u1.id
                 JOIN users u2 ON s.recipient_id = u2.id
                 WHERE s.id = ?`,
                [ins.id]
            );
        }

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session record not found or session not confirmed.' });
        }

        const isOutgoing = session.sender_id == userId;
        const partnerName = isOutgoing 
            ? `${session.recipient_first_name} ${session.recipient_last_name}`
            : `${session.sender_first_name} ${session.sender_last_name}`;
        const partnerAvatar = isOutgoing ? session.recipient_avatar : session.sender_avatar;

        const result = {
            id: session.id,
            requestId: session.request_id,
            senderId: session.sender_id,
            recipientId: session.recipient_id,
            skill: session.skill,
            date: session.date,
            time: session.time,
            roomId: session.room_id,
            status: session.status,
            partnerName,
            partnerAvatar,
            senderName: `${session.sender_first_name} ${session.sender_last_name}`,
            recipientName: `${session.recipient_first_name} ${session.recipient_last_name}`,
            senderAvatar: session.sender_avatar,
            recipientAvatar: session.recipient_avatar,
            isOutgoing
        };

        return res.status(200).json({ success: true, session: result });
    } catch (error) {
        console.error('❌ Get Session Details Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Helper: Get local date string YYYY-MM-DD in IST (Asia/Kolkata, UTC+5:30)
function getLocalDateString() {
    const d = new Date();
    const istDate = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
    return istDate.toISOString().split('T')[0];
}

// Get Daily Video Call Usage Controller
exports.getDailyCallUsage = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const user = await dbQuery.get('SELECT id, is_premium FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const todayStr = getLocalDateString();
        const usage = await dbQuery.get('SELECT seconds_used FROM user_daily_call_usage WHERE user_id = ? AND usage_date = ?', [userId, todayStr]);
        const secondsUsed = usage ? usage.seconds_used : 0;
        const maxSeconds = 10800; // 3 hours
        const isPremium = Boolean(user.is_premium);
        const limitReached = !isPremium && secondsUsed >= maxSeconds;
        const remainingSeconds = isPremium ? maxSeconds : Math.max(0, maxSeconds - secondsUsed);

        return res.status(200).json({
            success: true,
            secondsUsed,
            maxSeconds,
            remainingSeconds,
            limitReached,
            isPremium,
            usageDate: todayStr
        });
    } catch (error) {
        console.error('❌ Get Daily Call Usage Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Record Call Heartbeat Controller
exports.recordCallHeartbeat = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const addSeconds = parseInt(req.body.seconds) || 5;
        const user = await dbQuery.get('SELECT id, is_premium FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const todayStr = getLocalDateString();
        
        // Upsert daily usage
        await dbQuery.run(`
            INSERT INTO user_daily_call_usage (user_id, usage_date, seconds_used)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, usage_date)
            DO UPDATE SET seconds_used = seconds_used + ?, updated_at = (datetime('now', '+5 hours', '+30 minutes'))
        `, [userId, todayStr, addSeconds, addSeconds]);

        const usage = await dbQuery.get('SELECT seconds_used FROM user_daily_call_usage WHERE user_id = ? AND usage_date = ?', [userId, todayStr]);
        const secondsUsed = usage ? usage.seconds_used : 0;
        const maxSeconds = 10800; // 3 hours
        const isPremium = Boolean(user.is_premium);
        const limitReached = !isPremium && secondsUsed >= maxSeconds;
        const remainingSeconds = isPremium ? maxSeconds : Math.max(0, maxSeconds - secondsUsed);

        return res.status(200).json({
            success: true,
            secondsUsed,
            maxSeconds,
            remainingSeconds,
            limitReached,
            isPremium,
            usageDate: todayStr
        });
    } catch (error) {
        console.error('❌ Record Call Heartbeat Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Upgrade User to Premium Controller
exports.upgradeToPremium = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        await dbQuery.run('UPDATE users SET is_premium = 1 WHERE id = ?', [userId]);
        return res.status(200).json({
            success: true,
            message: '🎉 Upgrade successful! You now have Unlimited Daily Video Call Time.'
        });
    } catch (error) {
        console.error('❌ Upgrade to Premium Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Submit Payment Request Controller (Pending Verification)
exports.submitPaymentRequest = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { transactionRef } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const user = await dbQuery.get('SELECT id, first_name, last_name, email FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const userName = `${user.first_name} ${user.last_name}`;
        const refStr = (transactionRef || '').trim();

        // Check if user already has an active pending request
        const existing = await dbQuery.get(
            `SELECT id FROM payment_requests WHERE user_id = ? AND status = 'Pending Verification'`,
            [userId]
        );

        if (existing) {
            await dbQuery.run(
                `UPDATE payment_requests SET transaction_ref = ?, updated_at = (datetime('now', '+5 hours', '+30 minutes')) WHERE id = ?`,
                [refStr, existing.id]
            );
        } else {
            await dbQuery.run(
                `INSERT INTO payment_requests (user_id, user_name, user_email, transaction_ref, status)
                 VALUES (?, ?, ?, ?, 'Pending Verification')`,
                [userId, userName, user.email, refStr]
            );
        }

        return res.status(200).json({
            success: true,
            status: 'Pending Verification',
            message: 'Your payment request has been submitted successfully! The admin is verifying your payment. Once verified, your account will be upgraded to Premium.'
        });
    } catch (error) {
        console.error('❌ Submit Payment Request Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Get Payment Request Status Controller
exports.getPaymentStatus = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const user = await dbQuery.get('SELECT id, is_premium FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const latestRequest = await dbQuery.get(
            `SELECT * FROM payment_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            isPremium: Boolean(user.is_premium),
            paymentStatus: latestRequest ? latestRequest.status : 'none',
            request: latestRequest || null
        });
    } catch (error) {
        console.error('❌ Get Payment Status Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Admin: Get All Payment Requests Controller (includes Premium & Paid Session Payments)
exports.getAdminPaymentRequests = async (req, res) => {
    try {
        const list = await dbQuery.all(`
            SELECT pr.*, 
                   sr.skill as session_skill, 
                   sr.date as session_date, 
                   sr.time as session_time, 
                   sr.status as session_request_status,
                   sr.is_paid as is_session_paid,
                   sr.fee_amount as session_fee
            FROM payment_requests pr
            LEFT JOIN session_requests sr ON pr.request_id = sr.id
            ORDER BY pr.id DESC
        `);
        return res.status(200).json({ success: true, requests: list });
    } catch (error) {
        console.error('❌ Admin Payment Requests Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Admin: Verify / Approve / Reject Payment Request Controller (Step 4)
exports.adminVerifyPayment = async (req, res) => {
    try {
        const { requestId, action } = req.body;
        if (!requestId || !action) {
            return res.status(400).json({ success: false, message: 'Request ID and action are required.' });
        }

        let pReq = await dbQuery.get(`SELECT * FROM payment_requests WHERE id = ? OR request_id = ?`, [requestId, requestId]);
        let sReq = await dbQuery.get(`SELECT * FROM session_requests WHERE id = ?`, [requestId]);

        if (!pReq && !sReq) {
            return res.status(404).json({ success: false, message: 'Payment request record not found.' });
        }

        const targetPaymentReqId = pReq ? pReq.id : null;
        const targetSessionReqId = pReq ? pReq.request_id : (sReq ? sReq.id : null);

        if (action === 'approve') {
            if (targetPaymentReqId) {
                await dbQuery.run(
                    `UPDATE payment_requests SET status = 'Approved', updated_at = (datetime('now', '+5 hours', '+30 minutes')) WHERE id = ?`,
                    [targetPaymentReqId]
                );
            }

            if (targetSessionReqId) {
                await dbQuery.run(
                    `UPDATE session_requests SET status = 'Confirmed', updated_at = (datetime('now', '+5 hours', '+30 minutes')) WHERE id = ?`,
                    [targetSessionReqId]
                );

                const sessionReq = await dbQuery.get(`SELECT * FROM session_requests WHERE id = ?`, [targetSessionReqId]);
                if (sessionReq) {
                    const roomId = `BarterLearn_Room_${sessionReq.id}_${Math.random().toString(36).substring(2, 10)}`;
                    const existingSession = await dbQuery.get('SELECT id FROM sessions WHERE request_id = ?', [sessionReq.id]);
                    if (!existingSession) {
                        await dbQuery.run(
                            `INSERT INTO sessions (request_id, sender_id, recipient_id, skill, date, time, room_id, status)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
                            [sessionReq.id, sessionReq.sender_id, sessionReq.recipient_id, sessionReq.skill, sessionReq.date, sessionReq.time, roomId]
                        );
                    } else {
                        await dbQuery.run(`UPDATE sessions SET status = 'scheduled' WHERE request_id = ?`, [sessionReq.id]);
                    }

                    if (req.app && req.app.get('io')) {
                        const io = req.app.get('io');
                        io.to(`user_${sessionReq.sender_id}`).emit('session_status_update', { reqId: sessionReq.id, status: 'Confirmed' });
                        io.to(`user_${sessionReq.recipient_id}`).emit('session_status_update', { reqId: sessionReq.id, status: 'Confirmed' });
                    }
                }
            } else if (pReq && pReq.user_id) {
                await dbQuery.run(`UPDATE users SET is_premium = 1 WHERE id = ?`, [pReq.user_id]);
            }

            return res.status(200).json({
                success: true,
                message: `Payment request approved! Session is now Confirmed and ready for video call.`
            });

        } else if (action === 'reject') {
            if (targetPaymentReqId) {
                await dbQuery.run(
                    `UPDATE payment_requests SET status = 'Rejected', updated_at = (datetime('now', '+5 hours', '+30 minutes')) WHERE id = ?`,
                    [targetPaymentReqId]
                );
            }

            if (targetSessionReqId) {
                await dbQuery.run(
                    `UPDATE session_requests SET status = 'Payment Rejected', updated_at = (datetime('now', '+5 hours', '+30 minutes')) WHERE id = ?`,
                    [targetSessionReqId]
                );

                const sessionReq = await dbQuery.get(`SELECT * FROM session_requests WHERE id = ?`, [targetSessionReqId]);
                if (sessionReq && req.app && req.app.get('io')) {
                    const io = req.app.get('io');
                    io.to(`user_${sessionReq.sender_id}`).emit('session_status_update', { 
                        reqId: sessionReq.id, 
                        status: 'Payment Rejected',
                        message: 'Payment Rejected. Please upload a valid payment proof.' 
                    });
                }
            }

            return res.status(200).json({
                success: true,
                message: `Payment request rejected.`
            });
        }

        return res.status(400).json({ success: false, message: 'Invalid action parameter.' });
    } catch (error) {
        console.error('❌ Admin Verify Payment Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Submit or Update Teacher Application Controller
exports.submitTeacherApplication = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { qualifications, skills, experience, hourlyFee } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        if (!qualifications || !qualifications.trim()) {
            return res.status(400).json({ success: false, message: 'Qualifications field is required.' });
        }
        if (!skills || !skills.trim()) {
            return res.status(400).json({ success: false, message: 'Skills field is required.' });
        }
        if (!experience || !experience.trim()) {
            return res.status(400).json({ success: false, message: 'Experience field is required.' });
        }
        if (hourlyFee === undefined || hourlyFee === null || isNaN(Number(hourlyFee)) || Number(hourlyFee) <= 0) {
            return res.status(400).json({ success: false, message: 'Valid positive hourly fee is required.' });
        }

        const user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User profile not found.' });
        }

        const numericFee = parseFloat(hourlyFee);

        // Check if an application already exists for user
        const existingApp = await dbQuery.get('SELECT * FROM teacher_applications WHERE user_id = ?', [userId]);

        if (existingApp) {
            await dbQuery.run(
                `UPDATE teacher_applications 
                 SET qualifications = ?, skills = ?, experience = ?, hourly_fee = ?, status = 'pending', updated_at = (datetime('now', '+5 hours', '+30 minutes'))
                 WHERE user_id = ?`,
                [qualifications.trim(), skills.trim(), experience.trim(), numericFee, userId]
            );
        } else {
            await dbQuery.run(
                `INSERT INTO teacher_applications (user_id, qualifications, skills, experience, hourly_fee, status)
                 VALUES (?, ?, ?, ?, ?, 'pending')`,
                [userId, qualifications.trim(), skills.trim(), experience.trim(), numericFee]
            );
        }

        // Add entry to user timeline
        let recentActivity = [];
        try {
            recentActivity = user.recent_activity ? JSON.parse(user.recent_activity) : [];
        } catch (e) {
            recentActivity = [];
        }
        recentActivity.unshift({
            time: "Just now",
            icon: "🎓",
            type: "update",
            text: "Submitted Teacher Application"
        });
        if (recentActivity.length > 8) recentActivity = recentActivity.slice(0, 8);

        await dbQuery.run(
            `UPDATE users SET recent_activity = ? WHERE id = ?`,
            [JSON.stringify(recentActivity), userId]
        );

        return res.status(200).json({
            success: true,
            message: 'Teacher application submitted successfully! Your application is under review.',
            application: {
                userId: parseInt(userId),
                qualifications: qualifications.trim(),
                skills: skills.trim(),
                experience: experience.trim(),
                hourlyFee: numericFee,
                status: 'pending'
            }
        });

    } catch (error) {
        console.error('❌ Submit Teacher Application Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Get Teacher Application Status Controller
exports.getTeacherApplication = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const application = await dbQuery.get('SELECT * FROM teacher_applications WHERE user_id = ?', [userId]);

        if (!application) {
            return res.status(200).json({
                success: true,
                hasApplied: false,
                application: null
            });
        }

        return res.status(200).json({
            success: true,
            hasApplied: true,
            application: {
                id: application.id,
                userId: application.user_id,
                qualifications: application.qualifications,
                skills: application.skills,
                experience: application.experience,
                hourlyFee: application.hourly_fee,
                status: application.status,
                createdAt: application.created_at,
                updatedAt: application.updated_at
            }
        });

    } catch (error) {
        console.error('❌ Get Teacher Application Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Admin: Get All Teacher Applications Controller
exports.getAdminTeacherApplications = async (req, res) => {
    try {
        const querySql = `
            SELECT ta.*, 
                   u.first_name, u.last_name, u.username, u.email, u.role as current_role, u.avatar
            FROM teacher_applications ta
            JOIN users u ON ta.user_id = u.id
            ORDER BY ta.id DESC
        `;
        const list = await dbQuery.all(querySql);

        const mappedList = list.map(app => ({
            id: app.id,
            userId: app.user_id,
            applicantName: `${app.first_name} ${app.last_name}`,
            username: app.username,
            email: app.email,
            avatar: app.avatar || '',
            currentRole: app.current_role,
            qualifications: app.qualifications,
            skills: app.skills,
            experience: app.experience,
            hourlyFee: app.hourly_fee,
            status: app.status,
            createdAt: app.created_at,
            updatedAt: app.updated_at
        }));

        return res.status(200).json({ success: true, applications: mappedList });
    } catch (error) {
        console.error('❌ Get Admin Teacher Applications Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Admin: Approve or Reject Teacher Application Controller
exports.adminTeacherApplicationAction = async (req, res) => {
    try {
        const { applicationId, action } = req.body;

        if (!applicationId || !action) {
            return res.status(400).json({ success: false, message: 'Application ID and action are required.' });
        }

        const app = await dbQuery.get('SELECT * FROM teacher_applications WHERE id = ?', [applicationId]);
        if (!app) {
            return res.status(404).json({ success: false, message: 'Teacher application record not found.' });
        }

        const user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [app.user_id]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Applicant user profile not found.' });
        }

        let recentActivity = [];
        try {
            recentActivity = user.recent_activity ? JSON.parse(user.recent_activity) : [];
        } catch (e) {
            recentActivity = [];
        }

        if (action === 'approve') {
            // 1. Update application status to approved
            await dbQuery.run(
                `UPDATE teacher_applications SET status = 'approved', updated_at = (datetime('now', '+5 hours', '+30 minutes')) WHERE id = ?`,
                [applicationId]
            );

            // 2. Change user's role to "teacher" in database
            await dbQuery.run(
                `UPDATE users SET role = 'teacher' WHERE id = ?`,
                [app.user_id]
            );

            // 3. Add activity log entry
            recentActivity.unshift({
                time: "Just now",
                icon: "🎉",
                type: "badge",
                text: "Teacher Application Approved! Role updated to Teacher."
            });
            if (recentActivity.length > 8) recentActivity = recentActivity.slice(0, 8);
            await dbQuery.run(`UPDATE users SET recent_activity = ? WHERE id = ?`, [JSON.stringify(recentActivity), app.user_id]);

            return res.status(200).json({
                success: true,
                message: `Teacher application #${applicationId} approved! User ${user.first_name} ${user.last_name}'s role changed to Teacher.`
            });

        } else if (action === 'reject') {
            // 1. Update application status to rejected
            await dbQuery.run(
                `UPDATE teacher_applications SET status = 'rejected', updated_at = (datetime('now', '+5 hours', '+30 minutes')) WHERE id = ?`,
                [applicationId]
            );

            // 2. Add activity log entry
            recentActivity.unshift({
                time: "Just now",
                icon: "❌",
                type: "update",
                text: "Teacher Application Reviewed (Declined)"
            });
            if (recentActivity.length > 8) recentActivity = recentActivity.slice(0, 8);
            await dbQuery.run(`UPDATE users SET recent_activity = ? WHERE id = ?`, [JSON.stringify(recentActivity), app.user_id]);

            return res.status(200).json({
                success: true,
                message: `Teacher application #${applicationId} rejected.`
            });
        }

        return res.status(400).json({ success: false, message: 'Invalid action. Must be "approve" or "reject".' });

    } catch (error) {
        console.error('❌ Admin Teacher Application Action Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Submit Withdrawal Payout Request Controller
exports.submitWithdrawalRequest = async (req, res) => {
    try {
        const callerUserId = req.headers['x-user-id'];
        const { amount, paymentMethod, payoutDetails } = req.body;

        if (!callerUserId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Valid positive withdrawal amount is required.' });
        }

        if (!paymentMethod || !payoutDetails) {
            return res.status(400).json({ success: false, message: 'Payment method and payout details (UPI ID/Bank info) are required.' });
        }

        // Fetch user profile
        const teacher = await dbQuery.get('SELECT * FROM users WHERE id = ?', [callerUserId]);
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher user profile not found.' });
        }

        if (teacher.credits_earned < numAmount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Available earned balance: ${teacher.credits_earned} Credits.`
            });
        }

        const teacherName = `${teacher.first_name} ${teacher.last_name}`;

        // 1. Create withdrawal_requests record
        const insertRes = await dbQuery.run(
            `INSERT INTO withdrawal_requests (teacher_id, teacher_name, teacher_email, amount, payment_method, payout_details, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [callerUserId, teacherName, teacher.email, numAmount, paymentMethod, payoutDetails]
        );

        // 2. Reserve / deduct credits from teacher balance
        let recentActivity = [];
        try { recentActivity = teacher.recent_activity ? JSON.parse(teacher.recent_activity) : []; } catch (e) { recentActivity = []; }
        recentActivity.unshift({
            time: "Just now",
            icon: "💸",
            type: "update",
            text: `Submitted Payout Request for ${numAmount} Credits via ${paymentMethod}`
        });
        if (recentActivity.length > 8) recentActivity = recentActivity.slice(0, 8);

        await dbQuery.run(
            `UPDATE users SET credits_earned = credits_earned - ?, recent_activity = ? WHERE id = ?`,
            [numAmount, JSON.stringify(recentActivity), callerUserId]
        );

        // 3. Log transaction in transactions table
        await dbQuery.run(
            `INSERT INTO transactions (user_id, partner_id, partner_name, session_id, type, amount, skill)
             VALUES (?, 0, 'Platform Payout', 0, 'withdrawal_pending', ?, ?)`,
            [callerUserId, -numAmount, `Payout Request via ${paymentMethod} (${payoutDetails})`]
        );

        return res.status(200).json({
            success: true,
            message: `Payout request for ${numAmount} Credits submitted successfully!`,
            requestId: insertRes.id,
            remainingBalance: teacher.credits_earned - numAmount
        });

    } catch (error) {
        console.error('❌ Submit Withdrawal Request Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Get Teacher Withdrawal Requests & History Controller
exports.getWithdrawals = async (req, res) => {
    try {
        const callerUserId = req.headers['x-user-id'];
        if (!callerUserId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const teacher = await dbQuery.get('SELECT * FROM users WHERE id = ?', [callerUserId]);
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'User profile not found.' });
        }

        const requests = await dbQuery.all(
            `SELECT * FROM withdrawal_requests WHERE teacher_id = ? ORDER BY id DESC`,
            [callerUserId]
        );

        const pendingRequests = requests.filter(r => r.status === 'pending');
        const history = requests.filter(r => r.status !== 'pending');

        return res.status(200).json({
            success: true,
            availableBalance: teacher.credits_earned,
            pendingRequests,
            history,
            allRequests: requests
        });

    } catch (error) {
        console.error('❌ Get Withdrawals Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Search Profiles & Skills Controller
exports.searchProfiles = async (req, res) => {
    try {
        const searchQuery = (req.query.query || '').trim().toLowerCase();

        let sql = `SELECT * FROM users WHERE 1=1`;
        let params = [];

        if (searchQuery) {
            sql += ` AND (
                LOWER(first_name) LIKE ? OR 
                LOWER(last_name) LIKE ? OR 
                LOWER(username) LIKE ? OR 
                LOWER(skills_teach) LIKE ? OR 
                LOWER(skills_learn) LIKE ?
            )`;
            const qStr = `%${searchQuery}%`;
            params = [qStr, qStr, qStr, qStr, qStr];
        }

        sql += ` ORDER BY is_premium DESC, id DESC LIMIT 50`;

        const users = await dbQuery.all(sql, params);

        const profiles = users.map(user => {
            let skillsTeach = [];
            if (user.skills_teach) {
                skillsTeach = user.skills_teach.split(',').map(s => s.trim()).filter(Boolean);
            }
            let skillsLearn = [];
            if (user.skills_learn) {
                skillsLearn = user.skills_learn.split(',').map(s => s.trim()).filter(Boolean);
            }

            return {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                role: user.role,
                bio: user.bio || '',
                avatar: user.avatar || '',
                skillsTeach,
                skillsLearn,
                isPremium: Boolean(user.is_premium)
            };
        });

        return res.status(200).json({
            success: true,
            profiles
        });

    } catch (error) {
        console.error('❌ Search Profiles Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Get Notifications Controller
exports.getNotifications = async (req, res) => {
    try {
        const callerUserId = req.headers['x-user-id'];
        if (!callerUserId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const notifications = await dbQuery.all(
            `SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30`,
            [callerUserId]
        );

        const unreadCountRow = await dbQuery.get(
            `SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0`,
            [callerUserId]
        );

        return res.status(200).json({
            success: true,
            notifications: notifications || [],
            unreadCount: unreadCountRow ? unreadCountRow.cnt : 0
        });

    } catch (error) {
        console.error('❌ Get Notifications Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

// Mark Notifications as Read Controller
exports.markNotificationsRead = async (req, res) => {
    try {
        const callerUserId = req.headers['x-user-id'];
        if (!callerUserId) {
            return res.status(400).json({ success: false, message: 'User ID is required in headers.' });
        }

        const { notificationId } = req.body || {};

        if (notificationId) {
            await dbQuery.run(
                `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
                [notificationId, callerUserId]
            );
        } else {
            await dbQuery.run(
                `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
                [callerUserId]
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Notifications marked as read.'
        });

    } catch (error) {
        console.error('❌ Mark Notifications Read Error:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};



