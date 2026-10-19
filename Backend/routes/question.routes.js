const express       = require('express');
const router        = express.Router();
const { validateToken, optionalAuth } = require('../middlewares/auth.middleware');
const { getQuestions, getQuestionDetail, getQuestionOpportunities, suggestQuestions, createQuestion, upvoteQuestion, removeQuestionUpvote, createAnswer, upvoteAnswer, removeAnswerUpvote, followQuestion, unfollowQuestion, reportQuestion, reportAnswer, claimQuestion, unclaimQuestion, declineQuestion, linkResponsePost } = require('../controllers/question.controller');

/* Public */
router.get('/suggest', suggestQuestions);
router.get('/opportunities', validateToken, getQuestionOpportunities);
router.get('/', optionalAuth, getQuestions);
router.get('/:id', optionalAuth, getQuestionDetail);

/* Auth required */
router.post('/',                validateToken, createQuestion);
router.put('/:id/upvote',       validateToken, upvoteQuestion);
router.delete('/:id/upvote',    validateToken, removeQuestionUpvote);
router.post('/:id/answers', validateToken, createAnswer);
router.put('/:id/answers/:answerId/upvote', validateToken, upvoteAnswer);
router.delete('/:id/answers/:answerId/upvote', validateToken, removeAnswerUpvote);
router.put('/:id/follow', validateToken, followQuestion);
router.delete('/:id/follow', validateToken, unfollowQuestion);
router.put('/:id/claim', validateToken, claimQuestion);
router.delete('/:id/claim', validateToken, unclaimQuestion);
router.post('/:id/decline', validateToken, declineQuestion);
router.post('/:id/reports', validateToken, reportQuestion);
router.post('/:id/answers/:answerId/reports', validateToken, reportAnswer);
router.put('/:id/responses/:publicationId', validateToken, linkResponsePost);

module.exports = router;
