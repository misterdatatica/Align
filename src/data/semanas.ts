import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';

import { garantirSemana, recorrentesEmVigor, type Bd } from '@/data/tarefas';
import { db } from '@/db/client';
import { ErroDaApp } from '@/domain/erros';
import { t } from '@/i18n';
import { areas, blocos, revisoes, semanas, tarefas, tarefasSemana } from '@/db/schema';
import { fimCopiado, lugaresACopiar, type EstadoDaSemana, type Lugar } from '@/domain/proposta';
import { instanciasPorSemana } from '@/domain/recorrencia';
import { deDataISO, diasDaSemana, inicioDaSemana, limitesDaSemana, paraDataHora, partirDataHora, somarSemanas } from '@/domain/semana';

/*
 * O plano de cada semana. Uma semana nova não começa do zero: começa sempre igual à semana anterior,
 * sem nada para aceitar. Se faltarem semanas entre a última planeada e a que se abre, planeiam-se
 * todas por ordem, cada uma copiada da anterior.
 *
 * O que a cópia leva:
 *  - blocos das tarefas recorrentes e blocos "Ocupado": para o mesmo dia e hora;
 *  - tarefas únicas por fazer: para "Por alocar", com a marca "vem da semana passada";
 *  - nunca o estado "feito", nem as tarefas únicas já feitas.
 */

const AGORA = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export type PlanoDaSemana = {
  semana: string;
  /** "por_planear" só acontece nas semanas que já passaram sem plano. */
  estado: EstadoDaSemana;
  /** De onde veio: "passada" (cópia da anterior) ou "vazia" (a primeira de todas, ou limpa). */
  origem: 'passada' | 'modelo' | 'vazia' | null;
  /** A semana copiada, se a semana veio de uma cópia. */
  origemSemana: string | null;
  /** Só se planeiam a semana atual e as seguintes. */
  podePlanear: boolean;
  /** Há uma semana planeada antes desta (para "Refazer a partir da semana anterior"). */
  temAnterior: boolean;
  /**
   * A semana anterior ganhou "Ocupado" ou tarefas únicas por fazer depois de esta ter sido criada (ou
   * refeita): esta semana não os tem. Só nas semanas que ainda se planeiam.
   */
  desatualizada: boolean;
};

/** Ver PlanoDaSemana.desatualizada. `desde` é quando a semana foi criada, refeita ou limpa. */
function semanaDesatualizada(anterior: string, desde: string): boolean {
  const { desde: inicio, ate } = limitesDaSemana(anterior);
  const ocupadoNovo = db
    .select({ id: blocos.id })
    .from(blocos)
    .where(and(isNull(blocos.tarefaSemanaId), gte(blocos.inicio, inicio), lt(blocos.inicio, ate), gt(blocos.criadoEm, desde)))
    .limit(1)
    .get();
  if (ocupadoNovo) return true;
  const tarefaUnicaNova = db
    .select({ id: tarefasSemana.id })
    .from(tarefasSemana)
    .innerJoin(tarefas, eq(tarefasSemana.tarefaId, tarefas.id))
    .innerJoin(areas, eq(tarefas.areaId, areas.id))
    .where(and(eq(tarefasSemana.semana, anterior), isNull(tarefas.recorrencia), ne(tarefasSemana.estado, 'feita'), eq(areas.arquivada, false), gt(tarefasSemana.criadoEm, desde)))
    .limit(1)
    .get();
  return !!tarefaUnicaNova;
}

function ultimaPlaneadaAntes(bd: Bd, semana: string): string | null {
  return bd.select({ semana: semanas.semana }).from(semanas).where(lt(semanas.semana, semana)).orderBy(desc(semanas.semana)).limit(1).get()?.semana ?? null;
}

/** O plano de uma semana. `hoje` é AAAA-MM-DD. */
export function carregarPlanoDaSemana(semana: string, hoje: string): PlanoDaSemana {
  const linha = db.select().from(semanas).where(eq(semanas.semana, semana)).get();
  const podePlanear = semana >= inicioDaSemana(deDataISO(hoje));
  const anterior = ultimaPlaneadaAntes(db, semana);
  return {
    semana,
    estado: linha ? 'aceite' : 'por_planear',
    origem: linha?.origem ?? null,
    origemSemana: linha?.origemSemana ?? null,
    podePlanear,
    temAnterior: anterior !== null,
    desatualizada: !!linha && podePlanear && anterior !== null && semanaDesatualizada(anterior, linha.atualizadoEm),
  };
}

