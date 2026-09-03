import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dismissAppToast, subscribeAppToasts, type AppToast } from '../lib/appToast'
import { X } from 'lucide-react'

export function AppToastHost() {
  const [toasts, setToasts] = useState<AppToast[]>([])

  useEffect(() => subscribeAppToasts(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] w-[min(22rem,calc(100vw-2rem))] space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-xl border shadow-lg bg-surface-1 px-4 py-3 space-y-2 ${
            t.kind === 'confirm'
              ? 'border-accent/40'
              : t.kind === 'warning'
                ? 'border-warning/40'
                : 'border-border-subtle'
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text-strong">{t.title}</div>
              {t.body && <div className="text-xs text-text-muted mt-0.5">{t.body}</div>}
            </div>
            <button
              type="button"
              className="text-text-muted hover:text-text-strong shrink-0"
              onClick={() => dismissAppToast(t.id)}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {t.href && (
              <Link
                to={t.href}
                className="text-xs px-2 py-1 rounded-md border border-border-subtle bg-surface-2 text-text-muted hover:text-accent"
                onClick={() => dismissAppToast(t.id)}
              >
                {t.hrefLabel || '查看'}
              </Link>
            )}
            {t.actionLabel && t.onAction && (
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-md bg-accent text-white hover:opacity-90"
                onClick={() => {
                  void Promise.resolve(t.onAction?.()).finally(() => dismissAppToast(t.id))
                }}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
