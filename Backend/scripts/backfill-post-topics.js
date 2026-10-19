require('dotenv').config();
const mongoose = require('mongoose');
const Publication = require('../schemas/publication.schema');
const Topic = require('../schemas/topic.schema');
const { connectToMongoDB } = require('../utils/mongoConnect');
const { ensureCanonicalTopics } = require('../services/topic.service');

const run = async () => {
  await connectToMongoDB();
  await ensureCanonicalTopics();
  const topics = await Topic.find({ status: 'active' }).select('_id slug aliases');
  const topicByTag = new Map();
  for (const topic of topics) {
    topicByTag.set(topic.slug, topic._id);
    for (const alias of topic.aliases) topicByTag.set(alias, topic._id);
  }

  let updated = 0;
  const cursor = Publication.find().select('_id tags topics').cursor();
  for await (const post of cursor) {
    const topicIds = [...new Set((post.tags || [])
      .map(tag => topicByTag.get(String(tag).toLowerCase()))
      .filter(Boolean)
      .map(String))];
    const existing = (post.topics || []).map(String).sort();
    if (JSON.stringify(existing) !== JSON.stringify([...topicIds].sort())) {
      await Publication.updateOne({ _id: post._id }, { $set: { topics: topicIds } });
      updated += 1;
    }
  }
  console.log(`Updated canonical topics for ${updated} posts`);
};

run()
  .catch(_error => {
    console.error('Publication topic backfill failed');
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
