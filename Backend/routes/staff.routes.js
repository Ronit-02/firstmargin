const express = require('express');
const { validateToken, requireRoles } = require('../middlewares/auth.middleware');
const moderation = require('../controllers/moderation.controller');
const users = require('../controllers/staff-users.controller');

const router = express.Router();
router.use(validateToken, requireRoles('moderator', 'admin'));
router.get('/users', users.listUsers);
router.patch('/users/:userId/role', users.changeUserRole);
router.get('/reports', moderation.listReports);
router.post('/reports/:reportId/reviews', moderation.recordReview);

module.exports = router;
