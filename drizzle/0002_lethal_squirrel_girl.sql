CREATE TABLE `instruments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`isin` text,
	`name` text NOT NULL,
	`cluster` text NOT NULL,
	`currency` text NOT NULL,
	`ter` text,
	`price_source` text DEFAULT 'yahoo' NOT NULL,
	`provider_symbol` text,
	`last_price` text,
	`last_price_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instruments_symbol_uniq` ON `instruments` (`symbol`);--> statement-breakpoint
CREATE TABLE `investment_portfolios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`institution_id` integer NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_investment_portfolios_owner` ON `investment_portfolios` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_investment_portfolios_institution` ON `investment_portfolios` (`institution_id`);--> statement-breakpoint
CREATE TABLE `investment_txns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`portfolio_id` integer NOT NULL,
	`instrument_id` integer NOT NULL,
	`type` text NOT NULL,
	`trade_date` text NOT NULL,
	`quantity` text,
	`unit_price` text,
	`fee_minor` integer DEFAULT 0 NOT NULL,
	`amount_minor` integer,
	`currency` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`portfolio_id`) REFERENCES `investment_portfolios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_investment_txns_owner_date` ON `investment_txns` (`owner_id`,`trade_date`);--> statement-breakpoint
CREATE INDEX `idx_investment_txns_portfolio` ON `investment_txns` (`portfolio_id`);--> statement-breakpoint
CREATE INDEX `idx_investment_txns_instrument` ON `investment_txns` (`instrument_id`);