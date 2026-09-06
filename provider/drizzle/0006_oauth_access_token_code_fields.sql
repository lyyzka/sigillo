ALTER TABLE `oauth_access_token` ADD `authorization_code_id` text;--> statement-breakpoint
ALTER TABLE `oauth_access_token` ADD `requested_user_info_claims` text;--> statement-breakpoint
ALTER TABLE `oauth_access_token` ADD `confirmation` text;
