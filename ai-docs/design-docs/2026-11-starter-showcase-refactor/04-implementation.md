# 技术实现与边界

## 1. 现有代码迁移

- `App.vue` 重构为页面壳层和 Tab 状态；
- 当前 `TargetChooser.vue` 改为演示页顶部的共享目标选择器；
- 当前诊断 composable 和组件迁移到“诊断”Tab；
- 新增链接、剪贴板和应用坞各自的组件与 composable；
- 样式拆分为主题 token、布局、卡片和状态样式，避免单文件继续膨胀。

## 2. UI 与 headless 分工

- UI 只负责输入、目标选择、状态展示和宿主客户端调用；
- Rust/Wasm 负责 action 声明、参数校验、权限范围和远端动作请求；
- 电脑端平台效果仍由宿主平台适配器执行；
- 所有 action 返回结构化成功或错误，不根据“请求发出”伪造动作成功。

## 3. 建议的演示动作契约

具体命名需与当前 Synra 协议确认，建议保持动作粒度小：

```text
starter.open-url
starter.clipboard-read-selection
starter.clipboard-write
starter.apps-list
starter.apps-open
```

动作参数必须是结构化对象：

- URL 动作只接受 URL 字符串和设备 ID；
- 剪贴板动作区分读取电脑选中内容与写入电脑内容；
- 应用打开只接受稳定应用 ID；
- 应用列表返回名称、图标引用、稳定 ID，不返回任意执行路径。

## 4. 与现有能力的关系

当前 Starter 已有：

- 真实 Rust/Wasm action；
- 宿主环境诊断；
- 设备列表与显式目标选择；
- 插件 UI 与 headless 组件；
- 结构化错误和调用状态。

需要补齐或确认：

- Starter 专用远程 URL action；
- 电脑选中文本读取和手机剪贴板写入链路；
- 手机剪贴板写入电脑链路；
- 安全的应用目录读取和应用 ID 打开链路；
- Starter 演示动作的授权范围；
- 不经过电脑确认的演示专用授权边界。

## 5. 明确不做

- 不在 Starter 中实现 Touchpad；
- 不把 Starter 变成设备管理器；
- 不允许手机传递任意可执行文件路径；
- 不把所有跨设备操作改成全局免确认；
- 不把浏览器预览当成真实跨设备能力验收；
- 不用测试夹具声称真实系统剪贴板、窗口或应用效果已经验收。
