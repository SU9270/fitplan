CREATE TABLE `meal_template_items` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`position` integer NOT NULL,
	`food_id` text,
	`food_name` text NOT NULL,
	`food_name_zh` text,
	`food_category` text,
	`is_quick` integer DEFAULT false NOT NULL,
	`portion_id` text,
	`portion_label` text,
	`quantity` real NOT NULL,
	`grams` real NOT NULL,
	`kcal` real,
	`protein_g` real,
	`carbs_g` real,
	`fat_g` real,
	FOREIGN KEY (`template_id`) REFERENCES `meal_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`portion_id`) REFERENCES `food_portions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "meal_template_items_grams_check" CHECK("meal_template_items"."grams" > 0),
	CONSTRAINT "meal_template_items_quantity_check" CHECK("meal_template_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `meal_template_items_template_idx` ON `meal_template_items` (`template_id`,`position`);--> statement-breakpoint
CREATE TABLE `meal_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_templates_user_idx` ON `meal_templates` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `diary_entries` ADD `is_quick` integer DEFAULT false NOT NULL;