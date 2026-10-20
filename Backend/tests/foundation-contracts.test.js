const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const mongoose = require('mongoose');

const requiredEnvironment = {
  FRONTEND_URL: 'http://localhost:3000',
  MONGO_USERNAME: 'test',
  MONGO_PASSWORD: 'test',
  DB_NAME: 'ink-rider-test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/ink-rider-test',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  CLOUDINARY_CLOUD_NAME: 'test',
  CLOUDINARY_API_KEY: 'test',
  CLOUDINARY_API_SECRET: 'test',
  EMAIL_HOST: 'localhost',
  EMAIL_PORT: '1025',
  EMAIL: 'test@example.com',
  EMAIL_PASSWORD: 'test',
  GOOGLE_CLIENT_ID: 'test',
  GOOGLE_CLIENT_SECRET: 'test',
  GOOGLE_REFRESH_TOKEN: 'test',
};

for (const [key, value] of Object.entries(requiredEnvironment)) {
  process.env[key] ||= value;
}

const { generateToken, verifyToken, generateOTP } = require('../utils/helper');
const { validateToken, optionalAuth } = require('../middlewares/auth.middleware');
const User = require('../schemas/user.schema');
const Publication = require('../schemas/publication.schema');
const Competition = require('../schemas/competition.schema');
const Question = require('../schemas/question.schema');
const OTP = require('../schemas/otp.schema');
const Session = require('../schemas/session.schema');
const RateLimitBucket = require('../schemas/rate-limit-bucket.schema');
const Profile = require('../schemas/profile.schema');
const Report = require('../schemas/report.schema');
const Topic = require('../schemas/topic.schema');
const UserInterest = require('../schemas/user-interest.schema');
const InteractionEvent = require('../schemas/interaction-event.schema');
const Collection = require('../schemas/collection.schema');
const ShortSeries = require('../schemas/short-series.schema');
const Membership = require('../schemas/membership.schema');
const Entitlement = require('../schemas/entitlement.schema');
const ProviderEvent = require('../schemas/provider-event.schema');
const PublicationSummary = require('../schemas/publication-summary.schema');
const Workshop = require('../schemas/workshop.schema');
const WorkshopAttendance = require('../schemas/workshop-attendance.schema');
const CreatorUpdate = require('../schemas/creator-update.schema');
const CreatorRequest = require('../schemas/creator-request.schema');
const Draft = require('../schemas/draft.schema');
const PublicationRevision = require('../schemas/publication-revision.schema');
const Notification = require('../schemas/notification.schema');
const NotificationDelivery = require('../schemas/notification-delivery.schema');
const ModerationAction = require('../schemas/moderation-action.schema');
const CompetitionAudit = require('../schemas/competition-audit.schema');
const CompetitionVote = require('../schemas/competition-vote.schema');
const AiUsage = require('../schemas/ai-usage.schema');
const { extractText, summarizeExtractively } = require('../services/summary.service');
const { mapSubscriptionStatus } = require('../controllers/billing.controller');
const { stripeRequest } = require('../services/stripe.service');
const { parseDraftInput } = require('../controllers/draft.controller');
const { extractOutputText } = require('../services/openai.service');
const { normalizeHandle, buildHandleCandidate } = require('../utils/handle');
const { encodeCursor, decodeCursor } = require('../utils/cursor');
const { rankCandidate, rankCandidates } = require('../services/recommendation.service');
const recommendationFixtures = require('../data/recommendation-fixtures');
const { evaluateRecommendationFixtures } = require('../services/recommendation.service');
const { normalizeQuestionText } = require('../utils/question');
const { effectiveStatus, isVotingOpen, canVoteEntry, competitionStatusCandidates, canScoreEntry, canPublishResults, publishResults, disqualifyEntry, decideAppeal, getCompetitionById } = require('../controllers/competition.controller');
const { createQuestion } = require('../controllers/question.controller');
const { getVoteSignals, getVoteRisk, analyzeVoteSignals, MAX_NETWORK_VOTES_PER_WINDOW, MAX_DEVICE_VOTES_PER_WINDOW, MIN_CROSS_ACCOUNT_VOTES } = require('../services/competition-fraud.service');
const { publicPostClause, canAccessPost } = require('../services/post-access.service');
const { createRateLimiter } = require('../middlewares/rate-limit.middleware');
const { createRequestTimingMiddleware, createMongoQueryDiagnostics, createErrorMonitor, getResponseBudgetMs } = require('../services/observability.service');
const { parsePostBody, isSafeImageUrl, parseLegacyPostListQuery } = require('../controllers/post.controller');
const { googleLogin, signup } = require('../controllers/auth.controller');
const { detectImageMime, validateImageFile } = require('../middlewares/multer.middleware');
const { MAX_ATTEMPTS, calculateRetryAt } = require('../services/notification-delivery.service');
const { judgeAverage, rankCompetitionEntries } = require('../services/competition-scoring.service');
const { buildRobotsTxt, buildSitemapXml, publicSitemapEntries } = require('../services/seo.service');
const { providerReadiness, hasConfiguredValue } = require('../services/provider-readiness.service');
const { withTransaction, withOptionalSession } = require('../utils/transaction');
const CompetitionAppeal = require('../schemas/competition-appeal.schema');
const app = require('../src/app');
const { getTagOptions } = require('../controllers/tag-options.controller');

test('tag choices expose bounded public metadata and escape literal searches', async t => {
  let pipeline;
  t.mock.method(Topic, 'find', filter => {
    assert.equal(filter.status, 'active');
    assert.ok(filter.$or[0].slug.test('c++'));
    assert.equal(filter.$or[0].slug.test('cccc'), false);
    return { sort: () => ({ limit: value => { assert.equal(value, 50); return { select: () => ({ lean: async () => [{ slug: 'c++', displayName: 'C++' }] }) }; } }) };
  });
  t.mock.method(Publication, 'aggregate', async stages => { pipeline = stages; return [{ _id: 'c++' }, { _id: 'custom' }, { _id: 'a,b' }]; });
  const res = createResponse();
  await getTagOptions({ query: { q: 'c++' } }, res);
  assert.deepEqual(res.payload.data, [{ value: 'c++', label: 'C++' }, { value: 'custom', label: 'custom' }]);
  assert.equal(pipeline[0].$match.publicationStatus.$ne, 'unpublished');
  assert.ok(pipeline[0].$match.$or[0].publicAt.$lte instanceof Date);
  assert.deepEqual(pipeline.at(-1), { $limit: 50 });
  assert.deepEqual(pipeline[1], { $project: { tags: 1 } });
});

test('tag lookup rejects overlong searches before reads and returns recoverable failures', async t => {
  const read = t.mock.method(Topic, 'find', () => { throw new Error('Unavailable'); });
  const invalid = createResponse();
  await getTagOptions({ query: { q: 'x'.repeat(61) } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(read.mock.callCount(), 0);
  const malformed = createResponse();
  await getTagOptions({ query: { q: ['two', 'queries'] } }, malformed);
  assert.equal(malformed.statusCode, 400);
  assert.equal(read.mock.callCount(), 0);
  const failed = createResponse();
  await getTagOptions({ query: {} }, failed);
  assert.equal(failed.statusCode, 500);
  assert.equal(failed.payload.message, 'Unable to load tag suggestions');
});

test('tag choices are readable by guests through the versioned route', async t => {
  t.mock.method(Topic, 'find', () => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => [{ slug: 'science', displayName: 'Science' }] }) }) }) }));
  t.mock.method(Publication, 'aggregate', async () => []);
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/tags`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, [{ value: 'science', label: 'Science' }]);
});

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

test('post deletion authenticates the versioned route and validates identifiers', async t => {
  const { deletePost } = require('../controllers/post-deletion.controller');
  const lookup = t.mock.method(Publication, 'findOne', () => { throw new Error('Unexpected database lookup'); });
  const invalid = createResponse();
  await deletePost({ params: { publicationId: 'invalid' }, auth: { userId: 'owner' } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(lookup.mock.callCount(), 0);
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/posts/507f1f77bcf86cd799439011`, { method: 'DELETE' });
  assert.equal(response.status, 401);
});

test('post deletion checks ownership before touching related records', async t => {
  const { deleteOwnedPost } = require('../services/post-deletion.service');
  const session = { withTransaction: work => work(), endSession: async () => {} };
  t.mock.method(mongoose, 'startSession', async () => session);
  let filter;
  t.mock.method(Publication, 'findOne', input => { filter = input; return { select: () => ({ session: async () => null }) }; });
  const remove = t.mock.method(Report, 'deleteMany', () => { throw new Error('Unauthorized cleanup'); });
  assert.equal(await deleteOwnedPost({ publicationId: 'post', userId: 'other' }), false);
  assert.deepEqual(filter, { _id: 'post', author: 'other' });
  assert.equal(remove.mock.callCount(), 0);
});

test('post deletion removes bounded comment batches and scoped relationships, retaining reviewed reports and revisions', async t => {
  const { deleteOwnedPost } = require('../services/post-deletion.service');
  const Comment = require('../schemas/comment.schema');
  const CommentAppreciation = require('../schemas/comment-appreciation.schema');
  const Appreciation = require('../schemas/appreciation.schema');
  const Save = require('../schemas/save.schema');
  const session = { withTransaction: work => work(), endSession: async () => {} };
  t.mock.method(mongoose, 'startSession', async () => session);
  t.mock.method(Publication, 'findOne', () => ({ select: () => ({ session: async () => ({ _id: 'post' }) }) }));
  const batches = [[{ _id: 'root' }, { _id: 'reply' }], [{ _id: 'deleted-placeholder' }], []];
  t.mock.method(Comment, 'find', filter => {
    assert.deepEqual(filter, { publicationId: 'post' });
    return { select: () => ({ limit: limit => {
      assert.equal(limit, 500);
      return { lean: () => ({ session: async () => batches.shift() }) };
    } }) };
  });
  const writes = [];
  for (const [name, model, method] of [['report', Report, 'deleteMany'], ['comment-like', CommentAppreciation, 'deleteMany'], ['comment', Comment, 'deleteMany'], ['like', Appreciation, 'deleteMany'], ['save', Save, 'deleteMany'], ['post', Publication, 'deleteOne']]) {
    t.mock.method(model, method, async (filter, options) => { assert.equal(options.session, session); writes.push({ name, filter }); return { deletedCount: 1 }; });
  }
  t.mock.method(PublicationRevision, 'deleteMany', () => { throw new Error('Historical revisions must survive'); });
  assert.equal(await deleteOwnedPost({ publicationId: 'post', userId: 'owner' }), true);
  assert.deepEqual(writes.filter(write => write.name === 'report').map(write => write.filter), [
    { subjectType: 'publication', subjectId: 'post', status: 'pending' },
    { subjectType: 'comment', subjectId: { $in: ['root', 'reply'] }, status: 'pending' },
    { subjectType: 'comment', subjectId: { $in: ['deleted-placeholder'] }, status: 'pending' },
  ]);
  assert.deepEqual(writes.filter(write => ['like', 'save'].includes(write.name)).map(write => write.filter), [{ publicationId: 'post' }, { publicationId: 'post' }]);
  assert.deepEqual(writes.at(-1), { name: 'post', filter: { _id: 'post', author: 'owner' } });
});

test('standalone cleanup failure preserves the owned post for retry', async t => {
  const { deleteOwnedPost } = require('../services/post-deletion.service');
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async () => { throw Object.assign(new Error('Transaction numbers are only allowed'), { code: 20 }); }, endSession: async () => {} }));
  t.mock.method(Publication, 'findOne', () => ({ select: async () => ({ _id: 'post' }) }));
  t.mock.method(Report, 'deleteMany', async () => { throw new Error('Cleanup unavailable'); });
  const remove = t.mock.method(Publication, 'deleteOne', async () => ({ deletedCount: 1 }));
  await assert.rejects(deleteOwnedPost({ publicationId: 'post', userId: 'owner' }), /Cleanup unavailable/);
  assert.equal(remove.mock.callCount(), 0);
});

test('validateToken exposes one normalized authenticated identity', async () => {
  const userId = '507f1f77bcf86cd799439011';
  const token = generateToken({ id: userId }, '1m');
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponse();
  let nextCalled = false;
  const originalFindById = User.findById;
  User.findById = () => ({ select: () => ({ lean: async () => ({ _id: userId, role: 'reader', accountStatus: 'active', verified: true }) }) });

  try {
    await validateToken(req, res, () => { nextCalled = true; });
  } finally {
    User.findById = originalFindById;
  }

  assert.equal(nextCalled, true);
  assert.deepEqual(req.auth, { userId, role: 'reader' });
  assert.equal(Object.isFrozen(req.auth), true);
  assert.equal('user' in req, false);
});

test('validateToken rejects requests without a bearer token', async () => {
  const req = { headers: {} };
  const res = createResponse();

  await validateToken(req, res, () => assert.fail('next must not be called'));

  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.success, false);
});

test('optionalAuth represents anonymous requests explicitly', async () => {
  const req = { headers: {} };
  const res = createResponse();
  let nextCalled = false;

  await optionalAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.auth, null);
});

test('personal and public writer profiles expose saved covers with a legacy null fallback', async t => {
  const { getMe } = require('../controllers/user.controller');
  const { getWriterByHandle } = require('../controllers/writer.controller');
  const userId = new mongoose.Types.ObjectId();
  const profile = { userId: { _id: userId, createdAt: new Date() }, handle: 'cover-writer', displayName: 'Writer', coverImageUrl: 'https://images.example.test/cover.png' };
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: userId, username: 'Writer' }) }));
  t.mock.method(Profile, 'findOne', () => ({ select: async () => profile, populate: async () => profile }));
  t.mock.method(Publication, 'countDocuments', async () => 0);
  t.mock.method(Publication, 'find', () => ({ sort: () => ({ select: async () => [] }) }));
  const response = () => ({ status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const personal = response();
  await getMe({ auth: { userId } }, personal);
  assert.equal(personal.body.data.coverImageUrl, profile.coverImageUrl);
  const publicProfile = response();
  await getWriterByHandle({ params: { handle: profile.handle } }, publicProfile);
  assert.equal(publicProfile.body.data.coverImageUrl, profile.coverImageUrl);
  delete profile.coverImageUrl;
  const legacy = response();
  await getMe({ auth: { userId } }, legacy);
  assert.equal(legacy.body.data.coverImageUrl, null);
});

test('profile cover updates validate actions and preserve avatar fields', async t => {
  const { updateProfileCover } = require('../controllers/user.controller');
  const userId = new mongoose.Types.ObjectId();
  const user = { _id: userId, picture: 'https://images.example.test/avatar.png' };
  const profile = { avatarUrl: user.picture, coverImageUrl: null, save: async () => {} };
  t.mock.method(User, 'findById', async id => { assert.equal(id, userId); return user; });
  t.mock.method(Profile, 'findOne', async filter => { assert.equal(filter.userId, userId); return profile; });
  const run = async body => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await updateProfileCover({ auth: { userId }, body }, response);
    return response;
  };
  for (const body of [{}, { coverImageUrl: 'javascript:alert(1)' }, { coverImageUrl: 'https://name:password@example.test/cover' }, { coverImageUrl: 'https://example.test/' + 'a'.repeat(2000) }, { coverImageUrl: 'https://images.example.test/cover.png', removeCover: 'true' }]) {
    assert.equal((await run(body)).statusCode, 400);
  }
  const saved = await run({ coverImageUrl: 'https://images.example.test/cover.png' });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.body.profile.coverImageUrl, 'https://images.example.test/cover.png');
  assert.equal((await run({ removeCover: 'true' })).body.profile.coverImageUrl, null);
  assert.equal(user.picture, 'https://images.example.test/avatar.png');
  assert.equal(profile.avatarUrl, user.picture);
  assert.equal(new Profile({ userId, handle: 'cover-writer', displayName: 'Writer' }).coverImageUrl, null);
});

