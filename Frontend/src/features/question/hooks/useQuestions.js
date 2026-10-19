import { useSelector } from 'react-redux'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createQuestion, createQuestionAnswer, declineQuestion, fetchQuestion, fetchQuestionOpportunities, fetchQuestions, linkQuestionResponse, reportAnswer, reportQuestion, suggestQuestions, updateAnswerUpvote, updateQuestionClaim, updateQuestionFollow, updateQuestionUpvote } from '../api/questions'
import useToast from '@/shared/hooks/useToast'

export function useQuestions(sort) {
  const { user, isReady } = useSelector(state => state.auth)
  return useInfiniteQuery({
    queryKey: ['questions', sort, user || 'anonymous'],
    enabled: isReady,
    queryFn: ({ pageParam }) => fetchQuestions({ sort, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: page => page.meta.nextCursor || undefined,
  })
}

export function useQuestion(questionId) {
  const { user, isReady } = useSelector(state => state.auth)
  return useQuery({ queryKey: ['question', questionId, user || 'anonymous'], queryFn: () => fetchQuestion(questionId), enabled: Boolean(questionId) && isReady })
}

export function useQuestionOpportunities() {
  return useQuery({ queryKey: ['question-opportunities'], queryFn: fetchQuestionOpportunities, staleTime: 30_000 })
}

export function useQuestionClaim() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['question-opportunities'] })
  return {
    claim: useMutation({ mutationFn: updateQuestionClaim, onSuccess: data => { refresh(); notify(data.isClaimed ? 'Question claimed.' : 'Question released.') }, onError: error => notify(error?.response?.data?.message || 'The claim could not be updated.', { tone: 'error' }) }),
    decline: useMutation({ mutationFn: declineQuestion, onSuccess: () => { refresh(); notify('Question removed from your opportunities.') }, onError: () => notify('The question could not be declined.', { tone: 'error' }) }),
  }
}

export function useQuestionSuggestions(query) {
  return useQuery({
    queryKey: ['question-suggestions', query.trim()],
    queryFn: () => suggestQuestions(query.trim()),
    enabled: query.trim().length >= 4,
    staleTime: 30_000,
  })
}

export function useCreateQuestion() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: createQuestion,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['questions'] }); notify('Question posted.') },
    onError: () => notify('The question could not be posted.', { tone: 'error' }),
  })
}

export function useQuestionUpvote(sort) {
  const queryClient = useQueryClient()
  const user = useSelector(state => state.auth.user)
  const { notify } = useToast()
  return useMutation({
    mutationFn: updateQuestionUpvote,
    onMutate: async ({ questionId, isUpvoted }) => {
      const key = ['questions', sort, user || 'anonymous']
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, old => old ? {
        ...old,
        pages: old.pages.map(page => ({ ...page, data: page.data.map(question => question.id === questionId ? {
          ...question, isUpvoted, upvotesCount: Math.max(0, question.upvotesCount + (isUpvoted ? 1 : -1)),
        } : question) })),
      } : old)
      return { previous, key }
    },
    onSuccess: async (data, { questionId, isUpvoted }, context) => {
      queryClient.setQueryData(context.key, old => old ? {
        ...old,
        pages: old.pages.map(page => ({ ...page, data: page.data.map(question => question.id === questionId ? { ...question, ...data } : question) })),
      } : old)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['question', questionId] }),
        queryClient.invalidateQueries({ queryKey: ['discovery-search'], predicate: query => query.queryKey[2] === 'questions' }),
      ])
      notify(isUpvoted ? 'Question upvoted.' : 'Question upvote removed.')
    },
    onError: (error, variables, context) => { if (context?.previous) queryClient.setQueryData(context.key, context.previous); notify('The question vote could not be updated.', { tone: 'error' }) },
  })
}

export function useQuestionAnswer(questionId) {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: createQuestionAnswer,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['question', questionId] }); queryClient.invalidateQueries({ queryKey: ['questions'] }); notify('Answer posted.') },
    onError: error => notify(error?.response?.data?.message || 'The answer could not be posted.', { tone: 'error' }),
  })
}

export function useLinkQuestionResponse(questionId) {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: postId => linkQuestionResponse({ questionId, postId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['question', questionId] }); queryClient.invalidateQueries({ queryKey: ['questions'] }); notify('Post attached to the question.') },
    onError: error => notify(error?.response?.data?.message || 'The post could not be attached.', { tone: 'error' }),
  })
}

export function useAnswerUpvote(questionId) {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: updateAnswerUpvote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['question', questionId] }),
    onError: () => notify('The answer vote could not be updated.', { tone: 'error' }),
  })
}

export function useQuestionFollow(questionId) {
  const queryClient = useQueryClient()
  const user = useSelector(state => state.auth.user)
  const { notify } = useToast()
  return useMutation({
    mutationFn: updateQuestionFollow,
    onSuccess: data => { queryClient.setQueryData(['question', questionId, user || 'anonymous'], old => old ? { ...old, ...data } : old); notify(data.isFollowing ? 'Question followed.' : 'Question unfollowed.') },
    onError: () => notify('The question follow state could not be updated.', { tone: 'error' }),
  })
}

export function useQuestionReport() {
  const { notify } = useToast()
  return useMutation({ mutationFn: reportQuestion, onSuccess: data => notify(data.alreadyReported ? 'You already reported this question.' : 'Question report submitted.'), onError: error => notify(error?.response?.data?.message || 'The question report could not be submitted.', { tone: 'error' }) })
}

export function useAnswerReport() {
  const { notify } = useToast()
  return useMutation({ mutationFn: reportAnswer, onSuccess: data => notify(data.alreadyReported ? 'You already reported this answer.' : 'Answer report submitted.'), onError: error => notify(error?.response?.data?.message || 'The answer report could not be submitted.', { tone: 'error' }) })
}
