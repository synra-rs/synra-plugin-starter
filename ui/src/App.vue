<script setup lang="ts">
import type { StarterHost } from './diagnostics'
import { computed, ref } from 'vue'
import AppDock from './AppDock.vue'
import ClipboardDemo from './ClipboardDemo.vue'
import { useDiagnostics, windowHost } from './diagnostics'
import OpenLinkDemo from './OpenLinkDemo.vue'
import TargetChooser from './TargetChooser.vue'
import { useTargets } from './targets'

type Tab = 'home' | 'demo' | 'developer' | 'diagnostics' | 'about'
const props = defineProps<{ host?: StarterHost }>()
const host = props.host ?? windowHost()
const activeTab = ref<Tab>(props.host ? 'diagnostics' : 'demo')
const targets = useTargets(host)
const diagnostics = useDiagnostics(host)
const context = computed(() => {
  if (!host)
    return undefined
  try {
    return { platform: host.env.platform(), appVersion: host.env.appVersion() }
  }
  catch {
    return undefined
  }
})
const selected = targets.selected
const tabs: Array<{ id: Tab, label: string }> = [
  { id: 'home', label: '首页' },
  { id: 'demo', label: '演示' },
  { id: 'developer', label: '开发者' },
  { id: 'diagnostics', label: '诊断' },
  { id: 'about', label: '关于' },
]

function go(tab: Tab) {
  activeTab.value = tab
}
</script>