test('profile cover uploads clean failed uploads and only replace owned managed covers', async t => {
  const { updateProfileCover } = require('../controllers/user.controller');
  const { profileCoverPublicIdFromUrl } = require('../utils/cloudinary');
  const cloudinary = require('cloudinary').v2;
  const config = require('../config/config');
  const userId = new mongoose.Types.ObjectId();
  const oldPublicId = `profile-covers/${userId}/old-cover`;
  const oldUrl = `https://res.cloudinary.com/${config.CLOUDINARY_CLOUD_NAME}/image/upload/v123/${oldPublicId}.png`;
  assert.equal(profileCoverPublicIdFromUrl(oldUrl, userId), oldPublicId);
  assert.equal(profileCoverPublicIdFromUrl(oldUrl, new mongoose.Types.ObjectId()), null);
  assert.equal(profileCoverPublicIdFromUrl(oldUrl.replace('profile-covers', 'profile-avatars'), userId), null);
  assert.equal(profileCoverPublicIdFromUrl('https://images.example.test/shared.png', userId), null);
  let failSave = false;
  const profile = { coverImageUrl: oldUrl, save: async () => { if (failSave) throw new Error('Save failed'); } };
  t.mock.method(User, 'findById', async () => ({ _id: userId }));
  t.mock.method(Profile, 'findOne', async () => profile);
  const publicId = `profile-covers/${userId}/new-cover`;
  t.mock.method(cloudinary.uploader, 'upload', async (_file, options) => { assert.equal(options.folder, `profile-covers/${userId}`); return { public_id: publicId, secure_url: `https://res.cloudinary.com/${config.CLOUDINARY_CLOUD_NAME}/image/upload/v124/${publicId}.png` }; });
  const removal = t.mock.method(cloudinary.uploader, 'destroy', async () => ({}));
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'profile-cover-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const run = async () => {
    const filePath = path.join(folder, crypto.randomUUID() + '.png');
    await fs.writeFile(filePath, 'validated test image');
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await updateProfileCover({ auth: { userId }, body: {}, file: { path: filePath } }, response);
    await assert.rejects(fs.access(filePath));
    return response;
  };
  assert.equal((await run()).statusCode, 200);
  assert.equal(removal.mock.calls[0].arguments[0], oldPublicId);
  failSave = true;
  assert.equal((await run()).statusCode, 500);
  assert.equal(removal.mock.calls[1].arguments[0], publicId);
});

