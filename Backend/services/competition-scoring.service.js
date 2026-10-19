const entryId = entry => String(entry._id || entry.id);

const judgeAverage = entry => {
  const scores = (entry.judgeScores || []).flatMap(score => [score.craft, score.originality, score.relevance]);
  return scores.length ? scores.reduce((total, score) => total + Number(score), 0) / scores.length : 0;
};

const rankCompetitionEntries = (entries, votingMode = 'readers') => {
  const eligibleEntries = entries.filter(entry => entry.status !== 'disqualified');
  const readerScores = eligibleEntries.map(entry => Number(entry.votesCount ?? entry.votes?.length ?? 0));
  const maxReaderScore = Math.max(0, ...readerScores);
  const scored = eligibleEntries.map((entry, index) => {
    const readerScore = readerScores[index];
    const judgeScore = judgeAverage(entry);
    const normalizedReader = maxReaderScore ? readerScore / maxReaderScore : 0;
    const score = votingMode === 'judges'
      ? judgeScore
      : votingMode === 'hybrid'
        ? ((normalizedReader + (judgeScore / 10)) / 2) * 100
        : readerScore;
    return { entry, id: entryId(entry), score, readerScore, judgeScore };
  }).sort((left, right) => (
    right.score - left.score
    || new Date(left.entry.createdAt || 0) - new Date(right.entry.createdAt || 0)
    || left.id.localeCompare(right.id)
  ));

  let previousRank = 0;
  return scored.map((item, index) => {
    const rank = index > 0 && item.score === scored[index - 1].score ? previousRank : index + 1;
    previousRank = rank;
    return { ...item, rank };
  });
};

module.exports = { judgeAverage, rankCompetitionEntries };
