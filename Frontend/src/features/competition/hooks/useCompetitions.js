import { useSelector } from 'react-redux'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCompetition, fetchCompetitions, fetchEligiblePosts, submitEntry, removeEntry, updateEntryVote } from '../api/competitions'
import useToast from '@/shared/hooks/useToast'

export const useCompetitions = () => useQuery({ queryKey: ['competitions'], queryFn: fetchCompetitions })
export const useCompetition = id => {
  const { user, isReady } = useSelector(state => state.auth)
  return useQuery({ queryKey: ['competition', id, user || 'anonymous'], queryFn: () => fetchCompetition(id), enabled: Boolean(id) && isReady })
}
export const useEligiblePosts = (id, enabled) => useQuery({ queryKey: ['competition-eligible-posts', id], queryFn: () => fetchEligiblePosts(id), enabled })
export const useRemoveEntry = id => {
  const client = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: entryId => removeEntry({ competitionId: id, entryId }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['competition', id] }),
        client.invalidateQueries({ queryKey: ['competitions'] }),
        client.invalidateQueries({ queryKey: ['competition-eligible-posts', id] }),
      ])
      notify('Your competition entry was removed.')
    },
  })
}
export const useSubmitEntry = id => { const client = useQueryClient(); const { notify } = useToast(); return useMutation({ mutationFn: body => submitEntry({ competitionId: id, ...body }), onSuccess: () => { client.invalidateQueries({ queryKey: ['competition', id] }); notify('Competition entry submitted.') }, onError: () => notify('The competition entry could not be submitted.', { tone: 'error' }) }) }
export const useEntryVote = id => { const client = useQueryClient(); const { notify } = useToast(); return useMutation({ mutationFn: input => updateEntryVote({ competitionId: id, ...input }), onSuccess: (_, input) => { client.invalidateQueries({ queryKey: ['competition', id] }); notify(input.isVoted ? 'Vote recorded.' : 'Vote removed.') }, onError: () => notify('The competition vote could not be updated.', { tone: 'error' }) }) }
