<script setup lang="ts">
import type { StarterHost } from './diagnostics'
import { computed, ref } from 'vue'
import { messageFor, safePreview, useDemoAction, waitForRemoteResponse } from './demo'

const props = defineProps<{ host?: StarterHost, targetId?: string, targetOnline?: boolean }>()
const MAX_CLIPBOARD = 64 * 1024
const copiedText = ref('')
const returnedText = ref('')
const phoneCopyMessage = ref('')
const localClipboard = ref('')
const readAction = useDemoAction(props.host, 'starter.clipboard-read-selection')
const writeAction = useDemoAction(props.host, 'starter.clipboard-write')
const canUseTarget = computed(() => Boolean(props.host && props.targetId && props.targetOnline))

async function copyToPhone(text: string) {
  let hostFailure: unknown
  if (props.host?.clipboard) {
    try {
      await props.host.clipboard.write(text)
      return
    }
    catch (reason: unknown) {
      hostFailure = reason
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    }
    catch (reason: unknown) {
      hostFailure = reason
    }
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied)
    throw hostFailure ?? new Error('unsupported')
}

async function readFromComputer() {
  if (!canUseTarget.value)
    return
  const requestId = props.host?.requestId()
  if (!requestId)
    return
  const queued = await readAction.run({ target: props.targetId, requestId })
  if (typeof queued !== 'object' || queued === null || !('requestId' in queued) || typeof queued.requestId !== 'string')
    return
  try {
    const response = await waitForRemoteResponse(props.host!, requestId, stage => {
      readAction.state.value = { ...readAction.state.value, stage }
    })
    if (!response) {
      readAction.state.value = { status: 'timeout', error: 'timeout', stage: '等待电脑端响应超时' }
      return
    }
    if (response.status === 'error') {
      readAction.state.value = { status: 'failed', error: response.code ?? 'internal', stage: '已收到电脑端错误响应' }
      return
    }
    if (response.value === null) {
      readAction.state.value = { status: 'failed', error: 'empty_content', stage: '电脑端返回了空内容' }
      return
    }
    const text = typeof response.value === 'string' ? response.value : undefined
    if (text === undefined || text.length > MAX_CLIPBOARD) {
      readAction.state.value = { status: 'failed', error: 'internal', stage: '电脑端返回内容格式不正确' }
      return
    }
    returnedText.value = text
    await copyToPhone(text)
    phoneCopyMessage.value = '已复制到手机剪贴板'
    readAction.state.value = { status: 'completed', error: '', stage: '已收到文本并写入手机剪贴板' }
  }
  catch (reason: unknown) {
    phoneCopyMessage.value = ''
    readAction.state.value = { status: 'failed', error: typeof reason === 'object' && reason !== null && 'code' in reason && typeof reason.code === 'string' ? reason.code : 'unsupported', stage: '手机剪贴板写入失败' }
  }
}

async function sendToComputer() {
  if (!canUseTarget.value)
    return
  let text = localClipboard.value
  try {
    if (!text && props.host?.clipboard)
      text = await props.host.clipboard.read()
    else if (!text && navigator.clipboard)
      text = await navigator.clipboard.readText()
  }
  catch (reason: unknown) {
    writeAction.state.value = { status: 'failed', error: typeof reason === 'object' && reason !== null && 'code' in reason && typeof reason.code === 'string' ? reason.code : 'unsupported' }
    return
  }
  if (!text.trim()) {
    writeAction.state.value = { status: 'failed', error: 'empty_content' }
    return
  }
  if (text.length > MAX_CLIPBOARD) {
    writeAction.state.value = { status: 'failed', error: 'payload_too_large' }
    return
  }
  copiedText.value = safePreview(text)
  const requestId = props.host?.requestId()
  if (!requestId)
    return
  const queued = await writeAction.run({ target: props.targetId, requestId, text })
  if (typeof queued !== 'object' || queued === null || !('requestId' in queued) || typeof queued.requestId !== 'string')
    return
  try {
    const response = await waitForRemoteResponse(props.host!, requestId, stage => {
      writeAction.state.value = { ...writeAction.state.value, stage }
    })
    if (!response) {
      writeAction.state.value = { status: 'timeout', error: 'timeout', stage: '等待电脑端响应超时' }
    }
    else if (response.status === 'ok') {
      writeAction.state.value = { status: 'completed', error: '', stage: '已收到电脑端成功响应' }
    }
    else {
      writeAction.state.value = { status: 'failed', error: response.code ?? 'internal', stage: '已收到电脑端错误响应' }
    }
  }
  catch {
    writeAction.state.value = { status: 'failed', error: 'internal', stage: '响应处理失败' }
  }
}