test('profile cover route requires authentication', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/user/profile/cover`, { method: 'PUT' });
  assert.equal(response.status, 401);
});

test('user schema supports public profile biography and nullable external identity', () => {
  assert.ok(User.schema.path('bio'));

  const googleIndex = User.schema.indexes().find(([fields]) => fields.googleId === 1);
  assert.ok(googleIndex);
  assert.deepEqual(
    googleIndex[1].partialFilterExpression,
    { googleId: { $type: 'string' } }
  );
});

test('Google sign-in rejects an invalid credential without creating a session', async () => {
  const originalSessionCreate = require('../schemas/session.schema').create;
  let sessionCreated = false;
  const Session = require('../schemas/session.schema');
  Session.create = async () => { sessionCreated = true; };

  try {
    const response = createResponse();
    await googleLogin({ body: { credential: 'invalid-credential' }, requestId: 'google-invalid-test' }, response);

    assert.equal(response.statusCode, 401);
    assert.equal(response.payload.message, 'Google authentication failed');
    assert.equal(sessionCreated, false);
  } finally {
    Session.create = originalSessionCreate;
  }
});

test('cookie-authenticated endpoints reject cross-site browser origins', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/refresh-token`, {
    method: 'POST',
    headers: { origin: 'https://attacker.example' },
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).message, 'Request not allowed');
  const sameOriginResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/refresh-token`, {
    method: 'POST',
    headers: { origin: process.env.FRONTEND_URL },
  });
  assert.equal(sameOriginResponse.status, 401);
});

test('access and refresh tokens are purpose-bound and cryptographically separated', () => {
  const accessToken = generateToken({ id: '507f1f77bcf86cd799439011' }, '1m', 'access');
  const refreshToken = generateToken({ id: '507f1f77bcf86cd799439011', sessionId: crypto.randomUUID() }, '1m', 'refresh');
  assert.equal(verifyToken(accessToken, 'access').tokenUse, 'access');
  assert.equal(verifyToken(refreshToken, 'refresh').tokenUse, 'refresh');
  assert.throws(() => verifyToken(accessToken, 'refresh'));
  assert.throws(() => verifyToken(refreshToken, 'access'));
});

test('OTP and session schemas enforce bounded verification and expiry', () => {
  assert.equal(OTP.schema.path('failedAttempts').options.default, 0);
  assert.equal(OTP.schema.path('maxAttempts').options.default, 5);
  assert.match(generateOTP(), /^\d{6}$/);
  assert.ok(Session.schema.indexes().some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0));
  assert.ok(RateLimitBucket.schema.indexes().some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0));
});

test('signup does not disclose an existing account authentication method', async () => {
  const originalFindOne = User.findOne;
  User.findOne = query => query.email
    ? { select: async () => ({ googleId: 'google-sub' }) }
    : null;
  try {
    const response = createResponse();
    await signup({ body: { username: 'reader', email: 'reader@example.com', password: 'password123' } }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(response.payload.message, 'Email or username already in use');
  } finally {
    User.findOne = originalFindOne;
  }
});

test('post engagement counters match controller contracts', () => {
  assert.ok(Publication.schema.path('appreciationsCount'));
  assert.ok(Publication.schema.path('commentsCount'));
  assert.ok(Publication.schema.path('topics'));
  assert.deepEqual(Publication.schema.path('format').enumValues, ['story', 'short']);
  assert.ok(Publication.schema.path('depthParent'));
});

test('question popularity uses a sortable derived counter', () => {
  assert.ok(Question.schema.path('upvotesCount'));
  const popularityIndex = Question.schema.indexes()
    .find(([fields]) => fields.upvotesCount === -1 && fields.createdAt === -1);
  assert.ok(popularityIndex);
  const normalizedIndex = Question.schema.indexes().find(([fields, options]) => fields.normalizedText === 1 && options.unique);
  assert.ok(normalizedIndex);
  assert.equal(normalizeQuestionText('  How do I write? '), 'how do i write');
});

test('expired OTP records have a TTL index', () => {
  const ttlIndex = OTP.schema.indexes().find(([fields]) => fields.expiresAt === 1);
  assert.ok(ttlIndex);
  assert.equal(ttlIndex[1].expireAfterSeconds, 0);
});

test('writer story cards include viewer appreciation state in one batch read', async t => {
  const Profile = require('../schemas/profile.schema');
  const Publication = require('../schemas/publication.schema');
  const Follow = require('../schemas/follow.schema');
  const Appreciation = require('../schemas/appreciation.schema');
  const { getWriterByHandle } = require('../controllers/writer.controller');
  const Save = require('../schemas/save.schema');
  const authorId = new mongoose.Types.ObjectId();
  const publicationIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const posts = publicationIds.map(_id => ({ _id, title: 'A useful idea', tags: ['science'], appreciationsCount: 9, commentsCount: 2, body: JSON.stringify([{ type: 'text', content: 'The opening idea should appear on the author card.' }]) }));
  t.mock.method(Profile, 'findOne', () => ({ populate: async () => ({ handle: 'maya-sen', displayName: 'Maya Sen', userId: { _id: authorId } }) }));
  t.mock.method(Publication, 'find', () => ({ sort: () => ({ select: async () => posts }) }));
  t.mock.method(Follow, 'exists', async () => null);
  const reads = [];
  t.mock.method(Save, 'find', () => ({ select: () => ({ lean: async () => [{ publicationId: publicationIds[0] }] }) }));
  t.mock.method(Appreciation, 'find', filter => {
    reads.push(filter);
    return { select: () => ({ lean: async () => [{ publicationId: publicationIds[0] }] }) };
  });
  const viewerId = new mongoose.Types.ObjectId().toString();
  const member = createResponse();
  await getWriterByHandle({ params: { handle: 'maya-sen' }, auth: { userId: viewerId } }, member);
  assert.equal(member.statusCode, 200);
  assert.deepEqual(member.payload.data.posts.map(post => post.isAppreciated), [true, false]);
  assert.deepEqual(member.payload.data.posts.map(post => post.isBookmarked), [true, false]);
  assert.equal(member.payload.data.posts[0].appreciationsCount, 9);
  assert.equal(member.payload.data.posts[0].excerpt, 'The opening idea should appear on the author card.');
  assert.equal(reads.length, 1);
  assert.deepEqual(reads[0], { userId: viewerId, publicationId: { $in: publicationIds } });
  const guest = createResponse();
  await getWriterByHandle({ params: { handle: 'maya-sen' } }, guest);
  assert.deepEqual(guest.payload.data.posts.map(post => post.isAppreciated), [false, false]);
  assert.deepEqual(guest.payload.data.posts.map(post => post.isBookmarked), [false, false]);
  assert.equal(reads.length, 1);
});

test('series list previews include every visible ordered title without publication bodies', async t => {
  const { listSeries } = require('../controllers/short-series.controller');
  const items = Array.from({ length: 50 }, (_, position) => ({ position, publication: {
    _id: new mongoose.Types.ObjectId(), title: `Chapter ${position + 1}`, publicationStatus: 'published', body: 'Private response field',
  } }));
  const document = { _id: new mongoose.Types.ObjectId(), title: 'Reading path', type: 'story', visibility: 'public', author: { _id: new mongoose.Types.ObjectId(), username: 'Maya' }, items: [
    ...items.toReversed(),
    { position: 50, publication: { _id: new mongoose.Types.ObjectId(), title: 'Unpublished', publicationStatus: 'unpublished' } },
    { position: 51, publication: { _id: new mongoose.Types.ObjectId(), title: 'Future', publicAt: new Date(Date.now() + 86400000) } },
    { position: 52, publication: null },
  ] };
  const query = { populate() { return this; }, sort() { return this; }, async limit() { return [document]; } };
  t.mock.method(ShortSeries, 'find', () => query);
  t.mock.method(Profile, 'find', () => ({ select: async () => [] }));
  const response = createResponse();
  await listSeries({ query: { type: 'story' } }, response);
  assert.equal(response.statusCode, 200);
  const preview = response.payload.data[0];
  assert.equal(preview.entriesCount, 50);
  assert.deepEqual(preview.entriesPreview, items.map((item, index) => ({ id: item.publication._id, title: item.publication.title, position: index + 1 })));
  assert.equal(preview.entries, undefined);
});

test('discovery summaries preserve short formats and default legacy posts to articles', async t => {
  const { presentDiscoveryPosts } = require('../services/post-presenter.service');
  t.mock.method(Profile, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  const longText = 'A short preview continues with useful context. '.repeat(30);
  const posts = ['short', 'story', undefined].map(format => ({ _id: new mongoose.Types.ObjectId(), title: 'A morning idea', format, body: JSON.stringify([{ type: 'text', content: longText }]) }));
  const summaries = await presentDiscoveryPosts(posts);
  assert.deepEqual(summaries.map(post => post.format), ['short', 'story', 'story']);
  assert.deepEqual(summaries.map(post => post.id), posts.map(post => post._id));
  assert.equal(summaries[0].excerpt, longText.slice(0, 800));
  assert.equal(summaries[1].excerpt, longText.trim());
  assert.equal(summaries[2].excerpt, longText.trim());
});

test('owner short summaries include public author identity and viewer engagement without leaking bodies', async t => {
  const { getMyPosts } = require('../controllers/user.controller');
  const Save = require('../schemas/save.schema');
  const Appreciation = require('../schemas/appreciation.schema');
  const authorId = new mongoose.Types.ObjectId();
  const post = new Publication({ author: authorId, title: 'Owner short', format: 'short', body: '[{"type":"text","content":"A focused idea"}]' });
  post.author = new User({ _id: authorId, username: 'Maya' });
  t.mock.method(Publication, 'find', () => ({ select: () => ({ populate: () => ({ sort: async () => [post] }) }) }));
  t.mock.method(Profile, 'find', () => ({ select: () => ({ lean: async () => [{ userId: authorId, displayName: 'Maya Sen', handle: 'maya-custom', avatarUrl: null }] }) }));
  for (const model of [Appreciation, Save]) t.mock.method(model, 'find', filter => {
    assert.equal(filter.userId, authorId.toString());
    assert.deepEqual(filter.publicationId.$in, [post._id]);
    return { select: () => ({ lean: async () => [{ publicationId: post._id }] }) };
  });
  const response = createResponse();
  await getMyPosts({ auth: { userId: authorId.toString() } }, response);
  assert.equal(response.statusCode, 200);
  const summary = response.payload.data[0];
  assert.equal(summary.author.username, 'Maya Sen');
  assert.equal(summary.author.handle, 'maya-custom');
  assert.equal(summary.isAppreciated, true);
  assert.equal(summary.isBookmarked, true);
  assert.equal(summary.body, undefined);
  assert.equal(summary._id.toString(), post._id.toString());
});

test('published question responses use viewer-aware story summaries and retain legacy post identifiers', async t => {
  const { presentQuestions } = require('../controllers/question.controller');
  const authorId = new mongoose.Types.ObjectId();
  const publicationId = new mongoose.Types.ObjectId();
  const profile = { userId: authorId, displayName: 'Maya Sen', handle: 'maya-custom' };
  t.mock.method(Profile, 'find', () => ({ select: fields => fields === 'userId handle' ? Promise.resolve([profile]) : { lean: async () => [profile] } }));
  for (const model of [require('../schemas/appreciation.schema'), require('../schemas/save.schema')]) {
    t.mock.method(model, 'find', () => ({ select: () => ({ lean: async () => [{ publicationId }] }) }));
  }
  const question = { _id: new mongoose.Types.ObjectId(), author: { _id: authorId }, answers: [], upvotes: [], relatedPublications: [{ _id: publicationId, title: 'Response short', format: 'short', author: { _id: authorId, username: 'Maya' }, body: '[]', appreciationsCount: 3 }] };
  const [result] = await presentQuestions([question], authorId.toString());
  const response = result.responsePosts[0];
  assert.equal(response._id.toString(), publicationId.toString());
  assert.equal(response.format, 'short');
  assert.equal(response.author.handle, 'maya-custom');
  assert.equal(response.isAppreciated, true);
  assert.equal(response.isBookmarked, true);
  assert.equal(response.appreciationsCount, 3);
  assert.equal(response.body, undefined);
});

test('writer handles normalize into durable URL identifiers', () => {
  assert.equal(normalizeHandle("Élodie O'Connor"), 'elodie-o-connor');
  assert.equal(normalizeHandle('  '), 'writer');
  assert.equal(buildHandleCandidate('elodie-o-connor', 1), 'elodie-o-connor-2');
  assert.ok(buildHandleCandidate('a'.repeat(30), 99).length <= 30);
});

test('profile schema owns unique user and handle identities', () => {
  const indexes = Profile.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.userId === 1 && options.unique));
  assert.ok(indexes.some(([fields, options]) => fields.handle === 1 && options.unique));
});

test('reports use bounded reasons and prevent duplicate subjects per reporter', () => {
  assert.ok(Report.reportReasons.includes('spam'));
  assert.ok(Report.reportReasons.includes('toxicity'));
  const dedupeIndex = Report.schema.indexes().find(([fields, options]) => (
    fields.reporterId === 1
    && fields.subjectType === 1
    && fields.subjectId === 1
    && options.unique
  ));
  assert.ok(dedupeIndex);
  assert.ok(Report.schema.path('subjectType').enumValues.includes('answer'));
});

test('discovery cursors round-trip structured pagination state', () => {
  const state = {
    createdAt: '2026-08-18T12:00:00.000Z',
    id: '507f1f77bcf86cd799439011',
  };
  assert.deepEqual(decodeCursor(encodeCursor(state)), state);
  assert.equal(decodeCursor('not-valid-json'), null);
});

test('personalization models preserve canonical and append-only source records', () => {
  assert.ok(Topic.schema.indexes().some(([fields, options]) => fields.slug === 1 && options.unique));
  assert.ok(UserInterest.schema.indexes().some(([fields, options]) => (
    fields.userId === 1 && fields.topicId === 1 && options.unique
  )));
  assert.ok(InteractionEvent.eventTypes.includes('impression'));
  assert.ok(InteractionEvent.eventTypes.includes('complete'));
  assert.ok(InteractionEvent.schema.indexes().some(([fields, options]) => fields.eventId === 1 && options.unique));
});

test('collections preserve explicit item order, visibility, and repairable save counts', () => {
  assert.ok(Collection.schema.path('items'));
  assert.ok(Collection.schema.path('visibility'));
  assert.ok(Collection.schema.path('savedCount'));
  assert.ok(Collection.schema.path('followersCount'));
  assert.ok(Collection.schema.indexes().some(([fields]) => fields.visibility === 1 && fields.createdAt === -1));
});

test('short series retain ordered progression and allow shared posts', () => {
  assert.ok(ShortSeries.schema.path('items'));
  assert.ok(ShortSeries.schema.path('visibility'));
  assert.deepEqual(ShortSeries.schema.path('type').enumValues, ['story', 'short']);
  assert.equal(new ShortSeries({ title: 'Legacy series' }).type, 'short');
  assert.ok(!ShortSeries.schema.indexes().some(([fields, options]) => fields['items.publication'] === 1 && options.unique));
});

test('series creation scopes existing published posts to one format', async t => {
  const { createSeries } = require('../controllers/short-series.controller');
  const authorId = new mongoose.Types.ObjectId().toString();
  const publicationIds = [new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId().toString()];
  let requestedPosts;
  let created;
  t.mock.method(Publication, 'find', query => {
    requestedPosts = query;
    return { select: async () => publicationIds.map(id => ({ _id: id })) };
  });
  t.mock.method(ShortSeries, 'create', async value => { created = value; return { _id: new mongoose.Types.ObjectId() }; });
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await createSeries({ auth: { userId: authorId }, body: { title: 'A reading path', type: 'story', publicationIds } }, response);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(requestedPosts.format, { $in: ['story', null] });
  assert.deepEqual(requestedPosts.publicationStatus, { $ne: 'unpublished' });
  assert.equal(created.type, 'story');
  assert.deepEqual(created.items.map(item => item.publication), publicationIds);
  t.mock.restoreAll();
});

test('series creation rejects a mixed-format selection', async t => {
  const { createSeries } = require('../controllers/short-series.controller');
  const publicationIds = [new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId().toString()];
  t.mock.method(Publication, 'find', () => ({ select: async () => [{ _id: publicationIds[0] }] }));
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await createSeries({ auth: { userId: new mongoose.Types.ObjectId().toString() }, body: { title: 'Mixed parts', type: 'story', publicationIds } }, response);
  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /published stories/);
});

test('series eligible-post route ignores Express next and honors story or short query type', async t => {
  const { getEligiblePosts } = require('../controllers/short-series.controller');
  const authorId = new mongoose.Types.ObjectId().toString();
  const requestedPosts = [];
  t.mock.method(Publication, 'find', query => {
    requestedPosts.push(query);
    return { sort: () => ({ select: async () => [] }) };
  });
  const makeResponse = () => ({ status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const articleResponse = makeResponse();
  const shortResponse = makeResponse();
  await getEligiblePosts({ query: { type: 'story' }, auth: { userId: authorId } }, articleResponse, () => {});
  await getEligiblePosts({ query: { type: 'short' }, auth: { userId: authorId } }, shortResponse, () => {});
  assert.equal(articleResponse.statusCode, 200);
  assert.equal(shortResponse.statusCode, 200);
  assert.deepEqual(requestedPosts[0].format, { $in: ['story', null] });
  assert.equal(requestedPosts[1].format, 'short');
  assert.equal(Object.hasOwn(requestedPosts[0], '_id'), false);
  t.mock.restoreAll();
});

test('series item append keeps owner, format, release, capacity, and membership rules', async t => {
  const { addSeriesItem } = require('../controllers/short-series.controller');
  const authorId = new mongoose.Types.ObjectId().toString();
  const seriesId = new mongoose.Types.ObjectId().toString();
  const publicationId = new mongoose.Types.ObjectId();
  const series = { _id: new mongoose.Types.ObjectId(seriesId), type: 'story', items: [{ publication: new mongoose.Types.ObjectId(), position: 0 }, { publication: new mongoose.Types.ObjectId(), position: 1 }] };
  let requestedPost;
  let update;
  t.mock.method(ShortSeries, 'findOne', query => {
    assert.equal(query.author, authorId);
    return { select: async () => series };
  });
  t.mock.method(Publication, 'findOne', query => {
    requestedPost = query;
    return { select: async () => ({ _id: publicationId }) };
  });
  t.mock.method(ShortSeries, 'updateOne', async (filter, operation) => { update = { filter, operation }; return { modifiedCount: 1 }; });
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await addSeriesItem({ params: { id: seriesId }, auth: { userId: authorId }, body: { publicationId: publicationId.toString() } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.added, true);
  assert.equal(requestedPost.author, authorId);
  assert.deepEqual(requestedPost.format, { $in: ['story', null] });
  assert.deepEqual(requestedPost.publicationStatus, { $ne: 'unpublished' });
  assert.equal(update.operation.$push.items.publication.toString(), publicationId.toString());
  assert.equal(update.operation.$push.items.position, 2);
  t.mock.restoreAll();
});

test('deterministic recommendations prioritize explicit affinity and expose reasons', () => {
  const asOf = new Date('2026-08-18T12:00:00.000Z');
  const context = {
    asOf,
    interestTopicIds: new Set(['topic-technology']),
    followedWriterIds: new Set(['writer-followed']),
  };
  const followed = rankCandidate({
    _id: 'post-followed', author: { _id: 'writer-followed', username: 'Asha' },
    topics: [], createdAt: asOf, appreciationsCount: 0,
  }, context);
  const unrelated = rankCandidate({
    _id: 'post-other', author: { _id: 'writer-other', username: 'Ben' },
    topics: [], createdAt: asOf, appreciationsCount: 0,
  }, context);
  assert.ok(followed.score > unrelated.score);
  assert.equal(followed.reason, 'Because you follow Asha');
});

test('recommendation diversity avoids consecutive author repetition when alternatives exist', () => {
  const asOf = new Date('2026-08-18T12:00:00.000Z');
  const posts = [
    { _id: '1', author: { _id: 'same' }, topics: [], createdAt: asOf, appreciationsCount: 100 },
    { _id: '2', author: { _id: 'same' }, topics: [], createdAt: asOf, appreciationsCount: 90 },
    { _id: '3', author: { _id: 'different' }, topics: [], createdAt: asOf, appreciationsCount: 1 },
  ];
  const ranked = rankCandidates(posts, { asOf, interestTopicIds: new Set(), followedWriterIds: new Set() });
  assert.notEqual(ranked[0].authorId, ranked[1].authorId);
});

test('offline recommendation fixtures report relevance and diversity metrics', () => {
  const results = evaluateRecommendationFixtures(recommendationFixtures);
  assert.equal(results.length, 2);
  assert.ok(results.every(result => result.metrics.precisionAtLimit >= 0.5));
  assert.ok(results.every(result => result.metrics.authorDiversity >= 0.75));
  assert.ok(results.every(result => result.metrics.topicDiversity >= 0.75));
  assert.ok(results.every(result => result.metrics.maxConsecutiveAuthor <= 2));
});

test('competition entries expose stored profile handles in one batch', async () => {
  const originalCompetitionFind = Competition.findById;
  const originalProfileFind = Profile.find;
  const author = new User({ _id: '507f1f77bcf86cd799439013', username: 'Maya Sen' });
  const competition = { _id: '507f1f77bcf86cd799439011', status: 'closed', entries: [{ _id: '507f1f77bcf86cd799439012', author, publication: null, votes: [], judgeScores: [] }], winnerEntryIds: [] };
  const query = { populate: () => query, then: resolve => Promise.resolve(competition).then(resolve) };
  Competition.findById = () => query;
  let profileReads = 0;
  Profile.find = filter => {
    profileReads += 1;
    assert.deepEqual(filter, { userId: { $in: [author._id.toString()] } });
    return { select: fields => {
      assert.equal(fields, 'userId handle');
      return { lean: async () => [{ userId: author._id, handle: 'maya-custom-handle' }] };
    } };
  };
  try {
    const response = createResponse();
    await getCompetitionById({ params: { id: competition._id } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.data.entries[0].author.handle, 'maya-custom-handle');
    assert.equal(response.payload.data.entries[0].author.username, 'Maya Sen');
    assert.equal(profileReads, 1);
  } finally {
    Competition.findById = originalCompetitionFind;
    Profile.find = originalProfileFind;
  }
});

test('competition lifecycle derives deadline states without trusting stale labels', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');
  assert.equal(effectiveStatus({ status: 'open', openDate: new Date('2026-08-19'), closeDate: new Date('2026-08-20') }, now), 'draft');
  assert.equal(effectiveStatus({ status: 'open', openDate: new Date('2026-08-01'), closeDate: new Date('2026-08-18') }, now), 'judging');
  assert.equal(effectiveStatus({ status: 'judging', openDate: new Date('2026-08-01'), closeDate: new Date('2026-08-20') }, now), 'open');
  assert.equal(effectiveStatus({ status: 'draft', openDate: new Date('2026-08-01'), closeDate: new Date('2026-08-20') }, now), 'open');
  assert.equal(effectiveStatus({ status: 'judging', resultsDate: new Date('2026-08-17') }, now), 'closed');
  assert.deepEqual(competitionStatusCandidates('judging'), ['open', 'judging']);
  assert.deepEqual(competitionStatusCandidates('closed'), ['judging', 'closed']);
  const closed = { status: 'judging', resultsDate: new Date('2026-08-17') };
  assert.deepEqual(canScoreEntry(closed, { status: 'submitted' }, now), { allowed: false, reason: 'COMPETITION_CLOSED' });
  const openCompetition = { status: 'open', openDate: new Date('2026-08-01'), closeDate: new Date('2026-08-20'), resultsDate: null };
  assert.deepEqual(canScoreEntry(openCompetition, { status: 'disqualified' }, now), { allowed: false, reason: 'ENTRY_DISQUALIFIED' });
  assert.equal(canPublishResults(openCompetition, now), false);
  assert.equal(canPublishResults({ ...openCompetition, closeDate: new Date('2026-08-17') }, now), true);
  assert.equal(canPublishResults({ ...openCompetition, status: 'judging', closeDate: new Date('2026-08-17'), resultsDate: new Date('2026-08-19') }, now), true);
});

test('competition voting rejects self-votes, closed contests, duplicate votes, and disqualified entries', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');
  const openCompetition = { status: 'open', openDate: new Date('2026-08-01'), closeDate: new Date('2026-08-20'), resultsDate: null };
  const entry = { author: 'writer-a', votes: ['reader-b'] };
  assert.equal(isVotingOpen(openCompetition, now), true);
  assert.deepEqual(canVoteEntry(openCompetition, { ...entry, votes: [] }, 'writer-a', now), { allowed: false, reason: 'SELF_VOTE' });
  assert.deepEqual(canVoteEntry(openCompetition, entry, 'reader-b', now), { allowed: false, reason: 'ALREADY_VOTED' });
  assert.deepEqual(canVoteEntry(openCompetition, { ...entry, status: 'disqualified', votes: [] }, 'reader-c', now), { allowed: false, reason: 'ENTRY_DISQUALIFIED' });
  assert.deepEqual(canVoteEntry({ ...openCompetition, resultsDate: new Date('2026-08-18T11:00:00.000Z') }, { ...entry, votes: [] }, 'reader-c', now), { allowed: false, reason: 'VOTING_CLOSED' });
  assert.deepEqual(canVoteEntry({ ...openCompetition, votingMode: 'judges' }, { ...entry, votes: [] }, 'reader-c', now), { allowed: false, reason: 'VOTING_CLOSED' });
});

test('competition judging and disqualification operations respect lifecycle phases', async () => {
  const now = new Date('2026-08-18T12:00:00.000Z');
  const openCompetition = { status: 'open', openDate: new Date('2026-08-01'), closeDate: new Date('2026-08-20'), resultsDate: null };
  assert.deepEqual(canScoreEntry(openCompetition, { status: 'submitted' }, now), { allowed: false, reason: 'COMPETITION_NOT_JUDGING' });
  assert.deepEqual(canScoreEntry({ ...openCompetition, closeDate: new Date('2026-08-17') }, { status: 'submitted' }, now), { allowed: true, reason: null });

  const originalFindById = Competition.findById;
  const originalAuditCreate = CompetitionAudit.create;
  const entry = { _id: '507f1f77bcf86cd799439012', status: 'submitted', author: '507f1f77bcf86cd799439013' };
  const competition = {
    status: 'open',
    openDate: new Date('2026-08-01'),
    closeDate: new Date('2026-08-20'),
    resultsDate: null,
    winnerEntryIds: [],
    entries: { id: id => id === entry._id ? entry : null },
    save: async () => {},
  };
  Competition.findById = async () => competition;
  CompetitionAudit.create = async () => {};
  try {
    const response = createResponse();
    await disqualifyEntry({ params: { id: '507f1f77bcf86cd799439011', entryId: entry._id }, body: { reason: 'Policy violation' }, auth: { userId: '507f1f77bcf86cd799439014' } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.data.status, 'disqualified');

    const duplicate = createResponse();
    await disqualifyEntry({ params: { id: '507f1f77bcf86cd799439011', entryId: entry._id }, body: { reason: 'Another reason' }, auth: { userId: '507f1f77bcf86cd799439014' } }, duplicate);
    assert.equal(duplicate.statusCode, 409);
  } finally {
    Competition.findById = originalFindById;
    CompetitionAudit.create = originalAuditCreate;
  }
});

test('accepted competition appeals cannot change published results and require a decision note', async () => {
  const originalAppealFindOne = CompetitionAppeal.findOne;
  const originalCompetitionFindById = Competition.findById;
  const appeal = { status: 'pending', entryId: '507f1f77bcf86cd799439012' };
  const competition = {
    status: 'closed',
    openDate: new Date('2026-08-01'),
    closeDate: new Date('2026-08-17'),
    resultsDate: new Date('2026-08-18'),
    entries: { id: () => ({ author: '507f1f77bcf86cd799439013', status: 'disqualified' }) },
  };
  CompetitionAppeal.findOne = async () => appeal;
  Competition.findById = async () => competition;
  try {
    const missingNote = createResponse();
    await decideAppeal({ params: { id: '507f1f77bcf86cd799439011', appealId: '507f1f77bcf86cd799439015' }, body: { decision: 'accepted' }, auth: { userId: '507f1f77bcf86cd799439014' } }, missingNote);
    assert.equal(missingNote.statusCode, 400);

    const closedResults = createResponse();
    await decideAppeal({ params: { id: '507f1f77bcf86cd799439011', appealId: '507f1f77bcf86cd799439015' }, body: { decision: 'accepted', note: 'Evidence reviewed' }, auth: { userId: '507f1f77bcf86cd799439014' } }, closedResults);
    assert.equal(closedResults.statusCode, 409);
    assert.equal(closedResults.payload.message, 'Published competition results cannot be changed by an appeal');
  } finally {
    CompetitionAppeal.findOne = originalAppealFindOne;
    Competition.findById = originalCompetitionFindById;
  }
});

test('competition results endpoint refuses to publish before judging begins', async () => {
  const originalFindById = Competition.findById;
  Competition.findById = async () => ({
    status: 'open',
    openDate: new Date('2026-08-01'),
    closeDate: new Date('2099-08-20'),
    resultsDate: null,
  });
  try {
    const response = createResponse();
    await publishResults({
      params: { id: '507f1f77bcf86cd799439011' },
      body: { winnerEntryIds: ['507f1f77bcf86cd799439012'] },
    }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(response.payload.message, 'Results can only be published after voting closes');
  } finally {
    Competition.findById = originalFindById;
  }
});

test('rate limiters can isolate authenticated accounts sharing one network address', () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 1,
    keyPrefix: 'test-account-limit',
    keyResolver: req => req.auth.userId,
  });
  const call = userId => {
    let nextCalled = false;
    let statusCode = 200;
    const response = {
      setHeader: () => {},
      status: code => { statusCode = code; return response; },
      json: () => response,
    };
    limiter({ ip: 'shared-network', auth: { userId } }, response, () => { nextCalled = true; });
    return { nextCalled, statusCode };
  };

  assert.deepEqual(call('user-a'), { nextCalled: true, statusCode: 200 });
  assert.deepEqual(call('user-b'), { nextCalled: true, statusCode: 200 });
  assert.deepEqual(call('user-a'), { nextCalled: false, statusCode: 429 });
});

test('competition ranking is deterministic and preserves tied ranks', () => {
  const entries = [
    { _id: 'entry-b', votesCount: 4, createdAt: new Date('2026-08-01'), judgeScores: [] },
    { _id: 'entry-a', votesCount: 4, createdAt: new Date('2026-08-02'), judgeScores: [] },
    { _id: 'entry-c', votesCount: 1, createdAt: new Date('2026-08-03'), judgeScores: [] },
  ];
  const ranking = rankCompetitionEntries(entries, 'readers');
  assert.deepEqual(ranking.map(item => [item.id, item.rank]), [['entry-b', 1], ['entry-a', 1], ['entry-c', 3]]);
  assert.equal(judgeAverage({ judgeScores: [{ craft: 8, originality: 7, relevance: 9 }] }), 8);
});

test('competition disqualification and appeals are durable and auditable', () => {
  assert.ok(Competition.schema.path('entries.status').enumValues.includes('disqualified'));
  assert.ok(CompetitionAppeal.schema.indexes().some(([fields, options]) => fields.competitionId === 1 && fields.entryId === 1 && fields.appellantId === 1 && options.unique));
  assert.ok(CompetitionAudit.schema.path('action').enumValues.includes('entry_disqualified'));
  assert.ok(CompetitionAudit.schema.path('action').enumValues.includes('appeal_decided'));
  assert.ok(CompetitionAudit.schema.path('action').enumValues.includes('fraud_reviewed'));
});

test('competition vote fraud signals are durable without storing raw network identity', () => {
  assert.ok(CompetitionVote.schema.path('ipHash'));
  assert.ok(CompetitionVote.schema.path('userAgentHash'));
  assert.equal(CompetitionVote.schema.path('ipHash').options.select, undefined);
  assert.ok(CompetitionVote.schema.indexes().some(([fields, options]) => fields.competitionId === 1 && fields.voterId === 1 && fields.entryId === 1 && options.unique));
  assert.equal(MAX_NETWORK_VOTES_PER_WINDOW, 10);
  assert.equal(MAX_DEVICE_VOTES_PER_WINDOW, 8);
  const signals = getVoteSignals({ ip: '203.0.113.10', get: () => 'browser-a' });
  assert.equal(signals.ipHash.length, 64);
  assert.equal(signals.userAgentHash.length, 64);
  assert.notEqual(signals.ipHash, '203.0.113.10');
});

test('competition vote risk blocks a device burst even when the network threshold is not reached', async () => {
  const originalCountDocuments = CompetitionVote.countDocuments;
  CompetitionVote.countDocuments = async query => query.ipHash ? 2 : 8;
  try {
    const risk = await getVoteRisk({ competitionId: 'competition-1', ipHash: 'ip-hash', userAgentHash: 'device-hash' });
    assert.equal(risk.blocked, true);
    assert.equal(risk.reason, 'DEVICE_BURST');
    assert.equal(risk.count, 2);
    assert.equal(risk.deviceCount, 8);
  } finally {
    CompetitionVote.countDocuments = originalCountDocuments;
  }
});

test('competition fraud analysis exposes cross-account concentration without raw identifiers', () => {
  const now = new Date('2026-08-24T12:00:00.000Z');
  const votes = [1, 2, 3, 4].map(index => ({
    competitionId: 'competition-1',
    voterId: `voter-${index}`,
    ipHash: 'network-hash',
    userAgentHash: `device-${index}`,
    createdAt: new Date(now.getTime() - index * 1000),
  }));
  votes.push({
    competitionId: 'competition-1',
    voterId: 'old-voter',
    ipHash: 'network-hash',
    userAgentHash: 'old-device',
    createdAt: new Date(now.getTime() - 11 * 60 * 1000),
  });

  const signals = analyzeVoteSignals({ votes, now });
  assert.equal(MIN_CROSS_ACCOUNT_VOTES, 4);
  assert.deepEqual(signals, [{
    competitionId: 'competition-1',
    signalType: 'NETWORK',
    distinctVoterCount: 4,
    voteCount: 4,
    windowMs: 10 * 60 * 1000,
    reason: 'CROSS_ACCOUNT_SIGNAL',
  }]);
  assert.equal(JSON.stringify(signals).includes('network-hash'), false);
  assert.equal(JSON.stringify(signals).includes('voter-1'), false);
});

test('SEO discovery artifacts expose only public routes and escape XML values', () => {
  const robots = buildRobotsTxt('https://inkrider.example/');
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Disallow: \/staff/);
  assert.match(robots, /Sitemap: https:\/\/inkrider\.example\/sitemap\.xml/);

  const entries = publicSitemapEntries({
    posts: [{ _id: 'post-1', publicAt: '2026-08-25T00:00:00.000Z' }],
    profiles: [{ handle: 'maya & sen', updatedAt: '2026-08-25T00:00:00.000Z' }],
  });
  const sitemap = buildSitemapXml({ siteUrl: 'https://inkrider.example', entries });
  assert.match(sitemap, /<loc>https:\/\/inkrider\.example\/post\/post-1<\/loc>/);
  assert.match(sitemap, /maya%20%26%20sen/);
  assert.equal(sitemap.includes('<script>'), false);
});

test('provider readiness reports capability booleans without exposing credential values', () => {
  const readiness = providerReadiness({
    CLOUDINARY_CLOUD_NAME: 'cloud', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret',
    EMAIL_HOST: 'smtp.example', EMAIL_PORT: '587', EMAIL: 'writer@example.test', EMAIL_PASSWORD: 'password',
    GOOGLE_CLIENT_ID: 'google-client', STRIPE_SECRET_KEY: 'stripe-key', STRIPE_MEMBERSHIP_PRICE_ID: 'price',
    STRIPE_WEBHOOK_SECRET: 'webhook', OPENAI_API_KEY: 'openai-key', ERROR_MONITOR_URL: 'https://monitor.example', PUSH_PROVIDER_URL: 'https://push.example',
  });
  assert.equal(readiness.configured, readiness.total);
  assert.deepEqual(readiness.missing, []);
  assert.equal(JSON.stringify(readiness).includes('stripe-key'), false);
  assert.equal(JSON.stringify(readiness).includes('openai-key'), false);
  assert.equal(JSON.stringify(readiness).includes('password'), false);
});

test('provider readiness recognizes Gmail OAuth as an email delivery alternative to SMTP', () => {
  const readiness = providerReadiness({
    EMAIL_HOST: 'smtp.gmail.com',
    EMAIL_PORT: '465',
    EMAIL: 'writer@example.test',
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GOOGLE_REFRESH_TOKEN: 'refresh-token',
  });
  assert.equal(readiness.checks.email, true);
  assert.equal(readiness.checks.googleSignIn, true);

  const incomplete = providerReadiness({
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
  });
  assert.equal(incomplete.checks.email, false);

  const invalidPort = providerReadiness({
    EMAIL_HOST: 'smtp.gmail.com',
    EMAIL_PORT: 'not-a-port',
    EMAIL: 'writer@example.test',
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GOOGLE_REFRESH_TOKEN: 'refresh-token',
  });
  assert.equal(invalidPort.checks.email, false);

  assert.equal(providerReadiness({ ERROR_MONITOR_URL: 'https://monitor.example.test/ingest' }).checks.errorMonitor, true);
  assert.equal(providerReadiness({ ERROR_MONITOR_URL: 'monitor.example.test/ingest' }).checks.errorMonitor, false);
  assert.equal(hasConfiguredValue('   '), false);
  assert.equal(providerReadiness({ OPENAI_API_KEY: '   ', STRIPE_SECRET_KEY: ' ', STRIPE_MEMBERSHIP_PRICE_ID: 'price' }).checks.openAiWritingAssistant, false);
  assert.equal(providerReadiness({ GOOGLE_CLIENT_ID: '   ' }).checks.googleSignIn, false);
});

test('Stripe provider requests abort at the bounded provider timeout', async () => {
  await assert.rejects(
    stripeRequest('checkout/sessions', {}, {
      secretKey: 'test-stripe-key',
      timeoutMs: 1,
      fetchImpl: (_url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
    }),
    error => error.code === 'PROVIDER_TIMEOUT' && error.message === 'Stripe request timed out',
  );
});

test('question targeting accepts only writer profiles', async () => {
  const originalCountDocuments = Profile.countDocuments;
  Profile.countDocuments = async () => 0;
  try {
    const response = createResponse();
    await createQuestion({
      auth: { userId: '507f1f77bcf86cd799439011' },
      body: {
        text: 'How can a reader build a better writing habit?',
        targetWriterIds: ['507f1f77bcf86cd799439012'],
      },
    }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.message, 'One or more target writers could not be found');
  } finally {
    Profile.countDocuments = originalCountDocuments;
  }
});

test('unknown routes return a normalized error and request id', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/missing`);
  const body = await response.json();
  const robotsResponse = await fetch(`http://127.0.0.1:${address.port}/robots.txt`);
  const robots = await robotsResponse.text();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
  assert.equal(body.error.requestId, response.headers.get('x-request-id'));
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
  const oversizedRequestId = 'a'.repeat(200);
  const rejectedRequestId = await fetch(`http://127.0.0.1:${address.port}/missing`, { headers: { 'x-request-id': oversizedRequestId } });
  assert.notEqual(rejectedRequestId.headers.get('x-request-id'), oversizedRequestId);
  assert.equal(robotsResponse.status, 200);
  const expectedSitemapUrl = new URL('/sitemap.xml', process.env.FRONTEND_URL).toString();
  assert.ok(robots.includes(`Sitemap: ${expectedSitemapUrl}`));
});

