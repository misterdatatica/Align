import { and, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { blocos } from '@/db/schema';
import { pedacosDoEvento, type EventoDoTelemovel } from '@/domain/eventos';
import { paraDataHora } from '@/domain/semana';

/*
 * Os eventos dos calendários do telemóvel guardados como blocos "Ocupado" (com `eventoId`), para o
 * calendário, o Hoje e os avisos de sobreposição os verem como os outros. O telemóvel é que manda:
 * cada sincronização acerta os blocos de um intervalo de dias pelo que lá está. Ver src/eventos.ts.
 */

const AGORA = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export type ResultadoDaSincronizacao = { novos: number; mudados: number; apagados: number };

/**
 * Põe os eventos entre `desde` e `ate` (AAAA-MM-DD; `ate` fica de fora) como blocos "Ocupado":
 * acrescenta os novos, acerta os que mudaram e tira os que já não existem. Quando nada mudou, não
 * escreve nada (os ecrãs não voltam a ler a base de dados sem precisar).
 */
export function sincronizarEventos(eventos: EventoDoTelemovel[], desde: string, ate: string): ResultadoDaSincronizacao {
  const pedacos = new Map(
    eventos
      .flatMap(pedacosDoEvento)
      .filter((p) => p.dia >= desde && p.dia < ate)
      .map((p) => [p.chave, { titulo: p.titulo, inicio: paraDataHora(p.dia, p.inicioMin), fim: paraDataHora(p.dia, p.fimMin) }]),
  );
  return db.transaction((tx) => {
    const resultado: ResultadoDaSincronizacao = { novos: 0, mudados: 0, apagados: 0 };
    const existentes = tx
      .select({ id: blocos.id, eventoId: blocos.eventoId, titulo: blocos.titulo, inicio: blocos.inicio, fim: blocos.fim })
      .from(blocos)
      .where(and(isNotNull(blocos.eventoId), gte(blocos.inicio, desde), lt(blocos.inicio, ate)))
      .all();
    for (const b of existentes) {
      const pedaco = pedacos.get(b.eventoId!);
      if (!pedaco) {
        tx.delete(blocos).where(eq(blocos.id, b.id)).run();
        resultado.apagados += 1;
        continue;
      }
      pedacos.delete(b.eventoId!);
      if (b.titulo !== pedaco.titulo || b.inicio !== pedaco.inicio || b.fim !== pedaco.fim) {
        tx.update(blocos).set({ ...pedaco, atualizadoEm: AGORA }).where(eq(blocos.id, b.id)).run();
        resultado.mudados += 1;
      }
    }
    for (const [eventoId, pedaco] of pedacos) {
      tx.insert(blocos).values({ eventoId, ...pedaco }).run();
      resultado.novos += 1;
    }
    return resultado;
  });
}

/** Tira todos os eventos do telemóvel (ao desligar a funcionalidade, ou sem acesso aos calendários). */
export function apagarEventos(): number {
  const existentes = db.select({ id: blocos.id }).from(blocos).where(isNotNull(blocos.eventoId)).all();
  if (existentes.length) db.delete(blocos).where(isNotNull(blocos.eventoId)).run();
  return existentes.length;
}
