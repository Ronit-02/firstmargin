const mongoose = require('mongoose');
const fs = require('fs');
const Competition = require('../schemas/competition.schema');
const Profile = require('../schemas/profile.schema');
const Publication = require('../schemas/publication.schema');
const CompetitionAudit = require('../schemas/competition-audit.schema');
const CompetitionAppeal = require('../schemas/competition-appeal.schema');
const User = require('../schemas/user.schema');
const { getVoteRisk, getVoteSignals, recordVoteSignal, removeVoteSignal } = require('../services/competition-fraud.service');
const { notify } = require('../services/notification.service');
const { publicPostClause } = require('../services/publication-access.service');
const { rankCompetitionEntries } = require('../services/competition-scoring.service');
const { isNewMode, processCompetition, processDueCompetitions } = require('../services/competition-lifecycle.service');
const { uploadOnCloudinary } = require('../utils/cloudinary');

const { presentDiscoveryPosts } = require('../services/publication-presenter.service');

const isValidId = id => mongoose.isValidObjectId(id);
const staffEntryRestriction = 'Moderators and admins cannot enter competitions.';
const isCompetitionStaff = role => ['moderator', 'admin'].includes(role);
const effectiveStatus = (competition, now = new Date()) => {
  if (competition.status === 'closed') return 'closed';
  if (competition.openDate > now) return 'draft';
  if (competition.closeDate > now) return 'open';
  if (competition.competitionType === 'reader_choice') return 'closed';
  if (competition.competitionType === 'collective_choice') return 'judging';
  if (competition.resultsDate && competition.resultsDate <= now) return 'closed';
  return 'judging';
};
const isVotingOpen = (competition, now = new Date()) => {
  const status = effectiveStatus(competition, now);
  if (isNewMode(competition)) return status === 'open';
  return ['open', 'judging'].includes(status) && (!competition.resultsDate || competition.resultsDate > now);
};
const competitionStatusCandidates = status => ({
  draft: ['open'],
  open: ['open'],
  judging: ['open', 'judging'],
  closed: ['judging', 'closed'],
}[status] || []);
const canScoreEntry = (competition, entry, now = new Date()) => {
  const status = effectiveStatus(competition, now);
  if (status === 'closed') return { allowed: false, reason: 'COMPETITION_CLOSED' };
  if (entry.status === 'disqualified') return { allowed: false, reason: 'ENTRY_DISQUALIFIED' };
  if (status !== 'judging') return { allowed: false, reason: 'COMPETITION_NOT_JUDGING' };
  return { allowed: true, reason: null };
};
const canPublishResults = (competition, now = new Date()) => effectiveStatus(competition, now) === 'judging';
const canVoteEntry = (competition, entry, actorId, now = new Date()) => {
  if (!isVotingOpen(competition, now)) return { allowed: false, reason: 'VOTING_CLOSED' };
  if (competition.votingMode === 'judges') return { allowed: false, reason: 'VOTING_CLOSED' };
  if (entry.status === 'disqualified') return { allowed: false, reason: 'ENTRY_DISQUALIFIED' };
  if (entry.author?.toString() === actorId) return { allowed: false, reason: 'SELF_VOTE' };
  if ((entry.votes || []).some(id => id.toString() === actorId)) return { allowed: false, reason: 'ALREADY_VOTED' };
  return { allowed: true, reason: null };
};
const estimateReadTime = body => {
  try {
    const blocks = JSON.parse(body);
    const words = Array.isArray(blocks)
      ? blocks.reduce((count, block) => count + String(block?.content || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length, 0)
      : 0;
    return `${Math.max(1, Math.ceil(words / 200))} min read`;
  } catch {
    return '1 min read';
  }
};
const extractFirstImage = body => {
  try {
    const blocks = JSON.parse(body);
    if (!Array.isArray(blocks)) return null;
    const image = blocks.find(block => block?.type === 'image' && typeof block.content === 'string');
    if (!image) return null;
    const url = new URL(image.content);
    return ['http:', 'https:'].includes(url.protocol) ? image.content : null;
  } catch {
    return null;
  }
};

const presentCompetition = (competition, actorId, includeEntries = false) => {
  const status = effectiveStatus(competition);
  const data = {
    id: competition._id,
    title: competition.title,
    description: competition.description,
    coverImage: competition.coverImage,
    status,
    openDate: competition.openDate,
    closeDate: competition.closeDate,
    resultsDate: competition.resultsDate,
    judgeRoster: competition.judgeRoster || [],
    noWinnerReason: competition.noWinnerReason || null,
    votingMode: competition.votingMode,
    competitionType: competition.competitionType,
    rules: competition.rules,
    prizes: competition.prizes,
    entriesCount: competition.entries.length,
    isEntered: actorId ? competition.entries.some(entry => entry.author?._id?.toString() === actorId || entry.author?.toString() === actorId) : false,
  };
  if (includeEntries) {
    const ranking = status === 'closed' || !isNewMode(competition) ? rankCompetitionEntries(competition.entries, competition.votingMode) : [];
    const rankingById = new Map(ranking.map(item => [item.id, item]));
    data.entries = competition.entries.map(entry => {
      const ranked = rankingById.get(entry._id.toString());
      return ({
      id: entry._id,
      isOwner: Boolean(actorId && String(entry.author?._id || entry.author) === actorId),
      note: entry.note,
      votesCount: entry.votesCount || entry.votes?.length || 0,
      score: ranked?.score ?? null,
      rank: ranked?.rank ?? null,
      judgeScore: ranked?.judgeScore ?? 0,
      judgeScores: entry.judgeScores?.map(score => ({ judgeId: score.judgeId, submittedBy: score.submittedBy || score.judgeId, craft: score.craft, originality: score.originality, relevance: score.relevance, note: score.note || '' })) || [],
      status: entry.status,
      disqualificationReason: entry.disqualificationReason || null,
      isVoted: actorId ? entry.votes.some(id => id.toString() === actorId) : false,
      isWinner: competition.winnerEntryIds.some(id => id.toString() === entry._id.toString()),
      author: entry.author,
      publication: entry.publication ? {
        _id: entry.publication._id,
        title: entry.publication.title,
        format: entry.publication.format || 'story',
        coverImage: entry.publication.coverImage || extractFirstImage(entry.publication.body),
        createdAt: entry.publication.createdAt,
        readTime: estimateReadTime(entry.publication.body),
        appreciationsCount: entry.publication.appreciationsCount || 0,
        commentsCount: entry.publication.commentsCount || 0,
      } : null,
      createdAt: entry.createdAt,
      });
    }).sort((left, right) => (left.rank === null) - (right.rank === null) || (left.rank || 0) - (right.rank || 0));
  }
  return data;
};

const getCompetitions = async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    if (status && !['draft', 'open', 'judging', 'closed'].includes(status)) return res.status(400).json({ message: 'Invalid competition status' });
    await processDueCompetitions();
    const competitions = await Competition.find(status ? { status: { $in: competitionStatusCandidates(status) } } : {})
      .sort({ closeDate: -1 })
      .limit(50);
    const filtered = status ? competitions.filter(item => effectiveStatus(item) === status) : competitions;
    return res.status(200).json({ data: filtered.map(item => presentCompetition(item, req.auth?.userId)) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load competitions' });
  }
};

const getCompetitionById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid competition id' });
    const current = await Competition.findById(req.params.id);
    if (current) await processCompetition(current);
    const competition = await Competition.findById(req.params.id)
      .populate({ path: 'entries.author', select: 'picture username' })
      .populate({ path: 'entries.publication', match: publicPostClause(), select: 'title format coverImage createdAt body appreciationsCount commentsCount' });
    if (!competition) return res.status(404).json({ message: 'Competition not found' });
    const data = presentCompetition(competition, req.auth?.userId, true);
    data.entryRestriction = isCompetitionStaff(req.auth?.role) ? staffEntryRestriction : null;
    if (competition.entries.some(entry => entry.judgeScores.length) || competition.judgeRoster?.length) {
      const ids = [...new Set([...(competition.judgeRoster || []).map(String), ...competition.entries.flatMap(entry => entry.judgeScores.flatMap(score => [String(score.judgeId), String(score.submittedBy || score.judgeId)]))])];
      const judges = ids.length ? await User.find({ _id: { $in: ids } }).select('username').lean() : [];
      const names = new Map(judges.map(user => [String(user._id), user.username]));
      data.judgeRoster = (competition.judgeRoster || []).map(id => ({ id, username: names.get(String(id)) || 'Moderator' }));
      data.entries = data.entries.map(entry => ({ ...entry, judgeScores: entry.judgeScores.map(score => ({ ...score, moderatorName: names.get(String(score.judgeId)) || 'Moderator', submittedByName: names.get(String(score.submittedBy)) || 'Staff member' })) }));
    }
    if (data.status !== 'closed' && !['moderator', 'admin'].includes(req.auth?.role)) data.entries = data.entries.map(entry => ({ ...entry, judgeScores: [] }));
    const postEntries = competition.entries.filter(entry => entry.publication);
    const summaries = postEntries.length ? await presentDiscoveryPosts(postEntries.map(entry => ({ ...entry.publication.toObject(), author: entry.author })), req.auth?.userId) : [];
    const summariesById = new Map(summaries.map(post => [post.id.toString(), post]));
    const authorIds = [...new Set(data.entries.map(entry => entry.author?._id?.toString()).filter(Boolean))];
    const profiles = authorIds.length ? await Profile.find({ userId: { $in: authorIds } }).select('userId handle').lean() : [];
    const handlesByAuthor = new Map(profiles.map(profile => [profile.userId.toString(), profile.handle]));
    data.entries = data.entries.map(entry => ({
      ...entry,
      publication: entry.publication ? { ...entry.publication, ...summariesById.get(entry.publication._id.toString()), coverImage: entry.publication.coverImage } : null,
      author: entry.author ? { ...entry.author.toObject(), handle: handlesByAuthor.get(entry.author._id.toString()) || null } : null,
    }));
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load competition' });
  }
};

