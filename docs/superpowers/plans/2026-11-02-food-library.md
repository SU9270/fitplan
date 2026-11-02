# 第二阶段「食物库」Implementation Plan

**Goal:** 用户能搜索食物、按份量记到某天某餐，今日页显示当天合计与目标的差距；可以添加自定义食物。

**Spec:** `docs/superpowers/specs/2026-11-02-food-library-design.md`

## Global Constraints

沿用第一阶段的全部约束（见 `2026-10-29-foundation.md`），另外：

- 营养数值以「每 100 g」存储；记录保存每 100 g 快照 + 克数，读取时换算。
- 换算只在最终输出时取整；未知营养素为 NULL，合计时按 0 计入并列入 `unknown`。
- USDA 原始数据不进仓库；中文名对照表 `apps/api/data/usda-zh.csv` 进仓库。
- 客户端不能提交营养数值（自定义食物除外），记录的克数由服务器按份量算出。

## Review Focus

1. **越权**：别人的自定义食物不能搜到、看到、记录、修改、删除；别人的记录不能读、改、删。→ Task 5 测试 `custom foods are private`、`cannot touch another user's entry`。
2. **份量与食物不匹配**：用 A 食物的份量记 B 食物 → 400 `portionId`。
3. **历史不变**：修改 / 删除自定义食物后，已有记录的名称与营养不变。→ Task 5 测试 `entries keep their snapshot`。
4. **缺失营养素**：缺失不当 0 存储；合计列出 `unknown`。→ Task 2、Task 5。
5. **LIKE 通配符**：搜索 `%`、`_` 只按字面匹配。→ Task 5 测试 `escapes LIKE wildcards`。
6. **导入可重复执行**：重跑不产生重复份量、不动自定义食物。→ Task 4 测试。

---

### Task 1: 设计文档与计划

本文件与 spec。

### Task 2: `packages/core` 营养换算

- Create: `packages/core/src/nutrition.ts`、`nutrition.test.ts`；Modify: `constants.ts`（`NUTRIENT_BASIS_G`）、`types.ts`、`index.ts`
- Produces: `Nutrients`、`NutrientKey`、`scaleNutrients`、`per100gFromServing`、`sumNutrients`
- Tests: 按克换算、null 保留、合计取整只在最后、`unknown` 列表、每份转每 100 g

### Task 3: `packages/validators` 食物与记录输入

- Produces: `MEALS`、`mealSchema`、`isoDateSchema`、`foodSearchQuerySchema`、`customFoodInputSchema`、`diaryEntryInputSchema`、`diaryEntryPatchSchema`、`MAX_ENTRY_GRAMS`
- Tests: 非法日期（2026-02-30）、克数上下限、空名称、PATCH 至少一个字段

### Task 4: 数据表、USDA 导入与中文名

- Modify: `apps/api/src/db/schema.ts`；生成迁移 `0003_*`
- Create: `apps/api/src/foods/csv.ts`、`apps/api/src/foods/usda-import.ts`、`apps/api/scripts/import-usda.ts`、`apps/api/data/usda-zh.csv`
- Tests: CSV 解析（引号、转义、引号内换行、CRLF）、合并（营养素映射、缺失为 null、份量文字、丢弃 0 克份量、中文名与别名、未匹配编号报告）、生成的 SQL 在 D1 里执行两次结果一致且不影响自定义食物、中文名表格式

### Task 5: 食物与日记接口

- Create: `apps/api/src/foods/food-service.ts`、`apps/api/src/diary/diary-service.ts`、`apps/api/src/routes/foods.ts`、`apps/api/src/routes/diary.ts`；Modify: `apps/api/src/index.ts`
- Tests: 见 Review Focus 1–5，外加搜索排序、详情 404、记录增改删、合计与目标

### Task 6: App 页面

- Modify: `apps/mobile/src/app/today.tsx`、`_layout.tsx`、i18n
- Create: `apps/mobile/src/app/food/_layout.tsx`、`search.tsx`、`[id].tsx`、`custom.tsx`；`apps/mobile/src/diary/*`（日期、份量、显示用的纯函数）；组件 `progress-bar.tsx`、`list-row.tsx`、`date-switcher.tsx`
- Tests: 本地日期与翻日期、数量输入解析、份量换算预览、名称按语言选择、i18n 键一致

### Task 7: 文档与全量检查

- Modify: `README.md`（状态、导入步骤、数据来源）、`CONTRIBUTING.md`（导入命令）、遗留事项
- Run: `pnpm typecheck && pnpm test`
