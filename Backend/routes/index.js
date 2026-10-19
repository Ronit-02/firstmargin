const express = require('express');
const router  = express.Router();

const authRoute        = require('./auth.routes');
const postRoute        = require('./publication.routes');
const userRoute        = require('./user.routes');
const collectionRoute  = require('./collection.routes');
const questionRoute    = require('./question.routes');
const competitionRoute = require('./competition.routes');
const writerRoute      = require('./writer.routes');
const searchRoute      = require('./search.routes');
const v1Route          = require('./v1.routes');
const shortSeriesRoute = require('./short-series.routes');
const draftRoute = require('./draft.routes');
const staffRoute = require('./staff.routes');

router.get('/', (req, res) => res.send('API is running 🚀'));

router.use('/auth',        authRoute);
router.use('/post',        postRoute);
router.use('/publications', postRoute);
router.use('/user',        userRoute);
router.use('/collection',  collectionRoute);
router.use('/question',    questionRoute);
router.use('/competition', competitionRoute);
router.use('/writer',      writerRoute);
router.use('/search',      searchRoute);
router.use('/v1',          v1Route);
router.use('/short-series', shortSeriesRoute);
router.use('/series', shortSeriesRoute);
router.use('/drafts', draftRoute);
router.use('/staff', staffRoute);

module.exports = router;