test('legacy post listing bounds pages and validates sort-aware cursors', () => {
  assert.deepEqual(parseLegacyPostListQuery({}), {
    sort: 'date',
    sortField: 'createdAt',
    limit: 24,
    cursor: null,
  });
  assert.equal(parseLegacyPostListQuery({ limit: '1000' }).limit, 100);
  assert.equal(parseLegacyPostListQuery({ sort: 'unknown' }), null);
  assert.equal(parseLegacyPostListQuery({ cursor: 'invalid' }), null);

  const cursor = encodeCursor({ id: '507f1f77bcf86cd799439011', value: '2026-08-18T12:00:00.000Z' });
  const parsed = parseLegacyPostListQuery({ cursor });
  assert.equal(parsed.sort, 'date');
  assert.ok(parsed.cursor.value instanceof Date);
});

test('validateToken rejects suspended accounts even with a valid access token', async () => {
  const userId = '507f1f77bcf86cd799439011';
  const token = generateToken({ id: userId }, '1m');
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponse();
  const originalFindById = User.findById;
  User.findById = () => ({ select: () => ({ lean: async () => ({ _id: userId, role: 'reader', accountStatus: 'suspended', verified: true }) }) });
  try {
    await validateToken(req, res, () => assert.fail('suspended account must not continue'));
  } finally {
    User.findById = originalFindById;
  }
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.message, 'Authentication required');
});

test('health and readiness endpoints separate liveness from database availability', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const rootResponse = await fetch(`http://127.0.0.1:${address.port}/`);
  const healthResponse = await fetch(`http://127.0.0.1:${address.port}/health`);
  const readinessResponse = await fetch(`http://127.0.0.1:${address.port}/readiness`);
  const readiness = await readinessResponse.json();

  assert.equal(rootResponse.status, 200);
  assert.deepEqual(await rootResponse.json(), { status: 'ok' });
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });
  assert.equal(readinessResponse.status, 503);
  assert.deepEqual(readiness, {
    status: 'error',
    checks: { database: 'error' },
    message: 'MongoDB connection failed',
  });
});

test('invalid JSON receives a safe client error', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{invalid',
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'INVALID_JSON');
});

test('comment listing validates post identifiers before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/post/not-a-post/comments`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, 'Invalid post id');
});

test('comment presenter batches relationships, separates viewers, and hides deleted content', async t => {
  const Comment = require('../schemas/comment.schema');
  const CommentAppreciation = require('../schemas/comment-appreciation.schema');
  const { presentComments } = require('../services/engagement.service');
  const userId = new mongoose.Types.ObjectId();
  const id = new mongoose.Types.ObjectId();
  t.mock.method(CommentAppreciation, 'aggregate', async () => [{ _id: id, count: 2 }]);
  t.mock.method(Comment, 'aggregate', async () => [{ _id: id, count: 3 }]);
  const lookup = t.mock.method(CommentAppreciation, 'find', () => ({ select: () => ({ lean: async () => [{ commentId: id }] }) }));
  const comment = { _id: id, content: 'Original', createdAt: new Date(), userId: { _id: userId, username: 'Reader' } };
  const member = (await presentComments([comment], String(userId)))[0];
  assert.equal(member.canEdit, true);
  assert.equal(member.canDelete, true);
  assert.equal(member.isAppreciated, true);
  assert.equal(member.appreciationsCount, 2);
  assert.equal(member.repliesCount, 3);
  const guest = (await presentComments([comment], null))[0];
  assert.equal(guest.canEdit, false);
  assert.equal(guest.isAppreciated, false);
  assert.equal(lookup.mock.callCount(), 1);
  const deleted = (await presentComments([{ ...comment, deletedAt: new Date() }], String(userId)))[0];
  assert.equal(deleted.content, '');
  assert.equal(deleted.author, null);
  assert.equal(deleted.canEdit, false);
  assert.equal(deleted.isAppreciated, false);
  assert.equal(deleted.repliesCount, 3);
});

test('comment listing scopes visible threads before cursor pagination and presents public author data', async t => {
  const Comment = require('../schemas/comment.schema');
  const CommentAppreciation = require('../schemas/comment-appreciation.schema');
  const { getComments } = require('../controllers/engagement.controller');
  const publicationId = new mongoose.Types.ObjectId();
  const cursor = new mongoose.Types.ObjectId();
  const authorId = new mongoose.Types.ObjectId();
  const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  t.mock.method(Publication, 'findById', () => ({ select: async () => ({ _id: publicationId, author: authorId }) }));
  const read = t.mock.method(Comment, 'aggregate', async stages => {
    if (stages.at(-1).$group) return [];
    assert.equal(String(stages[0].$match.publicationId), String(publicationId));
    assert.equal(stages[0].$match.parentCommentId, null);
    assert.ok(stages[0].$match._id.$lt instanceof mongoose.Types.ObjectId);
    assert.equal(String(stages[0].$match._id.$lt), String(cursor));
    const traversal = stages.findIndex(stage => stage.$graphLookup);
    assert.equal(String(stages[traversal].$graphLookup.restrictSearchWithMatch.publicationId), String(publicationId));
    assert.ok(stages.findIndex(stage => stage.$limit) > stages.findIndex(stage => stage.$match?.$or));
    assert.equal(stages.at(-1).$limit, 2);
    return ids.map(_id => ({ _id, publicationId, userId: authorId, content: 'Visible', createdAt: new Date(), deletedAt: null }));
  });
  t.mock.method(Comment, 'populate', async comments => {
    for (const comment of comments) comment.userId = { _id: authorId, username: 'Public reader' };
  });
  t.mock.method(Comment, 'countDocuments', async () => 7);
  t.mock.method(CommentAppreciation, 'aggregate', async () => []);
  const res = createResponse();
  await getComments({ params: { publicationId: String(publicationId) }, query: { limit: '1', cursor: String(cursor) } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.length, 1);
  assert.equal(res.payload.data[0].author.name, 'Public reader');
  assert.equal(String(res.payload.meta.nextCursor), String(ids[0]));
  assert.equal(res.payload.meta.totalCount, 7);
  assert.equal(read.mock.callCount(), 2);
});

test('comment editing and deletion enforce ownership and post scoping before writes', async t => {
  const Comment = require('../schemas/comment.schema');
  const { editComment, deleteComment, likeComment } = require('../controllers/engagement.controller');
  const publicationId = new mongoose.Types.ObjectId();
  const commentId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId().toString();
  const otherId = new mongoose.Types.ObjectId();
  t.mock.method(Publication, 'findById', () => ({ select: async () => ({ _id: publicationId, author: otherId }) }));
  t.mock.method(Membership, 'findOne', () => ({ select: async () => null }));
  t.mock.method(Entitlement, 'find', () => ({ select: async () => [] }));
  t.mock.method(User, 'findById', () => ({ select: async () => ({ role: 'regular' }) }));
  const read = t.mock.method(Comment, 'findOne', async filter => {
    assert.deepEqual(filter, { _id: String(commentId), publicationId: String(publicationId) });
    return { _id: commentId, userId: otherId };
  });
  const write = t.mock.method(Comment, 'updateOne', async () => { throw new Error('Unexpected write'); });
  const edit = t.mock.method(Comment, 'findOneAndUpdate', async () => { throw new Error('Unexpected write'); });
  const req = { params: { publicationId: String(publicationId), commentId: String(commentId) }, auth: { userId }, body: { text: 'Edited' } };
  for (const handler of [editComment, deleteComment]) {
    const res = createResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 403);
  }
  assert.equal(write.mock.callCount(), 0);
  assert.equal(edit.mock.callCount(), 0);
  read.mock.mockImplementation(async () => null);
  const missing = createResponse();
  await likeComment({ ...req, method: 'PUT' }, missing);
  assert.equal(missing.statusCode, 404);
});

test('comment likes use a unique relationship and explicit retry-safe set/unset actions', async t => {
  const CommentAppreciation = require('../schemas/comment-appreciation.schema');
  const { setCommentAppreciation } = require('../services/engagement.service');
  assert.ok(CommentAppreciation.schema.indexes().some(([fields, options]) => fields.commentId === 1 && fields.userId === 1 && options.unique));
  const upsert = t.mock.method(CommentAppreciation, 'updateOne', async () => ({ upsertedCount: 0 }));
  const remove = t.mock.method(CommentAppreciation, 'deleteOne', async () => ({ deletedCount: 0 }));
  t.mock.method(CommentAppreciation, 'countDocuments', async () => 1);
  for (let retry = 0; retry < 2; retry++) assert.equal((await setCommentAppreciation({ commentId: 'comment', userId: 'reader', liked: true })).isAppreciated, true);
  assert.equal(upsert.mock.calls[0].arguments[2].upsert, true);
  assert.equal((await setCommentAppreciation({ commentId: 'comment', userId: 'reader', liked: false })).isAppreciated, false);
  assert.equal(remove.mock.callCount(), 1);
});

