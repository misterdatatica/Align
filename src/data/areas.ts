import { and, asc, count, eq, sql } from 'drizzle-orm';

import { carregarPlano } from '@/data/tarefas';
import { db } from '@/db/client';
import { areas, metas, type Area, type Meta } from '@/db/schema';
import { MAX_AREAS, podeCriarArea, type PeriodoMeta, type TipoMeta } from '@/domain/regras';
import { progressoDaMeta, type ProgressoMeta, type ResumoTarefa } from '@/domain/tarefas';

export const consultaAreasAtivas = () =>
  db.select().from(areas).where(eq(areas.arquivada, false)).orderBy(asc(areas.ordem), asc(areas.id));

export const consultaAreasArquivadas = () => db.select().from(areas).where(eq(areas.arquivada, true)).orderBy(asc(areas.nome));

export const consultaMetas = (areaId: number) =>
  db.select().from(metas).where(eq(metas.areaId, areaId)).orderBy(asc(metas.id));

export class LimiteDeAreasError extends Error {
  constructor() {
    super(`Pode ter no máximo ${MAX_AREAS} áreas ativas. Arquive uma para criar outra.`);
  }
}

export async function criarArea(dados: { nome: string; cor: string; icone: string; missao: string }) {
  const nome = dados.nome.trim();
  if (!nome) throw new Error('A área precisa de um nome.');
  const [{ total }] = await db.select({ total: count() }).from(areas).where(eq(areas.arquivada, false));
  if (!podeCriarArea(total)) throw new LimiteDeAreasError();
  const [criada] = await db
    .insert(areas)
    .values({ ...dados, nome, missao: dados.missao.trim(), ordem: total })
    .returning();
  return criada;
}

export async function atualizarArea(
  id: number,
  dados: Partial<{ nome: string; cor: string; icone: string; missao: string }>,
) {
  if (dados.nome !== undefined) {
    dados = { ...dados, nome: dados.nome.trim() };
    if (!dados.nome) throw new Error('A área precisa de um nome.');
  }
  await db
    .update(areas)
    .set({ ...dados, atualizadoEm: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
    .where(eq(areas.id, id));
}

/** Guarda a ordem das áreas tal como o utilizador as arrumou: recebe os ids pela ordem nova. */
export function reordenarAreas(ids: number[]): void {
  db.transaction((tx) => {
    ids.forEach((id, ordem) => {
      tx.update(areas).set({ ordem }).where(eq(areas.id, id)).run();
    });
  });
}

/** Arquivar esconde a área sem apagar o histórico (opção sugerida pela especificação). */
export async function arquivarArea(id: number) {
  await db.update(areas).set({ arquivada: true }).where(eq(areas.id, id));
}

/** Volta a mostrar uma área arquivada, se ainda couber no limite de áreas ativas. */
export async function reporArea(id: number) {
  const [{ total }] = await db.select({ total: count() }).from(areas).where(eq(areas.arquivada, false));
  if (!podeCriarArea(total)) throw new LimiteDeAreasError();
  await db
    .update(areas)
    .set({ arquivada: false, ordem: total, atualizadoEm: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
    .where(eq(areas.id, id));
}

export async function criarMeta(dados: {
  areaId: number;
  descricao: string;
  tipo: TipoMeta;
  alvoSemanal: number;
  periodo: PeriodoMeta;
  unidade?: string | null;
}) {
  if (!dados.descricao.trim()) throw new Error('A meta precisa de uma descrição.');
  // A unidade só faz sentido nas metas de vezes; vazia = "vezes".
  const unidade = dados.tipo === 'vezes' ? dados.unidade?.trim() || null : null;
  await db.insert(metas).values({ ...dados, descricao: dados.descricao.trim(), unidade });
}

export async function atualizarMeta(
  id: number,
  dados: { descricao: string; tipo: TipoMeta; alvoSemanal: number; periodo: PeriodoMeta; unidade?: string | null },
) {
  if (!dados.descricao.trim()) throw new Error('A meta precisa de uma descrição.');
  const unidade = dados.tipo === 'vezes' ? dados.unidade?.trim() || null : null;
  await db
    .update(metas)
    .set({ ...dados, descricao: dados.descricao.trim(), unidade, atualizadoEm: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
    .where(eq(metas.id, id));
}

export async function apagarMeta(id: number, areaId: number) {
  await db.delete(metas).where(and(eq(metas.id, id), eq(metas.areaId, areaId)));
}

export type MetaComProgresso = Meta & { progresso: ProgressoMeta };

/** O detalhe de uma área numa semana: metas com o seu progresso e as tarefas dessa semana. */
export function carregarAreaNaSemana(areaId: number, semana: string): { area: Area; metas: MetaComProgresso[]; tarefas: ResumoTarefa[] } | null {
  const area = db.select().from(areas).where(eq(areas.id, areaId)).get();
  if (!area) return null;
  const daArea = carregarPlano(semana).areas.find((a) => a.area.id === areaId)?.tarefas ?? [];
  const listaMetas = consultaMetas(areaId).all();
  return { area, metas: listaMetas.map((m) => ({ ...m, progresso: progressoDaMeta(m.id, daArea) })), tarefas: daArea };
}
