import api from '@/app/api'

export const fetchReports = async status => (await api.get('/api/staff/reports', { params: { status } })).data.data
export const reviewReport = async ({ reportId, ...input }) => (await api.post(`/api/staff/reports/${reportId}/reviews`, input)).data.data
const competitionPayload = input => {
  const body = new FormData()
  for (const key of ['title', 'description', 'coverImage', 'openDate', 'closeDate', 'competitionType']) {
    if (input[key] !== undefined) body.append(key, input[key])
  }
  body.append('rules', JSON.stringify(input.rules))
  if (input.coverImageFile) body.append('coverImageFile', input.coverImageFile)
  return body
}
export const createCompetition = async input => (await api.post('/api/competition', competitionPayload(input))).data.data
export const updateCompetition = async ({ id, ...input }) => (await api.patch(`/api/competition/${id}`, competitionPayload(input))).data.data
export const scoreCompetitionEntry = async ({ competitionId, entryId, ...input }) => (await api.put(`/api/competition/${competitionId}/entries/${entryId}/score`, input)).data.data
export const fetchStaffUsers = async ({ role, page }) => (await api.get('/api/staff/users', { params: { role, page } })).data
export const changeStaffUserRole = async ({ userId, role }) => (await api.patch(`/api/staff/users/${userId}/role`, { role })).data.data
