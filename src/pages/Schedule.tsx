import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, Badge, Btn, StatusDot } from '../components/ui'
import { MarkdownPreview } from '../components/MarkdownPreview'
import { listAgents } from '../api/agents'
import type { ApiAgent } from '../api/types'
import { LiveRunPanel } from '../components/LiveRunPanel'
import { AgentCommandInput } from '../components/AgentCommandInput'
import {
  createDailyTask,
  createTaskMemory,
  createTaskNote,
  continueDailyTask,
  deleteDailyTask,
  deleteTaskMemory,
  deleteTaskNote,
  downloadTaskNote,
  getDailyTask,
  getDayOverview,
  getLatestTaskAgentChat,
  listDailyTasks,
  regeneratePlan,
  startTaskWorkflow,
  taskAgentChat,
  updateDailyTask,
  updateTaskMemory,
  type ApiDailyTask,
  type ApiDailyTaskSummary,
  type ApiDayOverview,
  type ApiTaskNote,
  type ApiTaskPlanItem,
  type ApiWorkflowPlanGroup,
} from '../api/schedule'
import { listWorkflowDefinitions } from '../api/workflows'
import type { ApiWorkflowDefinitionSummary } from '../api/types'
import {
  Code2, CheckCircle2, Circle, Loader2,
  RefreshCw, Bot, Clock, ArrowRight, ListTodo, Plus, Trash2, Play,
  FileText, Pin, Eye, X, MessageSquare, Minus, Download, CornerDownRight,
} from 'lucide-react'

function deriveTaskTitle(requirement: string, fallback = '未命名任务') {
  const line = (requirement || '').trim().split(/\r?\n/)[0]?.trim() ?? ''
  if (!line) return fallback
  return line.length > 80 ? `${line.slice(0, 80)}…` : line
}

const statusBadge = {
  done: { label: '已完成', variant: 'success' as const },
  in_progress: { label: '进行中', variant: 'accent' as const },
  todo: { label: '待办', variant: 'default' as const },
}

function localDateStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDateStr(iso: string, deltaDays: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return localDateStr(d)
}

function planStatusIcon(status: string) {
  if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
  if (status === 'in_progress') return <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
  return <Circle className="w-4 h-4 text-text-muted shrink-0" />
}

