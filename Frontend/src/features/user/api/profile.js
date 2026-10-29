import api from '@/app/api'

export const fetchMyProfile = async () => (await api.get('/api/user/me')).data.data
export const fetchMyPosts = async () => (await api.get('/api/user/me/posts')).data.data
export const fetchBookmarks = async () => (await api.get('/api/user/bookmarks')).data
export const fetchWriterAnalytics = async () => (await api.get('/api/user/analytics')).data.data
export const updateMyProfile = async input => (await api.put('/api/user/profile', input)).data.profile
export const updateMyProfilePicture = async image => {
  const body = new FormData()
  if (image === null) body.append('removeAvatar', 'true')
  else if (typeof image === 'string') body.append('avatarUrl', image)
  else body.append('avatar', image)
  return (await api.put('/api/user/profile/avatar', body)).data.profile
}
export const updateMyProfileCover = async image => {
  const body = new FormData()
  if (image === null) body.append('removeCover', 'true')
  else if (typeof image === 'string') body.append('coverImageUrl', image)
  else body.append('coverImage', image)
  return (await api.put('/api/user/profile/cover', body)).data.profile
}
export const setPostPublication = async ({ postId, status }) => (await api.patch(`/api/post/${postId}/publication`, { status })).data.data
export const deletePost = async postId => { await api.delete(`/api/v1/posts/${postId}`) }
