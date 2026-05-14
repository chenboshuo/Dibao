# 邸报 Dibao Design Tokens v0

## 文档目的

本文定义邸报 MVP 的设计 tokens 初稿，用于后续 React + CSS Modules + CSS Variables 实现。

目标不是一次性定死视觉稿，而是先给前端实现一个稳定的变量系统，使阅读体验、移动端布局和后续主题设置都能落到一致的 CSS 变量上。

## 设计原则

- 文字优先，界面为阅读服务。
- 信息密度高，但留出清晰呼吸。
- 少卡片，少渐变，少装饰。
- 使用细边线、墨色层级和克制强调色。
- 卡片和弹层圆角不超过 8px。
- 字号不随 viewport 宽度自动缩放。
- letter spacing 默认为 0。
- 用户可调阅读参数全部通过 CSS Variables 实现。

## Token 分层

```text
System Tokens
控制整个 App 的基础视觉：颜色、字体、间距、边线、圆角、层级。

Reader Tokens
控制文章阅读体验：字号、行高、段距、阅读宽度、字体、背景。

Component Tokens
将系统变量映射到具体组件：按钮、列表、输入框、弹层、底部面板。
```

## CSS 文件结构

建议初始结构：

```text
apps/web/src/styles/
  reset.css
  tokens.css
  reader-tokens.css
  themes.css

apps/web/src/design-system/
  Button/Button.module.css
  ArticleItem/ArticleItem.module.css
  Reader/Reader.module.css
  Popover/Popover.module.css
  BottomSheet/BottomSheet.module.css
```

加载顺序：

```text
reset.css
tokens.css
reader-tokens.css
themes.css
component module css
```

## 颜色系统

邸报需要纸本感，但不能变成单一米色系。默认主题使用纸白作为背景，墨色作为主体，松绿、靛青和朱砂作为少量功能强调色。

### Default Theme

```css
:root {
  --color-canvas: #f7f4ed;
  --color-surface: #fffefa;
  --color-surface-subtle: #f1eee6;
  --color-surface-raised: #fffefa;

  --color-ink: #202421;
  --color-ink-soft: #3d423d;
  --color-muted: #6d716b;
  --color-faint: #9b9d96;
  --color-inverse: #fffefa;

  --color-line: #d8d6ca;
  --color-line-strong: #b9b6a9;
  --color-line-subtle: #e9e5da;

  --color-accent: #315f72;
  --color-accent-hover: #264f60;
  --color-accent-soft: #dce8ec;

  --color-positive: #4f6f52;
  --color-positive-soft: #dfe8dc;
  --color-warning: #a66a2c;
  --color-warning-soft: #f2e2cb;
  --color-danger: #a64235;
  --color-danger-soft: #edd8d4;

  --color-focus: #315f72;
  --color-selection: #dce8ec;
}
```

### Dark Theme

暗色主题不作为 MVP 的视觉主战场，但 token 从一开始预留。

```css
[data-theme="dark"] {
  --color-canvas: #171a18;
  --color-surface: #1f231f;
  --color-surface-subtle: #252a25;
  --color-surface-raised: #292e29;

  --color-ink: #ece8dc;
  --color-ink-soft: #d4d0c5;
  --color-muted: #aaa79d;
  --color-faint: #78766e;
  --color-inverse: #171a18;

  --color-line: #3b403b;
  --color-line-strong: #575d55;
  --color-line-subtle: #30352f;

  --color-accent: #8fb5c3;
  --color-accent-hover: #a2c4cf;
  --color-accent-soft: #243840;

  --color-positive: #9fbe99;
  --color-positive-soft: #253625;
  --color-warning: #d5a46b;
  --color-warning-soft: #3f2e1d;
  --color-danger: #d58f85;
  --color-danger-soft: #422925;

  --color-focus: #8fb5c3;
  --color-selection: #243840;
}
```

## 字体系统

### Font Family

```css
:root {
  --font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC",
    "Noto Sans JP", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
    sans-serif;

  --font-reader-sans: -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Noto Sans SC", "Noto Sans JP", "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", sans-serif;

  --font-reader-serif: "Noto Serif SC", "Noto Serif JP", "Songti SC",
    "STSong", "Iowan Old Style", "Times New Roman", serif;

  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}
```

说明：

- UI 默认使用系统 sans。
- 阅读器允许用户在 sans / serif 之间切换。
- 不在 MVP 中强依赖远程字体。

### Font Size

```css
:root {
  --text-xs: 12px;
  --text-sm: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 18px;
  --text-2xl: 22px;
  --text-3xl: 28px;
}
```

使用建议：

```text
侧边栏、元信息：--text-sm
列表正文：--text-md
列表标题：--text-lg
阅读正文：由 Reader Tokens 控制，默认 18px
页面标题：--text-2xl
```

### Font Weight

```css
:root {
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
}
```

## 间距系统

采用 4px 基础网格。

