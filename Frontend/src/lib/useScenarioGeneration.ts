import { useCallback, useEffect, useRef, useState } from 'react'
import { startScenarioGeneration, getGenerationJob } from '../api/scenarios'
import { ApiError } from '../api/client'
import type { GenerationJob } from './types'

const POLL_INTERVAL_MS = 1500

/** Starts a scenario-generation job and polls it to completion, exposing
 * live per-batch progress instead of one long blocking request. */
export function useScenarioGeneration(onComplete: () => void) {
  const [job, setJob] = useState<GenerationJob | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  const start = useCallback(async () => {
    setStartError(null)
    stopPolling()
    try {
      const initial = await startScenarioGeneration()
      setJob(initial)

      intervalRef.current = setInterval(async () => {
        try {
          const next = await getGenerationJob(initial.id)
          setJob(next)
          if (next.status === 'completed' || next.status === 'failed') {
            stopPolling()
            if (next.status === 'completed') onCompleteRef.current()
          }
        } catch (error) {
          stopPolling()
          setJob((current) =>
            current
              ? { ...current, status: 'failed', error: error instanceof ApiError ? error.message : 'Lost connection while generating scenarios.' }
              : current,
          )
        }
      }, POLL_INTERVAL_MS)
    } catch (error) {
      setStartError(error instanceof ApiError ? error.message : 'Could not start scenario generation.')
    }
  }, [stopPolling])

  const isRunning = job !== null && (job.status === 'queued' || job.status === 'running')

  return { job, startError, isRunning, start }
}
