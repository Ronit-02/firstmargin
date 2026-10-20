const mongoose = require('mongoose');
const Report = require('../schemas/report.schema');
const ModerationAction = require('../schemas/moderation-action.schema');

const listReports = async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    if (!['all', 'pending', 'reviewing', 'actioned', 'dismissed'].includes(status)) return res.status(400).json({ message: 'Invalid report status' });
    const reports = await Report.find(status === 'all' ? {} : { status }).sort({ createdAt: 1 }).limit(100).populate('reporterId', 'username');
    return res.json({ data: reports });
  } catch { return res.status(500).json({ message: 'Unable to load moderation queue' }); }
};

const recordReview = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.reportId)) return res.status(400).json({ message: 'Invalid report id' });
    const action = req.body.action;
    const note = String(req.body.note || '').trim();
    if (!['begin_review', 'dismiss', 'recommend_remove', 'recommend_suspend'].includes(action) || !note || note.length > 2000) return res.status(400).json({ message: 'A valid review action and note are required' });
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (['actioned', 'dismissed'].includes(report.status)) return res.status(409).json({ message: 'This report is already resolved' });
    await ModerationAction.create({ reportId: report._id, moderatorId: req.auth.userId, action, note });
    report.status = action === 'dismiss' ? 'dismissed' : 'reviewing';
    await report.save();
    return res.json({ data: { id: report._id, status: report.status, recommendation: action.startsWith('recommend_') ? action : null } });
  } catch { return res.status(500).json({ message: 'Unable to record moderation review' }); }
};

module.exports = { listReports, recordReview };
