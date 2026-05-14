# 邸报 Dibao 视觉与交互设计规范 v0

## 文档目的

本文在低保真线框和 Design Tokens 之上，细化邸报 MVP 的视觉设计规范与核心页面交互规格。

它服务三个目标：

- 让推荐首页、文章阅读页、设置页可以进入前端实现。
- 让推荐解释、加载、空状态、错误状态在桌面和移动端都有一致规则。
- 约束实现继续保持“东方阅读器、报纸感、低饱和、细边线、高文字密度”的产品气质。

本文不替代：

- [MVP PRD](./mvp-prd.md)：产品范围与验收。
- [低保真页面线框](./wireframes.md)：页面骨架。
- [Design Tokens](./design-tokens.md)：CSS 变量系统。
- [API Contract](./api-contract.md)：前后端接口。
- [Profile Algorithm v0](./profile-algorithm-v0.md)：推荐排序与解释来源。

## 视觉设计规范 v0

### 视觉原则

邸报的界面应像一份安静、耐读、可长期停留的个人邸报。视觉服务于扫描、判断和阅读，不制造额外的展示欲。

核心原则：

- 文字优先：标题、来源、时间、摘要和正文始终是视觉主角。
- 报纸感：通过栏宽、细边线、密度和墨色层级建立秩序。
- 低饱和：强调色只用于状态、焦点和少量主操作。
- 少卡片：列表项以分隔线组织，不使用大面积卡片堆叠。
- 少渐变：MVP 默认不使用背景渐变、装饰光斑和营销式 hero。
- 可解释：推荐原因在用户需要时可见，但不抢占阅读流。
- 可调教：用户反馈入口清楚，操作后状态要立即可感知。

### 页面结构

桌面端采用稳定三层结构：

```text
App Shell
  Top Bar: 品牌、全局搜索、系统入口
  Side Nav: 主要区域导航
  Main: 当前页面内容
```

移动端采用顶部栏 + 主内容 + 底部导航：

```text
Mobile Shell
  Top Bar: 当前区域、搜索、设置或更多
  Main: 当前页面内容
  Bottom Nav: 推荐、最新、收藏、稍后
```

结构规则：

- 顶栏高度使用 `--layout-topbar-height`。
- 桌面侧边栏宽度使用 `--layout-sidebar-width`。
- 移动底部导航高度使用 `--layout-bottom-nav-height`。
- 主内容不放在浮动大卡片中；页面之间通过边线、留白和标题层级区分。
- 页面最大宽度按内容类型控制：列表用 `--layout-list-max`，设置用 `--layout-settings-max`，阅读正文用 Reader Tokens。

### 色彩与层级

默认主题使用 `--color-canvas` 作为页面底色，`--color-surface` 只用于输入框、弹层、表单区域和必要的 raised surface。

使用规则：

- 主文字：`--color-ink`。
- 摘要和正文次级信息：`--color-ink-soft`。
- 来源、时间、计数、辅助说明：`--color-muted`。
- 禁用、占位、低优先级提示：`--color-faint`。
- 页面结构线：`--color-line` 或 `--color-line-subtle`。
- 主要可交互强调：`--color-accent`。
- 成功、警告、危险状态只使用对应功能色，不另造色值。

避免：

- 大面积纯白卡片漂浮在纸白背景上。
- 用彩色背景承载普通列表项。
- 只靠颜色表达状态；必须结合文字、图标或 aria 状态。

### 字体与排版

UI 字体使用 `--font-ui`，阅读正文使用 `--font-reader-sans` 或 `--font-reader-serif`。

排版规则：

- App UI 默认字号以 `--text-sm` 和 `--text-md` 为主。
- 列表标题使用 `--text-lg`，未读为 `--weight-semibold`。
- 页面标题使用 `--text-2xl`，只在页面顶部出现一次。
- 阅读正文默认 18px，由 `--reader-font-size` 控制。
- `letter-spacing` 保持 0。
- 不使用 viewport width 动态缩放字体。
- 中文和英文混排时，元信息用中点或间隔符保持短句结构，例如 `少数派 · 2 小时前 · 作者`。

### 边线、圆角与阴影

边线是邸报的主要空间组织方式。

规则：

