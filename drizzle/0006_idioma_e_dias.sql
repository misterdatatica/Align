ALTER TABLE `definicoes` ADD `idioma` text DEFAULT 'automatico' NOT NULL;--> statement-breakpoint
ALTER TABLE `tarefas` ADD `dia` integer;--> statement-breakpoint
ALTER TABLE `tarefas_semana` ADD `dia` text;