test('new comment mutation routes require authentication', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [method, suffix] of [['PATCH', ''], ['DELETE', ''], ['PUT', '/like'], ['DELETE', '/like']]) {
    assert.equal((await fetch(`${origin}/api/v1/posts/invalid/comments/invalid${suffix}`, { method })).status, 401);
  }
});

test('comment deletion clears content once, retains replies, and rejects edits and likes afterwards', async t => {
  const Comment = require('../schemas/comment.schema');
  const { deleteComment, editComment, likeComment } = require('../controllers/engagement.controller');
  const publicationId = new mongoose.Types.ObjectId();
  const commentId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId().toString();
  const comment = { _id: commentId, userId, deletedAt: null };
  t.mock.method(Publication, 'findById', () => ({ select: async () => ({ _id: publicationId, author: userId }) }));
  t.mock.method(Membership, 'findOne', () => ({ select: async () => null }));
  t.mock.method(Entitlement, 'find', () => ({ select: async () => [] }));
  t.mock.method(User, 'findById', () => ({ select: async () => ({ role: 'regular' }) }));
  t.mock.method(Comment, 'findOne', async () => comment);
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: work => work(), endSession: async () => {} }));
  t.mock.method(Comment, 'updateOne', async (filter, update) => {
    assert.equal(filter.deletedAt, null);
    assert.equal(update.$set.content, '');
    const changed = !comment.deletedAt;
    comment.deletedAt = update.$set.deletedAt;
    return { modifiedCount: changed ? 1 : 0 };
  });
  const counter = t.mock.method(Publication, 'updateOne', async (_filter, update) => {
    assert.deepEqual(update, { $inc: { commentsCount: -1 } });
  });
  const remove = t.mock.method(Comment, 'deleteMany', async () => { throw new Error('Replies must remain'); });
  const req = { params: { publicationId: String(publicationId), commentId: String(commentId) }, auth: { userId }, body: { text: 'New text' } };
  for (let retry = 0; retry < 2; retry++) {
    const res = createResponse();
    await deleteComment(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.data.deleted, retry === 0);
  }
  assert.equal(counter.mock.callCount(), 1);
  assert.equal(remove.mock.callCount(), 0);
  for (const handler of [editComment, likeComment]) {
    const res = createResponse();
    await handler({ ...req, method: 'PUT' }, res);
    assert.equal(res.statusCode, 409);
  }
});

test('idempotent engagement routes authenticate before mutation', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/post/not-a-post/bookmark`, {
    method: 'PUT',
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
});

test('writer profile routes reject malformed handles without database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/writer/--`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, 'Invalid writer handle');
});

test('question routes validate sort and identifiers before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();

  const sortResponse = await fetch(`http://127.0.0.1:${address.port}/api/question?sort=unknown`);
  assert.equal(sortResponse.status, 400);
  const opportunitiesResponse = await fetch(`http://127.0.0.1:${address.port}/api/question/opportunities`);
  assert.equal(opportunitiesResponse.status, 401);
  const token = generateToken({ id: 'user-123' }, '1m');
  const invalidTarget = await fetch(`http://127.0.0.1:${address.port}/api/question`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'How can writers explain this clearly?', targetWriterIds: ['not-an-id'] }),
  });
  assert.equal(invalidTarget.status, 401);
  const voteResponse = await fetch(`http://127.0.0.1:${address.port}/api/question/not-an-id/upvote`, {
    method: 'PUT', headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(voteResponse.status, 401);
  const detailResponse = await fetch(`http://127.0.0.1:${address.port}/api/question/not-an-id`);
  assert.equal(detailResponse.status, 400);
  const answerResponse = await fetch(`http://127.0.0.1:${address.port}/api/question/not-an-id/answers`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'A valid-looking answer' }),
  });
  assert.equal(answerResponse.status, 401);
  const reportResponse = await fetch(`http://127.0.0.1:${address.port}/api/question/not-an-id/reports`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'spam' }),
  });
  assert.equal(reportResponse.status, 401);
  const answerReportResponse = await fetch(`http://127.0.0.1:${address.port}/api/question/not-an-id/answers/not-an-id/reports`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'spam' }),
  });
  assert.equal(answerReportResponse.status, 401);
  const claimResponse = await fetch(`http://127.0.0.1:${address.port}/api/question/not-an-id/claim`, {
    method: 'PUT', headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(claimResponse.status, 401);
  const declineResponse = await fetch(`http://127.0.0.1:${address.port}/api/question/not-an-id/decline`, {
    method: 'POST', headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(declineResponse.status, 401);
});

test('slow request diagnostics are thresholded and redact request data', () => {
  const warnings = [];
  const request = { requestId: 'timing-test', method: 'GET', path: '/database-status' };
  const response = new EventEmitter();
  response.statusCode = 503;
  createRequestTimingMiddleware({ thresholdMs: 0.001, warn: message => warnings.push(JSON.parse(message)) })(request, response, () => {});
  response.emit('finish');
  assert.equal(warnings.length, 1);
  assert.deepEqual(Object.keys(warnings[0]).sort(), ['level', 'method', 'path', 'requestId', 'responseTimeMs', 'status'].sort());
  assert.equal(warnings[0].requestId, 'timing-test');
  assert.equal(warnings[0].path, '/database-status');
  assert.equal(warnings[0].status, 503);
});

test('response budget diagnostics identify budget breaches without exposing request data', () => {
  const warnings = [];
  const request = { requestId: 'budget-test', method: 'GET', path: '/database-status' };
  const response = new EventEmitter();
  response.statusCode = 200;
  createRequestTimingMiddleware({ thresholdMs: 0.001, budgetMs: 0.001, warn: message => warnings.push(JSON.parse(message)) })(request, response, () => {});
  response.emit('finish');

  assert.equal(warnings.length, 1);
  assert.deepEqual(Object.keys(warnings[0]).sort(), ['budgetMs', 'level', 'method', 'path', 'requestId', 'responseTimeMs', 'status'].sort());
  assert.equal(warnings[0].level, 'response_budget_exceeded');
  assert.equal(warnings[0].budgetMs, 0.001);
  assert.equal(warnings[0].requestId, 'budget-test');
});

test('response budget breaches route redacted performance alerts to the monitor', async () => {
  const warnings = [];
  const alerts = [];
  const request = { requestId: 'budget-monitor-test', method: 'GET', path: '/database-status' };
  const response = new EventEmitter();
  response.statusCode = 200;
  const monitor = { report: async payload => alerts.push(payload) };
  createRequestTimingMiddleware({ thresholdMs: 0.001, budgetMs: 0.001, monitor, warn: message => warnings.push(JSON.parse(message)) })(request, response, () => {});
  response.emit('finish');
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(warnings[0].level, 'response_budget_exceeded');
  assert.equal(alerts.length, 1);
  assert.deepEqual(alerts[0], {
    event: 'response_budget_exceeded',
    requestId: 'budget-monitor-test',
    method: 'GET',
    path: '/database-status',
    status: 200,
    responseTimeMs: alerts[0].responseTimeMs,
    budgetMs: 0.001,
  });
});

test('monitor delivery failures never interrupt response timing middleware', async () => {
  const request = { requestId: 'monitor-failure-test', method: 'GET', path: '/database-status' };
  const response = new EventEmitter();
  response.statusCode = 200;
  const monitor = { report: () => { throw new Error('monitor unavailable'); } };

  assert.doesNotThrow(() => {
    createRequestTimingMiddleware({ thresholdMs: 0.001, budgetMs: 0.001, monitor, warn: () => {} })(request, response, () => {});
    response.emit('finish');
  });
  await new Promise(resolve => setImmediate(resolve));
});

test('response budgets classify discovery reads, events, mutations, and fallback routes', () => {
  assert.equal(getResponseBudgetMs({ method: 'GET', path: '/api/post/feed' }), 750);
  assert.equal(getResponseBudgetMs({ method: 'GET', path: '/api/search?q=city' }), 750);
  assert.equal(getResponseBudgetMs({ method: 'POST', path: '/api/v1/events' }), 500);
  assert.equal(getResponseBudgetMs({ method: 'POST', path: '/api/post' }), 1500);
  assert.equal(getResponseBudgetMs({ method: 'GET', path: '/database-status' }), 1000);
});

test('slow MongoDB query diagnostics are thresholded and redact command data', async () => {
  const client = new EventEmitter();
  const warnings = [];
  const stop = createMongoQueryDiagnostics({ client, thresholdMs: 0.001, warn: message => warnings.push(JSON.parse(message)) });

  client.emit('commandStarted', {
    requestId: 42,
    commandName: 'find',
    command: { find: 'posts', filter: { privateText: 'must-not-be-logged' } },
  });
  await new Promise(resolve => setImmediate(resolve));
  client.emit('commandSucceeded', { requestId: 42, commandName: 'find', command: { find: 'posts' } });

  assert.equal(warnings.length, 1);
  assert.deepEqual(Object.keys(warnings[0]).sort(), ['collection', 'commandName', 'durationMs', 'level', 'status'].sort());
  assert.deepEqual(warnings[0].collection, 'posts');
  assert.equal(warnings[0].commandName, 'find');
  assert.equal(warnings[0].status, 'succeeded');
  assert.equal(JSON.stringify(warnings).includes('privateText'), false);
  stop();
});

test('error monitor routes redacted 5xx metadata and omits secrets and error text', async () => {
  const requests = [];
  const monitor = createErrorMonitor({
    url: 'https://monitor.example.test/ingest',
    fetchImpl: async (url, options) => {
      requests.push({ url, options, payload: JSON.parse(options.body) });
      return { ok: true, status: 202 };
    },
  });

  await monitor.report({
    requestId: 'error-test',
    method: 'POST',
    path: '/api/private-resource',
    status: 500,
    responseTimeMs: 123.45,
    error: { name: 'DatabaseError', code: 'DB_TIMEOUT', message: 'password=do-not-send', stack: 'private stack' },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://monitor.example.test/ingest');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].payload.event, 'api_error');
  assert.equal(requests[0].payload.requestId, 'error-test');
  assert.equal(requests[0].payload.errorCode, 'DB_TIMEOUT');
  assert.equal(JSON.stringify(requests[0].payload).includes('password'), false);
  assert.equal(JSON.stringify(requests[0].payload).includes('private stack'), false);
  assert.equal(JSON.stringify(requests[0].payload).includes('do-not-send'), false);
});

test('error monitor preserves redacted response-budget alert metadata', async () => {
  const requests = [];
  const monitor = createErrorMonitor({
    url: 'https://monitor.example.test/ingest',
    fetchImpl: async (url, options) => {
      requests.push({ url, payload: JSON.parse(options.body) });
      return { ok: true, status: 202 };
    },
  });

  await monitor.report({
    event: 'response_budget_exceeded',
    requestId: 'budget-alert-test',
    method: 'GET',
    path: '/api/post/feed',
    status: 200,
    responseTimeMs: 812.34,
    budgetMs: 750,
  });

  assert.equal(requests[0].payload.event, 'response_budget_exceeded');
  assert.equal(requests[0].payload.budgetMs, 750);
  assert.equal(requests[0].payload.errorName, 'Error');
});

test('error monitor treats non-success delivery responses as failed without logging response bodies', async () => {
  const warnings = [];
  const monitor = createErrorMonitor({
    url: 'https://monitor.example.test/ingest',
    fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'private response body' }),
    warn: message => warnings.push(JSON.parse(message)),
  });

  await monitor.report({ requestId: 'delivery-status-test', status: 500 });

  assert.deepEqual(warnings, [{
    level: 'error_monitor_delivery_failed',
    errorName: 'MonitorHttpError',
    status: 503,
  }]);
  assert.equal(JSON.stringify(warnings).includes('private response body'), false);
});

test('entry removal validates ownership and lifecycle before atomically removing entry votes', async t => {
  const { removeEntry } = require('../controllers/competition.controller');
  const actorId = new mongoose.Types.ObjectId().toString();
  const competitionId = new mongoose.Types.ObjectId().toString();
  const entryId = new mongoose.Types.ObjectId().toString();
  const entry = { _id: entryId, author: actorId, votesCount: 8, votes: ['voter'] };
  let competition = { _id: competitionId, status: 'open', openDate: new Date(Date.now() - 60_000), closeDate: new Date(Date.now() + 60_000), entries: { id: id => id === entryId ? entry : null } };
  t.mock.method(Competition, 'findById', async () => competition);
  const write = t.mock.method(Competition, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(filter.status, 'open');
    assert.equal(filter._id, competitionId);
    assert.deepEqual(filter.$expr, { $and: [{ $lte: ['$openDate', '$$NOW'] }, { $gt: ['$closeDate', '$$NOW'] }] });
    assert.deepEqual(filter.entries.$elemMatch, { _id: entryId, author: actorId });
    assert.deepEqual(update, { $pull: { entries: { _id: entryId, author: actorId } } });
    assert.equal(options.returnDocument, 'before');
    return competition;
  });
  const audit = t.mock.method(require('../schemas/competition-audit.schema'), 'create', async record => {
    assert.equal(record.action, 'entry_removed');
    assert.equal(record.actorId, actorId);
    assert.deepEqual(record.details, { entryId, votesCount: 8 });
  });
  const run = async (userId = actorId, params = { id: competitionId, entryId }) => {
    const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await removeEntry({ params, auth: { userId } }, response);
    return response;
  };
  assert.equal((await run(actorId, { id: 'invalid', entryId })).statusCode, 400);
  assert.equal((await run('another-user')).statusCode, 403);
  assert.equal((await run(actorId, { id: competitionId, entryId: new mongoose.Types.ObjectId().toString() })).statusCode, 404);
  for (const status of ['draft', 'judging', 'closed']) {
    competition.status = status;
    assert.equal((await run()).statusCode, 409);
  }
  competition.status = 'open';
  competition.openDate = new Date(Date.now() + 60_000);
  assert.equal((await run()).statusCode, 409);
  competition.openDate = new Date(Date.now() - 60_000);
  competition.closeDate = new Date(Date.now() - 1);
  assert.equal((await run()).statusCode, 409);
  assert.equal(write.mock.callCount(), 0);
  assert.equal(audit.mock.callCount(), 0);
  competition.closeDate = new Date(Date.now() + 60_000);
  const success = await run();
  assert.equal(success.statusCode, 200);
  assert.deepEqual(success.body, { data: { removed: true } });
  assert.equal(audit.mock.callCount(), 1);
  write.mock.mockImplementation(async () => null);
  assert.equal((await run()).statusCode, 409);
  assert.equal(audit.mock.callCount(), 1);
  competition = null;
  assert.equal((await run()).statusCode, 404);
});

test('entry removal route requires authentication', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/competition/507f1f77bcf86cd799439011/entries/507f1f77bcf86cd799439012`, { method: 'DELETE' });
  assert.equal(response.status, 401);
});

test('moderation All lists every status while preserving status validation and the pending API default', async t => {
  const { listReports } = require('../controllers/moderation.controller');
  const filters = [];
  const records = [{ status: 'pending' }, { status: 'reviewing' }, { status: 'actioned' }, { status: 'dismissed' }];
  t.mock.method(Report, 'find', filter => {
    filters.push(filter);
    return { sort: order => {
      assert.deepEqual(order, { createdAt: 1 });
      return { limit: limit => {
        assert.equal(limit, 100);
        return { populate: async () => filter.status ? records.filter(item => item.status === filter.status) : records };
      } };
    } };
  });
  const run = async query => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await listReports({ query }, response);
    return response;
  };
  assert.equal((await run({ status: 'all' })).body.data.length, 4);
  assert.deepEqual(filters[0], {});
  assert.deepEqual((await run({})).body.data, [records[0]]);
  assert.deepEqual(filters[1], { status: 'pending' });
  for (const status of ['pending', 'reviewing', 'actioned', 'dismissed']) {
    assert.deepEqual((await run({ status })).body.data, records.filter(item => item.status === status));
  }
  const count = filters.length;
  assert.equal((await run({ status: 'invalid' })).statusCode, 400);
  assert.equal(filters.length, count);
});

test('moderators and admins cannot load competition entry choices or submit entries', async t => {
  const { getEligiblePosts, enterCompetition } = require('../controllers/competition.controller');
  t.mock.method(Competition, 'findById', () => { throw new Error('Staff requests must stop before reads'); });
  t.mock.method(Publication, 'findOne', () => { throw new Error('Staff requests must stop before reads'); });
  const write = t.mock.method(Competition, 'findOneAndUpdate', () => { throw new Error('No entry may be written'); });
  for (const role of ['moderator', 'admin']) {
    for (const handler of [getEligiblePosts, enterCompetition]) {
      const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await handler({ params: { id: new mongoose.Types.ObjectId().toString() }, auth: { userId: new mongoose.Types.ObjectId().toString(), role }, body: { publicationId: new mongoose.Types.ObjectId().toString() } }, response);
      assert.equal(response.statusCode, 403);
      assert.equal(response.body.message, 'Moderators and admins cannot enter competitions.');
    }
  }
  assert.equal(write.mock.callCount(), 0);
});

test('competition entry routes enforce the current stored staff role instead of token claims', async t => {
  const userId = new mongoose.Types.ObjectId().toString();
  let role = 'moderator';
  t.mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: userId, role, verified: true, accountStatus: 'active' }) }) }));
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}/api/competition/507f1f77bcf86cd799439011`;
  const headers = { authorization: `Bearer ${generateToken({ id: userId, role: 'regular' }, '1m')}`, 'content-type': 'application/json' };
  for (role of ['moderator', 'admin']) {
    const eligible = await fetch(`${root}/eligible-posts`, { headers });
    assert.equal(eligible.status, 403);
    const entry = await fetch(`${root}/entries`, { method: 'POST', headers, body: JSON.stringify({ publicationId: '507f1f77bcf86cd799439012' }) });
    assert.equal(entry.status, 403);
    assert.equal((await entry.json()).message, 'Moderators and admins cannot enter competitions.');
  }
});

