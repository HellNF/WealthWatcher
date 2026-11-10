ALTER TABLE `price_history` ADD `kind` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `price_history` ADD `retrieved_at` integer;