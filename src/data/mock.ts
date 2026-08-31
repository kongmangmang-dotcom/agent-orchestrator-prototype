export type ProviderType = 'model_api' | 'coding_agent' | 'local_runtime'

export interface Provider {
  id: string
  name: string
  type: ProviderType
  typeLabel: string
  endpoint: string
  defaultModel: string
  status: 'connected' | 'disconnected' | 'error'
  capabilities: string[]
}

export interface AgentConfig {
  id: string
  name: string
  provider: string
  model: string
  role: string
  roleLabel: string
  workspace: string
  permissions: {
    readFiles: boolean
    writeFiles: boolean
    runCommands: boolean
    runTests: boolean
    network: boolean
  }
  limits: {
    timeoutMinutes: number
    maxRounds: number
  }
  streaming: boolean
  status: 'idle' | 'running' | 'paused'
}

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval'

export interface WorkflowStep {
  id: string
  label: string
  agentId: string
  agentName: string
  provider: string
  dependsOn: string[]
  status: StepStatus
  parallel?: boolean
  runId?: string
  duration?: string
  progress?: number
}

export interface Workflow {
  id: string
  name: string
  title: string
  status: 'running' | 'completed' | 'pending' | 'failed' | 'paused'
  progress: number
  startedAt: string
  activeAgents: number
  steps: WorkflowStep[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'thinking'
  content: string
  timestamp: string
  streaming?: boolean
  toolCalls?: { name: string; args: string }[]
}

export interface FileChange {
  path: string
  action: 'created' | 'modified' | 'deleted'
  lines: string
  diff?: string
}

export interface AgentExecution {
  stepId: string
  workflowId: string
  runId: string
  agentId: string
  agentName: string
  provider: string
  status: StepStatus
  startedAt: string
  duration: string
  tokens: number
  events: AgentEvent[]
  messages: ChatMessage[]
  fileChanges: FileChange[]
  commandOutput?: string
}

export interface AgentEvent {
  runId: string
  agentId: string
  type: string
  status: 'running' | 'completed' | 'failed' | 'waiting'
  content: string
  metadata?: Record<string, string>
  timestamp: string
}

export interface TaskPlanItem {
  id: string
  time?: string
  title: string
  detail: string
  status: 'todo' | 'in_progress' | 'done'
  agent?: string
  linkedWorkflowStep?: string
}

export interface DailyTask {
  id: string
  title: string
  type: 'normal' | 'dev'
  status: 'todo' | 'in_progress' | 'done'
  priority?: 'high' | 'medium' | 'low'
  workflowId?: string
  steps?: { label: string; status: string }[]
  summary?: string
  planItems?: TaskPlanItem[]
  planUpdatedAt?: string
  planAuthor?: string
}

export const providers: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'model_api',
    typeLabel: '模型 API',
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    status: 'connected',
    capabilities: ['规划', '分析', '评审', '问答'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'model_api',
    typeLabel: '模型 API',
    endpoint: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4',
    status: 'connected',
    capabilities: ['调研', '代码分析', '长文本'],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    type: 'model_api',
    typeLabel: '模型 API',
    endpoint: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.5-pro',
    status: 'connected',
    capabilities: ['评审', '多模态', '技术分析'],
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    type: 'coding_agent',
    typeLabel: '编程 Agent',
    endpoint: 'codex run',
    defaultModel: 'default',
    status: 'connected',
    capabilities: ['读写代码', '执行命令', 'Git Diff'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    type: 'coding_agent',
    typeLabel: '编程 Agent',
    endpoint: 'cursor agent',
    defaultModel: 'composer',
    status: 'disconnected',
    capabilities: ['前端开发', 'IDE 集成'],
  },
  {
    id: 'opencode',
    name: 'OpenCode CLI',
    type: 'coding_agent',
    typeLabel: '编程 Agent',
    endpoint: 'opencode run',
    defaultModel: 'default',
    status: 'connected',
    capabilities: ['测试编写', '命令执行'],
  },
  {
    id: 'pi',
    name: 'Pi',
    type: 'local_runtime',
    typeLabel: '本地 Runtime',
    endpoint: 'localhost:3141',
    defaultModel: '—',
    status: 'disconnected',
    capabilities: ['工具调用', '本地自动化'],
  },
  {
    id: 'hermes',
    name: 'Hermes',
    type: 'local_runtime',
    typeLabel: '本地 Runtime',
    endpoint: 'hermes serve',
    defaultModel: '—',
    status: 'disconnected',
    capabilities: ['长期运行', 'MCP'],
  },
]

export const agents: AgentConfig[] = [
  {
    id: 'openai-planner',
    name: 'openai-planner',
    provider: 'openai',
    model: 'gpt-4o',
    role: 'planner',
    roleLabel: 'Planner',
    workspace: '—',
    permissions: { readFiles: true, writeFiles: false, runCommands: false, runTests: false, network: false },
    limits: { timeoutMinutes: 15, maxRounds: 2 },
    streaming: true,
    status: 'idle',
  },
  {
    id: 'claude-researcher',
    name: 'claude-researcher',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
    role: 'researcher',
    roleLabel: 'Researcher',
    workspace: 'project-a',
    permissions: { readFiles: true, writeFiles: false, runCommands: false, runTests: false, network: true },
    limits: { timeoutMinutes: 20, maxRounds: 3 },
    streaming: true,
    status: 'idle',
  },
  {
    id: 'codex-backend',
    name: 'codex-backend',
    provider: 'codex',
    model: 'default',
    role: 'developer',
    roleLabel: 'Developer',
    workspace: 'project-a/backend',
    permissions: { readFiles: true, writeFiles: true, runCommands: true, runTests: true, network: false },
    limits: { timeoutMinutes: 30, maxRounds: 5 },
    streaming: true,
    status: 'running',
  },
  {
    id: 'cursor-frontend',
    name: 'cursor-frontend',
    provider: 'cursor',
    model: 'composer',
    role: 'developer',
    roleLabel: 'Frontend Dev',
    workspace: 'project-a/frontend',
    permissions: { readFiles: true, writeFiles: true, runCommands: true, runTests: false, network: false },
    limits: { timeoutMinutes: 30, maxRounds: 5 },
    streaming: true,
    status: 'running',
  },
  {
    id: 'opencode-tester',
    name: 'opencode-tester',
    provider: 'opencode',
    model: 'default',
    role: 'tester',
    roleLabel: 'Tester',
    workspace: 'project-a',
    permissions: { readFiles: true, writeFiles: true, runCommands: true, runTests: true, network: false },
    limits: { timeoutMinutes: 20, maxRounds: 3 },
    streaming: true,
    status: 'idle',
  },
  {
    id: 'gemini-reviewer',
    name: 'gemini-reviewer',
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    role: 'reviewer',
    roleLabel: 'Reviewer',
    workspace: '—',
    permissions: { readFiles: true, writeFiles: false, runCommands: false, runTests: false, network: false },
    limits: { timeoutMinutes: 15, maxRounds: 2 },
    streaming: false,
    status: 'idle',
  },
]

export const roleTemplates = [
  { role: 'planner', label: 'Planner', desc: '理解需求、拆分任务、建立依赖、制定验收标准', defaultProvider: 'openai' },
  { role: 'researcher', label: 'Researcher', desc: '阅读项目结构、分析代码、查找风险', defaultProvider: 'anthropic' },
  { role: 'developer', label: 'Developer', desc: '编写代码、修改文件、修复问题', defaultProvider: 'codex' },
  { role: 'tester', label: 'Tester', desc: '编写测试、执行测试、分析失败原因', defaultProvider: 'opencode' },
  { role: 'reviewer', label: 'Reviewer', desc: '检查功能完整性、代码质量、安全问题', defaultProvider: 'gemini' },
  { role: 'integrator', label: 'Integrator', desc: '合并代码、解决冲突、最终验证', defaultProvider: 'codex' },
]

export const workflows: Workflow[] = [
  {
    id: 'feature-development',
    name: 'feature-development',
    title: '登录功能开发',
    status: 'running',
    progress: 42,
    startedAt: '2026-08-27T09:00:00Z',
    activeAgents: 2,
    steps: [
      { id: 'planning', label: '任务规划', agentId: 'openai-planner', agentName: 'openai-planner', provider: 'OpenAI', dependsOn: [], status: 'completed', runId: 'run_101', duration: '3m 12s', progress: 100 },
      { id: 'research', label: '项目调研', agentId: 'claude-researcher', agentName: 'claude-researcher', provider: 'Claude', dependsOn: ['planning'], status: 'completed', runId: 'run_102', duration: '8m 45s', progress: 100 },
      { id: 'backend', label: '后端实现', agentId: 'codex-backend', agentName: 'codex-backend', provider: 'Codex', dependsOn: ['research'], status: 'running', runId: 'run_123', duration: '12m 34s', progress: 65 },
      { id: 'frontend', label: '前端实现', agentId: 'cursor-frontend', agentName: 'cursor-frontend', provider: 'Cursor', dependsOn: ['research'], status: 'running', parallel: true, runId: 'run_124', duration: '6m 20s', progress: 45 },
      { id: 'testing', label: '测试验证', agentId: 'opencode-tester', agentName: 'opencode-tester', provider: 'OpenCode', dependsOn: ['backend', 'frontend'], status: 'pending' },
      { id: 'review', label: '代码评审', agentId: 'gemini-reviewer', agentName: 'gemini-reviewer', provider: 'Gemini', dependsOn: ['testing'], status: 'pending' },
    ],
  },
  {
    id: 'code-review',
    name: 'code-review',
    title: 'Review PR #128',
    status: 'running',
    progress: 66,
    startedAt: '2026-08-27T10:30:00Z',
    activeAgents: 1,
    steps: [
      { id: 'fetch', label: '拉取 PR Diff', agentId: 'codex-backend', agentName: 'codex-backend', provider: 'Codex', dependsOn: [], status: 'completed', runId: 'run_201', duration: '1m 20s', progress: 100 },
      { id: 'analyze', label: '代码分析', agentId: 'claude-researcher', agentName: 'claude-researcher', provider: 'Claude', dependsOn: ['fetch'], status: 'completed', runId: 'run_202', duration: '5m 10s', progress: 100 },
      { id: 'review', label: '生成评审意见', agentId: 'gemini-reviewer', agentName: 'gemini-reviewer', provider: 'Gemini', dependsOn: ['analyze'], status: 'running', runId: 'run_203', duration: '2m 08s', progress: 40 },
    ],
  },
  {
    id: 'bugfix-auth',
    name: 'bugfix',
    title: '修复 Token 过期问题',
    status: 'pending',
    progress: 0,
    startedAt: '2026-08-27T14:00:00Z',
    activeAgents: 0,
    steps: [
      { id: 'reproduce', label: '复现问题', agentId: 'opencode-tester', agentName: 'opencode-tester', provider: 'OpenCode', dependsOn: [], status: 'pending' },
      { id: 'fix', label: '修复代码', agentId: 'codex-backend', agentName: 'codex-backend', provider: 'Codex', dependsOn: ['reproduce'], status: 'pending' },
      { id: 'verify', label: '回归验证', agentId: 'opencode-tester', agentName: 'opencode-tester', provider: 'OpenCode', dependsOn: ['fix'], status: 'pending' },
    ],
  },
]

/** @deprecated use workflows */
export const workflowSteps = workflows[0].steps

export const agentExecutions: Record<string, AgentExecution> = {
  'feature-development:planning': {
    stepId: 'planning', workflowId: 'feature-development', runId: 'run_101',
    agentId: 'openai-planner', agentName: 'openai-planner', provider: 'OpenAI',
    status: 'completed', startedAt: '2026-08-27T09:00:00Z', duration: '3m 12s', tokens: 4200,
    messages: [
      { id: 'm1', role: 'user', content: '今天完成登录功能，请拆分任务并制定验收标准', timestamp: '2026-08-27T09:00:05Z' },
      { id: 'm2', role: 'assistant', content: '已拆分为 6 个子任务：\n1. 分析认证结构\n2. 设计登录接口\n3. 后端实现\n4. 前端实现\n5. 测试\n6. 代码评审\n\n后端与前端可并行，测试依赖两者完成。', timestamp: '2026-08-27T09:02:30Z' },
    ],
    events: [
      { runId: 'run_101', agentId: 'openai-planner', type: 'session_created', status: 'completed', content: '会话已创建', timestamp: '2026-08-27T09:00:00Z' },
      { runId: 'run_101', agentId: 'openai-planner', type: 'task_started', status: 'completed', content: '分析登录功能需求', timestamp: '2026-08-27T09:00:05Z' },
      { runId: 'run_101', agentId: 'openai-planner', type: 'assistant_message', status: 'completed', content: '拆分为 6 个子任务，建立依赖关系', timestamp: '2026-08-27T09:02:30Z' },
      { runId: 'run_101', agentId: 'openai-planner', type: 'agent_completed', status: 'completed', content: '规划完成，输出验收标准', timestamp: '2026-08-27T09:03:12Z' },
    ],
    fileChanges: [],
  },
  'feature-development:research': {
    stepId: 'research', workflowId: 'feature-development', runId: 'run_102',
    agentId: 'claude-researcher', agentName: 'claude-researcher', provider: 'Claude',
    status: 'completed', startedAt: '2026-08-27T09:05:00Z', duration: '8m 45s', tokens: 12400,
    messages: [
      { id: 'm1', role: 'user', content: '阅读 project-a 的认证模块，输出调研报告', timestamp: '2026-08-27T09:05:10Z' },
      { id: 'm2', role: 'thinking', content: '扫描 AuthController、SecurityConfig、JwtFilter...', timestamp: '2026-08-27T09:06:00Z' },
      { id: 'm3', role: 'assistant', content: '调研结论：\n- 现有认证基于 JWT\n- 缺少 refresh token 机制\n- 登录接口在 AuthController.login()，需扩展\n- 建议新增 LoginRequest/LoginResponse DTO', timestamp: '2026-08-27T09:10:00Z' },
    ],
    events: [
      { runId: 'run_102', agentId: 'claude-researcher', type: 'session_created', status: 'completed', content: '会话已创建', timestamp: '2026-08-27T09:05:00Z' },
      { runId: 'run_102', agentId: 'claude-researcher', type: 'thinking_update', status: 'completed', content: '扫描 AuthController、SecurityConfig...', timestamp: '2026-08-27T09:06:00Z' },
      { runId: 'run_102', agentId: 'claude-researcher', type: 'assistant_message', status: 'completed', content: '现有认证基于 JWT，缺少 refresh token 机制', timestamp: '2026-08-27T09:10:00Z' },
      { runId: 'run_102', agentId: 'claude-researcher', type: 'agent_completed', status: 'completed', content: '调研报告已输出', timestamp: '2026-08-27T09:13:45Z' },
    ],
    fileChanges: [],
  },
  'feature-development:backend': {
    stepId: 'backend', workflowId: 'feature-development', runId: 'run_123',
    agentId: 'codex-backend', agentName: 'codex-backend', provider: 'Codex',
    status: 'running', startedAt: '2026-08-27T09:15:00Z', duration: '12m 34s', tokens: 18420,
    messages: [
      { id: 'm1', role: 'user', content: '根据调研报告实现登录接口 POST /api/auth/login，包含 JWT 签发', timestamp: '2026-08-27T09:15:05Z' },
      { id: 'm2', role: 'thinking', content: '先读 AuthController.java，确认现有路由和依赖注入...', timestamp: '2026-08-27T09:16:12Z' },
      { id: 'm3', role: 'assistant', content: '我会在 AuthController 新增 login 端点，并创建 LoginRequest、LoginService。', timestamp: '2026-08-27T09:17:00Z', toolCalls: [{ name: 'read_file', args: 'src/auth/AuthController.java' }] },
      { id: 'm4', role: 'assistant', content: '已修改 AuthController.java，新增 login 方法和参数校验。', timestamp: '2026-08-27T09:20:30Z', toolCalls: [{ name: 'edit_file', args: 'src/auth/AuthController.java' }] },
      { id: 'm5', role: 'assistant', content: '创建了 LoginRequest.java 和 LoginService.java。', timestamp: '2026-08-27T09:21:15Z', toolCalls: [{ name: 'write_file', args: 'src/auth/LoginRequest.java' }, { name: 'write_file', args: 'src/auth/LoginService.java' }] },
      { id: 'm6', role: 'assistant', content: '正在运行 mvn test 验证登录模块...', timestamp: '2026-08-27T09:25:00Z', streaming: true, toolCalls: [{ name: 'run_terminal', args: 'mvn test -pl auth-module' }] },
    ],
    events: [
      { runId: 'run_123', agentId: 'codex-backend', type: 'session_created', status: 'completed', content: '会话已创建', timestamp: '2026-08-27T09:15:00Z' },
      { runId: 'run_123', agentId: 'codex-backend', type: 'task_started', status: 'completed', content: '开始实现登录接口', timestamp: '2026-08-27T09:15:05Z' },
      { runId: 'run_123', agentId: 'codex-backend', type: 'thinking_update', status: 'completed', content: '分析现有 AuthController 结构...', timestamp: '2026-08-27T09:16:12Z' },
      { runId: 'run_123', agentId: 'codex-backend', type: 'file_changed', status: 'completed', content: '修改 AuthController.java', metadata: { path: 'src/auth/AuthController.java', action: 'modified' }, timestamp: '2026-08-27T09:20:30Z' },
      { runId: 'run_123', agentId: 'codex-backend', type: 'file_changed', status: 'completed', content: '新增 LoginRequest.java', metadata: { path: 'src/auth/LoginRequest.java', action: 'created' }, timestamp: '2026-08-27T09:21:15Z' },
      { runId: 'run_123', agentId: 'codex-backend', type: 'command_started', status: 'running', content: '正在运行测试', metadata: { command: 'mvn test -pl auth-module' }, timestamp: '2026-08-27T09:25:00Z' },
    ],
    fileChanges: [
      {
        path: 'src/auth/AuthController.java', action: 'modified', lines: '+42 -8',
        diff: `@PostMapping("/login")
+public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
+    return ResponseEntity.ok(authService.login(req));
+}
-
-// TODO: implement login`,
      },
      {
        path: 'src/auth/LoginRequest.java', action: 'created', lines: '+28',
        diff: `+public record LoginRequest(
+    @NotBlank String username,
+    @NotBlank String password
+) {}`,
      },
      {
        path: 'src/auth/LoginService.java', action: 'created', lines: '+65',
        diff: `+@Service
+public class LoginService {
+    public LoginResponse login(LoginRequest req) { ... }
+}`,
      },
    ],
    commandOutput: `$ mvn test -pl auth-module\n[INFO] Running com.example.auth.LoginTest\n[INFO] Tests run: 8, Failures: 0\n[INFO] BUILD SUCCESS`,
  },
  'feature-development:frontend': {
    stepId: 'frontend', workflowId: 'feature-development', runId: 'run_124',
    agentId: 'cursor-frontend', agentName: 'cursor-frontend', provider: 'Cursor',
    status: 'running', startedAt: '2026-08-27T09:18:00Z', duration: '6m 20s', tokens: 9200,
    messages: [
      { id: 'm1', role: 'user', content: '实现登录页面，对接 POST /api/auth/login，登录成功后跳转首页', timestamp: '2026-08-27T09:18:10Z' },
      { id: 'm2', role: 'thinking', content: '查看现有路由和 API 封装，确认 Element Plus 表单组件用法...', timestamp: '2026-08-27T09:19:00Z' },
      { id: 'm3', role: 'assistant', content: '我将创建 LoginView.vue 并更新 router，复用现有 request 拦截器处理 token。', timestamp: '2026-08-27T09:20:30Z', toolCalls: [{ name: 'read_file', args: 'src/router/index.ts' }] },
      { id: 'm4', role: 'assistant', content: 'LoginView.vue 已完成，包含表单校验和错误提示。正在修改 auth store。', timestamp: '2026-08-27T09:23:00Z', toolCalls: [{ name: 'write_file', args: 'src/views/LoginView.vue' }, { name: 'edit_file', args: 'src/stores/auth.ts' }] },
      { id: 'm5', role: 'assistant', content: '已添加 /login 路由，下一步运行 npm run type-check...', timestamp: '2026-08-27T09:24:20Z', streaming: true, toolCalls: [{ name: 'run_terminal', args: 'npm run type-check' }] },
    ],
    events: [
      { runId: 'run_124', agentId: 'cursor-frontend', type: 'session_created', status: 'completed', content: '会话已创建', timestamp: '2026-08-27T09:18:00Z' },
      { runId: 'run_124', agentId: 'cursor-frontend', type: 'file_changed', status: 'completed', content: '创建 LoginView.vue', metadata: { path: 'src/views/LoginView.vue', action: 'created' }, timestamp: '2026-08-27T09:22:00Z' },
      { runId: 'run_124', agentId: 'cursor-frontend', type: 'file_changed', status: 'completed', content: '修改 auth.ts', metadata: { path: 'src/stores/auth.ts', action: 'modified' }, timestamp: '2026-08-27T09:23:00Z' },
      { runId: 'run_124', agentId: 'cursor-frontend', type: 'command_started', status: 'running', content: 'type-check 运行中', metadata: { command: 'npm run type-check' }, timestamp: '2026-08-27T09:24:20Z' },
    ],
    fileChanges: [
      {
        path: 'src/views/LoginView.vue', action: 'created', lines: '+86',
        diff: `+<template>
+  <el-form @submit.prevent="handleLogin">
+    <el-input v-model="form.username" placeholder="用户名" />
+    <el-input v-model="form.password" type="password" />
+    <el-button type="primary" :loading="loading">登录</el-button>
+  </el-form>
+</template>`,
      },
      {
        path: 'src/stores/auth.ts', action: 'modified', lines: '+18 -3',
        diff: `+async function login(username: string, password: string) {
+  const { token } = await api.post('/auth/login', { username, password })
+  setToken(token)
+}`,
      },
      {
        path: 'src/router/index.ts', action: 'modified', lines: '+6 -0',
        diff: `+{ path: '/login', component: () => import('@/views/LoginView.vue') }`,
      },
    ],
    commandOutput: `$ npm run type-check\n> vue-tsc --noEmit\n✓ no errors`,
  },
  'code-review:review': {
    stepId: 'review', workflowId: 'code-review', runId: 'run_203',
    agentId: 'gemini-reviewer', agentName: 'gemini-reviewer', provider: 'Gemini',
    status: 'running', startedAt: '2026-08-27T10:38:00Z', duration: '2m 08s', tokens: 6800,
    messages: [
      { id: 'm1', role: 'user', content: 'Review PR #128，关注安全和边界条件', timestamp: '2026-08-27T10:38:10Z' },
      { id: 'm2', role: 'thinking', content: '逐文件检查 diff，重点关注 null 检查和输入校验...', timestamp: '2026-08-27T10:38:30Z' },
      { id: 'm3', role: 'assistant', content: '发现 2 处潜在 NPE（UserService.java:45, AuthFilter.java:78），1 处缺少 @Valid 输入校验。', timestamp: '2026-08-27T10:39:50Z', streaming: true },
    ],
    events: [
      { runId: 'run_203', agentId: 'gemini-reviewer', type: 'session_created', status: 'completed', content: '会话已创建', timestamp: '2026-08-27T10:38:00Z' },
      { runId: 'run_203', agentId: 'gemini-reviewer', type: 'thinking_update', status: 'running', content: '检查 PR #128 安全与边界条件...', timestamp: '2026-08-27T10:38:30Z' },
      { runId: 'run_203', agentId: 'gemini-reviewer', type: 'assistant_message', status: 'running', content: '发现 2 处潜在 NPE，1 处缺少输入校验', timestamp: '2026-08-27T10:39:50Z' },
    ],
    fileChanges: [],
  },
}

export const runEvents: AgentEvent[] = [
  { runId: 'run_123', agentId: 'codex-backend', type: 'session_created', status: 'completed', content: '会话已创建', timestamp: '2026-08-27T09:00:00Z' },
  { runId: 'run_123', agentId: 'codex-backend', type: 'task_started', status: 'completed', content: '开始实现登录接口', timestamp: '2026-08-27T09:00:05Z' },
  { runId: 'run_123', agentId: 'codex-backend', type: 'thinking_update', status: 'completed', content: '分析现有 AuthController 结构...', timestamp: '2026-08-27T09:01:12Z' },
  { runId: 'run_123', agentId: 'codex-backend', type: 'file_changed', status: 'completed', content: '修改 AuthController.java', metadata: { path: 'src/auth/AuthController.java', action: 'modified' }, timestamp: '2026-08-27T09:05:30Z' },
  { runId: 'run_123', agentId: 'codex-backend', type: 'file_changed', status: 'completed', content: '新增 LoginRequest.java', metadata: { path: 'src/auth/LoginRequest.java', action: 'created' }, timestamp: '2026-08-27T09:06:15Z' },
  { runId: 'run_123', agentId: 'codex-backend', type: 'command_started', status: 'running', content: '正在运行测试', metadata: { command: 'mvn test -pl auth-module' }, timestamp: '2026-08-27T09:10:00Z' },
  { runId: 'run_123', agentId: 'codex-backend', type: 'tool_call', status: 'running', content: '执行 mvn test', metadata: { command: 'mvn test -pl auth-module' }, timestamp: '2026-08-27T09:10:01Z' },
]

export const dailyTasks: DailyTask[] = [
  {
    id: 't1',
    title: '完成登录功能',
    type: 'dev',
    status: 'in_progress',
    priority: 'high',
    workflowId: 'feature-development',
    summary: '实现完整登录流程，含前后端、测试与评审',
    planUpdatedAt: '2026-08-27 09:03',
    planAuthor: 'openai-planner',
    steps: [
      { label: '分析项目认证结构', status: 'done' },
      { label: '设计登录接口', status: 'done' },
      { label: '实现后端', status: 'running' },
      { label: '实现前端', status: 'running' },
      { label: '编写测试', status: 'todo' },
      { label: '代码评审', status: 'todo' },
    ],
    planItems: [
      { id: 'p1', time: '09:00', title: '分析现有认证模块', detail: 'Claude 阅读 AuthController、SecurityConfig，输出调研报告', status: 'done', agent: 'claude-researcher' },
      { id: 'p2', time: '09:15', title: '设计登录 API 契约', detail: 'POST /api/auth/login，JWT 签发，LoginRequest/Response DTO', status: 'done', agent: 'openai-planner' },
      { id: 'p3', time: '09:30', title: 'Codex 实现后端', detail: 'AuthController、LoginService、单元测试', status: 'in_progress', agent: 'codex-backend', linkedWorkflowStep: 'backend' },
      { id: 'p4', time: '09:30', title: 'Cursor 实现前端', detail: 'LoginView.vue、auth store、路由', status: 'in_progress', agent: 'cursor-frontend', linkedWorkflowStep: 'frontend' },
      { id: 'p5', time: '11:00', title: 'OpenCode 编写集成测试', detail: 'E2E 登录流程 + API 测试', status: 'todo', agent: 'opencode-tester' },
      { id: 'p6', time: '11:30', title: 'Gemini 代码评审', detail: '安全、边界条件、输入校验', status: 'todo', agent: 'gemini-reviewer' },
    ],
  },
  {
    id: 't2',
    title: '整理本周开发记录',
    type: 'normal',
    status: 'todo',
    priority: 'medium',
    summary: '汇总本周功能开发与问题修复，写入 weekly log',
    planUpdatedAt: '2026-08-27 08:30',
    planAuthor: 'openai-planner',
    planItems: [
      { id: 'p1', time: '14:00', title: '收集 Git 提交记录', detail: '按模块整理 commit 与 PR', status: 'todo' },
      { id: 'p2', time: '14:30', title: 'AI 生成摘要', detail: 'Claude 归纳亮点与遗留问题', status: 'todo', agent: 'claude-researcher' },
      { id: 'p3', time: '15:00', title: '写入开发记录文件', detail: '追加到 weekly-development-log', status: 'todo' },
    ],
  },
  {
    id: 't3',
    title: '回复客户邮件',
    type: 'normal',
    status: 'done',
    priority: 'low',
    summary: '回复产品进度咨询邮件',
    planUpdatedAt: '2026-08-27 08:00',
    planAuthor: 'openai-planner',
    planItems: [
      { id: 'p1', time: '08:00', title: '草拟回复', detail: '说明登录功能进度与预计交付时间', status: 'done' },
      { id: 'p2', time: '08:15', title: '发送邮件', detail: '已发送并归档', status: 'done' },
    ],
  },
  {
    id: 't4',
    title: 'Review PR #128',
    type: 'dev',
    status: 'todo',
    priority: 'medium',
    workflowId: 'code-review',
    summary: '对 PR #128 进行自动化代码评审',
    planUpdatedAt: '2026-08-27 10:00',
    planAuthor: 'openai-planner',
    planItems: [
      { id: 'p1', time: '待定', title: 'Codex 拉取 PR Diff', detail: '获取变更文件列表', status: 'todo', agent: 'codex-backend' },
      { id: 'p2', time: '待定', title: 'Claude 代码分析', detail: '逻辑与架构风险', status: 'todo', agent: 'claude-researcher' },
      { id: 'p3', time: '待定', title: 'Gemini 生成评审意见', detail: '安全与边界检查', status: 'todo', agent: 'gemini-reviewer' },
    ],
  },
]

export const eventTypes = [
  'session_created', 'task_started', 'assistant_message', 'thinking_update',
  'tool_call', 'command_started', 'command_finished', 'file_changed',
  'test_started', 'test_finished', 'approval_required', 'agent_waiting',
  'agent_completed', 'agent_failed', 'run_paused', 'run_cancelled',
]

export const architectureLayers = [
  { layer: '用户需求', desc: '自然语言描述目标' },
  { layer: '任务编排器 Orchestrator', desc: '权限、状态、并发、重试、审计' },
  { layer: 'Agent 配置中心', desc: 'Provider + 角色 + 权限 + 工作流' },
  { layer: 'Provider Adapter', desc: '统一 Agent 运行接口' },
  { layer: '底层工具', desc: 'OpenAI / Codex / Claude / Cursor / OpenCode / ...' },
]
