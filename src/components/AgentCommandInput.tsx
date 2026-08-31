import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send, CornerDownLeft } from 'lucide-react'
import { Btn } from './ui'

const QUICK_HINTS = [
  '先停止当前测试',
  'LoginRequest 改用 record 类型',
  '不要修改 router，只改 LoginView',
  '补充错误处理和边界校验',
]

interface AgentCommandInputProps {
  disabled?: boolean
  disabledReason?: string
  onSend: (text: string) => void
}

export function AgentCommandInput({ disabled, disabledReason, onSend }: AgentCommandInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  const submit = () => {
    if (disabled || !text.trim()) return
    onSend(text)
    setText('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-border-subtle bg-surface-1 shrink-0">
      {!disabled && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {QUICK_HINTS.map(hint => (
            <button
              key={hint}
              type="button"
              onClick={() => setText(hint)}
              className="px-2.5 py-1 rounded-full text-[11px] text-text-muted bg-surface-2 border border-border-subtle hover:border-border hover:text-text transition-colors"
            >
              {hint}
            </button>
          ))}
        </div>
      )}

      <div className="p-4">
        {disabled && disabledReason && (
          <p className="text-[11px] text-text-muted mb-2">{disabledReason}</p>
        )}
        <div className={`flex gap-2 items-end rounded-lg border p-2 transition-colors ${
          disabled ? 'border-border-subtle bg-surface-2 opacity-60' : 'border-border bg-surface-1 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20'
        }`}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={2}
            placeholder={disabled ? '任务未运行，无法发送纠正指令' : '输入纠正指令或补充要求… Enter 发送，Shift+Enter 换行'}
            className="flex-1 resize-none bg-transparent text-sm text-text-strong placeholder:text-text-muted/60 focus:outline-none min-h-[44px] max-h-32 leading-relaxed"
          />
          <Btn variant="primary" size="sm" onClick={submit} disabled={disabled || !text.trim()}>
            <Send className="w-3.5 h-3.5" />
            发送
          </Btn>
        </div>
        {!disabled && (
          <p className="mt-2 text-[10px] text-text-muted flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" />
            运行中可随时发送，Agent 会中断当前步骤并按新指令调整
          </p>
        )}
      </div>
    </div>
  )
}