<template>
  <main>
    <header class="page-header">
      <div>
        <p class="eyebrow">
          SYNRA / STARTER
        </p>
        <h1>让设备协作变得简单</h1>
        <p class="description">
          Starter 用几个真实动作展示 Synra 的设备协作、插件扩展和权限隔离。
        </p>
      </div>
      <nav class="tabs" aria-label="Starter 导航">
        <a v-for="tab in tabs" :key="tab.id" :href="`#${tab.id}`" :class="{ active: activeTab === tab.id }" :aria-current="activeTab === tab.id ? 'page' : undefined" @click.prevent="go(tab.id)">
          {{ tab.label }}
        </a>
      </nav>
    </header>

    <section v-if="activeTab === 'home'" class="card hero-card" aria-labelledby="home-title">
      <p class="card-kicker">
        Synra 能力展示插件
      </p>
      <h2 id="home-title">
        手机、电脑、宿主和插件，各自做好自己的事。
      </h2>
      <p>你选择目标电脑，Starter 负责参数校验和状态反馈，宿主负责权限、连接和电脑端效果。</p>
      <button type="button" @click="go('demo')">
        开始演示
      </button>
      <div class="concept-grid">
        <article><strong>设备协作</strong><span>明确选择目标，不偷偷替你决定。</span></article>
        <article><strong>插件扩展</strong><span>Rust/Wasm headless 与 Vue 页面通过 action 协作。</span></article>
        <article><strong>权限隔离</strong><span>每个动作只拿完成它所需的能力。</span></article>
      </div>
    </section>

    <template v-else-if="activeTab === 'demo'">
      <TargetChooser :host="host" :state="targets" />
      <OpenLinkDemo :host="host" :target-id="selected?.deviceId" :target-online="selected?.online" />
      <ClipboardDemo :host="host" :target-id="selected?.deviceId" :target-online="selected?.online" />
      <AppDock :host="host" :target-id="selected?.deviceId" :target-online="selected?.online" />
    </template>

    <section v-else-if="activeTab === 'developer'" class="card prose-card" aria-labelledby="developer-title">
      <p class="card-kicker">
        插件参考
      </p>
      <h2 id="developer-title">
        一次 action 调用经过哪些边界
      </h2>
      <ol class="steps">
        <li><strong>Vue 页面</strong><span>收集输入、目标设备和局部状态。</span></li>
        <li><strong>Rust/Wasm headless</strong><span>校验 URL、设备 ID、文本长度和稳定应用 ID。</span></li>
        <li><strong>Synra 宿主</strong><span>检查权限、在线状态和宿主是否实现该能力。</span></li>
        <li><strong>电脑端适配器</strong><span>执行浏览器、剪贴板或白名单应用操作。</span></li>
      </ol>
      <p class="hint">
        页面会保留宿主返回的真实状态，方便开发者验证权限、连接和动作边界。
      </p>
    </section>

    <template v-else-if="activeTab === 'diagnostics'">
      <section class="card" aria-labelledby="diagnostics-title">
        <div class="section-heading">
          <div>
            <p class="card-kicker">
              运行状态
            </p><h2 id="diagnostics-title">
              本机诊断
            </h2>
          </div>
          <span class="badge">Rust / Wasm</span>
        </div>
        <button type="button" data-testid="run-diagnostics" :disabled="!host || diagnostics.pending.value" @click="diagnostics.run">
          {{ diagnostics.pending.value ? '正在等待宿主…' : '运行诊断' }}
        </button>
        <p v-if="diagnostics.error.value" role="alert" class="error">
          {{ diagnostics.message() }}
        </p>
        <p v-else-if="diagnostics.pending.value" role="status" class="hint">
          正在读取当前插件的宿主环境。
        </p>
        <p v-else-if="!diagnostics.report.value" role="status" class="hint">
          运行后显示此插件 headless 组件返回的信息。
        </p>
        <dl v-if="diagnostics.report.value" aria-live="polite">
          <dt>插件</dt><dd>{{ diagnostics.report.value.pluginId }}</dd>
          <dt>插件版本</dt><dd>{{ diagnostics.report.value.pluginVersion }}</dd>
          <dt>WIT 契约</dt><dd>{{ diagnostics.report.value.contractVersion }}</dd>
          <dt>宿主 SDK</dt><dd>{{ diagnostics.report.value.hostSdkVersion }}</dd>
          <dt>宿主形态</dt><dd>{{ diagnostics.report.value.hostKind }}</dd>
          <dt>语言</dt><dd>{{ diagnostics.report.value.locale }}</dd>
          <dt>主题</dt><dd>{{ diagnostics.report.value.darkMode ? '深色' : '浅色' }}</dd>
        </dl>
      </section>
      <section v-if="context" class="card" aria-labelledby="host-title">
        <h2 id="host-title">
          界面宿主
        </h2>
        <dl><dt>平台</dt><dd>{{ context.platform }}</dd><dt>应用版本</dt><dd>{{ context.appVersion }}</dd></dl>
      </section>
      <section class="card" aria-labelledby="trace-title">
        <h2 id="trace-title">
          最近的诊断请求
        </h2>
        <p class="hint">
          记录诊断调用的耗时，最多保留 8 条，不保存返回文本。
        </p>
        <p v-if="!diagnostics.traces.value.length" class="empty">
          还没有请求记录
        </p>
        <ol v-else class="traces" aria-live="polite">
          <li v-for="trace in diagnostics.traces.value" :key="trace.id">
            <span>#{{ trace.id }}</span><code>{{ trace.code }}</code><span>{{ trace.elapsedMs }} ms</span>
          </li>
        </ol>
      </section>
    </template>

    <section v-else class="card prose-card" aria-labelledby="about-title">
      <p class="card-kicker">
        关于 Starter
      </p>
      <h2 id="about-title">
        Synra 的第一款能力展示插件
      </h2>
      <p>Starter 是开发参考、能力展示和诊断工具的组合。Touchpad 继续作为独立插件维护，不复制到这里。</p>
      <p class="hint">
        文档：synra-app.dev<br>源码：github.com/synra-rs/synra-plugin-starter
      </p>
      <details class="permission-note">
        <summary>当前边界</summary><p>演示不会执行任意命令、暴露应用路径或修改其他插件的全局确认策略。浏览器预览也不会伪造原生剪贴板和电脑端成功。</p>
      </details>
    </section>
  </main>
</template>
