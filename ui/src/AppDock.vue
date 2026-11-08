<script setup lang="ts">
import type { StarterHost } from './diagnostics'
import { computed, ref, watch } from 'vue'
import { messageFor, useDemoAction } from './demo'

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
  const answer = await listAction.run({ target: props.targetId })
  if (!Array.isArray(answer))
    return
  apps.value = answer.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('name' in item))
      return []
    if (typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name)
      return []
    return [{ id: item.id, name: item.name, icon: 'icon' in item && typeof item.icon === 'string' ? item.icon : undefined }]
  }).slice(0, 64)
}

async function openApp(app: AppEntry) {
  selectedApp.value = app.id
  await openAction.run({ target: props.targetId, appId: app.id })
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
    <p v-if="listAction.state.value.status === 'queued'" class="success" role="status">
      目录请求已发出，等待电脑端返回白名单。
    </p>
    <p v-else-if="listAction.state.value.error" class="error" role="alert">
      {{ messageFor(listAction.state.value.error) }}
    </p>
    <p v-if="openAction.state.value.status === 'queued'" class="success" role="status">
      打开请求已发出，等待电脑端执行。
    </p>
    <p v-else-if="openAction.state.value.error" class="error" role="alert">
      {{ messageFor(openAction.state.value.error) }}
    </p>
    <details class="permission-note">
      <summary>这项演示需要什么权限</summary>
      <p>应用目录由电脑端维护白名单。手机端不能传入命令、路径或任意可执行文件。</p>
    </details>
  </section>
</template>
