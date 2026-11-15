/** Regras do calendário semanal que não dependem da base de dados nem do ecrã. */

import { MINUTOS_DIA, formatarHora } from './semana';

/** Os blocos encaixam em intervalos de 30 minutos (regra 7 da especificação). */
export const PASSO_MIN = 30;

/** Arredonda para a meia hora mais próxima. */
export function encaixar(minutos: number): number {
  return Math.round(minutos / PASSO_MIN) * PASSO_MIN;
}

/**
 * Início de um bloco de `duracao` minutos que o utilizador largou em `minutos`:
 * encaixado na meia hora e sem sair da grelha.
 */
export function inicioEncaixado(minutos: number, duracao: number, inicioGrelha: number, fimGrelha: number): number {
  const maximo = Math.max(inicioGrelha, fimGrelha - duracao);
  return Math.min(maximo, Math.max(inicioGrelha, encaixar(minutos)));
}

/** Fim de um bloco que está a ser esticado ou encolhido: pelo menos meia hora, no máximo até ao fim da grelha. */
export function fimEncaixado(minutos: number, inicio: number, fimGrelha: number): number {
  return Math.min(Math.max(fimGrelha, inicio + PASSO_MIN), Math.max(inicio + PASSO_MIN, encaixar(minutos)));
}

export type Intervalo = { id: number; inicioMin: number; fimMin: number };

export function sobrepoem(a: Pick<Intervalo, 'inicioMin' | 'fimMin'>, b: Pick<Intervalo, 'inicioMin' | 'fimMin'>): boolean {
  return a.inicioMin < b.fimMin && b.inicioMin < a.fimMin;
}

/** Os outros blocos do mesmo dia que se sobrepõem a `alvo`. */
export function sobrepostos<T extends Intervalo>(blocosDoDia: T[], alvo: Intervalo): T[] {
  return blocosDoDia.filter((b) => b.id !== alvo.id && sobrepoem(b, alvo));
}

export type Disposicao = { coluna: number; colunas: number };

/**
 * Blocos sobrepostos no mesmo dia ficam lado a lado, cada um na sua coluna (como nos calendários habituais).
 * Devolve, para cada bloco, a coluna que ocupa e quantas colunas tem o seu grupo.
 */
export function disporDia(blocosDoDia: Intervalo[]): Map<number, Disposicao> {
  const ordenados = [...blocosDoDia].sort((a, b) => a.inicioMin - b.inicioMin || b.fimMin - a.fimMin || a.id - b.id);
  const resultado = new Map<number, Disposicao>();
  let grupo: { id: number; coluna: number }[] = [];
  let fimDoGrupo = -1;
  let fimDasColunas: number[] = [];

  const fecharGrupo = () => {
    for (const membro of grupo) resultado.set(membro.id, { coluna: membro.coluna, colunas: fimDasColunas.length });
    grupo = [];
    fimDasColunas = [];
  };

  for (const b of ordenados) {
    if (grupo.length > 0 && b.inicioMin >= fimDoGrupo) fecharGrupo();
    let coluna = fimDasColunas.findIndex((fim) => fim <= b.inicioMin);
    if (coluna === -1) coluna = fimDasColunas.length;
    fimDasColunas[coluna] = b.fimMin;
    grupo.push({ id: b.id, coluna });
    fimDoGrupo = Math.max(fimDoGrupo, b.fimMin);
  }
  fecharGrupo();
  return resultado;
}

/**
 * Horas mostradas na grelha: as das definições, alargadas se houver blocos fora delas
 * (para nenhum bloco ficar escondido). Em minutos desde a meia-noite, sempre em horas certas.
 */
export function limitesDaGrelha(inicioHora: number, fimHora: number, blocos: Pick<Intervalo, 'inicioMin' | 'fimMin'>[]): { inicioMin: number; fimMin: number } {
  let inicioMin = Math.max(0, Math.min(23, inicioHora)) * 60;
  let fimMin = Math.max(inicioMin + 60, Math.min(24, fimHora) * 60);
  for (const b of blocos) {
    inicioMin = Math.min(inicioMin, Math.floor(b.inicioMin / 60) * 60);
    fimMin = Math.max(fimMin, Math.min(MINUTOS_DIA, Math.ceil(b.fimMin / 60) * 60));
  }
  return { inicioMin, fimMin };
}

/** "09:00–11:00". */
export function formatarIntervalo(inicioMin: number, fimMin: number): string {
  return `${formatarHora(inicioMin)}–${formatarHora(fimMin)}`;
}
