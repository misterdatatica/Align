import { eq } from 'drizzle-orm';

import { carregarCalendario } from '@/data/calendario';
import { planearSemana } from '@/data/semanas';
import { db } from '@/db/client';
import { semanas } from '@/db/schema';
import type { BlocoParaAvisar } from '@/domain/avisos';
import { indiceDoDia, inicioDaSemana, paraDataISO, somarSemanas } from '@/domain/semana';

/**
 * Os blocos das tarefas por fazer desta semana e da seguinte, para os avisos. A partir de sexta-feira a
 * semana seguinte é planeada (igual a esta, como faria ao abri-la), para os avisos de segunda chegarem
 * mesmo que a app não seja aberta no fim de semana.
 */
export function blocosParaAvisar(agora: Date = new Date()): BlocoParaAvisar[] {
  const atual = inicioDaSemana(agora);
  const seguinte = somarSemanas(atual, 1);
  const existe = (s: string) => !!db.select({ semana: semanas.semana }).from(semanas).where(eq(semanas.semana, s)).get();
  // Só se ainda não existir: os avisos refazem-se a cada mudança e não devem escrever nada quando nada mudou.
  if (indiceDoDia(paraDataISO(agora)) >= 4 && !existe(seguinte)) planearSemana(seguinte, agora);
  return [atual, seguinte]
    .filter(existe)
    .flatMap((s) => {
      const calendario = carregarCalendario(s);
      return calendario.blocos
        .filter((b) => b.tipo === 'tarefa' && !b.feito)
        .map((b) => ({ id: b.id, nome: b.nome, area: b.area, dia: calendario.dias[b.dia], inicioMin: b.inicioMin, fimMin: b.fimMin }));
    });
}
