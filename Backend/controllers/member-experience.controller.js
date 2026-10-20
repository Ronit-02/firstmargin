const mongoose = require('mongoose');
const Profile = require('../schemas/profile.schema');
const Workshop = require('../schemas/workshop.schema');
const WorkshopAttendance = require('../schemas/workshop-attendance.schema');
const Notification = require('../schemas/notification.schema');
const { isSafeHttpUrl } = require('../utils/safe-url');
const CreatorUpdate = require('../schemas/creator-update.schema');
const CreatorRequest = require('../schemas/creator-request.schema');
const { hasCapability } = require('../services/entitlement.service');
const { notify } = require('../services/notification.service');

const requireCapability = async (res, userId, capability) => {
  if (await hasCapability(userId, capability)) return true;
  res.status(403).json({ code: 'ENTITLEMENT_REQUIRED', message: 'An active membership is required' });
  return false;
};

const listWorkshops = async (req, res) => {
  try {
    const workshops = await Workshop.find({ status: 'published', endsAt: { $gt: new Date() } })
      .select('-meetingUrl').sort({ startsAt: 1 }).populate('hostId', 'username picture').lean();
    const attendance = req.auth?.userId && workshops.length ? await WorkshopAttendance.find({
      userId: req.auth.userId,
      workshopId: { $in: workshops.map(workshop => workshop._id) },
      status: { $in: ['registered', 'attended'] },
    }).select('workshopId').lean() : [];
    const registeredIds = new Set(attendance.map(item => String(item.workshopId)));
    return res.json({ data: workshops.map(workshop => ({ ...workshop, isRegistered: registeredIds.has(String(workshop._id)) })) });
  } catch { return res.status(500).json({ message: 'Unable to load workshops' }); }
};

const listMyWorkshops = async (req, res) => {
  try {
    const workshops = await Workshop.find({ hostId: req.auth.userId }).select('-meetingUrl').sort({ startsAt: -1 }).limit(100);
    return res.json({ data: workshops });
  } catch { return res.status(500).json({ message: 'Unable to load your workshops' }); }
};

const createWorkshop = async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.auth.userId, writerStatus: 'writer' }).select('_id');
    if (!profile) return res.status(403).json({ message: 'Only writer profiles can host workshops' });
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const meetingUrl = String(req.body.meetingUrl || '').trim();
    const startsAt = new Date(req.body.startsAt);
    const endsAt = new Date(req.body.endsAt);
    const capacity = Number(req.body.capacity || 100);
    if (!title || title.length > 140 || !description || description.length > 3000 || !isSafeHttpUrl(meetingUrl)) return res.status(400).json({ message: 'Invalid workshop details' });
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt <= new Date() || endsAt <= startsAt || endsAt - startsAt > 8 * 60 * 60 * 1000) return res.status(400).json({ message: 'Workshop timing is invalid' });
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) return res.status(400).json({ message: 'Workshop capacity is invalid' });
    const workshop = await Workshop.create({ hostId: req.auth.userId, title, description, startsAt, endsAt, capacity, meetingUrl, status: 'published' });
    return res.status(201).json({ data: { id: workshop._id, title: workshop.title, startsAt: workshop.startsAt } });
  } catch { return res.status(500).json({ message: 'Unable to publish workshop' }); }
};

const registerWorkshop = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.workshopId)) return res.status(400).json({ message: 'Invalid workshop id' });
    if (!await requireCapability(res, req.auth.userId, 'workshops')) return;
    const workshop = await Workshop.findOne({ _id: req.params.workshopId, status: 'published', startsAt: { $gt: new Date() } });
    if (!workshop) return res.status(404).json({ message: 'Workshop not found' });
    const existing = await WorkshopAttendance.findOne({ workshopId: workshop._id, userId: req.auth.userId, status: 'registered' });
    const registered = await WorkshopAttendance.countDocuments({ workshopId: workshop._id, status: 'registered' });
    if (!existing && registered >= workshop.capacity) return res.status(409).json({ message: 'Workshop is full' });
    const attendance = await WorkshopAttendance.findOneAndUpdate(
      { workshopId: workshop._id, userId: req.auth.userId },
      { $set: { status: 'registered' } },
      { upsert: true, returnDocument: 'after' }
    );
    const notificationFilter = { recipientId: req.auth.userId, type: 'workshop_registered', entityType: 'workshop', entityId: workshop._id };
    if (!await Notification.exists(notificationFilter)) {
      const notification = await notify({ ...notificationFilter, title: 'Workshop place reserved', body: `Your place in ${workshop.title} is reserved. Open this notification to join the workshop.`, href: workshop.meetingUrl });
      if (!notification) return res.status(503).json({ message: 'Your place is reserved, but the joining notification could not be saved. Please retry.' });
    }
    return res.json({ data: { id: attendance._id, status: attendance.status, meetingUrl: workshop.meetingUrl } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'Registration already changed' });
    return res.status(500).json({ message: 'Unable to register for workshop' });
  }
};

