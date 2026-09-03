import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  chatKnowledgeBase,
  createKnowledgeBase,
  createKnowledgeDocument,
  createKnowledgeDocumentsFromNotes,
  deleteKnowledgeBase,
  deleteKnowledgeDocument,
  getKnowledgeDocument,
  listKnowledgeBases,
  listKnowledgeDocuments,
  reindexKnowledgeBase,
  type ApiKnowledgeBase,
  type ApiKnowledgeDocument,
  type ApiKnowledgeDocumentDetail,
  type ApiKnowledgeSearchHit,
} from '../api/knowledge'
import { listScheduleNotes, type ApiTaskNoteListItem } from '../api/schedule'
import { Badge, Btn } from '../components/ui'
import {
  BookOpen,
  FileText,
  FolderOpen,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react'

type SidePage = 'bases' | 'files' | null
type DocSource = 'paste' | 'notes'

type ChatMsg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: ApiKnowledgeSearchHit[]
  meta?: string
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function KnowledgePage() {
  const [bases, setBases] = useState<ApiKnowledgeBase[]>([])
  const [docs, setDocs] = useState<ApiKnowledgeDocument[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sidePage, setSidePage] = useState<SidePage>('bases')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const [showBaseForm, setShowBaseForm] = useState(false)
  const [baseName, setBaseName] = useState('')
  const [baseDesc, setBaseDesc] = useState('')
  const [baseBusy, setBaseBusy] = useState(false)

  const [showDocForm, setShowDocForm] = useState(false)
  const [docSource, setDocSource] = useState<DocSource>('paste')
  const [docName, setDocName] = useState('')
  const [docContent, setDocContent] = useState('')
  const [docMaxChars, setDocMaxChars] = useState(800)
  const [docBusy, setDocBusy] = useState(false)
  const [scheduleNotes, setScheduleNotes] = useState<ApiTaskNoteListItem[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])
  const [pickerTaskId, setPickerTaskId] = useState<string | null>(null)

  const scheduleTasks = useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; plan_date: string; noteCount: number; contentCount: number }
    >()
    for (const n of scheduleNotes) {
      const cur = map.get(n.daily_task_id)
      if (cur) {
        cur.noteCount += 1
        if (n.has_content) cur.contentCount += 1
      } else {
        map.set(n.daily_task_id, {
          id: n.daily_task_id,
          title: n.task_title,
          plan_date: n.plan_date,
          noteCount: 1,
          contentCount: n.has_content ? 1 : 0,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.plan_date === b.plan_date
        ? a.title.localeCompare(b.title)
        : b.plan_date.localeCompare(a.plan_date),
    )
  }, [scheduleNotes])

  const notesOfPickerTask = useMemo(
    () =>
      pickerTaskId
        ? scheduleNotes.filter(n => n.daily_task_id === pickerTaskId)
        : [],
    [scheduleNotes, pickerTaskId],
  )

  const pickerTask = scheduleTasks.find(t => t.id === pickerTaskId) ?? null

  const [preview, setPreview] = useState<ApiKnowledgeDocumentDetail | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [reindexing, setReindexing] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const selected = bases.find(b => b.id === selectedId) ?? null

  const loadBases = useCallback(async (preferId?: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listKnowledgeBases()
      setBases(res.items)
      const next =
        (preferId && res.items.some(b => b.id === preferId) && preferId) ||
        (selectedId && res.items.some(b => b.id === selectedId) && selectedId) ||
        res.items[0]?.id ||
        null
      setSelectedId(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  const loadDocs = useCallback(async (knowledgeId: string) => {
    try {
      const res = await listKnowledgeDocuments(knowledgeId)
      setDocs(res.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载文档失败')
      setDocs([])
    }
  }, [])

  useEffect(() => {
    void loadBases()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMessages([])
    setPreview(null)
    if (!selectedId) {
      setDocs([])
      return
    }
    void loadDocs(selectedId)
  }, [selectedId, loadDocs])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function handleCreateBase(e: React.FormEvent) {
    e.preventDefault()
    if (!baseName.trim() || baseBusy) return
    setBaseBusy(true)
    try {
      const created = await createKnowledgeBase({
        name: baseName.trim(),
        description: baseDesc.trim(),
      })
      setShowBaseForm(false)
      setBaseName('')
      setBaseDesc('')
      await loadBases(created.id)
      setSidePage('files')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setBaseBusy(false)
    }
  }

  async function handleDeleteBase(base: ApiKnowledgeBase) {
    if (!confirm(`删除知识库「${base.name}」及全部文件？`)) return
    try {
      await deleteKnowledgeBase(base.id)
      if (selectedId === base.id) setSelectedId(null)
      await loadBases(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  async function openDocForm() {
    setShowDocForm(true)
    setDocSource('paste')
    setDocName('')
    setDocContent('')
    setDocMaxChars(800)
    setSelectedNoteIds([])
    setPickerTaskId(null)
    setNotesLoading(true)
    try {
      const res = await listScheduleNotes({ days: 14 })
      setScheduleNotes(res.items)
    } catch {
      setScheduleNotes([])
    } finally {
      setNotesLoading(false)
    }
  }

  async function refreshScheduleNotes() {
    setNotesLoading(true)
    try {
      const res = await listScheduleNotes({ days: 14 })
      setScheduleNotes(res.items)
      if (pickerTaskId && !res.items.some(n => n.daily_task_id === pickerTaskId)) {
        setPickerTaskId(null)
      }
    } catch {
      setScheduleNotes([])
    } finally {
      setNotesLoading(false)
    }
  }

  function toggleNote(id: string) {
    setSelectedNoteIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || docBusy) return
    setDocBusy(true)
    setError(null)
    try {
      if (docSource === 'notes') {
        if (selectedNoteIds.length === 0) {
          setError('请至少选择一条计划笔记/文档')
          return
        }
        const res = await createKnowledgeDocumentsFromNotes(selectedId, {
          note_ids: selectedNoteIds,
          segment_max_chars: docMaxChars,
        })
        setShowDocForm(false)
        setSelectedNoteIds([])
        await loadBases(selectedId)
        await loadDocs(selectedId)
        if (res.items[0]) setPreview(null)
      } else {
        if (!docName.trim() || !docContent.trim()) {
          setError('请填写文档名与正文')
          return
        }
        await createKnowledgeDocument(selectedId, {
          name: docName.trim(),
          content: docContent,
          segment_max_chars: docMaxChars,
        })
        setShowDocForm(false)
        setDocName('')
        setDocContent('')
        await loadBases(selectedId)
        await loadDocs(selectedId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '入库失败')
    } finally {
      setDocBusy(false)
    }
  }

  async function handleDeleteDoc(doc: ApiKnowledgeDocument) {
    if (!confirm(`删除文件「${doc.name}」？`)) return
    try {
      await deleteKnowledgeDocument(doc.id)
      if (preview?.id === doc.id) setPreview(null)
      if (selectedId) {
        await loadBases(selectedId)
        await loadDocs(selectedId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  async function openPreview(doc: ApiKnowledgeDocument) {
    setPreviewLoading(true)
    setSidePage('files')
    try {
      const detail = await getKnowledgeDocument(doc.id)
      setPreview(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : '打开文件失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleReindex() {
    if (!selectedId || reindexing) return
    setReindexing(true)
    try {
      await reindexKnowledgeBase(selectedId)
      await loadBases(selectedId)
      await loadDocs(selectedId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '重建索引失败')
    } finally {
      setReindexing(false)
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    if (!selectedId || !draft.trim() || sending) return
    const text = draft.trim()
    const userMsg: ChatMsg = { id: uid(), role: 'user', content: text }
    const history = [...messages, userMsg]
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map(m => ({ role: m.role, content: m.content }))

    setDraft('')
    setMessages(prev => [...prev, userMsg])
    setSending(true)
    setError(null)
    try {
      const res = await chatKnowledgeBase(selectedId, {
        message: text,
        history: history.slice(0, -1),
      })
      setMessages(prev => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: res.answer,
          citations: res.citations,
          meta: `${res.chat_backend} · ${res.embedding_backend}`,
        },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: err instanceof Error ? `出错了：${err.message}` : '问答失败',
        },
      ])
    } finally {
      setSending(false)
    }
  }

  function toggleSide(page: SidePage) {
    setSidePage(prev => (prev === page ? null : page))
  }

  return (
    <div className="flex flex-1 min-h-0 bg-surface-0">
      {/* Chat column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="shrink-0 h-12 px-4 border-b border-border-subtle flex items-center gap-2 bg-surface-1/80 backdrop-blur">
          <MessageSquare className="w-4 h-4 text-accent" />
          <div className="text-sm font-medium text-text-strong truncate">
            {selected ? selected.name : '知识库问答'}
          </div>
          {selected && (
            <span className="text-[11px] text-text-muted truncate hidden sm:inline">
              {selected.document_count} 文件 · {selected.segment_count} 段
            </span>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => toggleSide('bases')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
              sidePage === 'bases'
                ? 'bg-accent/10 border-accent/30 text-text-strong'
                : 'border-border-subtle text-text-muted hover:bg-surface-2'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            知识库
          </button>
          <button
            type="button"
            onClick={() => toggleSide('files')}
            disabled={!selected}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors disabled:opacity-40 ${
              sidePage === 'files'
                ? 'bg-accent/10 border-accent/30 text-text-strong'
                : 'border-border-subtle text-text-muted hover:bg-surface-2'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            文件
          </button>
          <button
            type="button"
            onClick={() => setSidePage(sidePage ? null : 'bases')}
            className="p-1.5 rounded-md text-text-muted hover:bg-surface-2"
            title={sidePage ? '收起侧栏' : '打开侧栏'}
          >
            {sidePage ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </header>

        {error && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger shrink-0">
            {error}
            <button type="button" className="ml-3 text-text-muted" onClick={() => setError(null)}>关闭</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="mx-auto max-w-3xl space-y-5">
            {!selected && !loading && (
              <div className="py-24 text-center space-y-3">
                <BookOpen className="w-8 h-8 text-accent mx-auto opacity-80" />
                <div className="text-base text-text-strong">从侧栏选择或新建知识库</div>
                <div className="text-sm text-text-muted">然后像 Cursor 一样直接提问</div>
                <Btn variant="primary" size="sm" onClick={() => { setSidePage('bases'); setShowBaseForm(true) }}>
                  <Plus className="w-3.5 h-3.5" />新建知识库
                </Btn>
              </div>
            )}

            {selected && messages.length === 0 && !sending && (
              <div className="py-20 text-center space-y-2">
                <div className="text-lg text-text-strong">问点关于「{selected.name}」的问题</div>
                <div className="text-sm text-text-muted">
                  会检索库内文件再回答。可先打开右侧「文件」添加文档。
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-4">
                  {['这个知识库里有什么？', '总结主要要点', '有哪些注意事项？'].map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setDraft(q)}
                      className="px-3 py-1.5 rounded-full text-xs border border-border-subtle text-text-muted hover:bg-surface-2 hover:text-text"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-accent text-white rounded-br-md'
                      : 'bg-surface-3 text-text rounded-bl-md'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border-subtle/60 space-y-2">
                      <div className="text-[11px] uppercase tracking-wide text-text-muted">引用</div>
                      {m.citations.slice(0, 4).map((c, i) => (
                        <button
                          key={c.segment_id}
                          type="button"
                          onClick={() => {
                            const doc = docs.find(d => d.id === c.document_id)
                            if (doc) void openPreview(doc)
                            else setSidePage('files')
                          }}
                          className="w-full text-left p-2 rounded-lg bg-surface-2/80 hover:bg-surface-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 text-text-muted mb-1">
                            <span className="truncate">[{i + 1}] {c.document_name}</span>
                            <Badge variant="default">{c.score.toFixed(3)}</Badge>
                          </div>
                          <div className="text-text line-clamp-3">{c.content}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {m.meta && (
                    <div className="mt-2 text-[10px] text-text-muted">{m.meta}</div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-surface-3 text-sm text-text-muted">
                  检索并回答中…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-border-subtle p-4">
          <form onSubmit={handleSend} className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-border-subtle bg-transparent focus-within:border-accent/40 transition-colors">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                rows={3}
                disabled={!selected || sending}
                placeholder={selected ? '询问知识库…（Enter 发送，Shift+Enter 换行）' : '请先选择知识库'}
                className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-text-strong placeholder:text-text-muted outline-none disabled:opacity-50"
              />
              <div className="flex items-center justify-between px-3 pb-3">
                <span className="text-[11px] text-text-muted">
                  {selected ? `当前库：${selected.name}` : '未选择知识库'}
                </span>
                <Btn variant="primary" size="sm" type="submit" disabled={!selected || sending || !draft.trim()}>
                  <Send className="w-3.5 h-3.5" />
                  发送
                </Btn>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Side mini-pages */}
      {sidePage && (
        <aside className="w-[360px] shrink-0 border-l border-border-subtle bg-surface-1 flex flex-col min-h-0">
          <div className="h-12 px-4 border-b border-border-subtle flex items-center gap-2">
            <div className="flex rounded-lg border border-border-subtle p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSidePage('bases')}
                className={`px-2.5 py-1 rounded-md ${sidePage === 'bases' ? 'bg-surface-3 text-text-strong' : 'text-text-muted'}`}
              >
                知识库
              </button>
              <button
                type="button"
                onClick={() => setSidePage('files')}
                disabled={!selected}
                className={`px-2.5 py-1 rounded-md disabled:opacity-40 ${sidePage === 'files' ? 'bg-surface-3 text-text-strong' : 'text-text-muted'}`}
              >
                文件
              </button>
            </div>
            <div className="flex-1" />
            <button type="button" onClick={() => setSidePage(null)} className="p-1 rounded-md hover:bg-surface-3 text-text-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          {sidePage === 'bases' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="flex gap-2 mb-2">
                <Btn variant="primary" size="sm" onClick={() => setShowBaseForm(true)}>
                  <Plus className="w-3.5 h-3.5" />新建
                </Btn>
                <Btn variant="secondary" size="sm" onClick={() => loadBases(selectedId)} disabled={loading}>
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Btn>
              </div>
              {bases.length === 0 && !loading && (
                <div className="text-sm text-text-muted px-2 py-8 text-center">还没有知识库</div>
              )}
              {bases.map(b => (
                <div
                  key={b.id}
                  className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                    selected?.id === b.id
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-border-subtle hover:bg-surface-2'
                  }`}
                  onClick={() => setSelectedId(b.id)}
                >
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-text-strong truncate">{b.name}</div>
                      <div className="text-[11px] text-text-muted mt-1">
                        {b.document_count} 文件 · {b.segment_count} 段
                      </div>
                      {b.description && (
                        <div className="text-xs text-text-muted mt-1 line-clamp-2">{b.description}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-danger/10"
                      onClick={e => { e.stopPropagation(); void handleDeleteBase(b) }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sidePage === 'files' && selected && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-3 pt-3 pb-2 border-b border-border-subtle space-y-2">
                <div className="text-[11px] text-text-muted uppercase tracking-wide">当前知识库</div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-text-strong min-w-0">
                  <BookOpen className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="truncate" title={selected.name}>{selected.name}</span>
                </div>
                <div className="flex gap-2">
                  <Btn variant="primary" size="sm" onClick={() => void openDocForm()}>
                    <Plus className="w-3.5 h-3.5" />添加文件
                  </Btn>
                  <Btn variant="secondary" size="sm" onClick={handleReindex} disabled={reindexing}>
                    <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
                    重建
                  </Btn>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {docs.length === 0 && (
                  <div className="text-sm text-text-muted px-2 py-8 text-center">暂无文件，先添加文本文档</div>
                )}
                {docs.map(d => (
                  <div
                    key={d.id}
                    className={`rounded-xl border p-3 ${
                      preview?.id === d.id ? 'border-accent/40 bg-accent/5' : 'border-border-subtle'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openPreview(d)}>
                        <div className="text-[10px] text-text-muted truncate mb-0.5">
                          {selected.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-text-strong">
                          <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          <span className="truncate">{d.name}</span>
                        </div>
                        <div className="text-[11px] text-text-muted mt-1">
                          {d.content_length} 字 · {d.segment_count} 段 · {d.status}
                        </div>
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-danger/10"
                        onClick={() => void handleDeleteDoc(d)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {(preview || previewLoading) && (
                  <div className="mt-3 rounded-xl border border-border-subtle bg-surface-0 overflow-hidden">
                    <div className="px-3 py-2 border-b border-border-subtle space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-text-strong truncate">
                          {previewLoading ? '加载中…' : preview?.name}
                        </span>
                        <button type="button" onClick={() => setPreview(null)} className="text-text-muted hover:text-text shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[11px] text-text-muted flex items-center gap-1 min-w-0">
                        <BookOpen className="w-3 h-3 shrink-0" />
                        <span className="truncate">所属知识库：{selected.name}</span>
                      </div>
                    </div>
                    <pre className="p-3 text-xs text-text whitespace-pre-wrap font-mono max-h-80 overflow-y-auto leading-relaxed">
                      {preview?.content ?? ''}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      )}

      {showBaseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <form onSubmit={handleCreateBase} className="w-full max-w-md rounded-xl bg-surface-1 border border-border-subtle shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-text-strong">新建知识库</h2>
              <button type="button" onClick={() => setShowBaseForm(false)} className="p-1 text-text-muted"><X className="w-4 h-4" /></button>
            </div>
            <label className="block text-xs text-text-muted">
              名称
              <input required value={baseName} onChange={e => setBaseName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm" />
            </label>
            <label className="block text-xs text-text-muted">
              描述
              <textarea value={baseDesc} onChange={e => setBaseDesc(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm" />
            </label>
            <div className="flex justify-end gap-2">
              <Btn variant="secondary" size="sm" type="button" onClick={() => setShowBaseForm(false)}>取消</Btn>
              <Btn variant="primary" size="sm" type="submit" disabled={baseBusy}>{baseBusy ? '创建中…' : '创建'}</Btn>
            </div>
          </form>
        </div>
      )}

      {showDocForm && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <form onSubmit={handleCreateDoc} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-surface-1 border border-border-subtle shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-text-strong">添加文件 — {selected.name}</h2>
              <button type="button" onClick={() => setShowDocForm(false)} className="p-1 text-text-muted"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex rounded-lg border border-border-subtle p-0.5 text-xs w-fit">
              <button
                type="button"
                onClick={() => setDocSource('paste')}
                className={`px-3 py-1.5 rounded-md ${docSource === 'paste' ? 'bg-surface-3 text-text-strong' : 'text-text-muted'}`}
              >
                粘贴文本
              </button>
              <button
                type="button"
                onClick={() => setDocSource('notes')}
                className={`px-3 py-1.5 rounded-md ${docSource === 'notes' ? 'bg-surface-3 text-text-strong' : 'text-text-muted'}`}
              >
                从计划笔记选择
              </button>
            </div>

            {docSource === 'paste' ? (
              <>
                <label className="block text-xs text-text-muted">
                  文件名
                  <input required={docSource === 'paste'} value={docName} onChange={e => setDocName(e.target.value)} placeholder="notes.md" className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm" />
                </label>
                <label className="block text-xs text-text-muted">
                  正文
                  <textarea required={docSource === 'paste'} value={docContent} onChange={e => setDocContent(e.target.value)} rows={10} className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm font-mono" />
                </label>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>近 14 天 · 先选计划，再选其中的笔记/文档</span>
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => void refreshScheduleNotes()}
                  >
                    刷新
                  </button>
                </div>
                {notesLoading && <div className="text-sm text-text-muted py-6 text-center">加载中…</div>}
                {!notesLoading && scheduleTasks.length === 0 && (
                  <div className="text-sm text-text-muted py-6 text-center">
                    暂无带笔记的计划。请先在「今日计划」任务里添加笔记与文档。
                  </div>
                )}

                {!notesLoading && scheduleTasks.length > 0 && !pickerTaskId && (
                  <div className="max-h-72 overflow-y-auto space-y-2 border border-border-subtle rounded-lg p-2">
                    {scheduleTasks.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPickerTaskId(t.id)}
                        className="w-full text-left p-3 rounded-lg border border-transparent hover:bg-surface-2 hover:border-border-subtle"
                      >
                        <div className="text-sm font-medium text-text-strong truncate">{t.title}</div>
                        <div className="text-[11px] text-text-muted mt-1">
                          {t.plan_date} · {t.contentCount}/{t.noteCount} 个可导入文件
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!notesLoading && pickerTaskId && pickerTask && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        className="text-accent hover:underline shrink-0"
                        onClick={() => setPickerTaskId(null)}
                      >
                        ← 返回计划列表
                      </button>
                      <span className="text-text-muted truncate">
                        {pickerTask.plan_date} · {pickerTask.title}
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2 border border-border-subtle rounded-lg p-2">
                      {notesOfPickerTask.length === 0 && (
                        <div className="text-sm text-text-muted py-6 text-center">该计划下暂无笔记</div>
                      )}
                      {notesOfPickerTask.map(n => {
                        const checked = selectedNoteIds.includes(n.id)
                        return (
                          <label
                            key={n.id}
                            className={`flex gap-2 p-2.5 rounded-lg border cursor-pointer ${
                              checked ? 'border-accent/40 bg-accent/5' : 'border-transparent hover:bg-surface-2'
                            } ${!n.has_content ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              disabled={!n.has_content}
                              onChange={() => toggleNote(n.id)}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-text-strong truncate">{n.title}</div>
                              <div className="text-[11px] text-text-muted mt-0.5 truncate">
                                {n.kind}
                                {n.file_path ? ` · ${n.file_path}` : ''}
                                {!n.has_content ? ' · 无内容' : ''}
                              </div>
                              {n.body_preview && (
                                <div className="text-xs text-text-muted mt-1 line-clamp-2">{n.body_preview}</div>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>已选 {selectedNoteIds.length} 条（可跨计划累计）</span>
                      {selectedNoteIds.length > 0 && (
                        <button
                          type="button"
                          className="text-accent hover:underline"
                          onClick={() => setSelectedNoteIds([])}
                        >
                          清空选择
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <label className="block text-xs text-text-muted">
              分块最大字符
              <input type="number" min={100} max={8000} value={docMaxChars} onChange={e => setDocMaxChars(Number(e.target.value) || 800)} className="mt-1 w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm" />
            </label>
            <div className="flex justify-end gap-2">
              <Btn variant="secondary" size="sm" type="button" onClick={() => setShowDocForm(false)}>取消</Btn>
              <Btn
                variant="primary"
                size="sm"
                type="submit"
                disabled={
                  docBusy ||
                  (docSource === 'notes' ? selectedNoteIds.length === 0 : !docName.trim() || !docContent.trim())
                }
              >
                {docBusy ? '入库中…' : docSource === 'notes' ? `导入并索引（${selectedNoteIds.length}）` : '保存并索引'}
              </Btn>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
