/** Regras da cópia de uma semana para a seguinte que não dependem da base de dados. */

import { sobrepoem } from './calendario';
import { MINUTOS_DIA } from './semana';

/** "por_planear" = a semana ainda não tem plano (só nas semanas que já passaram). */
export type EstadoDaSemana = 'por_planear' | 'aceite';

/** Resposta a "Só esta semana" ou "Esta e as seguintes", ao mexer num bloco de uma tarefa recorrente. */
export type Ambito = 'semana' | 'seguintes';

/** Um lugar na semana: dia (0 = segunda … 6 = domingo) e minutos desde a meia-noite. */
export type Lugar = { dia: number; inicioMin: number; fimMin: number };

export function mesmoLugar(a: Pick<Lugar, 'dia' | 'inicioMin'>, b: Pick<Lugar, 'dia' | 'inicioMin'>): boolean {
  return a.dia === b.dia && a.inicioMin === b.inicioMin;
}

/**
 * Os lugares da semana de origem que a proposta copia para uma tarefa: os que a semana nova ainda
 * não tem, por ordem, até ao número de instâncias livres.
 */
export function lugaresACopiar<L extends Lugar>(daOrigem: L[], jaOcupados: Pick<Lugar, 'dia' | 'inicioMin'>[], livres: number): L[] {
  if (livres <= 0) return [];
  const usados = [...jaOcupados];
  const escolhidos: L[] = [];
  for (const lugar of [...daOrigem].sort((a, b) => a.dia - b.dia || a.inicioMin - b.inicioMin)) {
    if (escolhidos.length >= livres) break;
    if (usados.some((u) => mesmoLugar(u, lugar))) continue;
    usados.push(lugar);
    escolhidos.push(lugar);
  }
  return escolhidos;
}

/**
 * Fim do bloco copiado. Se o bloco de origem tinha a duração que a tarefa tinha nessa altura, segue a
 * duração de agora; se o utilizador o tinha ajustado à mão, fica como estava.
 */
export function fimCopiado(lugar: Lugar, duracaoNaOrigem: number | null, duracaoAgora: number): number {
  const duracao = lugar.fimMin - lugar.inicioMin === duracaoNaOrigem ? duracaoAgora : lugar.fimMin - lugar.inicioMin;
  return Math.min(MINUTOS_DIA, lugar.inicioMin + duracao);
}

export type BlocoDaProposta = Lugar & { id: number; nome: string; areaId: number | null };

export type Sobreposicao = {
  dia: number;
  /** O intervalo em que os dois blocos coincidem. */
  inicioMin: number;
  fimMin: number;
  a: { id: number; nome: string };
  b: { id: number; nome: string };
};

/** Todos os pares de blocos que se sobrepõem na semana, pela ordem do calendário. */
export function sobreposicoesDaSemana(blocos: BlocoDaProposta[]): Sobreposicao[] {
  const ordenados = [...blocos].sort((a, b) => a.dia - b.dia || a.inicioMin - b.inicioMin || a.id - b.id);
  const pares: Sobreposicao[] = [];
  for (let i = 0; i < ordenados.length; i++) {
    for (let j = i + 1; j < ordenados.length; j++) {
      const a = ordenados[i];
      const b = ordenados[j];
      if (b.dia !== a.dia || b.inicioMin >= a.fimMin) break;
      if (!sobrepoem(a, b)) continue;
      pares.push({ dia: a.dia, inicioMin: Math.max(a.inicioMin, b.inicioMin), fimMin: Math.min(a.fimMin, b.fimMin), a: { id: a.id, nome: a.nome }, b: { id: b.id, nome: b.nome } });
    }
  }
  return pares;
}
