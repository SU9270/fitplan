# 食物库配图

食物库每个食物一张图，放在 `apps/mobile/assets/library/<文件名>.png`。现在的 57 张是 2026-11-15 用 GPT 生图（Codex CLI 里的 Image 2）生成的「釉面陶瓷小摆件」风格。生成过程的原图、每张的提示词和后处理脚本在仓库上一级的 `food-images-gpt/` 文件夹里，不进仓库。

## 图片要求

- 正方形 PNG，白色背景，只有这一样食物
- 食物较长的一边占画面的 76%（四周各留约 12% 空白），这样放在网格里大小一致
- App 里最大显示 96 × 96，所以放进项目的是 **384 × 384**、256 色压缩后的版本（每张约 35 KB）。压缩前先把接近白色（240 以上）的背景提亮成纯白 255，否则在白色卡片上会看到一圈淡灰的方框
- 不要文字和标签：罐头、瓶子一律是没有标签的素面容器
- 颗粒小的食物（豆子、坚果、种子、谷物）画成一小堆或一小碗，缩小后也认得出

## 提示词

把 `{FOOD}` 换成下表最后一列的英文描述：

```
A single {FOOD} as a small realistic miniature figurine, a visibly ceramic, toy-like porcelain figurine
made of glossy glazed porcelain, smooth soft ceramic surfaces with gentle glossy highlights, slightly
simplified shapes with realistic proportions and natural soft colors, soft diffused studio lighting,
viewed from about 45 degrees above, centered with generous empty margin, pure white background, the
object rests on the surface with a soft contact shadow directly beneath it, no text, no labels, no extra
props, square 1:1 product icon, consistent icon set style, no herbs or seasoning flakes, uniform smooth
glaze, like a ceramic toy food.
```

除米饭外，每张都把第一版的西兰花图作为参考图一起传给生图工具（「参考这张图的材质、光线、视角和背景，但画提示词里的食物」），整套风格才统一。文字里写的视角和阴影位置，生图工具基本不理会，靠参考图控制更有效。

## 换图步骤

1. 生成原图，按上面的要求裁成正方形（食物占 76%），再缩到 384 × 384，把背景提亮成纯白，最后压成 256 色
2. 用下表的文件名覆盖 `apps/mobile/assets/library/` 里同名的文件
3. 重启 `pnpm dev`（Expo 需要重新打包图片）

新增一个食物：在 `apps/api/data/usda-zh.csv` 那一行的 `library` 列填上文件名（不带 .png），把图片放进上面的文件夹，在 `apps/mobile/src/library/images.ts` 加一行，再运行一次 `food:import`。测试会检查三处是否一致。

## 清单（57 张）

