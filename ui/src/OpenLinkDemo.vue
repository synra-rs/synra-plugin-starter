<script setup lang="ts">
import type { StarterHost } from './diagnostics'
import { computed, ref } from 'vue'
import { isSupportedUrl, messageFor, useDemoAction, waitForRemoteResponse } from './demo'

const props = defineProps<{ host?: StarterHost, targetId?: string, targetOnline?: boolean }>()
const url = ref('')
const action = useDemoAction(props.host, 'starter.open-url')
const canSend = computed(() => Boolean(props.host && props.targetId && props.targetOnline && isSupportedUrl(url.value.trim())))
const presets = [
  ['GitHub', 'https://github.com/synra-rs/synra-plugin-starter'],
  ['Synra 文档', 'https://synra-app.dev'],
] as const

function setUrl(value: string) {
  url.value = value
}

async function send() {
  if (!canSend.value)
    return
  const requestId = props.host?.requestId()
  if (!requestId)
    return
  const queued = await action.run({ target: props.targetId, requestId, url: url.value.trim() })
  if (typeof queued !== 'object' || queued === null || !('requestId' in queued) || typeof queued.requestId !== 'string')
    return
  try {
    const response = await waitForRemoteResponse(props.host!, requestId)
    if (!response) {
      action.state.value = { status: 'timeout', error: 'timeout' }
    }
    else if (response.status === 'ok') {
      action.state.value = { status: 'completed', error: '' }
    }
    else {
      action.state.value = { status: 'failed', error: response.code ?? 'internal' }
    }
  }
  catch {
    action.state.value = { status: 'failed', error: 'internal' }
  }
}
</script>

<template>
  <section class="card demo-card" aria-labelledby="open-link-title">
    <div class="section-heading">
      <div>
        <p class="card-kicker">
          能力演示 01
        </p>
        <h2 id="open-link-title">
          让电脑打开链接
        </h2>
      </div>
      <span class="badge">URL</span>
    </div>
    <p class="hint">
      把一个受支持的网页地址发送到已选择的电脑，由电脑端打开。
    </p>
    <div class="action-row link-row">
      <label class="sr-only" for="showcase-url">链接</label>
      <input id="showcase-url" v-model="url" type="url" inputmode="url" placeholder="https://example.com" autocomplete="url">
      <button type="button" :disabled="!canSend || action.state.value.status === 'sending'" @click="send">
        {{ action.state.value.status === 'sending' ? '正在发送…' : '发送并打开' }}
      </button>
    </div>
    <div class="quick-links" aria-label="快捷链接">
      <button v-for="preset in presets" :key="preset[0]" type="button" class="quiet" @click="setUrl(preset[1])">
        {{ preset[0] }}
      </button>
    </div>
    <p v-if="!props.targetId" class="hint" role="status">
      先在上方选择目标电脑。
    </p>
    <p v-else-if="props.targetOnline === false" class="error" role="alert">
      目标电脑离线，当前无法发送。
    </p>
    <p v-if="action.state.value.status === 'completed'" class="success" role="status">
      电脑已打开链接。
    </p>
    <p v-else-if="action.state.value.status === 'queued'" class="success" role="status">
      请求已发出，等待电脑端执行结果。
    </p>
    <p v-else-if="action.state.value.error" class="error" role="alert">
      {{ messageFor(action.state.value.error) }}
    </p>
    <details class="permission-note">
      <summary>这项演示需要什么权限</summary>
      <p>Starter 只发送 URL 字符串和目标设备 ID。电脑端负责判断是否支持并打开链接。</p>
    </details>
  </section>
</template>
