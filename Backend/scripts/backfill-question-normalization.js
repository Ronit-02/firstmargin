require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('../schemas/question.schema');
const { connectToMongoDB } = require('../utils/mongoConnect');
const { normalizeQuestionText } = require('../utils/question');

const run = async () => {
  await connectToMongoDB();
  const questions = await Question.find().sort({ createdAt: 1 }).select('_id text normalizedText upvotes upvotesCount relatedPublications');
  const canonicalByText = new Map();
  let merged = 0;
  let updated = 0;

  for (const question of questions) {
    const normalizedText = normalizeQuestionText(question.text);
    const canonical = canonicalByText.get(normalizedText);
    if (!canonical) {
      canonicalByText.set(normalizedText, question);
      await Question.updateOne({ _id: question._id }, {
        $set: { normalizedText, upvotesCount: new Set((question.upvotes || []).map(String)).size },
      });
      updated += 1;
      continue;
    }

    const upvotes = [...new Set([...(canonical.upvotes || []), ...(question.upvotes || [])].map(String))];
    const relatedPublications = [...new Set([...(canonical.relatedPublications || []), ...(question.relatedPublications || [])].map(String))];
    await Question.updateOne({ _id: canonical._id }, {
      $set: { upvotes, upvotesCount: upvotes.length, relatedPublications },
    });
    await Question.deleteOne({ _id: question._id });
    canonical.upvotes = upvotes;
    canonical.relatedPublications = relatedPublications;
    merged += 1;
  }
  console.log(`Normalized ${updated} questions and merged ${merged} exact duplicates`);
};

run()
  .catch(_error => {
    console.error('Question normalization backfill failed');
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
