import { and, asc, eq, gte, isNull, lt, sql } from 'drizzle-orm';

import { carregarDefinicoes } from '@/data/definicoes';
import { carregarPlano } from '@/data/tarefas';
import { db } from '@/db/client';
import { blocos, tarefas, tarefasSemana } from '@/db/schema';
import { disporDia, limitesDaGrelha } from '@/domain/calendario';
import type { Recorrencia } from '@/domain/recorrencia';
import { diasDaSemana, limitesDaSemana, MINUTOS_DIA, paraDataHora, partirDataHora } from '@/domain/semana';
import { nomeCurtoDe } from '@/domain/tarefas';

/*
 * Blocos do calendário. Um bloco pertence a uma instância de tarefa (tarefas_semana) ou, sem ela,
 * é um bloco "Ocupado". Cada instância tem no máximo um bloco, e o estado da instância acompanha-o:
 * sem bloco = por alocar; com bloco = alocada; bloco feito = feita.
 */

const AGORA = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const TITULO_OCUPADO = 'Ocupado';

export type BlocoCalendario = {
  id: number;
  tipo: 'tarefa' | 'ocupado';
  /** 0 = segunda … 6 = domingo. */
  dia: number;
  inicioMin: number;
  fimMin: number;
  feito: boolean;
  /** Nome da tarefa ou título do bloco "Ocupado". */
  nome: string;
  /** Texto que cabe dentro do bloco. */
  nomeCurto: string;
  /** Cor da área; null nos blocos "Ocupado". */
  cor: string | null;
  area: string | null;
  tarefaId: number | null;
  /** Blocos sobrepostos ficam lado a lado: coluna deste bloco e número de colunas do grupo. */
  coluna: number;
  colunas: number;
};

export type TarefaPorAlocar = {
  tarefaId: number;
  nome: string;
  nomeCurto: string;
  duracaoMin: number;
  cor: string;
  area: string;
  recorrencia: Recorrencia | null;
  /** Instâncias ainda fora do calendário. */
  quantas: number;
};

export type CalendarioDaSemana = {
  semana: string;
  /** Os 7 dias, de segunda a domingo (AAAA-MM-DD). */
  dias: string[];
  /** Limites da grelha em minutos desde a meia-noite. */
  inicioMin: number;
  fimMin: number;
  blocos: BlocoCalendario[];
  porAlocar: TarefaPorAlocar[];
  minutosPorAlocar: number;
  /** Áreas com tarefas no calendário desta semana, para a legenda. */
  legenda: { id: number; nome: string; cor: string }[];
};

export function carregarCalendario(semana: string): CalendarioDaSemana {
  const plano = carregarPlano(semana);
  const dias = diasDaSemana(semana);
  const tarefaPorId = new Map<number, { nome: string; nomeCurto: string; cor: string; area: string }>();
  const porAlocar: TarefaPorAlocar[] = [];
  const legenda: CalendarioDaSemana['legenda'] = [];

  for (const { area, tarefas: daArea } of plano.areas) {
    let comDuracao = false;
    for (const t of daArea) {
      if (t.duracaoMin === null) continue;
      comDuracao = true;
      const nomeCurto = nomeCurtoDe(t.nome, t.nomeCurto);
      tarefaPorId.set(t.id, { nome: t.nome, nomeCurto, cor: area.cor, area: area.nome });
      if (t.porAlocar > 0) {
        porAlocar.push({ tarefaId: t.id, nome: t.nome, nomeCurto, duracaoMin: t.duracaoMin, cor: area.cor, area: area.nome, recorrencia: t.recorrencia, quantas: t.porAlocar });
      }
    }
    if (comDuracao) legenda.push({ id: area.id, nome: area.nome, cor: area.cor });
  }

  const lista: Omit<BlocoCalendario, 'coluna' | 'colunas'>[] = [];
  const deTarefas = db
    .select({ id: blocos.id, inicio: blocos.inicio, fim: blocos.fim, tarefaId: tarefasSemana.tarefaId, estado: tarefasSemana.estado })
    .from(blocos)
    .innerJoin(tarefasSemana, eq(blocos.tarefaSemanaId, tarefasSemana.id))
    .where(eq(tarefasSemana.semana, semana))
    .orderBy(asc(blocos.inicio), asc(blocos.id))
    .all();
  for (const b of deTarefas) {
    const tarefa = tarefaPorId.get(b.tarefaId);
    const inicio = partirDataHora(b.inicio);
    const dia = dias.indexOf(inicio.dia);
    if (!tarefa || dia === -1) continue; // área arquivada, ou bloco fora da semana
    lista.push({
      id: b.id,
      tipo: 'tarefa',
      dia,
      inicioMin: inicio.minutos,
      fimMin: partirDataHora(b.fim).minutos,
      feito: b.estado === 'feita',
      nome: tarefa.nome,
      nomeCurto: tarefa.nomeCurto,
      cor: tarefa.cor,
      area: tarefa.area,
      tarefaId: b.tarefaId,
    });
  }

  const { desde, ate } = limitesDaSemana(semana);
  const ocupados = db
    .select({ id: blocos.id, inicio: blocos.inicio, fim: blocos.fim, titulo: blocos.titulo })
    .from(blocos)
    .where(and(isNull(blocos.tarefaSemanaId), gte(blocos.inicio, desde), lt(blocos.inicio, ate)))
    .orderBy(asc(blocos.inicio), asc(blocos.id))
    .all();
  for (const b of ocupados) {
    const inicio = partirDataHora(b.inicio);
    const titulo = b.titulo?.trim() || TITULO_OCUPADO;
    lista.push({
      id: b.id,
      tipo: 'ocupado',
      dia: dias.indexOf(inicio.dia),
      inicioMin: inicio.minutos,
      fimMin: partirDataHora(b.fim).minutos,
      feito: false,
      nome: titulo,
      nomeCurto: titulo,
      cor: null,
      area: null,
      tarefaId: null,
    });
  }

  const comColunas: BlocoCalendario[] = [];
  for (let dia = 0; dia < 7; dia++) {
    const doDia = lista.filter((b) => b.dia === dia);
    const disposicao = disporDia(doDia);
    for (const b of doDia) comColunas.push({ ...b, ...(disposicao.get(b.id) ?? { coluna: 0, colunas: 1 }) });
  }

  const definicoes = carregarDefinicoes();
  return {
    semana,
    dias,
    ...limitesDaGrelha(definicoes.inicioGrelha, definicoes.fimGrelha, comColunas),
    blocos: comColunas,
    porAlocar,
    minutosPorAlocar: plano.minutosPorAlocar,
    legenda,
  };
}

