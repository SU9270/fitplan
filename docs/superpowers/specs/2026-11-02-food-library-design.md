# 第二阶段「食物库」设计

日期：2026-11-02　状态：实施中

## 1. 背景与目标

第一阶段让用户拿到每日热量与三大营养素目标。第二阶段让用户**记下自己吃了什么**，并在今日页看到「已吃 / 目标 / 还剩」。

本阶段结束时应达到：用户能用中文或英文搜到常见食物，按「份」或克数记到某一天的某一餐；今日页按早餐 / 午餐 / 晚餐 / 加餐列出记录，并显示当天合计与目标的差距；搜不到的食物可以按营养成分表自己添加（仅自己可见）。

### 范围内

- 食物数据：导入 USDA SR Legacy，常见食物配中文名与别名
- 搜索：中英文关键词，多个词同时匹配
- 食物详情：每 100 g 营养、常用份量
- 饮食记录：新增、修改份量或餐次、删除；可以记今天以前的日子
- 自定义食物：新增、修改、删除，仅本人可见
- 今日页改成饮食日记：当天合计、与目标对比、四餐列表、前后翻日期

### 范围外（留给后续阶段或以后再议）

扫条码、包装食品（Open Food Facts）、「最近 / 常用」、USDA Foundation Foods 等其他数据集、搭盘子与缺口反馈（第三阶段）、照片识别、饮水、份量单位的中文翻译。

## 2. 食物数据

### 2.1 来源与协议

| 项目 | 选择 |
|---|---|
| 数据集 | USDA FoodData Central 的 **SR Legacy**（2018 年 4 月版，约 7,800 种通用食物） |
| 协议 | 公有领域（CC0 1.0），可随开源仓库使用；App 内注明「数据来源：USDA FoodData Central」 |
| 为什么只用 SR Legacy | 已冻结不再更新，`fdc_id` 与 NDB 编号稳定；覆盖生鲜、熟食、常见餐馆菜（含美式中餐如宫保鸡丁、陈皮鸡）和快餐。Foundation Foods 数量少且和 SR Legacy 重叠，以后需要再加 |
| 获取方式 | 贡献者从 FoodData Central 下载页手动下载 SR Legacy 的 CSV 压缩包并解压，导入脚本读取解压目录。仓库不提交 USDA 原始数据 |

### 2.2 用到的 CSV 与字段

按列名读取（不依赖列顺序）：

| 文件 | 字段 |
|---|---|
| `food.csv` | `fdc_id`、`description` |
| `sr_legacy_food.csv` | `fdc_id`、`NDB_number` |
| `food_nutrient.csv` | `fdc_id`、`nutrient_id`、`amount` |
| `food_portion.csv` | `id`、`fdc_id`、`seq_num`、`amount`、`measure_unit_id`、`portion_description`、`modifier`、`gram_weight` |
| `measure_unit.csv` | `id`、`name` |

营养素编号（FDC `nutrient.id`）：能量 kcal `1008`、蛋白质 `1003`、脂肪 `1004`、碳水（差减法）`1005`、膳食纤维 `1079`、总糖 `2000`、钠 mg `1093`。SR Legacy 的数值都是**每 100 g 可食部分**。缺失的营养素存 NULL，不存 0。

份量文字：`amount` + 单位名（单位为 `undetermined` 时省略）+ `portion_description` 或 `modifier`，如 `1 cup, chopped`。克重不大于 0 的份量丢弃。

### 2.3 中文名

`apps/api/data/usda-zh.csv`，按 NDB 编号对应：

```
ndb_number,name_zh,aliases
05064,鸡胸肉（烤）,鸡胸|鸡胸肉|chicken breast
```

- 先覆盖约 150 种留学生最常吃的食物（米饭、面条、鸡蛋、鸡胸、豆腐、青菜、水果、常见美式中餐和快餐等），以后可以继续补。
- 用 NDB 编号而不是 `fdc_id`：NDB 编号在 SR 的历次版本里不变，便于对照核验。
- 导入时报告对照表里找不到的编号；不阻断导入。

### 2.4 导入脚本

`pnpm --filter @fitplan/api food:import -- --dir <解压目录> [--remote]`

1. 读取并解析 CSV（自己写的 RFC 4180 解析器，支持引号、转义引号与引号内换行，不引入依赖）。
2. 合并成食物行与份量行，套上中文名。
3. 生成 SQL 文件，用 `wrangler d1 execute fitplan --local|--remote --file` 写入。
4. **可重复执行**：食物按 `id` upsert，USDA 份量先删后插。自定义食物不受影响。

解析与合并是纯函数（`apps/api/src/foods/usda-import.ts`），有单元测试；脚本只负责读文件和调用 wrangler。

## 3. 计算（`packages/core`）

```ts
interface Nutrients { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }

scaleNutrients(per100g: Nutrients, grams: number): Nutrients           // 按克数换算，保留 null，不取整
per100gFromServing(perServing: Nutrients, servingG: number): Nutrients // 自定义食物：每份 → 每 100 g
sumNutrients(list: Nutrients[]): { totals: MacroTargets; unknown: NutrientKey[] }
```

- 换算基数 `NUTRIENT_BASIS_G = 100` 定义在 `constants.ts`。
- `sumNutrients`：null 按 0 计入合计，同时在 `unknown` 里列出有缺失的营养素，App 据此显示「部分食物缺少数据」。只在输出时取整（kcal、克都取整数）。

## 4. 后端（`apps/api`）

### 4.1 数据表

