CREATE TABLE `eb_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`institution_id` integer NOT NULL,
	`aspsp_name` text NOT NULL,
	`aspsp_country` text NOT NULL,
	`session_id_enc` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`valid_until` integer,
	`state` text NOT NULL,
	`last_synced_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_eb_connections_owner` ON `eb_connections` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `eb_connections_state_uniq` ON `eb_connections` (`state`);--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `eb_account_uid` text;--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `eb_connection_id` integer REFERENCES eb_connections(id);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `eb_app_id` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `eb_private_key_enc` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `eb_key_set_at` integer;