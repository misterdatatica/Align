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

/**
 * Um resultado a alcançar até uma data ("Conseguir meditar 1 h seguida até 31 mar 2027").
 * Diz onde se quer chegar, não o que se faz: o tempo semanal vive nas tarefas e nos blocos.
 */
export const metas = sqliteTable(
  'metas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    areaId: integer('area_id')
      .notNull()
      .references(() => areas.id, { onDelete: 'cascade' }),
    descricao: text('descricao').notNull(),
    /** Dia até ao qual se quer lá chegar, AAAA-MM-DD. */
    prazo: text('prazo').notNull(),
    /** "numero" mede-se com um valor (20 → 60 min seguidos); "marco" é sim ou não. */
    medida: text('medida', { enum: ['numero', 'marco'] }).notNull(),
    /** Só nas metas de número. O alvo pode ficar abaixo do valor inicial (55 → 50 min, 80 → 75 kg). */
    valorInicial: real('valor_inicial'),
    valorAtual: real('valor_atual'),
    valorAlvo: real('valor_alvo'),
    /** Unidade das metas de número (ex.: "min seguidos", "km", "kg"); null = sem unidade. */
    unidade: text('unidade'),
    /** Só as ativas contam para o limite de 3 por área. Pausar não apaga nada. */
    estado: text('estado', { enum: ['ativa', 'concluida', 'pausada', 'abandonada'] })
      .notNull()
      .default('ativa'),
    /** Quando foi concluída (ISO); null enquanto não está concluída. Para as estatísticas. */
    concluidaEm: text('concluida_em'),
    ...timestamps,
  },
  (t) => [index('metas_area_idx').on(t.areaId)],
);

/** Histórico das metas de número: uma linha por dia em que o valor foi atualizado. */
export const metasRegistos = sqliteTable(
  'metas_registos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    metaId: integer('meta_id')
      .notNull()
      .references(() => metas.id, { onDelete: 'cascade' }),
    /** Dia da atualização, AAAA-MM-DD. */
    data: text('data').notNull(),
    valor: real('valor').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('metas_registos_meta_data_idx').on(t.metaId, t.data)],
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
    /**
     * Id da primeira versão da tarefa; null = esta é a primeira. Alterar uma tarefa com histórico cria
     * uma versão nova, e é por aqui que se sabe que "Meditar" de hoje é a mesma de há um mês.
     */
    serieId: integer('serie_id'),
    /**
     * Só nas tarefas únicas sem duração: dia da semana em que se fazem (0 = segunda … 6 = domingo);
     * null = qualquer dia. As que repetem em dias certos (ou todos os dias) já dizem os dias na recorrência.
     */
    dia: integer('dia'),
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
    /**
     * Horário habitual (AAAA-MM-DDTHH:MM, nesta semana) quando esta semana é uma exceção: o bloco foi
     * mudado ou retirado "só esta semana". A semana seguinte copia o habitual, não a exceção.
     */
    habitualInicio: text('habitual_inicio'),
    habitualFim: text('habitual_fim'),
    /**
     * Dia (AAAA-MM-DD) desta instância, nas tarefas sem duração que têm dias: todos os dias, dias certos
     * ou o dia escolhido. null = qualquer dia da semana (ou tarefa com duração: o dia é o do bloco).
     */
    dia: text('dia'),
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
    /**
     * Nos blocos "Ocupado" que vêm de um evento do calendário do telemóvel (WeekAlign Plus): a chave do
     * evento e do dia. São só para ver, não se copiam para a semana seguinte e não vão na cópia de
     * segurança. null = criado na app.
     */
    eventoId: text('evento_id'),
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

/**
 * O plano de uma semana. Sem linha, a semana ainda não foi planeada; "rascunho" é a proposta
 * (cópia de outra semana) à espera de "Aceitar semana".
 */
export const semanas = sqliteTable('semanas', {
  /** Segunda-feira da semana, AAAA-MM-DD. */
  semana: text('semana').primaryKey(),
  estado: text('estado', { enum: ['rascunho', 'aceite'] }).notNull(),
  /** De onde veio a proposta. */
  origem: text('origem', { enum: ['passada', 'modelo', 'vazia'] }),
  /** A semana copiada (segunda-feira), quando houve cópia. */
  origemSemana: text('origem_semana'),
  /** Semana modelo: a que o utilizador marcou como típica. Só há uma de cada vez. */
  modelo: integer('modelo', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

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
  /** Quando foi exportada a última cópia de segurança (ISO); null = nunca. */
  ultimaCopia: text('ultima_copia'),
  /** Aparência: segue o telemóvel, ou fica sempre clara ou escura. */
  tema: text('tema', { enum: ['automatico', 'claro', 'escuro'] })
    .notNull()
    .default('automatico'),
  /** Idioma: o do telemóvel, ou sempre português ou inglês. */
  idioma: text('idioma', { enum: ['automatico', 'pt', 'en'] })
    .notNull()
    .default('automatico'),
  /** Avisos dos blocos (WeekAlign Plus): uma notificação antes de cada bloco das tarefas. */
  avisosBlocos: integer('avisos_blocos', { mode: 'boolean' }).notNull().default(false),
  /** Quantos minutos antes do bloco chega o aviso. */
  minutosAntes: integer('minutos_antes').notNull().default(10),
  /** Mostrar os eventos dos calendários do telemóvel como "Ocupado" (WeekAlign Plus). */
  eventosTelemovel: integer('eventos_telemovel', { mode: 'boolean' }).notNull().default(false),
  /** Os calendários do telemóvel que o utilizador escondeu (ids); null = nenhum. Os novos aparecem. */
  calendariosEscondidos: text('calendarios_escondidos', { mode: 'json' }).$type<string[]>(),
  ...timestamps,
});

export type Area = typeof areas.$inferSelect;
export type NovaArea = typeof areas.$inferInsert;
export type Meta = typeof metas.$inferSelect;
export type MetaRegisto = typeof metasRegistos.$inferSelect;
export type Semana = typeof semanas.$inferSelect;
export type Tarefa = typeof tarefas.$inferSelect;
export type TarefaSemana = typeof tarefasSemana.$inferSelect;
export type Bloco = typeof blocos.$inferSelect;
export type Revisao = typeof revisoes.$inferSelect;
export type Definicoes = typeof definicoes.$inferSelect;
export type EstadoTarefaSemana = TarefaSemana['estado'];
