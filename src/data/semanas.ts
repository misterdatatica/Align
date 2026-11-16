import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';

import { consultaAreasAtivas } from '@/data/areas';
import { carregarCalendario } from '@/data/calendario';
import { recorrentesEmVigor, type Bd } from '@/data/tarefas';
import { db } from '@/db/client';
import { areas, blocos, revisoes, semanas, tarefas, tarefasSemana } from '@/db/schema';
import {
  areasSemTempo,
  fimCopiado,
  lugaresACopiar,
  origemPorOmissao,
  sobreposicoesDaSemana,
  type EstadoDaSemana,
  type Lugar,
  type OrigemDaSemana,
  type Sobreposicao,
} from '@/domain/proposta';
import { instanciasPorSemana } from '@/domain/recorrencia';
import { deDataISO, diasDaSemana, inicioDaSemana, limitesDaSemana, paraDataHora, partirDataHora, somarSemanas } from '@/domain/semana';

/*
 * O plano de cada semana. Uma semana nova não começa do zero: começa como uma proposta (rascunho),
 * copiada da última semana planeada ou da semana modelo, que o utilizador revê e aceita.
 *
 * O que a cópia leva:
 *  - blocos das tarefas recorrentes e blocos "Ocupado": para o mesmo dia e hora;
 *  - tarefas únicas por fazer: para "Por alocar", com a marca "vem da semana passada";
 *  - nunca o estado "feito", nem as tarefas únicas já feitas.
 */

const AGORA = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export type AtencaoDaProposta = {
  sobreposicoes: Sobreposicao[];
  /** Áreas ativas sem nenhum bloco no calendário desta semana. */
  areasSemTempo: { id: number; nome: string; cor: string }[];
};

export type PlanoDaSemana = {
  semana: string;
  estado: EstadoDaSemana;
  origem: OrigemDaSemana | null;
  /** A semana copiada, se a proposta veio de uma cópia. */
  origemSemana: string | null;
  /** Esta é a semana modelo. */
  modelo: boolean;
  /** A semana modelo, se houver (pode ser esta). */
  semanaModelo: string | null;
  /** A última semana planeada antes desta: é a que "igual à semana passada" copia. */
  ultimaPlaneada: string | null;
  /** Só se planeiam a semana atual e as seguintes. */
  podePlanear: boolean;
  /** Origens que se podem escolher para esta semana, e a que vem escolhida. */
  origens: OrigemDaSemana[];
  origemPorOmissao: OrigemDaSemana;
  /** O que a proposta destaca; null fora do rascunho. */
  atencao: AtencaoDaProposta | null;
};

function ultimaPlaneadaAntes(bd: Bd, semana: string): string | null {
  return bd.select({ semana: semanas.semana }).from(semanas).where(lt(semanas.semana, semana)).orderBy(desc(semanas.semana)).limit(1).get()?.semana ?? null;
}

function lerSemanaModelo(bd: Bd): string | null {
  return bd.select({ semana: semanas.semana }).from(semanas).where(eq(semanas.modelo, true)).get()?.semana ?? null;
}

/** Sobreposições e áreas sem tempo no calendário de uma semana. */
export function atencaoDaSemana(semana: string): AtencaoDaProposta {
  const { blocos: doCalendario } = carregarCalendario(semana);
  const lista = consultaAreasAtivas().all();
  return {
    sobreposicoes: sobreposicoesDaSemana(doCalendario),
    areasSemTempo: areasSemTempo(lista, doCalendario).map((a) => ({ id: a.id, nome: a.nome, cor: a.cor })),
  };
}

/** O plano de uma semana e o que se pode fazer com ele. `hoje` é AAAA-MM-DD. */
export function carregarPlanoDaSemana(semana: string, hoje: string): PlanoDaSemana {
  const linha = db.select().from(semanas).where(eq(semanas.semana, semana)).get();
  const semanaModelo = lerSemanaModelo(db);
  const ultimaPlaneada = ultimaPlaneadaAntes(db, semana);
  const estado: EstadoDaSemana = linha?.estado ?? 'por_planear';
  const origens: OrigemDaSemana[] = [...(ultimaPlaneada ? (['passada'] as const) : []), ...(semanaModelo && semanaModelo !== semana ? (['modelo'] as const) : []), 'vazia'];
  return {
    semana,
    estado,
    origem: linha?.origem ?? null,
    origemSemana: linha?.origemSemana ?? null,
    modelo: linha?.modelo ?? false,
    semanaModelo,
    ultimaPlaneada,
    podePlanear: semana >= inicioDaSemana(deDataISO(hoje)),
    origens,
    origemPorOmissao: origemPorOmissao(origens),
    atencao: estado === 'rascunho' ? atencaoDaSemana(semana) : null,
  };
}