| # | 文件名 | 食物 | 英文描述（填进提示词） |
|---|---|---|---|
| 1 | `rice.png` | 白米饭 | bowl of steamed white rice (in a small plain white ceramic bowl) |
| 2 | `brown_rice.png` | 糙米饭 | bowl of cooked brown rice (in a small plain white ceramic bowl) |
| 3 | `quinoa.png` | 藜麦（熟） | small bowl of cooked quinoa (in a small plain white ceramic bowl) |
| 4 | `oats.png` | 燕麦片（干） | small heap of dry rolled oat flakes |
| 5 | `spaghetti.png` | 意面（煮熟） | neat twirled nest of cooked spaghetti |
| 6 | `buckwheat_noodles.png` | 荞麦面（煮熟） | neat bundle of cooked grey-brown buckwheat soba noodles |
| 7 | `whole_wheat_bread.png` | 全麦面包 | pair of whole wheat bread slices, one leaning on the other |
| 8 | `chicken_breast.png` | 鸡胸肉（烤） | roasted chicken breast fillet |
| 9 | `chicken_thigh.png` | 鸡腿肉（烤，去皮） | roasted chicken drumstick |
| 10 | `steak.png` | 西冷牛排（瘦肉，烤） | grilled beef steak with a seared brown crust |
| 11 | `pork_loin.png` | 猪里脊（烤） | thick slice of roast pork loin |
| 12 | `salmon.png` | 三文鱼（养殖，熟） | salmon fillet, orange-pink with white fat lines |
| 13 | `shrimp.png` | 虾（煮熟） | cooked pink shrimp, curled |
| 14 | `cod.png` | 鳕鱼（熟） | skinless snow-white cod fillet with visible flaky layered texture, no grey skin |
| 15 | `mackerel.png` | 鲭鱼（熟） | whole mackerel fish with blue-green striped back and silver belly |
| 16 | `sardines.png` | 沙丁鱼罐头（油浸） | open rectangular tin can with silver sardines lying side by side in oil, lid peeled back, plain unlabeled tin |
| 17 | `tuna.png` | 水浸金枪鱼罐头 | open round can filled with flaked pale pink tuna chunks, plain unlabeled can |
| 18 | `egg.png` | 水煮蛋 | peeled hard-boiled egg cut in half showing the yellow yolk |
| 19 | `tofu.png` | 北豆腐（老豆腐） | block of firm white tofu |
| 20 | `soy_milk.png` | 无糖豆浆 | plain clear glass of creamy off-white soy milk with a few dried yellow soybeans beside the glass |
| 21 | `edamame.png` | 毛豆（冷冻） | small cluster of three green edamame pods |
| 22 | `black_beans.png` | 黑豆（煮熟） | small heap of small glossy black beans |
| 23 | `chickpeas.png` | 鹰嘴豆（煮熟） | small heap of round beige chickpeas |
| 24 | `greek_yogurt.png` | 希腊酸奶（原味，脱脂） | small bowl of thick white Greek yogurt (in a small plain white ceramic bowl) |
| 25 | `whey_protein.png` | 乳清蛋白粉 | large open plain unlabeled protein powder tub with its lid off and set beside it, showing the powder inside, with a scoop full of powder resting in front |
| 26 | `broccoli.png` | 西兰花（生） | broccoli floret |
| 27 | `spinach.png` | 菠菜（生） | small bunch of dark green spinach leaves |
| 28 | `bok_choy.png` | 小白菜（生） | head of bok choy with white stems and green leaves |
| 29 | `cabbage.png` | 卷心菜（生） | round green cabbage |
| 30 | `carrot.png` | 胡萝卜（生） | orange carrot with a green leafy top |
| 31 | `tomato.png` | 番茄（生） | red tomato with a green stem |
| 32 | `cucumber.png` | 黄瓜（生） | green cucumber |
| 33 | `potato.png` | 土豆（烤，带皮） | baked potato with brown skin, split open on top |
| 34 | `sweet_potato.png` | 红薯（烤） | roasted sweet potato split open showing orange flesh |
| 35 | `corn.png` | 甜玉米（煮熟） | ear of yellow sweet corn |
| 36 | `shiitake.png` | 香菇（生） | pair of brown shiitake mushrooms |
| 37 | `onion.png` | 洋葱（生） | yellow onion |
| 38 | `bell_pepper.png` | 青椒（生） | green bell pepper |
| 39 | `lettuce.png` | 罗马生菜（生） | head of romaine lettuce |
| 40 | `eggplant.png` | 茄子（生） | purple eggplant |
| 41 | `apple.png` | 苹果（带皮） | red apple |
| 42 | `banana.png` | 香蕉 | yellow banana |
| 43 | `orange.png` | 橙子 | orange fruit |
| 44 | `grapes.png` | 葡萄（无籽） | bunch of green grapes |
| 45 | `strawberry.png` | 草莓 | red strawberry |
| 46 | `blueberries.png` | 蓝莓 | small heap of blueberries |
| 47 | `avocado.png` | 牛油果 | avocado cut in half with the pit in one half |
| 48 | `watermelon.png` | 西瓜 | triangular slice of watermelon |
| 49 | `kiwi.png` | 猕猴桃 | kiwi fruit cut in half showing green flesh |
| 50 | `mango.png` | 芒果 | ripe mango |
| 51 | `peanut_butter.png` | 花生酱（含盐） | open plain unlabeled glass jar of peanut butter |
| 52 | `almonds.png` | 杏仁 | small heap of whole almonds with ribbed brown skin |
| 53 | `walnuts.png` | 核桃 | pair of walnuts in their shells, one cracked open showing the wrinkled kernel |
| 54 | `cashews.png` | 腰果（生） | small heap of curved cream-colored cashews |
| 55 | `flaxseed.png` | 亚麻籽 | small heap of tiny flat glossy reddish-brown flaxseeds (in a small plain white ceramic bowl) |
| 56 | `chia_seeds.png` | 奇亚籽 | small heap of tiny speckled grey, black and white chia seeds (in a small plain white ceramic bowl) |
| 57 | `olive_oil.png` | 橄榄油 | small plain unlabeled glass bottle of golden olive oil |