/** Lugar na semana (dia 0–6 e minutos) de um intervalo de data e hora; null se não for dessa semana. */
function lugarDe(dias: string[], inicio: string, fim: string): Lugar | null {
  const a = partirDataHora(inicio);
  const dia = dias.indexOf(a.dia);
  return dia === -1 ? null : { dia, inicioMin: a.minutos, fimMin: partirDataHora(fim).minutos };
}

/**
 * As tarefas únicas que ficaram por fazer em `de` e ainda não estão em `para` passam para lá, por
 * alocar. Se a revisão de `de` já foi fechada, passam só as que o utilizador lá marcou.
 */
function transitar(tx: Bd, de: string, para: string) {
  const porFazer = tx
    .selectDistinct({ tarefaId: tarefasSemana.tarefaId })
    .from(tarefasSemana)
    .innerJoin(tarefas, eq(tarefasSemana.tarefaId, tarefas.id))
    .innerJoin(areas, eq(tarefas.areaId, areas.id))
    .where(
      and(
        eq(tarefasSemana.semana, de),
        ne(tarefasSemana.estado, 'feita'),
        isNull(tarefas.recorrencia),
        eq(areas.arquivada, false),
        or(isNull(tarefas.semanaFim), gt(tarefas.semanaFim, para)),
      ),
    )
    .orderBy(asc(tarefasSemana.tarefaId))
    .all();
  if (porFazer.length === 0) return;

  const revisao = tx.select({ fechadaEm: revisoes.fechadaEm }).from(revisoes).where(eq(revisoes.semana, de)).get();
  const idsDe = (semana: string, transitadaDe?: string) =>
    new Set(
      tx
        .select({ tarefaId: tarefasSemana.tarefaId })
        .from(tarefasSemana)
        .where(and(eq(tarefasSemana.semana, semana), transitadaDe === undefined ? undefined : eq(tarefasSemana.transitadaDe, transitadaDe)))
        .all()
        .map((i) => i.tarefaId),
    );
  const marcadas = revisao?.fechadaEm ? idsDe(somarSemanas(de, 1), de) : null;
  const jaLa = idsDe(para);
  for (const { tarefaId } of porFazer) {
    if (jaLa.has(tarefaId) || (marcadas && !marcadas.has(tarefaId))) continue;
    tx.insert(tarefasSemana).values({ tarefaId, semana: para, transitadaDe: de }).run();
  }
}

/**
 * Preenche a semana a partir de `origem` (a semana copiada; null = começar vazia). Só acrescenta o que
 * falta, por isso respeita o que a semana já tiver (ex.: tarefas que a revisão passou para lá).
 */
