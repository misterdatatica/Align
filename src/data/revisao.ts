import { and, asc, count, eq, inArray, ne, sql } from 'drizzle-orm';

import { marcarBlocoFeito } from '@/data/calendario';
import { carregarDefinicoes } from '@/data/definicoes';
import { carregarMetasAtivas, type MetaDetalhada } from '@/data/metas';
import { carregarPlano, garantirSemana } from '@/data/tarefas';
import { db } from '@/db/client';
import { areas, blocos, revisoes, tarefas, tarefasSemana } from '@/db/schema';
import { diaEmQueAbre, revisaoDisponivel } from '@/domain/revisao';
import { deDataISO, diasDaSemana, inicioDaSemana, partirDataHora, somarSemanas } from '@/domain/semana';

/*
 * Revisão semanal: o que foi feito contra o planeado, o que ficou por fazer e passa para a semana
 * seguinte, e duas notas de reflexão. Há uma revisão por semana; fechá-la arruma a semana.
 */

const AGORA = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export type BlocoPorConfirmar = {
  blocoId: number;
  nome: string;
  area: string;
  cor: string;
  /** 0 = segunda … 6 = domingo. */
  dia: number;
  inicioMin: number;
  fimMin: number;
};

export type TarefaPorFazer = {
  tarefaId: number;
  nome: string;
  area: string;
  cor: string;
  duracaoMin: number | null;
  /** Já passou para a semana seguinte (numa revisão fechada). */
  transitou: boolean;
};

export type RevisaoDaSemana = {
  semana: string;
  /** Já chegou o dia da revisão; antes disso o ecrã mostra só como a semana vai. */
  disponivel: boolean;
  /** Dia (AAAA-MM-DD) em que a revisão desta semana abre. */
  abreEm: string;
  fechadaEm: string | null;
  correuBem: string;
  queroMudar: string;
  minutosFeitos: number;
  minutosPlaneados: number;
  /** Áreas com horas planeadas ou feitas nesta semana. */
  areas: { id: number; nome: string; cor: string; minutosFeitos: number; minutosPlaneados: number }[];
  /** Blocos no calendário ainda por marcar: a revisão pergunta "Feito?" antes de contar (regra 6). */
  porConfirmar: BlocoPorConfirmar[];
  /** Tarefas únicas por fazer, que podem passar para a semana seguinte (as recorrentes não passam). */
  porFazer: TarefaPorFazer[];
  /** "Como estão as suas metas?": as metas ativas, para atualizar o valor ou marcar como alcançadas. */
  metas: MetaDetalhada[];
  temTarefas: boolean;
};

/**
 * A semana que o separador Revisão mostra hoje: a atual, se já chegou o dia da revisão; senão a
 * anterior, enquanto a sua revisão estiver por fechar; senão a atual, ainda só em antevisão.
 */
export function semanaEmRevisao(hoje: string): { semana: string; disponivel: boolean } {
  const { diaRevisao } = carregarDefinicoes();
  const atual = inicioDaSemana(deDataISO(hoje));
  if (revisaoDisponivel(hoje, diaRevisao)) return { semana: atual, disponivel: true };

  const anterior = somarSemanas(atual, -1);
  const revisao = db.select({ fechadaEm: revisoes.fechadaEm }).from(revisoes).where(eq(revisoes.semana, anterior)).get();
  const instancias = db.select({ n: count() }).from(tarefasSemana).where(eq(tarefasSemana.semana, anterior)).get();
  if (!revisao?.fechadaEm && (instancias?.n ?? 0) > 0) return { semana: anterior, disponivel: true };
  return { semana: atual, disponivel: false };
}

