import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDayOverviewRange, type ApiDayOverviewRange } from '../api/schedule'
import { PageHeader, Badge, Btn, StatCard } from '../components/ui'
import { CalendarDays, RefreshCw, ArrowRight } from 'lucide-react'

function pct(done: number, total: number) {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

function formatDay(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
}

export function ProgressOverviewPage() {
  const [days, setDays] = useState(14)
  const [data, setData] = useState<ApiDayOverviewRange | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(span = days) {
    setLoading(true)
    setError(null)
    try {
      const res = await getDayOverviewRange({ days: span })
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载总览失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(days)
  }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  const maxTasks = useMemo(
    () => Math.max(1, ...(data?.days.map(d => d.task_count) ?? [1])),
    [data],
  )

  const taskRate = data ? pct(data.total_done_count, data.total_task_count) : 0
  const stepRate = data ? pct(data.total_plan_done_count, data.total_plan_item_count) : 0
  const reversed = data ? [...data.days].reverse() : []

  return (
    <div className="px-10 py-10 space-y-8 max-w-5xl">
      <PageHeader
        title="完成总览"
        description="按天查看任务完成数与完成率，便于回看每日计划执行情况。"
        action={
          <div className="flex gap-2 flex-wrap items-center">
            {[7, 14, 30].map(n => (
              <Btn
                key={n}
                variant={days === n ? 'primary' : 'secondary'}
                size="sm"
                type="button"
                onClick={() => setDays(n)}
              >
                近 {n} 天
              </Btn>
            ))}
            <Btn variant="secondary" size="sm" type="button" onClick={() => load(days)} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Btn>
            <Link to="/schedule">
              <Btn variant="ghost" size="sm">
                今日计划 <ArrowRight className="w-3.5 h-3.5" />
              </Btn>
            </Link>
          </div>
        }
      />

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="区间任务总数" value={data ? String(data.total_task_count) : '—'} />
        <StatCard
          label="已完成任务"
          value={data ? `${data.total_done_count}（${taskRate}%）` : '—'}
        />
        <StatCard label="计划步骤总数" value={data ? String(data.total_plan_item_count) : '—'} />
        <StatCard
          label="步骤完成率"
          value={data ? `${stepRate}%` : '—'}
        />
      </div>

      <section className="rounded-xl border border-border-subtle bg-surface-1 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle bg-surface-2/50 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-medium text-text-strong">每日完成情况</h2>
          {data && (
            <span className="text-xs text-text-muted ml-auto">
              {data.start_date} → {data.end_date}
            </span>
          )}
        </div>

        {loading && <div className="p-8 text-sm text-text-muted">加载中…</div>}

        {!loading && reversed.length === 0 && (
          <div className="p-8 text-sm text-text-muted">暂无数据</div>
        )}

        {!loading && reversed.length > 0 && (
          <div className="divide-y divide-border-subtle">
            {reversed.map(day => {
              const tRate = pct(day.done_count, day.task_count)
              const sRate = pct(day.plan_done_count, day.plan_item_count)
              const barW = Math.round((day.task_count / maxTasks) * 100)
              return (
                <div key={day.plan_date} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="w-36 shrink-0">
                    <div className="text-sm font-medium text-text-strong">{formatDay(day.plan_date)}</div>
                    <div className="text-[11px] font-mono text-text-muted">{day.plan_date}</div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent/70"
                        style={{ width: `${day.task_count === 0 ? 0 : Math.max(barW, 6)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                      <span>
                        任务 {day.done_count}/{day.task_count}
                        {day.task_count > 0 ? ` · ${tRate}%` : ''}
                      </span>
                      <span>
                        步骤 {day.plan_done_count}/{day.plan_item_count}
                        {day.plan_item_count > 0 ? ` · ${sRate}%` : ''}
                      </span>
                      <Badge variant="default">待办 {day.todo_count}</Badge>
                      <Badge variant="info">进行中 {day.in_progress_count}</Badge>
                      <Badge variant="success">完成 {day.done_count}</Badge>
                    </div>
                  </div>
                  <Link
                    to={`/schedule`}
                    className="text-xs text-accent hover:underline shrink-0"
                    onClick={() => {
                      // Schedule page reads its own date state; deep-link via query later if needed.
                      sessionStorage.setItem('schedule_plan_date', day.plan_date)
                    }}
                  >
                    查看当日 →
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
