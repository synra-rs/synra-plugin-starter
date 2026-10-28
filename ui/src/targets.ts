import type { DeviceTarget, SynraClient } from '@synra/client'
import { computed, onScopeDispose, shallowRef } from 'vue'

export const MAX_TARGETS = 256
export const TARGET_TIMEOUT_MS = 8000
type TargetHost = Pick<SynraClient, 'device'>
type TargetId = DeviceTarget['deviceId']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const platforms = new Set(['windows', 'macos', 'linux', 'android', 'ios'])

function refusal(reason: unknown): string {
  const code = typeof reason === 'object' && reason !== null && 'code' in reason ? reason.code : undefined
  if (code === 'capability_denied')
    return code
  if (code === 'payload_too_large')
    return 'too_many_devices'
  return reason instanceof Error && reason.message === 'invalid_devices' ? 'invalid_devices' : 'unavailable'
}

export function isComputer(target: DeviceTarget): boolean {
  return target.platform === 'windows' || target.platform === 'macos' || target.platform === 'linux'
}

/** Treat the native bridge answer as untrusted, even though its declaration is typed. */
export function decodeTargets(value: unknown): DeviceTarget[] {
  if (!Array.isArray(value) || value.length > MAX_TARGETS)
    throw new Error('invalid_devices')
  const seen = new Set<string>()
  return value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item))
      throw new Error('invalid_devices')
    const row = item as Record<string, unknown>
    if (typeof row.deviceId !== 'string' || !uuid.test(row.deviceId) || seen.has(row.deviceId)
      || typeof row.displayName !== 'string' || !row.displayName.trim() || row.displayName.length > 256
      || typeof row.platform !== 'string' || !platforms.has(row.platform)
      || typeof row.online !== 'boolean') {
      throw new Error('invalid_devices')
    }
    seen.add(row.deviceId)
    return {
      deviceId: row.deviceId as TargetId,
      displayName: row.displayName,
      platform: row.platform as DeviceTarget['platform'],
      online: row.online,
    }
  })
}

/** Explicit selection, one bounded refresh, and no automatic target substitution. */
export function useTargets(host: TargetHost | undefined) {
  const devices = shallowRef<DeviceTarget[]>([])
  const selectedId = shallowRef<TargetId | ''>('')
  const pending = shallowRef(false)
  const error = shallowRef(host ? '' : 'bridge_unavailable')
  const selected = computed(() => devices.value.find(device => device.deviceId === selectedId.value))
  const computers = computed(() => devices.value.filter(isComputer))
  let active = false
  let disposed = false
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  function invalidate() {
    generation++
    clearTimeout(timer)
    devices.value = []
    selectedId.value = ''
  }

  function visibilityChanged() {
    if (document.hidden)
      invalidate()
  }
  document.addEventListener('visibilitychange', visibilityChanged)
  window.addEventListener('pagehide', invalidate)
  onScopeDispose(() => {
    disposed = true
    invalidate()
    document.removeEventListener('visibilitychange', visibilityChanged)
    window.removeEventListener('pagehide', invalidate)
  })

  function select(id: string) {
    if (!disposed && computers.value.some(device => device.deviceId === id))
      selectedId.value = id as TargetId
    else
      selectedId.value = ''
  }

  async function refresh() {
    if (!host || active || disposed)
      return
    active = true
    pending.value = true
    error.value = ''
    const current = ++generation
    timer = setTimeout(() => {
      if (current === generation && !disposed) {
        invalidate()
        error.value = 'timeout'
      }
    }, TARGET_TIMEOUT_MS)
    try {
      const answer = await host.device.list()
      if (current === generation && !disposed) {
        devices.value = decodeTargets(answer)
        if (!computers.value.some(device => device.deviceId === selectedId.value))
          selectedId.value = ''
      }
    }
    catch (reason: unknown) {
      if (current === generation && !disposed) {
        invalidate()
        error.value = refusal(reason)
      }
    }
    finally {
      clearTimeout(timer)
      active = false
      if (!disposed)
        pending.value = false
    }
  }

  return { computers, selected, pending, error, select, refresh }
}
