import { and, asc, eq } from 'drizzle-orm';

import { carregarCalendario, type BlocoCalendario } from '@/data/calendario';
import { carregarPlano } from '@/data/tarefas';
import { db } from '@/db/client';
import { tarefasSemana, type Area } from '@/db/schema';
import { deDataISO, indiceDoDia, inicioDaSemana } from '@/domain/semana';
import { diasDaTarefa, type ResumoTarefa } from '@/domain/tarefas';

/*
 * O dia de hoje: os blocos do calendário de hoje, por ordem de hora, e as tarefas sem duração da
 * semana (as que se contam cada vez que se fazem). É o ecrã de todos os dias; a semana planeia-se
 * nos outros separadores.
 */

export type DiaDeHoje = {
  /** Hoje, AAAA-MM-DD, e a segunda-feira da sua semana. */
  dia: string;
  semana: string;
  /** Os blocos de hoje (tarefas e "Ocupado"), por ordem de início. */
  blocos: BlocoCalendario[];
  /** Tarefas sem duração marcadas para hoje (todos os dias, dias certos ou o dia escolhido), uma por linha. */
  paraHoje: { instanciaId: number; feita: boolean; tarefa: ResumoTarefa; area: Pick<Area, 'id' | 'nome' | 'cor'> }[];
  /** Tarefas sem duração e sem dia (ex.: "3× por semana"), que se fazem em qualquer dia: contam-se na semana. */
  semHora: { area: Pick<Area, 'id' | 'nome' | 'cor'>; tarefas: ResumoTarefa[] }[];
  /** Instâncias com duração desta semana que ainda não têm lugar no calendário. */
  porAlocar: number;
  /** Há áreas criadas (sem elas não há nada para mostrar). */
  temAreas: boolean;
};

export function carregarHoje(hoje: string): DiaDeHoje {
  const semana = inicioDaSemana(deDataISO(hoje));
  const indice = indiceDoDia(hoje);
  const calendario = carregarCalendario(semana);
  const plano = carregarPlano(semana);
  return {
    dia: hoje,
    semana,
    blocos: calendario.blocos.filter((b) => b.dia === indice).sort((a, b) => a.inicioMin - b.inicioMin || a.fimMin - b.fimMin || a.id - b.id),
    paraHoje: db
      .select({ id: tarefasSemana.id, tarefaId: tarefasSemana.tarefaId, estado: tarefasSemana.estado })
      .from(tarefasSemana)
      .where(and(eq(tarefasSemana.semana, semana), eq(tarefasSemana.dia, hoje)))
      .orderBy(asc(tarefasSemana.id))
      .all()
      .flatMap((i) => {
        const grupo = plano.areas.find((g) => g.tarefas.some((tf) => tf.id === i.tarefaId));
        const tarefa = grupo?.tarefas.find((tf) => tf.id === i.tarefaId);
        if (!grupo || !tarefa || tarefa.duracaoMin !== null) return [];
        return [{ instanciaId: i.id, feita: i.estado === 'feita', tarefa, area: { id: grupo.area.id, nome: grupo.area.nome, cor: grupo.area.cor } }];
      }),
    semHora: plano.areas
      .map(({ area, tarefas }) => ({ area: { id: area.id, nome: area.nome, cor: area.cor }, tarefas: tarefas.filter((tf) => tf.duracaoMin === null && diasDaTarefa(tf).length === 0) }))
      .filter((g) => g.tarefas.length > 0),
    porAlocar: calendario.porAlocar.reduce((soma, tf) => soma + tf.quantas, 0),
    temAreas: plano.areas.length > 0,
  };
}
