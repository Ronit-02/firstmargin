const crypto = require('crypto');
const PublicationSummary = require('../schemas/publication-summary.schema');

const stopWords = new Set('a an and are as at be by for from has have in is it its of on or that the their this to was were will with'.split(' '));
const extractText = body => {
  try {
    return JSON.parse(body).filter(block => !['image', 'divider', 'code'].includes(block?.type)).map(block => String(block.content || '').replace(/<[^>]*>/g, ' ')).join(' ').replace(/\s+/g, ' ').trim();
  } catch { return ''; }
};

const summarizeExtractively = text => {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(sentence => sentence.trim()).filter(sentence => sentence.length >= 30) || [];
  if (!sentences.length) return text ? [text.slice(0, 500)] : [];
  const frequencies = new Map();
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) || []) {
    if (!stopWords.has(word) && word.length > 2) frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }
  return sentences
    .map((sentence, index) => ({ sentence: sentence.slice(0, 500), index, score: (sentence.toLowerCase().match(/[a-z0-9]+/g) || []).reduce((sum, word) => sum + (frequencies.get(word) || 0), 0) / Math.max(1, sentence.split(/\s+/).length) + (index === 0 ? 1 : 0) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .sort((left, right) => left.index - right.index)
    .map(item => item.sentence);
};

const getOrCreateSummary = async post => {
  const sourceHash = crypto.createHash('sha256').update(post.body).digest('hex');
  const existing = await PublicationSummary.findOne({ publicationId: post._id, sourceHash });
  if (existing) return existing;
  const points = summarizeExtractively(extractText(post.body));
  return PublicationSummary.findOneAndUpdate(
    { publicationId: post._id },
    { $set: { sourceHash, points, provider: 'extractive-v1', disclosure: 'Automatically generated extractive overview; verify details against the full story.', generatedAt: new Date() } },
    { returnDocument: 'after', upsert: true }
  );
};

module.exports = { extractText, summarizeExtractively, getOrCreateSummary };
