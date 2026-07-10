CREATE TABLE `asset_valuations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`date` text NOT NULL,
	`value_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`source` text,
	`sample_size` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_valuations_asset_date_uniq` ON `asset_valuations` (`asset_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_asset_valuations_asset` ON `asset_valuations` (`asset_id`);--> statement-breakpoint
CREATE TABLE `vehicle_details` (
	`asset_id` integer PRIMARY KEY NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`year` integer NOT NULL,
	`fuel` text,
	`gearbox` text,
	`mileage_km` integer NOT NULL,
	`annual_km` integer,
	`auto_estimate` integer DEFAULT 1 NOT NULL,
	`last_estimate_at` integer,
	`last_estimate_source` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