```css
:root {
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

布局建议：

```text
列表项垂直 padding：12px 或 16px
页面左右 padding：24px desktop / 16px mobile
控件内部 gap：8px
阅读页顶部与正文间距：24px
```

## 圆角

```css
:root {
  --radius-none: 0;
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-pill: 999px;
}
```

规则：

- 常规控件用 `--radius-sm` 或 `--radius-md`。
- 弹层可用 `--radius-lg`。
- 不使用大圆角卡片作为页面结构。
- `--radius-pill` 只用于小型状态标签或 segmented controls。

## 边线与阴影

```css
:root {
  --border-thin: 1px;
  --border-default: 1px solid var(--color-line);
  --border-subtle: 1px solid var(--color-line-subtle);
  --border-strong: 1px solid var(--color-line-strong);

  --shadow-none: none;
  --shadow-popover: 0 8px 24px rgb(32 36 33 / 0.12);
  --shadow-sheet: 0 -8px 24px rgb(32 36 33 / 0.14);
}
```

规则：

- 页面结构优先用边线，不用阴影。
- 阴影只用于 Popover、Dialog、Bottom Sheet 等浮层。

## 尺寸与布局

```css
:root {
  --layout-sidebar-width: 176px;
  --layout-topbar-height: 48px;
  --layout-bottom-nav-height: 56px;
  --layout-content-max: 1120px;
  --layout-list-max: 760px;
  --layout-settings-max: 840px;
}
```

Breakpoints：

```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}
```

说明：

- CSS Modules 中可直接写 media query。
- tokens 主要作为文档约束，CSS custom media 可后续再引入。

## Motion

```css
:root {
  --duration-fast: 120ms;
  --duration-normal: 180ms;
  --duration-slow: 240ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

规则：

- 阅读列表不做花哨动效。
- 只为 hover、focus、popover、bottom sheet 提供短动效。
- 尊重 `prefers-reduced-motion`。

## Focus 与可访问性

```css
:root {
  --focus-ring: 0 0 0 2px var(--color-focus);
  --focus-ring-offset: 2px;
  --target-min: 36px;
  --target-min-mobile: 44px;
}
```

规则：

- 所有可交互元素必须有可见 focus。
- 图标按钮必须有 `aria-label`。
- 移动端主要触摸目标不小于 44px。

## Reader Tokens

Reader Tokens 是用户可调阅读体验的核心。它们必须能在运行时通过 React style 或 data attributes 覆盖。

### 默认值

```css
:root {
  --reader-font-family: var(--font-reader-sans);
  --reader-font-size: 18px;
  --reader-line-height: 1.75;
  --reader-paragraph-gap: 1.1em;
  --reader-width: 720px;
  --reader-title-size: 28px;
  --reader-title-line-height: 1.28;
  --reader-meta-size: 13px;
  --reader-background: var(--color-canvas);
  --reader-foreground: var(--color-ink);
}
```

### 允许范围

```text
fontSize: 16px - 24px, step 1px, default 18px
lineHeight: 1.45 - 2.1, step 0.05, default 1.75
paragraphGap: 0.6em - 1.6em, step 0.1em, default 1.1em
readerWidth: 560px - 860px, step 40px, default 720px
fontFamily: sans | serif
background: paper | white | dark
```

### React 覆盖示例

```tsx
<article
  className={styles.reader}
  style={{
    "--reader-font-size": `${settings.fontSize}px`,
    "--reader-line-height": settings.lineHeight,
    "--reader-paragraph-gap": `${settings.paragraphGap}em`,
    "--reader-width": `${settings.readerWidth}px`,
  } as React.CSSProperties}
/>
```

### Reader CSS 示例

```css
.reader {
  max-width: var(--reader-width);
  margin-inline: auto;
  font-family: var(--reader-font-family);
  font-size: var(--reader-font-size);
  line-height: var(--reader-line-height);
  color: var(--reader-foreground);
  background: var(--reader-background);
  letter-spacing: 0;
}

.reader p {
  margin-block: 0 var(--reader-paragraph-gap);
}
```

## Component Tokens

### Button

```css
:root {
  --button-height-sm: 28px;
  --button-height-md: 36px;
  --button-height-lg: 44px;
  --button-padding-x-sm: 8px;
  --button-padding-x-md: 12px;
  --button-padding-x-lg: 16px;
  --button-radius: var(--radius-sm);
}
```

使用规则：

- 工具栏优先使用图标按钮。
- 不熟悉图标必须提供 tooltip。
- 文字按钮只用于明确命令，例如“导入 OPML”“测试连接”。

### Input

```css
:root {
  --input-height-md: 36px;
  --input-padding-x: 10px;
  --input-radius: var(--radius-sm);
  --input-border: var(--border-default);
  --input-background: var(--color-surface);
}
```

### Article List

```css
:root {
  --article-item-padding-y: 14px;
  --article-item-padding-x: 0;
  --article-item-title-size: 16px;
  --article-item-summary-size: 14px;
  --article-item-meta-size: 13px;
  --article-item-gap: 6px;
}
```

状态：

```text
unread: 标题使用 --color-ink，font-weight 600
read: 标题使用 --color-muted，font-weight 400
hidden: 默认不显示
not_interested: 默认不显示
```

### Popover

```css
:root {
  --popover-width: 280px;
  --popover-padding: 12px;
  --popover-radius: var(--radius-lg);
  --popover-shadow: var(--shadow-popover);
  --popover-background: var(--color-surface-raised);
}
```

### Bottom Sheet

```css
:root {
  --sheet-radius: var(--radius-lg);
  --sheet-padding: 16px;
  --sheet-shadow: var(--shadow-sheet);
  --sheet-background: var(--color-surface-raised);
}
```

## 主题属性

推荐使用 `data-theme` 和 `data-reader-theme`：

```html
<html data-theme="default">
<article data-reader-theme="paper">
```

可选值：

```text
data-theme: default | dark
data-reader-theme: paper | white | dark
```

MVP 中至少实现：

- default app theme
- paper reader theme
- white reader theme

dark 可先完成 token，不一定做完整 UI 验收。

## 实现验收标准

设计 tokens 初版实现后，应满足：

- 全局颜色、字体、间距、圆角都来自 CSS Variables。
- 阅读设置能实时改变字号、行高、段距和阅读宽度。
- 文章列表在 desktop / mobile 下不发生文字重叠。
- 图标按钮有 `aria-label`。
- Popover 和 Bottom Sheet 使用统一 token。
- 默认主题不呈现单一米色调，功能色有清晰区分。
- 不出现大面积渐变、装饰性光斑或营销式 hero。
