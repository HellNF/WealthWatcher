CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'cash' NOT NULL,
	`value_minor` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`note` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_assets_owner` ON `assets` (`owner_id`);--> statement-breakpoint
ALTER TABLE `valuation_snapshots` ADD `other_assets_eur_minor` integer DEFAULT 0 NOT NULL;