- 页面分区、列表项、工具栏使用 `--border-subtle` 或 `--border-default`。
- 常规控件圆角使用 `--radius-sm` 或 `--radius-md`。
- 弹层最大使用 `--radius-lg`。
- 阴影只用于 Popover、Dialog、Bottom Sheet。
- 列表项 hover 不升起，只改变背景为 `--color-surface-subtle` 或显示操作区。

### 图标与控件

前端应优先使用 Design System 组件，并基于 React Aria Components 实现交互语义。

控件规则：

- 图标按钮必须有 `aria-label` 和 tooltip。
- 熟悉图标可单独出现，例如收藏、返回、设置、刷新。
- 不熟悉或破坏性操作要使用文字或图标 + 文本。
- Segmented control 用于排序或状态切换。
- Toggle / Checkbox 用于布尔配置。
- Slider / Stepper / NumberField 用于阅读参数。
- Select / RadioGroup 用于 provider 类型、字体、主题等互斥选项。

## 推荐首页

### 信息架构

推荐首页是用户日常入口，核心任务是快速判断“现在最值得读什么”。

桌面端主区域结构：

```text
Header Row
  Page title: 推荐
  Status: 未读数量、最近刷新时间
  Actions: 刷新、筛选
Control Row
  View segmented control: 推荐 / 最新 / 未读 / 全部
  Optional filters: 来源、分组
Article List
  ArticleItem[]
```

移动端结构：

```text
Top Bar
  邸报 / 搜索 / 设置
Page Header
  推荐 + 未读数量
Control Row
  横向滚动 segmented control
Article List
Bottom Nav
```

### ArticleItem 规格

每个列表项由 4 个稳定区域组成：

```text
Meta Row: 来源 · 时间 · 可选状态
Title Row: 标题 + 可选未读标记
Summary Row: 摘要，最多 2 行
Action Row: 收藏、稍后读、不感兴趣、为什么
```

桌面端：

- 列表宽度不超过 `--layout-list-max`。
- 列表项 padding 使用 `--article-item-padding-y` 和 `--article-item-padding-x`。
- Action Row 可以常显，也可以在 hover / focus-within 时增强显示，但移动端必须常显。
- 点击列表主体进入阅读页。
- 点击操作按钮不得触发进入阅读页。

移动端：

- 列表项左右 padding 为 16px。
- Action Row 常显，触摸目标不小于 44px。
- 摘要最多 2 行；无摘要时不保留空白。
- 长标题最多 3 行，仍不得挤压操作区。

状态：

- 未读：标题 `--color-ink` + `--weight-semibold`。
- 已读：标题 `--color-muted` + `--weight-regular`，摘要可弱化。
- 收藏：收藏图标使用 positive 或 accent 状态，但不要整行变色。
- 稍后读：显示轻量状态标记。
- 不感兴趣 / hidden：默认从推荐列表移除。
- loading mutation：按钮进入 busy 状态，列表项不整体闪烁。

### 首页加载状态

首次加载：

- 保留 App Shell。
- Header 和 Control Row 使用真实布局。
- Article List 使用 8 到 12 行骨架屏。
- 骨架屏应模拟文本行，不使用大块卡片闪烁。

分页加载：

- 列表底部显示细线分隔后的加载行。
- 不遮挡已有内容。
- 使用 `aria-live="polite"` 宣告“正在加载更多文章”。

刷新中：

- 刷新按钮显示 busy 状态。
- Header 状态显示“正在刷新订阅源”或最近任务状态。
- 不清空当前列表。

### 首页空状态

无订阅源：

```text
还没有订阅源
导入 OPML 或添加一个 RSS 源。
[导入 OPML] [添加 RSS]
```

无推荐文章：

```text
暂时没有推荐文章
可以先查看最新文章，或刷新订阅源。
[查看最新] [刷新订阅源]
```

Embedding 未配置：

```text
当前使用基础排序
配置 embedding provider 后，邸报可以更好地学习你的偏好。
[去配置] [暂时不用]
```

空状态视觉：

- 使用普通页面流，不用插画和大卡片。
- 文案最多两行说明。
- 操作按钮不超过两个。

### 首页错误状态

文章列表加载失败：

- 在列表区域顶部显示 inline error。
- 保留旧数据时显示“列表可能不是最新”。
- 提供“重试”按钮。

订阅源刷新失败：

- Header 状态显示失败数量，例如 `3 个源刷新失败`。
- 点击进入订阅源或任务状态查看详情。
- 不在首页展开长错误堆栈。

推荐排序不可用：

