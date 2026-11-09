import type { StarterHost } from './diagnostics'
import { onScopeDispose, shallowRef } from 'vue'

export type DemoStatus = 'idle' | 'sending' | 'queued' | 'completed' | 'unsupported' | 'offline' | 'denied' | 'timeout' | 'failed'

export interface DemoState {
  status: DemoStatus
  error: string
  stage?: string
}

export const DEMO_TIMEOUT_MS = 8000
export const RESPONSE_TIMEOUT_MS = 7000

const messages: Record<string, string> = {
  bridge_unavailable: '请在 Synra 中打开此插件。',
  capability_denied: '当前演示未获授权，请在宿主的插件权限中允许对应能力。',
  unsupported: '当前宿主尚未实现这项演示能力。',
  device_offline: '目标电脑已离线，请刷新设备列表后重试。',
  timeout: '请求超时，宿主仍可能正在处理。请等待后再重试。',
  invalid_argument: '演示参数不符合安全限制。',
  payload_too_large: '内容超过演示允许的大小限制。',
  empty_content: '没有可发送的文本，请先在剪贴板中复制内容。',
  internal: '宿主未完成这次请求，请查看诊断页中的错误记录。',
}

function codeOf(reason: unknown): string {
  if (typeof reason === 'object' && reason !== null && 'code' in reason && typeof reason.code === 'string')
    return reason.code
  return reason instanceof Error && reason.message === 'timeout' ? 'timeout' : 'internal'
}

export function messageFor(code: string): string {
  return messages[code] ?? messages.internal
}

export function isSupportedUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value) && value.length <= 2048
}

interface RemoteResponse {
  requestId: string
  status: 'pending' | 'ok' | 'error'
  value?: unknown
  code?: string
  message?: string
}

function remoteResponse(value: unknown): RemoteResponse | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return undefined
  const row = value as Record<string, unknown>
  if (typeof row.requestId !== 'string' || !['pending', 'ok', 'error'].includes(String(row.status)))
    return undefined
  return {
    requestId: row.requestId,
    status: row.status as RemoteResponse['status'],
    value: row.value,
    code: typeof row.code === 'string' ? row.code : undefined,
    message: typeof row.message === 'string' ? row.message : undefined,
  }
}

export async function waitForRemoteResponse(
  host: StarterHost,
  requestId: string,
  onStage?: (stage: string) => void,
): Promise<RemoteResponse | undefined> {
  const deadline = Date.now() + RESPONSE_TIMEOUT_MS
  let reportedPending = false
  onStage?.('开始轮询电脑端响应')
  while (Date.now() < deadline) {
    try {
      const answer = remoteResponse(await host.self.invoke('starter.response-poll', { requestId }))
      if (answer && answer.status !== 'pending') {
        onStage?.(`已收到电脑端${answer.status === 'ok' ? '成功' : '错误'}响应`)
        return answer
      }
      if (!reportedPending) {
        reportedPending = true
        onStage?.('电脑端已收到请求，等待执行结果')
      }
    }
    catch (reason: unknown) {
      const code = codeOf(reason)
      if (!reportedPending) {
        reportedPending = true
        onStage?.(`响应轮询暂不可用（${code}），继续等待`)
      }
    }
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  onStage?.('等待电脑端响应超时')
  return undefined
}

export function useDemoAction(host: StarterHost | undefined, action: string) {
  const state = shallowRef<DemoState>({
    status: host ? 'idle' : 'unsupported',
    error: host ? '' : 'bridge_unavailable',
    stage: host ? '' : '宿主桥接不可用',
  })
  let active = false
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  onScopeDispose(() => {
    disposed = true
    clearTimer()
  })

  async function run(args: Record<string, unknown>): Promise<unknown> {
    if (!host || active || disposed)
      return undefined
    active = true
    state.value = { status: 'sending', error: '', stage: '正在调用插件动作' }
    let expired = false
    timer = setTimeout(() => {
      expired = true
      state.value = { status: 'timeout', error: 'timeout', stage: '插件动作调用超时' }
    }, DEMO_TIMEOUT_MS)
    try {
      const result = await host.self.invoke(action, args)
      if (!expired && !disposed)
        state.value = { status: 'queued', error: '', stage: '请求已发出，等待电脑端处理' }
      return result
    }
    catch (reason: unknown) {
      const code = codeOf(reason)
      if (!expired && !disposed) {
        state.value = {
          status: code === 'capability_denied' ? 'denied' : code === 'device_offline' ? 'offline' : code === 'unsupported' ? 'unsupported' : 'failed',
          error: code,
          stage: `插件动作调用失败（${code}）`,
        }
      }
      return undefined
    }
    finally {
      clearTimer()
      active = false
    }
  }

  return { state, run }
}

export function safePreview(value: string, max = 160): string {
  const trimmed = value.trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`
}
