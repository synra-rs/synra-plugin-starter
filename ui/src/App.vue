<script setup lang="ts">
import type { StarterHost } from './diagnostics'
import { computed } from 'vue'
import { useDiagnostics, windowHost } from './diagnostics'
import TargetChooser from './TargetChooser.vue'

const props = defineProps<{ host?: StarterHost }>()
const host = props.host ?? windowHost()
const { report, pending, error, traces, run, message } = useDiagnostics(host)
const context = computed(() => {
  if (!host)
    return undefined
  try {
    return {
      platform: host.env.platform(),
      appVersion: host.env.appVersion(),
    }
  }
  catch {
    return undefined
  }
})
</script>

<template>
  <main>
    <header>
      <p class="eyebrow">
        SYNRA / STARTER
      </p>
      <h1>Starter 调试台</h1>
      <p class="description">
        查看当前插件的 Rust 诊断结果与界面宿主信息。
      </p>
    </header>

    <section class="card" aria-labelledby="diagnostics-title">
      <div class="section-heading">
        <h2 id="diagnostics-title">
          本机诊断
        </h2>
        <span class="badge">Rust / Wasm</span>
      </div>
      <button type="button" data-testid="run-diagnostics" :disabled="!host || pending" @click="run">
        {{ pending ? '正在等待宿主…' : '运行诊断' }}
      </button>
      <p v-if="error" role="alert" class="error">
        {{ message() }}
      </p>
      <p v-else-if="pending" role="status" class="hint">
        正在读取当前插件的宿主环境。
      </p>
      <p v-else-if="!report" role="status" class="hint">
        运行后显示此插件 headless 组件返回的信息。
      </p>
      <dl v-if="report" aria-live="polite">
        <dt>插件</dt><dd>{{ report.pluginId }}</dd>
        <dt>插件版本</dt><dd>{{ report.pluginVersion }}</dd>
        <dt>WIT 契约</dt><dd>{{ report.contractVersion }}</dd>
        <dt>宿主 SDK</dt><dd>{{ report.hostSdkVersion }}</dd>
        <dt>宿主形态</dt><dd>{{ report.hostKind }}</dd>
        <dt>语言</dt><dd>{{ report.locale }}</dd>
        <dt>主题</dt><dd>{{ report.darkMode ? '深色' : '浅色' }}</dd>
      </dl>
    </section>

    <TargetChooser :host="host" />

    <section v-if="context" class="card" aria-labelledby="host-title">
      <h2 id="host-title">
        界面宿主
      </h2>
      <dl>
        <dt>平台</dt><dd>{{ context.platform }}</dd>
        <dt>应用版本</dt><dd>{{ context.appVersion }}</dd>
      </dl>
    </section>

    <section class="card" aria-labelledby="trace-title">
      <h2 id="trace-title">
        最近的诊断请求
      </h2>
      <p class="hint">
        记录本页诊断调用从发起到返回的耗时，最多保留 8 条。
      </p>
      <p v-if="!traces.length" class="empty">
        还没有请求记录
      </p>
      <ol v-else class="traces" aria-live="polite">
        <li v-for="trace in traces" :key="trace.id">
          <span>#{{ trace.id }}</span>
          <code>{{ trace.code }}</code>
          <span>{{ trace.elapsedMs }} ms</span>
        </li>
      </ol>
    </section>
  </main>
</template>
