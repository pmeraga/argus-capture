CREATE TABLE `episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `episodes_owner_idx` ON `episodes` (`owner`);