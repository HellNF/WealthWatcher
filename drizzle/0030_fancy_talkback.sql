CREATE TABLE `etf_profiles` (
	`isin` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`retrieved_at` integer NOT NULL,
	`profile_json` text NOT NULL,
	`performance_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` integer NOT NULL,
	`price` text NOT NULL,
	`currency` text NOT NULL,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`observed_at` integer NOT NULL,
	`retrieved_at` integer NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_observation_uniq` ON `price_observations` (`instrument_id`,`source`,`kind`,`observed_at`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `category_source` text DEFAULT 'legacy' NOT NULL;