export function carregarRevisao(hoje: string): RevisaoDaSemana {
  const { semana, disponivel } = semanaEmRevisao(hoje);
  const plano = carregarPlano(semana);
  const revisao = db.select().from(revisoes).where(eq(revisoes.semana, semana)).get();
  const dias = diasDaSemana(semana);

  const seguinte = somarSemanas(semana, 1);
  const transitadas = new Set(
    db
      .select({ tarefaId: tarefasSemana.tarefaId })
      .from(tarefasSemana)
      .where(and(eq(tarefasSemana.semana, seguinte), eq(tarefasSemana.transitadaDe, semana)))
      .all()
      .map((i) => i.tarefaId),
  );
  const porFazer: TarefaPorFazer[] = [];
  const resumoDasAreas: RevisaoDaSemana['areas'] = [];
  let temTarefas = false;
  for (const { area, tarefas: daArea, minutosPlaneados } of plano.areas) {
    let minutosFeitos = 0;
    for (const t of daArea) {
      temTarefas = true;
      minutosFeitos += t.minutosFeitos;
      if (t.recorrencia === null && t.feitas < t.total) porFazer.push({ tarefaId: t.id, nome: t.nome, area: area.nome, cor: area.cor, duracaoMin: t.duracaoMin, transitou: transitadas.has(t.id) });
    }
    if (minutosPlaneados > 0 || minutosFeitos > 0) resumoDasAreas.push({ id: area.id, nome: area.nome, cor: area.cor, minutosFeitos, minutosPlaneados });
  }

  const porConfirmar = db
    .select({ blocoId: blocos.id, inicio: blocos.inicio, fim: blocos.fim, nome: tarefas.nome, area: areas.nome, cor: areas.cor })
    .from(blocos)
    .innerJoin(tarefasSemana, eq(blocos.tarefaSemanaId, tarefasSemana.id))
    .innerJoin(tarefas, eq(tarefasSemana.tarefaId, tarefas.id))
    .innerJoin(areas, eq(tarefas.areaId, areas.id))
    .where(and(eq(tarefasSemana.semana, semana), eq(tarefasSemana.estado, 'alocada'), eq(areas.arquivada, false)))
    .orderBy(asc(blocos.inicio), asc(blocos.id))
    .all()
    .map((b) => {
      const inicio = partirDataHora(b.inicio);
      return { blocoId: b.blocoId, nome: b.nome, area: b.area, cor: b.cor, dia: dias.indexOf(inicio.dia), inicioMin: inicio.minutos, fimMin: partirDataHora(b.fim).minutos };
    });

  return {
    semana,
    disponivel,
    abreEm: diaEmQueAbre(semana, carregarDefinicoes().diaRevisao),
    fechadaEm: revisao?.fechadaEm ?? null,
    correuBem: revisao?.correuBem ?? '',
    queroMudar: revisao?.queroMudar ?? '',
    minutosFeitos: plano.minutosFeitos,
    minutosPlaneados: plano.minutosPlaneados,
    areas: resumoDasAreas,
    porConfirmar,
    porFazer,
    metas: carregarMetasAtivas(semana, hoje),
    temTarefas,
  };
}

/** Há uma revisão disponível e ainda por fechar? (Para o atalho no ecrã das áreas.) */
export function revisaoPorFazer(hoje: string): { semana: string; diaRevisao: number } | null {
  const { semana, disponivel } = semanaEmRevisao(hoje);
  if (!disponivel) return null;
  const revisao = db.select({ fechadaEm: revisoes.fechadaEm }).from(revisoes).where(eq(revisoes.semana, semana)).get();
  if (revisao?.fechadaEm) return null;
  const instancias = db.select({ n: count() }).from(tarefasSemana).where(eq(tarefasSemana.semana, semana)).get();
  return (instancias?.n ?? 0) > 0 ? { semana, diaRevisao: carregarDefinicoes().diaRevisao } : null;
}

/** Guarda as notas de reflexão à medida que o utilizador escreve (a revisão continua aberta). */
export function guardarReflexao(semana: string, notas: { correuBem?: string; queroMudar?: string }): void {
  const campos = {
    ...(notas.correuBem !== undefined ? { correuBem: notas.correuBem.trim() } : {}),
    ...(notas.queroMudar !== undefined ? { queroMudar: notas.queroMudar.trim() } : {}),
  };
  db.insert(revisoes)
    .values({ semana, ...campos })
    .onConflictDoUpdate({ target: revisoes.semana, set: { ...campos, atualizadoEm: AGORA } })
    .run();
}

/** Resposta ao "Feito?" de um bloco por marcar. "Não" tira-o da lista sem o apagar do calendário. */
export function responderBloco(blocoId: number, feito: boolean): void {
  if (feito) {
    marcarBlocoFeito(blocoId, true);
    return;
  }
  const bloco = db.select({ instanciaId: blocos.tarefaSemanaId }).from(blocos).where(eq(blocos.id, blocoId)).get();
  if (!bloco?.instanciaId) return;
  db.update(tarefasSemana).set({ estado: 'nao_feita', atualizadoEm: AGORA }).where(eq(tarefasSemana.id, bloco.instanciaId)).run();
}

