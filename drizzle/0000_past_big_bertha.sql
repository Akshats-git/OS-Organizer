CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` integer NOT NULL,
	`name` text NOT NULL,
	`handle` text,
	`role` text,
	`timezone` text,
	`notes` text,
	`last_contact_at` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repo_id` integer NOT NULL,
	`loop_id` integer,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`actor` text,
	`source` text NOT NULL,
	`external_id` text,
	`occurred_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`loop_id`) REFERENCES `loops`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_external_id_unique` ON `events` (`external_id`);--> statement-breakpoint
CREATE TABLE `inbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`url` text,
	`author` text,
	`context` text,
	`discord_guild_id` text,
	`repo_id` integer,
	`status` text DEFAULT 'new' NOT NULL,
	`received_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inbox_source_external` ON `inbox` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `loops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repo_id` integer NOT NULL,
	`title` text NOT NULL,
	`stage` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`ask_url` text,
	`asked_at` text,
	`approved_by` text,
	`approval_url` text,
	`approved_at` text,
	`issue_number` integer,
	`issue_at` text,
	`pr_number` integer,
	`pr_at` text,
	`review_state` text,
	`ci_state` text,
	`has_conflict` integer DEFAULT false NOT NULL,
	`last_maintainer_at` text,
	`collision_url` text,
	`merged_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `orgs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`program_id` text,
	`website` text,
	`chat_platform` text,
	`chat_url` text,
	`discord_guild_id` text,
	`ideas_url` text,
	`notes` text,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orgs_slug_unique` ON `orgs` (`slug`);--> statement-breakpoint
CREATE TABLE `program_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`estimated` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `programs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`summary` text
);
--> statement-breakpoint
CREATE TABLE `repos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` integer NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`code` text NOT NULL,
	`color_index` integer DEFAULT 0 NOT NULL,
	`workflow` text DEFAULT 'ask-first' NOT NULL,
	`stale_days` integer DEFAULT 5 NOT NULL,
	`claim_days` integer DEFAULT 7 NOT NULL,
	`discord_channel_url` text,
	`rules` text,
	`setup_notes` text,
	`median_review_hours` real,
	`last_synced_at` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repos_slug_unique` ON `repos` (`slug`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
