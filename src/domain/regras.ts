import { separadorDecimal, t } from '../i18n/index.ts';

/** Regras de negócio da especificação v1 que não dependem da base de dados. */

export const MAX_AREAS = 7;

export function podeCriarArea(areasAtivas: number): boolean {
  return areasAtivas < MAX_AREAS;
}

/** Formata horas à portuguesa: 14 → "14 h", 7.5 → "7,5 h", 0.5 → "30 min". */
export function formatarHoras(horas: number): string {
  if (horas > 0 && horas < 1) return `${Math.round(horas * 60)} min`;
  const arredondado = Math.round(horas * 10) / 10;
  return `${String(arredondado).replace('.', separadorDecimal())} h`;
}

/** "14 de 14 h", "7,5 de 10 h", "30 min de 2 h" — o que já está contra o alvo. */
export function formatarProgressoHoras(horas: number, alvo: number): string {
  const feito = formatarHoras(horas);
  const total = formatarHoras(alvo);
  return t('{feito} de {total}', { feito: feito.endsWith(' h') && total.endsWith(' h') ? feito.slice(0, -2) : feito, total });
}

export function minutosParaHoras(min: number): number {
  return min / 60;
}

/** Os blocos do calendário encaixam em intervalos de 30 minutos. */
export function encaixarMeiaHora(minutosDesdeMeiaNoite: number): number {
  return Math.round(minutosDesdeMeiaNoite / 30) * 30;
}

/** Proporção (0–1) para as barras de progresso, limitada a 1. */
export function progresso(feito: number, alvo: number): number {
  if (alvo <= 0) return 0;
  return Math.min(1, Math.max(0, feito / alvo));
}
