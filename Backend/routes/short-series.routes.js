const express = require('express');
const { optionalAuth, validateToken } = require('../middlewares/auth.middleware');
const { listSeries, getSeries, getEligibleShorts, getEligiblePosts, createSeries, updateSeries, deleteSeries, addSeriesItem, saveSeries, unsaveSeries } = require('../controllers/short-series.controller');

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
router.delete('/:id', validateToken, deleteSeries);

module.exports = router;
