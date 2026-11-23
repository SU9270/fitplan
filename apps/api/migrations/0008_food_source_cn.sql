-- Rebuild `foods` so its CHECK constraints allow the `cn_fct` source (China Food Composition
-- Table foods that USDA SR Legacy lacks). SQLite cannot change a CHECK in place.
--
-- Hand-edited from the drizzle-kit output: D1 runs a migration in a transaction, where
-- `PRAGMA foreign_keys=OFF` has no effect, so DROP TABLE `foods` fires every ON DELETE action
-- pointing at it (portions and favorites are deleted; diary entries and saved meal items lose
-- their food and portion links). Those rows are copied aside first and put back afterwards;
-- test/food-source-migration.test.ts checks this.
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__bk_food_portions` AS SELECT `id`, `food_id`, `label`, `grams`, `sort_order` FROM `food_portions`;--> statement-breakpoint
CREATE TABLE `__bk_favorite_foods` AS SELECT `user_id`, `food_id`, `created_at` FROM `favorite_foods`;--> statement-breakpoint
CREATE TABLE `__bk_diary_links` AS SELECT `id`, `food_id`, `portion_id` FROM `diary_entries` WHERE `food_id` IS NOT NULL OR `portion_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__bk_template_links` AS SELECT `id`, `food_id`, `portion_id` FROM `meal_template_items` WHERE `food_id` IS NOT NULL OR `portion_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__new_foods` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`fdc_id` integer,
	`owner_user_id` text,
	`name` text NOT NULL,
	`name_zh` text,
	`aliases` text,
	`search_text` text NOT NULL,
	`category` text,
	`suggest_portion_id` text,
	`kcal` real,
	`protein_g` real,
	`carbs_g` real,
	`fat_g` real,
	`fiber_g` real,
	`sugars_g` real,
	`sodium_mg` real,
	`omega3_ala_g` real,
	`omega3_epa_dha_g` real,
	`library_key` text,
	`library_rank` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "foods_source_check" CHECK("source" IN ('usda_sr_legacy', 'cn_fct', 'custom')),
	CONSTRAINT "foods_source_owner_check" CHECK(("source" = 'custom' AND "owner_user_id" IS NOT NULL AND "fdc_id" IS NULL) OR ("source" = 'usda_sr_legacy' AND "owner_user_id" IS NULL AND "fdc_id" IS NOT NULL) OR ("source" = 'cn_fct' AND "owner_user_id" IS NULL AND "fdc_id" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_foods`("id", "source", "fdc_id", "owner_user_id", "name", "name_zh", "aliases", "search_text", "category", "suggest_portion_id", "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugars_g", "sodium_mg", "omega3_ala_g", "omega3_epa_dha_g", "library_key", "library_rank", "created_at", "updated_at") SELECT "id", "source", "fdc_id", "owner_user_id", "name", "name_zh", "aliases", "search_text", "category", "suggest_portion_id", "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugars_g", "sodium_mg", "omega3_ala_g", "omega3_epa_dha_g", "library_key", "library_rank", "created_at", "updated_at" FROM `foods`;--> statement-breakpoint
DROP TABLE `foods`;--> statement-breakpoint
ALTER TABLE `__new_foods` RENAME TO `foods`;--> statement-breakpoint
CREATE UNIQUE INDEX `foods_fdc_id_unique` ON `foods` (`fdc_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `foods_library_key_unique` ON `foods` (`library_key`);--> statement-breakpoint
CREATE INDEX `foods_owner_idx` ON `foods` (`owner_user_id`);--> statement-breakpoint
-- OR IGNORE: where the drop did not cascade (foreign keys off), the rows are still there.
INSERT OR IGNORE INTO `food_portions` (`id`, `food_id`, `label`, `grams`, `sort_order`) SELECT `id`, `food_id`, `label`, `grams`, `sort_order` FROM `__bk_food_portions`;--> statement-breakpoint
INSERT OR IGNORE INTO `favorite_foods` (`user_id`, `food_id`, `created_at`) SELECT `user_id`, `food_id`, `created_at` FROM `__bk_favorite_foods`;--> statement-breakpoint
UPDATE `diary_entries` SET `food_id` = b.`food_id`, `portion_id` = b.`portion_id` FROM `__bk_diary_links` AS b WHERE `diary_entries`.`id` = b.`id`;--> statement-breakpoint
UPDATE `meal_template_items` SET `food_id` = b.`food_id`, `portion_id` = b.`portion_id` FROM `__bk_template_links` AS b WHERE `meal_template_items`.`id` = b.`id`;--> statement-breakpoint
DROP TABLE `__bk_food_portions`;--> statement-breakpoint
DROP TABLE `__bk_favorite_foods`;--> statement-breakpoint
DROP TABLE `__bk_diary_links`;--> statement-breakpoint
DROP TABLE `__bk_template_links`;--> statement-breakpoint
PRAGMA defer_foreign_keys = off;
