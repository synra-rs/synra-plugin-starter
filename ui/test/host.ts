import type { StarterHost } from '../src/diagnostics'

export const report = {
  pluginId: '@synra-plugin/starter',
  pluginVersion: '0.1.0',
  contractVersion: 'synra:plugin@1.0.0',
  hostSdkVersion: '1.0.0',
  hostKind: 'desktop',
  locale: 'zh-CN',
  darkMode: true,
}

export function hostWith(invoke: () => Promise<unknown>): StarterHost {
  return {
    device: {
      list: async () => [],
      send: async () => { throw new Error('unsupported') },
      broadcast: async () => { throw new Error('unsupported') },
      onChange: () => () => {},
      pick: async () => { throw new Error('unsupported') },
      supported: [],
    },
    self: {
      async invoke<Args, Result>(_action: string, _args?: Args) {
        return await invoke() as Result
      },
      async actions() { return [{ name: 'debug' }] },
    },
    env: {
      hostKind: () => 'desktop',
      platform: () => 'windows',
      locale: () => 'zh-CN',
      darkMode: () => true,
      appVersion: () => '0.1.0',
      sdkVersion: () => '1.0.0',
      platformSupports: () => false,
      hostSupports: () => false,
      can: () => false,
    },
  }
}
