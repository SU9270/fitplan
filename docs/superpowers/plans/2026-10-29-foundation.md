# 第一阶段「地基」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户能用邀请码注册登录，完成选目标与身体评估问卷，看到身体报告与每日目标，数据保存在服务器上。

**Architecture:** pnpm + Turborepo 多包仓库。`packages/core` 是零依赖的纯 TypeScript 计算核心，App 与后端共用；`packages/validators` 放 Zod 输入规则；`apps/api` 是 Cloudflare Workers 上的 Hono 服务（D1 + Drizzle + Better Auth）；`apps/mobile` 是 Expo Router App，通过 Hono RPC 客户端调用接口。

**Tech Stack:** TypeScript、pnpm、Turborepo、Vitest、Hono、Cloudflare Workers / D1 / Wrangler、Drizzle ORM、Better Auth + `@better-auth/expo`、Zod、Expo + Expo Router、expo-secure-store、jest-expo。

**Spec:** `docs/superpowers/specs/2026-10-29-foundation-design.md`

## Global Constraints

- 所有依赖安装当时的稳定版本；遇到 API 不确定时以官方文档为准，并在提交说明里注明版本。
- 包名前缀 `@fitplan/`：`@fitplan/core`、`@fitplan/validators`、`@fitplan/api`、`@fitplan/mobile`。
- `packages/core` 零运行时依赖。
- 单位一律以公制存储与计算（kg、cm、kcal、g）。
- 计算参数只在 `packages/core/src/constants.ts` 定义一次，其他地方不得出现魔法数字。
- 热量取整数 kcal、营养素取整数克，只在最终输出时取整，中间计算不取整；BMI 保留 1 位小数。
- 时间用 ISO-8601 UTC 文本；营养数值未知存 NULL；枚举用 CHECK 约束并与 Zod 规则一致。
- 安全限制原因代码固定为：`under_age`、`bmi_too_low_for_loss`、`aggressive_pace`、`high_bmi_consult`、`raised_to_floor`、`safe_mode`。
- 用户可见文字一律走 i18n 字典（中、英），不写死在组件里。
- 密钥只放 `.dev.vars` / Cloudflare secrets，不进仓库。
- 提交信息以 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 结尾。

## Review Focus

1. **不合理的数字输入**（身高 1700、体重 0、负数、空值）：应返回字段级 400 错误，绝不能算出 NaN 或负的目标。→ Task 4 测试 `rejects implausible numbers`，Task 6 测试 `PUT /api/me/profile rejects implausible numbers`。
2. **未满 18 岁**：App 与服务器都应拒绝生成目标，而不是因为数据校验报错。→ Task 3 测试 `blocks under 18`；Task 6 测试 `returns 422 for a 17-year-old`（年龄校验范围是 13–100，17 岁能通过校验，进到安全限制被拦）。
3. **邀请码最后一次使用的并发**：`max_uses = 1` 的码被两个人同时注册，只能成功一个。→ Task 5 测试 `invite with one use admits only one sign-up`（用条件更新 `WHERE used_count < max_uses` 并检查影响行数）。
4. **重复提交相同的问卷**：不应产生重复的目标版本。→ Task 6 测试 `identical resubmission does not append a goal version`。
5. **英尺英寸换算的进位**：182.88 cm 应显示为 6′0″，而不是 5′12″；切换单位来回不应漂移。→ Task 1 测试 `cmToFtIn rolls 12 inches into a foot`、`round-trips imperial input`。

---

### Task 1: 仓库骨架与单位换算

**Files:**
- Create: `package.json`、`pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`、`.gitignore`、`.nvmrc`、`LICENSE`（MIT，版权方 `FitPlan contributors`）
- Create: `packages/core/package.json`、`packages/core/tsconfig.json`、`packages/core/vitest.config.ts`
- Create: `packages/core/src/units.ts`、`packages/core/src/index.ts`
- Create: `.github/workflows/ci.yml`
- Test: `packages/core/src/units.test.ts`

