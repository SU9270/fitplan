# 界面改版：参考 BoardUI

日期：2026-11-02　状态：已实施

## 来源

[BoardUI](https://www.boardui.com/)（React 仪表盘设计系统）。数值是在它的网站上实测的（计算后的 CSS 样式与 CSS 变量），色板就是它使用的 Tailwind v4 色板。主色选 BoardUI 的蓝色（与产品负责人确认过，对比过保留绿色的效果图）。

## 规则

| 项目 | 规则 | 来源 |
|---|---|---|
| 页面 | 白色背景 | `--color-background-primary-default` |
| 卡片外壳 | `#F7F7F7`，圆角 20，内边距 10，块之间间距 6 | 实测 medical-profile 模板的 section |
| 卡片内的块 | 白色，圆角 10，内边距 8 × 10 | 实测 Date of Birth 行、Move 数据格 |
| 卡片标题 | 灰色 14 号字重 500；下方大数字字重 500，单位 13 号灰色 | 实测 Steps / 31,600 / total steps |
| 主色 | `#2B7FFF`（按下 `#155DFC`，浅底 `#DBEAFE`） | `accent-500 / 600 / 100` |
| 文字 | `#0A0A0A` / `#737373` / `#A1A1A1` | `neutral-950 / 500 / 400` |
| 分隔线、输入框边框 | `#EBEBEB` | `neutral-200` |
| 营养素颜色 | 热量 `#00D5BE`、蛋白质 `#00BCFF`、碳水 `#FDC700`、脂肪 `#FB64B6`，圆环底轨用约 20% 的浅色 | `chart-1`（teal）、sky、yellow、pink |
| 按钮、输入框 | 圆角 10 | 实测 |

所有数值集中在 `apps/mobile/src/theme/tokens.ts`；组件只用 tokens，不写死颜色和尺寸。

## 组件

- `Card` / `CardHeader` / `Tile`：外壳、标题（灰色标签 + 大数字 + 单位）、白色块
- `ActivityRings`：同心圆环（`react-native-svg`），今日页用来表示热量与三大营养素进度
- `MacroTiles`：彩色小方块 + 名称 + 克数，可以显示「已吃 / 目标」
- `InfoRow`：白色行，左边标签右边数值（个人主页、食物详情）
- `SoftButton`：浅蓝底蓝字（「+ 添加」）

## 未采用

- Inter 字体：中文仍要用系统字体（苹方），英文用系统字体（San Francisco）效果接近，不额外打包字体
- 深色模式：BoardUI 支持，App 目前 `userInterfaceStyle: light`，以后再做
