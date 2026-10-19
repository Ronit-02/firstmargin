import { useMutation } from '@tanstack/react-query'
import { openBillingPortal } from '../api/membership'

export default function useManageMembership() {
  return useMutation({
    mutationFn: openBillingPortal,
    onSuccess: data => window.location.assign(data.portalUrl),
  })
}