function gerar(tx: Bd, semana: string, origem: string | null, ultimaPlaneada: string | null) {
  const dias = diasDaSemana(semana);
  const serieDe = (t: { tarefaId: number; serieId: number | null }) => t.serieId ?? t.tarefaId;

  const existentes = tx
    .select({ id: tarefasSemana.id, estado: tarefasSemana.estado, habitualInicio: tarefasSemana.habitualInicio, tarefaId: tarefas.id, serieId: tarefas.serieId, inicio: blocos.inicio, fim: blocos.fim })
    .from(tarefasSemana)
    .innerJoin(tarefas, eq(tarefasSemana.tarefaId, tarefas.id))
    .leftJoin(blocos, eq(blocos.tarefaSemanaId, tarefasSemana.id))
    .where(eq(tarefasSemana.semana, semana))
    .orderBy(asc(tarefasSemana.id))
    .all();

  // Os lugares de cada tarefa na semana de origem: o horário habitual, ou onde o bloco está.
  const lugares = new Map<number, (Lugar & { duracaoNaOrigem: number | null })[]>();
  if (origem) {
    const diasDaOrigem = diasDaSemana(origem);
    const daOrigem = tx
      .select({
        habitualInicio: tarefasSemana.habitualInicio,
        habitualFim: tarefasSemana.habitualFim,
        inicio: blocos.inicio,
        fim: blocos.fim,
        tarefaId: tarefas.id,
        serieId: tarefas.serieId,
        duracaoMin: tarefas.duracaoMin,
      })
      .from(tarefasSemana)
      .innerJoin(tarefas, eq(tarefasSemana.tarefaId, tarefas.id))
      .leftJoin(blocos, eq(blocos.tarefaSemanaId, tarefasSemana.id))
      .where(eq(tarefasSemana.semana, origem))
      .all();
    for (const i of daOrigem) {
      const inicio = i.habitualInicio ?? i.inicio;
      const fim = i.habitualFim ?? i.fim;
      const lugar = inicio && fim ? lugarDe(diasDaOrigem, inicio, fim) : null;
      if (!lugar) continue;
      const daSerie = lugares.get(serieDe(i)) ?? [];
      daSerie.push({ ...lugar, duracaoNaOrigem: i.duracaoMin });
      lugares.set(serieDe(i), daSerie);
    }
  }

  for (const tarefa of recorrentesEmVigor(tx, semana)) {
    const serie = tarefa.serieId ?? tarefa.id;
    const daTarefa = existentes.filter((i) => serieDe(i) === serie);
    const livres = daTarefa.filter((i) => i.estado === 'por_alocar' && i.inicio === null && i.habitualInicio === null).map((i) => i.id);
    for (let n = daTarefa.length; n < instanciasPorSemana(tarefa.recorrencia); n++) {
      livres.push(tx.insert(tarefasSemana).values({ tarefaId: tarefa.id, semana }).returning({ id: tarefasSemana.id }).get().id);
    }
    if (tarefa.duracaoMin === null) continue;

    const ocupados = daTarefa.flatMap((i) => (i.inicio && i.fim ? [lugarDe(dias, i.inicio, i.fim)] : [])).filter((l) => l !== null);
    const aCopiar = lugaresACopiar(lugares.get(serie) ?? [], ocupados, livres.length);
    aCopiar.forEach((lugar, n) => {
      tx.insert(blocos)
        .values({
          tarefaSemanaId: livres[n],
          inicio: paraDataHora(dias[lugar.dia], lugar.inicioMin),
          fim: paraDataHora(dias[lugar.dia], fimCopiado(lugar, lugar.duracaoNaOrigem, tarefa.duracaoMin!)),
        })
        .run();
      tx.update(tarefasSemana).set({ estado: 'alocada', atualizadoEm: AGORA }).where(eq(tarefasSemana.id, livres[n])).run();
    });
  }

  if (origem) {
    const ocupadosEm = (s: string) => {
      const { desde, ate } = limitesDaSemana(s);
      return tx
        .select({ titulo: blocos.titulo, inicio: blocos.inicio, fim: blocos.fim })
        .from(blocos)
        .where(and(isNull(blocos.tarefaSemanaId), gte(blocos.inicio, desde), lt(blocos.inicio, ate)))
        .orderBy(asc(blocos.inicio), asc(blocos.id))
        .all();
    };
    const jaLa = new Set(ocupadosEm(semana).map((b) => `${b.inicio}|${b.fim}|${b.titulo ?? ''}`));
    const diasDaOrigem = diasDaSemana(origem);
    for (const b of ocupadosEm(origem)) {
      const lugar = lugarDe(diasDaOrigem, b.inicio, b.fim);
      if (!lugar) continue;
      const novo = { titulo: b.titulo, inicio: paraDataHora(dias[lugar.dia], lugar.inicioMin), fim: paraDataHora(dias[lugar.dia], lugar.fimMin) };
      if (jaLa.has(`${novo.inicio}|${novo.fim}|${novo.titulo ?? ''}`)) continue;
      tx.insert(blocos).values(novo).run();
    }
  }

  if (ultimaPlaneada) transitar(tx, ultimaPlaneada, semana);
}

/**
 * Esvazia uma semana para a refazer: saem os blocos por fazer e os "Ocupado"; as tarefas ficam, por
 * alocar. O que já foi feito fica como está.
 */
function limpar(tx: Bd, semana: string) {
  const porFazer = tx
    .select({ blocoId: blocos.id })
    .from(blocos)
    .innerJoin(tarefasSemana, eq(blocos.tarefaSemanaId, tarefasSemana.id))
    .where(and(eq(tarefasSemana.semana, semana), ne(tarefasSemana.estado, 'feita')))
    .all()
    .map((b) => b.blocoId);
  if (porFazer.length) tx.delete(blocos).where(inArray(blocos.id, porFazer)).run();
  tx.update(tarefasSemana)
    .set({ estado: 'por_alocar', atualizadoEm: AGORA })
    .where(and(eq(tarefasSemana.semana, semana), eq(tarefasSemana.estado, 'alocada')))
    .run();
  tx.update(tarefasSemana)
    .set({ habitualInicio: null, habitualFim: null })
    .where(and(eq(tarefasSemana.semana, semana), ne(tarefasSemana.estado, 'feita')))
    .run();
  const { desde, ate } = limitesDaSemana(semana);
  tx.delete(blocos)
    .where(and(isNull(blocos.tarefaSemanaId), gte(blocos.inicio, desde), lt(blocos.inicio, ate)))
    .run();
}

