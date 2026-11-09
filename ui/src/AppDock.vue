<script setup lang="ts">
import type { StarterHost } from './diagnostics'
import { computed, ref, watch } from 'vue'
import { messageFor, useDemoAction, waitForRemoteResponse } from './demo'

interface AppEntry { id: string, name: string, icon?: string }
const props = defineProps<{ host?: StarterHost, targetId?: string, targetOnline?: boolean }>()
const apps = ref<AppEntry[]>([])
const selectedApp = ref('')
const listAction = useDemoAction(props.host, 'starter.apps-list')
const openAction = useDemoAction(props.host, 'starter.apps-open')
const canUseTarget = computed(() => Boolean(props.host && props.targetId && props.targetOnline))

async function refresh() {
  if (!canUseTarget.value)
    return
  const requestId = props.host?.requestId()
  if (!requestId)
    return
  const queued = await listAction.run({ target: props.targetId, requestId })
  if (typeof queued !== 'object' || queued === null || !('requestId' in queued) || typeof queued.requestId !== 'string')
    return
  const response = await waitForRemoteResponse(props.host!, requestId, stage => {
    listAction.state.value = { ...listAction.state.value, stage }
  })
  if (!response) {
    listAction.state.value = { status: 'timeout', error: 'timeout', stage: '等待电脑端响应超时' }
    return
  }
  if (response.status === 'error') {
    listAction.state.value = { status: 'failed', error: response.code ?? 'internal', stage: '已收到电脑端错误响应' }
    return
  }
  if (!Array.isArray(response.value)) {
    listAction.state.value = { status: 'failed', error: 'internal', stage: '电脑端返回的应用目录格式不正确' }
    return
  }
  apps.value = response.value.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('name' in item))
      return []
    if (typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name)
      return []
    return [{ id: item.id, name: item.name, icon: 'icon' in item && typeof item.icon === 'string' ? item.icon : undefined }]
  }).slice(0, 64)
  listAction.state.value = { status: 'completed', error: '', stage: `已收到电脑端应用目录（${apps.value.length} 项）` }
}

async function openApp(app: AppEntry) {
  selectedApp.value = app.id
  const requestId = props.host?.requestId()
  if (!requestId)
    return
  const queued = await openAction.run({ target: props.targetId, requestId, appId: app.id })
  if (typeof queued !== 'object' || queued === null || !('requestId' in queued) || typeof queued.requestId !== 'string')
    return
  const response = await waitForRemoteResponse(props.host!, requestId, stage => {
    openAction.state.value = { ...openAction.state.value, stage }
  })
  if (!response) {
    openAction.state.value = { status: 'timeout', error: 'timeout', stage: '等待电脑端响应超时' }
  }
  else if (response.status === 'ok') {
    openAction.state.value = { status: 'completed', error: '', stage: '已收到电脑端成功响应' }
  }
  else {
    openAction.state.value = { status: 'failed', error: response.code ?? 'internal', stage: '已收到电脑端错误响应' }
  }
}

watch(() => [props.targetId, props.targetOnline] as const, ([targetId, online], previous) => {
  if (targetId && online && (targetId !== previous?.[0] || online !== previous?.[1]))
    void refresh()
}, { immediate: true })
</script>

<template>
  <section class="card demo-card" aria-labelledby="apps-title">
    <div class="section-heading">
      <div>
        <p class="card-kicker">
          能力演示 03
        </p>
        <h2 id="apps-title">
          应用坞
        </h2>
      </div>
      <button type="button" class="quiet compact" :disabled="!canUseTarget || listAction.state.value.status === 'sending'" @click="refresh">
        {{ listAction.state.value.status === 'sending' ? '正在读取…' : '刷新' }}
      </button>
    </div>
    <p class="hint">
      电脑端只返回允许展示的应用名称和图标。Starter 发送稳定应用 ID，不接收执行路径。
    </p>
    <div v-if="apps.length" class="app-grid">
      <button v-for="app in apps" :key="app.id" type="button" class="app-tile" :class="{ active: selectedApp === app.id }" @click="openApp(app)">
        <span class="app-icon" aria-hidden="true">{{ app.icon ?? '▦' }}</span>
        <span>{{ app.name }}</span>
      </button>
    </div>
    <p v-else-if="!canUseTarget" class="hint" role="status">
      选择一台在线电脑后读取应用目录。
    </p>
    <p v-else class="empty" role="status">
      当前宿主没有返回可展示的安全应用目录。
    </p>
    <p v-if="listAction.state.value.status === 'completed'" class="success" role="status">
      电脑端已返回应用目录。
    </p>
    <p v-else-if="listAction.state.value.status === 'queued'" class="success" role="status">
      目录请求已发出，等待电脑端返回白名单。
    </p>
    <p v-else-if="listAction.state.value.error" class="error" role="alert">
      {{ messageFor(listAction.state.value.error) }}
    </p>
    <p v-if="listAction.state.value.stage" class="debug-stage" role="status">
      调试：{{ listAction.state.value.stage }}
    </p>
    <p v-if="openAction.state.value.status === 'completed'" class="success" role="status">
      电脑端已执行打开请求。
    </p>
    <p v-else-if="openAction.state.value.status === 'queued'" class="success" role="status">
      打开请求已发出，等待电脑端执行。
    </p>
    <p v-else-if="openAction.state.value.error" class="error" role="alert">
      {{ messageFor(openAction.state.value.error) }}
    </p>
    <p v-if="openAction.state.value.stage" class="debug-stage" role="status">
      调试：{{ openAction.state.value.stage }}
    </p>
    <details class="permission-note">
      <summary>这项演示需要什么权限</summary>
      <p>应用目录由电脑端维护白名单。手机端不能传入命令、路径或任意可执行文件。</p>
    </details>
  </section>
</template>
