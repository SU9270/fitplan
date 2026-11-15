# 食物库配图

食物库每个食物一张图，放在 `apps/mobile/assets/library/<文件名>.png`。现在的图是占位用的微软 Fluent Emoji（MIT 协议），换成自己生成的图时**文件名保持不变**，直接覆盖即可。

## 图片要求

- 正方形 PNG，**1024 × 1024**（App 里最大显示 96 × 96，大图会自动缩小；放进项目前可以压缩到 512 × 512 以减小 App 体积）
- **透明背景**最好；做不到就用纯白背景
- 只有这一样食物，居中，四周留 10% 左右空白
- 不要文字、不要盘子以外的道具、不要阴影投到画面边缘
- 全部用同一个风格（下面的提示词），这样放在一起才统一

## 提示词

把 `{食物}` 换成下表最后一列的英文描述：

```
A single {食物}, cute 3D clay-style icon, soft matte ceramic texture with a gentle glossy highlight,
rounded simplified shapes, natural pastel colors, soft studio lighting from the top left,
three-quarter view, centered, isolated on a transparent background, no text, no plate, no shadow,
consistent icon set style
```

中文绘图工具可以用：

```
一个{食物}，可爱的 3D 黏土风格图标，柔和的哑光陶瓷质感，带一点光泽高光，圆润简化的造型，
自然的浅色调，左上方柔和打光，四分之三侧视角，居中，透明背景，没有文字，没有盘子，没有阴影，统一的图标风格
```

小技巧：先生成两三张（比如米饭、鸡胸肉、西兰花），挑出满意的风格后，把那张图作为参考图（「图生图」/「风格参考」）再生成其余的，风格会更统一。

## 换图步骤

1. 按下表的文件名保存图片
2. 覆盖到 `apps/mobile/assets/library/` 里同名的文件
3. 重启 `pnpm dev`（Expo 需要重新打包图片）

新增一个食物：在 `apps/api/data/usda-zh.csv` 那一行的 `library` 列填上文件名（不带 .png），把图片放进上面的文件夹，在 `apps/mobile/src/library/images.ts` 加一行，再运行一次 `food:import`。测试会检查三处是否一致。

## 清单（57 张）

| # | 文件名 | 食物 | 英文描述（填进提示词） |
|---|---|---|---|
| 1 | `rice.png` | 白米饭 | a bowl of steamed white rice |
| 2 | `brown_rice.png` | 糙米饭 | a bowl of cooked brown rice |
| 3 | `quinoa.png` | 藜麦（熟） | a small bowl of cooked quinoa |
| 4 | `oats.png` | 燕麦片（干） | a small pile of rolled oats |
| 5 | `spaghetti.png` | 意面（煮熟） | a twirl of cooked spaghetti |
| 6 | `buckwheat_noodles.png` | 荞麦面（煮熟） | a bundle of cooked buckwheat soba noodles |
| 7 | `whole_wheat_bread.png` | 全麦面包 | two slices of whole wheat bread |
| 8 | `chicken_breast.png` | 鸡胸肉（烤） | a roasted chicken breast fillet |
| 9 | `chicken_thigh.png` | 鸡腿肉（烤，去皮） | a roasted chicken drumstick |
| 10 | `steak.png` | 西冷牛排（瘦肉，烤） | a grilled beef steak |
| 11 | `pork_loin.png` | 猪里脊（烤） | a slice of roast pork loin |
| 12 | `salmon.png` | 三文鱼（养殖，熟） | a salmon fillet |
| 13 | `shrimp.png` | 虾（煮熟） | a cooked pink shrimp |
| 14 | `cod.png` | 鳕鱼（熟） | a white cod fillet |
| 15 | `mackerel.png` | 鲭鱼（熟） | a whole mackerel fish |
| 16 | `sardines.png` | 沙丁鱼罐头（油浸） | an open tin of sardines |
| 17 | `tuna.png` | 水浸金枪鱼罐头 | an open can of tuna |
| 18 | `egg.png` | 水煮蛋 | a peeled hard-boiled egg cut in half |
| 19 | `tofu.png` | 北豆腐（老豆腐） | a block of firm white tofu |
| 20 | `soy_milk.png` | 无糖豆浆 | a glass of soy milk |
| 21 | `edamame.png` | 毛豆（冷冻） | a few green edamame pods |
| 22 | `black_beans.png` | 黑豆（煮熟） | a small pile of black beans |
| 23 | `chickpeas.png` | 鹰嘴豆（煮熟） | a small pile of chickpeas |
| 24 | `greek_yogurt.png` | 希腊酸奶（原味，脱脂） | a small bowl of thick Greek yogurt |
| 25 | `whey_protein.png` | 乳清蛋白粉 | a jar of protein powder with a scoop |
| 26 | `broccoli.png` | 西兰花（生） | a broccoli floret |
| 27 | `spinach.png` | 菠菜（生） | a bunch of spinach leaves |
| 28 | `bok_choy.png` | 小白菜（生） | a head of bok choy |
| 29 | `cabbage.png` | 卷心菜（生） | a round green cabbage |
| 30 | `carrot.png` | 胡萝卜（生） | a carrot with green top |
| 31 | `tomato.png` | 番茄（生） | a red tomato |
| 32 | `cucumber.png` | 黄瓜（生） | a cucumber |
| 33 | `potato.png` | 土豆（烤，带皮） | a baked potato |
| 34 | `sweet_potato.png` | 红薯（烤） | a roasted sweet potato, split open |
| 35 | `corn.png` | 甜玉米（煮熟） | an ear of sweet corn |
| 36 | `shiitake.png` | 香菇（生） | two shiitake mushrooms |
| 37 | `onion.png` | 洋葱（生） | an onion |
| 38 | `bell_pepper.png` | 青椒（生） | a green bell pepper |
| 39 | `lettuce.png` | 罗马生菜（生） | a head of romaine lettuce |
| 40 | `eggplant.png` | 茄子（生） | a purple eggplant |
| 41 | `apple.png` | 苹果（带皮） | a red apple |
| 42 | `banana.png` | 香蕉 | a banana |
| 43 | `orange.png` | 橙子 | an orange |
| 44 | `grapes.png` | 葡萄（无籽） | a bunch of green grapes |
| 45 | `strawberry.png` | 草莓 | a strawberry |
| 46 | `blueberries.png` | 蓝莓 | a small pile of blueberries |
| 47 | `avocado.png` | 牛油果 | an avocado cut in half with the pit |
| 48 | `watermelon.png` | 西瓜 | a slice of watermelon |
| 49 | `kiwi.png` | 猕猴桃 | a kiwi cut in half |
| 50 | `mango.png` | 芒果 | a mango |
| 51 | `peanut_butter.png` | 花生酱（含盐） | a jar of peanut butter |
| 52 | `almonds.png` | 杏仁 | a small pile of almonds |
| 53 | `walnuts.png` | 核桃 | two walnuts, one cracked open |
| 54 | `cashews.png` | 腰果（生） | a small pile of cashews |
| 55 | `flaxseed.png` | 亚麻籽 | a small pile of brown flaxseeds |
| 56 | `chia_seeds.png` | 奇亚籽 | a small pile of chia seeds |
| 57 | `olive_oil.png` | 橄榄油 | a small bottle of olive oil |
