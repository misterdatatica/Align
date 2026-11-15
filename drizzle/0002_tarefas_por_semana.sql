ALTER TABLE `definicoes` ADD `lembrete_ativo` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tarefas` ADD `semana_inicio` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tarefas` ADD `semana_fim` text;--> statement-breakpoint
CREATE INDEX `blocos_tarefa_semana_idx` ON `blocos` (`tarefa_semana_id`);--> statement-breakpoint
CREATE INDEX `tarefas_semana_tarefa_idx` ON `tarefas_semana` (`tarefa_id`);