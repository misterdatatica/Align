import { and, asc, count, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { areas, metas } from '@/db/schema';
import { MAX_AREAS, podeCriarArea } from '@/domain/regras';

export const consultaAreasAtivas = () =>
  db.select().from(areas).where(eq(areas.arquivada, false)).orderBy(asc(areas.ordem), asc(areas.id));

export const consultaArea = (id: number) => db.select().from(areas).where(eq(areas.id, id));

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
  await db
    .update(areas)
    .set({ ...dados, atualizadoEm: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
    .where(eq(areas.id, id));
}

/** Arquivar esconde a área sem apagar o histórico (opção sugerida pela especificação). */
export async function arquivarArea(id: number) {
  await db.update(areas).set({ arquivada: true }).where(eq(areas.id, id));
}

export async function criarMeta(dados: { areaId: number; descricao: string; tipo: 'horas' | 'vezes'; alvoSemanal: number }) {
  if (!dados.descricao.trim()) throw new Error('A meta precisa de uma descrição.');
  await db.insert(metas).values({ ...dados, descricao: dados.descricao.trim() });
}

export async function apagarMeta(id: number, areaId: number) {
  await db.delete(metas).where(and(eq(metas.id, id), eq(metas.areaId, areaId)));
}
