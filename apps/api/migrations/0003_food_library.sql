CREATE TABLE `diary_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`meal` text NOT NULL,
	`food_id` text,
	`food_name` text NOT NULL,
	`food_name_zh` text,
	`portion_id` text,
	`portion_label` text,
	`quantity` real NOT NULL,
	`grams` real NOT NULL,
	`kcal` real,
	`protein_g` real,
	`carbs_g` real,
	`fat_g` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`portion_id`) REFERENCES `food_portions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "diary_entries_meal_check" CHECK("diary_entries"."meal" IN ('breakfast', 'lunch', 'dinner', 'snack')),
	CONSTRAINT "diary_entries_grams_check" CHECK("diary_entries"."grams" > 0),
	CONSTRAINT "diary_entries_quantity_check" CHECK("diary_entries"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `diary_entries_user_date_idx` ON `diary_entries` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `food_portions` (
	`id` text PRIMARY KEY NOT NULL,
	`food_id` text NOT NULL,
	`label` text,
	`grams` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "food_portions_grams_check" CHECK("food_portions"."grams" > 0)
);
--> statement-breakpoint
CREATE INDEX `food_portions_food_idx` ON `food_portions` (`food_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`fdc_id` integer,
	`owner_user_id` text,
	`name` text NOT NULL,
	`name_zh` text,
	`aliases` text,
	`search_text` text NOT NULL,
	`kcal` real,
	`protein_g` real,
	`carbs_g` real,
	`fat_g` real,
	`fiber_g` real,
	`sugars_g` real,
	`sodium_mg` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "foods_source_check" CHECK("foods"."source" IN ('usda_sr_legacy', 'custom')),
	CONSTRAINT "foods_source_owner_check" CHECK(("foods"."source" = 'custom' AND "foods"."owner_user_id" IS NOT NULL AND "foods"."fdc_id" IS NULL) OR ("foods"."source" = 'usda_sr_legacy' AND "foods"."owner_user_id" IS NULL AND "foods"."fdc_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `foods_fdc_id_unique` ON `foods` (`fdc_id`);--> statement-breakpoint
CREATE INDEX `foods_owner_idx` ON `foods` (`owner_user_id`);