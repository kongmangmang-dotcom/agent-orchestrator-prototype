import { useLiveRun } from '../hooks/useLiveRun'
import { Badge, Btn, StatusDot } from './ui'
import { ChatBubble } from './ChatBubble'
import { AgentCommandInput } from './AgentCommandInput'
import { MessageSquare, FileDiff, List, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ApiFileChange } from '../api/runs'

type Tab = 'chat' | 'files' | 'logs'

function FileDiffBlock({ file, expanded, onToggle }: { file: ApiFileChange; expanded: boolean; onToggle: () => void }) {
  const actionLabel = { created: '新增', modified: '修改', deleted: '删除' }[file.action] ?? file.action
  const actionVariant = { created: 'success' as const, modified: 'info' as const, deleted: 'danger' as const }[file.action] ?? 'default' as const

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
        <span className="font-mono text-xs text-success shrink-0">{file.lines_summary}</span>
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

export function LiveRunPanel({ runId }: { runId: string }) {
  const { run, messages, events, files, loading, error, sendCorrection, cancel, isRunning } = useLiveRun(runId)
  const [tab, setTab] = useState<Tab>('chat')
  const [expandedFile, setExpandedFile] = useState<string | null>(null)

  if (loading && !run) {
    return <div className="p-10 text-sm text-text-muted">加载 Run…</div>
  }

  if (error) {
    return <div className="p-10 text-sm text-danger">{error}</div>
  }

  if (!run) {
    return <div className="p-10 text-sm text-text-muted">Run 不存在</div>
  }

  const tabs: { id: Tab; label: string; icon: typeof MessageSquare; count?: number }[] = [
    { id: 'chat', label: '对话', icon: MessageSquare, count: messages.length },
    { id: 'files', label: '文件', icon: FileDiff, count: files.length },
    { id: 'logs', label: '日志', icon: List, count: events.length },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
        <div>
          <div className="text-base font-medium text-text-strong">{run.agent_name ?? run.agent_id}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs text-text-muted">{run.id}</span>
            <Badge>{run.provider_name ?? run.provider_kind}</Badge>
            <Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'accent'}>
              {run.status}
            </Badge>
          </div>
        </div>
        {isRunning && (
          <Btn variant="danger" size="sm" onClick={cancel}>取消 Run</Btn>
        )}
      </div>

      <div className="flex items-center gap-2 px-5 py-3 border-b border-border-subtle shrink-0">
        <StatusDot status={isRunning ? 'running' : run.status === 'completed' ? 'connected' : 'idle'} />
        <span className="text-xs text-text-muted truncate">{run.task_prompt}</span>
      </div>

      <div className="flex border-b border-border-subtle shrink-0 px-2">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                active ? 'border-accent text-text-strong' : 'border-transparent text-text-muted hover:text-text'
              }`}
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
              <div className="text-sm text-text-muted text-center py-12">等待 Agent 输出…</div>
            ) : (
              messages.map(msg => (
                <ChatBubble
                  key={msg.id}
                  msg={{
                    id: msg.id,
                    role: msg.role as 'user' | 'assistant' | 'system' | 'thinking',
                    content: msg.content,
                    timestamp: msg.created_at,
                  }}
                />
              ))
            )}
          </div>
        )}
        {tab === 'files' && (
          <div className="p-5 space-y-3">
            {files.length === 0 ? (
              <div className="text-sm text-text-muted text-center py-12">暂无文件变更</div>
            ) : (
              files.map(f => (
                <FileDiffBlock
                  key={f.id}
                  file={f}
                  expanded={expandedFile === f.path}
                  onToggle={() => setExpandedFile(expandedFile === f.path ? null : f.path)}
                />
              ))
            )}
          </div>
        )}
        {tab === 'logs' && (
          <div className="p-5">
            <div className="relative pl-5 border-l border-border space-y-5">
              {events.map(ev => (
                <div key={ev.id} className="relative">
                  <span className={`absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full border-2 border-surface-1 ${
                    ev.status === 'running' ? 'bg-accent animate-pulse-dot' : 'bg-border'
                  }`} />
                  <div className="text-[11px] font-mono text-text-muted">{new Date(ev.created_at).toLocaleTimeString('zh-CN')}</div>
                  <div className="text-xs text-text-muted">{ev.type}</div>
                  <div className="text-sm text-text mt-1 leading-relaxed">{ev.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AgentCommandInput
        disabled={!isRunning}
        disabledReason={!isRunning ? 'Run 未在运行中' : undefined}
        onSend={text => { sendCorrection(text) }}
      />
    </div>
  )
}
