import { useEffect, useState } from 'react'
import { listProviders } from '../api/providers'
import { listAgents } from '../api/agents'
import { listWorkflowDefinitions } from '../api/workflows'
import { workflows, architectureLayers } from '../data/mock'
import { PageHeader, Badge, StatusDot, Btn, PageSection, StatCard } from '../components/ui'
import { ArrowRight, Layers, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'

export function OverviewPage() {
  const [providerCount, setProviderCount] = useState<number | null>(null)
  const [connectedCount, setConnectedCount] = useState<number | null>(null)
  const [agentCount, setAgentCount] = useState<number | null>(null)
  const [workflowDefCount, setWorkflowDefCount] = useState<number | null>(null)
  const [apiOk, setApiOk] = useState(true)

  useEffect(() => {
    Promise.all([listProviders(), listAgents(), listWorkflowDefinitions()])
      .then(([p, a, w]) => {
        setProviderCount(p.items.length)
        setConnectedCount(p.items.filter(x => x.status === 'connected').length)
        setAgentCount(a.items.length)
        setWorkflowDefCount(w.items.length)
        setApiOk(true)
      })
      .catch(() => setApiOk(false))
  }, [])

  const runningWorkflows = workflows.filter(w => w.status === 'running')

  return (
    <div className="space-y-12">
      <PageHeader
        title="平台概览"
        description="可配置的 Agent Provider + 统一运行接口，核心系统不直接依赖任何厂商"
      />

      {!apiOk && (
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning">
          无法连接后端 API，统计卡片显示为 —。请启动 agent-forge（localhost:8001）。
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="已连接 Provider"
          value={apiOk && providerCount !== null ? `${connectedCount}/${providerCount}` : '—'}
        />
        <StatCard label="已配置 Agent" value={agentCount !== null ? String(agentCount) : '—'} />
        <StatCard label="工作流模板" value={workflowDefCount !== null ? String(workflowDefCount) : '—'} />
        <StatCard label="并行工作流（演示）" value={String(runningWorkflows.length)} />
      </div>

      <div className="p-5 rounded-xl bg-surface-1 border border-border-subtle flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-medium text-text-strong">每日任务完成情况</div>
          <p className="text-xs text-text-muted mt-1">按天查看完成任务数、完成率与计划步骤进度</p>
        </div>
        <Link to="/progress">
          <Btn variant="primary" size="sm">
            打开完成总览 <ArrowRight className="w-3.5 h-3.5" />
          </Btn>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <PageSection>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-text-muted" />
            <h2 className="text-base font-medium text-text-strong">系统架构</h2>
          </div>
          <div className="p-6 rounded-xl bg-surface-1 border border-border-subtle shadow-sm space-y-0">
            {architectureLayers.map((item, i) => (
              <div key={item.layer} className="flex items-stretch gap-4">
                <div className="flex flex-col items-center w-4">
                  <div className={`w-2.5 h-2.5 rounded-full mt-2.5 ${i === 1 ? 'bg-accent' : 'bg-border'}`} />
                  {i < architectureLayers.length - 1 && <div className="w-px flex-1 bg-border my-2" />}
                </div>
                <div className="pb-6 flex-1">
                  <div className="text-sm font-medium text-text-strong">{item.layer}</div>
                  <div className="text-sm text-text-muted mt-1 leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </PageSection>

        <PageSection>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-text-muted" />
            <h2 className="text-base font-medium text-text-strong">设计边界</h2>
          </div>
          <div className="p-6 rounded-xl bg-surface-1 border border-border-subtle shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-mono text-sm text-accent">
              Agent → 编排器 → Agent
              <ArrowRight className="w-4 h-4" />
            </div>
            <p className="text-sm text-text leading-relaxed">
              Agent 不直接互相调用。编排器统一控制权限、并发、重试、成本与审计。
              平台自行保存会话与事件，不依赖外部工具的历史对话。
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {['权限', '状态', '并发', '重试', '成本', '审计'].map(t => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          </div>
        </PageSection>
      </div>

      {runningWorkflows.length > 0 && (
        <PageSection>
          <h2 className="text-base font-medium text-text-strong">当前运行（演示 mock）</h2>
          <div className="space-y-4">
            {runningWorkflows.map(wf => {
              const step = wf.steps.find(s => s.status === 'running')
              if (!step) return null
              return (
                <div key={wf.id} className="p-6 rounded-xl bg-surface-1 border border-accent/20 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-text-muted">{wf.title} · {wf.name}</div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <StatusDot status="running" />
                        <span className="text-base font-medium text-text-strong">{step.label}</span>
                        <Badge variant="accent">{step.agentName}</Badge>
                        <Badge>{step.provider}</Badge>
                      </div>
                    </div>
                    <Link to="/workflows">
                      <Btn variant="secondary" size="sm">查看工作流</Btn>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </PageSection>
      )}

      <PageSection>
        <h2 className="text-base font-medium text-text-strong">第一版支持范围</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: '模型 API', items: ['OpenAI', 'Claude', 'Gemini'] },
            { title: '编程 Agent', items: ['Codex CLI', 'OpenCode CLI'] },
            { title: '后续 Adapter', items: ['Cursor', 'Pi', 'Hermes', 'OpenClaw'] },
          ].map(g => (
            <div key={g.title} className="p-6 rounded-xl bg-surface-1 border border-border-subtle shadow-sm">
              <div className="text-sm text-text-muted mb-3">{g.title}</div>
              <div className="flex flex-wrap gap-2">
                {g.items.map(i => <Badge key={i}>{i}</Badge>)}
              </div>
            </div>
          ))}
        </div>
      </PageSection>
    </div>
  )
}
