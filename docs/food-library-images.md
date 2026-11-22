# 食物库配图

食物库每个食物一张图，放在 `apps/mobile/assets/library/<文件名>.png`。前 55 张是 2026-11-15、后 21 张是 2026-11-22 用 GPT 生图（Codex CLI 里的 Image 2）生成的「釉面陶瓷小摆件」风格。生成过程的原图、每张的提示词和后处理脚本在仓库上一级的 `food-images-gpt/` 文件夹里，不进仓库。

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

1. 生成原图（`gen.sh <文件名> raw/broccoli-v1.png`），用 `postprocess.py` 裁成正方形（食物占 76%），再用 `to-app.py` 缩到 384 × 384、把背景提亮成纯白、压成 256 色（三个脚本都在 `food-images-gpt/`）
2. 用下表的文件名覆盖 `apps/mobile/assets/library/` 里同名的文件
3. 重启 `pnpm dev`（Expo 需要重新打包图片）

新增一个食物：在 `apps/api/data/usda-zh.csv` 那一行的 `library` 列填上文件名（不带 .png），把图片放进上面的文件夹，在 `apps/mobile/src/library/images.ts` 加一行，再运行一次 `food:import`。测试会检查三处是否一致。

## 清单（76 张）

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
| 16 | `egg.png` | 水煮蛋 | peeled hard-boiled egg cut in half showing the yellow yolk |
| 17 | `tofu.png` | 北豆腐（老豆腐） | block of firm white tofu |
| 18 | `soy_milk.png` | 无糖豆浆 | plain clear glass of creamy off-white soy milk with a few dried yellow soybeans beside the glass |
| 19 | `edamame.png` | 毛豆（冷冻） | small cluster of three green edamame pods |
| 20 | `black_beans.png` | 黑豆（煮熟） | small heap of small glossy black beans |
| 21 | `chickpeas.png` | 鹰嘴豆（煮熟） | small heap of round beige chickpeas |
| 22 | `greek_yogurt.png` | 希腊酸奶（原味，脱脂） | small bowl of thick white Greek yogurt (in a small plain white ceramic bowl) |
| 23 | `whey_protein.png` | 乳清蛋白粉 | large open plain unlabeled protein powder tub with its lid off and set beside it, showing the powder inside, with a scoop full of powder resting in front |
| 24 | `broccoli.png` | 西兰花（生） | broccoli floret |
| 25 | `spinach.png` | 菠菜（生） | small bunch of dark green spinach leaves |
| 26 | `bok_choy.png` | 小白菜（生） | head of bok choy with white stems and green leaves |
| 27 | `cabbage.png` | 卷心菜（生） | round green cabbage |
| 28 | `carrot.png` | 胡萝卜（生） | orange carrot with a green leafy top |
| 29 | `tomato.png` | 番茄（生） | red tomato with a green stem |
| 30 | `cucumber.png` | 黄瓜（生） | green cucumber |
| 31 | `potato.png` | 土豆（烤，带皮） | baked potato with brown skin, split open on top |
| 32 | `sweet_potato.png` | 红薯（烤） | roasted sweet potato split open showing orange flesh |
| 33 | `corn.png` | 甜玉米（煮熟） | ear of yellow sweet corn |
| 34 | `shiitake.png` | 香菇（生） | pair of brown shiitake mushrooms |
| 35 | `onion.png` | 洋葱（生） | yellow onion |
| 36 | `bell_pepper.png` | 青椒（生） | green bell pepper |
| 37 | `lettuce.png` | 罗马生菜（生） | head of romaine lettuce |
| 38 | `eggplant.png` | 茄子（生） | purple eggplant |
| 39 | `apple.png` | 苹果（带皮） | red apple |
| 40 | `banana.png` | 香蕉 | yellow banana |
| 41 | `orange.png` | 橙子 | orange fruit |
| 42 | `grapes.png` | 葡萄（无籽） | bunch of green grapes |
| 43 | `strawberry.png` | 草莓 | red strawberry |
| 44 | `blueberries.png` | 蓝莓 | small heap of blueberries |
| 45 | `avocado.png` | 牛油果 | avocado cut in half with the pit in one half |
| 46 | `watermelon.png` | 西瓜 | triangular slice of watermelon |
| 47 | `kiwi.png` | 猕猴桃 | kiwi fruit cut in half showing green flesh |
| 48 | `mango.png` | 芒果 | ripe mango |
| 49 | `peanut_butter.png` | 花生酱（含盐） | open plain unlabeled glass jar of peanut butter |
| 50 | `almonds.png` | 杏仁 | small heap of whole almonds with ribbed brown skin |
| 51 | `walnuts.png` | 核桃 | pair of walnuts in their shells, one cracked open showing the wrinkled kernel |
| 52 | `cashews.png` | 腰果（生） | small heap of curved cream-colored cashews |
| 53 | `flaxseed.png` | 亚麻籽 | small heap of tiny flat glossy reddish-brown flaxseeds (in a small plain white ceramic bowl) |
| 54 | `chia_seeds.png` | 奇亚籽 | small heap of tiny speckled grey, black and white chia seeds (in a small plain white ceramic bowl) |
| 55 | `olive_oil.png` | 橄榄油 | small plain unlabeled glass bottle of golden olive oil |
| 56 | `bagel.png` | 贝果 | plain bagel, golden brown, with a hole in the middle |
| 57 | `corn_tortilla.png` | 玉米薄饼 | small stack of soft pale yellow corn tortillas |
| 58 | `pumpkin.png` | 南瓜（煮熟） | two steamed wedges of orange pumpkin with dark green rind |
| 59 | `taro.png` | 芋头（煮熟） | whole taro root with brown ringed skin, beside a cut half showing white flesh with tiny purple specks |
| 60 | `lotus_root.png` | 莲藕（煮熟） | section of lotus root with one cut round slice showing its pattern of holes |
| 61 | `scallops.png` | 扇贝（蒸） | three seared scallops with golden-brown tops |
| 62 | `soft_tofu.png` | 嫩豆腐 | block of soft silken white tofu with a very smooth glossy surface, on a small plain white ceramic dish |
| 63 | `dried_tofu.png` | 豆干 | small stack of three square slices of firm brown pressed dried tofu (Chinese dougan) |
| 64 | `asparagus.png` | 芦笋（生） | small bundle of green asparagus spears |
| 65 | `cauliflower.png` | 菜花（生） | head of white cauliflower with green leaves at the base |
| 66 | `zucchini.png` | 西葫芦（生） | green zucchini |
| 67 | `chinese_broccoli.png` | 芥蓝（生） | small bunch of Chinese broccoli (gai lan) with thick green stems and dark green leaves |
| 68 | `napa_cabbage.png` | 大白菜（生） | head of napa cabbage with pale green crinkly leaves and white stems |
| 69 | `green_beans.png` | 四季豆（生） | small bunch of green beans |
| 70 | `white_mushroom.png` | 白蘑菇（生） | pair of white button mushrooms |
| 71 | `kale.png` | 羽衣甘蓝（生） | small bunch of curly dark green kale leaves |
| 72 | `pear.png` | 梨 | green-yellow pear with a stem |
| 73 | `peach.png` | 桃子 | ripe peach with a pink-orange blush and a small green leaf |
| 74 | `pineapple.png` | 菠萝 | pineapple with its green leafy crown |
| 75 | `cherries.png` | 樱桃 | small cluster of three dark red cherries with stems |
| 76 | `cantaloupe.png` | 哈密瓜 | cantaloupe melon cut in half showing orange flesh and netted rind |
