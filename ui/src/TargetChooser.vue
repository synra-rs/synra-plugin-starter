<script setup lang="ts">
import type { StarterHost } from './diagnostics'
import { onMounted } from 'vue'
import { useTargets } from './targets'

const props = defineProps<{ host?: StarterHost }>()
const { computers, selected, pending, error, select, refresh } = useTargets(props.host)
const messages: Record<string, string> = {
  bridge_unavailable: '请在 Synra 中打开此插件。',
  capability_denied: '设备列表未获授权或页面会话已失效，请在宿主中检查授权后重新打开。',
  invalid_devices: '宿主返回的设备列表格式不正确。',
  too_many_devices: '已配对设备超过当前列表上限，暂时无法选择目标。',
  timeout: '设备列表请求超时；仍在等待宿主结束当前调用。',
  unavailable: '暂时无法读取已配对设备，请稍后刷新。',
}
onMounted(refresh)
</script>

<template>
  <section class="card" aria-labelledby="target-title">
    <div class="section-heading">
      <h2 id="target-title">
        目标电脑
      </h2>
      <span class="badge">已配对设备</span>
    </div>
    <button type="button" data-testid="refresh-targets" :disabled="!host || pending" @click="refresh">
      {{ pending ? '正在读取设备…' : '刷新设备' }}
    </button>
    <p v-if="error" role="alert" class="error">
      {{ messages[error] }}
    </p>
    <p v-else-if="!pending && !computers.length" role="status" class="hint">
      还没有已配对的电脑，请先在宿主设备页配对。
    </p>
    <template v-if="computers.length">
      <label class="target-label" for="target-computer">在哪台电脑执行</label>
      <select id="target-computer" :value="selected?.deviceId ?? ''" @change="select(($event.target as HTMLSelectElement).value)">
        <option value="">
          请选择电脑
        </option>
        <option v-for="computer in computers" :key="computer.deviceId" :value="computer.deviceId">
          {{ computer.displayName }} · {{ computer.online ? '在线' : '离线' }} · {{ computer.deviceId }}
        </option>
      </select>
    </template>
    <p v-if="selected" role="status" class="hint">
      已选择 {{ selected.displayName }}（{{ selected.platform }}）· {{ selected.online ? '在线' : '离线，当前无法发送' }}
    </p>
    <p v-else-if="computers.length" role="status" class="hint">
      请明确选择目标；不会自动使用第一台电脑。
    </p>
    <p class="hint">
      设备配对与在线状态不代表已获操作授权，远端操作仍需单独校验。
    </p>
  </section>
</template>
