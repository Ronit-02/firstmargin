// Keep the existing HTTP contract while the application moves its storage and
// internal names to Publication, Story, Short, and Appreciation.
const inputKey = { postId: 'publicationId', postIds: 'publicationIds', post: 'publication', posts: 'publications', postRevision: 'publicationRevision', relatedArticles: 'relatedPublications', likesCount: 'appreciationsCount', isLiked: 'isAppreciated' };
const outputKey = { publicationId: 'postId', publicationIds: 'postIds', publication: 'post', publications: 'posts', publicationRevision: 'postRevision', relatedPublications: 'relatedArticles', appreciationsCount: 'likesCount', isAppreciated: 'isLiked', votesCount: 'likesCount', votes: 'likes' };
const legacyValues = { article: 'story', post: 'publication', post_liked: 'publication_appreciated', post_commented: 'publication_commented', article_summary: 'story_summary' };
const canonicalValues = Object.fromEntries(Object.entries(legacyValues).map(([oldValue, newValue]) => [newValue, oldValue]));

const mapValue = (value, keys, legacyOutput = false) => {
  if (Array.isArray(value)) return value.map(item => mapValue(item, keys, legacyOutput));
  if (!value || typeof value !== 'object') return value;
  const mapped = {};
  for (const [key, item] of Object.entries(value)) {
    const valueMap = legacyOutput ? canonicalValues : legacyValues;
    mapped[key] = ['format', 'type', 'surface', 'entityType', 'subjectType', 'capability'].includes(key) && typeof item === 'string' && valueMap[item]
      ? valueMap[item]
      : mapValue(item, keys, legacyOutput);
    if (keys[key] && mapped[keys[key]] === undefined) mapped[keys[key]] = mapped[key];
  }
  return mapped;
};

const canonicalizeOutput = value => {
  if (Array.isArray(value)) return value.map(canonicalizeOutput);
  if (!value || typeof value !== 'object') return value;
  const mapped = {};
  for (const [key, item] of Object.entries(value)) {
    const name = inputKey[key] || key;
    if (name in mapped && name !== key) continue;
    mapped[name] = ['format', 'type', 'surface', 'entityType', 'subjectType', 'capability'].includes(name)
      && typeof item === 'string' && legacyValues[item]
      ? legacyValues[item]
      : canonicalizeOutput(item);
  }
  return mapped;
};

const normalizeLegacyRequest = (req, _res, next) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) req.body = mapValue(req.body, inputKey);
  const query = req.query;
  if (query && Object.keys(query).length) {
    Object.defineProperty(req, 'query', { configurable: true, value: mapValue(query, inputKey) });
  }
  next();
};

const addLegacyResponseAliases = (req, res, next) => {
  const json = res.json.bind(res);
  const canonical = req.originalUrl.startsWith('/api/publications') || req.originalUrl.includes('/publications/');
  res.json = payload => {
    if (payload === undefined) return json(payload);
    const plain = JSON.parse(JSON.stringify(payload));
    return json(canonical ? canonicalizeOutput(plain) : mapValue(plain, outputKey, true));
  };
  next();
};

module.exports = { normalizeLegacyRequest, addLegacyResponseAliases };