const listCreatorUpdates = async (req, res) => {
  try {
    if (!await requireCapability(res, req.auth.userId, 'behind_scenes')) return;
    const filter = { status: 'published', publishedAt: { $lte: new Date() } };
    if (req.query.creatorId) {
      if (!mongoose.isValidObjectId(req.query.creatorId)) return res.status(400).json({ message: 'Invalid creator id' });
      filter.creatorId = req.query.creatorId;
    }
    const updates = await CreatorUpdate.find(filter).sort({ publishedAt: -1 }).limit(50).populate('creatorId', 'username picture');
    return res.json({ data: updates });
  } catch { return res.status(500).json({ message: 'Unable to load creator updates' }); }
};

const listMyCreatorUpdates = async (req, res) => {
  try {
    const updates = await CreatorUpdate.find({ creatorId: req.auth.userId }).sort({ publishedAt: -1, createdAt: -1 }).limit(100);
    return res.json({ data: updates });
  } catch { return res.status(500).json({ message: 'Unable to load your creator updates' }); }
};

const createCreatorUpdate = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const body = String(req.body.body || '').trim();
    const audience = req.body.audience || 'members';
    if (!title || title.length > 140 || !body || body.length > 10000 || audience !== 'members') return res.status(400).json({ message: 'Invalid creator update' });
    const update = await CreatorUpdate.create({ creatorId: req.auth.userId, title, body, audience, status: 'published', publishedAt: new Date() });
    return res.status(201).json({ data: update });
  } catch { return res.status(500).json({ message: 'Unable to publish creator update' }); }
};

const createCreatorRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.creatorId)) return res.status(400).json({ message: 'Invalid creator id' });
    if (req.params.creatorId === req.auth.userId) return res.status(400).json({ message: 'You cannot request yourself' });
    if (!await requireCapability(res, req.auth.userId, 'direct_creator_requests')) return;
    const profile = await Profile.findOne({ userId: req.params.creatorId, directRequestsEnabled: true }).select('_id');
    if (!profile) return res.status(409).json({ message: 'This creator is not accepting direct requests' });
    const subject = String(req.body.subject || '').trim();
    const details = String(req.body.details || '').trim();
    if (!subject || subject.length > 140 || !details || details.length > 2000) return res.status(400).json({ message: 'Subject and details are required' });
    const periodKey = new Date().toISOString().slice(0, 7);
    const used = await CreatorRequest.countDocuments({ requesterId: req.auth.userId, periodKey });
    if (used >= 3) return res.status(429).json({ message: 'Monthly direct request limit reached' });
    const request = await CreatorRequest.create({ requesterId: req.auth.userId, creatorId: req.params.creatorId, subject, details, periodKey });
    await notify({ recipientId: req.params.creatorId, actorId: req.auth.userId, type: 'direct_request_received', title: 'New direct request', body: subject, href: '/studio?writingTab=requests', entityType: 'creator_request', entityId: request._id });
    return res.status(201).json({ data: request, remainingThisMonth: 2 - used });
  } catch { return res.status(500).json({ message: 'Unable to send creator request' }); }
};

const listReceivedRequests = async (req, res) => {
  try {
    const requests = await CreatorRequest.find({ creatorId: req.auth.userId }).sort({ createdAt: -1 }).populate('requesterId', 'username picture');
    return res.json({ data: requests });
  } catch { return res.status(500).json({ message: 'Unable to load creator requests' }); }
};

const updateReceivedRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.requestId)) return res.status(400).json({ message: 'Invalid request id' });
    const status = req.body.status;
    const response = req.body.response == null ? null : String(req.body.response).trim();
    if (!['accepted', 'declined', 'answered'].includes(status) || (response && response.length > 2000)) return res.status(400).json({ message: 'Invalid request response' });
    const request = await CreatorRequest.findOneAndUpdate({ _id: req.params.requestId, creatorId: req.auth.userId }, { $set: { status, response } }, { returnDocument: 'after' });
    if (!request) return res.status(404).json({ message: 'Creator request not found' });
    await notify({ recipientId: request.requesterId, actorId: req.auth.userId, type: 'direct_request_updated', title: `Your creator request was ${status}`, body: request.subject, href: '/members', entityType: 'creator_request', entityId: request._id });
    return res.json({ data: request });
  } catch { return res.status(500).json({ message: 'Unable to update creator request' }); }
};

module.exports = { listWorkshops, listMyWorkshops, createWorkshop, registerWorkshop, listCreatorUpdates, listMyCreatorUpdates, createCreatorUpdate, createCreatorRequest, listReceivedRequests, updateReceivedRequest };
