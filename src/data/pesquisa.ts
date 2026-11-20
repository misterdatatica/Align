import { asc, eq, gt, isNull, max, or } from 'drizzle-orm';

import { db } from '@/db/client';
import { areas, metas, tarefas, tarefasSemana } from '@/db/schema';
import type { EstadoMeta } from '@/domain/metas';
import type { Recorrencia } from '@/domain/recorrencia';

/*
 * Pesquisa de áreas, metas e tarefas pelo nome. Os dados de uma pessoa são poucos, por isso lê-se tudo
 * o que está em vigor e filtra-se aqui, sem ligar a maiúsculas nem a acentos ("licao" encontra "Lição").
 */

/** Texto para comparar: minúsculas e sem acentos. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Todas as palavras da pesquisa aparecem no texto, por qualquer ordem. */
export function corresponde(texto: string, pesquisa: string): boolean {
  const alvo = normalizarTexto(texto);
  return normalizarTexto(pesquisa)
    .split(/\s+/)
    .filter(Boolean)
    .every((palavra) => alvo.includes(palavra));
}

type AreaResumida = { id: number; nome: string; cor: string };

export type ResultadoDaPesquisa = {
  areas: (AreaResumida & { icone: string })[];
  metas: { id: number; descricao: string; estado: EstadoMeta; prazo: string; area: AreaResumida }[];
  /** `semana` é a semana em que a tarefa se abre: a atual, se repete, ou a última em que esteve, se é única. */
  tarefas: { id: number; nome: string; duracaoMin: number | null; recorrencia: Recorrencia | null; semana: string; area: AreaResumida }[];
};

const MAXIMO = 30;

export function pesquisar(texto: string, semanaAtual: string): ResultadoDaPesquisa {
  if (!normalizarTexto(texto)) return { areas: [], metas: [], tarefas: [] };

  const listaAreas = db
    .select({ id: areas.id, nome: areas.nome, cor: areas.cor, icone: areas.icone, missao: areas.missao })
    .from(areas)
    .where(eq(areas.arquivada, false))
    .orderBy(asc(areas.ordem), asc(areas.id))
    .all();
  const areaPorId = new Map(listaAreas.map((a) => [a.id, { id: a.id, nome: a.nome, cor: a.cor }]));

  const listaMetas = db
    .select({ id: metas.id, descricao: metas.descricao, estado: metas.estado, prazo: metas.prazo, areaId: metas.areaId })
    .from(metas)
    .orderBy(asc(metas.id))
    .all()
    .filter((m) => areaPorId.has(m.areaId) && corresponde(m.descricao, texto));

  // Só a versão em vigor de cada tarefa (as versões antigas ficam fechadas com semanaFim).
  const listaTarefas = db
    .select({
      id: tarefas.id,
      nome: tarefas.nome,
      duracaoMin: tarefas.duracaoMin,
      recorrencia: tarefas.recorrencia,
      semanaInicio: tarefas.semanaInicio,
      areaId: tarefas.areaId,
      ultimaSemana: max(tarefasSemana.semana),
    })
    .from(tarefas)
    .leftJoin(tarefasSemana, eq(tarefasSemana.tarefaId, tarefas.id))
    .where(or(isNull(tarefas.semanaFim), gt(tarefas.semanaFim, semanaAtual)))
    .groupBy(tarefas.id)
    .orderBy(asc(tarefas.id))
    .all()
    .filter((tf) => areaPorId.has(tf.areaId) && corresponde(tf.nome, texto));

  return {
    areas: listaAreas.filter((a) => corresponde(`${a.nome} ${a.missao}`, texto)).map(({ id, nome, cor, icone }) => ({ id, nome, cor, icone })),
    metas: listaMetas.slice(0, MAXIMO).map((m) => ({ id: m.id, descricao: m.descricao, estado: m.estado, prazo: m.prazo, area: areaPorId.get(m.areaId)! })),
    tarefas: listaTarefas.slice(0, MAXIMO).map((tf) => {
      const semana = tf.recorrencia ? (tf.semanaInicio > semanaAtual ? tf.semanaInicio : semanaAtual) : (tf.ultimaSemana ?? tf.semanaInicio);
      return { id: tf.id, nome: tf.nome, duracaoMin: tf.duracaoMin, recorrencia: tf.recorrencia, semana, area: areaPorId.get(tf.areaId)! };
    }),
  };
}