const getEligiblePosts = async (req, res) => {
  if (isCompetitionStaff(req.auth?.role)) return res.status(403).json({ message: staffEntryRestriction });
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid competition id' });
  const competition = await Competition.findById(req.params.id).select('entries status openDate closeDate');
  if (!competition) return res.status(404).json({ message: 'Competition not found' });
  if (effectiveStatus(competition) !== 'open') return res.status(400).json({ message: 'Competition is not open' });
  const enteredPostIds = competition.entries.map(entry => entry.publication);
  const posts = await Publication.find({ author: req.auth.userId, format: { $ne: 'short' }, _id: { $nin: enteredPostIds }, ...publicPostClause() })
    .sort({ createdAt: -1 }).select('title coverImage createdAt');
  return res.status(200).json({ data: posts.map(post => ({ id: post._id, title: post.title, image: post.coverImage, createdAt: post.createdAt })) });
};

const enterCompetition = async (req, res) => {
  try {
    if (isCompetitionStaff(req.auth?.role)) return res.status(403).json({ message: staffEntryRestriction });
    const publicationId = req.body?.publicationId;
    const note = String(req.body?.note || '').trim();
    if (!isValidId(req.params.id) || !isValidId(publicationId) || note.length > 500) return res.status(400).json({ message: 'Invalid competition entry' });
    const post = await Publication.findOne({ _id: publicationId, author: req.auth.userId, format: { $ne: 'short' }, ...publicPostClause() }).select('_id currentRevision');
    if (!post) return res.status(403).json({ message: 'You can only enter your own published stories' });
    const now = new Date();
    const competition = await Competition.findOneAndUpdate(
      {
        _id: req.params.id, status: 'open', openDate: { $lte: now }, closeDate: { $gt: now },
        'entries.author': { $ne: req.auth.userId },
        $expr: { $lt: [{ $size: '$entries' }, '$maxEntries'] },
      },
      { $push: { entries: { author: req.auth.userId, publication: post._id, publicationRevision: post.currentRevision || 1, note, votes: [], votesCount: 0 } } },
      { returnDocument: 'after' }
    );
    if (competition) return res.status(201).json({ data: { entered: true } });
    const existing = await Competition.findById(req.params.id).select('status openDate closeDate entries.author');
    if (!existing) return res.status(404).json({ message: 'Competition not found' });
    if (existing.entries.some(entry => entry.author.toString() === req.auth.userId)) return res.status(409).json({ message: 'You already entered this competition' });
    return res.status(400).json({ message: 'Competition is not accepting entries' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to submit entry' });
  }
};

const removeEntry = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.entryId)) return res.status(400).json({ message: 'Invalid competition or entry id' });
    const competition = await Competition.findById(req.params.id);
    if (!competition) return res.status(404).json({ message: 'Competition not found' });
    const entry = competition.entries.id(req.params.entryId);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    if (String(entry.author) !== req.auth.userId) return res.status(403).json({ message: 'You can only remove your own entry' });
    if (competition.status !== 'open' || effectiveStatus(competition) !== 'open') return res.status(409).json({ message: 'Entries can only be removed while the competition is open' });
    // Recheck the deadline and owner in the write so stale pages cannot remove a closed entry.
    const previous = await Competition.findOneAndUpdate({
      _id: req.params.id, status: 'open',
      $expr: { $and: [{ $lte: ['$openDate', '$$NOW'] }, { $gt: ['$closeDate', '$$NOW'] }] },
      entries: { $elemMatch: { _id: req.params.entryId, author: req.auth.userId } },
    }, { $pull: { entries: { _id: req.params.entryId, author: req.auth.userId } } }, { returnDocument: 'before' });
    if (!previous) return res.status(409).json({ message: 'The competition is no longer open or this entry has already been removed' });
    const removed = previous.entries.id(req.params.entryId);
    await CompetitionAudit.create({ competitionId: competition._id, actorId: req.auth.userId, action: 'entry_removed', details: { entryId: entry._id, votesCount: removed.votesCount || removed.votes?.length || 0 } });
    return res.status(200).json({ data: { removed: true } });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to remove entry' });
  }
};