- 自动回退到基础排序或最新排序。
- 显示 neutral notice：`推荐排序暂不可用，当前显示基础排序。`
- 推荐解释返回 fallback reason 时，解释入口仍可打开。

## 推荐解释 Popover / Bottom Sheet

### 数据来源

推荐解释来自 `GET /api/articles/:id/explanation`，展示 `RankExplanation.reasons`。

前端不重新计算原因，不展示完整分数，不推断算法内部状态。

### 桌面 Popover

触发：

- ArticleItem 中的“为什么”按钮。
- 键盘 focus 后按 Enter / Space 打开。

布局：

```text
推荐原因
生成时间或状态（可选）
Reason List, 3-5 条
Footer action（可选）：调整推荐设置
```

Reason 行规格：

- positive 使用 `+` 或正向图标 + `--color-positive`。
- negative 使用 `-` 或负向图标 + `--color-danger`。
- neutral 使用普通圆点 + `--color-muted`。
- label 使用后端返回文案，例如 `AI 工具`、`2 小时前`。
- reason type 可映射为短前缀：`匹配兴趣`、`来源`、`新鲜度`、`重复`、`基础排序`。

交互：

- 使用 React Aria `Popover` / `DialogTrigger`。
- 打开后 focus 进入 Popover 标题或第一条内容。
- Escape 关闭。
- 点击外部关闭。
- 关闭后 focus 返回触发按钮。
- 同一时间只打开一个解释 Popover。

加载与错误：

- 打开后若数据未缓存，Popover 内显示短骨架或“正在读取推荐原因”。
- 请求失败时显示 `暂时无法读取推荐原因` + `重试`。
- fallback reason 正常展示，不作为错误。

### 移动 Bottom Sheet

触发：

- ArticleItem Action Row 中的“为什么”按钮。

布局：

```text
Sheet Header: 推荐原因 / 关闭
Reason List
Optional Footer: 不感兴趣 / 调整推荐
```

行为：

- 从底部进入，高度由内容决定，最大不超过 80vh。
- 背景有轻量 scrim，但不做强模糊。
- 支持关闭按钮、Escape、系统返回或点击 scrim 关闭。
- Sheet 打开时锁定 body scroll。
- Sheet 内部内容超过高度时独立滚动。

可访问性：

- 使用 modal dialog 语义。
- 初始 focus 到 Sheet 标题或关闭按钮。
- 关闭后返回触发按钮。
- 触摸目标不小于 44px。

## 文章阅读页

### 桌面端状态

桌面阅读页结构：

```text
Reader Header Bar
  Back
  Source / Navigation context
  Actions: 原文、阅读设置
Article Header
  Title
  Meta: 来源 · 发布时间 · 作者
  Optional extraction state
Reader Body
  contentHtml 或 feed summary fallback
Article Actions
  收藏、稍后读、不感兴趣、标记未读
```

视觉规则：

- Reader Body 居中，宽度由 `--reader-width` 控制。
- 标题、元信息、正文共享同一阅读宽度。
- 正文不放在卡片里。
- 顶部工具条使用底边线，滚动时可 sticky。
- 原文链接使用普通文字按钮或外链图标按钮。

### 移动端状态

移动阅读页结构：

```text
Top Reader Bar
  Back / 原文 / 设置
Article Header
Reader Body
Bottom Action Bar
  收藏 / 稍后 / 不感兴趣
```

规则：

- 顶部栏可 sticky，但高度保持紧凑。
- 底部 Action Bar 不遮挡正文结尾；正文底部 padding 至少等于 Action Bar 高度 + 24px。
- 阅读设置在移动端使用 Bottom Sheet。
- 正文宽度为 `100% - 32px`，不使用桌面 readerWidth 上限造成窄屏溢出。

### 阅读状态与行为记录

进入阅读页：

- 立即发送 `open` action。
- 若文章未读，可以在本地弱化“未读”标记，但不必立刻标记已读。

滚动：

- 记录最高阅读进度。
- `read_progress` 节流发送，建议间隔不小于 5 秒或进度跨过 25 / 50 / 75 阈值。
- 离开页面前尽量 flush 最新进度。

读完：

- 达到 90% 或后端定义条件时发送 `read_complete`。
- 不因短暂停留误判完成阅读。

显式操作：

- 收藏、稍后读、不感兴趣、标记已读 / 未读立即乐观更新。
- 请求失败时恢复状态并提示。
- 不感兴趣后可以返回上一页，并从推荐列表移除该文章。

