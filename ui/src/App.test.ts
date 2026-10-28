import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it } from 'vitest'
import { hostWith, report } from '../test/host'
import App from './App.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0))
    wrapper.unmount()
})

it('renders a real debug action result through the provided client surface', async () => {
  const wrapper = mount(App, { props: { host: hostWith(async () => report) } })
  wrappers.push(wrapper)
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('@synra-plugin/starter')
  expect(wrapper.text()).toContain('synra:plugin@1.0.0')
  expect(wrapper.text()).toContain('windows')
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
})

it('displays host failures without echoing native exception payloads', async () => {
  const wrapper = mount(App, { props: { host: hostWith(async () => {
    throw Object.assign(new Error('sensitive internal detail'), { code: 'unsupported' })
  }) } })
  wrappers.push(wrapper)
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('确认插件已启用')
  expect(wrapper.text()).not.toContain('sensitive')
})

it('shows the missing host state instead of a simulated successful result', () => {
  const wrapper = mount(App)
  wrappers.push(wrapper)
  expect(wrapper.findAll('[role="alert"]').some(alert => alert.text().includes('请在 Synra 中打开'))).toBe(true)
  expect(wrapper.get('button').attributes('disabled')).toBeDefined()
})