const voteEntry = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.entryId)) return res.status(400).json({ message: 'Invalid competition or entry id' });
    const now = new Date();
    const current = await Competition.findById(req.params.id);
    if (!current) return res.status(404).json({ message: 'Competition not found' });
    if (isNewMode(current)) {
      const selected = current.entries.id(req.params.entryId);
      if (!selected) return res.status(404).json({ message: 'Entry not found' });
      if (!isVotingOpen(current, now)) return res.status(409).json({ message: 'Voting is closed' });
      if (selected.status === 'disqualified') return res.status(409).json({ message: 'This entry is not eligible for voting' });
      if (String(selected.author) === req.auth.userId) return res.status(403).json({ message: 'You cannot vote for your own entry' });
      const previous = current.entries.find(entry => entry.votes.some(id => String(id) === req.auth.userId));
      if (String(previous?._id) === req.params.entryId) return res.json({ data: { isVoted: true, votesCount: selected.votesCount } });
      const signals = getVoteSignals(req);
      if (!previous) {
        const risk = await getVoteRisk({ competitionId: req.params.id, ipHash: signals.ipHash, userAgentHash: signals.userAgentHash, now });
        if (risk.blocked) return res.status(429).json({ error: { code: 'COMPETITION_VOTE_REVIEW', message: 'Voting activity from this network needs review before more votes can be recorded.' } });
      }
      const voterId = new mongoose.Types.ObjectId(req.auth.userId);
      const targetId = new mongoose.Types.ObjectId(req.params.entryId);
      const updated = await Competition.findOneAndUpdate(
        { _id: current._id, status: 'open', $expr: { $and: [{ $lte: ['$openDate', '$$NOW'] }, { $gt: ['$closeDate', '$$NOW'] }] }, competitionType: { $in: ['reader_choice', 'collective_choice'] }, entries: { $elemMatch: { _id: targetId, status: 'submitted', author: { $ne: voterId } } } },
        [{ $set: { entries: { $map: { input: '$entries', as: 'entry', in: { $mergeObjects: ['$$entry', { votes: { $cond: [{ $eq: ['$$entry._id', targetId] }, { $setUnion: [{ $setDifference: ['$$entry.votes', [voterId]] }, [voterId]] }, { $setDifference: ['$$entry.votes', [voterId]] }] }, votesCount: { $cond: [{ $eq: ['$$entry._id', targetId] }, { $size: { $setUnion: [{ $setDifference: ['$$entry.votes', [voterId]] }, [voterId]] } }, { $size: { $setDifference: ['$$entry.votes', [voterId]] } }] } }] } } } } }],
        { returnDocument: 'after' },
      );
      if (!updated) return res.status(409).json({ message: 'Voting is closed or this entry is unavailable' });
      if (previous && String(previous._id) !== req.params.entryId) await removeVoteSignal({ competitionId: current._id, entryId: previous._id, voterId });
      await recordVoteSignal({ competitionId: current._id, entryId: targetId, voterId, ...signals });
      return res.json({ data: { isVoted: true, votesCount: updated.entries.id(targetId).votesCount } });
    }
    const signals = getVoteSignals(req);
    const alreadyVoted = await Competition.exists({ _id: req.params.id, entries: { $elemMatch: { _id: req.params.entryId, votes: req.auth.userId } } });
    if (!alreadyVoted) {
      const risk = await getVoteRisk({ competitionId: req.params.id, ipHash: signals.ipHash, userAgentHash: signals.userAgentHash, now });
      if (risk.blocked) {
        await CompetitionAudit.create({ competitionId: req.params.id, actorId: req.auth.userId, action: 'vote_blocked', details: { entryId: req.params.entryId, reason: risk.reason, count: risk.count, deviceCount: risk.deviceCount, windowMs: risk.windowMs } });
        return res.status(429).json({ error: { code: 'COMPETITION_VOTE_REVIEW', message: 'Voting activity from this network needs review before more votes can be recorded.' } });
      }
    }
    const updated = await Competition.findOneAndUpdate(
      {
        _id: req.params.id, status: { $in: ['open', 'judging'] }, votingMode: { $in: ['readers', 'hybrid'] },
        $or: [{ resultsDate: null }, { resultsDate: { $gt: now } }],
      entries: { $elemMatch: { _id: req.params.entryId, status: 'submitted', author: { $ne: req.auth.userId }, votes: { $ne: req.auth.userId } } },
      },
      { $addToSet: { 'entries.$[entry].votes': req.auth.userId }, $inc: { 'entries.$[entry].votesCount': 1 } },
      { returnDocument: 'after', arrayFilters: [{ 'entry._id': req.params.entryId }] }
    );
    if (!updated) {
      const existing = await Competition.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Competition not found' });
      const entry = existing.entries.id(req.params.entryId);
      if (!entry) return res.status(404).json({ message: 'Entry not found' });
      const votePolicy = canVoteEntry(existing, entry, req.auth.userId, now);
      if (votePolicy.reason === 'SELF_VOTE') return res.status(403).json({ message: 'You cannot vote for your own entry' });
      if (votePolicy.reason === 'ENTRY_DISQUALIFIED') return res.status(409).json({ message: 'This entry is not eligible for voting' });
      if (votePolicy.reason === 'VOTING_CLOSED') return res.status(409).json({ message: 'Voting is closed' });
      if (votePolicy.reason === 'ALREADY_VOTED') return res.status(200).json({ data: { isVoted: true, votesCount: entry.votesCount || entry.votes.length } });
      return res.status(409).json({ message: 'Vote could not be recorded' });
    }
    const entry = updated.entries.id(req.params.entryId);
    await recordVoteSignal({ competitionId: updated._id, entryId: entry._id, voterId: req.auth.userId, ...signals });
    return res.status(200).json({ data: { isVoted: true, votesCount: entry.votesCount } });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to vote for entry' });
  }
};

