import { useQuery } from "@tanstack/react-query";
import { useSelector } from 'react-redux'
import fetchPost from "../api/fetchPost";

export const postQueryOptions = (postId, user) => ({
    queryKey: ['post', postId, user || 'anonymous'],
    queryFn: fetchPost,
    retry: 1,
})

export default function useFetchPost(postId) {
    const user = useSelector(state => state.auth.user)
    const isAuthReady = useSelector(state => state.auth.isReady)

    return useQuery({
        ...postQueryOptions(postId, user),
        // The detail response includes reader-specific like/save state. Split
        // the cache by authentication so a public request made during session
        // restoration cannot remain authoritative after the refresh succeeds.
        // Article responses include reader-specific save and appreciation state.
        // Wait for refresh-cookie restoration so a reload cannot settle the
        // detail query with the anonymous representation first.
        enabled: Boolean(postId) && isAuthReady,
    })
}
