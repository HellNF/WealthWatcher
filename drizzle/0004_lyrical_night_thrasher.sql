CREATE TABLE `kid_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`instrument_id` integer,
	`filename` text NOT NULL,
	`extracted_json` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`model` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`openai_api_key_enc` text,
	`openai_key_set_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `instruments` ADD `sri` integer;--> statement-breakpoint
ALTER TABLE `instruments` ADD `entry_cost` text;--> statement-breakpoint
ALTER TABLE `instruments` ADD `exit_cost` text;