const removeEntryVote = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.entryId)) return res.status(400).json({ message: 'Invalid competition or entry id' });
    const now = new Date();
    const existing = await Competition.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Competition not found' });
    if (isNewMode(existing)) {
      const entry = existing.entries.id(req.params.entryId);
      if (!entry) return res.status(404).json({ message: 'Entry not found' });
      if (!isVotingOpen(existing, now)) return res.status(409).json({ message: 'Voting is closed' });
      const voterId = new mongoose.Types.ObjectId(req.auth.userId);
      const targetId = new mongoose.Types.ObjectId(req.params.entryId);
      const updated = await Competition.findOneAndUpdate(
        { _id: existing._id, status: 'open', $expr: { $and: [{ $lte: ['$openDate', '$$NOW'] }, { $gt: ['$closeDate', '$$NOW'] }] }, 'entries._id': targetId },
        [{ $set: { entries: { $map: { input: '$entries', as: 'entry', in: { $cond: [{ $eq: ['$$entry._id', targetId] }, { $mergeObjects: ['$$entry', { votes: { $setDifference: ['$$entry.votes', [voterId]] }, votesCount: { $size: { $setDifference: ['$$entry.votes', [voterId]] } } }] }, '$$entry'] } } } } }],
        { returnDocument: 'after' },
      );
      if (!updated) return res.status(409).json({ message: 'Voting is closed' });
      await removeVoteSignal({ competitionId: existing._id, entryId: targetId, voterId });
      return res.json({ data: { isVoted: false, votesCount: updated.entries.id(targetId).votesCount } });
    }
    const existingEntry = existing.entries.id(req.params.entryId);
    if (!existingEntry) return res.status(404).json({ message: 'Entry not found' });
    if (existingEntry.status === 'disqualified') return res.status(409).json({ message: 'This entry is not eligible for voting' });
    if (!isVotingOpen(existing, now)) return res.status(409).json({ message: 'Voting is closed' });
    const updated = await Competition.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['open', 'judging'] }, votingMode: { $in: ['readers', 'hybrid'] }, $or: [{ resultsDate: null }, { resultsDate: { $gt: now } }], entries: { $elemMatch: { _id: req.params.entryId, votes: req.auth.userId, votesCount: { $gt: 0 } } } },
      { $pull: { 'entries.$[entry].votes': req.auth.userId }, $inc: { 'entries.$[entry].votesCount': -1 } },
      { returnDocument: 'after', arrayFilters: [{ 'entry._id': req.params.entryId }] }
    );
    if (!updated) {
      return res.status(200).json({ data: { isVoted: false, votesCount: existingEntry.votesCount || existingEntry.votes.length } });
    }
    const entry = updated.entries.id(req.params.entryId);
    await removeVoteSignal({ competitionId: updated._id, entryId: entry._id, voterId: req.auth.userId });
    return res.status(200).json({ data: { isVoted: false, votesCount: entry.votesCount } });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to remove entry vote' });
  }
};

