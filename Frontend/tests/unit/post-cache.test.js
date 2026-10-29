import test from 'node:test'
import assert from 'node:assert/strict'
import { updatePostCacheValue } from '../../src/features/post/hooks/postCache.js'

test('story cache traverses every summary shape without changing competition votes or the input', () => {
  const id = 'story-one'
  const base = { id, _id: id, likesCount: 3, isLiked: false, isBookmarked: false }
  const entry = { id, likesCount: 27, isVoted: true, post: base }
  const input = { pages: [{ data: [{ responsePosts: [base] }] }], data: { posts: [base], shorts: [base] }, history: [base], continueReading: [base], entries: [entry, base] }
  const result = updatePostCacheValue(input, id, post => ({ ...post, isLiked: true, isBookmarked: true, likesCount: 4 }))
  for (const post of [result.pages[0].data[0].responsePosts[0], result.data.posts[0], result.data.shorts[0], result.history[0], result.continueReading[0], result.entries[0].post, result.entries[1]]) {
    assert.equal(post.isLiked, true)
    assert.equal(post.isBookmarked, true)
    assert.equal(post.likesCount, 4)
  }
  assert.equal(result.entries[0].likesCount, 27)
  assert.equal(result.entries[0].isVoted, true)
  assert.equal(input.history[0].isLiked, false)
  assert.equal(input.entries[0].likesCount, 27)
})
