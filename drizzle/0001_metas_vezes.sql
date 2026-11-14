PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tarefas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer NOT NULL,
	`meta_id` integer,
	`nome` text NOT NULL,
	`nome_curto` text,
	`duracao_min` integer,
	`recorrencia` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meta_id`) REFERENCES `metas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_tarefas`("id", "area_id", "meta_id", "nome", "nome_curto", "duracao_min", "recorrencia", "criado_em", "atualizado_em") SELECT "id", "area_id", "meta_id", "nome", "nome_curto", "duracao_min", "recorrencia", "criado_em", "atualizado_em" FROM `tarefas`;--> statement-breakpoint
DROP TABLE `tarefas`;--> statement-breakpoint
ALTER TABLE `__new_tarefas` RENAME TO `tarefas`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `tarefas_area_idx` ON `tarefas` (`area_id`);--> statement-breakpoint
ALTER TABLE `metas` ADD `periodo` text DEFAULT 'semana' NOT NULL;--> statement-breakpoint
ALTER TABLE `metas` ADD `unidade` text;