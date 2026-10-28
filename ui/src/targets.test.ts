import type { DeviceTarget } from '@synra/client'
import { afterEach, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { hostWith } from '../test/host'
import { decodeTargets, MAX_TARGETS, TARGET_TIMEOUT_MS, useTargets } from './targets'

const pc = { deviceId: '11111111-1111-4111-8111-111111111111', displayName: 'Laptop', platform: 'windows', online: true } as const
const other = { ...pc, deviceId: '22222222-2222-4222-8222-222222222222', displayName: 'Desktop' }
const phone = { ...pc, deviceId: '33333333-3333-4333-8333-333333333333', platform: 'android' }
const scopes: ReturnType<typeof effectScope>[] = []

function controller(list: () => Promise<unknown>) {
  const host = hostWith(async () => null)
  host.device.list = async () => await list() as DeviceTarget[]
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => useTargets(host))!
  return { state, scope }
}

afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.useRealTimers()
})

it('shows computers including offline peers and requires an explicit canonical target', async () => {
  const { state } = controller(async () => [pc, { ...other, online: false }, phone])
  await state.refresh()
  expect(state.computers.value).toHaveLength(2)
  expect(state.selected.value).toBeUndefined()
  state.select(pc.deviceId)
  expect(state.selected.value?.deviceId).toBe(pc.deviceId)
  state.select(other.deviceId)
  expect(state.selected.value?.online).toBe(false)
  state.select(phone.deviceId)
  expect(state.selected.value).toBeUndefined()
  state.select('Laptop')
  expect(state.selected.value).toBeUndefined()
})

it('keeps explicit selection on disconnect and clears it when the paired peer disappears', async () => {
  let answer: unknown = [pc, other]
  const { state } = controller(async () => answer)
  await state.refresh()
  state.select(pc.deviceId)
  answer = [{ ...pc, online: false }, other]
  await state.refresh()
  expect(state.selected.value?.online).toBe(false)
  answer = [other]
  await state.refresh()
  expect(state.selected.value).toBeUndefined()
  expect(state.computers.value).toHaveLength(1)
})

it('bounds bridge answers and rejects aliases duplicates and malformed peers', () => {
  for (const value of [null, {}, [pc, pc], [{ ...pc, deviceId: 'Laptop' }], [{ ...pc, deviceId: 'ABCDEFAB-1111-4111-8111-111111111111' }], [{ ...pc, online: 1 }], [{ ...pc, platform: 'unknown' }], [{ ...pc, displayName: 'x'.repeat(257) }], Array.from({ length: MAX_TARGETS + 1 }).fill(pc)]) {
    expect(() => decodeTargets(value)).toThrow('invalid_devices')
  }
  expect(decodeTargets([{ ...pc, address: 'private address' }])[0]).not.toHaveProperty('address')
})

it('does not retry a timed-out pending operation or accept its late response', async () => {
  vi.useFakeTimers()
  let resolve: (value: unknown) => void = () => {}
  const list = vi.fn(() => new Promise<unknown>((done) => {
    resolve = done
  }))
  const { state } = controller(list)
  const first = state.refresh()
  await state.refresh()
  expect(list).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(TARGET_TIMEOUT_MS)
  expect(state.error.value).toBe('timeout')
  expect(state.pending.value).toBe(true)
  await state.refresh()
  expect(list).toHaveBeenCalledTimes(1)
  resolve([pc])
  await first
  expect(state.computers.value).toEqual([])
  expect(state.pending.value).toBe(false)
})

it('discards replies after page hide or disposal and releases its timer', async () => {
  vi.useFakeTimers()
  let resolve: (value: unknown) => void = () => {}
  const { state, scope } = controller(() => new Promise((done) => {
    resolve = done
  }))
  const request = state.refresh()
  window.dispatchEvent(new Event('pagehide'))
  scope.stop()
  resolve([pc])
  await request
  expect(state.computers.value).toEqual([])
  expect(state.selected.value).toBeUndefined()
  expect(vi.getTimerCount()).toBe(0)
})

it('clears stale data on denial without exposing native error details', async () => {
  let denied = false
  const { state } = controller(async () => {
    if (denied)
      throw Object.assign(new Error('sensitive native details'), { code: 'capability_denied' })
    return [pc]
  })
  await state.refresh()
  state.select(pc.deviceId)
  denied = true
  await state.refresh()
  expect(state.error.value).toBe('capability_denied')
  expect(state.computers.value).toEqual([])
  expect(state.selected.value).toBeUndefined()
})
