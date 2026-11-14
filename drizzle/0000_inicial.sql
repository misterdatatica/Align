CREATE TABLE `areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`cor` text NOT NULL,
	`icone` text NOT NULL,
	`missao` text DEFAULT '' NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	`arquivada` integer DEFAULT false NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `blocos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tarefa_semana_id` integer,
	`titulo` text,
	`inicio` text NOT NULL,
	`fim` text NOT NULL,
	`feito` integer DEFAULT false NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tarefa_semana_id`) REFERENCES `tarefas_semana`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `blocos_inicio_idx` ON `blocos` (`inicio`);--> statement-breakpoint
CREATE TABLE `definicoes` (
	`id` integer PRIMARY KEY NOT NULL,
	`dia_revisao` integer DEFAULT 0 NOT NULL,
	`hora_revisao` text DEFAULT '18:00' NOT NULL,
	`inicio_grelha` integer DEFAULT 6 NOT NULL,
	`fim_grelha` integer DEFAULT 23 NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `metas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer NOT NULL,
	`descricao` text NOT NULL,
	`tipo` text NOT NULL,
	`alvo_semanal` real NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `metas_area_idx` ON `metas` (`area_id`);--> statement-breakpoint
CREATE TABLE `revisoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`semana` text NOT NULL,
	`correu_bem` text DEFAULT '' NOT NULL,
	`quero_mudar` text DEFAULT '' NOT NULL,
	`fechada_em` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revisoes_semana_idx` ON `revisoes` (`semana`);--> statement-breakpoint
CREATE TABLE `tarefas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer NOT NULL,
	`meta_id` integer,
	`nome` text NOT NULL,
	`nome_curto` text,
	`duracao_min` integer NOT NULL,
	`recorrencia` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meta_id`) REFERENCES `metas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tarefas_area_idx` ON `tarefas` (`area_id`);--> statement-breakpoint
CREATE TABLE `tarefas_semana` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tarefa_id` integer NOT NULL,
	`semana` text NOT NULL,
	`estado` text DEFAULT 'por_alocar' NOT NULL,
	`transitada_de` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tarefa_id`) REFERENCES `tarefas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tarefas_semana_semana_idx` ON `tarefas_semana` (`semana`);