test('competition picker only queries owned released stories not already entered', async t => {
  const { getEligiblePosts } = require('../controllers/competition.controller');
  const authorId = new mongoose.Types.ObjectId().toString();
  const competitionId = new mongoose.Types.ObjectId().toString();
  const story = { _id: new mongoose.Types.ObjectId(), title: 'A published story', createdAt: new Date() };
  t.mock.method(Competition, 'findById', () => ({ select: async () => ({ entries: [{ publication: 'already-entered' }], status: 'open', openDate: new Date(Date.now() - 86400000), closeDate: new Date(Date.now() + 86400000) }) }));
  t.mock.method(Publication, 'find', filter => {
    assert.equal(filter.author, authorId);
    assert.deepEqual(filter.format, { $ne: 'short' });
    assert.deepEqual(filter._id, { $nin: ['already-entered'] });
    assert.equal(filter.publicationStatus.$ne, 'unpublished');
    assert.ok(filter.$or.some(clause => clause.publicAt?.$lte instanceof Date));
    return { sort: () => ({ select: async () => [story] }) };
  });
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await getEligiblePosts({ params: { id: competitionId }, auth: { userId: authorId, role: 'regular' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data[0].title, story.title);
});

test('competition submission rejects shorts before writing and accepts stories including legacy format', async t => {
  const { enterCompetition } = require('../controllers/competition.controller');
  const authorId = new mongoose.Types.ObjectId().toString();
  const competitionId = new mongoose.Types.ObjectId().toString();
  const publicationId = new mongoose.Types.ObjectId().toString();
  let format = 'short';
  t.mock.method(Publication, 'findOne', filter => {
    assert.equal(filter.author, authorId);
    assert.equal(filter._id, publicationId);
    assert.deepEqual(filter.format, { $ne: 'short' });
    assert.equal(filter.publicationStatus.$ne, 'unpublished');
    assert.ok(filter.$or.some(clause => clause.publicAt?.$lte instanceof Date));
    return { select: async () => format === filter.format.$ne ? null : { _id: publicationId, currentRevision: 3 } };
  });
  const write = t.mock.method(Competition, 'findOneAndUpdate', async (_filter, update) => {
    assert.equal(update.$push.entries.publication, publicationId);
    assert.equal(update.$push.entries.publicationRevision, 3);
    return { _id: competitionId };
  });
  const run = async () => {
    const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await enterCompetition({ params: { id: competitionId }, auth: { userId: authorId, role: 'regular' }, body: { publicationId } }, response);
    return response;
  };
  const rejected = await run();
  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.body.message, 'You can only enter your own published stories');
  assert.equal(write.mock.callCount(), 0);
  for (format of ['story', undefined]) {
    assert.equal((await run()).statusCode, 201);
  }
  assert.equal(write.mock.callCount(), 2);
});

test('competition routes validate filters and entry identifiers before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  const invalidStatus = await fetch(`http://127.0.0.1:${address.port}/api/competition?status=unknown`);
  assert.equal(invalidStatus.status, 400);
  const token = generateToken({ id: 'user-123' }, '1m');
  const voteUrl = `http://127.0.0.1:${address.port}/api/competition/no/entries/no/vote`;
  const invalidVote = await fetch(voteUrl, { method: 'PUT', headers: { authorization: `Bearer ${token}` } });
  assert.equal(invalidVote.status, 401);
  for (let attempt = 0; attempt < 29; attempt += 1) {
    const response = await fetch(voteUrl, { method: 'PUT', headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 401);
  }
  const rateLimitedVote = await fetch(voteUrl, { method: 'PUT', headers: { authorization: `Bearer ${token}` } });
  assert.equal(rateLimitedVote.status, 401);
});

test('collection routes validate public identifiers and authenticate mutations before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  const detail = await fetch(`http://127.0.0.1:${address.port}/api/collection/not-an-id`);
  assert.equal(detail.status, 400);
  const invalidSort = await fetch(`http://127.0.0.1:${address.port}/api/collection?sort=unknown`);
  assert.equal(invalidSort.status, 400);
  assert.equal((await invalidSort.json()).message, 'Invalid collection sort');
  const create = await fetch(`http://127.0.0.1:${address.port}/api/collection`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(create.status, 401);
  const add = await fetch(`http://127.0.0.1:${address.port}/api/v1/collections/507f1f77bcf86cd799439030/posts/507f1f77bcf86cd799439031`, { method: 'PUT' });
  assert.equal(add.status, 401);
});

test('collection appends enforce availability, ownership, duplicate retries, and capacity', async t => {
  const { appendCollectionPost } = require('../services/collection-items.service');
  const input = { collectionId: '507f1f77bcf86cd799439030', publicationId: '507f1f77bcf86cd799439031', actorId: '507f1f77bcf86cd799439032' };
  let available = false;
  let updated = null;
  let owned = null;
  let writes = 0;
  t.mock.method(Publication, 'exists', async filter => {
    assert.equal(filter.publicationStatus.$ne, 'unpublished');
    assert.equal(filter._id, input.publicationId);
    assert.ok(filter.$or[0].publicAt.$lte instanceof Date);
    return available;
  });
  t.mock.method(Collection, 'findOneAndUpdate', (filter, pipeline, options) => {
    writes += 1;
    assert.equal(filter.author, input.actorId);
    assert.equal(filter._id, input.collectionId);
    assert.equal(options.updatePipeline, true);
    assert.ok(filter.$expr.$and);
    assert.equal(pipeline.length, 2);
    return { select: async () => updated };
  });
  t.mock.method(Collection, 'findOne', filter => {
    assert.equal(filter.author, input.actorId);
    return { select: async () => owned };
  });
  assert.equal((await appendCollectionPost(input)).status, 404);
  assert.equal(writes, 0);
  available = true;
  assert.equal((await appendCollectionPost(input)).status, 404);
  updated = { _id: input.collectionId };
  assert.deepEqual((await appendCollectionPost(input)).data, { added: true });
  updated = null;
  owned = { items: [{ publication: input.publicationId }], publications: [] };
  assert.deepEqual((await appendCollectionPost(input)).data, { added: false });
  owned = { items: [], publications: [input.publicationId] };
  assert.deepEqual((await appendCollectionPost(input)).data, { added: false });
  owned = { items: [], publications: [] };
  assert.equal((await appendCollectionPost(input)).status, 400);
});

test('writer follow routes validate target identifiers after authentication', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const token = generateToken({ id: 'user-123' }, '1m');
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/writer/not-an-id/follow`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.message, 'Authentication required');
});

test('story report routes reject unsupported reasons before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const token = generateToken({ id: 'user-123' }, '1m');
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/post/507f1f77bcf86cd799439011/reports`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ reason: 'not-a-reason' }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.message, 'Authentication required');
});

test('discovery feed rejects invalid modes before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/post/feed?mode=unknown`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, 'Invalid feed mode');
  const invalidSort = await fetch(`http://127.0.0.1:${address.port}/api/post/feed?sort=unknown`);
  assert.equal(invalidSort.status, 400);
  assert.equal((await invalidSort.json()).message, 'Invalid feed sort');
});

test('discovery feed rejects malformed cursors before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/post/feed?cursor=bad`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, 'Invalid feed cursor');
});

test('short feed rejects malformed cursors before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/post/shorts?cursor=bad`);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Invalid short feed cursor');
  const invalidSort = await fetch(`http://127.0.0.1:${address.port}/api/post/shorts?sort=unknown`);
  assert.equal(invalidSort.status, 400);
  assert.equal((await invalidSort.json()).message, 'Invalid short feed sort');
});

test('short series validates identifiers and protects creation before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  const detail = await fetch(`http://127.0.0.1:${address.port}/api/short-series/not-an-id`);
  assert.equal(detail.status, 400);
  const create = await fetch(`http://127.0.0.1:${address.port}/api/short-series`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(create.status, 401);
});

test('personalized feed requires an authenticated reader before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/post/feed?mode=for-you`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, 'Sign in to use the For You feed');
});

test('unified search validates query and type before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const emptyQuery = await fetch(`http://127.0.0.1:${address.port}/api/search?q=`);
  const invalidType = await fetch(`http://127.0.0.1:${address.port}/api/search?q=a&type=videos`);

  assert.equal(emptyQuery.status, 400);
  assert.equal((await emptyQuery.json()).message, 'Search query must be between 1 and 100 characters');
  assert.equal(invalidType.status, 400);
  assert.equal((await invalidType.json()).message, 'Invalid search type');
});

test('empty Writers searches return bounded ranked authors while validating browse requests', async t => {
  const { search } = require('../controllers/search.controller');
  const writers = [{ id: 'author-id', handle: 'maya', displayName: 'Maya', followersCount: 10 }];
  const aggregate = t.mock.method(Profile, 'aggregate', async () => writers);
  const run = async query => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await search({ query }, response);
    return response;
  };
  const result = await run({ type: 'writers', q: '   ', limit: '99' });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.data, { writers, posts: [], shorts: [], questions: [] });
  assert.equal(result.body.meta.query, '');
  const pipeline = aggregate.mock.calls[0].arguments[0];
  assert.deepEqual(pipeline.find(stage => stage.$sort).$sort, { followersCount: -1, displayName: 1, _id: 1 });
  assert.equal(pipeline.find(stage => stage.$limit).$limit, 10);
  assert.equal(pipeline.find(stage => stage.$match).$match.writerStatus, 'writer');
  assert.equal(pipeline.find(stage => stage.$project).$project.account, undefined);
  for (const query of [{}, { type: 'writers', suggestions: 'true' }, { type: 'writers', q: 'a'.repeat(101) }, { type: 'writers', topic: 'invalid' }]) {
    assert.equal((await run(query)).statusCode, 400);
  }
  assert.equal(aggregate.mock.callCount(), 1);
  await run({ type: 'writers', limit: '3' });
  assert.equal(aggregate.mock.calls[1].arguments[0].find(stage => stage.$limit).$limit, 3);
  aggregate.mock.mockImplementation(async () => { throw new Error('Unavailable'); });
  t.mock.method(console, 'error', () => {});
  assert.equal((await run({ type: 'writers' })).statusCode, 500);
});

test('empty content searches browse bounded popular results with visibility and filter rules', async t => {
  const { search } = require('../controllers/search.controller');
  t.mock.method(Profile, 'find', () => ({ select: fields => fields === 'userId handle' ? Promise.resolve([]) : { lean: async () => [] } }));
  const reads = [];
  for (const model of [Publication, Question]) {
    t.mock.method(model, 'find', filter => {
      const read = { model: model.modelName, filter, populations: [] };
      reads.push(read);
      const chain = {
        select: fields => { read.fields = fields; return chain; },
        populate: population => { read.populations.push(population); return chain; },
        sort: order => { read.order = order; return chain; },
        limit: limit => { read.limit = limit; return Promise.resolve([]); },
      };
      return chain;
    });
  }
  const run = async query => {
    const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await search({ query, requestId: 'browse-test' }, response);
    return response;
  };
  for (const type of ['posts', 'shorts', 'questions']) {
    const result = await run({ type, q: '   ', limit: '99', topic: 'science', time: 'week' });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.meta.query, '');
    assert.deepEqual(result.body.data, { posts: [], writers: [], shorts: [], questions: [] });
    const read = reads.at(-1);
    assert.equal(read.limit, 24);
    assert.deepEqual(read.order, { [type === 'questions' ? 'upvotesCount' : 'appreciationsCount']: -1, createdAt: -1, _id: -1 });
    const clauses = read.filter.$and;
    assert.ok(clauses.some(clause => clause.tags?.$in?.includes('science')));
    assert.ok(clauses.some(clause => clause.createdAt?.$gte instanceof Date));
    assert.equal(JSON.stringify(clauses).includes('$regex'), false);
    if (type === 'questions') {
      assert.deepEqual(clauses[0], { status: { $ne: 'closed' } });
      assert.ok(read.populations.find(item => item.path === 'relatedPublications').match);
    } else {
      assert.equal(clauses[0].publicationStatus.$ne, 'unpublished');
      assert.ok(clauses[0].$or.some(clause => clause.publicAt?.$lte instanceof Date));
      assert.deepEqual(clauses[1], type === 'shorts' ? { format: 'short' } : { format: { $ne: 'short' } });
    }
    await run({ type, sort: 'latest', limit: '2' });
    assert.deepEqual(reads.at(-1).order, { createdAt: -1, _id: -1 });
    assert.equal(reads.at(-1).limit, 2);
    const readCount = reads.length;
    for (const invalid of [{ suggestions: 'true' }, { q: 'a'.repeat(101) }, { topic: 'invalid' }, { time: 'invalid' }, { sort: 'invalid' }]) {
      assert.equal((await run({ type, ...invalid })).statusCode, 400);
    }
    assert.equal(reads.length, readCount);
  }
});

