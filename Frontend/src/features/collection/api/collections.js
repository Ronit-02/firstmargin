import api from '@/app/api'

export async function fetchCollections({ mine, saved, authorId, sort, cursor, postId }) {
  const response = await api.get('/api/collection', { params: { mine: mine || undefined, saved: saved || undefined, authorId: authorId || undefined, sort: sort || undefined, cursor: cursor || undefined, postId: postId || undefined, limit: 12 } })
  return response.data
}

export async function fetchCollection(id) {
  return (await api.get(`/api/collection/${id}`)).data.data
}

export async function fetchCollectionEligiblePosts() {
  return (await api.get('/api/collection/eligible-posts')).data.data
}

export async function createCollection(input) {
  return (await api.post('/api/collection', input)).data.data
}

export async function addCollectionPost({ collectionId, postId }) {
  return (await api.put(`/api/v1/collections/${collectionId}/posts/${postId}`)).data.data
}

export async function updateCollection({ collectionId, ...input }) {
  return (await api.put(`/api/collection/${collectionId}`, input)).data.data
}

export async function uploadCollectionCover({ collectionId, file }) {
  const formData = new FormData()
  formData.append('coverImage', file)
  return (await api.post(`/api/collection/${collectionId}/cover`, formData)).data.data
}

export async function deleteCollection(collectionId) {
  return (await api.delete(`/api/collection/${collectionId}`)).data.data
}

export async function updateCollectionSave({ collectionId, isSaved }) {
  return (await api({ method: isSaved ? 'put' : 'delete', url: `/api/collection/${collectionId}/save` })).data.data
}

export async function updateCollectionFollow({ collectionId, isFollowing }) {
  return (await api({ method: isFollowing ? 'put' : 'delete', url: `/api/collection/${collectionId}/follow` })).data.data
}
