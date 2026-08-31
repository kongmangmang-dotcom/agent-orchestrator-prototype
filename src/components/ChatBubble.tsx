import type { ChatMessage } from '../data/mock'
import { Loader2, Wrench } from 'lucide-react'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function ChatBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'thinking') {
    return (
      <div className="px-4 py-3 rounded-lg bg-surface-2 border border-border-subtle border-dashed">
        <div className="text-[11px] text-text-muted mb-1.5 flex items-center gap-1">
          <Loader2 className="w-3 h-3" />思考中
        </div>
        <div className="text-sm text-text-muted italic leading-relaxed">{msg.content}</div>
      </div>
    )
  }

  const isUser = msg.role === 'user'
  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[92%] px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-accent/10 text-text-strong rounded-br-sm'
          : 'bg-surface-1 text-text rounded-bl-sm border border-border-subtle shadow-sm'
      }`}>
        {msg.content}
        {msg.streaming && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-accent animate-pulse align-middle" />
        )}
      </div>
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-w-[92%]">
          {msg.toolCalls.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono bg-surface-2 text-text-muted border border-border-subtle">
              <Wrench className="w-3 h-3" />
              {t.name}({t.args})
            </span>
          ))}
        </div>
      )}
      <span className="text-[11px] text-text-muted px-1">{formatTime(msg.timestamp)}</span>
    </div>
  )
}
