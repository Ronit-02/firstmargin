import api from '@/app/api'

export const fetchWorkshops = async () => (await api.get('/api/v1/workshops')).data.data
export const fetchMyWorkshops = async () => (await api.get('/api/v1/workshops/mine')).data.data
export const createWorkshop = async input => (await api.post('/api/v1/workshops', input)).data.data
export const registerWorkshop = async workshopId => (await api.put(`/api/v1/workshops/${workshopId}/registration`)).data.data
export const fetchCreatorUpdates = async () => (await api.get('/api/v1/creator-updates')).data.data
export const fetchMyCreatorUpdates = async () => (await api.get('/api/v1/creator-updates/mine')).data.data
export const publishCreatorUpdate = async input => (await api.post('/api/v1/creator-updates', input)).data.data
export const fetchReceivedRequests = async () => (await api.get('/api/v1/creator-requests/received')).data.data
export const updateReceivedRequest = async ({ requestId, ...input }) => (await api.patch(`/api/v1/creator-requests/${requestId}`, input)).data.data
export const sendCreatorRequest = async ({ creatorId, ...input }) => (await api.post(`/api/v1/creators/${creatorId}/requests`, input)).data
export const fetchEarlyAccess = async () => (await api.get('/api/post/early-access')).data.data
