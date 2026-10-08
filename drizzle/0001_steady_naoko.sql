ALTER TABLE `repos` ADD `program_id` text REFERENCES programs(id);--> statement-breakpoint
-- Existing repos inherit the program from their org, which is where it used to live.
UPDATE `repos` SET `program_id` = (SELECT `program_id` FROM `orgs` WHERE `orgs`.`id` = `repos`.`org_id`) WHERE `program_id` IS NULL;
