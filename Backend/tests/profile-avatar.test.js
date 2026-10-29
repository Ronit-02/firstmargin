const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

process.env.FRONTEND_URL ||= 'http://localhost:3000';
process.env.JWT_SECRET ||= 'profile-avatar-test-secret-with-32-bytes';
process.env.CLOUDINARY_CLOUD_NAME = 'profile-avatar-test';
process.env.CLOUDINARY_API_KEY ||= 'test';
process.env.CLOUDINARY_API_SECRET ||= 'test';

const { v2: cloudinary } = require('cloudinary');
const User = require('../schemas/user.schema');
const Profile = require('../schemas/profile.schema');
const { profileAvatarPublicIdFromUrl } = require('../utils/cloudinary');
const { updateProfileAvatar } = require('../controllers/user.controller');

const userId = '507f1f77bcf86cd799439011';
const publicId = `profile-avatars/${userId}/new-avatar`;
const avatarUrl = `https://res.cloudinary.com/profile-avatar-test/image/upload/v123/${publicId}.png`;

test('only this account’s managed Cloudinary avatar is eligible for deletion', () => {
  assert.equal(profileAvatarPublicIdFromUrl(avatarUrl, userId), publicId);
  assert.equal(profileAvatarPublicIdFromUrl(avatarUrl, '507f191e810c19729de860ea'), null);
  assert.equal(profileAvatarPublicIdFromUrl(avatarUrl.replace('profile-avatar-test', 'another-cloud'), userId), null);
  assert.equal(profileAvatarPublicIdFromUrl('https://accounts.google.com/photo.jpg', userId), null);
  assert.equal(profileAvatarPublicIdFromUrl(`https://res.cloudinary.com/profile-avatar-test/image/upload/v123/shared/${userId}/old.png`, userId), null);
});

test('avatar upload saves both identity records, deletes only the prior managed image, and removes the temporary file', async t => {
  const previousPublicId = `profile-avatars/${userId}/previous-avatar`;
  const user = { _id: userId, username: 'Writer', picture: 'https://example.com/provider.png', save: async () => {} };
  const profile = { avatarUrl: `https://res.cloudinary.com/profile-avatar-test/image/upload/v122/${previousPublicId}.png`, save: async () => {} };
  const deleted = [];
  t.mock.method(User, 'findById', async () => user);
  t.mock.method(Profile, 'findOne', async () => profile);
  t.mock.method(cloudinary.uploader, 'upload', async () => ({ secure_url: avatarUrl, public_id: publicId }));
  t.mock.method(cloudinary.uploader, 'destroy', async (id, options) => { deleted.push({ id, options }); return { result: 'ok' }; });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'profile-avatar-test-'));
  const filePath = path.join(directory, 'avatar.png');
  await fs.writeFile(filePath, 'test');
  t.after(async () => { await fs.rm(directory, { recursive: true, force: true }); });
  let status;
  let body;
  await updateProfileAvatar({ auth: { userId }, body: {}, file: { path: filePath }, requestId: 'avatar-test' }, {
    status(code) { status = code; return this; },
    json(value) { body = value; return this; },
  });
  assert.equal(status, 200);
  assert.equal(body.profile.avatarUrl, avatarUrl);
  assert.equal(user.picture, avatarUrl);
  assert.equal(profile.avatarUrl, avatarUrl);
  assert.deepEqual(deleted, [{ id: previousPublicId, options: { resource_type: 'image', invalidate: true } }]);
  await assert.rejects(fs.access(filePath), { code: 'ENOENT' });
});

test('replacing a provider image never deletes it', async t => {
  const user = { _id: userId, username: 'Writer', picture: 'https://accounts.google.com/photo.jpg', save: async () => {} };
  const profile = { avatarUrl: user.picture, save: async () => {} };
  const deleted = [];
  t.mock.method(User, 'findById', async () => user);
  t.mock.method(Profile, 'findOne', async () => profile);
  t.mock.method(cloudinary.uploader, 'upload', async () => ({ secure_url: avatarUrl, public_id: publicId }));
  t.mock.method(cloudinary.uploader, 'destroy', async id => { deleted.push(id); return { result: 'ok' }; });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'profile-avatar-test-'));
  const filePath = path.join(directory, 'avatar.png');
  await fs.writeFile(filePath, 'test');
  t.after(async () => { await fs.rm(directory, { recursive: true, force: true }); });
  let status;
  await updateProfileAvatar({ auth: { userId }, body: {}, file: { path: filePath }, requestId: 'avatar-test' }, {
    status(code) { status = code; return this; }, json() { return this; },
  });
  assert.equal(status, 200);
  assert.deepEqual(deleted, []);
});

test('a failed profile save restores the old picture and deletes the new upload', async t => {
  const previousPicture = 'https://accounts.google.com/photo.jpg';
  const user = { _id: userId, username: 'Writer', picture: previousPicture, save: async () => {} };
  const profile = { avatarUrl: previousPicture, save: async () => { throw new Error('Database unavailable'); } };
  const deleted = [];
  t.mock.method(User, 'findById', async () => user);
  t.mock.method(Profile, 'findOne', async () => profile);
  t.mock.method(cloudinary.uploader, 'upload', async () => ({ secure_url: avatarUrl, public_id: publicId }));
  t.mock.method(cloudinary.uploader, 'destroy', async id => { deleted.push(id); return { result: 'ok' }; });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'profile-avatar-test-'));
  const filePath = path.join(directory, 'avatar.png');
  await fs.writeFile(filePath, 'test');
  t.after(async () => { await fs.rm(directory, { recursive: true, force: true }); });
  let status;
  await updateProfileAvatar({ auth: { userId }, body: {}, file: { path: filePath }, requestId: 'avatar-test' }, {
    status(code) { status = code; return this; }, json() { return this; },
  });
  assert.equal(status, 500);
  assert.equal(user.picture, previousPicture);
  assert.deepEqual(deleted, [publicId]);
  await assert.rejects(fs.access(filePath), { code: 'ENOENT' });
});
