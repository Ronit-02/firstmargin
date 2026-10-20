const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Competition = require('../schemas/competition.schema');
const CompetitionAudit = require('../schemas/competition-audit.schema');
const { updateCompetition } = require('../controllers/competition.controller');

const competitionId = new mongoose.Types.ObjectId().toString();
const actorId = new mongoose.Types.ObjectId().toString();
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
});

test('staff edit changes only allowed content while voting is open and audits the update', async () => {
  const originals = { find: Competition.findById, update: Competition.findOneAndUpdate, audit: CompetitionAudit.create };
  const current = { _id: competitionId, status: 'open', openDate: new Date(Date.now() - 60_000), closeDate: new Date(Date.now() + 60_000), title: 'Before', description: '', coverImage: '', rules: [], entries: [] };
  let saved;
  Competition.findById = async () => current;
  Competition.findOneAndUpdate = async (filter, update) => { assert.equal(filter.status, 'open'); saved = update.$set; return { ...current, ...saved }; };
  CompetitionAudit.create = async record => { assert.equal(record.action, 'updated'); assert.equal(record.actorId, actorId); };
  try {
    const res = response();
    await updateCompetition({ params: { id: competitionId }, auth: { userId: actorId }, body: { title: 'After', description: 'New details', rules: '["One rule"]', coverImage: '' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(saved).sort(), ['coverImage', 'description', 'rules', 'title']);
    assert.equal(saved.title, 'After');
    assert.deepEqual(saved.rules, ['One rule']);
  } finally { Competition.findById = originals.find; Competition.findOneAndUpdate = originals.update; CompetitionAudit.create = originals.audit; }
});

test('staff edit rejects lifecycle fields and competitions past their deadline', async () => {
  const original = Competition.findById;
  try {
    const forbidden = response();
    await updateCompetition({ params: { id: competitionId }, auth: { userId: actorId }, body: { title: 'Title', description: '', rules: '[]', coverImage: '', closeDate: new Date().toISOString() } }, forbidden);
    assert.equal(forbidden.statusCode, 400);
    Competition.findById = async () => ({ status: 'open', openDate: new Date(Date.now() - 120_000), closeDate: new Date(Date.now() - 60_000) });
    const expired = response();
    await updateCompetition({ params: { id: competitionId }, auth: { userId: actorId }, body: { title: 'Title', description: '', rules: '[]', coverImage: '' } }, expired);
    assert.equal(expired.statusCode, 409);
  } finally { Competition.findById = original; }
});
