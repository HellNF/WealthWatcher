CREATE TABLE `financial_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`target_amount_minor` integer NOT NULL,
	`target_date` text,
	`current_allocated_minor` integer DEFAULT 0 NOT NULL,
	`color_hex` text DEFAULT '#3b82f6' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_financial_goals_owner` ON `financial_goals` (`owner_id`);--> statement-breakpoint
CREATE TABLE `mortgages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`initial_capital_minor` integer NOT NULL,
	`annual_interest_rate` text NOT NULL,
	`duration_months` integer NOT NULL,
	`start_date` text NOT NULL,
	`current_outstanding_override_minor` integer,
	`associated_account_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`associated_account_id`) REFERENCES `bank_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_mortgages_owner` ON `mortgages` (`owner_id`);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `irpef_marginal_rate` text;