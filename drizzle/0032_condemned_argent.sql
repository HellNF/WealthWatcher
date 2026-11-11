CREATE TABLE `transfer_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`outflow_id` integer NOT NULL,
	`inflow_id` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`outflow_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inflow_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transfer_links_pair_uniq` ON `transfer_links` (`outflow_id`,`inflow_id`);--> statement-breakpoint
CREATE INDEX `idx_transfer_links_owner` ON `transfer_links` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_transfer_links_inflow` ON `transfer_links` (`inflow_id`);