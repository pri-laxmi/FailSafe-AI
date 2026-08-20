import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'

type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: string; httpStatus?: number }
  | { status: 'success'; data: T }

/** Small framework-light fetch hook: loading/error/success + manual reload. */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    fetcherRef
      .current()
      .then((data) => setState({ status: 'success', data }))
      .catch((error: unknown) =>
        setState({
          status: 'error',
          error: error instanceof ApiError ? error.message : 'Something went wrong.',
          httpStatus: error instanceof ApiError ? error.status : undefined,
        }),
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    reload()
  }, [reload])

  return { ...state, reload }
}
