import { t } from '../i18n/index.ts';
import { ErroDaApp } from './erros';

/** Dias na descrição dos "dias certos" ("seg, qua, sex"), traduzidos com `t()`. */
export const DIAS_ABREVIADOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const;

/** Como uma tarefa se repete ao longo da semana. */
export type Recorrencia =
  | { tipo: 'diaria' }
  | { tipo: 'vezes_por_semana'; vezes: number }
  /** Dias da semana, 1 = segunda … 7 = domingo. */
  | { tipo: 'dias'; dias: number[] };

/** Quantas instâncias uma tarefa gera numa semana. Tarefa única = 1. */
export function instanciasPorSemana(recorrencia: Recorrencia | null | undefined): number {
  if (!recorrencia) return 1;
  switch (recorrencia.tipo) {
    case 'diaria':
      return 7;
    case 'vezes_por_semana':
      return Math.max(1, Math.min(7, Math.floor(recorrencia.vezes)));
    case 'dias':
      return new Set(recorrencia.dias.filter((d) => d >= 1 && d <= 7)).size;
  }
}

/** Texto curto para a lista de tarefas, ex. "todos os dias", "4× por semana". */
export function descreverRecorrencia(recorrencia: Recorrencia | null | undefined): string | null {
  if (!recorrencia) return null;
  switch (recorrencia.tipo) {
    case 'diaria':
      return t('todos os dias');
    case 'vezes_por_semana':
      return t('{n}× por semana', { n: instanciasPorSemana(recorrencia) });
    case 'dias': {
      const dias = [...new Set(recorrencia.dias)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
      return dias.map((d) => t(DIAS_ABREVIADOS[d - 1])).join(', ');
    }
  }
}

/**
 * Valida e arruma uma recorrência antes de a guardar. Devolve null para "não repete".
 * 7 dias escolhidos ou 7 vezes por semana é o mesmo que "todos os dias".
 */
export function normalizarRecorrencia(recorrencia: Recorrencia | null | undefined): Recorrencia | null {
  if (!recorrencia) return null;
  switch (recorrencia.tipo) {
    case 'diaria':
      return { tipo: 'diaria' };
    case 'vezes_por_semana': {
      if (!Number.isInteger(recorrencia.vezes) || recorrencia.vezes < 1 || recorrencia.vezes > 7) {
        throw new ErroDaApp(t('As vezes por semana têm de ser um número entre 1 e 7.'));
      }
      return recorrencia.vezes === 7 ? { tipo: 'diaria' } : { tipo: 'vezes_por_semana', vezes: recorrencia.vezes };
    }
    case 'dias': {
      const dias = [...new Set(recorrencia.dias)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort((a, b) => a - b);
      if (dias.length === 0) throw new ErroDaApp(t('Escolha pelo menos um dia da semana.'));
      return dias.length === 7 ? { tipo: 'diaria' } : { tipo: 'dias', dias };
    }
  }
}