const parseRules = value => {
  const rules = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(rules) || rules.length > 20 || rules.some(rule => typeof rule !== 'string' || rule.trim().length > 500)) return null;
  return rules.map(rule => rule.trim()).filter(Boolean);
};
const parseCoverUrl = value => {
  const cover = String(value || '').trim();
  if (!cover) return '';
  const url = new URL(cover);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.toString().length > 2000) throw new Error('Invalid cover URL');
  return url.toString();
};
const uploadCover = async file => {
  if (!file) return null;
  const result = await uploadOnCloudinary(file.path);
  return result?.secure_url || null;
};

const createCompetition = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    let coverImage;
    try { coverImage = parseCoverUrl(req.body.coverImage); } catch { return res.status(400).json({ message: 'Cover image must be a valid HTTP(S) URL' }); }
    const openDate = new Date(req.body.openDate);
    const closeDate = new Date(req.body.closeDate);
    const competitionType = req.body.competitionType;
    const votingMode = competitionType === 'collective_choice' ? 'hybrid' : 'readers';
    let rules;
    try { rules = parseRules(req.body.rules || []); } catch { rules = null; }
    if (!title || title.length > 180 || description.length > 5000 || !rules || Number.isNaN(openDate.getTime()) || Number.isNaN(closeDate.getTime()) || closeDate <= openDate) return res.status(400).json({ message: 'Invalid competition details' });
    if (!['reader_choice', 'collective_choice'].includes(competitionType) || req.body.votingMode || req.body.resultsDate) return res.status(400).json({ message: 'Invalid competition type' });
    const uploadedCover = await uploadCover(req.file);
    const coverUploadFailed = Boolean(req.file && !uploadedCover);
    const competition = await Competition.create({ title, description, coverImage: coverUploadFailed ? '' : uploadedCover || coverImage, openDate, closeDate, votingMode, competitionType, rules, status: 'open', createdBy: req.auth.userId });
    await CompetitionAudit.create({ competitionId: competition._id, actorId: req.auth.userId, action: 'created', details: { votingMode, competitionType } });
    return res.status(201).json({ data: { ...presentCompetition(competition, req.auth.userId), coverUploadFailed } });
  } catch { return res.status(500).json({ message: 'Unable to create competition' }); }
  finally { if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {}); }
};

