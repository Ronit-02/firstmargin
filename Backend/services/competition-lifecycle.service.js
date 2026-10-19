const Competition = require('../schemas/competition.schema');
const User = require('../schemas/user.schema');
const RoleChange = require('../schemas/role-change.schema');
const CompetitionAudit = require('../schemas/competition-audit.schema');
const { notify } = require('./notification.service');
const { rankCompetitionEntries } = require('./competition-scoring.service');

const isNewMode = competition => ['reader_choice', 'collective_choice'].includes(competition.competitionType);

const finishCompetition = async (competition, now = new Date()) => {
  const eligible = competition.entries.filter(entry => entry.status !== 'disqualified');
  const readerVotes = eligible.reduce((total, entry) => total + (entry.votesCount ?? entry.votes.length), 0);
  const noWinnerReason = !eligible.length ? 'no_eligible_entries'
    : competition.competitionType === 'reader_choice' && !readerVotes ? 'no_reader_votes'
      : competition.competitionType === 'collective_choice' && !competition.judgeRoster.length ? 'no_active_moderators'
        : null;
  const ranked = noWinnerReason ? [] : rankCompetitionEntries(eligible, competition.votingMode);
  const leaders = ranked.filter(item => item.rank === 1).map(item => item.entry._id);
  const closed = await Competition.findOneAndUpdate(
    { _id: competition._id, status: competition.status, finalizedAt: null, closeDate: { $lte: now } },
    { $set: { status: 'closed', finalizedAt: now, resultsDate: now, winnerEntryIds: leaders, noWinnerReason } },
    { returnDocument: 'after' },
  );
  if (!closed) return null;
  await CompetitionAudit.create({ competitionId: closed._id, actorId: closed.createdBy, action: 'results_published', details: { automatic: true, winnerEntryIds: leaders, noWinnerReason } });
  await Promise.all(leaders.map(id => {
    const entry = closed.entries.id(id);
    return notify({ recipientId: entry.author, actorId: closed.createdBy, type: 'competition_result', title: `You placed in ${closed.title}`, body: 'The competition results are now public.', href: `/explore/competitions/${closed._id}`, entityType: 'competition', entityId: closed._id });
  }));
  return closed;
};

const processCompetition = async (competition, now = new Date()) => {
  if (!competition || !isNewMode(competition) || competition.status === 'closed' || competition.closeDate > now) return competition;
  if (competition.competitionType === 'reader_choice') return (await finishCompetition(competition, now)) || Competition.findById(competition._id);
  if (competition.status === 'open') {
    const changes = await RoleChange.find({ createdAt: { $gt: competition.closeDate } }).sort({ createdAt: 1 }).select('userId fromRole').lean();
    const firstChange = new Map();
    for (const change of changes) if (!firstChange.has(String(change.userId))) firstChange.set(String(change.userId), change.fromRole);
    const moderators = await User.find({ accountStatus: { $ne: 'suspended' }, $or: [{ role: 'moderator' }, { _id: { $in: [...firstChange.keys()] } }] }).select('_id role').lean();
    const roster = moderators.filter(user => (firstChange.get(String(user._id)) || user.role) === 'moderator').map(user => user._id);
    competition = await Competition.findOneAndUpdate(
      { _id: competition._id, status: 'open', closeDate: { $lte: now } },
      { $set: { status: 'judging', judgeRoster: roster } },
      { returnDocument: 'after' },
    ) || await Competition.findById(competition._id);
  }
  if (competition.status !== 'judging') return competition;
  const eligible = competition.entries.filter(entry => entry.status !== 'disqualified');
  const complete = eligible.every(entry => competition.judgeRoster.every(judgeId => entry.judgeScores.some(score => String(score.judgeId) === String(judgeId))));
  return complete ? (await finishCompetition(competition, now)) || Competition.findById(competition._id) : competition;
};

const processDueCompetitions = async (now = new Date()) => {
  const due = await Competition.find({ competitionType: { $in: ['reader_choice', 'collective_choice'] }, status: { $in: ['open', 'judging'] }, closeDate: { $lte: now } });
  for (const competition of due) {
    try { await processCompetition(competition, now); }
    catch { console.error('Competition deadline processing needs repair'); }
  }
};

module.exports = { isNewMode, processCompetition, processDueCompetitions };
