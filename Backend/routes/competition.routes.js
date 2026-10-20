const express       = require('express');
const router        = express.Router();
const { validateToken, optionalAuth, requireRoles } = require('../middlewares/auth.middleware');
const { createRateLimiter } = require('../middlewares/rate-limit.middleware');
const { upload, validateImageFile } = require('../middlewares/multer.middleware');
const { getCompetitions, getCompetitionById, getEligiblePosts, enterCompetition, removeEntry, voteEntry, removeEntryVote, createCompetition, updateCompetition, scoreEntry, publishResults, disqualifyEntry, submitAppeal, decideAppeal } = require('../controllers/competition.controller');

const competitionVoteLimiter = createRateLimiter({ windowMs: 60_000, max: 30, keyPrefix: 'competition-vote' });
const competitionUserVoteLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  keyPrefix: 'competition-vote-user',
  keyResolver: req => req.auth?.userId,
});

/* Public */
router.get('/',    optionalAuth, getCompetitions);
router.get('/:id/eligible-posts', validateToken, getEligiblePosts);
router.get('/:id', optionalAuth, getCompetitionById);

/* Auth required */
router.post('/:id/entries',                  validateToken, enterCompetition);
router.delete('/:id/entries/:entryId', validateToken, removeEntry);
router.post('/:id/entries/:entryId/disqualification', validateToken, requireRoles('moderator', 'admin'), disqualifyEntry);
router.post('/:id/entries/:entryId/appeals', validateToken, submitAppeal);
router.patch('/:id/appeals/:appealId', validateToken, requireRoles('moderator', 'admin'), decideAppeal);
router.put('/:id/entries/:entryId/vote',     validateToken, competitionVoteLimiter, competitionUserVoteLimiter, voteEntry);
router.delete('/:id/entries/:entryId/vote',  validateToken, competitionVoteLimiter, competitionUserVoteLimiter, removeEntryVote);
router.post('/', validateToken, requireRoles('admin'), upload.single('coverImageFile'), validateImageFile, createCompetition);
router.patch('/:id', validateToken, requireRoles('moderator', 'admin'), upload.single('coverImageFile'), validateImageFile, updateCompetition);
router.put('/:id/entries/:entryId/score', validateToken, requireRoles('moderator', 'admin'), scoreEntry);
router.post('/:id/results', validateToken, requireRoles('admin'), publishResults);

module.exports = router;