/** Cria o plano de uma semana como cópia da última semana planeada antes dela (ou vazia, se não houver). */
function criarSemana(semana: string) {
  db.transaction((tx) => {
    if (tx.select({ semana: semanas.semana }).from(semanas).where(eq(semanas.semana, semana)).get()) return;
    const anterior = ultimaPlaneadaAntes(tx, semana);
    gerar(tx, semana, anterior, anterior);
    tx.insert(semanas)
      .values({ semana, estado: 'aceite', origem: anterior ? 'passada' : 'vazia', origemSemana: anterior })
      .run();
  });
}

/**
 * Garante que a semana tem plano, copiado da semana anterior. As semanas que faltarem entre a última
 * planeada e esta são planeadas primeiro, por ordem, para cada uma ser igual à que vem antes. As
 * semanas que já passaram sem plano ficam como estão. A primeira semana de todas é a de
 * `garantirSemana`, que começa vazia.
 */
export function planearSemana(semana: string, hoje: Date = new Date()): void {
  // As propostas por aceitar de versões anteriores da app passam a ser o plano.
  db.update(semanas).set({ estado: 'aceite', atualizadoEm: AGORA }).where(eq(semanas.estado, 'rascunho')).run();
  const atual = inicioDaSemana(hoje);
  if (semana >= atual && !db.select({ semana: semanas.semana }).from(semanas).where(eq(semanas.semana, semana)).get()) {
    const anterior = ultimaPlaneadaAntes(db, semana);
    if (anterior) {
      for (let s = anterior < atual ? atual : somarSemanas(anterior, 1); s <= semana; s = somarSemanas(s, 1)) criarSemana(s);
    }
  }
  garantirSemana(semana, hoje);
}

/**
 * "Refazer a partir da semana anterior": volta a copiar a semana anterior para esta, para apanhar o
 * que mudou lá depois de esta semana ter sido criada (um "Ocupado" novo, uma tarefa única que ficou
 * por fazer…). Os blocos mudados ou acrescentados nesta semana perdem-se; as tarefas e o que já foi
 * feito ficam. Só para a semana atual e as seguintes.
 */
export function refazerSemana(semana: string, hoje: Date = new Date()): void {
  if (semana < inicioDaSemana(hoje)) throw new ErroDaApp(t('Só se refazem a semana atual e as seguintes.'));
  db.transaction((tx) => {
    if (!tx.select({ semana: semanas.semana }).from(semanas).where(eq(semanas.semana, semana)).get()) throw new ErroDaApp(t('Esta semana ainda não tem plano.'));
    const anterior = ultimaPlaneadaAntes(tx, semana);
    if (!anterior) throw new ErroDaApp(t('Não há nenhuma semana anterior para copiar.'));
    limpar(tx, semana);
    gerar(tx, semana, anterior, anterior);
    tx.update(semanas).set({ origem: 'passada', origemSemana: anterior, atualizadoEm: AGORA }).where(eq(semanas.semana, semana)).run();
  });
  garantirSemana(semana, hoje);
}

/**
 * "Limpar esta semana": começa a semana do zero (ex.: férias). Saem os blocos por fazer e os "Ocupado";
 * as tarefas ficam, por alocar, e o que já foi feito fica. Só para a semana atual e as seguintes.
 */
export function limparSemana(semana: string, hoje: Date = new Date()): void {
  if (semana < inicioDaSemana(hoje)) throw new ErroDaApp(t('Só se limpam a semana atual e as seguintes.'));
  db.transaction((tx) => {
    if (!tx.select({ semana: semanas.semana }).from(semanas).where(eq(semanas.semana, semana)).get()) throw new ErroDaApp(t('Esta semana ainda não tem plano.'));
    limpar(tx, semana);
    tx.update(semanas).set({ origem: 'vazia', origemSemana: null, atualizadoEm: AGORA }).where(eq(semanas.semana, semana)).run();
  });
  garantirSemana(semana, hoje);
}
