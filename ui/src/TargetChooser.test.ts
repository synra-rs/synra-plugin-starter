import type { DeviceTarget } from '@synra/client'
import { flushPromises, mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import { hostWith } from '../test/host'
import TargetChooser from './TargetChooser.vue'

it('renders connection state and explicit selection without silently picking a computer', async () => {
  const host = hostWith(async () => null)
  host.device.list = async () => [{ deviceId: '11111111-1111-4111-8111-111111111111', displayName: 'Laptop', platform: 'windows', online: false }] as DeviceTarget[]
  const wrapper = mount(TargetChooser, { props: { host } })
  try {
    await flushPromises()
    expect(wrapper.get('select').element.value).toBe('')
    expect(wrapper.text()).toContain('Laptop · 离线')
    await wrapper.get('select').setValue('11111111-1111-4111-8111-111111111111')
    expect(wrapper.text()).toContain('已选择 Laptop')
    expect(wrapper.text()).toContain('当前无法发送')
  }
  finally { wrapper.unmount() }
})

it('distinguishes refused access from an empty paired-device list', async () => {
  const host = hostWith(async () => null)
  host.device.list = async () => {
    throw Object.assign(new Error('secret error detail'), { code: 'capability_denied' })
  }
  const wrapper = mount(TargetChooser, { props: { host } })
  try {
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('未获授权')
    expect(wrapper.text()).not.toContain('还没有已配对')
    expect(wrapper.text()).not.toContain('secret')
  }
  finally { wrapper.unmount() }
})