**Interfaces:**
- Produces: `lbToKg(lb: number): number`、`kgToLb(kg: number): number`、`ftInToCm(ft: number, inch: number): number`、`cmToFtIn(cm: number): { ft: number; in: number }`（英寸四舍五入到整数，满 12 进位）
- Produces: 根目录脚本 `pnpm test`、`pnpm typecheck`（经 Turborepo 跑所有包）

- [ ] **Step 1: 建立仓库骨架**：pnpm workspace 包含 `apps/*`、`packages/*`；Turborepo 定义 `test`、`typecheck`、`build` 任务；TypeScript `strict: true`。

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from './units';

describe('units', () => {
  it('converts pounds and kilograms', () => {
    expect(lbToKg(150)).toBeCloseTo(68.039, 3);
    expect(kgToLb(70)).toBeCloseTo(154.324, 3);
  });
  it('converts feet and inches to cm', () => {
    expect(ftInToCm(5, 7)).toBeCloseTo(170.18, 2);
  });
  it('cmToFtIn rolls 12 inches into a foot', () => {
    expect(cmToFtIn(182.88)).toEqual({ ft: 6, in: 0 });
    expect(cmToFtIn(182.5)).toEqual({ ft: 6, in: 0 });
  });
  it('round-trips imperial input', () => {
    expect(cmToFtIn(ftInToCm(5, 11))).toEqual({ ft: 5, in: 11 });
    expect(Math.round(kgToLb(lbToKg(163)))).toBe(163);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @fitplan/core test`
Expected: FAIL，提示找不到 `./units`

- [ ] **Step 4: 实现 `units.ts`**（1 lb = 0.45359237 kg，1 in = 2.54 cm），并从 `index.ts` 导出。

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test`
Expected: 4 个测试全部 PASS

- [ ] **Step 6: 加 CI**：`ci.yml` 在 push 与 pull_request 时执行 `pnpm install --frozen-lockfile`、`pnpm typecheck`、`pnpm test`。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo and add unit conversions"
```

---

### Task 2: 能量与营养素计算

**Files:**
- Create: `packages/core/src/types.ts`、`packages/core/src/constants.ts`、`packages/core/src/energy.ts`、`packages/core/src/macros.ts`
- Test: `packages/core/src/energy.test.ts`、`packages/core/src/macros.test.ts`

**Interfaces:**
- Consumes: 无
- Produces（`types.ts`）：`Sex = 'male' | 'female' | 'unspecified'`、`Goal = 'lose' | 'gain'`、`Pace = 'conservative' | 'standard' | 'aggressive'`、`ActivityLevel = 1 | 2 | 3 | 4 | 5`、`MacroTargets = { kcal: number; proteinG: number; carbsG: number; fatG: number }`
- Produces（`constants.ts`）：`ACTIVITY_FACTORS`、`SEX_CONSTANT`、`LOSS_WEEKLY_PCT`、`GAIN_SURPLUS`、`KCAL_PER_KG = 7700`、`MAX_DEFICIT_RATIO = 0.25`、`KCAL_FLOOR`、`PROTEIN_G_PER_KG`、`FAT_MIN_G_PER_KG = 0.8`、`FAT_MIN_KCAL_RATIO = 0.2`、`MIN_AGE = 18`、`MIN_BMI_FOR_LOSS = 18.5`、`CONSULT_BMI = 35`
- Produces（`energy.ts`，返回值均不取整）：
  - `bmi(weightKg: number, heightCm: number): number`
  - `bmrKcal(sex: Sex, age: number, heightCm: number, weightKg: number): number`
  - `tdeeKcal(bmr: number, level: ActivityLevel): number`
  - `calorieTarget(args: { goal: Goal; pace: Pace; tdee: number; bmr: number; weightKg: number; sex: Sex }): { kcal: number; raisedToFloor: boolean }`
- Produces（`macros.ts`）：`macroTargets(kcal: number, weightKg: number, goal: Goal): MacroTargets`（在此取整）

常量取值（来自设计文档 4.2）：活动系数 1.2 / 1.375 / 1.55 / 1.725 / 1.9；性别常数 男 +5、女 −161、不愿透露 −78；减脂每周减重比例 0.005 / 0.0075 / 0.01；增肌盈余 1.05 / 1.10 / 1.15；热量下限 男 1500、女 1200、不愿透露 1350（实际下限取 `max(BMR, 该值)`）；蛋白质 减脂 2.0、增肌 1.8 g/kg。

- [ ] **Step 1: Write the failing tests**

`energy.test.ts` 与 `macros.test.ts` 用表驱动，以下期望值已用独立脚本核算：

```ts
const cases = [
  // [sex, age, heightCm, weightKg, level, goal, pace] → { bmi, bmr, tdee, kcal, raised, proteinG, carbsG, fatG }
  [['male', 20, 175, 70, 3, 'lose', 'standard'],       { bmi: 22.9, bmr: 1699, tdee: 2633, kcal: 2056, raised: false, proteinG: 140, carbsG: 248, fatG: 56 }],
  [['female', 22, 160, 55, 2, 'gain', 'standard'],     { bmi: 21.5, bmr: 1279, tdee: 1759, kcal: 1934, raised: false, proteinG: 99,  carbsG: 286, fatG: 44 }],
  [['male', 30, 180, 120, 1, 'lose', 'aggressive'],    { bmi: 37.0, bmr: 2180, tdee: 2616, kcal: 2180, raised: true,  proteinG: 240, carbsG: 89,  fatG: 96 }],
  [['female', 25, 150, 45, 1, 'lose', 'aggressive'],   { bmi: 20.0, bmr: 1102, tdee: 1322, kcal: 1200, raised: true,  proteinG: 90,  carbsG: 129, fatG: 36 }],
  [['unspecified', 28, 170, 65, 2, 'lose', 'conservative'], { bmi: 22.5, bmr: 1495, tdee: 2055, kcal: 1697, raised: false, proteinG: 130, carbsG: 177, fatG: 52 }],
  [['male', 19, 170, 53, 3, 'gain', 'standard'],       { bmi: 18.3, bmr: 1503, tdee: 2329, kcal: 2562, raised: false, proteinG: 95,  carbsG: 417, fatG: 57 }],
  [['female', 21, 168, 60, 4, 'lose', 'standard'],     { bmi: 21.3, bmr: 1384, tdee: 2387, kcal: 1892, raised: false, proteinG: 120, carbsG: 245, fatG: 48 }],
] as const;
```

每组断言：`Math.round(bmi*10)/10`、`Math.round(bmr)`、`Math.round(tdee)`、`Math.round(kcal)`、`raisedToFloor`、`macroTargets(kcalUnrounded, ...)` 的三个克数。

另加两个测试：
- `caps deficit at 25% of TDEE`：男 30 岁 180 cm 120 kg、活动 3 级、积极减脂。未封顶的赤字是 1320；TDEE 3379，封顶 844.75，所以 `Math.round(kcal) === 2534` 且 `raisedToFloor === false`。
- `macros sum within 1% of kcal`：遍历 3 种性别 × 2 种目标 × 3 档速度 × 5 档活动（90 组，固定 25 岁、170 cm、65 kg），断言 `|P×4 + C×4 + F×9 − kcal| / kcal ≤ 0.01`，且 `kcal ≥ max(BMR, 下限)`，且所有值为有限非负数。

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @fitplan/core test`
Expected: FAIL，模块不存在

- [ ] **Step 3: 实现 `types.ts`、`constants.ts`、`energy.ts`、`macros.ts`**，严格按设计文档 4.2 的公式；碳水 `max(0, …)`。

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @fitplan/core test`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): energy and macro target calculations"
```

---

### Task 3: 安全限制与 `computeTargets`

**Files:**
- Create: `packages/core/src/guardrails.ts`、`packages/core/src/targets.ts`
- Modify: `packages/core/src/types.ts`、`packages/core/src/index.ts`
- Test: `packages/core/src/targets.test.ts`

**Interfaces:**
- Consumes: Task 2 的全部函数与常量
- Produces（`types.ts` 新增）：
  - `HealthFlags = { pregnantOrNursing: boolean; eatingDisorderHistory: boolean; medicalDiet: boolean }`
  - `TargetInput = { age: number; sex: Sex; heightCm: number; weightKg: number; activityLevel: ActivityLevel; goal: Goal; pace: Pace; healthFlags: HealthFlags }`
  - `GuardrailReason = 'under_age' | 'bmi_too_low_for_loss' | 'aggressive_pace' | 'high_bmi_consult' | 'raised_to_floor' | 'safe_mode'`
  - `TargetStatus = 'safe' | 'confirm' | 'blocked'`
  - `TargetResult = { status: TargetStatus; reasons: GuardrailReason[]; bmi: number; bmrKcal: number; tdeeKcal: number; targets: MacroTargets | null; effectivePace: Pace }`
- Produces: `computeTargets(input: TargetInput): TargetResult`

规则（设计文档 4.3）：
1. 任一健康标记为真 → `safe_mode`，减脂时 `effectivePace` 强制为 `conservative`（增肌保持原速度），状态至少为 `confirm`。
2. `age < 18` → `blocked` + `under_age`；减脂且 BMI < 18.5 → `blocked` + `bmi_too_low_for_loss`。blocked 时 `targets = null`，但 `bmi`、`bmrKcal`、`tdeeKcal` 照常返回。
3. `effectivePace === 'aggressive'` → `aggressive_pace`；BMI ≥ 35 → `high_bmi_consult`；被抬到下限 → `raised_to_floor`。任一出现即 `confirm`。
4. `reasons` 按上述出现顺序排列、不重复。

- [ ] **Step 1: Write the failing tests**

```ts
const base = { age: 20, sex: 'male', heightCm: 175, weightKg: 70, activityLevel: 3, goal: 'lose', pace: 'standard',
  healthFlags: { pregnantOrNursing: false, eatingDisorderHistory: false, medicalDiet: false } } as const;

it('safe case returns targets', () => {
  expect(computeTargets(base)).toMatchObject({ status: 'safe', reasons: [], bmi: 22.9, bmrKcal: 1699, tdeeKcal: 2633,
    targets: { kcal: 2056, proteinG: 140, carbsG: 248, fatG: 56 }, effectivePace: 'standard' });
});
it('blocks under 18', () => {
  const r = computeTargets({ ...base, age: 17 });
  expect(r.status).toBe('blocked'); expect(r.reasons).toEqual(['under_age']); expect(r.targets).toBeNull();
});
it('blocks loss below BMI 18.5 but allows gain', () => {
  expect(computeTargets({ ...base, heightCm: 170, weightKg: 53 }).reasons).toEqual(['bmi_too_low_for_loss']);
  expect(computeTargets({ ...base, heightCm: 170, weightKg: 53, goal: 'gain' }).status).toBe('safe');
});
it('confirms aggressive pace, high BMI and floor', () => {
  const r = computeTargets({ ...base, age: 30, heightCm: 180, weightKg: 120, activityLevel: 1, pace: 'aggressive' });
  expect(r.status).toBe('confirm');
  expect(r.reasons).toEqual(['aggressive_pace', 'high_bmi_consult', 'raised_to_floor']);
  expect(r.targets?.kcal).toBe(2180);
});
it('safe mode forces conservative loss', () => {
  const r = computeTargets({ ...base, pace: 'aggressive', healthFlags: { ...base.healthFlags, medicalDiet: true } });
  expect(r).toMatchObject({ status: 'confirm', reasons: ['safe_mode'], effectivePace: 'conservative' });
});
it('safe mode keeps gain pace', () => {
  const r = computeTargets({ ...base, goal: 'gain', healthFlags: { ...base.healthFlags, pregnantOrNursing: true } });
  expect(r).toMatchObject({ status: 'confirm', reasons: ['safe_mode'], effectivePace: 'standard' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @fitplan/core test`
Expected: FAIL，`computeTargets` 未定义

- [ ] **Step 3: 实现 `guardrails.ts`（规则判断）与 `targets.ts`（组装结果）**，`index.ts` 导出 `computeTargets` 与所有类型。

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @fitplan/core test`
Expected: 全部 PASS（含 Task 1、2 的测试）

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): guardrails and computeTargets"
```

---

### Task 4: 输入校验规则

**Files:**
- Create: `packages/validators/package.json`、`packages/validators/tsconfig.json`、`packages/validators/src/index.ts`
- Test: `packages/validators/src/index.test.ts`

**Interfaces:**
- Consumes: `@fitplan/core` 的枚举类型
- Produces:
  - `profileInputSchema`（Zod）：`age` 整数 13–100；`sex`；`heightCm` 120–230；`weightKg` 30–300；`activityLevel` 1–5；`trainingDaysPerWeek` 整数 0–7；`trainingExperience` `'beginner' | 'intermediate' | 'advanced'`；`goal`；`pace`；`healthFlags`；`unitSystem` `'metric' | 'imperial'`；`locale` `'zh' | 'en'`；`confirmed` 布尔，默认 `false`
  - `ProfileInput = z.infer<typeof profileInputSchema>`
  - `consentInputSchema`：`kind` 仅 `'health_data'`；`version` 非空字符串；`granted` 布尔
  - `toTargetInput(p: ProfileInput): TargetInput`
  - `CONSENT_VERSION = '2026-10-29'`

- [ ] **Step 1: Write the failing tests**：`accepts a valid profile`；`rejects implausible numbers`（`heightCm: 1700`、`weightKg: 0`、`age: -1`、`weightKg: NaN` 各自失败，且错误路径指向对应字段）；`accepts age 17 so guardrails can block it`；`toTargetInput maps fields one to one`。

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @fitplan/validators test`
Expected: FAIL

- [ ] **Step 3: 实现 `src/index.ts`**。

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @fitplan/validators test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/validators pnpm-lock.yaml
git commit -m "feat(validators): profile and consent input schemas"
```

---

### Task 5: 后端骨架、登录与邀请码（含先行验证）

**Files:**
- Create: `apps/api/package.json`、`apps/api/wrangler.jsonc`（D1 绑定名 `DB`，数据库名 `fitplan`）、`apps/api/tsconfig.json`、`apps/api/vitest.config.ts`、`apps/api/drizzle.config.ts`、`apps/api/.dev.vars.example`
- Create: `apps/api/src/index.ts`（Hono 应用，导出 `AppType`）、`apps/api/src/env.ts`、`apps/api/src/db/schema.ts`、`apps/api/src/db/client.ts`、`apps/api/src/auth.ts`、`apps/api/src/invites.ts`、`apps/api/src/middleware/require-session.ts`
- Create: `apps/api/migrations/`（由 drizzle-kit 生成）、`apps/api/scripts/create-invite.ts`
- Test: `apps/api/test/auth.test.ts`、`apps/api/test/invites.test.ts`

**Interfaces:**
- Produces: `createAuth(env: Env)`：每个请求创建一次，Drizzle 适配器 `provider: 'sqlite'` 接 D1；开启邮箱密码登录与 `expo()` 插件；`trustedOrigins` 包含 `fitplan://` 与 `exp://`
- Produces: `requireSession` 中间件，在 Hono 上下文里设置 `c.var.user`
- Produces: `reserveInvite(db, code: string): Promise<boolean>`：执行 `UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ? AND used_count < max_uses`，影响行数为 1 时返回 `true`
- Produces: `invite_codes` 表（`code` 主键、`max_uses`、`used_count` 默认 0、`created_at`）与 Better Auth 的四张表
- Produces: 命令 `pnpm --filter @fitplan/api invite:create -- --uses 5 [--remote]`，打印生成的邀请码

- [ ] **Step 1: 先行验证**：按设计文档第 8 节，先只搭 Hono + Better Auth + D1，在本地 `wrangler dev` 下用 curl 跑通「注册 → 登录 → 读会话」。成功后继续；失败则改用 Better Auth 的 Kysely D1 方案，并在设计文档第 2、8 节记录改动和原因。

- [ ] **Step 2: Write the failing tests**（`@cloudflare/vitest-pool-workers`，测试前用 `applyD1Migrations` 建表）：
  - `GET /health returns ok`：200，`{ ok: true }`
  - `sign-up without invite is rejected`：403，错误代码 `invite_required`
  - `sign-up with a valid invite succeeds and session is readable`：注册成功后，用返回的会话 Cookie 调 `GET /api/auth/get-session` 得到同一邮箱
  - `invite with one use admits only one sign-up`：`max_uses = 1` 的码，用 `Promise.all` 并发两次注册，恰好一次成功、一次 403 `invite_exhausted`
  - `protected route returns 401 without session`：对一个挂了 `requireSession` 的测试路由

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @fitplan/api test`
Expected: FAIL

- [ ] **Step 4: 实现**：Better Auth 的注册前钩子（`hooks.before`，匹配路径 `/sign-up/email`）从请求体读取 `inviteCode` 并调用 `reserveInvite`；没有码返回 `invite_required`，码无效或用完返回 `invite_exhausted`。注册在预留邀请码之后失败时，这次使用不退回（在 `invites.ts` 注释说明）。

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @fitplan/api test`
Expected: 5 个测试 PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): hono worker with better-auth on d1 and invite codes"
```

---

### Task 6: 身体资料、目标历史与同意记录接口

**Files:**
- Modify: `apps/api/src/db/schema.ts`（新增 `profiles`、`goal_versions`、`consents`，见设计文档 5.3）
- Create: `apps/api/src/routes/me.ts`、`apps/api/src/profile-service.ts`
- Modify: `apps/api/src/index.ts`（挂载 `/api/me`）
- Create: 新的迁移文件
- Test: `apps/api/test/me.test.ts`

**Interfaces:**
- Consumes: `computeTargets`（Task 3）、`profileInputSchema`、`consentInputSchema`、`toTargetInput`、`CONSENT_VERSION`（Task 4）、`requireSession`（Task 5）
- Produces（接口，均需登录）：
  - `POST /api/me/consents` → 201 `{ id }`
  - `PUT /api/me/profile`，请求体为 `ProfileInput`，响应体 `{ profile: ProfileView; result: TargetResult; goalVersionId: string | null }`
  - `GET /api/me/profile` → `{ profile: ProfileView | null; latestGoal: GoalVersionView | null }`
  - `ProfileView` = `ProfileInput` 去掉 `confirmed`，`age` 由 `birth_year` 推算（`当前 UTC 年份 − birth_year`）
  - `GoalVersionView = { id: string; effectiveAt: string; status: TargetStatus; reasons: GuardrailReason[]; bmi: number; bmrKcal: number; tdeeKcal: number; targets: MacroTargets }`

`PUT /api/me/profile` 的处理顺序：
1. 校验失败 → 400 `{ error: 'invalid_input', fields: { 字段: 代码 } }`
2. 没有已同意的 `health_data` 记录 → 403 `consent_required`
3. 保存资料（`birth_year = 当前 UTC 年份 − age`）
4. 计算 `computeTargets`：`blocked` → 422（不写目标版本，`goalVersionId: null`）；`confirm` 且 `confirmed !== true` → 409（不写目标版本）
5. 与最新一条目标版本的输入快照逐字段相同 → 200，返回已有的 `goalVersionId`，不追加
6. 否则追加一条 `goal_versions` → 200

- [ ] **Step 1: Write the failing tests**：
  - `PUT /api/me/profile requires consent`：403 `consent_required`
  - `PUT /api/me/profile rejects implausible numbers`：`heightCm: 1700` → 400，`fields.heightCm` 存在
  - `saves profile and appends a goal version`：用 Task 3 的 `base` 对应输入，200，`result.targets.kcal === 2056`，`goalVersionId` 非空
  - `returns 422 for a 17-year-old`：`result.reasons` 含 `under_age`，`goalVersionId === null`
  - `confirm status needs confirmed flag`：120 kg 积极减脂的输入，不带 `confirmed` 时 409，带 `confirmed: true` 时 200
  - `identical resubmission does not append a goal version`：同一输入提交两次，两次 `goalVersionId` 相同，表中只有 1 行
  - `GET /api/me/profile returns saved data`：`profile.age === 20`、`latestGoal.targets.kcal === 2056`
  - `users cannot see each other's profile`：两个用户各自保存，读取时互不可见

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @fitplan/api test`
Expected: FAIL

- [ ] **Step 3: 实现** `profile-service.ts`（资料保存、目标版本比对与追加）与 `routes/me.ts`（校验与状态码映射），生成迁移。

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @fitplan/api test`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): profile, goal versions and consent endpoints"
```

---

### Task 7: App 骨架、设计常量、双语与登录注册

**Files:**
- Create: `apps/mobile/`（Expo + Expo Router 模板，App 名 `FitPlan`，URL scheme `fitplan`）
- Create: `apps/mobile/src/theme/tokens.ts`、`apps/mobile/src/i18n/zh.ts`、`apps/mobile/src/i18n/en.ts`、`apps/mobile/src/i18n/index.ts`
- Create: `apps/mobile/src/lib/auth-client.ts`、`apps/mobile/src/lib/api.ts`、`apps/mobile/src/lib/base-url.ts`
- Create: `apps/mobile/src/app/_layout.tsx`、`apps/mobile/src/app/(auth)/sign-in.tsx`、`apps/mobile/src/app/(auth)/sign-up.tsx`
- Create: `apps/mobile/.env.example`（`EXPO_PUBLIC_API_URL=http://localhost:8787`）
- Test: `apps/mobile/src/i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `AppType`（`@fitplan/api`，仅类型）
- Produces:
  - `tokens`：颜色取自 UI 草图（底色 `#F4F6F2`、文字 `#17211C`、次要文字 `#5B6660`、主色 `#2D7A52`、主色浅底 `#E5F1EA`、蛋白质 `#3461C7`、碳水 `#E3A13A`、脂肪 `#D2667A`、蔬菜 `#3E9C63`）、圆角、间距、字号
  - `t(key: MessageKey, params?: Record<string, string | number>): string`、`setLocale(l: 'zh' | 'en')`、`useLocale()`；默认按系统语言，非中文一律英文
  - `authClient`：Better Auth React 客户端 + `expoClient`，`scheme: 'fitplan'`，存储用 `expo-secure-store`
  - `api`：`hc<AppType>(baseUrl)`，自动带上会话 Cookie（`authClient.getCookie()`）
  - 根布局的路由守卫：未登录 → `(auth)/sign-in`；已登录但没有资料 → `(onboarding)/goal`；已有资料 → `today`

- [ ] **Step 1: Write the failing test**：`zh and en have the same keys`（两份字典的键集合完全相同）；`interpolates params`（`t('report.kcal', { n: 2056 })` 中英文均包含 `2056`）。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fitplan/mobile test`
Expected: FAIL

- [ ] **Step 3: 实现 i18n、tokens、客户端与两个登录页**：注册页包含邮箱、密码、邀请码；把 `invite_required`、`invite_exhausted` 和网络错误翻译成可读提示。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fitplan/mobile test && pnpm --filter @fitplan/mobile typecheck`
Expected: PASS，类型检查无错误

- [ ] **Step 5: 在 iOS 模拟器上手动验证**：先启动 `pnpm --filter @fitplan/api dev`，创建邀请码；在 App 里注册、退出、重新登录、杀掉 App 后重开仍保持登录。

- [ ] **Step 6: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): expo app shell, i18n and sign-in"
```

---

### Task 8: 问卷、身体报告与今日占位页

**Files:**
- Create: `apps/mobile/src/onboarding/draft.tsx`（问卷草稿的 React Context）、`apps/mobile/src/onboarding/to-profile-input.ts`
- Create: `apps/mobile/src/app/(onboarding)/_layout.tsx`、`goal.tsx`、`basics.tsx`、`lifestyle.tsx`、`health.tsx`
- Create: `apps/mobile/src/app/report.tsx`、`apps/mobile/src/app/today.tsx`
- Modify: `apps/mobile/src/i18n/zh.ts`、`apps/mobile/src/i18n/en.ts`
- Test: `apps/mobile/src/onboarding/to-profile-input.test.ts`

**Interfaces:**
- Consumes: `computeTargets`、`cmToFtIn`、`ftInToCm`、`lbToKg`、`kgToLb`（core）；`profileInputSchema`、`toTargetInput`、`CONSENT_VERSION`（validators）；`api`、`t`、`tokens`（Task 7）
- Produces:
  - `OnboardingDraft`：表单原始值，身高与体重保存用户输入的单位与数值（避免反复换算漂移），只在提交时转换成公制
  - `toProfileInput(draft: OnboardingDraft, locale: 'zh' | 'en'): ProfileInput`

页面行为：
- 每一步底部显示用 `computeTargets` 本地算出的预览（基础信息填完后才显示）。
- `health.tsx`：三个健康筛查问题 + 健康数据使用同意（必须勾选才能提交）；提交时先 `POST /api/me/consents`，再 `PUT /api/me/profile`。
- 409（需确认）：报告页列出原因的翻译文案，用户点「我已了解，继续」后带 `confirmed: true` 重新提交。
- 422（禁止）：显示原因文案，提供「返回修改」，不进入今日页。
- 401：跳转登录页，**问卷草稿保留在 Context 里**，登录后回到问卷继续。
- `report.tsx`：BMI、BMR、TDEE、每日热量与三大营养素，以及「所有数值都是估算，不构成医疗建议」。
- `today.tsx`：显示每日目标与「更多功能即将上线」，提供中 / 英语言切换（调用 `setLocale`）和退出登录。

- [ ] **Step 1: Write the failing test**：`converts imperial draft to metric`（5′7″、150 lb → `heightCm ≈ 170.18`、`weightKg ≈ 68.04`）；`passes metric draft unchanged`；`output satisfies profileInputSchema`。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fitplan/mobile test`
Expected: FAIL

- [ ] **Step 3: 实现草稿、换算函数与各页面**。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fitplan/mobile test && pnpm --filter @fitplan/mobile typecheck`
Expected: PASS

- [ ] **Step 5: 在 iOS 模拟器上手动验证**：① 70 kg / 175 cm / 20 岁男、中度活动、标准减脂，报告显示 2056 kcal、蛋白质 140 g；② 年龄填 17，看到禁止提示；③ 积极减脂 + 120 kg，看到确认步骤；④ 切换英制再切回，数值不变；⑤ 切换语言，所有文字随之改变。

- [ ] **Step 6: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): onboarding wizard, body report and today placeholder"
```

---

### Task 9: 开源文档与端到端验证

**Files:**
- Create: `README.md`（项目介绍、仓库结构、本地运行步骤、技术栈）、`CONTRIBUTING.md`（分支与提交约定、如何跑测试、如何生成邀请码）、根目录 `.env.example`
- Modify: `docs/superpowers/specs/2026-10-29-foundation-design.md`（如先行验证改动了方案，同步更新）

**Interfaces:**
- Consumes: 前面所有任务的命令

- [ ] **Step 1: 写 README 与 CONTRIBUTING**，本地运行步骤只写真实可执行的命令。

- [ ] **Step 2: 从零验证**：在一个全新的克隆目录里，严格按 README 操作：`pnpm install` → 本地应用 D1 迁移 → 生成邀请码 → 启动后端 → 启动 App → 注册并完成问卷。任何一步不通就修正 README 或代码。

- [ ] **Step 3: 全量检查**

Run: `pnpm typecheck && pnpm test`
Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: readme, contributing guide and env examples"
```
