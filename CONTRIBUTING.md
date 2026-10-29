# Contributing to FitPlan

感谢你愿意参与。本文说明分支与提交约定、如何跑测试、如何生成邀请码和数据库迁移。本地运行步骤见 [README](README.md)。

## 分支与提交 Branches and commits

- 从 `main` 切出功能分支，命名如 `feat/food-library`、`fix/onboarding-draft`。
- 提交信息用 [Conventional Commits](https://www.conventionalcommits.org/)，与现有 `git log` 一致：`<type>(<scope>): <summary>`。
  - type：`feat`、`fix`、`docs`、`chore`、`refactor`、`test`
  - scope（可选）：`core`、`validators`、`api`、`mobile`
  - 例：`feat(api): profile, goal versions and consent endpoints`、`fix(mobile): key onboarding draft to the signed-in user`
- 一个提交只做一件事；正文写清「为什么」，引入或升级依赖时注明版本。

## 测试 Tests

```bash
pnpm typecheck     # 全部包类型检查
pnpm test          # 全部包测试
pnpm --filter @fitplan/api test    # 只跑一个包（core / validators / api / mobile）
```

提交 PR 前 `pnpm typecheck && pnpm test` 必须通过，CI 会运行同样的检查。新增行为请同时补测试。

## 邀请码与数据库迁移 Invites and migrations

生成本地邀请码（先应用迁移，见 README）：

```bash
pnpm --filter @fitplan/api invite:create -- --uses 5
```

对已部署的数据库加 `--remote`（需要自己的 Cloudflare 账号）。

修改表结构：

1. 改 `apps/api/src/db/schema.ts`。
2. 生成迁移：`pnpm --filter @fitplan/api db:generate`，检查并提交 `apps/api/migrations/` 下新增的 SQL 与 meta。
3. 应用到本地：`pnpm --filter @fitplan/api db:migrate:local`。

约定：时间用 ISO-8601 UTC 文本；营养数值未知存 `NULL`，不存 0；枚举用 `CHECK` 约束并与 `packages/validators` 的 Zod 规则一致；`goal_versions` 只追加不修改。

## 计算参数 Calculation parameters

所有计算参数（公式系数、活动系数、赤字 / 盈余比例、热量下限、蛋白质与脂肪系数等）**只**在 `packages/core/src/constants.ts` 定义一次，其他地方不得出现魔法数字。修改参数必须：

- 同步更新或新增 `packages/core` 的测试；
- 在 PR 描述里写明依据（文献、指南或专业人士意见）。

用户可见文字一律走 i18n 字典（`apps/mobile/src/i18n/`，中、英各一份），不要写死在组件里。

## 设计文档 Design docs

设计文档放在 `docs/superpowers/specs/`，实施计划放在 `docs/superpowers/plans/`。较大的改动请先写 / 更新设计文档再动手。

## 密钥 Secrets

密钥只放本地 `apps/api/.dev.vars`（已被 git 忽略）或 Cloudflare secrets（`wrangler secret put <NAME>`），**绝不提交进仓库**。仓库里只放示例文件：`apps/api/.dev.vars.example`、`apps/mobile/.env.example`。提交前请检查 `git diff --staged` 没有带上 `.dev.vars` 或 `.env`。