### 正文内容状态

`extractionStatus = success`：

- 渲染 `contentHtml`。
- 对正文 HTML 做安全清洗，仅允许阅读所需标签。

`feed_only` 或 `contentHtml = null`：

- 显示摘要或 `contentText` fallback。
- 提供“打开原文”主操作。
- 显示轻量提示：`当前仅有订阅源摘要。`

`pending`：

- 显示正文骨架。
- 提供原文链接。
- 可显示 `正在抽取正文`。

`failed`：

- 显示错误提示和原文链接。
- 可提供“重试抽取”，若 API 后续支持。

### 阅读设置面板

桌面端使用 Popover 或侧向 Panel；移动端使用 Bottom Sheet。

字段：

- 字体：sans / serif。
- 字号：16px - 24px，step 1px。
- 行高：1.45 - 2.1，step 0.05。
- 段间距：0.6em - 1.6em，step 0.1em。
- 阅读宽度：560px - 860px，step 40px，仅桌面完整展示。
- 背景：paper / white / dark，MVP 至少实现 paper 与 white。

交互：

- 调整后实时更新当前阅读页 CSS Variables。
- 使用 debounce 保存到 `PATCH /api/settings`。
- 保存失败时不打断阅读，显示 inline notice。
- 提供“恢复默认”按钮。

实现映射：

```tsx
<article
  className={styles.reader}
  data-reader-theme={settings.reader.theme}
  style={{
    "--reader-font-size": `${settings.reader.fontSize}px`,
    "--reader-line-height": settings.reader.lineHeight,
    "--reader-paragraph-gap": `${settings.reader.paragraphGap}em`,
    "--reader-width": `${settings.reader.readerWidth}px`,
  } as React.CSSProperties}
/>
```

## 设置页

### 设置页总体结构

桌面端：

```text
Settings Shell
  Settings Nav: 推荐能力、阅读设置、数据保留、系统信息
  Settings Panel: 当前设置内容
```

移动端：

```text
Settings List
  推荐能力
  阅读设置
  数据保留
  系统信息
Detail View or stacked sections
```

规则：

- 设置页可以使用分区 surface，但不要做多层卡片嵌套。
- 表单最大宽度使用 `--layout-settings-max`。
- 每个设置项包括 label、control、help text、error text。
- 破坏性操作单独分区并要求确认。

### Embedding Provider 设置

#### 目标

用户需要理解当前推荐能力是否可用、文本会不会发送到第三方、模型变更是否需要重建索引。

#### 信息区

顶部显示当前状态：

```text
当前 Provider：Ollama
当前模型：bge-m3
Dimension：1024
状态：连接正常
Active Index：index_01
最近测试：2026-05-14 08:00
```

状态映射：

- success：`连接正常`，positive。
- failed：`连接失败`，danger，显示最近错误摘要。
- untested：`尚未测试`，muted。
- disabled：`未启用`，neutral。
- no provider：`当前使用基础排序`，warning 或 neutral。

#### Provider 类型

使用 RadioGroup：

- 内置基础模型：低资源或 fallback。
- Ollama：本地推荐。
- OpenAI-compatible：云端或兼容服务。
- Custom HTTP：高级用户。
- 暂不配置：仅基础排序。

当选择云端或外部 provider：

- 必须显示数据发送提醒。
- 文案示例：`用于生成 embedding 的标题、摘要和正文片段会发送到你配置的 provider。`
- 提醒不使用恐吓式红色，除非 provider 测试失败。

#### 表单字段

通用字段：

- Name。
- Base URL。
- Model。
- Dimension。
- API Key。
- Enabled。

按类型显示：

- 内置基础模型：只显示模型说明和资源占用提示。
- Ollama：Base URL 默认 `http://localhost:11434`，API Key 隐藏。
- OpenAI-compatible：Base URL、Model、API Key、Dimension。
- Custom HTTP：Base URL、Model、Dimension、可选 header 配置后续再做。
- 暂不配置：隐藏技术字段，显示基础排序说明。

字段错误：

- URL 格式错误：字段下方 inline error。
- Dimension 非数字或超出范围：字段下方 inline error。
- API Key 缺失：仅在 provider 类型需要时提示。

#### 测试连接

按钮：`测试连接`

行为：

