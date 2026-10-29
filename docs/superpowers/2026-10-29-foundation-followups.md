# 第一阶段遗留事项（后续处理）

来源：第一阶段逐任务审查与最终审查中延后处理的小问题。均不阻塞合并。

## 需要产品负责人决定

- 体重很高的用户（男性 BMI 约 49 以上、女性约 55 以上）：按目前公式（蛋白质按总体重 2.0 g/kg、脂肪下限 0.8 g/kg），蛋白质加脂肪的热量会超过目标热量，碳水被压到 0，违反设计文档 4.5 的「三大营养素热量误差 ≤ 1%」。建议在 BMI ≥ 30 时改用调整体重或目标体重计算，和公式参数的专业复核一起决定。

## 上线前要处理

- 第一次修改 `packages/core/src/constants.ts` 之前：在目标版本快照里加入计算器版本号，否则重复提交会返回旧版本 id、显示新数字。
- 部署前：替换 `wrangler.jsonc` 的 database_id；生产环境绝不设 ENVIRONMENT=development；首次部署后实测密码哈希的 CPU 时间（Workers 免费版 10ms 限制）。
- 没有 cf-connecting-ip 的请求（如以后加前置 Worker）会共用一个限速桶。

## 小问题清单

- [Task 1] unit thinness — no mid-foot rounding / zero / negative cases in units.test.ts
- [Task 1] turbo test/typecheck dependsOn ^build will force builds once a build script exists
- [Task 1] ci.yml lacks concurrency group and permissions: contents: read
- [Task 2] gain + raisedToFloor path untested in energy tests (carried into Task 3 as a targets test)
- [Task 2] exported constant tables are mutable Records — consider Readonly/as const (both sides must compute identically)
- [Task 2] 7-case table duplicated across energy.test.ts and macros.test.ts
- [Task 2] no input guards (zero height → Infinity) — validators must bound inputs (Task 4 covers)
- [Task 3] no boundary tests pinning unrounded-BMI guardrails (~18.47 must block loss; ~34.96 must not trigger high_bmi_consult)
- [Task 3] blocked-case tests assert bmr/tdee > 0 rather than exact values
- [Task 3] guardrails.ts has no direct unit tests (covered via computeTargets)
- [Task 4] lower-bound height/weight and weight upper bound not tested
- [Task 4] ProfileInput is the output type (confirmed required) — Task 8 may want z.input<typeof profileInputSchema> for client payloads (pointer carried to Task 8)
- [Task 4] consent version accepts whitespace / unbounded length
- [Task 5] invite use burns on requests that later fail validation (bad email/short password/duplicate) — pointer to Task 7: sign-up screen must pre-validate email shape, password ≥ 8, before submit; revisit reserving in databaseHooks.user.create.before later
- [Task 5] requireSession success path untested
- [Task 5] normalizeInviteCode uppercases; lowercase hand-inserted codes unredeemable
- [Task 5] .dev.vars notice in test output; create-invite spawns pnpm without shell (Windows)
- [Task 5] no tests for future reset/verify redirect flows; nothing enforces ENVIRONMENT≠development in prod beyond comments
- [Task 6] error bodies mix `error` (400) and `code` (401/403/500) keys — clients must read both (pointer to Task 7/8)
- [Task 6] after 409/422 GET returns new profile with older latestGoal (plan-mandated save-before-guardrail) — pointer to Task 8 routing
- [Task 6] dedupe snapshot lacks calculator version; consent version unbounded; GET queries sequential; no json_valid CHECKs; trivially-true id assertion in isolation test; read-then-insert dedupe race; lockfile @vitest/mocker churn
- [Task 7] stale same-user profile result after sign-out/sign-in (gate.tsx:63-66)
- [Task 7] no timeout on profile fetch — unreachable API leaves splash ~60s
- [Task 7] every TypeError mapped to network error (auth-form.ts:57)
- [Task 7] guard decision logic untested (pure-function extraction suggested)
- [Task 7] silent sign-out errors in placeholders; duplicate expo-linking in lockfile + peers warning; TS 7 outside Expo's expected ~6.0 (suppressed); .gitignore lacks .env*.local; password hint read twice by screen readers; language choice not persisted
- [Task 8] preview builds computeTargets input by hand instead of toTargetInput
- [Task 8] inches not range-checked; Number() accepts 0x/1e; reopened imperial height rounds to whole inches
- [Task 8] no in-flight ref guard; iOS swipe-back from saved report allows second PUT
- [Task 8] 返回修改 lands on health step; failed prefill never retried; misleading "only place that converts" comment
- [Task 8] reset() may run while useSession still reports old user → A's own prefill may be skipped after explicit sign-out (no cross-user leak); treat 401 on hydrate fetch as "don't hydrate"
- [Task 8] useSignOut doesn't catch signOut() rejection (possible unhandled rejection offline)
- [Task 9] README mixes `cd apps/mobile && npx expo export` with pnpm --filter style; pnpm version stated loosely; CONTRIBUTING could mention --frozen-lockfile; curl sign-up needs Origin header (undocumented)
- [Final] stale Today targets after swipe-back from a saved edit; uniqueIp() collision risk in api tests; requests without cf-connecting-ip share one rate-limit bucket; rejected edit answers saved while old goal stays (spec §5.4)
