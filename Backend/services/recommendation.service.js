const stableExploration = value => {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 700) / 100;
};

const rankCandidate = (post, { interestTopicIds, followedWriterIds, asOf }) => {
  const authorId = post.author?._id?.toString() || post.author?.toString();
  const topicIds = (post.topics || []).map(topic => topic._id?.toString() || topic.toString());
  const matchingTopics = topicIds.filter(topicId => interestTopicIds.has(topicId)).length;
  const followsAuthor = followedWriterIds.has(authorId);
  const ageHours = Math.max(0, (asOf.getTime() - new Date(post.createdAt).getTime()) / 3_600_000);
  const freshness = Math.max(0, 24 - ageHours / 4);
  const quality = Math.min(24, Math.log1p(Math.max(0, post.appreciationsCount || 0)) * 5);
  const affinity = Math.min(36, matchingTopics * 18) + (followsAuthor ? 28 : 0);
  const exploration = stableExploration(`${post._id}:${asOf.toISOString().slice(0, 10)}`);
  const score = Number((affinity + freshness + quality + exploration).toFixed(4));

  let reason = 'Explore something new';
  if (followsAuthor) reason = `Because you follow ${post.author?.username || 'this writer'}`;
  else if (matchingTopics > 0) reason = 'Matches your interests';
  else if ((post.appreciationsCount || 0) >= 5) reason = 'Popular with readers';
  else if (ageHours <= 24) reason = 'Recently published';

  return { publication: post, score, reason, authorId, primaryTopicId: topicIds[0] || null };
};

const diversify = ranked => {
  const remaining = [...ranked];
  const result = [];
  while (remaining.length) {
    const recent = result.slice(-2);
    const candidateIndex = remaining.findIndex(candidate => (
      !recent.some(item => item.authorId && item.authorId === candidate.authorId)
      && !recent.some(item => item.primaryTopicId && item.primaryTopicId === candidate.primaryTopicId)
    ));
    const [next] = remaining.splice(candidateIndex >= 0 ? candidateIndex : 0, 1);
    result.push(next);
  }
  return result;
};

const rankCandidates = (posts, context) => diversify(
  posts
    .map(post => rankCandidate(post, context))
    .sort((left, right) => right.score - left.score || String(right.publication._id).localeCompare(String(left.publication._id)))
);

const roundMetric = value => Number(value.toFixed(4));

const maxConsecutive = values => values.reduce((longest, value, index) => {
  if (index === 0) return 1;
  let length = 1;
  for (let cursor = index - 1; cursor >= 0 && values[cursor] === value; cursor -= 1) length += 1;
  return Math.max(longest, length);
}, 0);

const evaluateRanking = ({ ranked, relevantIds, limit = ranked.length }) => {
  const top = ranked.slice(0, limit);
  const relevant = new Set(relevantIds.map(String));
  const topIds = top.map(item => String(item.publication._id));
  const hits = topIds.filter(id => relevant.has(id)).length;
  const authors = top.map(item => item.authorId).filter(Boolean);
  const topics = top.map(item => item.primaryTopicId).filter(Boolean);

  return {
    limit: top.length,
    relevantHits: hits,
    precisionAtLimit: roundMetric(top.length ? hits / top.length : 0),
    recallAtLimit: roundMetric(relevant.size ? hits / relevant.size : 0),
    authorDiversity: roundMetric(authors.length ? new Set(authors).size / authors.length : 0),
    topicDiversity: roundMetric(topics.length ? new Set(topics).size / topics.length : 0),
    maxConsecutiveAuthor: maxConsecutive(authors),
  };
};

const evaluateRecommendationFixtures = fixtures => fixtures.map(fixture => {
  const ranked = rankCandidates(fixture.posts, fixture.context);
  return {
    name: fixture.name,
    ranking: ranked.map(item => ({ id: String(item.publication._id), score: item.score, reason: item.reason })),
    metrics: evaluateRanking({ ranked, relevantIds: fixture.relevantIds, limit: fixture.limit }),
  };
});

module.exports = { rankCandidate, rankCandidates, diversify, evaluateRanking, evaluateRecommendationFixtures };
