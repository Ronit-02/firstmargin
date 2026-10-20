const express = require('express');
const { optionalAuth, validateToken } = require('../middlewares/auth.middleware');
const { listSeries, getSeries, getEligibleShorts, getEligiblePosts, createSeries, updateSeries, uploadSeriesCover, deleteSeries, addSeriesItem, saveSeries, unsaveSeries } = require('../controllers/short-series.controller');
const { upload, validateImageFile } = require('../middlewares/multer.middleware');

const router = express.Router();
router.get('/', optionalAuth, listSeries);
router.get('/eligible-shorts', validateToken, getEligibleShorts);
router.get('/eligible-posts', validateToken, getEligiblePosts);
router.get('/:id', optionalAuth, getSeries);
router.post('/', validateToken, createSeries);
router.post('/:id/items', validateToken, addSeriesItem);
router.put('/:id/save', validateToken, saveSeries);
router.delete('/:id/save', validateToken, unsaveSeries);
router.put('/:id', validateToken, updateSeries);
router.post('/:id/cover', validateToken, upload.single('coverImage'), validateImageFile, uploadSeriesCover);
router.delete('/:id', validateToken, deleteSeries);

module.exports = router;
