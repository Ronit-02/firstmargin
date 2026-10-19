const express = require('express');
const router = express.Router();
const { validateToken, optionalAuth } = require('../middlewares/auth.middleware');
const { toggleFollow, toggleBookmark, toggleLike, addComment } = require('../controllers/user.controller');
const { createPost, updatePost, setPublication, getAllPosts, getPost, getDiscoveryFeed, getShortFeed, getDepthOptions, getEarlyAccessFeed, searchPost, searchCategory } = require('../controllers/publication.controller');
const {
  savePost,
  unsavePost,
  likePost,
  unlikePost,
  getComments,
  createComment,
  reportPost,
} = require('../controllers/engagement.controller');
const { upload, validateImageFile } = require('../middlewares/multer.middleware');

// Posts
router.get('/search', searchPost);
router.get('/search-cat', searchCategory);
router.get('/feed', optionalAuth, getDiscoveryFeed);
router.get('/shorts', optionalAuth, getShortFeed);
router.get('/depth-options', validateToken, getDepthOptions);
router.get('/early-access', validateToken, getEarlyAccessFeed);

router.post('/follow/:id',            validateToken, toggleFollow);
router.post('/bookmark/:publicationId',      validateToken, toggleBookmark);
router.post('/like/:publicationId',          validateToken, toggleLike);
router.post('/comment/:publicationId',       validateToken, addComment);

// Idempotent engagement routes used by the current client.
router.put('/:publicationId/bookmark',       validateToken, savePost);
router.delete('/:publicationId/bookmark',    validateToken, unsavePost);
router.put('/:publicationId/like',           validateToken, likePost);
router.delete('/:publicationId/like',        validateToken, unlikePost);
router.put('/:publicationId/appreciation',   validateToken, likePost);
router.delete('/:publicationId/appreciation', validateToken, unlikePost);
router.get('/:publicationId/comments',       optionalAuth, getComments);
router.post('/:publicationId/comments',      validateToken, createComment);
router.post('/:publicationId/reports',       validateToken, reportPost);

router.get('/', getAllPosts);

router.post('/', validateToken, upload.single('coverURL'), validateImageFile, createPost);
router.put('/:id', validateToken, updatePost);
router.patch('/:id/publication', validateToken, setPublication);
router.get('/:id', optionalAuth, getPost);

module.exports = router;
