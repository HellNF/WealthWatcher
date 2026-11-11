DROP INDEX `category_rules_owner_pattern_uniq`;--> statement-breakpoint
ALTER TABLE `category_rules` ADD `bank_account_id` integer REFERENCES bank_accounts(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `category_rules` ADD `direction` text;