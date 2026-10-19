import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { fetchEntitlements } from '../api/membership'

export const entitlementKey = ['me', 'entitlements']

export default function useEntitlements(enabled = true, { fresh = false } = {}) {
  const account = useSelector(state => state.auth.email || state.auth.user)
  return useQuery({
    queryKey: [...entitlementKey, account],
    queryFn: fetchEntitlements,
    enabled,
    staleTime: fresh ? 0 : 5 * 60 * 1000,
    refetchOnMount: fresh ? 'always' : true,
    retry: 1,
  })
}
