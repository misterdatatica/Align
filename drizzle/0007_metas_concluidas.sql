ALTER TABLE `metas` ADD `concluida_em` text;--> statement-breakpoint
-- As metas já concluídas ficam com a data da última alteração, a melhor aproximação que há.
UPDATE `metas` SET `concluida_em` = `atualizado_em` WHERE `estado` = 'concluida';