const updateCompetition = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid competition id' });
    const allowed = ['title', 'description', 'rules', 'coverImage'];
    if (Object.keys(req.body).some(key => !allowed.includes(key))) return res.status(400).json({ message: 'Only title, description, rules, and cover can be edited' });
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    let rules;
    try { rules = parseRules(req.body.rules); } catch { rules = null; }
    let coverImage;
    try { coverImage = parseCoverUrl(req.body.coverImage); } catch { return res.status(400).json({ message: 'Cover image must be a valid HTTP(S) URL' }); }
    if (!title || title.length > 180 || description.length > 5000 || !rules) return res.status(400).json({ message: 'Invalid competition details' });
    const current = await Competition.findById(req.params.id);
    if (!current) return res.status(404).json({ message: 'Competition not found' });
    if (effectiveStatus(current) !== 'open') return res.status(409).json({ message: 'Only ongoing competitions can be edited' });
    const uploadedCover = await uploadCover(req.file);
    const coverUploadFailed = Boolean(req.file && !uploadedCover);
    const next = { title, description, rules, coverImage: coverUploadFailed ? '' : uploadedCover || coverImage };
    const updated = await Competition.findOneAndUpdate(
      { _id: current._id, status: 'open', openDate: { $lte: new Date() }, closeDate: { $gt: new Date() } },
      { $set: next }, { returnDocument: 'after', runValidators: true },
    );
    if (!updated) return res.status(409).json({ message: 'Competition is no longer open' });
    await CompetitionAudit.create({ competitionId: updated._id, actorId: req.auth.userId, action: 'updated', details: { fields: allowed.filter(key => JSON.stringify(current[key]) !== JSON.stringify(next[key])) } });
    return res.status(200).json({ data: { ...presentCompetition(updated, req.auth.userId), coverUploadFailed } });
  } catch { return res.status(500).json({ message: 'Unable to update competition' }); }
  finally { if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {}); }
};

