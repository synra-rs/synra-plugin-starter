import type { SynraClient } from '@synra/client'
import { onScopeDispose, shallowRef } from 'vue'

export type StarterHost = Pick<SynraClient, 'env' | 'self' | 'device'>

export interface DebugReport {
  pluginId: string
  pluginVersion: string
  contractVersion: string
  hostSdkVersion: string
  hostKind: string
  locale: string
  darkMode: boolean
}

export interface Trace {
  id: number
  elapsedMs: number
  code: string
}

export const REQUEST_TIMEOUT_MS = 8000
export const MAX_TRACES = 8

const messages = new Map([
  ['bridge_unavailable', '请在 Synra 中打开此插件。'],
  ['invalid_report', '宿主返回的诊断信息格式不正确。'],
  ['capability_denied', '当前插件页面的会话或授权已失效，请重新打开插件。'],
  ['unsupported', '当前宿主无法执行此诊断，请确认插件已启用。'],
  ['invalid_argument', '诊断参数被宿主拒绝。'],
  ['rate_limited', '调用过于频繁，请稍后重试。'],
  ['timeout', '诊断超时，正在等待宿主结束当前调用。'],
  ['internal', '诊断未完成，请查看宿主中的错误记录。'],
])

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256
}

export function decodeReport(value: unknown): DebugReport {
  if (!record(value)
    || value.pluginId !== '@synra-plugin/starter'
    || !text(value.pluginVersion)
    || !text(value.contractVersion)
    || !text(value.hostSdkVersion)
    || !text(value.hostKind)
    || !text(value.locale)
    || typeof value.darkMode !== 'boolean') {
    throw new Error('invalid_report')
  }
  return {
    pluginId: value.pluginId,
    pluginVersion: value.pluginVersion,
    contractVersion: value.contractVersion,
    hostSdkVersion: value.hostSdkVersion,
    hostKind: value.hostKind,
    locale: value.locale,
    darkMode: value.darkMode,
  }
}

export function windowHost(): StarterHost | undefined {
  if (typeof window === 'undefined')
    return undefined
  const host = window.synra
  return typeof host?.self?.invoke === 'function' && typeof host?.env?.platform === 'function'
    ? host
    : undefined
}

/** One real host request at a time, with no retries and no retained response payloads in traces. */
export function useDiagnostics(host: StarterHost | undefined, now = () => performance.now()) {
  const report = shallowRef<DebugReport>()
  const pending = shallowRef(false)
  const error = shallowRef(host ? '' : 'bridge_unavailable')
  const traces = shallowRef<Trace[]>([])
  let active = false
  let disposed = false
  let generation = 0
  let sequence = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  function invalidate() {
    generation++
    clearTimer()
    report.value = undefined
    error.value = host ? '' : 'bridge_unavailable'
  }

  function visibilityChanged() {
    if (document.hidden)
      invalidate()
  }
  document.addEventListener('visibilitychange', visibilityChanged)
  window.addEventListener('pagehide', invalidate)
  onScopeDispose(() => {
    disposed = true
    generation++
    clearTimer()
    document.removeEventListener('visibilitychange', visibilityChanged)
    window.removeEventListener('pagehide', invalidate)
  })

  async function run() {
    if (!host || active || disposed)
      return
    active = true
    pending.value = true
    report.value = undefined
    error.value = ''
    const ticket = ++generation
    const id = ++sequence
    const start = now()
    let expired = false
    const current = () => !disposed && ticket === generation
    const trace = (code: string) => {
      const elapsed = now() - start
      const elapsedMs = Number.isFinite(elapsed) ? Math.round(Math.max(0, elapsed) * 10) / 10 : 0
      traces.value = [{ id, elapsedMs, code }, ...traces.value].slice(0, MAX_TRACES)
    }
    timer = setTimeout(() => {
      if (!current())
        return
      expired = true
      error.value = 'timeout'
      trace('timeout')
      // Do not allow another request while the timed-out native operation is still in flight.
    }, REQUEST_TIMEOUT_MS)
    try {
      const answer = await host.self.invoke<Record<string, never>, unknown>('debug', {})
      if (!current() || expired)
        return
      report.value = decodeReport(answer)
      trace('ok')
    }
    catch (failure: unknown) {
      if (!current() || expired)
        return
      const code = failure instanceof Error && failure.message === 'invalid_report'
        ? 'invalid_report'
        : record(failure) && typeof failure.code === 'string' && failure.code.length <= 64
          ? failure.code
          : 'internal'
      error.value = messages.has(code) ? code : 'internal'
      trace(error.value)
    }
    finally {
      clearTimer()
      active = false
      if (!disposed)
        pending.value = false
    }
  }

  const message = () => messages.get(error.value) ?? messages.get('internal') ?? ''
  return { report, pending, error, traces, run, message, invalidate }
}
