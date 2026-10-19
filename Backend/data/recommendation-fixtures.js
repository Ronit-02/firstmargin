const asOf = new Date('2026-08-18T12:00:00.000Z');

const post = ({ id, author, topic, hoursAgo, likes = 0 }) => ({
  _id: id,
  author: { _id: author, username: author },
  topics: topic ? [{ _id: topic }] : [],
  createdAt: new Date(asOf.getTime() - hoursAgo * 3_600_000),
  appreciationsCount: likes,
});

const baseContext = {
  asOf,
  interestTopicIds: new Set(['topic-technology', 'topic-design']),
  followedWriterIds: new Set(['writer-followed']),
};

module.exports = [
  {
    name: 'explicit interests outrank unrelated popularity',
    context: baseContext,
    posts: [
      post({ id: 'interest-technology', author: 'writer-new', topic: 'topic-technology', hoursAgo: 6, likes: 2 }),
      post({ id: 'followed-writer', author: 'writer-followed', topic: 'topic-literature', hoursAgo: 18, likes: 1 }),
      post({ id: 'unrelated-popular', author: 'writer-popular', topic: 'topic-sports', hoursAgo: 2, likes: 20 }),
      post({ id: 'interest-design', author: 'writer-design', topic: 'topic-design', hoursAgo: 30, likes: 3 }),
    ],
    relevantIds: ['interest-technology', 'followed-writer', 'interest-design'],
    limit: 3,
  },
  {
    name: 'alternative writers and topics remain visible',
    context: { ...baseContext, followedWriterIds: new Set() },
    posts: [
      post({ id: 'writer-a-one', author: 'writer-a', topic: 'topic-technology', hoursAgo: 1, likes: 100 }),
      post({ id: 'writer-a-two', author: 'writer-a', topic: 'topic-technology', hoursAgo: 2, likes: 90 }),
      post({ id: 'writer-b', author: 'writer-b', topic: 'topic-design', hoursAgo: 10, likes: 10 }),
      post({ id: 'writer-c', author: 'writer-c', topic: 'topic-literature', hoursAgo: 12, likes: 5 }),
    ],
    relevantIds: ['writer-a-one', 'writer-b', 'writer-c'],
    limit: 4,
  },
];
