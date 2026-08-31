import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Plug,
  Bot,
  GitBranch,
  Activity,
  CalendarDays,
  ChartColumn,
  Hexagon,
} from 'lucide-react'

const nav = [
  { to: '/', icon: LayoutDashboard, label: '概览' },
  { to: '/progress', icon: ChartColumn, label: '完成总览' },
  { to: '/providers', icon: Plug, label: 'Provider 管理' },
  { to: '/agents', icon: Bot, label: 'Agent 管理' },
  { to: '/workflows', icon: GitBranch, label: '工作流' },
  { to: '/runs', icon: Activity, label: '运行监控' },
  { to: '/schedule', icon: CalendarDays, label: '今日计划' },
]

const FULL_BLEED = ['/workflows', '/runs', '/schedule']

export function AppLayout() {
  const { pathname } = useLocation()
  const fullBleed = FULL_BLEED.includes(pathname)

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 border-r border-border-subtle bg-surface-1 shadow-sm flex flex-col">
        <div className="px-5 py-6 flex items-center gap-3 border-b border-border-subtle">
          <Hexagon className="w-5 h-5 text-accent" strokeWidth={1.5} />
          <div>
            <div className="text-sm font-semibold text-text-strong tracking-tight">AgentForge</div>
            <div className="text-[10px] text-text-muted uppercase tracking-widest">Orchestrator</div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-surface-3 text-text-strong'
                    : 'text-text hover:text-text-strong hover:bg-surface-2'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-border-subtle">
          <div className="text-[11px] text-text-muted">原型 v0.1 · 交互演示</div>
        </div>
      </aside>
      <main className={`flex-1 bg-surface-0 ${fullBleed ? 'flex flex-col min-h-0 overflow-hidden' : 'overflow-auto'}`}>
        {fullBleed ? (
          <Outlet />
        ) : (
          <div className="mx-auto max-w-7xl px-10 py-12">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  )
}