/**
 * Fecha a revisão: o que não foi feito fica "não feito" e as tarefas únicas escolhidas passam para a
 * semana seguinte, com a marca "vem da semana passada" (regra 8). As recorrentes não passam:
 * a semana seguinte recebe as suas na proposta.
 *
 * Se a semana seguinte já tinha sido proposta antes da revisão, levou todas as tarefas por fazer;
 * aqui saem as que afinal não passam (desmarcadas, ou entretanto feitas), desde que ninguém lhes tenha mexido.
 */
export function fecharRevisao(semana: string, transitar: number[], hoje: Date = new Date()): void {
  const seguinte = somarSemanas(semana, 1);
  db.transaction((tx) => {
    tx.insert(revisoes)
      .values({ semana, fechadaEm: AGORA })
      .onConflictDoUpdate({ target: revisoes.semana, set: { fechadaEm: AGORA, atualizadoEm: AGORA } })
      .run();
    tx.update(tarefasSemana)
      .set({ estado: 'nao_feita', atualizadoEm: AGORA })
      .where(and(eq(tarefasSemana.semana, semana), inArray(tarefasSemana.estado, ['por_alocar', 'alocada'])))
      .run();

    const passam = new Set<number>();
    for (const tarefaId of new Set(transitar)) {
      const tarefa = tx.select({ recorrencia: tarefas.recorrencia }).from(tarefas).where(eq(tarefas.id, tarefaId)).get();
      if (!tarefa || tarefa.recorrencia) continue;
      const porFazer = tx
        .select({ n: count() })
        .from(tarefasSemana)
        .where(and(eq(tarefasSemana.tarefaId, tarefaId), eq(tarefasSemana.semana, semana), ne(tarefasSemana.estado, 'feita')))
        .get();
      // Não repete se a revisão for fechada duas vezes.
      const jaPassou = tx
        .select({ n: count() })
        .from(tarefasSemana)
        .where(and(eq(tarefasSemana.tarefaId, tarefaId), eq(tarefasSemana.semana, seguinte)))
        .get();
      if (!porFazer?.n) continue;
      passam.add(tarefaId);
      if (!jaPassou?.n) tx.insert(tarefasSemana).values({ tarefaId, semana: seguinte, transitadaDe: semana }).run();
    }

    const transitadas = tx
      .select({ id: tarefasSemana.id, tarefaId: tarefasSemana.tarefaId, estado: tarefasSemana.estado, blocoId: blocos.id })
      .from(tarefasSemana)
      .leftJoin(blocos, eq(blocos.tarefaSemanaId, tarefasSemana.id))
      .where(and(eq(tarefasSemana.semana, seguinte), eq(tarefasSemana.transitadaDe, semana)))
      .all();
    const aRetirar = transitadas.filter((i) => !passam.has(i.tarefaId) && i.estado === 'por_alocar' && i.blocoId === null).map((i) => i.id);
    if (aRetirar.length) tx.delete(tarefasSemana).where(inArray(tarefasSemana.id, aRetirar)).run();
  });
  garantirSemana(seguinte, hoje);
}

/** Volta a abrir uma revisão fechada (ex.: fechada por engano). O que já passou para a semana seguinte fica lá. */
export function reabrirRevisao(semana: string): void {
  db.transaction((tx) => {
    tx.update(revisoes).set({ fechadaEm: null, atualizadoEm: AGORA }).where(eq(revisoes.semana, semana)).run();
    const naoFeitas = tx
      .select({ id: tarefasSemana.id, blocoId: blocos.id })
      .from(tarefasSemana)
      .leftJoin(blocos, eq(blocos.tarefaSemanaId, tarefasSemana.id))
      .where(and(eq(tarefasSemana.semana, semana), eq(tarefasSemana.estado, 'nao_feita')))
      .all();
    for (const i of naoFeitas) {
      tx.update(tarefasSemana)
        .set({ estado: i.blocoId === null ? 'por_alocar' : 'alocada', atualizadoEm: AGORA })
        .where(eq(tarefasSemana.id, i.id))
        .run();
    }
  });
}
