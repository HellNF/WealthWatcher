ALTER TABLE `user_settings` ADD `tax_residency` text DEFAULT 'IT';--> statement-breakpoint
ALTER TABLE `user_settings` ADD `birth_date` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `employment_type` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `capital_gains_regime` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `annual_gross_income_minor` integer;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `forfettario_coefficient` integer;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `forfettario_startup` integer DEFAULT 0;