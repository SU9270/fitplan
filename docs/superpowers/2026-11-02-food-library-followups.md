# 第二阶段遗留事项（后续处理）

来源：第二阶段实施过程中延后处理的事项。均不阻塞合并。

## 需要产品负责人决定 / 需要外部条件

- **UI 参考**：参考网站 boardui.com 在开发环境无法访问，页面沿用第一阶段的设计常量。拿到参考（放行域名或截图）后统一调整 `apps/mobile/src/theme/tokens.ts` 与组件。
- **真实数据导入**：FoodData Central 在开发环境无法访问，导入脚本只用按官方 CSV 格式构造的样例测过。首次真实导入时核对：食物数约 7,800；`unmatchedNdbNumbers` 为空；抽查鸡胸肉（烤）、白米饭、西兰花的每 100 g 数值与 FDC 网站一致。
- **份量中文**：USDA 份量文字是英文（`1 cup, chopped`）。是否翻译常见单位（cup → 杯、tbsp → 汤匙、oz → 盎司），还是只显示克数。

## 小问题清单

- 日记对比的是最新目标，不是当天生效的目标（第六阶段一起处理）。
- 重新导入只 upsert，不删除数据集中已不存在的份量（SR Legacy 已冻结，目前不会发生）。
- 删除自定义食物后回到搜索页，旧的结果列表还在，重新输入才刷新。
- 搜索用 `LIKE '%词%'` 全表扫描；SR Legacy 不到一万行没问题，以后加入更多数据集时考虑 FTS5（中文需要分词）。
- 自定义食物只收热量和三大营养素，不收膳食纤维、糖、钠。
- App 端页面只测了纯函数（与第一阶段一致），没有在模拟器上手动走查；已通过 `expo export --platform ios` 打包与 `wrangler dev` 下的接口冒烟测试。
- `PUT /api/foods/:id`、`PATCH /api/diary/entries/:id` 的请求体由路由自己解析，Hono RPC 类型不知道 `json`，App 用 `withJson` 传入（`apps/mobile/src/lib/with-json.ts`）；以后若改用 Hono 的 validator 中间件，可以去掉这个辅助函数。
