# FitPlan

> 在美国不知道吃什么？帮你搭出想吃、又符合增肌 / 减脂目标的每一餐。

FitPlan is an open-source fitness-diet app for Chinese international students in the US. It turns your goal (cut or bulk) and body data into daily calorie and macro targets, and (in later phases) helps you build meals from food you can actually buy and eat in the US.

> **健康声明 / Health disclaimer**：App 中的 BMI、BMR、TDEE、每日热量与营养素目标均为基于公式的估算，**不构成医疗建议**。有疾病、怀孕 / 哺乳或饮食障碍史，请先咨询医生或注册营养师。

## 当前状态 Status

第一阶段「地基」已完成，第二阶段「食物库」实施中。

第一阶段「地基」：

- 邀请码注册 / 登录（邮箱 + 密码）
- 分步问卷：目标与速度、基础信息（公制 / 英制可切换）、生活与训练、健康筛查与数据使用同意
- 身体报告：BMI、BMR、TDEE、每日热量与三大营养素目标，含三级安全限制
- 「重新填写问卷」：预填已保存的答案，修改后重新计算目标
- 中英双语界面，数据保存在服务器，重新登录不丢失

第二阶段「食物库」（[设计文档](docs/superpowers/specs/2026-11-02-food-library-design.md)）：

- 食物数据来自 USDA SR Legacy，约 220 种常见食物配有中文名与别名
- 中英文搜索食物，按份量或克数记到某天的某一餐
- 今日页变成饮食日记：当天已吃、还剩多少、三大营养素进度，可以翻看前几天
- 搜不到的食物可以照营养成分表自己添加（仅自己可见）

个人主页「我的」（[设计文档](docs/superpowers/specs/2026-11-02-profile-page-design.md)）：

- 底部标签栏「今日 / 我的」
- 昵称（可修改）与邮箱、身体资料与每日目标、记录天数与连续记录、我的自定义食物
- 语言与单位保存在服务器，换设备或重新登录后仍然生效

第三阶段「搭盘子与缺口反馈」（[设计文档](docs/superpowers/specs/2026-11-03-plate-feedback-design.md)）：

- 每一餐是一个四格盘子：蛋白质、主食、蔬菜、其他
- 全天目标按比例分到各餐（默认早 25%、午 30%、晚 30%、加餐 15%，可在「我的 → 设置」修改）
- 选完一餐后提示还缺什么（±10% 内算达标，语气中立），并给出最多 3 条一键应用的调整建议

记录效率（[设计文档](docs/superpowers/specs/2026-11-03-logging-efficiency-design.md)）：

- 搜索页直接列出「常吃」「最近吃过」，点「+」按上次的份量一键再记
- 复制昨天的某一餐或全部记录
- 把一餐存成「我的餐」，以后一键加入
- 快速添加：不选食物，只填热量（三大营养素可选）

后续阶段（各自单独设计、计划、实施）：

4. 灵感库与内容生产流程
5. 打卡、体重与趋势
6. 自适应目标与每周 check-in

## 仓库结构 Repository layout

```
fitplan/
├─ apps/
│  ├─ mobile/         Expo App（Expo Router）          @fitplan/mobile
│  └─ api/            Hono + Cloudflare Workers + D1   @fitplan/api
│     └─ data/        USDA 食物的中文名对照表（usda-zh.csv）
├─ packages/
│  ├─ core/           纯 TypeScript 计算核心，零运行时依赖  @fitplan/core
│  └─ validators/     前后端共用的 Zod 输入规则           @fitplan/validators
├─ docs/superpowers/  设计文档（specs/）与实施计划（plans/）
└─ .github/workflows/ci.yml
```

## 技术栈 Tech stack

| 部分 | 选择 |
|---|---|
| 仓库 | pnpm workspaces + Turborepo |
| App | React Native + Expo SDK 58 + Expo Router |
| 后端 | Cloudflare Workers + Hono |
| 数据库 | Cloudflare D1 + Drizzle ORM |
| 登录 | Better Auth（邮箱 + 密码）+ `@better-auth/expo` |
| 校验 | Zod |
| 测试 | Vitest（core / validators / api，api 用 `@cloudflare/vitest-plugin`），Jest + jest-expo（mobile） |

## 前置条件 Prerequisites

- Node 24（见 `.nvmrc`；`nvm use` 即可）
- pnpm 12（`package.json` 的 `packageManager` 字段已固定；用 Corepack：`corepack enable`）
- 运行 App：Expo Go（iOS 模拟器需要 Xcode；Android 需要 Android Studio 模拟器）

**不需要** Cloudflare 账号：`wrangler dev` 会在本地模拟 Workers 和 D1。

## 本地运行 Run locally

### 一键启动 Quick start

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会自动完成第一次运行需要的准备（创建 `apps/api/.dev.vars` 并生成密钥、创建 `apps/mobile/.env`、应用本地数据库迁移），然后启动后端、等它就绪，再启动 App 并打开 iOS 模拟器。按一次 `Ctrl+C` 全部停止。

- `pnpm dev --android`：改为打开 Android 模拟器（第一次运行会把 `apps/mobile/.env` 写成 `http://10.0.2.2:8787`）
- `pnpm dev --no-open`：只启动，不自动打开模拟器，之后在 Expo 提示里按 `i` / `a`

