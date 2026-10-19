const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const integrationEnabled = process.env.RUN_DB_INTEGRATION === 'true';

if (!integrationEnabled) {
  test('database integration suite is enabled only with RUN_DB_INTEGRATION=true', { skip: 'MongoDB integration service is not enabled' }, () => {});
} else {
  process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'integration-webhook-secret';
  const app = require('../src/app');
  const User = require('../schemas/user.schema');
  const Publication = require('../schemas/publication.schema');
  const Save = require('../schemas/save.schema');
  const Appreciation = require('../schemas/appreciation.schema');
  const PublicationRevision = require('../schemas/publication-revision.schema');
  const Membership = require('../schemas/membership.schema');
  const ProviderEvent = require('../schemas/provider-event.schema');
  const Profile = require('../schemas/profile.schema');
  const Topic = require('../schemas/topic.schema');
  const Question = require('../schemas/question.schema');
  const Collection = require('../schemas/collection.schema');
  const Competition = require('../schemas/competition.schema');
  const ShortSeries = require('../schemas/short-series.schema');
  const Notification = require('../schemas/notification.schema');
  const InteractionEvent = require('../schemas/interaction-event.schema');
  const Draft = require('../schemas/draft.schema');
  const Follow = require('../schemas/follow.schema');
  const Comment = require('../schemas/comment.schema');
  const CommentAppreciation = require('../schemas/comment-appreciation.schema');
  const Report = require('../schemas/report.schema');
  const ModerationAction = require('../schemas/moderation-action.schema');
  const { generateToken } = require('../utils/helper');

  let server;
  let baseUrl;
  let owner;
  let otherUser;
  let post;
  let shortPost;
  let shortPost3;
  let shortPost4;
  let topic;
  let question;
  let collection;
  let competition;
  let series;
  let notification;
  // Keep the shared fixture prefix unique without exceeding the User schema's
  // 30-character username limit once `-owner` or `-other` is appended.
  const prefix = `i${Date.now().toString(36)}${process.pid.toString(36)}`;

  const authHeaders = user => ({
    authorization: `Bearer ${generateToken({ id: user._id.toString() }, '10m')}`,
    'content-type': 'application/json',
  });

  test('collections append any public post or short atomically, including legacy lists', async () => {
    const target = await Collection.create({ title: `${prefix} mixed reading`, author: otherUser._id, visibility: 'private', publications: [post._id] });
    const endpoint = publicationId => `${baseUrl}/api/v1/collections/${target._id}/posts/${publicationId}`;
    try {
      assert.equal((await fetch(endpoint(shortPost._id), { method: 'PUT' })).status, 401);
      assert.equal((await fetch(endpoint(shortPost._id), { method: 'PUT', headers: authHeaders(owner) })).status, 404);
      assert.equal((await fetch(endpoint('invalid'), { method: 'PUT', headers: authHeaders(otherUser) })).status, 400);
      const responses = await Promise.all(Array.from({ length: 3 }, () => fetch(endpoint(shortPost._id), { method: 'PUT', headers: authHeaders(otherUser) })));
      assert.ok(responses.every(response => response.status === 200));
      const stored = await Collection.findById(target._id);
      assert.deepEqual(stored.items.map(item => String(item.publication)), [String(post._id), String(shortPost._id)]);
      assert.deepEqual(stored.items.map(item => item.position), [0, 1]);
      assert.equal(stored.publications.length, 0);
      const detail = await fetch(`${baseUrl}/api/collection/${target._id}`, { headers: authHeaders(otherUser) });
      assert.equal(detail.status, 200);
      assert.deepEqual((({ postsCount, storiesCount, shortsCount }) => ({ postsCount, storiesCount, shortsCount }))((await detail.json()).data), { postsCount: 2, storiesCount: 1, shortsCount: 1 });
      const repeated = await fetch(endpoint(shortPost._id), { method: 'PUT', headers: authHeaders(otherUser) });
      assert.deepEqual((await repeated.json()).data, { added: false });
      await Collection.updateOne({ _id: target._id }, { $set: { items: Array.from({ length: 100 }, (_, position) => ({ publication: position === 0 ? shortPost._id : new mongoose.Types.ObjectId(), position })) } });
      assert.equal((await fetch(endpoint(shortPost3._id), { method: 'PUT', headers: authHeaders(otherUser) })).status, 400);
      assert.equal((await fetch(endpoint(shortPost._id), { method: 'PUT', headers: authHeaders(otherUser) })).status, 200);
      const hidden = await Publication.create({ title: `${prefix} unavailable`, body: validBody('Unavailable'), author: owner._id, publicationStatus: 'unpublished' });
      try { assert.equal((await fetch(endpoint(hidden._id), { method: 'PUT', headers: authHeaders(otherUser) })).status, 404); }
      finally { await Publication.deleteOne({ _id: hidden._id }); }
      const future = await Publication.create({ title: `${prefix} future`, body: validBody('Future'), author: owner._id, publicAt: new Date(Date.now() + 86_400_000) });
      try { assert.equal((await fetch(endpoint(future._id), { method: 'PUT', headers: authHeaders(otherUser) })).status, 404); }
      finally { await Publication.deleteOne({ _id: future._id }); }
      const created = await fetch(`${baseUrl}/api/collection`, { method: 'POST', headers: authHeaders(otherUser), body: JSON.stringify({ title: `${prefix} picked short`, visibility: 'private', publicationIds: [String(shortPost._id)] }) });
      assert.equal(created.status, 201);
      const { data } = await created.json();
      const newCollection = await Collection.findById(data.collectionId);
      assert.equal(String(newCollection.items[0].publication), String(shortPost._id));
      await Collection.deleteOne({ _id: newCollection._id });
    } finally { await Collection.deleteOne({ _id: target._id }); }
  });

  const validBody = title => JSON.stringify([
    { id: 'block-1', type: 'text', content: `${title} body` },
  ]);

  test.before(async () => {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5_000 });
    // Text-search routes require the schema's text index. Await model
    // initialization so a fresh CI database cannot race index creation.
    await Publication.init();
    await CommentAppreciation.init();
    owner = await User.create({
      username: `${prefix}-owner`,
      email: `${prefix}-owner@example.test`,
      password: 'IntegrationPassword123!',
      verified: true,
      role: 'admin',
    });
    otherUser = await User.create({
      username: `${prefix}-other`,
      email: `${prefix}-other@example.test`,
      password: 'IntegrationPassword123!',
      verified: true,
    });
    await Profile.create([
      { userId: owner._id, handle: `${prefix}-owner`, displayName: `${prefix} owner`, writerStatus: 'writer', directRequestsEnabled: true },
      { userId: otherUser._id, handle: `${prefix}-other`, displayName: `${prefix} other`, writerStatus: 'writer', directRequestsEnabled: true },
    ]);
    topic = await Topic.create({ slug: `${prefix}-topic`, displayName: `${prefix} topic`, status: 'active', order: 1 });
    post = await Publication.create({
      title: `${prefix} post`,
      format: 'story',
      body: validBody(`${prefix} initial`),
      author: owner._id,
      tags: ['integration'],
      publicAt: new Date(),
      currentRevision: 1,
    });
    await PublicationRevision.create({
      publicationId: post._id,
      revision: 1,
      authorId: owner._id,
      title: post.title,
      body: post.body,
      format: post.format,
      tags: post.tags,
      publicAt: post.publicAt,
    });
    shortPost = await Publication.create({
      title: `${prefix} short`, format: 'short', body: validBody(`${prefix} short`), author: owner._id,
      tags: ['integration'], publicAt: new Date(), currentRevision: 1,
    });
    shortPost3 = await Publication.create({
      title: `${prefix} short three`, format: 'short', body: validBody(`${prefix} short three`), author: owner._id,
      tags: ['integration'], publicAt: new Date(), currentRevision: 1,
    });
    shortPost4 = await Publication.create({
      title: `${prefix} short four`, format: 'short', body: validBody(`${prefix} short four`), author: owner._id,
      tags: ['integration'], publicAt: new Date(), currentRevision: 1,
    });
    question = await Question.create({
      text: `${prefix} integration question?`, normalizedText: `${prefix} integration question`,
      context: 'integration', author: otherUser._id, tags: [topic.slug],
    });
    collection = await Collection.create({
      title: `${prefix} collection`, description: 'integration', author: owner._id,
      publications: [post._id], items: [{ publication: post._id, position: 0 }],
    });
    competition = await Competition.create({
      title: `${prefix} competition`, description: 'integration', createdBy: owner._id,
      status: 'open', openDate: new Date(Date.now() - 60_000), closeDate: new Date(Date.now() + 86_400_000),
    });
    series = await ShortSeries.create({ title: `${prefix} series`, author: owner._id, items: [{ publication: shortPost._id, position: 0 }] });
    notification = await Notification.create({
      recipientId: owner._id, actorId: otherUser._id, type: 'question_answered', title: 'Integration notification',
      body: 'Integration', href: `/explore/questions/${question._id}`, entityType: 'question', entityId: question._id,
    });
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    const userIds = [owner?._id, otherUser?._id].filter(Boolean);
    if (userIds.length) {
      await Promise.all([
        Save.deleteMany({ userId: { $in: userIds } }),
        Appreciation.deleteMany({ userId: { $in: userIds } }),
        PublicationRevision.deleteMany({ authorId: { $in: userIds } }),
        Publication.deleteMany({ author: { $in: userIds } }),
        Membership.deleteMany({ userId: { $in: userIds } }),
        User.deleteMany({ _id: { $in: userIds } }),
        Profile.deleteMany({ userId: { $in: userIds } }),
        Topic.deleteMany({ _id: topic?._id }),
        Question.deleteMany({ _id: question?._id }),
        Collection.deleteMany({ _id: collection?._id }),
        Competition.deleteMany({ _id: competition?._id }),
        ShortSeries.deleteMany({ _id: series?._id }),
        Notification.deleteMany({ recipientId: { $in: userIds } }),
        InteractionEvent.deleteMany({ actorId: { $in: userIds } }),
        Draft.deleteMany({ authorId: { $in: userIds } }),
        Follow.deleteMany({ followerId: { $in: userIds } }),
        Comment.deleteMany({ userId: { $in: userIds } }),
        CommentAppreciation.deleteMany({ userId: { $in: userIds } }),
        Report.deleteMany({ reporterId: { $in: userIds } }),
        ModerationAction.deleteMany({ moderatorId: { $in: userIds } }),
        Publication.deleteMany({ author: { $in: userIds } }),
      ]);
    }
    await ProviderEvent.deleteMany({ eventId: { $regex: `^${prefix}` } });
    await mongoose.disconnect();
  });

  test('owner post deletion clears discussions and saves while missing references stay safe', async () => {
    const disposable = await Publication.create({ title: `${prefix} delete`, body: validBody('delete'), author: owner._id, tags: ['delete'] });
    const unrelated = await Comment.create({ publicationId: post._id, userId: otherUser._id, content: 'Unrelated comment' });
    const root = await Comment.create({ publicationId: disposable._id, userId: otherUser._id, content: 'Root' });
    const reply = await Comment.create({ publicationId: disposable._id, userId: owner._id, parentCommentId: root._id, content: 'Reply' });
    await CommentAppreciation.create({ commentId: reply._id, userId: otherUser._id });
    await Save.create({ publicationId: disposable._id, userId: otherUser._id });
    await Appreciation.create({ publicationId: disposable._id, userId: otherUser._id });
    await Report.create([
      { reporterId: otherUser._id, subjectType: 'publication', subjectId: disposable._id, reason: 'spam' },
      { reporterId: otherUser._id, subjectType: 'comment', subjectId: reply._id, reason: 'spam' },
      { reporterId: owner._id, subjectType: 'publication', subjectId: disposable._id, reason: 'other', status: 'actioned' },
    ]);
    const url = `${baseUrl}/api/v1/posts/${disposable._id}`;
    assert.equal((await fetch(url, { method: 'DELETE' })).status, 401);
    assert.equal((await fetch(url, { method: 'DELETE', headers: authHeaders(otherUser) })).status, 404);
    assert.ok(await Publication.exists({ _id: disposable._id }));
    assert.equal((await fetch(url, { method: 'DELETE', headers: authHeaders(owner) })).status, 204);
    assert.equal(await Publication.exists({ _id: disposable._id }), null);
    assert.equal(await Comment.countDocuments({ publicationId: disposable._id }), 0);
    assert.equal(await CommentAppreciation.countDocuments({ commentId: reply._id }), 0);
    assert.equal(await Save.countDocuments({ publicationId: disposable._id }), 0);
    assert.equal(await Appreciation.countDocuments({ publicationId: disposable._id }), 0);
    assert.equal(await Report.countDocuments({ subjectId: { $in: [disposable._id, reply._id] }, status: 'pending' }), 0);
    assert.equal(await Report.countDocuments({ subjectId: disposable._id, status: 'actioned' }), 1);
    assert.ok(await Comment.exists({ _id: unrelated._id }));
    assert.equal((await fetch(`${baseUrl}/api/post/${disposable._id}`, { headers: authHeaders(owner) })).status, 404);
    // Even a legacy dangling save resolves to null and is omitted without user-list rewrites.
    await Save.create({ publicationId: disposable._id, userId: otherUser._id });
    const bookmarks = await (await fetch(`${baseUrl}/api/user/bookmarks`, { headers: authHeaders(otherUser) })).json();
    assert.ok(bookmarks.every(item => String(item._id) !== String(disposable._id)));
    assert.equal((await fetch(url, { method: 'DELETE', headers: authHeaders(owner) })).status, 404);
  });

  test('write authorization rejects another user without changing the post', async () => {
    const response = await fetch(`${baseUrl}/api/post/${post._id}`, {
      method: 'PUT',
      headers: authHeaders(otherUser),
      body: JSON.stringify({
        expectedRevision: 1,
        title: 'Unauthorized edit',
        body: validBody('Unauthorized edit'),
        tags: ['integration'],
      }),
    });

    assert.equal(response.status, 404);
    const current = await Publication.findById(post._id).select('title currentRevision');
    assert.equal(current.title, post.title);
    assert.equal(current.currentRevision, 1);
  });

  test('concurrent owner edits allow one revision and reject the stale revision', async () => {
    const requests = ['First concurrent edit', 'Second concurrent edit'].map(title => fetch(`${baseUrl}/api/post/${post._id}`, {
      method: 'PUT',
      headers: authHeaders(owner),
      body: JSON.stringify({
        expectedRevision: 1,
        title,
        body: validBody(title),
        tags: ['integration'],
      }),
    }));
    const responses = await Promise.all(requests);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);

    const current = await Publication.findById(post._id).select('currentRevision');
    assert.equal(current.currentRevision, 2);
    assert.equal(await PublicationRevision.countDocuments({ publicationId: post._id }), 2);
  });

  test('duplicate saves and likes remain idempotent and counters match source records', async () => {
    const saveUrl = `${baseUrl}/api/post/${post._id}/bookmark`;
    const likeUrl = `${baseUrl}/api/post/${post._id}/like`;
    const ownerHeaders = authHeaders(owner);
    const otherHeaders = authHeaders(otherUser);

    assert.equal((await fetch(saveUrl, { method: 'PUT', headers: ownerHeaders })).status, 200);
    assert.equal((await fetch(saveUrl, { method: 'PUT', headers: ownerHeaders })).status, 200);
    assert.equal((await fetch(likeUrl, { method: 'PUT', headers: ownerHeaders })).status, 200);
    assert.equal((await fetch(likeUrl, { method: 'PUT', headers: ownerHeaders })).status, 200);
    assert.equal((await fetch(likeUrl, { method: 'PUT', headers: otherHeaders })).status, 200);

    const current = await Publication.findById(post._id).select('appreciationsCount');
    assert.equal(await Save.countDocuments({ userId: owner._id, publicationId: post._id }), 1);
    assert.equal(await Appreciation.countDocuments({ publicationId: post._id }), 2);
    assert.equal(current.appreciationsCount, 2);
  });

  test('comments, follows and likes create recipient-scoped inbox notifications through current and legacy routes', async () => {
    const filter = { recipientId: owner._id, actorId: otherUser._id, entityId: shortPost4._id };
    const likeUrl = `${baseUrl}/api/post/${shortPost4._id}/like`;
    const headers = authHeaders(otherUser);
    for (let retry = 0; retry < 2; retry++) assert.equal((await fetch(likeUrl, { method: 'PUT', headers })).status, 200);
    assert.equal(await Notification.countDocuments({ ...filter, type: 'publication_appreciated' }), 1);
    assert.equal((await fetch(likeUrl, { method: 'DELETE', headers })).status, 200);
    assert.equal(await Notification.countDocuments({ ...filter, type: 'publication_appreciated' }), 1);
    assert.equal((await fetch(`${baseUrl}/api/post/like/${shortPost4._id}`, { method: 'POST', headers })).status, 200);
    assert.equal(await Notification.countDocuments({ ...filter, type: 'publication_appreciated' }), 2);
    assert.equal((await fetch(likeUrl, { method: 'PUT', headers: authHeaders(owner) })).status, 200);
    assert.equal(await Notification.countDocuments({ recipientId: owner._id, actorId: owner._id, type: 'publication_appreciated' }), 0);
    for (const [url, body] of [
      [`/api/post/${shortPost4._id}/comments`, { text: 'Current comment' }],
      [`/api/post/comment/${shortPost4._id}`, { text: 'Legacy comment' }],
    ]) assert.equal((await fetch(`${baseUrl}${url}`, { method: 'POST', headers, body: JSON.stringify(body) })).status, 201);
    assert.equal(await Notification.countDocuments({ ...filter, type: 'publication_commented' }), 2);
    const followFilter = { recipientId: owner._id, actorId: otherUser._id, type: 'user_followed' };
    const before = await Notification.countDocuments(followFilter);
    const followUrl = `${baseUrl}/api/post/follow/${owner._id}`;
    await Follow.deleteOne({ followerId: otherUser._id, followingId: owner._id });
    assert.equal((await fetch(followUrl, { method: 'POST', headers })).status, 200);
    assert.equal(await Notification.countDocuments(followFilter), before + 1);
    assert.equal((await fetch(followUrl, { method: 'POST', headers })).status, 200);
    assert.equal(await Notification.countDocuments(followFilter), before + 1);
    const explicitFollowUrl = `${baseUrl}/api/writer/${owner._id}/follow`;
    for (let retry = 0; retry < 2; retry++) assert.equal((await fetch(explicitFollowUrl, { method: 'PUT', headers })).status, 200);
    assert.equal(await Notification.countDocuments(followFilter), before + 2);
    assert.equal((await fetch(explicitFollowUrl, { method: 'DELETE', headers })).status, 200);
    for (let retry = 0; retry < 2; retry++) assert.equal((await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: 'PUT', headers, body: JSON.stringify({ topicSlugs: [], writerIds: [String(owner._id)], completed: true }),
    })).status, 200);
    assert.equal(await Notification.countDocuments(followFilter), before + 3);
    const inbox = await (await fetch(`${baseUrl}/api/v1/notifications`, { headers: authHeaders(owner) })).json();
    for (const type of ['post_liked', 'post_commented', 'user_followed']) assert.ok(inbox.data.some(item => item.type === type));
    const otherInbox = await (await fetch(`${baseUrl}/api/v1/notifications`, { headers })).json();
    assert.ok(otherInbox.data.every(item => item.recipientId === String(otherUser._id)));
  });

  test('comment editing, likes, paginated replies and deletion preserve ownership and thread history', async () => {
    const listUrl = `${baseUrl}/api/post/${post._id}/comments`;
    const create = async (user, text, parentCommentId) => {
      const response = await fetch(listUrl, { method: 'POST', headers: authHeaders(user), body: JSON.stringify({ text, parentCommentId }) });
      assert.equal(response.status, 201);
      return (await response.json()).data;
    };
    const comment = await create(owner, 'Original comment');
    const url = `${baseUrl}/api/v1/posts/${post._id}/comments/${comment.id}`;
    const reply = await create(otherUser, 'Another reader reply', comment.id);
    await create(owner, 'Second reply', comment.id);
    const nested = await create(owner, 'Nested reply', reply.id);
    for (const method of ['PATCH', 'DELETE']) {
      assert.equal((await fetch(url, { method, headers: authHeaders(otherUser), body: JSON.stringify({ text: 'Unauthorized' }) })).status, 403);
    }
    const edit = await fetch(url, { method: 'PATCH', headers: authHeaders(owner), body: JSON.stringify({ text: 'Edited comment' }) });
    assert.equal(edit.status, 200);
    assert.equal((await edit.json()).data.content, 'Edited comment');
    assert.equal((await fetch(url, { method: 'PATCH', headers: authHeaders(owner), body: JSON.stringify({ text: ' ' }) })).status, 400);
    for (let retry = 0; retry < 2; retry++) assert.equal((await fetch(`${url}/like`, { method: 'PUT', headers: authHeaders(otherUser) })).status, 200);
    assert.equal(await CommentAppreciation.countDocuments({ commentId: comment.id }), 1);
    const member = await (await fetch(listUrl, { headers: authHeaders(otherUser) })).json();
    assert.equal(member.data.find(row => row.id === comment.id).isAppreciated, true);
    const guest = await (await fetch(listUrl)).json();
    assert.equal(guest.data.find(row => row.id === comment.id).isAppreciated, false);
    const page = await (await fetch(`${listUrl}?parentCommentId=${comment.id}&limit=1`)).json();
    assert.equal(page.data.length, 1);
    assert.ok(page.meta.nextCursor);
    const next = await (await fetch(`${listUrl}?parentCommentId=${comment.id}&limit=1&cursor=${page.meta.nextCursor}`)).json();
    assert.equal(next.data.length, 1);
    assert.notEqual(next.data[0].id, page.data[0].id);
    const before = await Publication.findById(post._id);
    for (let retry = 0; retry < 2; retry++) assert.equal((await fetch(url, { method: 'DELETE', headers: authHeaders(owner) })).status, 200);
    assert.equal((await Publication.findById(post._id)).commentsCount, before.commentsCount - 1);
    const deleted = await Comment.findById(comment.id);
    assert.equal(deleted.content, '');
    assert.ok(deleted.deletedAt);
    assert.ok(await Comment.findById(reply.id));
    assert.ok(await Comment.findById(nested.id));
    const after = await (await fetch(listUrl)).json();
    assert.equal(after.data.find(row => row.id === comment.id).isDeleted, true);
    assert.equal(after.data.find(row => row.id === comment.id).author, null);
    assert.equal((await fetch(`${url}/like`, { method: 'PUT', headers: authHeaders(owner) })).status, 409);
    assert.equal((await fetch(url, { method: 'PATCH', headers: authHeaders(owner), body: JSON.stringify({ text: 'Restore' }) })).status, 409);
    assert.equal((await fetch(`${baseUrl}/api/v1/posts/${shortPost._id}/comments/${reply.id}`, { method: 'DELETE', headers: authHeaders(otherUser) })).status, 404);
    assert.equal((await fetch(listUrl, { method: 'POST', headers: authHeaders(owner), body: JSON.stringify({ text: 'Wrong post', parentCommentId: String(new mongoose.Types.ObjectId()) }) })).status, 404);

    const leaf = await create(owner, 'Delete without replies');
    const leafUrl = `${baseUrl}/api/v1/posts/${post._id}/comments/${leaf.id}`;
    assert.equal((await fetch(leafUrl, { method: 'DELETE', headers: authHeaders(owner) })).status, 200);
    const visible = await (await fetch(`${listUrl}?limit=1`)).json();
    assert.ok(visible.data.length);
    assert.ok(!visible.data.some(row => row.id === leaf.id));
    const all = await (await fetch(listUrl)).json();
    assert.ok(!all.data.some(row => row.id === leaf.id));

    // Deleted ancestors remain only while the chain reaches a live reply.
    assert.equal((await fetch(`${baseUrl}/api/v1/posts/${post._id}/comments/${reply.id}`, { method: 'DELETE', headers: authHeaders(otherUser) })).status, 200);
    const kept = await (await fetch(`${listUrl}?parentCommentId=${comment.id}`)).json();
    assert.equal(kept.data.find(row => row.id === reply.id).repliesCount, 1);
    assert.equal((await fetch(`${baseUrl}/api/v1/posts/${post._id}/comments/${nested.id}`, { method: 'DELETE', headers: authHeaders(owner) })).status, 200);
    const hidden = await (await fetch(`${listUrl}?parentCommentId=${comment.id}`)).json();
    assert.ok(!hidden.data.some(row => row.id === reply.id));
    const remaining = hidden.data[0];
    assert.equal((await fetch(`${baseUrl}/api/v1/posts/${post._id}/comments/${remaining.id}`, { method: 'DELETE', headers: authHeaders(owner) })).status, 200);
    const emptyBranch = await (await fetch(listUrl)).json();
    assert.ok(!emptyBranch.data.some(row => row.id === comment.id));
  });

  test('signed provider webhooks process once when delivered more than once', async () => {
    const event = {
      id: `${prefix}-checkout-event`,
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: owner._id.toString() },
          client_reference_id: owner._id.toString(),
          customer: `${prefix}-customer`,
          subscription: `${prefix}-subscription`,
          payment_status: 'paid',
        },
      },
    };
    const rawBody = Buffer.from(JSON.stringify(event));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex');
    const headers = {
      'content-type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`,
    };

    const first = await fetch(`${baseUrl}/api/v1/billing/webhook`, { method: 'POST', headers, body: rawBody });
    const second = await fetch(`${baseUrl}/api/v1/billing/webhook`, { method: 'POST', headers, body: rawBody });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal((await first.json()).received, true);
    assert.equal((await second.json()).duplicate, true);

    assert.equal(await ProviderEvent.countDocuments({ provider: 'stripe', eventId: event.id }), 1);
    const membership = await Membership.findOne({ userId: owner._id }).select('status providerSubscriptionId');
    assert.equal(membership.status, 'active');
    assert.equal(membership.providerSubscriptionId, `${prefix}-subscription`);
  });

  test('route-wide database reads reach every persisted route family', async () => {
    const ownerHeaders = authHeaders(owner);
    const routes = [
      ['api root', 'GET', '/api', 200],
      ['health', 'GET', '/health', 200],
      ['readiness', 'GET', '/readiness', 200],
      ['database status', 'GET', '/database-status', 200],
      ['robots', 'GET', '/robots.txt', 200],
      ['sitemap', 'GET', '/sitemap.xml', 200],
      ['posts', 'GET', '/api/post', 200],
      ['post detail', 'GET', `/api/post/${post._id}`, 200],
      ['post comments', 'GET', `/api/post/${post._id}/comments`, 200],
      ['post search', 'GET', '/api/post/search?query=integration', 200],
      ['category search', 'GET', '/api/post/search-cat?query=integration', 200],
      ['discovery feed', 'GET', '/api/post/feed?mode=latest', 200],
      ['short feed', 'GET', '/api/post/shorts', 200],
      ['depth options', 'GET', `/api/post/depth-options?publicationId=${post._id}`, 200],
      ['early access', 'GET', '/api/post/early-access', 200],
      ['user lookup', 'GET', `/api/user?username=${owner.username}`, 200],
      ['me', 'GET', '/api/user/me', 200],
      ['my posts', 'GET', '/api/user/me/posts', 200],
      ['bookmarks', 'GET', '/api/user/bookmarks', 200],
      ['analytics', 'GET', '/api/user/analytics', 200],
      ['collection list', 'GET', '/api/collection', 200],
      ['collection detail', 'GET', `/api/collection/${collection._id}`, 200],
      ['eligible collection posts', 'GET', '/api/collection/eligible-posts', 200],
      ['question list', 'GET', '/api/question', 200],
      ['question detail', 'GET', `/api/question/${question._id}`, 200],
      ['question suggest', 'GET', '/api/question/suggest?q=integration', 200],
      ['question opportunities', 'GET', '/api/question/opportunities', 200],
      ['competition list', 'GET', '/api/competition', 200],
      ['competition detail', 'GET', `/api/competition/${competition._id}`, 200],
      ['eligible competition posts', 'GET', `/api/competition/${competition._id}/eligible-posts`, 200],
      ['writer profile', 'GET', `/api/writer/${prefix}-owner`, 200],
      ['unified search', 'GET', '/api/search?q=integration', 200],
      ['question search', 'GET', '/api/search?q=integration&type=questions', 200],
      ['onboarding', 'GET', '/api/v1/onboarding', 200],
      ['reading history', 'GET', '/api/v1/reading-history', 200],
      ['entitlements', 'GET', '/api/v1/me/entitlements', 200],
      ['summary', 'GET', `/api/v1/posts/${post._id}/summary`, 200],
      ['workshops', 'GET', '/api/v1/workshops', 200],
      ['creator updates', 'GET', '/api/v1/creator-updates', 200],
      ['received requests', 'GET', '/api/v1/creator-requests/received', 200],
      ['notifications', 'GET', '/api/v1/notifications', 200],
      ['short series list', 'GET', '/api/short-series', 200],
      ['short series detail', 'GET', `/api/short-series/${series._id}`, 200],
      ['eligible shorts', 'GET', '/api/short-series/eligible-shorts', 200],
      ['draft list', 'GET', '/api/drafts', 200],
      ['staff reports', 'GET', '/api/staff/reports', 200],
    ];

    for (const [name, method, path, expected] of routes) {
      const response = await fetch(`${baseUrl}${path}`, { method, headers: ownerHeaders });
      assert.equal(response.status, expected, `${name} returned ${response.status}`);
    }
  });

  test('question categories search persisted questions without exposing private fields', async () => {
    const response = await fetch(`${baseUrl}/api/search?${new URLSearchParams({ q: topic.slug, type: 'questions' })}`, { headers: authHeaders(owner) });
    assert.equal(response.status, 200);
    const result = await response.json();
    const match = result.data.questions.find(item => item.id === question._id.toString());
    assert.ok(match);
    assert.equal(match.text, question.text);
    assert.equal(match.answersCount, 0);
    assert.equal(match.upvotes, undefined);
    assert.equal(match.followers, undefined);
    assert.equal(match.targetWriterIds, undefined);
    assert.deepEqual(result.data.posts, []);
    assert.deepEqual(result.data.writers, []);
  });

  test('content suggestions rank complete phrases and exclude unreleased metadata', async t => {
    const query = `${prefix} writing`;
    const records = await Publication.create([
      ...Array.from({ length: 8 }, (_, index) => ({
        title: `${query} guide ${index}`, body: validBody('Suggestion fixture'), author: owner._id,
        tags: [`${prefix}-writing-tips`, `${prefix}-writing-tips`, ...(index < 2 ? [`${prefix}-writing-dialogue`] : []), ...(index === 0 ? [`${prefix}-writing`] : [])],
        publicAt: new Date(),
      })),
      { title: `${query} unreleased`, body: validBody('Private fixture'), author: owner._id, tags: [`${prefix}-writing-secret`], publicAt: new Date(Date.now() + 86400000) },
      { title: `${query} unpublished`, body: validBody('Private fixture'), author: owner._id, tags: [`${prefix}-writing-hidden`], publicationStatus: 'unpublished' },
    ]);
    t.after(() => Publication.deleteMany({ _id: { $in: records.map(record => record._id) } }));
    const response = await fetch(`${baseUrl}/api/search?${new URLSearchParams({ q: query, suggestions: 'true', limit: '99' })}`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.data.suggestions.length, 5);
    assert.deepEqual(result.data.suggestions.slice(0, 3), [
      { text: query, articleCount: 1 },
      { text: `${query} tips`, articleCount: 8 },
      { text: `${query} dialogue`, articleCount: 2 },
    ]);
    assert.equal(result.data.suggestions.some(item => /secret|hidden|unreleased|unpublished/.test(item.text)), false);
    for (const suggestion of result.data.suggestions) {
      const searchResponse = await fetch(`${baseUrl}/api/search?${new URLSearchParams({ q: suggestion.text })}`);
      assert.equal(searchResponse.status, 200);
      assert.ok((await searchResponse.json()).data.posts.length > 0);
    }
  });

  test('route-wide database mutations persist and can be reloaded', async () => {
    const ownerHeaders = authHeaders(owner);
    const otherHeaders = authHeaders(otherUser);
    const json = async response => ({ status: response.status, body: await response.json().catch(() => null) });

    const draft = await json(await fetch(`${baseUrl}/api/drafts`, {
      method: 'POST', headers: ownerHeaders,
      body: JSON.stringify({ title: `${prefix} draft`, blocks: [{ id: 'draft-1', type: 'text', content: 'draft body' }], tags: ['integration'] }),
    }));
    assert.equal(draft.status, 201);
    const draftId = draft.body.data.id;
    assert.equal((await json(await fetch(`${baseUrl}/api/drafts/${draftId}`, { headers: ownerHeaders }))).status, 200);
    assert.equal((await json(await fetch(`${baseUrl}/api/drafts/${draftId}`, {
      method: 'PUT', headers: ownerHeaders,
      body: JSON.stringify({ expectedVersion: 1, title: `${prefix} draft updated`, blocks: [{ id: 'draft-1', type: 'text', content: 'updated' }] }),
    }))).status, 200);
    assert.equal((await Draft.findById(draftId)).version, 2);

    const onboarding = await json(await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: 'PUT', headers: ownerHeaders,
      body: JSON.stringify({ topicSlugs: [topic.slug], writerIds: [otherUser._id.toString()], completed: true }),
    }));
    assert.equal(onboarding.status, 200);
    assert.equal((await User.findById(owner._id)).onboardingCompletedAt instanceof Date, true);
    assert.equal((await Follow.countDocuments({ followerId: owner._id, followingId: otherUser._id })), 1);
    assert.equal((await json(await fetch(`${baseUrl}/api/v1/interests/inferred`, { method: 'DELETE', headers: ownerHeaders }))).status, 200);

    const createdQuestion = await json(await fetch(`${baseUrl}/api/question`, {
      method: 'POST', headers: ownerHeaders,
      body: JSON.stringify({ text: `${prefix} created question?`, context: 'integration', tags: [topic.slug] }),
    }));
    assert.equal(createdQuestion.status, 201);
    const questionId = createdQuestion.body.data.questionId;
    assert.equal((await json(await fetch(`${baseUrl}/api/question/${questionId}/upvote`, { method: 'PUT', headers: otherHeaders }))).status, 200);
    const answer = await json(await fetch(`${baseUrl}/api/question/${questionId}/answers`, {
      method: 'POST', headers: ownerHeaders, body: JSON.stringify({ text: 'An integration answer.' }),
    }));
    assert.equal(answer.status, 201);
    const answerId = answer.body.data.answer.id;
    assert.equal((await json(await fetch(`${baseUrl}/api/question/${questionId}/answers/${answerId}/upvote`, { method: 'PUT', headers: otherHeaders }))).status, 200);
    assert.equal((await json(await fetch(`${baseUrl}/api/question/${questionId}/follow`, { method: 'PUT', headers: otherHeaders }))).status, 200);
    assert.equal((await Question.findById(questionId)).answers.length, 1);

    const createdCollection = await json(await fetch(`${baseUrl}/api/collection`, {
      method: 'POST', headers: ownerHeaders,
      body: JSON.stringify({ title: `${prefix} created collection`, description: 'integration', publicationIds: [post._id.toString()], visibility: 'public' }),
    }));
    assert.equal(createdCollection.status, 201);
    const collectionId = createdCollection.body.data.collectionId;
    assert.equal((await json(await fetch(`${baseUrl}/api/collection/${collectionId}/save`, { method: 'PUT', headers: otherHeaders }))).status, 200);
    assert.equal((await json(await fetch(`${baseUrl}/api/collection/${collectionId}/follow`, { method: 'PUT', headers: otherHeaders }))).status, 200);
    assert.equal((await Collection.findById(collectionId)).savedCount, 1);

    assert.equal((await json(await fetch(`${baseUrl}/api/writer/${otherUser._id}/follow`, { method: 'PUT', headers: ownerHeaders }))).status, 200);
    assert.equal((await json(await fetch(`${baseUrl}/api/writer/${otherUser._id}/follow`, { method: 'DELETE', headers: ownerHeaders }))).status, 200);
    assert.equal((await json(await fetch(`${baseUrl}/api/post/${post._id}/comments`, {
      method: 'POST', headers: ownerHeaders, body: JSON.stringify({ text: 'Integration comment.' }),
    }))).status, 201);
    assert.equal((await json(await fetch(`${baseUrl}/api/post/${post._id}/reports`, {
      method: 'POST', headers: otherHeaders, body: JSON.stringify({ reason: 'spam', details: 'Integration report.' }),
    }))).status, 201);

    const eventId = crypto.randomUUID();
    assert.equal((await json(await fetch(`${baseUrl}/api/v1/events`, {
      method: 'POST', headers: otherHeaders,
      body: JSON.stringify({ events: [{ eventId, eventType: 'open', eventAt: new Date().toISOString(), publicationId: post._id.toString(), surface: 'story', position: 1 }] }),
    }))).status, 202);
    assert.equal(await InteractionEvent.countDocuments({ eventId }), 1);
    assert.equal((await json(await fetch(`${baseUrl}/api/v1/notifications/${notification._id}/read`, { method: 'PUT', headers: ownerHeaders }))).status, 200);
    assert.equal((await Notification.findById(notification._id)).readAt instanceof Date, true);
    assert.equal((await fetch(`${baseUrl}/api/v1/notifications/${notification._id}`, { method: 'DELETE', headers: otherHeaders })).status, 404);
    assert.equal((await Notification.findById(notification._id)) !== null, true);
    assert.equal((await fetch(`${baseUrl}/api/v1/notifications/${notification._id}`, { method: 'DELETE', headers: ownerHeaders })).status, 204);
    assert.equal(await Notification.findById(notification._id), null);

    const entry = await json(await fetch(`${baseUrl}/api/competition/${competition._id}/entries`, {
      method: 'POST', headers: ownerHeaders, body: JSON.stringify({ publicationId: post._id.toString(), note: 'Integration entry' }),
    }));
    assert.equal(entry.status, 201);
    const currentCompetition = await Competition.findById(competition._id);
    assert.equal(currentCompetition.entries.length, 1);
    const entryId = currentCompetition.entries[0]._id;
    assert.equal((await json(await fetch(`${baseUrl}/api/competition/${competition._id}/entries/${entryId}/vote`, { method: 'PUT', headers: otherHeaders }))).status, 200);
    assert.equal((await Competition.findById(competition._id)).entries[0].votesCount, 1);

    const newSeries = await json(await fetch(`${baseUrl}/api/short-series`, {
      method: 'POST', headers: ownerHeaders,
      body: JSON.stringify({ title: `${prefix} created series`, description: 'integration', publicationIds: [shortPost3._id.toString(), shortPost4._id.toString()] }),
    }));
    assert.equal(newSeries.status, 201);
    assert.equal((await json(await fetch(`${baseUrl}/api/short-series/${newSeries.body.data.seriesId}`, {
      method: 'PUT', headers: ownerHeaders,
      body: JSON.stringify({ title: `${prefix} updated series`, description: 'updated', publicationIds: [shortPost3._id.toString(), shortPost4._id.toString()] }),
    }))).status, 200);

    assert.equal((await json(await fetch(`${baseUrl}/api/v1/me/creator-support/${otherUser._id}`, {
      method: 'PUT', headers: ownerHeaders, body: JSON.stringify({ allocationPercent: 10 }),
    }))).status, 404);
    assert.equal((await json(await fetch(`${baseUrl}/api/v1/billing/checkout`, {
      method: 'POST', headers: ownerHeaders, body: JSON.stringify({}),
    }))).status, 409);
    assert.equal((await json(await fetch(`${baseUrl}/api/v1/writing-assistant`, {
      method: 'POST', headers: ownerHeaders, body: JSON.stringify({ action: 'tighten', text: 'Integration writing assistant input.' }),
    }))).status, 503);

    assert.equal((await json(await fetch(`${baseUrl}/api/staff/reports`, { headers: ownerHeaders }))).status, 200);
    const report = await Report.findOne({ reporterId: otherUser._id, subjectId: post._id });
    assert.ok(report);
    assert.equal((await json(await fetch(`${baseUrl}/api/staff/reports/${report._id}/reviews`, {
      method: 'POST', headers: ownerHeaders, body: JSON.stringify({ action: 'dismiss', note: 'Integration review' }),
    }))).status, 200);
    assert.equal(await ModerationAction.countDocuments({ reportId: report._id }), 1);

    assert.equal((await json(await fetch(`${baseUrl}/api/drafts/${draftId}`, { method: 'DELETE', headers: ownerHeaders }))).status, 204);
  });
  test('public tag suggestions exclude private and future metadata and deduplicate released tags', async () => {
    const marker = `${prefix}-tags`;
    const records = await Publication.create([
      { title: `${marker} released`, author: owner._id, body: validBody(marker), tags: [`${marker}-public`, `${marker}-public`], publicAt: new Date() },
      { title: `${marker} hidden`, author: owner._id, body: validBody(marker), tags: [`${marker}-private`], publicationStatus: 'unpublished' },
      { title: `${marker} future`, author: owner._id, body: validBody(marker), tags: [`${marker}-future`], publicAt: new Date(Date.now() + 86400000) },
    ]);
    const tagTopic = await Topic.create({ slug: `${marker}-topic`, displayName: `${marker} canonical`, status: 'active' });
    const draft = await Draft.create({ authorId: owner._id, body: validBody(marker), tags: [`${marker}-draft`] });
    try {
      const response = await fetch(`${baseUrl}/api/v1/tags?q=${marker}`);
      assert.equal(response.status, 200);
      const data = (await response.json()).data;
      assert.deepEqual(new Set(data.map(choice => choice.value)), new Set([`${marker}-public`, `${marker}-topic`]));
      assert.equal(data.length, 2);
      assert.equal((await fetch(`${baseUrl}/api/v1/tags?q=${'x'.repeat(61)}`)).status, 400);
    } finally {
      await Publication.deleteMany({ _id: { $in: records.map(record => record._id) } });
      await Topic.deleteOne({ _id: tagTopic._id });
      await Draft.deleteOne({ _id: draft._id });
    }
  });

}
