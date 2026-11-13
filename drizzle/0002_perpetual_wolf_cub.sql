CREATE TABLE `snoozes` (
	`action_id` text PRIMARY KEY NOT NULL,
	`until` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `follow_up_at` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `follow_up_note` text;--> statement-breakpoint
ALTER TABLE `loops` ADD `checked` text;