| 表 | 字段要点 |
|---|---|
| `foods` | id（USDA 为 `usda-<fdc_id>`，自定义为 UUID）、source（`usda_sr_legacy` / `custom`，CHECK）、fdc_id（USDA 才有，唯一）、owner_user_id（自定义才有，删用户级联删除；CHECK 保证与 source 一致）、name、name_zh、aliases、search_text（小写的 name + name_zh + aliases，用于搜索）、kcal / protein_g / carbs_g / fat_g / fiber_g / sugars_g / sodium_mg（每 100 g，REAL，未知为 NULL）、created_at、updated_at |
| `food_portions` | id、food_id（级联删除）、label、grams（CHECK > 0）、sort_order |
| `diary_entries` | id、user_id（级联删除）、date（`YYYY-MM-DD`，用户本地日期）、meal（`breakfast` / `lunch` / `dinner` / `snack`，CHECK）、food_id（食物删除后置 NULL）、food_name / food_name_zh（快照）、portion_id（置 NULL）、portion_label、quantity、grams（CHECK > 0）、kcal / protein_g / carbs_g / fat_g **每 100 g 的快照**、created_at、updated_at |

记录里保存的是**记录当时**的每 100 g 营养快照：以后修改或删除自定义食物、重新导入 USDA 数据，都不改变历史记录。当天的数值在读取时用 `scaleNutrients` 算出。

### 4.2 接口

全部要求已登录；写饮食记录额外要求已同意健康数据使用（403 `consent_required`，与资料接口一致）。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/foods?q=&limit=` | 搜索 USDA 食物 + 自己的自定义食物，默认 20 条，最多 50 |
| GET | `/api/foods/:id` | 详情：每 100 g 营养（7 项）、份量列表；看不到别人的自定义食物（404） |
| POST | `/api/foods` | 新建自定义食物：名称、每份名称（可选）、每份克数、每份 kcal / 蛋白质 / 碳水 / 脂肪 |
| PUT | `/api/foods/:id` | 修改自己的自定义食物（USDA 食物与别人的食物 404） |
| DELETE | `/api/foods/:id` | 删除自己的自定义食物，已有记录保留 |
| GET | `/api/diary?date=YYYY-MM-DD` | 当天记录、合计、缺失项、最新目标 |
| POST | `/api/diary/entries` | `{ date, meal, foodId, portionId \| null, quantity }`；`portionId` 为 null 时 `quantity` 即克数 |
| PATCH | `/api/diary/entries/:id` | 改餐次和 / 或份量（`portionId`、`quantity`） |
| DELETE | `/api/diary/entries/:id` | 删除 |

克数由服务器按份量算出，客户端不能直接指定营养数值。单条记录克数须在 (0, 5000]。日期须是真实存在的日历日期，且不晚于服务器 UTC 日期的后一天（用户可能在 UTC 之前的时区）。

### 4.3 搜索

数据量不到一万行，不上全文索引：

1. 关键词去首尾空格、转小写、按空白拆成最多 5 个词；每个词都要出现在 `search_text` 里（`LIKE '%词%'`，转义 `%`、`_`、`\`）。
2. 排序：中文名或英文名与整个关键词完全相同 → 以关键词开头 → 有中文名 → 其他；同一档里自己的自定义食物在前，再按名称长度从短到长。

SQLite 的 `LIKE` 对中文按字符匹配，「鸡胸」能匹配「鸡胸肉（烤）」，不需要分词。

### 4.4 错误

沿用第一阶段：输入不合法 400（`invalid_input` + 字段错误）；找不到或无权访问 404 `not_found`；份量不属于该食物 400，字段 `portionId`；未同意 403；未登录 401；其余 500。

## 5. App（`apps/mobile`）

### 5.1 页面

- **今日（饮食日记）**：顶部日期切换（‹ 今天 ›，不能翻到明天以后）；汇总卡片：已吃 / 目标 kcal、还剩或超出，三大营养素进度条；四个餐次卡片，各自列出记录（名称、份量、kcal）和「添加」；页面底部保留「重新填写问卷」、语言切换、退出登录。
- **搜索食物** `food/search`：输入框（输入停顿 300 ms 后搜索）、结果列表（名称、每 100 g kcal、「自定义」标记）、「找不到？自己添加」。
- **食物详情 / 记录** `food/[id]`：名称、来源说明；份量选择（克 + 各份量）、数量输入；按所选份量实时显示 kcal 与三大营养素；餐次选择；「添加到早餐」。从日记点进已有记录时变成「保存」与「删除这条记录」。自定义食物在这里可以进入编辑或删除。
- **自定义食物** `food/custom`：名称、每份名称（可选）、每份克数、每份 kcal / 蛋白质 / 碳水 / 脂肪；新建与编辑共用。

名称显示：中文界面用 `name_zh`，没有时用英文名；英文界面一律用英文名。

### 5.2 视觉

沿用第一阶段的设计常量（tokens）与组件；参考网站（boardui.com）在当前开发环境无法访问，拿到参考后再统一调整 tokens 与组件。新增组件：进度条、列表行、餐次卡片、日期切换。

### 5.3 路由

新页面放在 `today` 同一个守卫里（`status === 'ready'` 才能进）。日期用设备本地日期（`YYYY-MM-DD`）。

## 6. 风险与待定

| 风险 | 处理 |
|---|---|
| 开发环境无法访问 FoodData Central，导入脚本只用按官方格式构造的样例测试过 | 首次用真实下载包导入时核对行数（约 7,800 种食物）与几种食物的数值，有出入就修正解析并补测试 |
| USDA 英文名冗长 | 常见食物配中文名；以后可以补英文短名 |
| 份量文字是英文（如 `1 cup, chopped`） | 旁边总是显示克数；中文翻译以后再做 |
| 日记目标用的是最新目标，而不是那天生效的目标 | 第六阶段做自适应目标时一起处理 |