/** Lugar na semana (dia 0–6 e minutos) de um intervalo de data e hora; null se não for dessa semana. */
function lugarDe(dias: string[], inicio: string, fim: string): Lugar | null {
  const a = partirDataHora(inicio);
  const dia = dias.indexOf(a.dia);
  return dia === -1 ? null : { dia, inicioMin: a.minutos, fimMin: partirDataHora(fim).minutos };
}

/** Esvazia uma proposta para a refazer: saem os blocos por fazer e os "Ocupado"; as tarefas ficam, por alocar. */
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
 * Cria a proposta de uma semana a partir da origem escolhida. A proposta fica em rascunho até
 * "Aceitar semana". Chamar outra vez com a semana ainda em rascunho refaz a proposta com a origem nova.
 */
export function criarProposta(semana: string, origem: OrigemDaSemana, hoje: Date = new Date()): void {
  if (semana < inicioDaSemana(hoje)) throw new Error('Só se planeiam a semana atual e as seguintes.');
  db.transaction((tx) => {
    const linha = tx.select({ estado: semanas.estado }).from(semanas).where(eq(semanas.semana, semana)).get();
    if (linha?.estado === 'aceite') throw new Error('Esta semana já foi aceite.');

    const ultimaPlaneada = ultimaPlaneadaAntes(tx, semana);
    let copiada: string | null = null;
    if (origem === 'passada') {
      if (!ultimaPlaneada) throw new Error('Ainda não há nenhuma semana anterior para copiar.');
      copiada = ultimaPlaneada;
    } else if (origem === 'modelo') {
      const modelo = lerSemanaModelo(tx);
      if (!modelo || modelo === semana) throw new Error('Ainda não marcou nenhuma semana como modelo.');
      copiada = modelo;
    }

    if (linha) limpar(tx, semana);
    gerar(tx, semana, copiada, ultimaPlaneada);
    tx.insert(semanas)
      .values({ semana, estado: 'rascunho', origem, origemSemana: copiada })
      .onConflictDoUpdate({ target: semanas.semana, set: { estado: 'rascunho', origem, origemSemana: copiada, atualizadoEm: AGORA } })
      .run();
  });
}

/**
 * Abre a proposta de uma semana: se ainda não tem plano, cria-a com a origem por omissão (igual à
 * semana passada, se houver). É o último passo da revisão. Devolve o estado em que a semana ficou.
 */
export function abrirProposta(semana: string, hoje: Date = new Date()): EstadoDaSemana {
  const linha = db.select({ estado: semanas.estado }).from(semanas).where(eq(semanas.semana, semana)).get();
  if (linha) return linha.estado;
  if (semana < inicioDaSemana(hoje)) return 'por_planear';
  criarProposta(semana, ultimaPlaneadaAntes(db, semana) ? 'passada' : 'vazia', hoje);
  return 'rascunho';
}

/** "Aceitar semana": a proposta passa a ser o plano. */
export function aceitarSemana(semana: string): void {
  const aceite = db.update(semanas).set({ estado: 'aceite', atualizadoEm: AGORA }).where(eq(semanas.semana, semana)).returning({ semana: semanas.semana }).all();
  if (aceite.length === 0) throw new Error('Esta semana ainda não tem uma proposta.');
}

/** Marca (ou desmarca) uma semana como semana modelo. Só há uma: marcar outra substitui a anterior. */
export function marcarSemanaModelo(semana: string, modelo: boolean): void {
  db.transaction((tx) => {
    const linha = tx.select({ semana: semanas.semana }).from(semanas).where(eq(semanas.semana, semana)).get();
    if (!linha) throw new Error('Planeie a semana antes de a marcar como modelo.');
    if (modelo) tx.update(semanas).set({ modelo: false, atualizadoEm: AGORA }).where(eq(semanas.modelo, true)).run();
    tx.update(semanas).set({ modelo, atualizadoEm: AGORA }).where(eq(semanas.semana, semana)).run();
  });
}
