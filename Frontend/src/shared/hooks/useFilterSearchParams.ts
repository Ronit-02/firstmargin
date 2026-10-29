import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

type UpdateParams = URLSearchParams | ((current: URLSearchParams) => URLSearchParams)

/** Keep page selections in browser history without discarding an existing anchor. */
export default function useFilterSearchParams() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const setParams = (update: UpdateParams) => {
    const next = typeof update === 'function' ? update(new URLSearchParams(params)) : update
    const search = next.size ? `?${next}` : ''
    if (search === location.search) return
    navigate({ search, hash: location.hash }, { preventScrollReset: true })
  }
  return [params, setParams] as const
}