function updateLocalClipboard(event: Event) {
  localClipboard.value = (event.target as HTMLTextAreaElement).value
}
</script>

<template>
  <section class="card demo-card" aria-labelledby="clipboard-title">
    <div class="section-heading">
      <div>
        <p class="card-kicker">
          能力演示 02
        </p>
        <h2 id="clipboard-title">
          剪贴板
        </h2>
      </div>
      <span class="badge">文本</span>
    </div>
    <div class="split-demo">
      <div>
        <h3>电脑到手机</h3>
        <p class="hint">
          请求电脑返回当前剪贴板内容。宿主确认返回后，再写入手机剪贴板。
        </p>
        <button type="button" :disabled="!canUseTarget || readAction.state.value.status === 'sending'" @click="readFromComputer">
          {{ readAction.state.value.status === 'sending' ? '正在请求…' : '复制电脑选中' }}
        </button>
        <p v-if="returnedText" class="result-box">
          {{ returnedText }}
        </p>
        <p v-if="phoneCopyMessage" class="success" role="status">
          {{ phoneCopyMessage }}
        </p>
        <p v-if="readAction.state.value.status === 'completed'" class="success" role="status">
          已复制到手机剪贴板。
        </p>
        <p v-else-if="readAction.state.value.status === 'queued'" class="success" role="status">
          请求已发出，等待电脑返回文本。
        </p>
        <p v-else-if="readAction.state.value.error" class="error" role="alert">
          {{ messageFor(readAction.state.value.error) }}
        </p>
        <p v-if="readAction.state.value.stage" class="debug-stage" role="status">
          调试：{{ readAction.state.value.stage }}
        </p>
      </div>
      <div>
        <h3>手机到电脑</h3>
        <p class="hint">
          读取手机当前剪贴板并发送到目标电脑，记录只保留截断预览。
        </p>
        <label class="sr-only" for="clipboard-preview">手机剪贴板预览</label>
        <textarea id="clipboard-preview" :value="localClipboard" rows="3" placeholder="可在预览中粘贴文本" @input="updateLocalClipboard" />
        <button type="button" :disabled="!canUseTarget || writeAction.state.value.status === 'sending'" @click="sendToComputer">
          {{ writeAction.state.value.status === 'sending' ? '正在发送…' : '发送复制内容' }}
        </button>
        <p v-if="copiedText" class="hint">
          发送内容预览：{{ copiedText }}
        </p>
        <p v-if="writeAction.state.value.status === 'completed'" class="success" role="status">
          电脑剪贴板已写入。
        </p>
        <p v-else-if="writeAction.state.value.status === 'queued'" class="success" role="status">
          请求已发出，等待电脑端写入。
        </p>
        <p v-else-if="writeAction.state.value.error" class="error" role="alert">
          {{ messageFor(writeAction.state.value.error) }}
        </p>
        <p v-if="writeAction.state.value.stage" class="debug-stage" role="status">
          调试：{{ writeAction.state.value.stage }}
        </p>
      </div>
    </div>
    <details class="permission-note">
      <summary>这项演示需要什么权限</summary>
      <p>读取和写入剪贴板分别受宿主权限控制。Starter 不把完整文本写入诊断调用记录。</p>
    </details>
  </section>
</template>
