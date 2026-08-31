import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = {
  content: string
  className?: string
}

/** Formal markdown rendering (headings, lists, tables) — not raw ## source. */
export function MarkdownPreview({ content, className = '' }: Props) {
  const text = content.trim()
  if (!text) {
    return <div className={`text-sm text-text-muted ${className}`}>（空内容）</div>
  }

  return (
    <div className={`md-preview text-sm text-text leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold text-text-strong mt-6 mb-3 first:mt-0 pb-2 border-b border-border-subtle">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-text-strong mt-5 mb-2 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-text-strong mt-4 mb-2 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-text-strong mt-3 mb-1.5">{children}</h4>
          ),
          p: ({ children }) => <p className="my-2.5 leading-7">{children}</p>,
          ul: ({ children }) => <ul className="my-2.5 pl-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-2.5 pl-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-6">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-3 border-l-2 border-accent/40 text-text-muted italic">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-accent underline underline-offset-2 hover:opacity-80" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          code: ({ className: codeClass, children }) => {
            const isBlock = Boolean(codeClass)
            if (isBlock) {
              return (
                <code className="block text-xs font-mono bg-surface-2 border border-border-subtle rounded-lg p-3 overflow-x-auto whitespace-pre">
                  {children}
                </code>
              )
            }
            return (
              <code className="px-1 py-0.5 rounded bg-surface-2 border border-border-subtle font-mono text-[12px]">
                {children}
              </code>
            )
          },
          pre: ({ children }) => <pre className="my-3 overflow-x-auto">{children}</pre>,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border-subtle">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface-2 text-text-strong">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-medium border-b border-border-subtle">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-border-subtle align-top">{children}</td>
          ),
          hr: () => <hr className="my-5 border-border-subtle" />,
          strong: ({ children }) => <strong className="font-semibold text-text-strong">{children}</strong>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
