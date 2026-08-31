import { useState, useEffect, useCallback } from 'react'
import type { ChatMessage } from '../data/mock'

export function useAgentMessages(baseMessages: ChatMessage[], runId: string | undefined) {
  const [extra, setExtra] = useState<ChatMessage[]>([])

  useEffect(() => {
    setExtra([])
  }, [runId])

  const sendCorrection = useCallback((text: string, isRunning: boolean) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }
    setExtra(prev => [...prev, userMsg])

    if (isRunning) {
      setTimeout(() => {
        setExtra(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: '已收到纠正指令，正在中断当前步骤并按新方向继续执行。',
            timestamp: new Date().toISOString(),
          },
        ])
      }, 500)
    }
  }, [])

  return {
    messages: [...baseMessages, ...extra],
    sendCorrection,
  }
}
