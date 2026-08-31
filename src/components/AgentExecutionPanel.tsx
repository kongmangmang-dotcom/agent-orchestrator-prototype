import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { AgentExecution, FileChange } from '../data/mock'
import { Badge, Btn, StatusDot } from './ui'
import { ChatBubble } from './ChatBubble'
import { AgentCommandInput } from './AgentCommandInput'
import { useAgentMessages } from '../hooks/useAgentMessages'
import { X, ExternalLink, MessageSquare, FileDiff, List, ChevronDown, ChevronRight } from 'lucide-react'

type Tab = 'chat' | 'files' | 'logs'

const CODING_PROVIDERS = ['Codex', 'Cursor', 'OpenCode']

function defaultTab(provider: string, fileCount: number): Tab {
  if (CODING_PROVIDERS.includes(provider) && fileCount > 0) return 'chat'
  return 'chat'
}

function FileDiffBlock({ file, expanded, onToggle }: { file: FileChange; expanded: boolean; onToggle: () => void }) {
  const actionLabel = { created: '新增', modified: '修改', deleted: '删除' }[file.action]
  const actionVariant = { created: 'success' as const, modified: 'info' as const, deleted: 'danger' as const }[file.action]

  return (
    <div className="rounded-lg border border-border-subtle overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface-2 hover:bg-surface-3 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-text-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />}
        <FileDiff className="w-4 h-4 text-text-muted shrink-0" />
        <span className="font-mono text-xs text-text truncate flex-1">{file.path}</span>
        <Badge variant={actionVariant}>{actionLabel}</Badge>
        <span className="font-mono text-xs text-success shrink-0">{file.lines}</span>
      </button>
      {expanded && file.diff && (
        <pre className="px-4 py-3 font-mono text-xs leading-relaxed overflow-x-auto border-t border-border-subtle bg-surface-inset">
          {file.diff.split('\n').map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('+') ? 'text-success' :
                line.startsWith('-') ? 'text-danger' :
                'text-text-muted'
              }
            >
              {line || ' '}
            </div>
          ))}
        </pre>
      )}
    </div>
  )
}

interface AgentExecutionPanelProps {
  execution: AgentExecution | null
  stepLabel: string
  onClose: () => void
}

export function AgentExecutionPanel({ execution, stepLabel, onClose }: AgentExecutionPanelProps) {
  const [tab, setTab] = useState<Tab>('chat')
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const isRunning = execution?.status === 'running'
  const { messages, sendCorrection } = useAgentMessages(execution?.messages ?? [], execution?.runId)

  useEffect(() => {
    if (!execution) return
    setTab(defaultTab(execution.provider, execution.fileChanges.length))
    setExpandedFile(execution.fileChanges[0]?.path ?? null)
  }, [execution?.runId])

  useEffect(() => {
    if (tab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, tab])

  const handleSend = (text: string) => {
    sendCorrection(text, !!isRunning)
    setTab('chat')
  }

  if (!execution) {
    return (
      <aside className="w-[460px] shrink-0 border-l border-border-subtle bg-surface-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-10 text-center">
          <div>
            <MessageSquare className="w-10 h-10 text-text-muted/30 mx-auto mb-4" />
            <div className="text-sm text-text-muted mb-2">点击流程图节点</div>
            <div className="text-xs text-text-muted/80 leading-relaxed max-w-[240px]">
              查看对话、文件变更；运行中可随时发送纠正指令
            </div>
          </div>
        </div>
      </aside>
    )
  }

  const tabs: { id: Tab; label: string; icon: typeof MessageSquare; count?: number }[] = [
    { id: 'chat', label: '对话', icon: MessageSquare, count: messages.length },
    { id: 'files', label: '文件', icon: FileDiff, count: execution.fileChanges.length },
    { id: 'logs', label: '日志', icon: List, count: execution.events.length },
  ]

  return (
    <aside className="w-[460px] shrink-0 border-l border-border-subtle bg-surface-1 flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
        <div>
          <div className="text-base font-medium text-text-strong">{stepLabel}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs text-text-muted">{execution.agentName}</span>
            <Badge>{execution.provider}</Badge>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 px-5 py-3 border-b border-border-subtle shrink-0">
        <StatusDot status={isRunning ? 'running' : execution.status === 'completed' ? 'connected' : 'idle'} />
        <span className="text-xs text-text-muted">
          {execution.duration} · {execution.tokens.toLocaleString()} tokens
        </span>
      </div>

      <div className="flex border-b border-border-subtle shrink-0 px-2">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          const disabled = t.id === 'files' && t.count === 0
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                active ? 'border-accent text-text-strong' : 'border-transparent text-text-muted hover:text-text'
              } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${active ? 'bg-accent/15 text-accent' : 'bg-surface-3'}`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'chat' && (
          <div className="p-5 space-y-5">
            {messages.length === 0 ? (
              <div className="text-sm text-text-muted text-center py-12">暂无对话记录</div>
            ) : (
              messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {tab === 'files' && (
          <div className="p-5 space-y-3">
            {execution.fileChanges.length === 0 ? (
              <div className="text-sm text-text-muted text-center py-12">该 Agent 未修改文件</div>
            ) : (
              execution.fileChanges.map(f => (
                <FileDiffBlock
                  key={f.path}
                  file={f}
                  expanded={expandedFile === f.path}
                  onToggle={() => setExpandedFile(expandedFile === f.path ? null : f.path)}
                />
              ))
            )}
            {execution.commandOutput && (
              <div className="mt-6 pt-5 border-t border-border-subtle">
                <div className="text-xs uppercase tracking-wider text-text-muted mb-3">命令输出</div>
                <pre className="p-4 rounded-lg bg-surface-inset font-mono text-xs text-text leading-relaxed overflow-x-auto">
                  {execution.commandOutput}
                </pre>
              </div>
            )}
          </div>
        )}

        {tab === 'logs' && (
          <div className="p-5">
            <div className="relative pl-5 border-l border-border space-y-5">
              {execution.events.map((ev, i) => (
                <div key={i} className="relative">
                  <span className={`absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full border-2 border-surface-1 ${
                    ev.status === 'running' ? 'bg-accent animate-pulse-dot' : 'bg-border'
                  }`} />
                  <div className="text-[11px] font-mono text-text-muted">{new Date(ev.timestamp).toLocaleTimeString('zh-CN')}</div>
                  <div className="text-sm text-text mt-1 leading-relaxed">{ev.content}</div>
                  {ev.metadata && (
                    <div className="font-mono text-[11px] text-text-muted mt-1">
                      {Object.entries(ev.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AgentCommandInput
        disabled={!isRunning}
        disabledReason={!isRunning ? '该步骤未在运行中，无法发送纠正指令' : undefined}
        onSend={handleSend}
      />

      <div className="px-5 py-4 border-t border-border-subtle shrink-0">
        <Link to={`/runs?run=${execution.runId}`}>
          <Btn variant="secondary" size="sm">
            <ExternalLink className="w-3.5 h-3.5" />
            打开完整运行监控
          </Btn>
        </Link>
      </div>
    </aside>
  )
}
