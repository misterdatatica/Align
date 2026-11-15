/** Regras da revisão semanal que não dependem da base de dados. */

import { diasDaSemana, indiceDoDia } from './semana';

/** Nomes dos dias pela numeração das definições: 0 = domingo … 6 = sábado. */
export const DIAS_DE_REVISAO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;

/** Posição do dia da revisão numa semana que começa à segunda: domingo (0) fica em 6. */
export function posicaoDoDiaDeRevisao(diaRevisao: number): number {
  return (diaRevisao + 6) % 7;
}

/** Regra 8: a revisão da semana fica disponível a partir do dia escolhido (por omissão, domingo). */
export function revisaoDisponivel(hoje: string, diaRevisao: number): boolean {
  return indiceDoDia(hoje) >= posicaoDoDiaDeRevisao(diaRevisao);
}

/** Dia (AAAA-MM-DD) em que abre a revisão de uma semana. */
export function diaEmQueAbre(semana: string, diaRevisao: number): string {
  return diasDaSemana(semana)[posicaoDoDiaDeRevisao(diaRevisao)];
}

/** "Cumpriu 77% do plano": percentagem inteira, 0 quando não havia nada planeado. */
export function percentagemCumprida(minutosFeitos: number, minutosPlaneados: number): number {
  if (minutosPlaneados <= 0) return 0;
  return Math.round((minutosFeitos / minutosPlaneados) * 100);
}