function formatUpdated(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function looksLikeFilePath(value: string): boolean {
  return /[\\/]/.test(value) || /\.[a-z0-9]{1,8}$/i.test(value)
}

function resolveNotePayload(
  _noteKind: 'markdown' | 'file',
  title: string,
  body: string,
  filePath: string,
): { kind: 'markdown' | 'file'; title: string; body: string; file_path: string } | { error: string } {
  let titleVal = title.trim()
  let bodyVal = body.trim()
  let pathVal = filePath.trim()

  // 标题栏误填了路径时自动纠正
  if (!pathVal && titleVal && looksLikeFilePath(titleVal)) {
    pathVal = titleVal
    titleVal = ''
  }

  if (pathVal) {
    return { kind: 'file', title: titleVal || pathVal.split(/[\\/]/).pop() || pathVal, body: bodyVal, file_path: pathVal }
  }
  if (bodyVal || titleVal) {
    return {
      kind: 'markdown',
      title: titleVal,
      body: bodyVal || titleVal,
      file_path: '',
    }
  }
  return { error: '请填写笔记标题或正文，或上传/选择文档' }
}

export function SchedulePage() {
  const navigate = useNavigate()
  const [planDate, setPlanDate] = useState(() => {
    const stored = sessionStorage.getItem('schedule_plan_date')
    if (stored) {
      sessionStorage.removeItem('schedule_plan_date')
      return stored
    }
    return localDateStr()
  })
  const today = useMemo(() => localDateStr(), [])
  const [overview, setOverview] = useState<ApiDayOverview | null>(null)
  const [tasks, setTasks] = useState<ApiDailyTaskSummary[]>([])
  const [workflows, setWorkflows] = useState<ApiWorkflowDefinitionSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ApiDailyTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createRequirement, setCreateRequirement] = useState('')
  const [createWorkflowId, setCreateWorkflowId] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [planWorkflowId, setPlanWorkflowId] = useState('')
  const [bindWorkflowId, setBindWorkflowId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editRequirement, setEditRequirement] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [adding, setAdding] = useState(false)
  const [startingWf, setStartingWf] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const [carryCandidates, setCarryCandidates] = useState<ApiDailyTaskSummary[]>([])
  const [carrySelectedIds, setCarrySelectedIds] = useState<string[]>([])
  const [showCarryPicker, setShowCarryPicker] = useState(false)
  const [carryPreview, setCarryPreview] = useState<ApiDailyTask | null>(null)
  const [carryPreviewLoading, setCarryPreviewLoading] = useState(false)
  const [noteFormKey, setNoteFormKey] = useState(0)
  const [noteError, setNoteError] = useState<string | null>(null)
  const noteFormRef = useRef<HTMLFormElement>(null)
  const noteFileInputRef = useRef<HTMLInputElement>(null)
  const noteDraftRef = useRef({ title: '', body: '', filePath: '' })
  const [memoryContent, setMemoryContent] = useState('')
  const [memoryPinned, setMemoryPinned] = useState(false)
  const [savingSide, setSavingSide] = useState(false)
  const [previewNote, setPreviewNote] = useState<ApiTaskNote | null>(null)
  const [previewMode, setPreviewMode] = useState<'rendered' | 'source'>('rendered')
  const [boundIds, setBoundIds] = useState<string[]>([])
  const [savingBinds, setSavingBinds] = useState(false)
  const [showAddWorkflow, setShowAddWorkflow] = useState(false)
  const [showAgentChat, setShowAgentChat] = useState(false)
  const [agentChatCollapsed, setAgentChatCollapsed] = useState(false)
  const [chatPos, setChatPos] = useState<{ x: number; y: number } | null>(null)
  const [chatSize, setChatSize] = useState(() => {
    try {
      const raw = localStorage.getItem('schedule_agent_chat_size')
      if (raw) {
        const parsed = JSON.parse(raw) as { w?: number; h?: number }
        if (typeof parsed.w === 'number' && typeof parsed.h === 'number') {
          return {
            w: Math.min(Math.max(320, parsed.w), 1200),
            h: Math.min(Math.max(360, parsed.h), 1000),
          }
        }
      }
    } catch {
      /* ignore */
    }
    return { w: 440, h: 620 }
  })
  const chatDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origX: number
    origY: number
    moved: boolean
  } | null>(null)
  const chatResizeRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origW: number
    origH: number
  } | null>(null)
  const chatWindowRef = useRef<HTMLDivElement | null>(null)
  const suppressChatClickRef = useRef(false)
  const [agents, setAgents] = useState<ApiAgent[]>([])
  const [chatAgentId, setChatAgentId] = useState('')
  const [chatRunId, setChatRunId] = useState<string | null>(null)
  const [chatSending, setChatSending] = useState(false)
  const [chatHint, setChatHint] = useState<string | null>(null)

  const clampChatSize = useCallback((w: number, h: number) => {
    const maxW = Math.max(320, window.innerWidth - 16)
    const maxH = Math.max(360, window.innerHeight - 16)
    return {
      w: Math.min(Math.max(320, w), maxW),
      h: Math.min(Math.max(360, h), maxH),
    }
  }, [])

  const clampChatPos = useCallback((x: number, y: number, el?: HTMLElement | null) => {
    const w = el?.offsetWidth ?? (agentChatCollapsed ? 220 : chatSize.w)
    const h = el?.offsetHeight ?? (agentChatCollapsed ? 48 : chatSize.h)
    const maxX = Math.max(8, window.innerWidth - w - 8)
    const maxY = Math.max(8, window.innerHeight - h - 8)
    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(8, y), maxY),
    }
  }, [agentChatCollapsed, chatSize.h, chatSize.w])

  const onChatDragStart = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return
    if (chatResizeRef.current) return
    const target = e.target as HTMLElement
    // Allow dragging the collapsed pill button; block other controls in the header.
    const isPill = Boolean(target.closest('[data-chat-drag="pill"]'))
    if (!isPill && target.closest('button, select, input, textarea, a, [data-chat-resize]')) return
    const el = chatWindowRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const orig = chatPos ?? { x: rect.left, y: rect.top }
    chatDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: orig.x,
      origY: orig.y,
      moved: false,
    }
    el.setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [chatPos])

  const onChatDragMove = useCallback((e: ReactPointerEvent) => {
    const resize = chatResizeRef.current
    if (resize && resize.pointerId === e.pointerId) {
      const next = clampChatSize(
        resize.origW + (e.clientX - resize.startX),
        resize.origH + (e.clientY - resize.startY),
      )
      setChatSize(next)
      return
    }
    const drag = chatDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true
    setChatPos(clampChatPos(drag.origX + dx, drag.origY + dy, chatWindowRef.current))
  }, [clampChatPos, clampChatSize])

  const onChatDragEnd = useCallback((e: ReactPointerEvent) => {
    const resize = chatResizeRef.current
    if (resize && resize.pointerId === e.pointerId) {
      chatResizeRef.current = null
      setChatSize(prev => {
        try {
          localStorage.setItem('schedule_agent_chat_size', JSON.stringify(prev))
        } catch {
          /* ignore */
        }
        return prev
      })
      try {
        chatWindowRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      return
    }
    const drag = chatDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    if (drag.moved) {
      suppressChatClickRef.current = true
      window.setTimeout(() => { suppressChatClickRef.current = false }, 0)
    }
    chatDragRef.current = null
    try {
      chatWindowRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onChatResizeStart = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const el = chatWindowRef.current
    if (!el) return
    chatDragRef.current = null
    chatResizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origW: chatSize.w,
      origH: chatSize.h,
    }
    el.setPointerCapture(e.pointerId)
  }, [chatSize.h, chatSize.w])

  const chatFloatStyle: CSSProperties = {
    ...(chatPos
      ? { left: chatPos.x, top: chatPos.y, right: 'auto', bottom: 'auto' }
      : { right: 24, bottom: 24 }),
    ...(!agentChatCollapsed
      ? {
          width: Math.min(chatSize.w, typeof window !== 'undefined' ? window.innerWidth - 16 : chatSize.w),
          height: Math.min(chatSize.h, typeof window !== 'undefined' ? window.innerHeight - 16 : chatSize.h),
        }
      : {}),
  }

  const loadTasks = useCallback(async (
    preferId?: string | null,
    dateOverride?: string,
    opts?: { silent?: boolean },
  ) => {
    const day = dateOverride ?? planDate
    const silent = opts?.silent ?? false
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [res, ov] = await Promise.all([listDailyTasks(day), getDayOverview(day)])
      setTasks(res.items)
      setOverview(ov)
      if (!silent) {
        const nextId =
          (preferId && res.items.some(t => t.id === preferId) && preferId) ||
          res.items.find(t => t.status === 'in_progress')?.id ||
          res.items[0]?.id ||
          null
        setSelectedId(nextId)
      }
      return res.items
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : '加载计划失败')
      return []
    } finally {
      if (!silent) setLoading(false)
    }
  }, [planDate])

  const loadDetail = useCallback(async (
    id: string,
    opts?: { silent?: boolean; syncEditors?: boolean },
  ) => {
    const silent = opts?.silent ?? false
    const syncEditors = opts?.syncEditors ?? !silent
    if (!silent) setDetailLoading(true)
    try {
      const task = await getDailyTask(id)
      setDetail(task)
      if (syncEditors) {
        setBindWorkflowId(task.workflow_definition_id ?? '')
        const bound = task.bound_workflow_ids?.length
          ? task.bound_workflow_ids
          : (task.workflow_definition_id ? [task.workflow_definition_id] : [])
        setBoundIds(bound)
        setEditTitle(task.title)
        setEditRequirement(
          (task.requirement || '').trim() ||
            (task.summary || '').trim() ||
            task.title ||
            '',
        )
      }
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : '加载任务详情失败')
        setDetail(null)
      }
    } finally {
      if (!silent) setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTasks(null, planDate)
  }, [planDate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (planDate !== today) {
      setCarryCandidates([])
      setCarrySelectedIds([])
      setShowCarryPicker(false)
      return
    }
    let cancelled = false
    const days = Array.from({ length: 14 }, (_, i) => shiftDateStr(today, -(i + 1)))
    Promise.all(days.map(d => listDailyTasks(d).then(r => r.items).catch(() => [] as ApiDailyTaskSummary[])))
      .then(lists => {
        if (cancelled) return
        const items = lists
          .flat()
          .filter(t => t.status !== 'done' && !t.continued_to_id)
          .sort((a, b) => (a.plan_date < b.plan_date ? 1 : a.plan_date > b.plan_date ? -1 : 0))
        setCarryCandidates(items)
        setCarrySelectedIds(items.map(t => t.id))
        if (items.length === 0) setShowCarryPicker(false)
      })
      .catch(() => {
        if (!cancelled) {
          setCarryCandidates([])
          setCarrySelectedIds([])
          setShowCarryPicker(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [planDate, today, tasks])

  useEffect(() => {
    listWorkflowDefinitions()
      .then(res => {
        setWorkflows(res.items)
        if (res.items.length && !planWorkflowId) {
          const preferred =
            res.items.find(w => w.name === 'dev-plan')?.id ?? res.items.find(w => w.name === 'feature-development')?.id ?? res.items[0].id
          setPlanWorkflowId(preferred)
        }
      })
      .catch(() => {/* ignore */})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listAgents()
      .then(res => {
        setAgents(res.items)
        if (res.items.length && !chatAgentId) {
          setChatAgentId(res.items[0].id)
        }
      })
      .catch(() => {/* ignore */})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setChatHint(null)
    setChatRunId(null)
  }, [selectedId])

  useEffect(() => {
    if (!showAgentChat || !selectedId || !chatAgentId) {
      if (!showAgentChat) return
      setChatRunId(null)
      return
    }
    let cancelled = false
    getLatestTaskAgentChat(selectedId, chatAgentId)
      .then(run => {
        if (!cancelled) {
          setChatRunId(run?.id ?? null)
          setChatHint(null)
        }
      })
      .catch(() => {
        if (!cancelled) setChatRunId(null)
      })
    return () => { cancelled = true }
  }, [showAgentChat, selectedId, chatAgentId])

  async function handleTaskAgentSend(message: string, opts?: { newSession?: boolean }) {
    if (!selectedId || !chatAgentId || !message.trim() || chatSending) return
    setChatSending(true)
    setChatHint(null)
    setError(null)
    try {
      const res = await taskAgentChat(selectedId, {
        agent_id: chatAgentId,
        message: message.trim(),
        run_id: opts?.newSession ? null : chatRunId,
        new_session: opts?.newSession ?? false,
      })
      setChatRunId(res.run_id)
      if (res.docs_attached) {
        setChatHint('已附带任务文档（仅本会话首轮）')
      } else if (res.mode === 'continue') {
        setChatHint('已延续历史上下文（未再附带文档）')
      } else if (res.mode === 'inject') {
        setChatHint('已注入当前会话')
      }
      await loadDetail(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Agent 对话失败')
    } finally {
      setChatSending(false)
    }
  }

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

  // Poll plan progress only while a workflow/step is actively running.
  // Do not overwrite the requirement form or toggle full-page loading.
  const planProgressKey = detail
    ? `${detail.active_workflow_run_id ?? ''}|${detail.plan_items.map(p => p.status).join(',')}`
    : ''
  useEffect(() => {
    if (!selectedId || !detail) return
    const busy =
      Boolean(detail.active_workflow_run_id) ||
      detail.plan_items.some(p => p.status === 'in_progress')
    if (!busy) return
    const timer = window.setInterval(() => {
      void loadDetail(selectedId, { silent: true, syncEditors: false })
      void loadTasks(selectedId, undefined, { silent: true })
    }, 3000)
    return () => window.clearInterval(timer)
  }, [selectedId, planProgressKey, loadDetail, loadTasks]) // eslint-disable-line react-hooks/exhaustive-deps

  function openCreateModal() {
    setCreateTitle('')
    setCreateRequirement('')
    setCreateWorkflowId(planWorkflowId || workflows[0]?.id || '')
    setCreateError(null)
    setShowCreateModal(true)
  }

  function closeCreateModal() {
    setShowCreateModal(false)
    setCreateError(null)
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    if (adding) return
    const requirement = createRequirement.trim()
    const title = createTitle.trim() || deriveTaskTitle(requirement)
    if (!title.trim() && !requirement) {
      setCreateError('请填写标题或详细需求')
      return
    }
    setAdding(true)
    setCreateError(null)
    setError(null)
    try {
      const created = await createDailyTask({
        title: title.trim() || '未命名任务',
        requirement,
        plan_date: planDate,
        with_plan: false,
        workflow_definition_id: createWorkflowId || null,
      })
      closeCreateModal()
      setSelectedId(created.id)
      setDetail(created)
      setEditTitle(created.title)
      setEditRequirement(
        (created.requirement || '').trim() ||
          (created.summary || '').trim() ||
          created.title ||
          '',
      )
      await loadTasks(created.id)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setAdding(false)
    }
  }

  async function handleRegeneratePlan() {
    if (!selectedId || regenerating) return
    setRegenerating(true)
    setError(null)
    try {
      const wfId = bindWorkflowId || planWorkflowId || null
      const updated = await regeneratePlan(selectedId, wfId)
      setDetail(updated)
      setBindWorkflowId(updated.workflow_definition_id ?? '')
      await loadTasks(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '从工作流生成计划失败')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleStartWorkflow() {
    if (!selectedId || startingWf) return
    setStartingWf(true)
    setError(null)
    try {
      const run = await startTaskWorkflow(selectedId, {
        workflow_definition_id: bindWorkflowId || detail?.workflow_definition_id || null,
      })
      await loadTasks(selectedId)
      await loadDetail(selectedId)
      const defId = run.workflow_id || detail?.workflow_definition_id
      if (defId) {
        navigate(`/workflows?def=${encodeURIComponent(defId)}&run=${encodeURIComponent(run.id)}`)
      } else {
        navigate('/runs')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '启动工作流失败')
    } finally {
      setStartingWf(false)
    }
  }

  async function handleAddWorkflow(workflowId: string) {
    if (!selectedId || !workflowId || savingBinds) return
    setSavingBinds(true)
    setError(null)
    try {
      const withPlan = await regeneratePlan(selectedId, workflowId)
      setDetail(withPlan)
      setBindWorkflowId(withPlan.workflow_definition_id ?? workflowId)
      setBoundIds(withPlan.bound_workflow_ids?.length ? withPlan.bound_workflow_ids : [...boundIds, workflowId])
      setShowAddWorkflow(false)
      await loadTasks(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加工作流失败')
    } finally {
      setSavingBinds(false)
    }
  }

  async function handleRemoveWorkflow(workflowId: string) {
    if (!selectedId || savingBinds) return
    if (!confirm('移除该工作流及其开发计划表？')) return
    const nextBound = boundIds.filter(id => id !== workflowId)
    setSavingBinds(true)
    setError(null)
    try {
      const active =
        detail?.workflow_definition_id === workflowId
          ? (nextBound[0] ?? null)
          : (detail?.workflow_definition_id ?? nextBound[0] ?? null)
      const updated = await updateDailyTask(selectedId, {
        bound_workflow_ids: nextBound,
        workflow_definition_id: active,
      })
      setDetail(updated)
      setBindWorkflowId(updated.workflow_definition_id ?? '')
      setBoundIds(updated.bound_workflow_ids ?? nextBound)
      await loadTasks(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '移除工作流失败')
    } finally {
      setSavingBinds(false)
    }
  }

  async function handleDelete() {
    if (!selectedId || !confirm('确定删除该今日任务？')) return
    setDeleting(true)
    setError(null)
    try {
      await deleteDailyTask(selectedId)
      await loadTasks(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  async function handleContinueTask(taskId: string, jump = true) {
    if (continuing) return
    setContinuing(true)
    setError(null)
    try {
      const created = await continueDailyTask(taskId, today)
      if (jump) {
        setPlanDate(today)
        await loadTasks(created.id, today)
        await loadDetail(created.id)
      } else {
        await loadTasks(selectedId)
        if (selectedId === taskId) await loadDetail(taskId)
      }
      return created
    } catch (e) {
      setError(e instanceof Error ? e.message : '续作失败')
      return null
    } finally {
      setContinuing(false)
    }
  }

  async function handleContinueAllCandidates() {
    const ids = carrySelectedIds.filter(id => carryCandidates.some(t => t.id === id))
    if (!ids.length || continuing) return
    setContinuing(true)
    setError(null)
    try {
      let lastId: string | null = null
      for (const id of ids) {
        const created = await continueDailyTask(id, today)
        lastId = created.id
      }
      setPlanDate(today)
      await loadTasks(lastId, today)
      if (lastId) await loadDetail(lastId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '批量续作失败')
      await loadTasks(null, today)
    } finally {
      setContinuing(false)
    }
  }

  function toggleCarrySelected(taskId: string) {
    setCarrySelectedIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId],
    )
  }

  async function openCarryPreview(taskId: string) {
    setCarryPreviewLoading(true)
    setError(null)
    try {
      const task = await getDailyTask(taskId)
      setCarryPreview(task)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载任务详情失败')
    } finally {
      setCarryPreviewLoading(false)
    }
  }

  async function handleContinueFromPreview() {
    if (!carryPreview || continuing) return
    const sourceId = carryPreview.id
    setCarryPreview(null)
    await handleContinueTask(sourceId, true)
  }

  async function handleSaveRequirement() {
    if (!selectedId || savingMeta) return
    const title = editTitle.trim()
    if (!title) {
      setError('标题不能为空')
      return
    }
    setSavingMeta(true)
    setError(null)
    try {
      const updated = await updateDailyTask(selectedId, {
        title,
        requirement: editRequirement.trim(),
      })
      setDetail(updated)
      setEditTitle(updated.title)
      setEditRequirement(updated.requirement || '')
      await loadTasks(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存任务要求失败')
    } finally {
      setSavingMeta(false)
    }
  }

  async function handleMarkStatus(status: 'todo' | 'in_progress' | 'done') {
    if (!selectedId) return
    try {
      const updated = await updateDailyTask(selectedId, { status })
      setDetail(updated)
      await loadTasks(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新状态失败')
    }
  }

  function readNoteFormValues() {
    const fd = noteFormRef.current ? new FormData(noteFormRef.current) : null
    const fromForm = {
      title: String(fd?.get('note_title') ?? ''),
      body: String(fd?.get('note_body') ?? ''),
      filePath: String(fd?.get('note_file_path') ?? ''),
    }
    const draft = noteDraftRef.current
    // 优先用表单当前值；若切 Tab 导致字段被卸掉读到空，则回退草稿
    return {
      title: fromForm.title || draft.title,
      body: fromForm.body || draft.body,
      filePath: fromForm.filePath || draft.filePath,
    }
  }

  function clearNoteDraft() {
    noteDraftRef.current = { title: '', body: '', filePath: '' }
  }

  async function submitNotePayload(payload: {
    kind: 'markdown' | 'file'
    title: string
    body: string
    file_path: string
  }) {
    if (!selectedId) {
      setNoteError('请先选择或创建一个今日任务')
      return
    }
    if (savingSide) return
    setSavingSide(true)
    setNoteError(null)
    setError(null)
    try {
      await createTaskNote(selectedId, payload)
      clearNoteDraft()
      setNoteFormKey(k => k + 1)
      await loadDetail(selectedId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '添加笔记失败'
      setNoteError(msg)
      setError(msg)
    } finally {
      setSavingSide(false)
    }
  }

  async function handleNoteFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!selectedId) {
      setNoteError('请先选择或创建一个今日任务')
      return
    }
    const name = file.name
    const isTextLike =
      /\.(md|markdown|txt|json|ya?ml|csv|xml|html?|log)$/i.test(name) ||
      file.type.startsWith('text/') ||
      file.type === 'application/json'
    try {
      if (isTextLike) {
        const text = await file.text()
        if (!text.trim()) {
          setNoteError('文件内容为空')
          return
        }
        await submitNotePayload({
          kind: 'markdown',
          title: name.replace(/\.[^.]+$/, '') || name,
          body: text,
          file_path: '',
        })
      } else {
        await submitNotePayload({
          kind: 'file',
          title: name,
          body: `已选择本地文件：${name}`,
          file_path: name,
        })
      }
    } catch {
      setNoteError('读取文件失败')
    }
  }

  async function handleAddNote(e?: { preventDefault?: () => void }) {
    e?.preventDefault?.()
    if (!selectedId) {
      setNoteError('请先选择或创建一个今日任务')
      return
    }
    if (savingSide) return
    const { title, body, filePath } = readNoteFormValues()
    const payload = resolveNotePayload('markdown', title, body, filePath)
    if ('error' in payload) {
      setNoteError(payload.error)
      return
    }
    await submitNotePayload(payload)
  }

  async function handleDeleteNote(noteId: string) {
    if (!selectedId || !confirm('删除该笔记？')) return
    try {
      await deleteTaskNote(selectedId, noteId)
      await loadDetail(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除笔记失败')
    }
  }

  async function handleDownloadNote(noteId: string) {
    if (!selectedId) return
    try {
      await downloadTaskNote(selectedId, noteId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '下载失败')
    }
  }

  async function handleAddMemory() {
    if (!selectedId || !memoryContent.trim() || savingSide) return
    setSavingSide(true)
    setError(null)
    try {
      await createTaskMemory(selectedId, {
        content: memoryContent.trim(),
        pinned: memoryPinned,
      })
      setMemoryContent('')
      setMemoryPinned(false)
      await loadDetail(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加记忆失败')
    } finally {
      setSavingSide(false)
    }
  }

  async function handleTogglePin(memoryId: string, pinned: boolean) {
    if (!selectedId) return
    try {
      await updateTaskMemory(selectedId, memoryId, { pinned: !pinned })
      await loadDetail(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新记忆失败')
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    if (!selectedId || !confirm('删除该记忆？')) return
    try {
      await deleteTaskMemory(selectedId, memoryId)
      await loadDetail(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除记忆失败')
    }
  }

  const selectedSummary = tasks.find(t => t.id === selectedId)
  const chatTaskTitle = (detail?.title || selectedSummary?.title || '').trim() || '未命名任务'
  const workflowPlans: ApiWorkflowPlanGroup[] = detail?.workflow_plans?.length
    ? detail.workflow_plans
    : (detail?.workflow_definition_id
      ? [{
          workflow_definition_id: detail.workflow_definition_id,
          workflow_name: detail.workflow_name,
          workflow_title: detail.workflow_title,
          is_active: true,
          latest_run_id: detail.latest_workflow_run_id ?? null,
          active_run_id: detail.active_workflow_run_id ?? null,
          plan_item_count: detail.plan_items.length,
          plan_done_count: detail.plan_items.filter(p => p.status === 'done').length,
          plan_items: detail.plan_items,
        }]
      : [])
  const isToday = planDate === today
  const canContinueSelected =
    !!detail &&
    detail.plan_date < today &&
    detail.status !== 'done' &&
    !detail.continued_to_id
  const stepRate =
    overview && overview.plan_item_count > 0
      ? Math.round((overview.plan_done_count / overview.plan_item_count) * 100)
      : 0

  function renderPlanItems(items: ApiTaskPlanItem[]) {
    if (items.length === 0) {
      return <div className="p-6 text-sm text-text-muted">暂无步骤。点击「生成/刷新计划表」。</div>
    }
    return (
      <div className="divide-y divide-border-subtle">
        {items.map((item, i) => (
          <div key={item.id} className="px-6 py-5 flex gap-5">
            <div className="flex flex-col items-center gap-1 shrink-0 w-8">
              {planStatusIcon(item.status)}
              <span className="text-[10px] text-text-muted font-mono">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                {item.linked_step_key && (
                  <span className="text-xs font-mono text-text-muted bg-surface-2 px-2 py-0.5 rounded">
                    {item.linked_step_key}
                  </span>
                )}
                <span className="text-sm font-medium text-text-strong">{item.title}</span>
                <Badge variant={item.status === 'done' ? 'success' : item.status === 'in_progress' ? 'accent' : 'default'}>
                  {item.status === 'done' ? '完成' : item.status === 'in_progress' ? '进行中' : '待办'}
                </Badge>
              </div>
              <p className="text-sm text-text leading-relaxed">{item.detail}</p>
              {(item.agent_name || item.agent_id) && (
                <div className="flex items-center gap-2 pt-1">
                  <StatusDot status={item.status === 'in_progress' ? 'running' : item.status === 'done' ? 'connected' : 'idle'} />
                  <span className="text-xs font-mono text-text-muted">{item.agent_name ?? item.agent_id}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="flex flex-1 min-h-0">
      <div className="w-80 shrink-0 border-r border-border-subtle bg-surface-1 flex flex-col">
        <div className="px-5 py-5 border-b border-border-subtle space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ListTodo className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-text-strong">任务清单</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={planDate}
              onChange={e => setPlanDate(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg border border-border-subtle bg-surface-2 text-sm"
            />
            <Btn
              variant={isToday ? 'primary' : 'secondary'}
              size="sm"
              type="button"
              onClick={() => setPlanDate(today)}
            >
              今天
            </Btn>
          </div>
          {overview && (
            <div className="rounded-lg bg-surface-2/80 border border-border-subtle p-3 space-y-1.5 text-xs text-text-muted">
              <div className="text-text-strong font-medium text-sm">
                {isToday ? '今日' : planDate} 总览
              </div>
              <div>
                任务 {overview.done_count}/{overview.task_count} 完成
                · 待办 {overview.todo_count}
                · 进行中 {overview.in_progress_count}
              </div>
              <div>
                计划步骤 {overview.plan_done_count}/{overview.plan_item_count}
                {overview.plan_item_count > 0 ? `（${stepRate}%）` : ''}
              </div>
            </div>
          )}
          {isToday && carryCandidates.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  showCarryPicker
                    ? 'border-accent/30 bg-accent/5 text-text-strong'
                    : 'border-border-subtle bg-surface-2/60 text-text-muted hover:border-border hover:text-text-strong'
                }`}
                onClick={() => setShowCarryPicker(v => !v)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
                  {showCarryPicker ? '收起往日续作' : '从往日任务续作'}
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-1 border border-border-subtle">
                  {carryCandidates.length}
                </span>
              </button>
              {showCarryPicker && (
                <div className="rounded-lg border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                  <div className="text-[11px] text-text-muted">
                    近 14 天未完成 · 点击标题查看详情，勾选后批量续作
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {carryCandidates.map(t => {
                      const checked = carrySelectedIds.includes(t.id)
                      return (
                        <div
                          key={t.id}
                          className="flex items-start gap-2 text-[11px] text-text-muted rounded px-1 py-0.5 hover:bg-surface-1"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() => toggleCarrySelected(t.id)}
                          />
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left hover:text-accent"
                            onClick={() => void openCarryPreview(t.id)}
                          >
                            <span className="font-mono text-text-muted">{t.plan_date}</span>
                            <span className="mx-1">·</span>
                            <span className="text-text-strong">{t.title}</span>
                            <span className="ml-1 text-text-muted">
                              ({t.plan_done_count}/{t.plan_item_count})
                            </span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      className="text-[11px] text-text-muted hover:text-text-strong"
                      onClick={() => setCarrySelectedIds(carryCandidates.map(t => t.id))}
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-text-muted hover:text-text-strong"
                      onClick={() => setCarrySelectedIds([])}
                    >
                      清空
                    </button>
                    <button
                      type="button"
                      disabled={continuing || carrySelectedIds.length === 0}
                      className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] border border-dashed border-border-subtle text-text-muted hover:border-accent/50 hover:text-accent disabled:opacity-40"
                      onClick={() => void handleContinueAllCandidates()}
                    >
                      <CornerDownRight className="w-3 h-3" />
                      {continuing ? '续作中…' : `续作所选 ${carrySelectedIds.length}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && <div className="p-4 text-sm text-text-muted">加载中…</div>}
          {!loading && tasks.length === 0 && (
            <div className="p-4 text-sm text-text-muted text-center">该日暂无任务</div>
          )}
          {tasks.map(task => {
            const canContinueHere =
              planDate < today && task.status !== 'done' && !task.continued_to_id
            return (
            <div
              key={task.id}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedId === task.id
                  ? 'border-accent/40 bg-accent/5 shadow-sm'
                  : 'border-transparent hover:bg-surface-2'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedId(task.id)}
                className="w-full text-left"
              >
              <div className="flex items-start gap-3">
                {task.type === 'dev' ? (
                  <Code2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-strong leading-snug">{task.title}</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant={(statusBadge[task.status as keyof typeof statusBadge] ?? statusBadge.todo).variant}>
                      {(statusBadge[task.status as keyof typeof statusBadge] ?? statusBadge.todo).label}
                    </Badge>
                    {task.workflow_title && <Badge variant="info">{task.workflow_title}</Badge>}
                    {task.continued_from_id && <Badge variant="default">续作</Badge>}
                    {task.continued_to_id && <Badge variant="default">已续走</Badge>}
                  </div>
                  <div className="mt-2 text-[11px] text-text-muted">
                    {task.plan_done_count}/{task.plan_item_count} 步骤
                  </div>
                </div>
              </div>
              </button>
              {canContinueHere && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={continuing || carryPreviewLoading}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border border-dashed border-border-subtle text-text-muted hover:border-accent/50 hover:text-accent disabled:opacity-40"
                    onClick={e => {
                      e.stopPropagation()
                      void openCarryPreview(task.id)
                    }}
                  >
                    <CornerDownRight className="w-3 h-3" />
                    查看并续作
                  </button>
                </div>
              )}
            </div>
            )
          })}
        </div>

        <div className="p-4 border-t border-border-subtle">
          <Btn variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="w-3.5 h-3.5" />
            创建任务
          </Btn>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-10 py-8 min-w-0">
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-surface-1 border border-border-subtle shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle sticky top-0 bg-surface-1">
                <h2 className="text-base font-medium text-text-strong">创建任务</h2>
                <button type="button" onClick={closeCreateModal} className="p-1 rounded-md hover:bg-surface-3 text-text-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateTask} className="p-6 space-y-4">
                {createError && (
                  <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-sm text-danger">{createError}</div>
                )}
                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">短标题</span>
                  <input
                    value={createTitle}
                    onChange={e => setCreateTitle(e.target.value)}
                    placeholder="可选；不填则从需求首行生成"
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-2 text-sm"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">详细需求</span>
                  <textarea
                    value={createRequirement}
                    onChange={e => setCreateRequirement(e.target.value)}
                    rows={5}
                    placeholder="功能目标、约束、验收标准…"
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-2 text-sm resize-y min-h-[120px]"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">绑定工作流（可选）</span>
                  <select
                    value={createWorkflowId}
                    onChange={e => setCreateWorkflowId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-2 text-sm"
                  >
                    <option value="">不绑定</option>
                    {workflows.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.title}
                        {w.tags?.length ? ` [${w.tags.join('/')}]` : ''}
                        {` (${w.step_count} 步)`}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[11px] text-text-muted">
                  仅保存任务；需要计划表时可在详情里「刷新开发计划」。
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <Btn variant="secondary" size="sm" type="button" onClick={closeCreateModal} disabled={adding}>
                    取消
                  </Btn>
                  <Btn variant="primary" size="sm" type="submit" disabled={adding}>
                    {adding ? '保存中…' : '保存'}
                  </Btn>
                </div>
              </form>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">{error}</div>
        )}

        {!selectedSummary && !loading && (
          <div className="text-sm text-text-muted py-20 text-center">选择左侧任务，或点击「创建任务」</div>
        )}

        {selectedSummary && (
          <>
            <PageHeader
              title={detail?.title ?? selectedSummary.title}
              description={detail?.summary || selectedSummary.summary || '暂无系统摘要'}
              action={
                <div className="flex gap-2 flex-wrap">
                  {canContinueSelected && (
                    <button
                      type="button"
                      disabled={continuing || carryPreviewLoading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-dashed border-border-subtle text-text-muted hover:border-accent/50 hover:text-accent disabled:opacity-40"
                      onClick={() => void openCarryPreview(detail.id)}
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                      查看并续作
                    </button>
                  )}
                  <Btn
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowAgentChat(true)
                      setAgentChatCollapsed(false)
                    }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Agent 对话
                  </Btn>
                  <Btn variant="secondary" size="sm" onClick={handleRegeneratePlan} disabled={regenerating}>
                    <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                    {regenerating ? '生成中…' : '刷新开发计划'}
                  </Btn>
                  {detail?.workflow_definition_id && (
                    <>
                      <Btn variant="primary" size="sm" onClick={handleStartWorkflow} disabled={startingWf}>
                        <Play className="w-3.5 h-3.5" />
                        {startingWf ? '启动中…' : '启动工作流'}
                      </Btn>
                      <Link to={`/workflows?def=${detail.workflow_definition_id}`}>
                        <Btn variant="secondary" size="sm">
                          查看工作流 <ArrowRight className="w-3.5 h-3.5" />
                        </Btn>
                      </Link>
                    </>
                  )}
                  <Btn variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                    <Trash2 className="w-3.5 h-3.5" />删除
                  </Btn>
                </div>
              }
            />

            <div className="mb-6 p-4 rounded-xl bg-surface-1 border border-border-subtle space-y-3">
              <div className="text-sm font-medium text-text-strong">任务要求</div>
              {(detail?.continued_from_id || detail?.continued_to_id) && (
                <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                  {detail.continued_from_id && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border-subtle bg-surface-2 hover:border-accent/40 hover:text-accent"
                      onClick={() => {
                        const id = detail.continued_from_id!
                        const day = detail.continued_from_plan_date
                        if (day) {
                          setPlanDate(day)
                          void loadTasks(id, day).then(() => loadDetail(id))
                        } else {
                          setSelectedId(id)
                        }
                      }}
                    >
                      续自 {detail.continued_from_plan_date || '—'}
                      {detail.continued_from_title ? ` · ${detail.continued_from_title}` : ''}
                    </button>
                  )}
                  {detail.continued_to_id && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border-subtle bg-surface-2 hover:border-accent/40 hover:text-accent"
                      onClick={() => {
                        const id = detail.continued_to_id!
                        const day = detail.continued_to_plan_date
                        if (day) {
                          setPlanDate(day)
                          void loadTasks(id, day).then(() => loadDetail(id))
                        } else {
                          setSelectedId(id)
                        }
                      }}
                    >
                      已续至 {detail.continued_to_plan_date || '—'}
                      {detail.continued_to_title ? ` · ${detail.continued_to_title}` : ''}
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-text-muted -mt-1">
                可在此查看与修改任务要求；启动工作流时优先使用此处内容。
              </p>
              <label className="block space-y-1.5">
                <span className="text-xs text-text-muted">短标题</span>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-0 text-sm"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-text-muted">详细需求</span>
                <textarea
                  value={editRequirement}
                  onChange={e => setEditRequirement(e.target.value)}
                  rows={5}
                  placeholder="功能目标、约束、验收标准…"
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-0 text-sm resize-y min-h-[120px]"
                />
              </label>
              <div className="flex justify-end">
                <Btn variant="primary" size="sm" onClick={handleSaveRequirement} disabled={savingMeta || detailLoading}>
                  {savingMeta ? '保存中…' : '保存要求'}
                </Btn>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-1 border border-border-subtle space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-text-strong">
                  <FileText className="w-4 h-4 text-accent" />
                  笔记与文档
                </div>
                  <p className="text-xs text-text-muted -mt-1">支持 Markdown 笔记、上传文本文件（选完即保存），或登记本地文件路径；点击可预览，可下载。启动工作流时会带入 prompt。</p>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {(detail?.notes ?? []).length === 0 && (
                    <div className="text-xs text-text-muted">暂无笔记</div>
                  )}
                  {(detail?.notes ?? []).map(note => (
                    <div key={note.id} className="p-3 rounded-lg bg-surface-2 border border-border-subtle text-sm space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 text-left flex-1 hover:opacity-90"
                          onClick={() => {
                            setPreviewMode('rendered')
                            setPreviewNote(note)
                          }}
                        >
                          <div className="font-medium text-text-strong truncate flex items-center gap-1.5">
                            {note.title || (note.kind === 'file' ? '文件' : '笔记')}
                            <Eye className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          </div>
                          <Badge variant="default">{note.kind === 'file' ? '文件' : 'Markdown'}</Badge>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            className="text-text-muted hover:text-accent p-0.5"
                            title="下载"
                            onClick={() => void handleDownloadNote(note.id)}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" className="text-text-muted hover:text-danger p-0.5" title="删除" onClick={() => handleDeleteNote(note.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {note.file_path && (
                        <div className="text-xs font-mono text-text-muted break-all">{note.file_path}</div>
                      )}
                      {note.body && <p className="text-xs text-text whitespace-pre-wrap line-clamp-4">{note.body}</p>}
                    </div>
                  ))}
                </div>
                <form
                  key={noteFormKey}
                  ref={noteFormRef}
                  className="space-y-2"
                  onSubmit={e => {
                    e.preventDefault()
                    void handleAddNote(e)
                  }}
                >
                  <div className="flex flex-wrap gap-2 items-center">
                    <Btn
                      variant="ghost"
                      size="sm"
                      type="button"
                      disabled={savingSide || !selectedId}
                      onClick={() => noteFileInputRef.current?.click()}
                    >
                      {savingSide ? '保存中…' : '上传文档'}
                    </Btn>
                    <input
                      ref={noteFileInputRef}
                      type="file"
                      accept=".md,.markdown,.txt,.json,.yaml,.yml,.csv,.xml,.html,.htm,.log,text/*,*"
                      className="hidden"
                      onChange={handleNoteFileSelect}
                    />
                    <span className="text-[11px] text-text-muted">上传文本文件会立即保存；也可手填下方内容后点添加</span>
                  </div>
                  <input
                    name="note_title"
                    defaultValue=""
                    placeholder="标题（可选）"
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-0 text-sm"
                    onInput={e => {
                      noteDraftRef.current.title = (e.target as HTMLInputElement).value
                      if (noteError) setNoteError(null)
                    }}
                  />
                  <textarea
                    name="note_body"
                    defaultValue=""
                    rows={3}
                    placeholder="笔记正文…"
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-0 text-sm resize-y"
                    onInput={e => {
                      noteDraftRef.current.body = (e.target as HTMLTextAreaElement).value
                      if (noteError) setNoteError(null)
                    }}
                  />
                  <input
                    name="note_file_path"
                    defaultValue=""
                    placeholder="可选：本地文件路径，例如 D:\project\docs\spec.md"
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-0 text-sm font-mono"
                    onInput={e => {
                      noteDraftRef.current.filePath = (e.target as HTMLInputElement).value
                      if (noteError) setNoteError(null)
                    }}
                  />
                  {noteError && (
                    <div className="text-xs text-danger">{noteError}</div>
                  )}
                  <Btn variant="secondary" size="sm" type="submit" disabled={savingSide || !selectedId}>
                    <Plus className="w-3.5 h-3.5" />{savingSide ? '添加中…' : '添加'}
                  </Btn>
                </form>
              </div>

              <div className="p-4 rounded-xl bg-surface-1 border border-border-subtle space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-text-strong">
                  <Pin className="w-4 h-4 text-accent" />
                  Agent 记忆
                </div>
                <p className="text-xs text-text-muted -mt-1">钉选项优先注入启动工作流的 prompt。</p>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {(detail?.memories ?? []).length === 0 && (
                    <div className="text-xs text-text-muted">暂无记忆</div>
                  )}
                  {(detail?.memories ?? []).map(mem => (
                    <div key={mem.id} className="p-3 rounded-lg bg-surface-2 border border-border-subtle text-sm space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-text whitespace-pre-wrap flex-1">{mem.content}</p>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            title={mem.pinned ? '取消钉选' : '钉选'}
                            className={mem.pinned ? 'text-accent' : 'text-text-muted hover:text-accent'}
                            onClick={() => handleTogglePin(mem.id, mem.pinned)}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" className="text-text-muted hover:text-danger" onClick={() => handleDeleteMemory(mem.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {mem.pinned && <Badge variant="accent">钉选</Badge>}
                    </div>
                  ))}
                </div>
                <textarea
                  value={memoryContent}
                  onChange={e => setMemoryContent(e.target.value)}
                  rows={3}
                  placeholder="例如：该项目使用 JWT，禁止改动 auth 中间件…"
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-0 text-sm resize-y"
                />
                <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
                  <input type="checkbox" checked={memoryPinned} onChange={e => setMemoryPinned(e.target.checked)} />
                  钉选（优先注入）
                </label>
                <Btn variant="secondary" size="sm" onClick={handleAddMemory} disabled={savingSide || !selectedId || !memoryContent.trim()}>
                  <Plus className="w-3.5 h-3.5" />添加记忆
                </Btn>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-surface-1 border border-border-subtle text-sm flex-wrap">
              <div className="flex items-center gap-2 text-text-muted">
                <Bot className="w-4 h-4" />
                <span>来源：<span className="font-mono text-text">{detail?.plan_author ?? '—'}</span></span>
              </div>
              <div className="flex items-center gap-2 text-text-muted">
                <Clock className="w-4 h-4" />
                <span>更新于 {formatUpdated(detail?.plan_updated_at ?? null)}</span>
              </div>
              <div className="flex gap-2 ml-auto">
                {(['todo', 'in_progress', 'done'] as const).map(s => (
                  <Btn key={s} variant={detail?.status === s ? 'primary' : 'ghost'} size="sm" onClick={() => handleMarkStatus(s)}>
                    {statusBadge[s].label}
                  </Btn>
                ))}
              </div>
            </div>

            <div className="space-y-5 mb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm font-medium text-text-strong">开发计划表</h2>
                  <p className="text-xs text-text-muted mt-1">按工作流分开展示；同一时间只允许一个运行中的工作流。</p>
                </div>
                <Btn variant="primary" size="sm" onClick={() => setShowAddWorkflow(true)} disabled={!selectedId}>
                  <Plus className="w-3.5 h-3.5" />
                  添加工作流
                </Btn>
              </div>
              {detail?.active_workflow_run_id && (
                <p className="text-xs text-accent -mt-2">
                  进行中：{detail.active_workflow_run_id}
                  {' · '}
                  <Link className="underline" to={`/workflows?run=${encodeURIComponent(detail.active_workflow_run_id)}`}>
                    查看运行
                  </Link>
                </p>
              )}
              {detailLoading && <div className="text-sm text-text-muted">加载步骤…</div>}
              {!detailLoading && workflowPlans.length === 0 && (
                <div className="rounded-xl border border-border-subtle bg-surface-1 p-6 text-sm text-text-muted">
                  暂无工作流计划。点击右上角「添加工作流」。
                </div>
              )}
              {workflowPlans.map(group => (
                <div
                  key={group.workflow_definition_id}
                  className={`rounded-xl border shadow-sm overflow-hidden ${
                    group.is_active ? 'border-accent/50 bg-surface-1' : 'border-border-subtle bg-surface-1'
                  }`}
                >
                  <div className="px-6 py-4 border-b border-border-subtle bg-surface-2/50 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-text-strong">
                          {group.workflow_title || group.workflow_name || group.workflow_definition_id}
                        </h3>
                        {group.is_active && <Badge variant="accent">默认激活</Badge>}
                        <Badge variant="default">
                          {group.plan_done_count}/{group.plan_item_count || group.plan_items.length} 步完成
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted mt-1 font-mono">
                        {group.workflow_name || group.workflow_definition_id}
                        {group.latest_run_id ? ` · 最近 ${group.latest_run_id}` : ''}
                        {group.active_run_id ? ` · 进行中 ${group.active_run_id}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Btn
                        variant="ghost"
                        size="sm"
                        disabled={regenerating}
                        onClick={async () => {
                          if (!selectedId) return
                          setRegenerating(true)
                          setError(null)
                          try {
                            setBindWorkflowId(group.workflow_definition_id)
                            const updated = await regeneratePlan(selectedId, group.workflow_definition_id)
                            setDetail(updated)
                            setBoundIds(updated.bound_workflow_ids?.length ? updated.bound_workflow_ids : boundIds)
                            await loadTasks(selectedId)
                          } catch (e) {
                            setError(e instanceof Error ? e.message : '刷新计划失败')
                          } finally {
                            setRegenerating(false)
                          }
                        }}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                        刷新计划表
                      </Btn>
                      <Link to={`/workflows?def=${encodeURIComponent(group.workflow_definition_id)}`}>
                        <Btn variant="secondary" size="sm">查看定义</Btn>
                      </Link>
                      <Btn
                        variant="primary"
                        size="sm"
                        disabled={startingWf || Boolean(detail?.active_workflow_run_id)}
                        onClick={async () => {
                          if (!selectedId || startingWf) return
                          setStartingWf(true)
                          setError(null)
                          try {
                            const run = await startTaskWorkflow(selectedId, {
                              workflow_definition_id: group.workflow_definition_id,
                            })
                            await loadTasks(selectedId)
                            await loadDetail(selectedId)
                            navigate(`/workflows?def=${encodeURIComponent(group.workflow_definition_id)}&run=${encodeURIComponent(run.id)}`)
                          } catch (e) {
                            setError(e instanceof Error ? e.message : '启动工作流失败')
                          } finally {
                            setStartingWf(false)
                          }
                        }}
                      >
                        <Play className="w-3.5 h-3.5" />
                        {detail?.active_workflow_run_id ? '已有运行中' : '启动此工作流'}
                      </Btn>
                      <Btn
                        variant="ghost"
                        size="sm"
                        disabled={savingBinds}
                        onClick={() => handleRemoveWorkflow(group.workflow_definition_id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        移除
                      </Btn>
                    </div>
                  </div>
                  {renderPlanItems(group.plan_items)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showAddWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAddWorkflow(false)}>
          <div
            className="w-full max-w-md max-h-[80vh] overflow-hidden rounded-xl bg-surface-1 border border-border-subtle shadow-xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle">
              <div className="text-sm font-medium text-text-strong">添加工作流</div>
              <button type="button" className="text-text-muted hover:text-text-strong" onClick={() => setShowAddWorkflow(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-border-subtle">
              <Link to="/workflows/new" className="inline-flex">
                <Btn variant="secondary" size="sm">
                  <Plus className="w-3.5 h-3.5" />
                  去创建新工作流
                </Btn>
              </Link>
            </div>
            <div className="overflow-y-auto p-2">
              {workflows.filter(w => !boundIds.includes(w.id)).length === 0 && (
                <div className="px-3 py-6 text-sm text-text-muted text-center">
                  没有可添加的工作流，请先创建。
                </div>
              )}
              {workflows.filter(w => !boundIds.includes(w.id)).map(w => (
                <button
                  key={w.id}
                  type="button"
                  disabled={savingBinds}
                  className="w-full text-left px-3 py-3 rounded-lg hover:bg-surface-2 transition-colors"
                  onClick={() => handleAddWorkflow(w.id)}
                >
                  <div className="text-sm font-medium text-text-strong">{w.title}</div>
                  <div className="text-xs text-text-muted font-mono mt-0.5">
                    {w.name} · {w.step_count} 步
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(carryPreview || carryPreviewLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            if (!carryPreviewLoading) setCarryPreview(null)
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-surface-1 border border-border-subtle shadow-xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-subtle">
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-strong truncate">
                  {carryPreviewLoading ? '加载任务详情…' : (carryPreview?.title || '任务详情')}
                </div>
                {carryPreview && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-text-muted">
                    <span className="font-mono">{carryPreview.plan_date}</span>
                    <Badge variant={(statusBadge[carryPreview.status as keyof typeof statusBadge] ?? statusBadge.todo).variant}>
                      {(statusBadge[carryPreview.status as keyof typeof statusBadge] ?? statusBadge.todo).label}
                    </Badge>
                    {carryPreview.workflow_title && (
                      <Badge variant="info">{carryPreview.workflow_title}</Badge>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="text-text-muted hover:text-text-strong"
                disabled={carryPreviewLoading}
                onClick={() => setCarryPreview(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto space-y-4 text-sm">
              {carryPreviewLoading && (
                <div className="text-text-muted py-8 text-center">加载中…</div>
              )}
              {carryPreview && (
                <>
                  <div>
                    <div className="text-xs text-text-muted mb-1">任务要求</div>
                    <div className="whitespace-pre-wrap text-text leading-relaxed rounded-lg bg-surface-2 border border-border-subtle p-3 text-xs max-h-40 overflow-y-auto">
                      {(carryPreview.requirement || '').trim() || '（无详细需求）'}
                    </div>
                  </div>
                  {carryPreview.summary?.trim() && (
                    <div>
                      <div className="text-xs text-text-muted mb-1">摘要</div>
                      <p className="text-xs text-text-muted whitespace-pre-wrap">{carryPreview.summary}</p>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-text-muted mb-1">
                      计划步骤 · {carryPreview.plan_items.filter(p => p.status === 'done').length}/{carryPreview.plan_items.length} 完成
                    </div>
                    {carryPreview.plan_items.length === 0 ? (
                      <div className="text-xs text-text-muted">暂无步骤</div>
                    ) : (
                      <ul className="space-y-1 max-h-36 overflow-y-auto">
                        {carryPreview.plan_items.map(item => (
                          <li key={item.id} className="flex items-start gap-2 text-xs">
                            {planStatusIcon(item.status)}
                            <span className="text-text-strong min-w-0 truncate">{item.title}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-text-muted mb-1">
                      笔记与文档 · {carryPreview.notes?.length ?? 0}
                    </div>
                    {(carryPreview.notes?.length ?? 0) === 0 ? (
                      <div className="text-xs text-text-muted">暂无笔记</div>
                    ) : (
                      <ul className="space-y-1.5 max-h-28 overflow-y-auto">
                        {carryPreview.notes.map(n => (
                          <li key={n.id} className="text-xs rounded-md bg-surface-2 border border-border-subtle px-2.5 py-1.5">
                            <div className="font-medium text-text-strong truncate">
                              {n.title || (n.kind === 'file' ? '文件' : '笔记')}
                            </div>
                            {n.body?.trim() && (
                              <p className="text-text-muted line-clamp-2 mt-0.5 whitespace-pre-wrap">{n.body}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {(carryPreview.memories?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs text-text-muted mb-1">
                        Agent 记忆 · {carryPreview.memories.length}
                      </div>
                      <ul className="space-y-1 max-h-24 overflow-y-auto">
                        {carryPreview.memories.map(m => (
                          <li key={m.id} className="text-xs text-text-muted line-clamp-2">
                            {m.pinned ? '📌 ' : ''}{m.content}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-border-subtle flex justify-end gap-2">
              <Btn variant="secondary" size="sm" type="button" onClick={() => setCarryPreview(null)}>
                关闭
              </Btn>
              {carryPreview && carryPreview.plan_date < today && carryPreview.status !== 'done' && !carryPreview.continued_to_id && (
                <Btn
                  variant="primary"
                  size="sm"
                  type="button"
                  disabled={continuing}
                  onClick={() => void handleContinueFromPreview()}
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                  {continuing ? '续作中…' : '确认续到今天'}
                </Btn>
              )}
            </div>
          </div>
        </div>
      )}

      {previewNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreviewNote(null)}>
          <div
            className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl bg-surface-1 border border-border-subtle shadow-xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-subtle">
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-strong truncate">
                  {previewNote.title || (previewNote.kind === 'file' ? '文件' : '笔记')}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="default">{previewNote.kind === 'file' ? '文件' : 'Markdown'}</Badge>
                  {previewNote.file_path && (
                    <span className="text-xs font-mono text-text-muted truncate">{previewNote.file_path}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-border-subtle bg-surface-2 text-text-muted hover:text-accent hover:border-accent/40"
                  title="下载"
                  onClick={() => void handleDownloadNote(previewNote.id)}
                >
                  <Download className="w-3.5 h-3.5" />
                  下载
                </button>
                <div className="flex rounded-lg border border-border-subtle overflow-hidden">
                  <button
                    type="button"
                    className={`px-2.5 py-1 text-xs ${previewMode === 'rendered' ? 'bg-accent text-white' : 'bg-surface-2 text-text-muted'}`}
                    onClick={() => setPreviewMode('rendered')}
                  >
                    预览
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 text-xs ${previewMode === 'source' ? 'bg-accent text-white' : 'bg-surface-2 text-text-muted'}`}
                    onClick={() => setPreviewMode('source')}
                  >
                    源码
                  </button>
                </div>
                <button type="button" className="text-text-muted hover:text-text-strong" onClick={() => setPreviewNote(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              {previewMode === 'rendered' ? (
                previewNote.body?.trim() ? (
                  <MarkdownPreview content={previewNote.body} />
                ) : previewNote.file_path ? (
                  <div className="text-sm text-text-muted">
                    （无正文）文件路径：
                    <div className="mt-2 font-mono text-xs break-all text-text">{previewNote.file_path}</div>
                  </div>
                ) : (
                  <div className="text-sm text-text-muted">（空笔记）</div>
                )
              ) : (
                <pre className="text-sm text-text whitespace-pre-wrap leading-relaxed font-mono">
                  {previewNote.body?.trim()
                    || (previewNote.file_path ? `（无正文）文件路径：\n${previewNote.file_path}` : '（空笔记）')}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedId && showAgentChat && (
        agentChatCollapsed ? (
          <div
            ref={chatWindowRef}
            style={chatFloatStyle}
            onPointerMove={onChatDragMove}
            onPointerUp={onChatDragEnd}
            onPointerCancel={onChatDragEnd}
            className="fixed z-40 touch-none"
          >
            <button
              type="button"
              data-chat-drag="pill"
              onPointerDown={onChatDragStart}
              onClick={() => {
                if (suppressChatClickRef.current) return
                setAgentChatCollapsed(false)
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-full bg-surface-1 border border-border shadow-lg text-sm text-text-strong hover:border-accent transition-colors cursor-grab active:cursor-grabbing max-w-[min(360px,calc(100vw-3rem))]"
            >
              <MessageSquare className="w-4 h-4 text-accent shrink-0" />
              <span className="shrink-0">Agent 对话</span>
              <span className="text-xs text-text-muted truncate" title={chatTaskTitle}>
                {chatTaskTitle}
              </span>
            </button>
          </div>
        ) : (
          <div
            ref={chatWindowRef}
            style={chatFloatStyle}
            onPointerMove={onChatDragMove}
            onPointerUp={onChatDragEnd}
            onPointerCancel={onChatDragEnd}
            className="fixed z-40 flex flex-col rounded-xl bg-surface-1 border border-border shadow-2xl overflow-hidden touch-none"
          >
            <div
              className="px-4 py-3 border-b border-border-subtle space-y-2 shrink-0 bg-surface-1 cursor-grab active:cursor-grabbing select-none"
              onPointerDown={onChatDragStart}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-sm font-medium text-text-strong shrink-0">Agent 对话</span>
                  </div>
                  <div className="mt-1 text-xs text-text-muted truncate pl-6" title={chatTaskTitle}>
                    当前任务：{chatTaskTitle}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="收起"
                    className="p-1.5 rounded-md text-text-muted hover:text-text-strong hover:bg-surface-2"
                    onClick={() => setAgentChatCollapsed(true)}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="关闭"
                    className="p-1.5 rounded-md text-text-muted hover:text-text-strong hover:bg-surface-2"
                    onClick={() => {
                      setShowAgentChat(false)
                      setAgentChatCollapsed(false)
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-text-muted leading-snug">
                首轮附带任务文档；同一会话后续不再重复附带。可拖动右下角调整窗口大小。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={chatAgentId}
                  onChange={e => setChatAgentId(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-border-subtle bg-surface-0 text-xs"
                >
                  {agents.length === 0 && <option value="">暂无 Agent</option>}
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <Btn
                  variant="secondary"
                  size="sm"
                  disabled={!chatAgentId || chatSending}
                  onClick={() => {
                    setChatRunId(null)
                    setChatHint('新会话：下一条消息将附带文档')
                  }}
                >
                  新会话
                </Btn>
              </div>
              {chatHint && <div className="text-[11px] text-accent">{chatHint}</div>}
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              {chatRunId ? (
                <LiveRunPanel
                  key={chatRunId}
                  runId={chatRunId}
                  allowSendWhenIdle
                  onSend={async text => {
                    await handleTaskAgentSend(text)
                  }}
                />
              ) : (
                <div className="flex flex-col h-full min-h-0">
                  <div className="flex-1 flex items-center justify-center p-5 text-sm text-text-muted text-center">
                    发送第一条消息开始对话（将附带任务文档）
                  </div>
                  <AgentCommandInput
                    disabled={!chatAgentId || chatSending}
                    disabledReason={
                      !chatAgentId ? '请先选择 Agent' : chatSending ? '发送中…' : undefined
                    }
                    onSend={text => { void handleTaskAgentSend(text, { newSession: true }) }}
                  />
                </div>
              )}
            </div>
            <div
              data-chat-resize
              onPointerDown={onChatResizeStart}
              title="拖动调整大小"
              className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize z-10"
              style={{ touchAction: 'none' }}
            >
              <svg
                viewBox="0 0 16 16"
                className="absolute right-1 bottom-1 w-3 h-3 text-text-muted pointer-events-none"
                aria-hidden
              >
                <path d="M14 6v8H6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 10v4h-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        )
      )}
    </div>
  )
}