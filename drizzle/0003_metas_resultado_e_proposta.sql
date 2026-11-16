CREATE TABLE `metas_registos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meta_id` integer NOT NULL,
	`data` text NOT NULL,
	`valor` real NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`meta_id`) REFERENCES `metas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metas_registos_meta_data_idx` ON `metas_registos` (`meta_id`,`data`);--> statement-breakpoint
CREATE TABLE `semanas` (
	`semana` text PRIMARY KEY NOT NULL,
	`estado` text NOT NULL,
	`origem` text,
	`origem_semana` text,
	`modelo` integer DEFAULT false NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `metas` ADD `prazo` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `metas` ADD `medida` text DEFAULT 'marco' NOT NULL;--> statement-breakpoint
ALTER TABLE `metas` ADD `valor_inicial` real;--> statement-breakpoint
ALTER TABLE `metas` ADD `valor_atual` real;--> statement-breakpoint
ALTER TABLE `metas` ADD `valor_alvo` real;--> statement-breakpoint
ALTER TABLE `metas` ADD `estado` text DEFAULT 'ativa' NOT NULL;--> statement-breakpoint
UPDATE `metas` SET
	`descricao` = `descricao` || ' — ' || CASE `tipo`
		WHEN 'horas' THEN replace(printf('%g', round(CASE `periodo` WHEN 'dia' THEN `alvo_semanal` / 7.0 ELSE `alvo_semanal` END, 2)), '.', ',') || ' h por ' || `periodo`
		ELSE printf('%g', round(CASE `periodo` WHEN 'dia' THEN `alvo_semanal` / 7.0 ELSE `alvo_semanal` END, 2)) || '× por ' || `periodo` || CASE WHEN `unidade` IS NULL THEN '' ELSE ' (' || `unidade` || ')' END
	END,
	`prazo` = date('now', 'localtime', '+3 months'),
	`estado` = 'pausada',
	`unidade` = NULL;--> statement-breakpoint
ALTER TABLE `metas` DROP COLUMN `tipo`;--> statement-breakpoint
ALTER TABLE `metas` DROP COLUMN `alvo_semanal`;--> statement-breakpoint
ALTER TABLE `metas` DROP COLUMN `periodo`;--> statement-breakpoint
ALTER TABLE `tarefas` ADD `serie_id` integer;--> statement-breakpoint
UPDATE `tarefas` SET `serie_id` = (
	SELECT coalesce(`a`.`serie_id`, `a`.`id`) FROM `tarefas` `a`
	WHERE `a`.`id` < `tarefas`.`id` AND `a`.`area_id` = `tarefas`.`area_id` AND `a`.`nome` = `tarefas`.`nome`
		AND `a`.`semana_fim` IS NOT NULL AND `a`.`semana_fim` = `tarefas`.`semana_inicio`
	ORDER BY `a`.`id` DESC LIMIT 1
);--> statement-breakpoint
ALTER TABLE `tarefas_semana` ADD `habitual_inicio` text;--> statement-breakpoint
ALTER TABLE `tarefas_semana` ADD `habitual_fim` text;--> statement-breakpoint
INSERT INTO `semanas` (`semana`, `estado`)
	SELECT DISTINCT `ts`.`semana`, 'aceite' FROM `tarefas_semana` `ts`
	WHERE `ts`.`semana` <= date('now', 'localtime', 'weekday 0', '-6 days')
		OR EXISTS (SELECT 1 FROM `blocos` `b` INNER JOIN `tarefas_semana` `t2` ON `b`.`tarefa_semana_id` = `t2`.`id` WHERE `t2`.`semana` = `ts`.`semana`);--> statement-breakpoint
INSERT OR IGNORE INTO `semanas` (`semana`, `estado`)
	SELECT DISTINCT date(substr(`inicio`, 1, 10), 'weekday 0', '-6 days'), 'aceite' FROM `blocos` WHERE `tarefa_semana_id` IS NULL;