test('question search matches text, context, and tags with bounded public results', async t => {
  const { search } = require('../controllers/search.controller');
  const authorId = '507f1f77bcf86cd799439013';
  const records = [{
    _id: '507f1f77bcf86cd799439011', text: 'How can coastal cities adapt?',
    context: 'A reader request', tags: ['coastal resilience'], status: 'open',
    createdAt: new Date(), upvotesCount: 4, upvotes: [authorId], answers: [{ _id: 'answer' }],
    relatedPublications: [{ _id: 'visible-response', title: 'Public response' }],
    author: { _id: authorId, username: 'Reader', picture: null },
    followers: [authorId], targetWriterIds: [authorId], declinedBy: [authorId],
  }];
  const reads = [];
  t.mock.method(Question, 'find', filter => {
    const read = { filter, populations: [] };
    reads.push(read);
    const chain = {
      select: fields => { read.fields = fields; return chain; },
      populate: population => { read.populations.push(population); return chain; },
      sort: order => { read.order = order; return chain; },
      limit: limit => { read.limit = limit; return Promise.resolve(records); },
    };
    return chain;
  });
  let profileReads = 0;
  t.mock.method(Profile, 'find', filter => {
    return { select: fields => {
      if (fields === 'userId handle') {
        profileReads += 1;
        assert.deepEqual(filter, { userId: { $in: [authorId] } });
        return Promise.resolve([{ userId: authorId, handle: 'reader-handle' }]);
      }
      return { lean: async () => [] };
    } };
  });
  t.mock.method(Publication, 'find', () => { throw new Error('Question-only search must not query posts'); });
  const run = async query => {
    const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await search({ query, requestId: 'question-search-test' }, response);
    assert.equal(response.statusCode, 200);
    return response.body;
  };
  const result = await run({ q: 'coastal resilience', type: 'questions', limit: '999', topic: 'science', time: 'week', sort: 'latest' });
  assert.equal(result.data.questions.length, 1);
  assert.deepEqual(result.data.posts, []);
  assert.deepEqual(result.data.writers, []);
  assert.deepEqual(result.data.shorts, []);
  const question = result.data.questions[0];
  assert.equal(question.author.handle, 'reader-handle');
  assert.equal(question.answersCount, 1);
  assert.equal(question.isUpvoted, false);
  assert.equal(question.followers, undefined);
  assert.equal(question.targetWriterIds, undefined);
  assert.equal(question.declinedBy, undefined);
  assert.equal(question.answers, undefined);
  assert.equal(question.upvotes, undefined);
  assert.deepEqual(reads[0].filter.$and[0], { status: { $ne: 'closed' } });
  const terms = reads[0].filter.$and[1].$and;
  assert.deepEqual(terms.map(term => term.$or.map(field => Object.keys(field)[0])), [['text', 'context', 'tags'], ['text', 'context', 'tags']]);
  assert.deepEqual(reads[0].filter.$and[2], { tags: { $in: ['science'] } });
  assert.ok(reads[0].filter.$and[3].createdAt.$gte instanceof Date);
  assert.equal(reads[0].limit, 24);
  assert.deepEqual(reads[0].order, { createdAt: -1, _id: -1 });
  const responsePopulation = reads[0].populations.find(item => item.path === 'relatedPublications');
  assert.equal(responsePopulation.match.$or[0].publicationStatus.$ne, 'unpublished');
  await run({ q: 'c++', type: 'questions', limit: '2' });
  assert.equal(reads[1].filter.$and[1].$and[0].$or[0].text.$regex, 'c\\+\\+');
  assert.deepEqual(reads[1].order, { upvotesCount: -1, createdAt: -1, _id: -1 });
  assert.equal(reads[1].limit, 2);
  assert.equal(profileReads, 2);
  t.mock.method(require('../schemas/appreciation.schema'), 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  t.mock.method(require('../schemas/save.schema'), 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  const { presentQuestions } = require('../controllers/question.controller');
  assert.equal((await presentQuestions(records, authorId))[0].isUpvoted, true);
});

test('content suggestions use public metadata, bounded independent groups, and literal query matching', async t => {
  const { search } = require('../controllers/search.controller');
  const pipelines = [];
  t.mock.method(Publication, 'aggregate', async pipeline => {
    pipelines.push(pipeline);
    return [{ text: 'writing dialogue', articleCount: 3 }];
  });
  t.mock.method(Publication, 'find', () => { throw new Error('Suggestions must not load story bodies'); });
  const profileReads = [];
  t.mock.method(Profile, 'find', filter => {
    const read = { filter };
    profileReads.push(read);
    const chain = {
      select(fields) { read.fields = fields; return chain; },
      populate() { return chain; },
      sort() { return chain; },
      limit(limit) { read.limit = limit; return Promise.resolve([{ userId: { _id: 'writer' }, handle: 'writer', displayName: 'Writer', avatarUrl: null }]); },
    };
    return chain;
  });
  const run = async query => {
    const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await search({ query: { suggestions: 'true', ...query }, requestId: 'suggestions-test' }, response);
    assert.equal(response.statusCode, 200);
    return response.body;
  };
  const result = await run({ q: 'writing di', limit: '999' });
  assert.deepEqual(result.data.suggestions, [{ text: 'writing dialogue', articleCount: 3 }]);
  assert.equal(result.data.writers[0].handle, 'writer');
  assert.deepEqual(result.data.posts, []);
  assert.equal(profileReads[0].limit, 5);
  assert.equal(profileReads[0].fields.includes('bio'), false);
  assert.deepEqual(profileReads[0].filter.$and[0].$or.map(item => Object.keys(item)[0]), ['displayName', 'handle']);
  assert.equal(pipelines[0][0].$match.$and[0].publicationStatus.$ne, 'unpublished');
  assert.ok(pipelines[0][0].$match.$and[0].$or[0].publicAt.$lte instanceof Date);
  assert.equal(pipelines[0].find(stage => stage.$limit).$limit, 5);
  assert.equal(JSON.stringify(pipelines[0]).includes('$body'), false);
  await run({ q: 'c++', type: 'posts', limit: '2', topic: 'science', time: 'week' });
  assert.equal(pipelines[1].find(stage => stage.$match?.text).$match.text.$regex, '(^|\\s)c\\+\\+');
  assert.equal(pipelines[1].find(stage => stage.$limit).$limit, 2);
  assert.deepEqual(pipelines[1][0].$match.$and[3], { tags: { $in: ['science'] } });
  assert.equal(profileReads.length, 1);
  await run({ q: '$title' });
  assert.deepEqual(pipelines[2].find(stage => stage.$addFields).$addFields.matchRank.$cond[0].$eq[1], { $literal: '$title' });
  await run({ q: '-' });
  assert.equal(pipelines[3].find(stage => stage.$match?.text).$match.text.$regex, '(?!)');
});

test('onboarding writes require authentication before validation', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/onboarding`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topicSlugs: [], writerIds: [], completed: true }),
  });
  assert.equal(response.status, 401);

  const resetResponse = await fetch(`http://127.0.0.1:${address.port}/api/v1/interests/inferred`, {
    method: 'DELETE',
  });
  assert.equal(resetResponse.status, 401);
});

test('event intake rejects malformed batches before database access', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events: [], anonymousSessionId: 'invalid' }),
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.message, 'Events must contain between 1 and 50 items');

  const invalidEvent = await fetch(`http://127.0.0.1:${address.port}/api/v1/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      anonymousSessionId: '2f1c995d-7db7-4d7d-813d-1a8a229bdede',
      events: [{
        eventId: '9caa3af1-133a-486f-ae0c-0599493e32d2',
        eventType: 'open',
        surface: 'story',
        eventAt: new Date().toISOString(),
      }],
    }),
  });
  assert.equal(invalidEvent.status, 400);
  assert.equal((await invalidEvent.json()).message, 'One or more events are invalid');
});

test('reading history is private to the authenticated reader', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/reading-history`);
  assert.equal(response.status, 401);
});

test('premium domain models retain platform membership', () => {
  assert.equal(Membership.schema.path('userId').options.unique, true);
  assert.deepEqual(Entitlement.capabilities, [
    'story_summary', 'read_aloud', 'writer_analytics', 'ai_writing_assistant', 'early_access',
    'workshops', 'behind_scenes', 'direct_creator_requests',
  ]);
  assert.ok(ProviderEvent.schema.indexes().some(([fields]) => fields.provider === 1 && fields.eventId === 1));
  assert.equal(PublicationSummary.schema.path('publicationId').options.unique, true);
  assert.equal(Publication.schema.path('publicAt').instance, 'Date');
  assert.ok(Workshop.schema.indexes().some(([fields]) => fields.status === 1 && fields.startsAt === 1));
  assert.ok(WorkshopAttendance.schema.indexes().some(([fields]) => fields.workshopId === 1 && fields.userId === 1));
  assert.ok(CreatorUpdate.schema.path('audience').enumValues.includes('supporters'));
  assert.equal(CreatorRequest.schema.path('periodKey').instance, 'String');
});

test('extractive summaries use story content and remain deterministic', () => {
  const body = JSON.stringify([
    { type: 'paragraph', content: '<p>Coastal communities adapt to rising tides through restored wetlands and elevated homes.</p>' },
    { type: 'paragraph', content: 'Wetlands absorb storm energy while offering important habitat for native wildlife.' },
    { type: 'paragraph', content: 'Local planning and long-term maintenance determine whether these projects succeed.' },
  ]);
  const text = extractText(body);
  const first = summarizeExtractively(text);
  assert.match(text, /Coastal communities/);
  assert.deepEqual(first, summarizeExtractively(text));
  assert.ok(first.length >= 1 && first.length <= 4);
  assert.ok(first.every(point => text.includes(point)));
});

test('billing state maps provider subscription statuses conservatively', () => {
  assert.equal(mapSubscriptionStatus('active'), 'active');
  assert.equal(mapSubscriptionStatus('trialing'), 'trialing');
  assert.equal(mapSubscriptionStatus('past_due'), 'past_due');
  assert.equal(mapSubscriptionStatus('unpaid'), 'past_due');
  assert.equal(mapSubscriptionStatus('canceled'), 'canceled');
  assert.equal(mapSubscriptionStatus('incomplete'), 'inactive');
});

test('durable authoring models preserve draft conflicts and immutable revisions', () => {
  assert.equal(Draft.schema.path('version').instance, 'Number');
  assert.ok(PublicationRevision.schema.indexes().some(([fields]) => fields.publicationId === 1 && fields.revision === 1));
  const input = parseDraftInput({ title: '  Working title  ', format: 'story', blocks: [{ id: 'block-1', type: 'text', content: 'Draft body' }], tags: [' Writing ', 'writing'] });
  assert.equal(input.title, 'Working title');
  assert.deepEqual(input.tags, ['writing']);
  assert.equal(parseDraftInput({ format: 'video', blocks: [] }), null);
  assert.equal(parseDraftInput({ format: 'story', blocks: [{ id: 'x', type: 'embed', content: '' }] }), null);
});

test('engagement notifications follow committed writes and suppress repeats, removals and self actions', async t => {
  const { setLike, addComment } = require('../services/engagement.service');
  const { toggleFollow } = require('../services/user-relationship.service');
  const Appreciation = require('../schemas/appreciation.schema');
  const Follow = require('../schemas/follow.schema');
  const Comment = require('../schemas/comment.schema');
  const userId = new mongoose.Types.ObjectId();
  const author = new mongoose.Types.ObjectId();
  const publicationId = new mongoose.Types.ObjectId();
  const commentId = new mongoose.Types.ObjectId();
  let inTransaction = false;
  let retry = false;
  t.mock.method(mongoose, 'startSession', async () => ({
    withTransaction: async work => {
      assert.equal(inTransaction, false, 'notification must not open a nested transaction');
      inTransaction = true;
      try {
        if (retry) { retry = false; await work(); }
        return await work();
      } finally { inTransaction = false; }
    },
    endSession: async () => {},
  }));
  const writes = t.mock.method(Notification, 'create', async ([input]) => {
    assert.equal(new Notification(input).validateSync(), undefined);
    return [{ ...input, _id: new mongoose.Types.ObjectId() }];
  });
  const post = { author, title: 'Example post', appreciationsCount: 1 };
  const sessionQuery = value => ({ session: async () => value });
  t.mock.method(Publication, 'findById', () => ({ select: () => sessionQuery(post) }));
  t.mock.method(Publication, 'updateOne', async () => ({ modifiedCount: 1 }));
  const upsert = t.mock.method(Appreciation, 'updateOne', async () => ({ upsertedCount: 1 }));
  t.mock.method(Appreciation, 'deleteOne', async () => ({ deletedCount: 1 }));
  retry = true;
  assert.deepEqual(await setLike({ publicationId, userId, liked: true }), { isAppreciated: true, appreciationsCount: 1 });
  assert.equal(writes.mock.callCount(), 1, 'transaction callback retry must not notify twice');
  assert.equal(writes.mock.calls[0].arguments[0][0].type, 'publication_appreciated');
  upsert.mock.mockImplementation(async () => ({ upsertedCount: 0 }));
  await setLike({ publicationId, userId, liked: true });
  await setLike({ publicationId, userId, liked: false });
  upsert.mock.mockImplementation(async () => ({ upsertedCount: 1 }));
  await setLike({ publicationId, userId: author, liked: true });
  assert.equal(writes.mock.callCount(), 1);
  upsert.mock.mockImplementation(async () => { throw new Error('Write failed'); });
  await assert.rejects(setLike({ publicationId, userId, liked: true }), /Write failed/);
  assert.equal(writes.mock.callCount(), 1);

  t.mock.method(Comment, 'create', async () => [{ _id: commentId }]);
  const comment = { _id: commentId, content: 'a'.repeat(1000), createdAt: new Date(), parentCommentId: null, userId: { _id: userId, username: 'Reader' } };
  t.mock.method(Comment, 'findById', () => ({ populate: () => sessionQuery(comment) }));
  retry = true;
  assert.equal((await addComment({ publicationId, userId, content: comment.content })).id, commentId);
  const commentNotice = writes.mock.calls[1].arguments[0][0];
  assert.equal(commentNotice.type, 'publication_commented');
  assert.equal(commentNotice.body.length, 180);
  assert.equal(String(commentNotice.recipientId), String(author));
  assert.equal(commentNotice.href, `/post/${publicationId}`);
  await addComment({ publicationId, userId: author, content: 'My own comment' });
  assert.equal(writes.mock.callCount(), 2);
  await addComment({ publicationId, userId, content: 'Reply', parentCommentId: commentId });
  assert.equal(writes.mock.callCount(), 3);

  let following = false;
  t.mock.method(Follow, 'findOne', () => sessionQuery(following ? { _id: new mongoose.Types.ObjectId() } : null));
  t.mock.method(Follow, 'create', async () => { following = true; return []; });
  t.mock.method(Follow, 'deleteOne', async () => { following = false; return { deletedCount: 1 }; });
  t.mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(User, 'findById', () => ({ select: () => sessionQuery({ followersCount: 1 }) }));
  await toggleFollow({ followerId: userId, followingId: author });
  const followNotice = writes.mock.calls[3].arguments[0][0];
  assert.equal(followNotice.type, 'user_followed');
  assert.equal(followNotice.href, '/profile');
  assert.equal(String(followNotice.recipientId), String(author));
  assert.equal(String(followNotice.actorId), String(userId));
  await toggleFollow({ followerId: userId, followingId: author });
  assert.equal(writes.mock.callCount(), 4);

  writes.mock.mockImplementation(async () => { throw new Error('Notification storage unavailable'); });
  t.mock.method(console, 'error', () => {});
  upsert.mock.mockImplementation(async () => ({ upsertedCount: 1 }));
  assert.deepEqual(await setLike({ publicationId, userId, liked: true }), { isAppreciated: true, appreciationsCount: 1 });
});

test('explicit writer follows and onboarding notify only newly inserted relationships', async t => {
  const { followWriter } = require('../controllers/writer.controller');
  const { saveOnboardingSelection } = require('../services/onboarding.service');
  const Follow = require('../schemas/follow.schema');
  const followerId = String(new mongoose.Types.ObjectId());
  const followingId = String(new mongoose.Types.ObjectId());
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: work => work(), endSession: async () => {} }));
  const writes = t.mock.method(Notification, 'create', async ([input]) => [{ ...input, _id: new mongoose.Types.ObjectId() }]);
  const query = value => ({ then: resolve => Promise.resolve(value).then(resolve), session: async () => value });
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: followingId, followersCount: 1 }) }));
  t.mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }));
  const upsert = t.mock.method(Follow, 'updateOne', async () => ({ upsertedCount: 1 }));
  const req = { auth: { userId: followerId }, params: { writerId: followingId } };
  const response = createResponse();
  await followWriter(req, response);
  assert.equal(response.statusCode, 200);
  assert.equal(writes.mock.callCount(), 1);
  upsert.mock.mockImplementation(async () => ({ upsertedCount: 0 }));
  await followWriter(req, createResponse());
  assert.equal(writes.mock.callCount(), 1);
  t.mock.method(UserInterest, 'updateMany', async () => ({}));
  t.mock.method(UserInterest, 'deleteMany', async () => ({}));
  t.mock.method(User, 'findByIdAndUpdate', () => ({ select: () => query({ onboardingCompletedAt: new Date() }) }));
  const bulk = t.mock.method(Follow, 'bulkWrite', async () => ({ upsertedCount: 1, upsertedIds: { 0: new mongoose.Types.ObjectId() } }));
  t.mock.method(Follow, 'find', () => ({ select: () => query([{ followingId }]) }));
  const selection = { userId: followerId, topics: [], writers: [{ _id: followingId }], completed: true };
  assert.equal((await saveOnboardingSelection(selection)).addedFollows, 1);
  assert.equal(writes.mock.callCount(), 2);
  assert.equal(writes.mock.calls[1].arguments[0][0].recipientId, followingId);
  bulk.mock.mockImplementation(async () => ({ upsertedCount: 0, upsertedIds: {} }));
  assert.equal((await saveOnboardingSelection(selection)).addedFollows, 0);
  assert.equal(writes.mock.callCount(), 2);
});

test('workshop lists include only the current viewer registration state', async t => {
  const { listWorkshops } = require('../controllers/member-experience.controller');
  const workshopId = new mongoose.Types.ObjectId();
  const anotherId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();
  const chain = { select(fields) { assert.equal(fields, '-meetingUrl'); return this; }, sort() { return this; }, populate() { return this; }, lean: async () => [{ _id: workshopId, title: 'Reserved workshop' }, { _id: anotherId, title: 'Another workshop' }] };
  t.mock.method(Workshop, 'find', () => chain);
  const reads = t.mock.method(WorkshopAttendance, 'find', filter => {
    assert.deepEqual(filter.workshopId.$in, [workshopId, anotherId]);
    assert.deepEqual(filter.status.$in, ['registered', 'attended']);
    return { select(fields) { assert.equal(fields, 'workshopId'); return this; }, lean: async () => filter.userId === userId ? [{ workshopId }] : [] };
  });
  const run = async viewerId => {
    const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await listWorkshops({ auth: viewerId ? { userId: viewerId } : null }, response);
    return response.body.data;
  };
  assert.deepEqual((await run(userId)).map(item => item.isRegistered), [true, false]);
  assert.deepEqual((await run(otherUserId)).map(item => item.isRegistered), [false, false]);
  assert.deepEqual((await run(null)).map(item => item.isRegistered), [false, false]);
  assert.equal(reads.mock.callCount(), 2, 'guest lists must not read private attendance');
});

