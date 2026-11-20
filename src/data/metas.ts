import { and, asc, count, desc, eq, exists, gt, gte, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { areas, metas, metasRegistos, tarefas, tarefasSemana, type Meta } from '@/db/schema';
import {
  MAX_METAS_ATIVAS,
  alvoAlcancado,
  diasQueFaltam,
  estagnada,
  normalizarMeta,
  podeAtivarMeta,
  progressoDaMeta,
  type DadosMeta,
  type EstadoMeta,
  type PontoDaLinha,
} from '@/domain/metas';
import type { Recorrencia } from '@/domain/recorrencia';
import { ErroDaApp } from '@/domain/erros';
import { t } from '@/i18n';

/*
 * Metas: resultados com prazo. Cada meta pertence a uma área (no máximo 3 ativas por área) e mede-se
 * com um número (valor inicial → alvo, com histórico) ou como um marco (alcançado ou não).
 * As tarefas podem ficar ligadas a uma meta; o tempo semanal vive só nas tarefas e nos blocos.
 */

type Bd = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>;

const AGORA = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export class LimiteDeMetasError extends ErroDaApp {
  constructor() {
    super(t('Cada área pode ter no máximo {max} metas ativas. Conclua, pause ou abandone uma para ativar outra.', { max: MAX_METAS_ATIVAS }));
  }
}

function contarAtivas(bd: Bd, areaId: number, exceto?: number): number {
  const filtro = and(eq(metas.areaId, areaId), eq(metas.estado, 'ativa'), exceto === undefined ? undefined : ne(metas.id, exceto));
  return bd.select({ n: count() }).from(metas).where(filtro).get()?.n ?? 0;
}

/** Cria uma meta ativa. Devolve o id. */
export function criarMeta(dados: DadosMeta & { areaId: number }): number {
  const d = normalizarMeta(dados);
  return db.transaction((tx) => {
    const area = tx.select({ arquivada: areas.arquivada }).from(areas).where(eq(areas.id, dados.areaId)).get();
    if (!area || area.arquivada) throw new ErroDaApp(t('A área desta meta já não existe.'));
    if (!podeAtivarMeta(contarAtivas(tx, dados.areaId))) throw new LimiteDeMetasError();
    return tx
      .insert(metas)
      .values({ ...d, areaId: dados.areaId, valorAtual: d.valorInicial, estado: 'ativa' })
      .returning({ id: metas.id })
      .get().id;
  });
}

/** Altera a descrição, o prazo e os valores. O tipo de medida não muda: o histórico deixaria de fazer sentido. */
export function atualizarMeta(id: number, dados: DadosMeta): void {
  db.transaction((tx) => {
    const atual = tx.select().from(metas).where(eq(metas.id, id)).get();
    if (!atual) throw new ErroDaApp(t('A meta já não existe.'));
    const d = normalizarMeta({ ...dados, medida: atual.medida });
    // Sem atualizações ainda, o valor atual é o ponto de partida.
    const registos = tx.select({ n: count() }).from(metasRegistos).where(eq(metasRegistos.metaId, id)).get()?.n ?? 0;
    tx.update(metas)
      .set({ ...d, valorAtual: registos === 0 ? d.valorInicial : atual.valorAtual, atualizadoEm: AGORA })
      .where(eq(metas.id, id))
      .run();
  });
}

function acertarValorAtual(bd: Bd, id: number) {
  const meta = bd.select({ valorInicial: metas.valorInicial }).from(metas).where(eq(metas.id, id)).get();
  const ultimo = bd.select({ valor: metasRegistos.valor }).from(metasRegistos).where(eq(metasRegistos.metaId, id)).orderBy(desc(metasRegistos.data)).limit(1).get();
  bd.update(metas)
    .set({ valorAtual: ultimo?.valor ?? meta?.valorInicial ?? null, atualizadoEm: AGORA })
    .where(eq(metas.id, id))
    .run();
}

/**
 * Regista o valor de uma meta de número num dia (AAAA-MM-DD). Cada atualização fica no histórico;
 * registar outra vez no mesmo dia corrige o valor desse dia.
 */
export function registarValor(id: number, valor: number, data: string): void {
  if (!Number.isFinite(valor)) throw new ErroDaApp(t('Indique um número.'));
  db.transaction((tx) => {
    const meta = tx.select({ medida: metas.medida }).from(metas).where(eq(metas.id, id)).get();
    if (!meta) throw new ErroDaApp(t('A meta já não existe.'));
    if (meta.medida !== 'numero') throw new ErroDaApp(t('Esta meta não se mede com um número.'));
    tx.insert(metasRegistos)
      .values({ metaId: id, data, valor })
      .onConflictDoUpdate({ target: [metasRegistos.metaId, metasRegistos.data], set: { valor, atualizadoEm: AGORA } })
      .run();
    acertarValorAtual(tx, id);
  });
}

/** Tira uma atualização do histórico (ex.: um valor escrito por engano). */
export function apagarRegisto(metaId: number, data: string): void {
  db.transaction((tx) => {
    tx.delete(metasRegistos)
      .where(and(eq(metasRegistos.metaId, metaId), eq(metasRegistos.data, data)))
      .run();
    acertarValorAtual(tx, metaId);
  });
}

/** Conclui, pausa, abandona ou volta a ativar. Nada se apaga: o histórico e as tarefas ligadas ficam. */
export function mudarEstadoDaMeta(id: number, estado: EstadoMeta): void {
  db.transaction((tx) => {
    const atual = tx.select({ areaId: metas.areaId, estado: metas.estado }).from(metas).where(eq(metas.id, id)).get();
    if (!atual) throw new ErroDaApp(t('A meta já não existe.'));
    if (atual.estado === estado) return;
    if (estado === 'ativa' && !podeAtivarMeta(contarAtivas(tx, atual.areaId, id))) throw new LimiteDeMetasError();
    tx.update(metas).set({ estado, atualizadoEm: AGORA }).where(eq(metas.id, id)).run();
  });
}

/** Apaga a meta e o seu histórico. As tarefas ligadas continuam a existir, sem meta. */
export function apagarMeta(id: number): void {
  db.delete(metas).where(eq(metas.id, id)).run();
}

/** As metas que se podem escolher numa tarefa: as ativas e as pausadas da área. */
export function metasParaTarefas(areaId: number): Pick<Meta, 'id' | 'descricao' | 'estado'>[] {
  return db
    .select({ id: metas.id, descricao: metas.descricao, estado: metas.estado })
    .from(metas)
    .where(and(eq(metas.areaId, areaId), inArray(metas.estado, ['ativa', 'pausada'])))
    .orderBy(asc(metas.id))
    .all();
}

export type TarefaLigada = {
  id: number;
  nome: string;
  duracaoMin: number | null;
  recorrencia: Recorrencia | null;
  /** Instâncias na semana pedida e quantas estão feitas (0 e 0 se a tarefa não está nessa semana). */
  total: number;
  feitas: number;
};

export type MetaDetalhada = Meta & {
  area: { id: number; nome: string; cor: string };
  /** Atualizações das metas de número, da mais antiga para a mais recente. */
  registos: PontoDaLinha[];
  /** Caminho feito, de 0 a 1. Num marco é 0 ou 1. */
  progresso: number;
  /** O número chegou ao alvo, ou o marco foi marcado como alcançado. */
  alcancada: boolean;
  /** 0 = termina hoje; negativo = o prazo já passou. */
  diasQueFaltam: number;
  /** Não avançou nas últimas 3 atualizações. */
  estagnada: boolean;
  /** Tarefas em vigor ligadas à meta, com o ponto em que estão na semana pedida. */
  tarefas: TarefaLigada[];
};

type MetaComArea = { meta: Meta; area: { id: number; nome: string; cor: string } };

function detalhar(lista: MetaComArea[], semana: string, hoje: string): MetaDetalhada[] {
  if (lista.length === 0) return [];
  const ids = lista.map((l) => l.meta.id);

  const registos = new Map<number, PontoDaLinha[]>();
  for (const r of db.select().from(metasRegistos).where(inArray(metasRegistos.metaId, ids)).orderBy(asc(metasRegistos.data)).all()) {
    const daMeta = registos.get(r.metaId) ?? [];
    daMeta.push({ data: r.data, valor: r.valor });
    registos.set(r.metaId, daMeta);
  }

  // Tarefas em vigor: as que repetem e as únicas que ainda têm lugar nesta semana ou numa seguinte.
  const ligadas = db
    .select({ id: tarefas.id, metaId: tarefas.metaId, nome: tarefas.nome, duracaoMin: tarefas.duracaoMin, recorrencia: tarefas.recorrencia })
    .from(tarefas)
    .where(
      and(
        inArray(tarefas.metaId, ids),
        or(isNull(tarefas.semanaFim), gt(tarefas.semanaFim, semana)),
        or(
          isNotNull(tarefas.recorrencia),
          exists(
            db
              .select({ um: sql`1` })
              .from(tarefasSemana)
              .where(and(eq(tarefasSemana.tarefaId, tarefas.id), gte(tarefasSemana.semana, semana))),
          ),
        ),
      ),
    )
    .orderBy(asc(tarefas.id))
    .all();
  const contagem = new Map<number, { total: number; feitas: number }>();
  if (ligadas.length > 0) {
    const instancias = db
      .select({ tarefaId: tarefasSemana.tarefaId, estado: tarefasSemana.estado })
      .from(tarefasSemana)
      .where(
        and(
          eq(tarefasSemana.semana, semana),
          inArray(
            tarefasSemana.tarefaId,
            ligadas.map((tf) => tf.id),
          ),
        ),
      )
      .all();
    for (const i of instancias) {
      const c = contagem.get(i.tarefaId) ?? { total: 0, feitas: 0 };
      c.total += 1;
      if (i.estado === 'feita') c.feitas += 1;
      contagem.set(i.tarefaId, c);
    }
  }

  return lista.map(({ meta, area }) => {
    const daMeta = registos.get(meta.id) ?? [];
    const numero = meta.medida === 'numero' && meta.valorInicial !== null && meta.valorAlvo !== null;
    const valores = numero ? { valorInicial: meta.valorInicial!, valorAtual: meta.valorAtual ?? meta.valorInicial!, valorAlvo: meta.valorAlvo! } : null;
    return {
      ...meta,
      area,
      registos: daMeta,
      progresso: valores ? progressoDaMeta(valores) : meta.estado === 'concluida' ? 1 : 0,
      alcancada: valores ? alvoAlcancado(valores) : meta.estado === 'concluida',
      diasQueFaltam: diasQueFaltam(hoje, meta.prazo),
      estagnada: valores
        ? estagnada(
            valores.valorInicial,
            valores.valorAlvo,
            daMeta.map((r) => r.valor),
          )
        : false,
      tarefas: ligadas
        .filter((tf) => tf.metaId === meta.id)
        .map((tf) => ({ id: tf.id, nome: tf.nome, duracaoMin: tf.duracaoMin, recorrencia: tf.recorrencia, ...(contagem.get(tf.id) ?? { total: 0, feitas: 0 }) })),
    };
  });
}

const comArea = () =>
  db
    .select({ meta: metas, area: { id: areas.id, nome: areas.nome, cor: areas.cor } })
    .from(metas)
    .innerJoin(areas, eq(metas.areaId, areas.id));

/** As metas de uma área (todas, de qualquer estado), pela ordem em que foram criadas. */
export function carregarMetasDaArea(areaId: number, semana: string, hoje: string): MetaDetalhada[] {
  return detalhar(comArea().where(eq(metas.areaId, areaId)).orderBy(asc(metas.id)).all(), semana, hoje);
}

export function carregarMeta(id: number, semana: string, hoje: string): MetaDetalhada | null {
  return detalhar(comArea().where(eq(metas.id, id)).all(), semana, hoje)[0] ?? null;
}

/** As metas ativas de todas as áreas por arquivar, pela ordem das áreas: o passo das metas na revisão. */
export function carregarMetasAtivas(semana: string, hoje: string): MetaDetalhada[] {
  return detalhar(
    comArea()
      .where(and(eq(metas.estado, 'ativa'), eq(areas.arquivada, false)))
      .orderBy(asc(areas.ordem), asc(areas.id), asc(metas.id))
      .all(),
    semana,
    hoje,
  );
}
