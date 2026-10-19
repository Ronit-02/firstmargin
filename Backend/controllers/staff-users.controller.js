const mongoose = require('mongoose');
const User = require('../schemas/user.schema');
const RoleChange = require('../schemas/role-change.schema');

const roles = ['regular', 'premium', 'exclusive-writer', 'moderator', 'admin'];
const roleChanges = {
  regular: ['exclusive-writer', 'moderator'],
  premium: ['exclusive-writer', 'moderator'],
  'exclusive-writer': ['regular', 'moderator'],
  moderator: ['exclusive-writer', 'regular'],
};
const pageSize = 25;

const listUsers = async (req, res) => {
  const role = req.query.role || 'all';
  const page = req.query.page == null ? 1 : Number(req.query.page);
  if (role !== 'all' && !roles.includes(role)) return res.status(400).json({ message: 'Invalid role filter' });
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return res.status(400).json({ message: 'Invalid page' });
  try {
    const filter = role === 'all' ? {} : { role };
    const [users, total] = await Promise.all([
      User.find(filter).select('username email picture role accountStatus createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      User.countDocuments(filter),
    ]);
    return res.json({ data: users.map(user => ({ id: String(user._id), username: user.username, email: user.email, picture: user.picture, role: user.role, accountStatus: user.accountStatus || 'active', createdAt: user.createdAt })), meta: { page, pageSize, total, hasMore: page * pageSize < total } });
  } catch {
    return res.status(500).json({ message: 'Unable to load users' });
  }
};

const changeUserRole = async (req, res) => {
  const userId = req.params.userId;
  const role = req.body?.role;
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: 'Invalid user id' });
  if (!['regular', 'exclusive-writer', 'moderator'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  if (String(req.auth.userId) === userId) return res.status(403).json({ message: 'You cannot change your own role' });
  try {
    const target = await User.findById(userId).select('role accountStatus');
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.accountStatus === 'suspended') return res.status(409).json({ message: 'Suspended users cannot change roles' });
    if (!roleChanges[target.role]?.includes(role)) return res.status(409).json({ message: 'This role change is not allowed' });

    const session = await mongoose.startSession();
    try {
      let updated;
      await session.withTransaction(async () => {
        updated = await User.findOneAndUpdate(
          { _id: userId, role: target.role, accountStatus: { $ne: 'suspended' } },
          { $set: { role } },
          { new: true, session, projection: 'username email role' },
        );
        if (!updated) throw Object.assign(new Error('Role changed concurrently'), { status: 409 });
        await RoleChange.create([{ userId, actorId: req.auth.userId, fromRole: target.role, toRole: role }], { session });
      });
      return res.json({ data: { id: String(updated._id), role: updated.role } });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ message: 'This user changed; reload and try again' });
    return res.status(500).json({ message: 'Unable to change user role' });
  }
};

module.exports = { listUsers, changeUserRole, roles, roleChanges };