function validarIntervalo(inicioMin: number, fimMin: number) {
  if (!Number.isInteger(inicioMin) || !Number.isInteger(fimMin) || inicioMin < 0 || fimMin > MINUTOS_DIA || fimMin <= inicioMin) {
    throw new Error('As horas do bloco não são válidas.');
  }
}

/**
 * Põe no calendário uma instância ainda por alocar da tarefa, com a duração da tarefa.
 * `dia` é AAAA-MM-DD e tem de pertencer à semana. Devolve o id do bloco.
 */
export function alocarTarefa(tarefaId: number, semana: string, dia: string, inicioMin: number): number {
  return db.transaction((tx) => {
    const tarefa = tx.select({ duracaoMin: tarefas.duracaoMin }).from(tarefas).where(eq(tarefas.id, tarefaId)).get();
    if (!tarefa) throw new Error('A tarefa já não existe.');
    if (tarefa.duracaoMin === null) throw new Error('Esta tarefa não ocupa tempo no calendário.');
    if (!diasDaSemana(semana).includes(dia)) throw new Error('O dia escolhido não pertence a esta semana.');
    const fimMin = Math.min(MINUTOS_DIA, inicioMin + tarefa.duracaoMin);
    validarIntervalo(inicioMin, fimMin);

    const livre = tx
      .select({ id: tarefasSemana.id })
      .from(tarefasSemana)
      .leftJoin(blocos, eq(blocos.tarefaSemanaId, tarefasSemana.id))
      .where(and(eq(tarefasSemana.tarefaId, tarefaId), eq(tarefasSemana.semana, semana), eq(tarefasSemana.estado, 'por_alocar'), isNull(blocos.id)))
      .orderBy(asc(tarefasSemana.id))
      .limit(1)
      .get();
    if (!livre) throw new Error('Esta tarefa já está toda no calendário.');

    const { id } = tx
      .insert(blocos)
      .values({ tarefaSemanaId: livre.id, inicio: paraDataHora(dia, inicioMin), fim: paraDataHora(dia, fimMin) })
      .returning({ id: blocos.id })
      .get();
    tx.update(tarefasSemana).set({ estado: 'alocada', atualizadoEm: AGORA }).where(eq(tarefasSemana.id, livre.id)).run();
    return id;
  });
}

/**
 * Para tarefas que repetem em dias certos: põe as instâncias que faltam à mesma hora, nos dias
 * (todos, ou os escolhidos na recorrência) em que a tarefa ainda não tem bloco. Devolve quantas alocou.
 */
