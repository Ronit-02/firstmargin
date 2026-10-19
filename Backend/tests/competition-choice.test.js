const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Competition = require('../schemas/competition.schema');
const User = require('../schemas/user.schema');
const RoleChange = require('../schemas/role-change.schema');
const CompetitionAudit = require('../schemas/competition-audit.schema');
const { processCompetition } = require('../services/competition-lifecycle.service');
const { rankCompetitionEntries } = require('../services/competition-scoring.service');
const { effectiveStatus, isVotingOpen, scoreEntry } = require('../controllers/competition.controller');

const now = new Date('2026-10-19T12:00:00Z');
const id = value => ({ toString: () => value });

test('new competition modes stop reader voting at the deadline', () => {
  for (const competitionType of ['reader_choice', 'collective_choice']) {
    const competition = { competitionType, status: 'open', openDate: new Date('2026-10-01'), closeDate: now };
    assert.equal(isVotingOpen(competition, now), false);
    assert.equal(effectiveStatus(competition, now), competitionType === 'reader_choice' ? 'closed' : 'judging');
  }
});

test('Readers Choice finalizes ties once and keeps all first-place entries', async () => {
  const originals = { update: Competition.findOneAndUpdate, audit: CompetitionAudit.create };
  const entries = [
    { _id: id('a'), status: 'submitted', votesCount: 2, judgeScores: [] },
    { _id: id('b'), status: 'submitted', votesCount: 2, judgeScores: [] },
    { _id: id('c'), status: 'submitted', votesCount: 1, judgeScores: [] },
  ];
  const competition = { _id: id('competition'), createdBy: id('creator'), competitionType: 'reader_choice', votingMode: 'readers', status: 'open', closeDate: now, entries };
  let writes = 0;
  Competition.findOneAndUpdate = async (_query, update) => { writes += 1; assert.deepEqual(update.$set.winnerEntryIds.map(String), ['a', 'b']); return { ...competition, ...update.$set, entries: { id: () => ({ author: id('creator') }) } }; };
  CompetitionAudit.create = async () => {};
  try {
    const result = await processCompetition(competition, now);
    assert.equal(result.status, 'closed');
    assert.equal(writes, 1);
    assert.deepEqual(rankCompetitionEntries(entries, 'readers').map(item => item.rank), [1, 1, 3]);
  } finally { Competition.findOneAndUpdate = originals.update; CompetitionAudit.create = originals.audit; }
});

test('Collective Choice fixes moderator roster using role at voting deadline', async () => {
  const originals = { update: Competition.findOneAndUpdate, findById: Competition.findById, users: User.find, changes: RoleChange.find, audit: CompetitionAudit.create };
  const competition = { _id: id('competition'), createdBy: id('creator'), competitionType: 'collective_choice', votingMode: 'hybrid', status: 'open', closeDate: now, entries: [{ _id: id('entry'), status: 'submitted', judgeScores: [] }] };
  RoleChange.find = () => ({ sort: () => ({ select: () => ({ lean: async () => [{ userId: id('demoted'), fromRole: 'moderator' }, { userId: id('promoted'), fromRole: 'regular' }] }) }) });
  User.find = () => ({ select: () => ({ lean: async () => [{ _id: id('demoted'), role: 'regular' }, { _id: id('promoted'), role: 'moderator' }, { _id: id('steady'), role: 'moderator' }] }) });
  Competition.findOneAndUpdate = async (_query, update) => ({ ...competition, ...update.$set });
  Competition.findById = async () => competition;
  CompetitionAudit.create = async () => {};
  try {
    const result = await processCompetition(competition, now);
    assert.equal(result.status, 'judging');
    assert.deepEqual(result.judgeRoster.map(String), ['demoted', 'steady']);
  } finally { Competition.findOneAndUpdate = originals.update; Competition.findById = originals.findById; User.find = originals.users; RoleChange.find = originals.changes; CompetitionAudit.create = originals.audit; }
});

test('Readers Choice closes without a winner when eligible entries have no votes', async () => {
  const originals = { update: Competition.findOneAndUpdate, audit: CompetitionAudit.create };
  const competition = { _id: id('competition'), createdBy: id('creator'), competitionType: 'reader_choice', votingMode: 'readers', status: 'open', closeDate: now, entries: [{ _id: id('entry'), status: 'submitted', votesCount: 0, judgeScores: [] }] };
  Competition.findOneAndUpdate = async (_query, update) => ({ ...competition, ...update.$set });
  CompetitionAudit.create = async () => {};
  try {
    const result = await processCompetition(competition, now);
    assert.deepEqual(result.winnerEntryIds, []);
    assert.equal(result.noWinnerReason, 'no_reader_votes');
  } finally { Competition.findOneAndUpdate = originals.update; CompetitionAudit.create = originals.audit; }
});