const scoreEntry = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.entryId)) return res.status(400).json({ message: 'Invalid competition or entry id' });
    const scores = ['craft', 'originality', 'relevance'].reduce((result, key) => ({ ...result, [key]: Number(req.body[key]) }), {});
    const note = String(req.body.note || '').trim();
    if (Object.values(scores).some(value => !Number.isInteger(value) || value < 1 || value > 10) || note.length > 1000) return res.status(400).json({ message: 'Scores must be whole numbers from 1 to 10' });
    let competition = await Competition.findOne({ _id: req.params.id, votingMode: { $in: ['judges', 'hybrid'] }, 'entries._id': req.params.entryId });
    if (!competition) return res.status(404).json({ message: 'Scorable entry not found' });
    if (competition.competitionType === 'collective_choice') competition = await processCompetition(competition);
    const entry = competition.entries.id(req.params.entryId);
    const scorePolicy = canScoreEntry(competition, entry);
    if (!scorePolicy.allowed) return res.status(409).json({ message: scorePolicy.reason === 'ENTRY_DISQUALIFIED' ? 'Disqualified entries cannot be scored' : scorePolicy.reason === 'COMPETITION_CLOSED' ? 'Closed competitions cannot be scored' : 'Judge scoring opens after voting closes' });
    if (competition.competitionType === 'collective_choice') {
      const representedId = req.body.moderatorId || req.auth.userId;
      if (!isValidId(representedId) || !competition.judgeRoster.some(id => String(id) === String(representedId))) return res.status(403).json({ message: 'The moderator is not on this competition’s judge roster' });
      const actor = await User.findById(req.auth.userId).select('role accountStatus');
      if (!actor || actor.accountStatus === 'suspended' || (actor.role !== 'admin' && String(representedId) !== req.auth.userId)) return res.status(403).json({ message: 'Only an active roster moderator or admin may fill this scoring slot' });
      const recorded = entry.judgeScores.find(score => String(score.judgeId) === String(representedId));
      if (recorded && actor.role !== 'admin') return res.status(409).json({ message: 'This moderator has already submitted a score' });
      const updated = recorded
        ? await Competition.findOneAndUpdate(
          { _id: competition._id, status: 'judging', entries: { $elemMatch: { _id: entry._id, status: 'submitted', 'judgeScores.judgeId': new mongoose.Types.ObjectId(representedId) } } },
          { $set: { 'entries.$[entry].judgeScores.$[slot].craft': scores.craft, 'entries.$[entry].judgeScores.$[slot].originality': scores.originality, 'entries.$[entry].judgeScores.$[slot].relevance': scores.relevance, 'entries.$[entry].judgeScores.$[slot].note': note } },
          { arrayFilters: [{ 'entry._id': entry._id, 'entry.status': 'submitted' }, { 'slot.judgeId': new mongoose.Types.ObjectId(representedId) }], returnDocument: 'after' },
        )
        : await Competition.findOneAndUpdate(
          { _id: competition._id, status: 'judging', entries: { $elemMatch: { _id: entry._id, status: 'submitted', 'judgeScores.judgeId': { $ne: new mongoose.Types.ObjectId(representedId) } } } },
          { $push: { 'entries.$.judgeScores': { judgeId: representedId, submittedBy: req.auth.userId, ...scores, note } } },
          { returnDocument: 'after' },
        );
      if (!updated) return res.status(409).json({ message: 'This scoring slot is complete or judging has closed' });
      competition = recorded ? updated : await processCompetition(updated);
      await CompetitionAudit.create({ competitionId: competition._id, actorId: req.auth.userId, action: recorded ? 'score_edited' : 'scored', details: { entryId: entry._id, moderatorId: representedId, submittedBy: recorded?.submittedBy || req.auth.userId, ...(recorded ? { previous: { craft: recorded.craft, originality: recorded.originality, relevance: recorded.relevance }, next: scores } : {}) } });
    } else {
      const representedId = req.body.moderatorId || req.auth.userId;
      if (!isValidId(representedId)) return res.status(400).json({ message: 'Invalid moderator id' });
      const existing = entry.judgeScores.find(score => String(score.judgeId) === String(representedId));
      if (String(representedId) !== req.auth.userId && (req.auth.role !== 'admin' || !existing)) return res.status(403).json({ message: 'Only an admin may edit another moderator’s score' });
      if (!existing && req.auth.role === 'admin' && entry.judgeScores.length) return res.status(409).json({ message: 'A moderator score already exists; edit it instead of adding another score' });
      if (existing) Object.assign(existing, scores, { note });
      else entry.judgeScores.push({ judgeId: req.auth.userId, ...scores, note });
      await competition.save();
      await CompetitionAudit.create({ competitionId: competition._id, actorId: req.auth.userId, action: existing ? 'score_edited' : 'scored', details: { entryId: entry._id, moderatorId: representedId } });
    }
    return res.json({ data: { entryId: entry._id, score: (scores.craft + scores.originality + scores.relevance) / 3 } });
  } catch { return res.status(500).json({ message: 'Unable to score entry' }); }
};

const publishResults = async (req, res) => {
  try {
    if (isValidId(req.params.id)) {
      const current = await Competition.findById(req.params.id);
      if (current && isNewMode(current)) return res.status(409).json({ message: 'Results are announced automatically' });
    }
    if (!isValidId(req.params.id) || !Array.isArray(req.body.winnerEntryIds) || req.body.winnerEntryIds.length < 1 || req.body.winnerEntryIds.length > 5 || req.body.winnerEntryIds.some(id => !isValidId(id))) return res.status(400).json({ message: 'Select between one and five valid winners' });
    let competition = await Competition.findById(req.params.id);
    if (!competition) return res.status(404).json({ message: 'Competition not found' });
    if (!canPublishResults(competition)) return res.status(409).json({ message: 'Results can only be published after voting closes' });
    const winnerIds = [...new Set(req.body.winnerEntryIds.map(String))];
    if (winnerIds.length !== req.body.winnerEntryIds.length || winnerIds.some(id => !competition.entries.id(id) || competition.entries.id(id).status === 'disqualified')) return res.status(400).json({ message: 'One or more winners are not eligible entries' });
    const now = new Date();
    const published = await Competition.findOneAndUpdate(
      {
        _id: req.params.id,
        $and: [
          { $or: [{ status: 'judging' }, { status: 'open', closeDate: { $lte: now } }] },
          { $or: [{ resultsDate: null }, { resultsDate: { $gt: now } }] },
        ],
      },
      { $set: { winnerEntryIds: winnerIds, status: 'closed', resultsDate: competition.resultsDate || now } },
      { returnDocument: 'after' },
    );
    if (!published) return res.status(409).json({ message: 'Competition results were already published or the judging window has closed' });
    competition = published;
    await CompetitionAudit.create({ competitionId: competition._id, actorId: req.auth.userId, action: 'results_published', details: { winnerEntryIds: winnerIds, ranking: rankCompetitionEntries(competition.entries, competition.votingMode).map(({ id, rank, score }) => ({ id, rank, score })) } });
    await Promise.all(winnerIds.map(id => { const entry = competition.entries.id(id); return notify({ recipientId: entry.author, actorId: req.auth.userId, type: 'competition_result', title: `You placed in ${competition.title}`, body: 'The competition results are now public.', href: `/explore/competitions/${competition._id}`, entityType: 'competition', entityId: competition._id }); }));
    return res.json({ data: presentCompetition(competition, req.auth.userId, true) });
  } catch { return res.status(500).json({ message: 'Unable to publish competition results' }); }
};

