ALTER TABLE `diary_entries` ADD `food_category` text;--> statement-breakpoint
ALTER TABLE `foods` ADD `category` text;--> statement-breakpoint
ALTER TABLE `foods` ADD `suggest_portion_id` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `meal_share_breakfast` integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `meal_share_lunch` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `meal_share_dinner` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `meal_share_snack` integer DEFAULT 15 NOT NULL;