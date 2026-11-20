import { carregarCalendario, type BlocoCalendario } from '@/data/calendario';
import { carregarPlano } from '@/data/tarefas';
import type { Area } from '@/db/schema';
import { deDataISO, indiceDoDia, inicioDaSemana } from '@/domain/semana';
import type { ResumoTarefa } from '@/domain/tarefas';

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
  /** Tarefas sem duração desta semana, agrupadas por área. */
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
    semHora: plano.areas
      .map(({ area, tarefas }) => ({ area: { id: area.id, nome: area.nome, cor: area.cor }, tarefas: tarefas.filter((t) => t.duracaoMin === null) }))
      .filter((g) => g.tarefas.length > 0),
    porAlocar: calendario.porAlocar.reduce((soma, t) => soma + t.quantas, 0),
    temAreas: plano.areas.length > 0,
  };
}
