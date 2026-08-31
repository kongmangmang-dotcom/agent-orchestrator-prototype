import { useCallback, useEffect, useState } from 'react'
import {
  cancelRun,
  getRun,
  getRunEvents,
  getRunFiles,
  getRunMessages,
  injectRunMessage,
  streamRunEvents,
  type ApiFileChange,
  type ApiRun,
  type ApiRunEvent,
  type ApiRunMessage,
} from '../api/runs'

export function useLiveRun(runId: string | null) {
  const [run, setRun] = useState<ApiRun | null>(null)
  const [messages, setMessages] = useState<ApiRunMessage[]>([])
  const [events, setEvents] = useState<ApiRunEvent[]>([])
  const [files, setFiles] = useState<ApiFileChange[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!runId) return
    setLoading(true)
    setError(null)
    try {
      const [r, m, e, f] = await Promise.all([
        getRun(runId),
        getRunMessages(runId),
        getRunEvents(runId),
        getRunFiles(runId),
      ])
      setRun(r)
      setMessages(m.items)
      setEvents(e.items)
      setFiles(f.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [runId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!runId) return
    const es = streamRunEvents(runId, () => {
      refresh()
    })
    return () => es.close()
  }, [runId, refresh])

  const sendCorrection = useCallback(
    async (content: string) => {
      if (!runId || !content.trim()) return
      await injectRunMessage(runId, content.trim())
      await refresh()
    },
    [runId, refresh],
  )

  const cancel = useCallback(async () => {
    if (!runId) return
    await cancelRun(runId)
    await refresh()
  }, [runId, refresh])

  return {
    run,
    messages,
    events,
    files,
    loading,
    error,
    refresh,
    sendCorrection,
    cancel,
    isRunning: run?.status === 'running',
  }
}
