# 第一阶段「地基」设计

日期：2026-10-29　状态：已确认，待实施

## 1. 背景与目标

FitPlan 是一款面向在美中国留学生的增肌 / 减脂饮食 App，核心闭环是「给灵感 → 用户挑选 → 告诉他缺什么 → 用户调整」。完整需求见团队需求文档 v2.1（不在本仓库）。

整个 MVP 拆成 6 个阶段，每个阶段单独设计、计划、实施：

1. **地基（本文档）**
2. 食物库：数据导入、搜索、饮食记录
3. 搭盘子与缺口反馈
4. 灵感库与内容生产流程
5. 打卡、体重与趋势
6. 自适应目标与每周 check-in

本阶段结束时应达到：用户能用邀请码注册登录，完成选目标和身体评估问卷，看到身体报告（BMI、BMR、TDEE、每日热量与三大营养素目标），数据保存在服务器上，重新登录后不丢失。

### 范围外

食物库、记录饮食、盘子、灵感库、打卡、体重、趋势、自适应目标、第三方登录、推送通知、上架应用商店。

## 2. 技术选型

| 部分 | 选择 | 理由 |
|---|---|---|
| 仓库 | pnpm workspaces + Turborepo | 参考 create-t3-turbo；App、后端、共享包放在一个仓库 |
| App | React Native + Expo + Expo Router | 团队已定 |
| 后端 | Cloudflare Workers + Hono | 团队已定；Hono 可跨平台运行，降低平台绑定 |
| 数据库 | Cloudflare D1 + Drizzle ORM | Drizzle 管理表结构与迁移 |
| 登录 | Better Auth（邮箱 + 密码）+ `@better-auth/expo` | 开源、可自托管；参考 create-t3-turbo 与 better-hono |
| 接口调用 | Hono RPC 客户端 | 前后端类型共享，不额外引入 tRPC |
| 校验 | Zod | 前后端共用同一份输入规则 |
| 测试 | Vitest；后端用 `@cloudflare/vitest-pool-workers` | |
| 代码协议 | MIT | 食物数据的协议在第二阶段单独处理 |

所有依赖在实施时安装当时的稳定版本，并以官方文档为准。

## 3. 仓库结构

```
fitplan/
├─ apps/
│  ├─ mobile/          Expo App
│  └─ api/             Hono + Workers + D1
├─ packages/
│  └─ core/            纯 TypeScript 计算核心，零运行时依赖
├─ docs/
├─ .github/workflows/ci.yml
├─ LICENSE  README.md  CONTRIBUTING.md  .env.example
└─ pnpm-workspace.yaml  turbo.json  package.json
```

## 4. `packages/core`：计算核心

App 和后端共用。App 用它在问卷里即时预览结果；后端用它算出最终保存的权威结果。两端结果必须一致。

### 4.1 输入

```ts
type Sex = 'male' | 'female' | 'unspecified';
type Goal = 'lose' | 'gain';
type Pace = 'conservative' | 'standard' | 'aggressive';
type ActivityLevel = 1 | 2 | 3 | 4 | 5;

interface TargetInput {
  age: number;              // 周岁
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  pace: Pace;
  healthFlags: { pregnantOrNursing: boolean; eatingDisorderHistory: boolean; medicalDiet: boolean };
}
```

单位一律以公制存储与计算。英制换算函数：`lbToKg`、`kgToLb`、`ftInToCm`、`cmToFtIn`。

### 4.2 公式

| 项目 | 规则 |
|---|---|
| BMI | `weightKg / (heightCm/100)²` |
| BMR | Mifflin-St Jeor：`10×kg + 6.25×cm − 5×age + s`，男 `s=+5`，女 `s=−161`，不愿透露取两者平均 `s=−78` |
| TDEE | `BMR × 活动系数`，1–5 档依次为 1.2 / 1.375 / 1.55 / 1.725 / 1.9 |
| 减脂 | 每周减重 = 体重 × 0.5% / 0.75% / 1.0%；每日赤字 = 每周减重 × 7700 ÷ 7，且不超过 TDEE 的 25% |
| 增肌 | 目标热量 = TDEE × 1.05 / 1.10 / 1.15 |
| 热量下限 | `max(BMR, 男 1500 / 女 1200 / 不愿透露 1350)`；低于下限时抬到下限并记录原因 |
| 蛋白质 | 减脂 2.0 g/kg，增肌 1.8 g/kg |
| 脂肪 | `max(0.8 g/kg, 目标热量 × 20% ÷ 9)` |
| 碳水 | `(目标热量 − 蛋白质×4 − 脂肪×9) ÷ 4`，不低于 0 |
| 取整 | 热量取整数 kcal，营养素取整数克；中间计算不取整 |

### 4.3 三级安全限制

参考 CalorieTracker 的做法，结果分为三级：

- **blocked（禁止）**：年龄 < 18；目标为减脂且 BMI < 18.5。不生成目标。
- **confirm（需用户确认）**：选择「积极」速度；BMI ≥ 35（提示咨询医生）；目标热量被抬到下限。
- **safe（安全）**：其余情况。