test('Collective Choice gives reader votes and judge scores equal weight', () => {
  const entries = [
    { _id: id('readers'), status: 'submitted', votesCount: 10, judgeScores: [{ craft: 1, originality: 1, relevance: 1 }] },
    { _id: id('judges'), status: 'submitted', votesCount: 0, judgeScores: [{ craft: 10, originality: 10, relevance: 10 }] },
  ];
  const ranking = rankCompetitionEntries(entries, 'hybrid');
  assert.deepEqual(ranking.map(item => [item.id, item.rank, Math.round(item.score)]), [['readers', 1, 55], ['judges', 2, 50]]);
});

test('Collective Choice closes after every eligible entry has every roster score', async () => {
  const originals = { update: Competition.findOneAndUpdate, audit: CompetitionAudit.create };
  const entry = { _id: id('entry'), author: id('creator'), status: 'submitted', votesCount: 3, judgeScores: [{ judgeId: id('moderator'), craft: 8, originality: 8, relevance: 8 }] };
  const competition = { _id: id('competition'), createdBy: id('creator'), competitionType: 'collective_choice', votingMode: 'hybrid', status: 'judging', closeDate: now, judgeRoster: [id('moderator')], entries: [entry] };
  let writes = 0;
  Competition.findOneAndUpdate = async (_query, update) => { writes += 1; return { ...competition, ...update.$set, entries: { id: () => entry } }; };
  CompetitionAudit.create = async () => {};
  try {
    const result = await processCompetition(competition, now);
    assert.equal(result.status, 'closed');
    assert.deepEqual(result.winnerEntryIds.map(String), ['entry']);
    assert.equal(writes, 1);
  } finally { Competition.findOneAndUpdate = originals.update; CompetitionAudit.create = originals.audit; }
});

test('an admin edits an existing moderator score without adding another slot', async () => {
  const moderatorId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const entryId = new mongoose.Types.ObjectId();
  const competition = new Competition({ title: 'Judging', closeDate: new Date('2026-01-01'), status: 'judging', competitionType: 'collective_choice', votingMode: 'hybrid', judgeRoster: [moderatorId, new mongoose.Types.ObjectId()], entries: [{ _id: entryId, author: adminId, publication: new mongoose.Types.ObjectId(), judgeScores: [{ judgeId: moderatorId, submittedBy: moderatorId, craft: 4, originality: 5, relevance: 6 }] }] });
  const original = { findOne: Competition.findOne, update: Competition.findOneAndUpdate, findUser: User.findById, audit: CompetitionAudit.create };
  let write;
  let audit;
  Competition.findOne = async () => competition;
  Competition.findOneAndUpdate = async (query, update, options) => { write = { query, update, options }; return competition; };
  User.findById = () => ({ select: async () => ({ role: 'admin', accountStatus: 'active' }) });
  CompetitionAudit.create = async record => { audit = record; };
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await scoreEntry({ params: { id: String(competition._id), entryId: String(entryId) }, auth: { userId: String(adminId), role: 'admin' }, body: { moderatorId: String(moderatorId), craft: 8, originality: 9, relevance: 7, note: 'Revised' } }, response);
    assert.equal(response.statusCode, undefined);
    assert.equal(response.body.data.score, 8);
    assert.equal(write.update.$push, undefined);
    assert.equal(write.update.$set['entries.$[entry].judgeScores.$[slot].craft'], 8);
    assert.equal(String(write.options.arrayFilters[1]['slot.judgeId']), String(moderatorId));
    assert.equal(audit.action, 'score_edited');
    assert.equal(String(audit.details.submittedBy), String(moderatorId));
  } finally { Competition.findOne = original.findOne; Competition.findOneAndUpdate = original.update; User.findById = original.findUser; CompetitionAudit.create = original.audit; }
});