test('workshop reservations notify the attendee and retain retry access when full', async t => {
  const { registerWorkshop } = require('../controllers/member-experience.controller');
  const userId = new mongoose.Types.ObjectId();
  const workshopId = new mongoose.Types.ObjectId();
  const attendance = { _id: new mongoose.Types.ObjectId(), status: 'registered' };
  const workshop = { _id: workshopId, hostId: userId, title: 'Making a scene', capacity: 1, meetingUrl: 'https://meet.example.test/session' };
  let member = true;
  let existing = null;
  let count = 0;
  let notificationSaved = false;
  let failNotification = false;
  t.mock.method(Membership, 'findOne', () => ({ select: async () => null }));
  t.mock.method(Entitlement, 'find', () => ({ select: async () => member ? [{ capability: 'workshops' }] : [] }));
  t.mock.method(User, 'findById', () => ({ select: async () => ({ role: 'regular' }) }));
  t.mock.method(Workshop, 'findOne', async () => workshop);
  t.mock.method(WorkshopAttendance, 'findOne', async () => existing);
  t.mock.method(WorkshopAttendance, 'countDocuments', async () => count);
  const registration = t.mock.method(WorkshopAttendance, 'findOneAndUpdate', async () => { existing = attendance; count = 1; return attendance; });
  t.mock.method(Notification, 'exists', async () => notificationSaved);
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async work => work(), endSession: async () => {} }));
  t.mock.method(console, 'error', () => {});
  const notifications = t.mock.method(Notification, 'create', async ([input]) => {
    assert.equal(new Notification(input).validateSync(), undefined);
    if (failNotification) throw new Error('Notification unavailable');
    notificationSaved = true;
    return [{ ...input, _id: new mongoose.Types.ObjectId() }];
  });
  const request = { auth: { userId }, params: { workshopId: String(workshopId) } };
  const run = async (req = request) => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await registerWorkshop(req, response);
    return response;
  };
  member = false;
  assert.equal((await run()).statusCode, 403);
  member = true;
  assert.equal((await run({ ...request, params: { workshopId: 'invalid' } })).statusCode, 400);
  count = 1;
  assert.equal((await run()).statusCode, 409);
  assert.equal(registration.mock.callCount(), 0);
  assert.equal(notifications.mock.callCount(), 0);
  count = 0;
  failNotification = true;
  assert.equal((await run()).statusCode, 503);
  failNotification = false;
  const success = await run();
  assert.equal(success.statusCode, 200);
  assert.deepEqual(success.body.data, { id: attendance._id, status: 'registered', meetingUrl: workshop.meetingUrl });
  const notice = notifications.mock.calls.at(-1).arguments[0][0];
  assert.equal(notice.recipientId, userId);
  assert.equal(notice.actorId, undefined, 'host reservations must receive their confirmation too');
  assert.equal(notice.type, 'workshop_registered');
  assert.equal(notice.entityType, 'workshop');
  assert.equal(notice.entityId, workshopId);
  assert.equal(notice.href, workshop.meetingUrl);
  assert.match(notice.body, /Making a scene/);
  assert.equal((await run()).statusCode, 200);
  assert.equal(notifications.mock.callCount(), 2, 'ordinary retries reuse the saved notification');
});

test('notifications and staff decisions are durable append-only domain records', () => {
  assert.ok(Notification.schema.indexes().some(([fields]) => fields.recipientId === 1 && fields.createdAt === -1));
  assert.ok(NotificationDelivery.schema.indexes().some(([fields]) => fields.idempotencyKey === 1));
  assert.ok(ModerationAction.schema.path('action').enumValues.includes('recommend_remove'));
  assert.ok(!ModerationAction.schema.path('action').enumValues.includes('remove'));
  assert.ok(CompetitionAudit.schema.path('action').enumValues.includes('results_published'));
  assert.ok(Notification.schema.path('type').enumValues.includes('question_targeted'));
});

test('writing assistance extracts all response message text without persisting drafts', () => {
  const response = { output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: 'First suggestion.' }] }, { type: 'message', content: [{ type: 'output_text', text: 'Second suggestion.' }] }] };
  assert.equal(extractOutputText(response), 'First suggestion.\nSecond suggestion.');
  assert.ok(AiUsage.schema.indexes().some(([fields]) => fields.userId === 1 && fields.day === 1));
});

test('post visibility is consistent for public, scheduled, unpublished, and owner access', () => {
  const author = '507f1f77bcf86cd799439011';
  const stranger = { userId: '507f191e810c19729de860ea', canUseEarlyAccess: false };
  const member = { ...stranger, canUseEarlyAccess: true };
  const owner = { userId: author, canUseEarlyAccess: false };
  const future = new Date(Date.now() + 60_000);
  assert.equal(canAccessPost({ author, publicationStatus: 'published', publicAt: new Date(0) }, stranger), true);
  assert.equal(canAccessPost({ author, publicationStatus: 'published', publicAt: future }, stranger), false);
  assert.equal(canAccessPost({ author, publicationStatus: 'published', publicAt: future }, member), true);
  assert.equal(canAccessPost({ author, publicationStatus: 'unpublished', publicAt: future }, member), false);
  assert.equal(canAccessPost({ author, publicationStatus: 'unpublished', publicAt: future }, owner), true);
  assert.ok(publicPostClause().$or.length >= 2);
  assert.equal(Publication.schema.indexes().filter(([fields]) => fields.publicAt === 1 && fields.createdAt === -1).length, 1);
});

test('published block validation bounds content and rejects unsafe image URLs', () => {
  assert.ok(parsePostBody(JSON.stringify([{ id: 'safe-1', type: 'text', content: '<script>is rendered as text</script>' }])));
  assert.ok(parsePostBody(JSON.stringify([{ id: 'image-1', type: 'image', content: 'https://images.example.test/photo.webp' }])));
  assert.equal(parsePostBody(JSON.stringify([{ id: 'image-1', type: 'image', content: 'javascript:alert(1)' }])), null);
  assert.equal(parsePostBody(JSON.stringify([{ id: 'image-1', type: 'image', content: 'https://' }])), null);
  assert.equal(parsePostBody(JSON.stringify([{ id: 'image-1', type: 'image', content: 'https://user:pass@images.example.test/photo.webp' }])), null);
  assert.equal(parsePostBody(JSON.stringify([{ id: 'image-1', type: 'image', content: 'data:image/svg+xml,<svg onload=alert(1) />' }])), null);
  assert.equal(parsePostBody(JSON.stringify([{ id: 'same', type: 'text', content: 'one' }, { id: 'same', type: 'text', content: 'two' }])), null);
  assert.equal(parsePostBody(JSON.stringify([{ id: 'divider-1', type: 'divider', content: 'hidden text' }])), null);
  assert.equal(parsePostBody(JSON.stringify([{ id: 'text-1', type: 'text', content: 'x'.repeat(10_001) }])), null);
  assert.equal(parsePostBody(JSON.stringify([{ id: 'text-1', type: 'text', content: { html: '<script>' } }])), null);
  assert.equal(parsePostBody(JSON.stringify([{ id: 'bad id', type: 'text', content: 'unsafe identifier' }])), null);
  assert.equal(parsePostBody(JSON.stringify([{ id: 'image-1', type: 'image', content: 'https://images.example.test/photo.webp', alt: 'x'.repeat(301) }])), null);
  assert.equal(parsePostBody(JSON.stringify([{ id: 'code-1', type: 'code', content: 'x'.repeat(50_001) }])), null);
  assert.equal(parsePostBody(JSON.stringify(Array.from({ length: 501 }, (_, index) => ({ id: `text-${index}`, type: 'text', content: 'bounded' })))), null);
  assert.equal(isSafeImageUrl('http://images.example.test/photo.jpg'), true);
  assert.equal(isSafeImageUrl('https://images.example.test/photo.jpg'), true);
  assert.equal(isSafeImageUrl('javascript:alert(1)'), false);
  assert.equal(isSafeImageUrl('https://'), false);
});

test('notification delivery retries use bounded exponential backoff', () => {
  const now = new Date('2026-08-24T12:00:00.000Z');
  assert.equal(MAX_ATTEMPTS, 5);
  assert.equal(calculateRetryAt(1, now).toISOString(), '2026-08-24T12:15:00.000Z');
  assert.equal(calculateRetryAt(3, now).toISOString(), '2026-08-24T13:00:00.000Z');
});

test('upload validation checks image signatures and removes spoofed temporary files', async () => {
  assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(detectImageMime(Buffer.from('RIFFxxxxWEBP')), 'image/webp');
  assert.equal(detectImageMime(Buffer.from('GIF89a')), 'image/gif');
  assert.equal(detectImageMime(Buffer.from('<script>alert(1)</script>')), null);

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ink-rider-upload-'));
  const filePath = path.join(directory, 'spoofed.jpg');
  await fs.writeFile(filePath, '<script>alert(1)</script>');
  const response = createResponse();
  let nextCalled = false;

  try {
    await validateImageFile({ file: { path: filePath, mimetype: 'image/jpeg' } }, response, () => { nextCalled = true; });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.payload, {
      success: false,
      code: 'INVALID_IMAGE_FILE',
      message: 'Uploaded cover image content is invalid',
    });
    assert.equal(nextCalled, false);
    await assert.rejects(fs.access(filePath));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }

  const mismatchDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ink-rider-upload-mismatch-'));
  const mismatchPath = path.join(mismatchDirectory, 'mismatch.png');
  await fs.writeFile(mismatchPath, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  const mismatchResponse = createResponse();

  try {
    await validateImageFile({ file: { path: mismatchPath, mimetype: 'image/png' } }, mismatchResponse, () => assert.fail('MIME mismatch must not continue'));
    assert.equal(mismatchResponse.statusCode, 400);
    assert.equal(mismatchResponse.payload.code, 'INVALID_IMAGE_FILE');
    await assert.rejects(fs.access(mismatchPath));
  } finally {
    await fs.rm(mismatchDirectory, { recursive: true, force: true });
  }

  let noFileNextCalled = false;
  await validateImageFile({}, createResponse(), () => { noFileNextCalled = true; });
  assert.equal(noFileNextCalled, true);
});

test('premium endpoints require authentication before entitlement lookup', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  const entitlements = await fetch(`http://127.0.0.1:${address.port}/api/v1/me/entitlements`);
  const summary = await fetch(`http://127.0.0.1:${address.port}/api/v1/posts/507f1f77bcf86cd799439011/summary`);
  assert.equal(entitlements.status, 401);
  assert.equal(summary.status, 401);
  const earlyAccess = await fetch(`http://127.0.0.1:${address.port}/api/post/early-access`);
  const register = await fetch(`http://127.0.0.1:${address.port}/api/v1/workshops/507f1f77bcf86cd799439011/registration`, { method: 'PUT' });
  const update = await fetch(`http://127.0.0.1:${address.port}/api/v1/creator-updates`, { method: 'POST' });
  const directRequest = await fetch(`http://127.0.0.1:${address.port}/api/v1/creators/507f1f77bcf86cd799439011/requests`, { method: 'POST' });
  assert.equal(earlyAccess.status, 401);
  assert.equal(register.status, 401);
  assert.equal(update.status, 401);
  assert.equal(directRequest.status, 401);
  const checkout = await fetch(`http://127.0.0.1:${address.port}/api/v1/billing/checkout`, { method: 'POST' });
  const invalidWebhook = await fetch(`http://127.0.0.1:${address.port}/api/v1/billing/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=bad' }, body: '{}' });
  assert.equal(checkout.status, 401);
  assert.equal(invalidWebhook.status, 400);
  const drafts = await fetch(`http://127.0.0.1:${address.port}/api/drafts`);
  const editPost = await fetch(`http://127.0.0.1:${address.port}/api/post/507f1f77bcf86cd799439011`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' });
  const staffReports = await fetch(`http://127.0.0.1:${address.port}/api/staff/reports`);
  const createCompetition = await fetch(`http://127.0.0.1:${address.port}/api/competition`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(drafts.status, 401);
  assert.equal(editPost.status, 401);
  assert.equal(staffReports.status, 401);
  assert.equal(createCompetition.status, 401);
  const writingAssistant = await fetch(`http://127.0.0.1:${address.port}/api/v1/writing-assistant`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(writingAssistant.status, 401);
});

test('creator support endpoints are no longer registered', async t => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/api/v1/me/creator-support`;
  for (const [method, path] of [['GET', url], ['PUT', `${url}/507f1f77bcf86cd799439011`], ['DELETE', `${url}/507f1f77bcf86cd799439011`]]) {
    const response = await fetch(path, { method });
    assert.equal(response.status, 404);
  }
});

test('standalone transaction fallback does not attach a null session to queries', () => {
  const query = {
    session(value) {
      this.sessionValue = value;
      return this;
    },
  };
  assert.equal(withOptionalSession(query, null), query);
  assert.equal(query.sessionValue, undefined);

  const session = { id: 'transaction-session' };
  assert.equal(withOptionalSession(query, session), query);
  assert.equal(query.sessionValue, session);
});

test('standalone MongoDB topology bypasses unsupported transactions', async () => {
  const originalClient = mongoose.connection.client;
  mongoose.connection.client = { topology: { description: { type: 'Single' } } };
  try {
    await withTransaction(async session => assert.equal(session, null));
  } finally {
    mongoose.connection.client = originalClient;
  }
});

test('legacy HTTP terminology maps request fields and preserves response aliases', () => {
  const { normalizeLegacyRequest, addLegacyResponseAliases } = require('../middlewares/legacy-terminology.middleware');
  const req = {
    originalUrl: '/api/post',
    body: { postId: 'one', format: 'article', note: 'An article title', items: [{ post: 'two' }] },
    query: { postId: 'one', type: 'article' },
  };
  normalizeLegacyRequest(req, {}, () => {});
  assert.equal(req.body.publicationId, 'one');
  assert.equal(req.body.format, 'story');
  assert.equal(req.body.note, 'An article title');
  assert.equal(req.body.items[0].publication, 'two');
  assert.equal(req.query.publicationId, 'one');
  assert.equal(req.query.type, 'story');

  const res = { json(payload) { this.payload = payload; return this; } };
  addLegacyResponseAliases(req, res, () => {});
  res.json({ data: { publicationId: 'one', format: 'story', appreciationsCount: 2, isAppreciated: true, note: 'A story title' } });
  assert.deepEqual(res.payload.data, {
    publicationId: 'one', postId: 'one', format: 'article', appreciationsCount: 2,
    likesCount: 2, isAppreciated: true, isLiked: true, note: 'A story title',
  });

  const canonicalReq = { originalUrl: '/api/publications' };
  const canonicalRes = { json(payload) { this.payload = payload; return this; } };
  addLegacyResponseAliases(canonicalReq, canonicalRes, () => {});
  canonicalRes.json({ posts: [{ format: 'story', appreciationsCount: 2 }], postId: 'one' });
  assert.deepEqual(canonicalRes.payload, { publications: [{ format: 'story', appreciationsCount: 2 }], publicationId: 'one' });
});

test('publication database migration names collections, relationships, formats, and votes', () => {
  const migration = require('../scripts/migrate-publication-terminology');
  assert.ok(migration.collectionRenames.some(([from, to]) => from === 'posts' && to === 'publications'));
  assert.ok(migration.collectionRenames.some(([from, to]) => from === 'likes' && to === 'appreciations'));
  assert.ok(migration.fieldRenames.appreciations.some(([from, to]) => from === 'postId' && to === 'publicationId'));
  assert.ok(migration.valueRenames.some(([collection, field, from, to]) => collection === 'publications' && field === 'format' && from === 'article' && to === 'story'));
  assert.ok(migration.nestedRenames.competitions.entries.some(([from, to]) => from === 'likesCount' && to === 'votesCount'));
});

test('publication migration inspects populated legacy data when the canonical collection is empty', async () => {
  const { inspect } = require('../scripts/migrate-publication-terminology');
  const db = {
    listCollections: () => ({ toArray: async () => [{ name: 'posts' }, { name: 'publications' }] }),
    collection: name => ({
      estimatedDocumentCount: async () => name === 'posts' ? 2 : 0,
      countDocuments: async filter => name === 'posts' && filter.likesCount && !filter.appreciationsCount ? 2 : 0,
    }),
  };
  const plan = await inspect(db);
  assert.deepEqual(plan.conflicts, []);
  assert.equal(plan.steps.find(step => step.operation === 'collection' && step.oldName === 'posts').emptyTargetExists, true);
  assert.equal(plan.steps.find(step => step.operation === 'field' && step.collection === 'publications').count, 2);
});
