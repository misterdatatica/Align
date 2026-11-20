import { t } from '../i18n/index.ts';
import { deDataISO, MESES, MESES_LONGOS, paraDataISO } from './semana.ts';

/*
 * Os períodos das estatísticas: um mês ou um ano. Uma semana conta para o mês (e o ano) em que tem
 * mais dias, que é o da sua quinta-feira: a semana de 30 nov a 6 dez é de dezembro.
 */

export type TipoDePeriodo = 'mes' | 'ano';

/** Um mês ou um ano, identificado pelo primeiro dia (AAAA-MM-DD). */
export type Periodo = { tipo: TipoDePeriodo; inicio: string };

const somarDias = (dataISO: string, n: number) => {
  const d = deDataISO(dataISO);
  d.setDate(d.getDate() + n);
  return paraDataISO(d);
};

/** O mês ou o ano que contém o dia. */
export function periodoDe(tipo: TipoDePeriodo, dataISO: string): Periodo {
  const d = deDataISO(dataISO);
  return { tipo, inicio: paraDataISO(new Date(d.getFullYear(), tipo === 'mes' ? d.getMonth() : 0, 1)) };
}

/** O período n meses (ou anos) depois (n negativo = antes). */
export function somarPeriodo(p: Periodo, n: number): Periodo {
  const d = deDataISO(p.inicio);
  return { tipo: p.tipo, inicio: paraDataISO(p.tipo === 'mes' ? new Date(d.getFullYear(), d.getMonth() + n, 1) : new Date(d.getFullYear() + n, 0, 1)) };
}

/** Primeiro dia depois do período. */
export function fimDoPeriodo(p: Periodo): string {
  return somarPeriodo(p, 1).inicio;
}

/** A quinta-feira de uma semana (dada pela segunda-feira): diz a que mês a semana pertence. */
export function quintaDaSemana(semana: string): string {
  return somarDias(semana, 3);
}

/** As semanas (segundas-feiras) do período, por ordem. */
export function semanasDoPeriodo(p: Periodo): string[] {
  const fim = fimDoPeriodo(p);
  // A primeira semana é a que tem a quinta-feira no primeiro dia do período ou logo a seguir.
  const d = deDataISO(p.inicio);
  const recuo = (d.getDay() + 6) % 7; // dias desde segunda-feira
  let semana = somarDias(p.inicio, -recuo);
  if (quintaDaSemana(semana) < p.inicio) semana = somarDias(semana, 7);
  const semanas: string[] = [];
  for (; quintaDaSemana(semana) < fim; semana = somarDias(semana, 7)) semanas.push(semana);
  return semanas;
}

/** Índice do mês (0 = janeiro) a que a semana pertence. */
export function mesDaSemana(semana: string): number {
  return deDataISO(quintaDaSemana(semana)).getMonth();
}

/** "novembro de 2026" ou "2026". */
export function descreverPeriodo(p: Periodo): string {
  const d = deDataISO(p.inicio);
  return p.tipo === 'ano' ? String(d.getFullYear()) : t('{mes} de {ano}', { mes: t(MESES_LONGOS[d.getMonth()]), ano: d.getFullYear() });
}

/** "nov" — rótulo curto de um mês, para as colunas do ano. */
export function rotuloDoMes(indice: number): string {
  return t(MESES[indice]);
}

/** Percentagem inteira de feito sobre planeado; null se nada foi planeado. */
export function percentagem(feito: number, planeado: number): number | null {
  return planeado > 0 ? Math.round((feito / planeado) * 100) : null;
}
