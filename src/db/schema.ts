import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { Recorrencia } from '../domain/recorrencia';

// Shared columns. Timestamps are ISO strings, set by SQLite on insert.
const timestamps = {
  criadoEm: text('criado_em').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  atualizadoEm: text('atualizado_em').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
};

/** Uma responsabilidade da vida (Espiritual, Família…). Máximo 7 ativas. */
export const areas = sqliteTable('areas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull(),
  cor: text('cor').notNull(),
  icone: text('icone').notNull(),
  missao: text('missao').notNull().default(''),
  ordem: integer('ordem').notNull().default(0),
  arquivada: integer('arquivada', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

/** O que se mede, sempre guardado como alvo semanal. */
export const metas = sqliteTable(
  'metas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    areaId: integer('area_id')
      .notNull()
      .references(() => areas.id, { onDelete: 'cascade' }),
    descricao: text('descricao').notNull(),
    tipo: text('tipo', { enum: ['horas', 'vezes'] }).notNull(),
    /** Horas por semana (tipo "horas") ou ocorrências por semana (tipo "vezes"). */
    alvoSemanal: real('alvo_semanal').notNull(),
    /** Como o utilizador a definiu ("1 por dia" ou "3 por semana"); só afeta a apresentação. */
    periodo: text('periodo', { enum: ['dia', 'semana'] }).notNull().default('semana'),
    /** Unidade das metas de vezes, no singular (ex.: "lição"); null = "vezes". */
    unidade: text('unidade'),
    ...timestamps,
  },
  (t) => [index('metas_area_idx').on(t.areaId)],
);

/** Modelo de uma tarefa; a recorrência gera instâncias por semana. */
export const tarefas = sqliteTable(
  'tarefas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    areaId: integer('area_id')
      .notNull()
      .references(() => areas.id, { onDelete: 'cascade' }),
    metaId: integer('meta_id').references(() => metas.id, { onDelete: 'set null' }),
    nome: text('nome').notNull(),
    nomeCurto: text('nome_curto'),
    /** Minutos no calendário; null = não ocupa tempo (ex.: "Lição ACIM" conta só quando é feita). */
    duracaoMin: integer('duracao_min'),
    /** JSON de `Recorrencia` (ver src/domain/recorrencia.ts); null = tarefa única. */
    recorrencia: text('recorrencia', { mode: 'json' }).$type<Recorrencia>(),
    /** Primeira semana (segunda-feira, AAAA-MM-DD) em que a tarefa existe. */
    semanaInicio: text('semana_inicio').notNull().default(''),
    /**
     * Primeira semana em que a tarefa já não se aplica; null = continua.
     * Apagar ou alterar uma tarefa "a partir desta semana" fecha-a aqui, para o histórico não mudar.
     */
    semanaFim: text('semana_fim'),
    ...timestamps,
  },
  (t) => [index('tarefas_area_idx').on(t.areaId)],
);

/** Uma tarefa numa semana concreta. */
export const tarefasSemana = sqliteTable(
  'tarefas_semana',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tarefaId: integer('tarefa_id')
      .notNull()
      .references(() => tarefas.id, { onDelete: 'cascade' }),
    /** Segunda-feira da semana, AAAA-MM-DD. */
    semana: text('semana').notNull(),
    estado: text('estado', { enum: ['por_alocar', 'alocada', 'feita', 'nao_feita'] })
      .notNull()
      .default('por_alocar'),
    /** Semana de onde transitou, se veio da revisão. */
    transitadaDe: text('transitada_de'),
    ...timestamps,
  },
  (t) => [index('tarefas_semana_semana_idx').on(t.semana), index('tarefas_semana_tarefa_idx').on(t.tarefaId)],
);

/** Um bloco no calendário. Sem tarefa = bloco "Ocupado". */
export const blocos = sqliteTable(
  'blocos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tarefaSemanaId: integer('tarefa_semana_id').references(() => tarefasSemana.id, { onDelete: 'cascade' }),
    titulo: text('titulo'),
    /** Data e hora locais, AAAA-MM-DDTHH:MM. */
    inicio: text('inicio').notNull(),
    fim: text('fim').notNull(),
    feito: integer('feito', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index('blocos_inicio_idx').on(t.inicio), index('blocos_tarefa_semana_idx').on(t.tarefaSemanaId)],
);

/** Revisão de domingo, uma por semana. */
export const revisoes = sqliteTable(
  'revisoes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    semana: text('semana').notNull(),
    correuBem: text('correu_bem').notNull().default(''),
    queroMudar: text('quero_mudar').notNull().default(''),
    fechadaEm: text('fechada_em'),
    ...timestamps,
  },
  (t) => [uniqueIndex('revisoes_semana_idx').on(t.semana)],
);

/** Registo único de definições. */
export const definicoes = sqliteTable('definicoes', {
  id: integer('id').primaryKey(),
  /** 0 = domingo … 6 = sábado. */
  diaRevisao: integer('dia_revisao').notNull().default(0),
  horaRevisao: text('hora_revisao').notNull().default('18:00'),
  inicioGrelha: integer('inicio_grelha').notNull().default(6),
  fimGrelha: integer('fim_grelha').notNull().default(23),
  /** Lembrete local da revisão; só fica ativo depois de o utilizador dar permissão. */
  lembreteAtivo: integer('lembrete_ativo', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

export type Area = typeof areas.$inferSelect;
export type NovaArea = typeof areas.$inferInsert;
export type Meta = typeof metas.$inferSelect;
export type Tarefa = typeof tarefas.$inferSelect;
export type TarefaSemana = typeof tarefasSemana.$inferSelect;
export type Bloco = typeof blocos.$inferSelect;
export type Revisao = typeof revisoes.$inferSelect;
export type Definicoes = typeof definicoes.$inferSelect;
export type EstadoTarefaSemana = TarefaSemana['estado'];
