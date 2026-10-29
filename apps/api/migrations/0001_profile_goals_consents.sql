CREATE TABLE `consents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`version` text NOT NULL,
	`granted` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "consents_kind_check" CHECK("consents"."kind" IN ('health_data')),
	CONSTRAINT "consents_granted_check" CHECK("consents"."granted" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `consents_user_created_idx` ON `consents` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `goal_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`effective_at` text NOT NULL,
	`input_snapshot` text NOT NULL,
	`status` text NOT NULL,
	`reasons` text NOT NULL,
	`bmi` real NOT NULL,
	`bmr_kcal` integer NOT NULL,
	`tdee_kcal` integer NOT NULL,
	`kcal` integer NOT NULL,
	`protein_g` integer NOT NULL,
	`carbs_g` integer NOT NULL,
	`fat_g` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "goal_versions_status_check" CHECK("goal_versions"."status" IN ('safe', 'confirm'))
);
--> statement-breakpoint
CREATE INDEX `goal_versions_user_effective_idx` ON `goal_versions` (`user_id`,`effective_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`birth_year` integer NOT NULL,
	`sex` text NOT NULL,
	`height_cm` real NOT NULL,
	`weight_kg` real NOT NULL,
	`activity_level` integer NOT NULL,
	`training_days_per_week` integer NOT NULL,
	`training_experience` text NOT NULL,
	`goal` text NOT NULL,
	`pace` text NOT NULL,
	`health_flags` text NOT NULL,
	`unit_system` text NOT NULL,
	`locale` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "profiles_sex_check" CHECK("profiles"."sex" IN ('male', 'female', 'unspecified')),
	CONSTRAINT "profiles_activity_level_check" CHECK("profiles"."activity_level" BETWEEN 1 AND 5),
	CONSTRAINT "profiles_training_days_check" CHECK("profiles"."training_days_per_week" BETWEEN 0 AND 7),
	CONSTRAINT "profiles_training_experience_check" CHECK("profiles"."training_experience" IN ('beginner', 'intermediate', 'advanced')),
	CONSTRAINT "profiles_goal_check" CHECK("profiles"."goal" IN ('lose', 'gain')),
	CONSTRAINT "profiles_pace_check" CHECK("profiles"."pace" IN ('conservative', 'standard', 'aggressive')),
	CONSTRAINT "profiles_unit_system_check" CHECK("profiles"."unit_system" IN ('metric', 'imperial')),
	CONSTRAINT "profiles_locale_check" CHECK("profiles"."locale" IN ('zh', 'en'))
);
