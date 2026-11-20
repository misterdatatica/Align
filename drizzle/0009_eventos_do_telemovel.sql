ALTER TABLE `blocos` ADD `evento_id` text;--> statement-breakpoint
ALTER TABLE `definicoes` ADD `eventos_telemovel` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `definicoes` ADD `calendarios_escondidos` text;