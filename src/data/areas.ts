import { asc, count, eq, sql } from 'drizzle-orm';

import { carregarMetasDaArea, type MetaDetalhada } from '@/data/metas';
import { carregarPlano } from '@/data/tarefas';
import { db } from '@/db/client';
import { areas, type Area } from '@/db/schema';
import { MAX_AREAS, podeCriarArea } from '@/domain/regras';
import type { ResumoTarefa } from '@/domain/tarefas';
import { ErroDaApp } from '@/domain/erros';

export const consultaAreasAtivas = () =>
  db.select().from(areas).where(eq(areas.arquivada, false)).orderBy(asc(areas.ordem), asc(areas.id));

export const consultaAreasArquivadas = () => db.select().from(areas).where(eq(areas.arquivada, true)).orderBy(asc(areas.nome));

export class LimiteDeAreasError extends ErroDaApp {
  constructor() {
    super(`Pode ter no máximo ${MAX_AREAS} áreas ativas. Arquive uma para criar outra.`);
  }
}

export async function criarArea(dados: { nome: string; cor: string; icone: string; missao: string }) {
  const nome = dados.nome.trim();
  if (!nome) throw new ErroDaApp('A área precisa de um nome.');
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
    if (!dados.nome) throw new ErroDaApp('A área precisa de um nome.');
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
export function arquivarArea(id: number): void {
  db.update(areas).set({ arquivada: true }).where(eq(areas.id, id)).run();
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

/** O detalhe de uma área numa semana: as suas metas e as tarefas dessa semana. */
export function carregarAreaNaSemana(areaId: number, semana: string, hoje: string): { area: Area; metas: MetaDetalhada[]; tarefas: ResumoTarefa[] } | null {
  const area = db.select().from(areas).where(eq(areas.id, areaId)).get();
  if (!area) return null;
  const daArea = carregarPlano(semana).areas.find((a) => a.area.id === areaId)?.tarefas ?? [];
  return { area, metas: carregarMetasDaArea(areaId, semana, hoje), tarefas: daArea };
}
