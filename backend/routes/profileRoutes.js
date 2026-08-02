const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

// Profile routes
router.get('/', profileController.getProfile);
router.get('/search', profileController.searchProfiles);
router.get('/notifications', profileController.getNotifications);
router.post('/notifications/mark-read', profileController.markNotificationsRead);
router.post('/update', profileController.updateProfile);
router.post('/upload-avatar', profileController.uploadAvatar);
router.post('/complete-session', profileController.completeSession);
router.get('/transactions', profileController.getTransactions);

// Session Requests routes
router.get('/session-requests', profileController.getSessionRequests);
router.post('/session-requests', profileController.createSessionRequest);
router.post('/session-requests/update', profileController.updateSessionRequestStatus);
router.post('/book-paid-session', profileController.bookPaidSession);
router.post('/submit-session-payment', profileController.submitSessionPayment);

// Virtual Video Sessions routes
router.get('/active-sessions', profileController.getActiveSessions);
router.get('/session-details', profileController.getSessionDetails);

// Daily Video Call Limit & Premium routes
router.get('/daily-call-usage', profileController.getDailyCallUsage);
router.post('/call-heartbeat', profileController.recordCallHeartbeat);
router.post('/upgrade-premium', profileController.upgradeToPremium);

// Real UPI Payment Request & Admin Verification routes
router.post('/submit-payment-request', profileController.submitPaymentRequest);
router.get('/payment-status', profileController.getPaymentStatus);
router.get('/admin/payment-requests', profileController.requireAdmin, profileController.getAdminPaymentRequests);
router.post('/admin/verify-payment', profileController.requireAdmin, profileController.adminVerifyPayment);

// Teacher Application routes
router.post('/become-teacher', profileController.submitTeacherApplication);
router.get('/teacher-application', profileController.getTeacherApplication);
router.get('/admin/teacher-applications', profileController.requireAdmin, profileController.getAdminTeacherApplications);
router.post('/admin/teacher-application/action', profileController.requireAdmin, profileController.adminTeacherApplicationAction);

// Teacher Withdrawal routes
router.post('/withdraw-request', profileController.requireTeacher, profileController.submitWithdrawalRequest);
router.get('/withdrawals', profileController.requireTeacher, profileController.getWithdrawals);

module.exports = router;