- 测试前保存草稿或发送当前表单数据，由具体 API 设计决定；MVP 可以先要求保存后测试。
- 测试中按钮 busy，禁止重复点击。
- 成功显示 latency 和 dimension。
- 失败显示 provider 返回状态或简短错误。

#### 保存与重建索引

保存：

- 修改 provider 后点击 `保存`。
- 保存成功后更新状态区。
- 若模型、dimension、provider 类型改变，显示 rebuild notice。

重建索引：

- 按钮文案：`重建索引`。
- 触发 `POST /api/embedding/indexes/:id/rebuild`。
- 二次确认内容说明：重建会重新生成或重写索引，期间推荐可能使用基础排序。
- 重建中显示任务状态链接。
- 不在设置页阻塞用户离开。

#### Provider 空 / 错误 / 加载状态

加载：

- 状态区和表单显示文本骨架。
- 操作按钮 disabled。

无 provider：

```text
当前使用基础排序
你仍然可以阅读和按时间排序。配置 embedding provider 后，推荐会学习你的阅读偏好。
[添加 Provider] [继续使用基础排序]
```

provider 测试失败：

```text
连接失败
请检查 Base URL、模型名称和 API Key。
[重新测试]
```

provider 列表加载失败：

- 显示 inline error。
- 提供 `重试`。
- 不清空已缓存配置。

### 阅读设置

阅读设置既出现在设置页，也出现在阅读页面板。两处使用同一组字段和同一套 Reader Tokens。

设置页展示：

- 字体。
- 字号。
- 行高。
- 段间距。
- 阅读宽度。
- 背景。
- 预览区域。

预览区域：

- 使用一段短文章样例。
- 不放在强卡片里，可用上边线和标题 `预览` 分隔。
- 即时响应当前参数。

保存规则：

- 设置页可以自动保存，也可以显式 `保存`；MVP 建议显式保存，阅读页面板建议 debounce 自动保存。
- 提供 `恢复默认`。
- 保存失败时保留用户当前本地值，并提示稍后重试。

### 推荐设置

MVP 可以先隐藏高级推荐滑块；若展示，应保持简单：

- 新鲜度倾向：`preferFreshness`。
- 来源倾向：`preferSource`。
- 多样性倾向：`preferDiversity`。

文案必须说明这些滑块只调整排序倾向，不直接改画像。

### 数据保留与系统信息

数据保留：

- 保留天数使用 NumberField。
- 保留收藏文章、保留稍后读文章使用 Checkbox。
- `立即清理` 需要确认。

系统信息：

- 展示 version、dataDir、databasePath、active provider、active index。
- 健康状态使用简短 status rows。
- 失败项提供查看任务或重试入口。

## 全局状态规范

### Loading

使用三种加载层级：

- Page loading：页面主数据首次加载，显示骨架。
- Section loading：设置页某一分区加载，保留其他分区。
- Control loading：按钮或单个控件提交中。

规则：

- 不使用全屏 spinner 替代完整布局。
- 骨架屏模拟最终文字结构。
- 已有数据刷新时不清空页面。

### Empty

空状态必须回答三件事：

- 现在是什么状态。
- 为什么用户会看到它。
- 用户下一步可以做什么。

规则：

- 文案克制。
- 操作不超过两个。
- 不使用装饰插画。

### Error

错误分三类：

- Inline error：表单字段、单个列表项、单个 section。
- Page error：主页面数据无法加载。
- Background error：刷新、抽取、embedding 等后台任务失败。

规则：

- 用户可恢复的错误提供重试。
- 技术细节收进详情或任务页，不在主阅读流展开。
- 后台错误不应阻断阅读已有文章。

### Optimistic Update

适用：

- 收藏。
- 稍后读。
- 标记已读 / 未读。
- 不感兴趣。

规则：

- 操作后立即更新本地状态。
- 请求失败时回滚并显示 inline toast / notice。
- 不感兴趣是强负反馈，移动端可在操作后显示短暂 undo；MVP 若不实现 undo，则二次确认不需要常态出现，但误触风险要通过按钮位置和文案降低。

## 可访问性要求

### 语义

- App Shell 使用 landmark：`header`、`nav`、`main`。
- 页面标题使用单个 `h1`。
- ArticleItem 标题使用合理 heading 或可访问链接文本。
- 阅读正文使用 `article`。
- 设置分区使用 `section` + heading。

### 键盘

