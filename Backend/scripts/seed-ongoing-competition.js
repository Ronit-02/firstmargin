const mongoose = require('mongoose');
const config = require('../config/config');
const { connectToMongoDB } = require('../utils/mongoConnect');
const User = require('../schemas/user.schema');
const Competition = require('../schemas/competition.schema');

const databaseName = (() => {
  try { return new URL(config.MONGO_URI || '').pathname.slice(1); } catch { return config.DB_NAME || ''; }
})();
if (process.env.NODE_ENV === 'production' || !/dev|test|sandbox|local/i.test(databaseName) || /prod|live/i.test(databaseName)) {
  throw new Error('Ongoing competition seed requires an explicitly named development database');
}

const DAY = 24 * 60 * 60 * 1000;
const title = 'The Places That Shape Us';

async function run() {
  await connectToMongoDB();
  const admin = await User.findOne({ email: 'admin@inkrider.local', role: 'admin' }).select('_id');
  if (!admin) throw new Error('Demo administrator is missing; run the comprehensive development seed first');

  const now = new Date();
  const competition = await Competition.findOneAndUpdate(
    { title, createdBy: admin._id },
    {
      $set: {
        status: 'open',
        openDate: new Date(now.getTime() - DAY),
        closeDate: new Date(now.getTime() + 14 * DAY),
        resultsDate: new Date(now.getTime() + 17 * DAY),
      },
      $setOnInsert: {
        description: 'Write about a place that changed how you see the world, from a familiar street to a room you still remember.',
        votingMode: 'readers',
        competitionType: 'theme',
        rules: ['Submit one of your published stories or shorts.', 'Show how the place shaped your perspective.', 'Reader votes must be independent.'],
        prizes: [{ rank: 'Winner', amount: 'Featured writer placement' }],
        maxEntries: 50,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  if (competition.status !== 'open' || competition.openDate > now || competition.closeDate <= now) throw new Error('Ongoing competition verification failed');
  console.log(`Ongoing development competition ready: ${competition.title} (closes ${competition.closeDate.toISOString()})`);
}

run().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect());
