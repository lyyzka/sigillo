ALTER TABLE `oauth_client` ADD `client_discovery_id` text;--> statement-breakpoint
ALTER TABLE `oauth_client` ADD `client_credentials_scopes` text;--> statement-breakpoint
ALTER TABLE `oauth_client` ADD `backchannel_logout_uri` text;--> statement-breakpoint
ALTER TABLE `oauth_client` ADD `backchannel_logout_session_required` integer;--> statement-breakpoint
ALTER TABLE `oauth_client` ADD `application_type` text;--> statement-breakpoint
ALTER TABLE `oauth_client` ADD `dpop_bound_access_tokens` integer DEFAULT false;
