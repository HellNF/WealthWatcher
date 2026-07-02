CREATE TABLE `fx_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`base` text DEFAULT 'EUR' NOT NULL,
	`quote` text NOT NULL,
	`rate` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fx_history_date_base_quote_uniq` ON `fx_history` (`date`,`base`,`quote`);--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` integer NOT NULL,
	`date` text NOT NULL,
	`price` text NOT NULL,
	`currency` text NOT NULL,
	`source` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_history_instrument_date_uniq` ON `price_history` (`instrument_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_price_history_instrument` ON `price_history` (`instrument_id`);--> statement-breakpoint
CREATE TABLE `valuation_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`date` text NOT NULL,
	`net_worth_eur_minor` integer NOT NULL,
	`investments_eur_minor` integer NOT NULL,
	`accounts_eur_minor` integer NOT NULL,
	`breakdown` text,
	`stale` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `valuation_snapshots_owner_date_uniq` ON `valuation_snapshots` (`owner_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_valuation_snapshots_owner_date` ON `valuation_snapshots` (`owner_id`,`date`);