健康筛查任一项为「是」时进入**安全模式**：减脂速度强制为「保守」，并要求用户确认（附带提示咨询专业人士）。

### 4.4 输出

```ts
interface TargetResult {
  status: 'safe' | 'confirm' | 'blocked';
  reasons: GuardrailReason[];          // 机器可读的原因代码，App 负责翻译成中英文
  bmi: number;                         // 保留 1 位小数
  bmrKcal: number;
  tdeeKcal: number;
  targets: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;  // blocked 时为 null
  effectivePace: Pace;                 // 安全模式下可能与输入不同
}
```

### 4.5 测试

至少 20 组用例，覆盖：两种目标 × 三档速度、三种性别、热量下限触发、25% 赤字上限触发、年龄与 BMI 边界、安全模式、三大营养素热量之和与目标热量误差 ≤ 1%（来自需求文档验收标准）。

## 5. `apps/api`：后端

### 5.1 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查 |
| ALL | `/api/auth/*` | Better Auth：注册、登录、退出、会话 |
| GET | `/api/me/profile` | 读取当前身体资料与最新目标 |
| PUT | `/api/me/profile` | 保存问卷结果；服务器用 core 重算，追加一条目标历史 |
| POST | `/api/me/consents` | 记录健康数据使用同意 |

除 `/health` 和登录接口外，都要求已登录。

### 5.2 邀请码

注册时必须提供有效且未用完的邀请码。在 Better Auth 的注册前钩子里校验，注册成功后使用次数加一。邀请码由管理员用命令行脚本生成，本阶段不做管理界面。

### 5.3 数据表

除 Better Auth 自带的表（user、session、account、verification）外：

| 表 | 字段要点 |
|---|---|
| `invite_codes` | code（主键）、max_uses、used_count、created_at |
| `profiles` | user_id（主键）、birth_year、sex、height_cm、weight_kg、activity_level、training_days_per_week、training_experience、goal、pace、health_flags（JSON）、unit_system、locale、updated_at |
| `goal_versions` | id、user_id、effective_at、输入快照（JSON）、status、reasons（JSON）、bmi、bmr_kcal、tdee_kcal、kcal、protein_g、carbs_g、fat_g；**只追加，不修改** |
| `consents` | id、user_id、kind（如 `health_data`）、version、granted、created_at |

约定（参考 CalorieTracker）：时间用 ISO-8601 UTC 文本；营养数值未知存 NULL，不存 0；枚举用 CHECK 约束，并与 Zod 规则保持一致。

### 5.4 错误处理

- 输入不合法：400，返回字段级错误代码。
- 尚未同意健康数据使用：403 `consent_required`，不保存资料。
- 安全限制为 blocked：422，返回原因代码；资料照常保存，但不生成目标版本。
- 安全限制为 confirm 且请求未带 `confirmed: true`：409，返回原因代码，不生成目标版本；App 让用户确认后重新提交。
- 未登录：401。
- 其余错误：500，记录日志，不向客户端暴露内部细节。

## 6. `apps/mobile`：App

### 6.1 页面

- **登录 / 注册**：邮箱、密码；注册额外需要邀请码。
- **问卷（分步）**：① 目标与速度 → ② 基础信息（年龄、性别、身高、体重，单位可切换）→ ③ 生活与训练（活动量、每周训练次数、训练经验）→ ④ 健康筛查 + 健康数据使用同意。
- **身体报告**：BMI、BMR、TDEE、每日目标，以及「均为估算，不构成医疗建议」的说明；confirm 状态需用户点确认。
- **今日（占位）**：显示每日目标，其余功能留给后续阶段。

问卷每一步用 core 在本地即时算出预览；提交时由服务器重算并保存，App 以服务器结果为准。

### 6.2 其他

- 视觉沿用 UI 草图的配色与字号，以设计常量（tokens）形式集中定义。
- 中英双语：用一份简单的翻译字典，按系统语言自动选择，可在设置里切换。
- 登录凭证存放在 `expo-secure-store`。

## 7. 开源配套

- `LICENSE`（MIT）、`README`（项目介绍 + 本地运行步骤）、`CONTRIBUTING`、`.env.example`。
- 密钥只放在本地 `.dev.vars` 或 Cloudflare secrets，不进仓库。
- 贡献者无需 Cloudflare 账号即可本地运行：`wrangler dev` 本地模拟 Workers 与 D1。
- CI（GitHub Actions）：安装依赖、类型检查、运行测试。

## 8. 风险与先行验证

| 风险 | 处理 |
|---|---|
| Better Auth + D1 + Workers 组合没有找到现成范例 | **实施第一步先做验证**：在 Workers 本地环境跑通注册、登录、读会话。跑不通则改用 Better Auth 的 Kysely D1 方案或其他方案，并更新本文档 |
| Expo App 与 Better Auth 的会话传递 | 按 `@better-auth/expo` 官方用法；在模拟器上实测登录、退出、重启后保持登录 |
| 计算参数未经专业人士复核 | 参数集中定义在 core 的常量里，复核后只需改一处 |
