CREATE TABLE `market_indicators` (
	`code` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