export function alocarRestantes(tarefaId: number, semana: string, inicioMin: number): number {
  return db.transaction((tx) => {
    const tarefa = tx.select({ duracaoMin: tarefas.duracaoMin, recorrencia: tarefas.recorrencia }).from(tarefas).where(eq(tarefas.id, tarefaId)).get();
    if (!tarefa || tarefa.duracaoMin === null || !tarefa.recorrencia || tarefa.recorrencia.tipo === 'vezes_por_semana') return 0;
    const fimMin = Math.min(MINUTOS_DIA, inicioMin + tarefa.duracaoMin);
    validarIntervalo(inicioMin, fimMin);

    const instancias = tx
      .select({ id: tarefasSemana.id, estado: tarefasSemana.estado, inicio: blocos.inicio })
      .from(tarefasSemana)
      .leftJoin(blocos, eq(blocos.tarefaSemanaId, tarefasSemana.id))
      .where(and(eq(tarefasSemana.tarefaId, tarefaId), eq(tarefasSemana.semana, semana)))
      .orderBy(asc(tarefasSemana.id))
      .all();
    const dias = diasDaSemana(semana);
    const ocupados = new Set(instancias.flatMap((i) => (i.inicio ? [partirDataHora(i.inicio).dia] : [])));
    const candidatos = (tarefa.recorrencia.tipo === 'dias' ? tarefa.recorrencia.dias.map((d) => dias[d - 1]) : dias).filter((d) => d && !ocupados.has(d));
    const livres = instancias.filter((i) => i.inicio === null && i.estado === 'por_alocar');

    const quantas = Math.min(candidatos.length, livres.length);
    for (let n = 0; n < quantas; n++) {
      tx.insert(blocos)
        .values({ tarefaSemanaId: livres[n].id, inicio: paraDataHora(candidatos[n], inicioMin), fim: paraDataHora(candidatos[n], fimMin) })
        .run();
      tx.update(tarefasSemana).set({ estado: 'alocada', atualizadoEm: AGORA }).where(eq(tarefasSemana.id, livres[n].id)).run();
    }
    return quantas;
  });
}

/** Muda o dia, a hora de início ou a duração de um bloco. */
export function moverBloco(id: number, dia: string, inicioMin: number, fimMin: number): void {
  validarIntervalo(inicioMin, fimMin);
  db.transaction((tx) => {
    const bloco = tx
      .select({ id: blocos.id, semana: tarefasSemana.semana })
      .from(blocos)
      .leftJoin(tarefasSemana, eq(blocos.tarefaSemanaId, tarefasSemana.id))
      .where(eq(blocos.id, id))
      .get();
    if (!bloco) throw new Error('O bloco já não existe.');
    // Um bloco de tarefa não sai da semana da sua instância.
    if (bloco.semana && !diasDaSemana(bloco.semana).includes(dia)) throw new Error('O dia escolhido não pertence a esta semana.');
    tx.update(blocos)
      .set({ inicio: paraDataHora(dia, inicioMin), fim: paraDataHora(dia, fimMin), atualizadoEm: AGORA })
      .where(eq(blocos.id, id))
      .run();
  });
}

/** Marca (ou desmarca) um bloco de tarefa como feito. As horas feitas da revisão vêm daqui. */
export function marcarBlocoFeito(id: number, feito: boolean): void {
  db.transaction((tx) => {
    const bloco = tx.select({ instanciaId: blocos.tarefaSemanaId }).from(blocos).where(eq(blocos.id, id)).get();
    if (!bloco) throw new Error('O bloco já não existe.');
    if (bloco.instanciaId === null) throw new Error('Os blocos “Ocupado” não se marcam como feitos.');
    tx.update(blocos).set({ feito, atualizadoEm: AGORA }).where(eq(blocos.id, id)).run();
    tx.update(tarefasSemana)
      .set({ estado: feito ? 'feita' : 'alocada', atualizadoEm: AGORA })
      .where(eq(tarefasSemana.id, bloco.instanciaId))
      .run();
  });
}

/** Tira o bloco do calendário. Se for de uma tarefa, a instância volta a "por alocar". */
export function retirarBloco(id: number): void {
  db.transaction((tx) => {
    const bloco = tx.select({ instanciaId: blocos.tarefaSemanaId }).from(blocos).where(eq(blocos.id, id)).get();
    if (!bloco) return;
    tx.delete(blocos).where(eq(blocos.id, id)).run();
    if (bloco.instanciaId !== null) {
      tx.update(tarefasSemana).set({ estado: 'por_alocar', atualizadoEm: AGORA }).where(eq(tarefasSemana.id, bloco.instanciaId)).run();
    }
  });
}

/** Cria um bloco "Ocupado": um compromisso fixo, sem área. Devolve o id. */
export function criarOcupado(dia: string, inicioMin: number, fimMin: number, titulo = ''): number {
  validarIntervalo(inicioMin, fimMin);
  return db
    .insert(blocos)
    .values({ titulo: titulo.trim() || null, inicio: paraDataHora(dia, inicioMin), fim: paraDataHora(dia, fimMin) })
    .returning({ id: blocos.id })
    .get().id;
}

export function renomearOcupado(id: number, titulo: string): void {
  db.update(blocos)
    .set({ titulo: titulo.trim() || null, atualizadoEm: AGORA })
    .where(and(eq(blocos.id, id), isNull(blocos.tarefaSemanaId)))
    .run();
}
