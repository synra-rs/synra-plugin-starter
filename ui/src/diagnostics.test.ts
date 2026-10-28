import type { StarterHost } from './diagnostics'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { hostWith, report } from '../test/host'

import { decodeReport, MAX_TRACES, REQUEST_TIMEOUT_MS, useDiagnostics } from './diagnostics'

function deferred() {
  let resolve: (value: unknown) => void = () => {
    throw new Error('promise is not initialized')
  }
  const promise = new Promise<unknown>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const scopes: ReturnType<typeof effectScope>[] = []
function controller(host: StarterHost | undefined, now?: () => number) {
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => useDiagnostics(host, now))
  if (!state)
    throw new Error('diagnostics scope did not start')
  return { state, scope }
}

afterEach(() => {
  for (const scope of scopes.splice(0))
    scope.stop()
  vi.useRealTimers()
})

describe('the diagnostic request lifecycle', () => {
  it('invokes the declared action with an explicit empty object and records same-clock time', async () => {
    let clock = 100
    const host = hostWith(async () => {
      clock = 112.25
      return report
    })
    const invoke = vi.spyOn(host.self, 'invoke')
    const { state } = controller(host, () => clock)
    await state.run()
    expect(invoke).toHaveBeenCalledExactlyOnceWith('debug', {})
    expect(state.report.value).toEqual(report)
    expect(state.traces.value).toEqual([{ id: 1, elapsedMs: 12.3, code: 'ok' }])
  })

  it('permits only one native operation, even after a UI timeout', async () => {
    vi.useFakeTimers()
    const request = deferred()
    const invoke = vi.fn(() => request.promise)
    const { state } = controller(hostWith(invoke))
    const first = state.run()
    await state.run()
    expect(invoke).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    expect(state.error.value).toBe('timeout')
    expect(state.pending.value).toBe(true)
    await state.run()
    expect(invoke).toHaveBeenCalledTimes(1)
    request.resolve(report)
    await first
    expect(state.report.value).toBeUndefined()
    expect(state.error.value).toBe('timeout')
    expect(state.traces.value).toHaveLength(1)
    expect(state.pending.value).toBe(false)
  })

  it('drops replies from a page context that has left or become hidden', async () => {
    const request = deferred()
    const { state } = controller(hostWith(() => request.promise))
    const running = state.run()
    window.dispatchEvent(new Event('pagehide'))
    request.resolve(report)
    await running
    expect(state.report.value).toBeUndefined()
    expect(state.traces.value).toEqual([])
    expect(state.pending.value).toBe(false)
  })

  it('removes timers and ignores completion after disposal', async () => {
    vi.useFakeTimers()
    const request = deferred()
    const { state, scope } = controller(hostWith(() => request.promise))
    const running = state.run()
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    request.resolve(report)
    await running
    expect(state.report.value).toBeUndefined()
    expect(state.traces.value).toEqual([])
  })

  it('keeps a bounded trace without response data or sensitive error messages', async () => {
    let success = true
    const { state } = controller(hostWith(async () => {
      if (!success)
        throw Object.assign(new Error('private token or selected text'), { code: 'capability_denied' })
      return report
    }))
    for (let index = 0; index < MAX_TRACES + 3; index++)
      await state.run()
    success = false
    await state.run()
    expect(state.traces.value).toHaveLength(MAX_TRACES)
    expect(state.traces.value[0]?.id).toBe(MAX_TRACES + 4)
    expect(state.error.value).toBe('capability_denied')
    expect(state.message()).not.toContain('private')
    expect(JSON.stringify(state.traces.value)).not.toContain('zh-CN')
  })

  it('reports malformed results and never reinterprets a JSON string as a second response', async () => {
    for (const value of [null, JSON.stringify(report), { ...report, pluginId: '@other/plugin' }, { ...report, locale: 'x'.repeat(257) }]) {
      const { state } = controller(hostWith(async () => value))
      await state.run()
      expect(state.error.value).toBe('invalid_report')
      expect(state.report.value).toBeUndefined()
    }
    expect(decodeReport({ ...report, ignored: 'not rendered' })).toEqual(report)
  })

  it('does not fabricate a host when opened outside Synra', async () => {
    const { state } = controller(undefined)
    await state.run()
    expect(state.error.value).toBe('bridge_unavailable')
    expect(state.pending.value).toBe(false)
    expect(state.traces.value).toEqual([])
  })
})
