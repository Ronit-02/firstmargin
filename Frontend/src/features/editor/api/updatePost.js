import api from '@/app/api'

export const updatePost = async ({ postId, formData, ...input }) => (await api.put(`/api/post/${postId}`, formData || input)).data
