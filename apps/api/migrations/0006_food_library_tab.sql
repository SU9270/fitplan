ALTER TABLE `foods` ADD `omega3_ala_g` real;--> statement-breakpoint
ALTER TABLE `foods` ADD `omega3_epa_dha_g` real;--> statement-breakpoint
ALTER TABLE `foods` ADD `library_key` text;--> statement-breakpoint
ALTER TABLE `foods` ADD `library_rank` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `foods_library_key_unique` ON `foods` (`library_key`);