import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addCollectionPost, createCollection, deleteCollection, fetchCollection, fetchCollectionEligiblePosts, fetchCollections, updateCollection, updateCollectionFollow, updateCollectionSave, uploadCollectionCover } from '../api/collections'
import useToast from '@/shared/hooks/useToast'
import { useSelector } from 'react-redux'

export const useCollectionChoices = (selected = true, postId = '') => {
  const user = useSelector(state => state.auth.user)
  const ready = useSelector(state => state.auth.isReady)
  return useInfiniteQuery({
    queryKey: ['collections', 'choices', user, postId],
    queryFn: ({ pageParam }) => fetchCollections({ mine: true, cursor: pageParam, postId }),
    initialPageParam: null,
    getNextPageParam: page => page.meta.nextCursor || undefined,
    enabled: ready && Boolean(user) && selected,
  })
}

export const useCollections = (mine, sort) => {
  const { user, isReady } = useSelector(state => state.auth)
  return useInfiniteQuery({
    queryKey: ['collections', mine ? 'mine' : 'public', sort || 'latest', mine ? user : 'public'],
    queryFn: ({ pageParam }) => fetchCollections({ mine, sort, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: page => page.meta.nextCursor || undefined,
    enabled: !mine || (isReady && Boolean(user)),
  })
}

export const useAuthorCollections = (authorId, sort, enabled) => {
  const { user, isReady } = useSelector(state => state.auth)
  return useInfiniteQuery({
    queryKey: ['collections', 'author', authorId, sort || 'latest', user || 'anonymous'],
    queryFn: ({ pageParam }) => fetchCollections({ authorId, sort, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: page => page.meta.nextCursor || undefined,
    enabled: isReady && Boolean(authorId) && enabled,
  })
}

export const useSavedCollections = sort => {
  const { user, isReady } = useSelector(state => state.auth)
  return useInfiniteQuery({
    queryKey: ['collections', 'saved', sort || 'latest', user],
    queryFn: ({ pageParam }) => fetchCollections({ saved: true, sort, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: page => page.meta.nextCursor || undefined,
    enabled: isReady && Boolean(user),
  })
}

export const useCollection = id => {
  const { user, isReady } = useSelector(state => state.auth)
  return useQuery({ queryKey: ['collection', id, user || 'anonymous'], queryFn: () => fetchCollection(id), enabled: Boolean(id) && isReady })
}
export const useAddCollectionPost = () => {
  const client = useQueryClient()
  const { notify } = useToast()
  return useMutation({ mutationFn: addCollectionPost, onSuccess: async (data, { collectionId }) => {
    await Promise.all([client.invalidateQueries({ queryKey: ['collections'] }), client.invalidateQueries({ queryKey: ['collection', collectionId] })])
    notify(data.added ? 'Story added to collection.' : 'This story is already in the collection.', { tone: data.added ? 'success' : 'info' })
  } })
}
export const useCollectionEligiblePosts = enabled => {
  const { user, isReady } = useSelector(state => state.auth)
  return useQuery({ queryKey: ['collection-eligible-posts', user], queryFn: fetchCollectionEligiblePosts, enabled: enabled && isReady && Boolean(user) })
}
export const useCreateCollection = ({ successMessage = 'Collection created.' } = {}) => {
  const client = useQueryClient()
  const { notify } = useToast()
  return useMutation({ mutationFn: createCollection, onSuccess: () => { client.invalidateQueries({ queryKey: ['collections'] }); notify(successMessage) }, onError: () => notify('The collection could not be created.', { tone: 'error' }) })
}
export const useCollectionSave = collectionId => {
  const client = useQueryClient()
  const { notify } = useToast()
  return useMutation({ mutationFn: isSaved => updateCollectionSave({ collectionId, isSaved }), onSuccess: async (_, isSaved) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['collection', collectionId] }),
      client.invalidateQueries({ queryKey: ['collections'] }),
    ])
    notify(isSaved ? 'Collection saved.' : 'Collection removed from saved.')
  }, onError: () => notify('The collection save could not be updated.', { tone: 'error' }) })
}
export const useUpdateCollection = collectionId => {
  const client = useQueryClient()
  const { notify } = useToast()
  return useMutation({ mutationFn: input => updateCollection({ collectionId, ...input }), onSuccess: () => {
    client.invalidateQueries({ queryKey: ['collection', collectionId] })
    client.invalidateQueries({ queryKey: ['collections'] })
    notify('Collection updated.')
  }, onError: () => notify('The collection could not be updated.', { tone: 'error' }) })
}
export const useUploadCollectionCover = collectionId => {
  const client = useQueryClient()
  const { notify } = useToast()
  return useMutation({ mutationFn: file => uploadCollectionCover({ collectionId, file }), onSuccess: () => { client.invalidateQueries({ queryKey: ['collection', collectionId] }); client.invalidateQueries({ queryKey: ['collections'] }); notify('Collection image updated.') }, onError: () => notify('Cover image can’t be uploaded right now. The default cover is being used.', { tone: 'error' }) })
}
export const useDeleteCollection = collectionId => {
  const client = useQueryClient()
  const { notify } = useToast()
  return useMutation({ mutationFn: () => deleteCollection(collectionId), onSuccess: () => {
    client.invalidateQueries({ queryKey: ['collections'] })
    client.removeQueries({ queryKey: ['collection', collectionId] })
    notify('Collection deleted.')
  }, onError: () => notify('The collection could not be deleted.', { tone: 'error' }) })
}
export const useCollectionFollow = collectionId => {
  const client = useQueryClient()
  const { notify } = useToast()
  return useMutation({ mutationFn: isFollowing => updateCollectionFollow({ collectionId, isFollowing }), onSuccess: (_, isFollowing) => {
    client.invalidateQueries({ queryKey: ['collection', collectionId] })
    client.invalidateQueries({ queryKey: ['collections'] })
    notify(isFollowing ? 'Collection followed.' : 'Collection unfollowed.')
  }, onError: () => notify('The collection follow status could not be updated.', { tone: 'error' }) })
}