const disqualifyEntry = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.entryId)) return res.status(400).json({ message: 'Invalid competition or entry id' });
    const reason = String(req.body?.reason || '').trim();
    if (!reason || reason.length > 2000) return res.status(400).json({ message: 'A disqualification reason is required' });
    const competition = await Competition.findById(req.params.id);
    if (!competition) return res.status(404).json({ message: 'Competition not found' });
    const status = effectiveStatus(competition);
    if (!['open', 'judging'].includes(status)) return res.status(409).json({ message: 'Competition entries cannot be changed in this phase' });
    const entry = competition.entries.id(req.params.entryId);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    if (entry.status === 'disqualified') return res.status(409).json({ message: 'Entry is already disqualified' });
    entry.status = 'disqualified';
    entry.disqualificationReason = reason;
    entry.disqualifiedAt = new Date();
    entry.disqualifiedBy = req.auth.userId;
    competition.winnerEntryIds = competition.winnerEntryIds.filter(id => id.toString() !== req.params.entryId);
    await competition.save();
    await CompetitionAudit.create({ competitionId: competition._id, actorId: req.auth.userId, action: 'entry_disqualified', details: { entryId: entry._id, reason } });
    return res.json({ data: { entryId: entry._id, status: entry.status } });
  } catch { return res.status(500).json({ message: 'Unable to disqualify entry' }); }
};

const submitAppeal = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.entryId)) return res.status(400).json({ message: 'Invalid competition or entry id' });
    const reason = String(req.body?.reason || '').trim();
    if (!reason || reason.length > 2000) return res.status(400).json({ message: 'An appeal reason is required' });
    const competition = await Competition.findById(req.params.id);
    if (!competition) return res.status(404).json({ message: 'Competition not found' });
    const entry = competition.entries.id(req.params.entryId);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    if (entry.author.toString() !== req.auth.userId) return res.status(403).json({ message: 'Only the entry author can appeal' });
    if (entry.status !== 'disqualified') return res.status(409).json({ message: 'Only disqualified entries can be appealed' });
    const appeal = await CompetitionAppeal.create({ competitionId: competition._id, entryId: entry._id, appellantId: req.auth.userId, reason });
    await CompetitionAudit.create({ competitionId: competition._id, actorId: req.auth.userId, action: 'appeal_submitted', details: { entryId: entry._id, appealId: appeal._id } });
    return res.status(201).json({ data: { id: appeal._id, status: appeal.status } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'An appeal has already been submitted for this entry' });
    return res.status(500).json({ message: 'Unable to submit appeal' });
  }
};

const decideAppeal = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.appealId)) return res.status(400).json({ message: 'Invalid competition or appeal id' });
    const decision = String(req.body?.decision || '');
    const decisionNote = String(req.body?.note || '').trim();
    if (!['accepted', 'rejected'].includes(decision) || !decisionNote || decisionNote.length > 2000) return res.status(400).json({ message: 'A valid appeal decision and note are required' });
    const appeal = await CompetitionAppeal.findOne({ _id: req.params.appealId, competitionId: req.params.id });
    if (!appeal) return res.status(404).json({ message: 'Appeal not found' });
    if (appeal.status !== 'pending') return res.status(409).json({ message: 'Appeal has already been decided' });
    const competition = await Competition.findById(req.params.id);
    const entry = competition?.entries.id(appeal.entryId);
    if (!competition || !entry) return res.status(404).json({ message: 'Appeal entry not found' });
    if (decision === 'accepted' && effectiveStatus(competition) === 'closed') return res.status(409).json({ message: 'Published competition results cannot be changed by an appeal' });
    appeal.status = decision;
    appeal.decisionNote = decisionNote;
    appeal.decidedBy = req.auth.userId;
    appeal.decidedAt = new Date();
    await appeal.save();
    if (decision === 'accepted') {
      entry.status = 'submitted';
      entry.disqualificationReason = '';
      entry.disqualifiedAt = null;
      entry.disqualifiedBy = null;
      await competition.save();
    }
    await CompetitionAudit.create({ competitionId: competition._id, actorId: req.auth.userId, action: 'appeal_decided', details: { entryId: entry._id, appealId: appeal._id, decision, note: decisionNote } });
    return res.json({ data: { id: appeal._id, status: appeal.status, entryStatus: entry.status } });
  } catch { return res.status(500).json({ message: 'Unable to decide appeal' }); }
};

module.exports = { effectiveStatus, isVotingOpen, canVoteEntry, competitionStatusCandidates, canScoreEntry, canPublishResults, getCompetitions, getCompetitionById, getEligiblePosts, enterCompetition, removeEntry, voteEntry, removeEntryVote, createCompetition, updateCompetition, scoreEntry, publishResults, disqualifyEntry, submitAppeal, decideAppeal };