test('a moderator cannot resubmit a completed Collective Choice slot', async () => {
  const moderatorId = new mongoose.Types.ObjectId();
  const entryId = new mongoose.Types.ObjectId();
  const competition = new Competition({ title: 'Judging', closeDate: new Date('2026-01-01'), status: 'judging', competitionType: 'collective_choice', votingMode: 'hybrid', judgeRoster: [moderatorId, new mongoose.Types.ObjectId()], entries: [{ _id: entryId, author: moderatorId, publication: new mongoose.Types.ObjectId(), judgeScores: [{ judgeId: moderatorId, craft: 4, originality: 5, relevance: 6 }] }] });
  const original = { findOne: Competition.findOne, update: Competition.findOneAndUpdate, findUser: User.findById };
  let writes = 0;
  Competition.findOne = async () => competition;
  Competition.findOneAndUpdate = async () => { writes += 1; return competition; };
  User.findById = () => ({ select: async () => ({ role: 'moderator', accountStatus: 'active' }) });
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await scoreEntry({ params: { id: String(competition._id), entryId: String(entryId) }, auth: { userId: String(moderatorId), role: 'moderator' }, body: { craft: 8, originality: 8, relevance: 8 } }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(writes, 0);
  } finally { Competition.findOne = original.findOne; Competition.findOneAndUpdate = original.update; User.findById = original.findUser; }
});

test('admin fallback only appends to an unfilled moderator slot', async () => {
  const moderatorId = new mongoose.Types.ObjectId();
  const anotherModeratorId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const entryId = new mongoose.Types.ObjectId();
  const competition = new Competition({ title: 'Judging', closeDate: new Date('2026-01-01'), status: 'judging', competitionType: 'collective_choice', votingMode: 'hybrid', judgeRoster: [moderatorId, anotherModeratorId], entries: [{ _id: entryId, author: adminId, publication: new mongoose.Types.ObjectId(), judgeScores: [] }] });
  const original = { findOne: Competition.findOne, update: Competition.findOneAndUpdate, findUser: User.findById, audit: CompetitionAudit.create };
  let write;
  Competition.findOne = async () => competition;
  Competition.findOneAndUpdate = async (query, update) => { write = { query, update }; return null; };
  User.findById = () => ({ select: async () => ({ role: 'admin', accountStatus: 'active' }) });
  CompetitionAudit.create = async () => { throw new Error('No audit entry for a rejected write'); };
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await scoreEntry({ params: { id: String(competition._id), entryId: String(entryId) }, auth: { userId: String(adminId), role: 'admin' }, body: { moderatorId: String(moderatorId), craft: 8, originality: 8, relevance: 8 } }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(String(write.query.entries.$elemMatch['judgeScores.judgeId'].$ne), String(moderatorId));
    assert.equal(String(write.update.$push['entries.$.judgeScores'].judgeId), String(moderatorId));
    assert.equal(String(write.update.$push['entries.$.judgeScores'].submittedBy), String(adminId));
  } finally { Competition.findOne = original.findOne; Competition.findOneAndUpdate = original.update; User.findById = original.findUser; CompetitionAudit.create = original.audit; }
});

test('legacy admin edits a moderator score instead of adding a separate score', async () => {
  const moderatorId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const entryId = new mongoose.Types.ObjectId();
  const competition = new Competition({ title: 'Legacy judging', closeDate: new Date('2026-01-01'), status: 'judging', competitionType: 'theme', votingMode: 'hybrid', entries: [{ _id: entryId, author: adminId, publication: new mongoose.Types.ObjectId(), judgeScores: [{ judgeId: moderatorId, craft: 4, originality: 5, relevance: 6 }] }] });
  const original = { findOne: Competition.findOne, audit: CompetitionAudit.create };
  let saves = 0;
  let audit;
  Competition.findOne = async () => competition;
  competition.save = async () => { saves += 1; return competition; };
  CompetitionAudit.create = async record => { audit = record; };
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await scoreEntry({ params: { id: String(competition._id), entryId: String(entryId) }, auth: { userId: String(adminId), role: 'admin' }, body: { moderatorId: String(moderatorId), craft: 8, originality: 8, relevance: 8 } }, response);
    assert.equal(response.statusCode, undefined);
    assert.equal(saves, 1);
    assert.equal(competition.entries.id(entryId).judgeScores.length, 1);
    assert.equal(competition.entries.id(entryId).judgeScores[0].craft, 8);
    assert.equal(audit.action, 'score_edited');
    await scoreEntry({ params: { id: String(competition._id), entryId: String(entryId) }, auth: { userId: String(adminId), role: 'admin' }, body: { craft: 9, originality: 9, relevance: 9 } }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(saves, 1);
  } finally { Competition.findOne = original.findOne; CompetitionAudit.create = original.audit; }
});