第一次使用还需要：生成邀请码（下面第 4 步）和导入食物数据（第 5 步，可选）。用真机调试仍按下面的分步说明操作。

### 分步说明 Step by step

在仓库根目录执行。

**1. 安装依赖**

```bash
pnpm install
```

**2. 配置后端环境变量**

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

把 `apps/api/.dev.vars` 里的 `BETTER_AUTH_SECRET` 换成至少 32 位的随机字符串（例如 `openssl rand -base64 32` 的输出）。`.dev.vars` 已被 git 忽略，不要提交。

**3. 应用本地 D1 迁移**

```bash
pnpm --filter @fitplan/api db:migrate:local
```

按提示确认（非交互环境会自动应用）。

**4. 生成邀请码**（注册必须有邀请码）

```bash
pnpm --filter @fitplan/api invite:create -- --uses 5
```

输出形如 `Invite code (5 uses, local): ABCDE23456`，记下这个码。

**5. 导入食物数据**（不导入也能跑，只是搜不到 USDA 食物，只能用自定义食物）

1. 打开 [FoodData Central 下载页](https://fdc.nal.usda.gov/download-datasets)，下载 **SR Legacy** 的 CSV 压缩包并解压。
2. 导入（可以重复执行，已有数据会被更新，不会重复）：

```bash
pnpm --filter @fitplan/api food:import -- --dir <解压出来的文件夹>
```

输出应为 `Foods: 7793 (223 with a Chinese name), portions: 14449` 和 `Suggestion candidates: 31`。**第三阶段之前导入过的，需要再运行一次**（导入会补上食物分类和建议候选，`pnpm dev` 发现缺分类时也会提示）。USDA 数据属于公有领域（CC0），不随仓库分发；常见食物的中文名在 `apps/api/data/usda-zh.csv`，欢迎补充（按 NDB 编号对应）。

**6. 启动后端**

```bash
pnpm --filter @fitplan/api dev
```

默认监听 `http://localhost:8787`。验证：`curl http://localhost:8787/health` 返回 `{"ok":true}`。

**7. 配置并启动 App**（另开一个终端）

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @fitplan/mobile start
```

在 Expo 终端里按 `i` 在 iOS 模拟器的 Expo Go 中打开，按 `a` 在 Android 模拟器中打开。

- iOS 模拟器：默认的 `EXPO_PUBLIC_API_URL=http://localhost:8787` 即可。
- **Android 模拟器**：模拟器里的 `localhost` 指向模拟器自己，需把 `apps/mobile/.env` 改成 `EXPO_PUBLIC_API_URL=http://10.0.2.2:8787`（`10.0.2.2` 是模拟器对宿主机的别名）。
- 真机：改成 `http://<电脑的局域网 IP>:8787`，手机和电脑需在同一网络。
- `EXPO_PUBLIC_*` 在打包时写入，修改 `.env` 后需重启 `expo start`。

**8. 注册并完成问卷**：在 App 里用第 4 步的邀请码注册，走完四步问卷，即可看到身体报告；之后在今日页搜索食物、记录饮食。

## 测试与检查 Tests and checks

```bash
pnpm typecheck     # 全部包的类型检查
pnpm test          # 全部包的测试（core、validators、api、mobile）
```

只跑某个包：`pnpm --filter @fitplan/core test`（包名：`core`、`validators`、`api`、`mobile`）。CI（`.github/workflows/ci.yml`）执行安装、类型检查与测试。

验证 App 能打出 iOS 包：

```bash
cd apps/mobile && npx expo export --platform ios
```

## 已知限制 Known limitations

- **密码哈希的 CPU 时间**：Better Auth 默认的密码哈希较吃 CPU，Cloudflare Workers 免费计划的 CPU 时间限制较紧；首次部署后需实测注册 / 登录是否超时。
- **部署前必须替换 D1 的 `database_id`**：`apps/api/wrangler.jsonc` 里是占位值，部署前运行 `wrangler d1 create fitplan` 并把返回的 id 填进去；本地开发不需要。
- **`ENVIRONMENT` 不得在生产环境设为 `development`**：该值会信任 `exp://` 来源与重定向。生产环境保持 `wrangler.jsonc` 里的 `"production"`，且不要把 `.dev.vars` 带到线上。
- **登录 / 注册有频率限制**：同一 IP 每分钟最多登录 5 次、注册 3 次（计数存 D1，见 `apps/api/src/auth.ts` 的 `RATE_LIMIT_RULES`），本地开发同样生效；多人共用一个出口 IP（如校园网）时可能互相影响，需要时调高。
- **份量文字是英文**（如 `1 cup, chopped`），旁边总会显示克数；中文翻译以后再做。
- **饮食日记里的目标是最新目标**：翻看以前的日子时，对比的是现在的目标，而不是当天生效的目标。
- **语言在登录前按系统语言显示**：在「我的 → 设置」切换的语言保存在服务器上，登录并读取资料后才会生效。
- 计算参数尚未经专业人士复核（集中定义在 `packages/core/src/constants.ts`，复核后只需改一处）。

## 贡献 Contributing

见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可 License

[MIT](LICENSE)。