- 所有操作可通过键盘完成。
- Tab 顺序符合视觉顺序。
- Popover、Dialog、Bottom Sheet 关闭后 focus 返回触发元素。
- Escape 关闭非必要浮层。
- 不依赖 hover 暴露核心操作。

### 焦点

- 所有可交互元素必须有可见 focus ring。
- focus ring 使用 `--focus-ring` 和 `--focus-ring-offset`。
- focus 样式不能只靠颜色深浅变化。

### 屏幕阅读器

- 图标按钮必须有 `aria-label`。
- 加载状态使用 `aria-busy`。
- 异步结果和错误使用 `aria-live="polite"`，破坏性错误可用 `assertive`。
- Segmented control、RadioGroup、Slider 使用 React Aria Components 提供的语义。
- 推荐原因列表需要传达 positive / negative / neutral，不只显示符号。

### 触摸与移动

- 移动端主要触摸目标不小于 44px。
- 底部导航和底部操作条不遮挡正文。
- Sheet 支持触摸滚动，内部滚动和页面滚动不冲突。

### Reduced Motion

- 遵守 `prefers-reduced-motion`。
- Popover 和 Sheet 动效在 reduced motion 下缩短或取消。
- 阅读列表不做持续动画。

## 前端实现注意事项

### 技术约束

- 使用 CSS Modules + CSS Variables。
- 使用 React Aria Components 承载 Button、Dialog、Popover、Tabs、RadioGroup、Slider、NumberField、Switch、Tooltip 等交互。
- 使用 Dibao Design System 组件，不在页面内临时拼散装控件。
- 所有颜色、间距、圆角、阴影、字体来自 tokens。

### 建议组件拆分

```text
AppShell
  DesktopSidebar
  MobileBottomNav
  TopBar

ArticleList
  ArticleItem
  ArticleItemActions
  RecommendationExplanationTrigger

RecommendationExplanation
  ExplanationPopover
  ExplanationSheet
  ExplanationReasonList

Reader
  ReaderToolbar
  ReaderContent
  ReaderActionBar
  ReaderSettingsPanel

Settings
  SettingsShell
  EmbeddingProviderSettings
  ReaderSettingsForm
  RetentionSettingsForm
  SystemInfoPanel
```

### API 消费

推荐首页：

- `GET /api/articles?view=recommended&status=unread`
- `POST /api/feeds/refresh`
- `POST /api/articles/:id/actions`
- `GET /api/articles/:id/explanation`

阅读页：

- `GET /api/articles/:id`
- `POST /api/articles/:id/actions`
- `GET /api/settings`
- `PATCH /api/settings`

设置页：

- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/embedding/providers`
- `POST /api/embedding/providers`
- `PATCH /api/embedding/providers/:id`
- `POST /api/embedding/providers/:id/test`
- `GET /api/embedding/indexes`
- `POST /api/embedding/indexes/:id/rebuild`
- `GET /api/system/info`
- `GET /api/system/health`

### CSS Modules 规则

- 页面级布局类只定义布局，不硬编码组件细节。
- 组件 module 内使用 `var(--token-name)`。
- 不在组件中写一次性色值。
- 不用嵌套卡片阴影表达层级。
- 移动端断点以布局需求为准，优先从窄屏布局渐进增强。

### 数据与状态

- 推荐解释按 article id 缓存，重新排序或刷新后可失效。
- 阅读设置可在全局 settings store 中维护，并同步到 Reader CSS Variables。
- 列表 action 使用乐观更新，但要能回滚。
- 后台任务状态不阻塞前台阅读。

### HTML 内容安全

- `contentHtml` 必须清洗后渲染。
- 禁止文章正文脚本执行。
- 外链默认在新标签打开，并使用安全 rel。
- 图片、代码块、表格需要有基础响应式样式，不能撑破阅读宽度。

### 验收检查

实现进入视觉 QA 前至少检查：

- 桌面推荐首页在 1024px、1280px、1440px 下无文本重叠。
- 移动推荐首页在 375px、390px、430px 下操作目标可触摸。
- 阅读页调整字号、行高、段距、宽度后正文稳定。
- 推荐解释桌面 Popover 和移动 Bottom Sheet 均可键盘关闭。
- Provider 设置能表达 no provider、success、failed、testing、rebuild needed。
- 加载、空、错误状态不破坏 App Shell。
- 所有图标按钮有 `aria-label`。
- 默认主题没有大面积渐变、装饰光斑或营销式 hero。
