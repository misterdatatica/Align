/** Regras de negócio da especificação v1 que não dependem da base de dados. */

export const MAX_AREAS = 7;

export function podeCriarArea(areasAtivas: number): boolean {
  return areasAtivas < MAX_AREAS;
}

export type PeriodoMeta = 'dia' | 'semana';

/** Metas guardam-se sempre como alvo semanal: "2 h por dia" = 14 h por semana. */
export function alvoSemanal(valor: number, periodo: PeriodoMeta): number {
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('O alvo tem de ser um número positivo.');
  return periodo === 'dia' ? valor * 7 : valor;
}

/** Formata horas à portuguesa: 14 → "14 h", 7.5 → "7,5 h", 0.5 → "30 min". */
export function formatarHoras(horas: number): string {
  if (horas > 0 && horas < 1) return `${Math.round(horas * 60)} min`;
  const arredondado = Math.round(horas * 10) / 10;
  return `${String(arredondado).replace('.', ',')} h`;
}

/** "14 de 14 h", "7,5 de 10 h", "30 min de 2 h" — o que já está contra o alvo. */
export function formatarProgressoHoras(horas: number, alvo: number): string {
  const feito = formatarHoras(horas);
  const total = formatarHoras(alvo);
  return feito.endsWith(' h') && total.endsWith(' h') ? `${feito.slice(0, -2)} de ${total}` : `${feito} de ${total}`;
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

export type TipoMeta = 'horas' | 'vezes';

/** Plural português simples para a unidade: lição → lições, treino → treinos, oração → orações. */
export function pluralizar(palavra: string): string {
  const p = palavra.trim();
  if (!p) return p;
  const [primeira, ...resto] = p.split(' ');
  const sufixo = resto.length ? ` ${resto.join(' ')}` : '';
  let plural: string;
  if (/ão$/.test(primeira)) plural = primeira.replace(/ão$/, 'ões');
  else if (/m$/.test(primeira)) plural = primeira.replace(/m$/, 'ns');
  else if (/al$/.test(primeira)) plural = primeira.replace(/al$/, 'ais');
  else if (/[rz]$/.test(primeira)) plural = `${primeira}es`;
  else if (/[aeiouáéíóúâêô]$/i.test(primeira)) plural = `${primeira}s`;
  else plural = primeira;
  return plural + sufixo;
}

/** "1 lição", "3 lições", "2 vezes", "1 vez". */
export function contarUnidade(n: number, unidade: string | null): string {
  const u = unidade?.trim() || 'vez';
  return `${n} ${n === 1 ? u : u === 'vez' ? 'vezes' : pluralizar(u)}`;
}

/** Texto curto de uma meta: "1 lição por dia · 7 por semana", "2 h por dia · 14 h por semana". */
export function descreverMeta(meta: { tipo: TipoMeta; alvoSemanal: number; periodo: PeriodoMeta; unidade: string | null }): string {
  const porDia = meta.periodo === 'dia' ? meta.alvoSemanal / 7 : null;
  if (meta.tipo === 'horas') {
    return porDia === null
      ? `${formatarHoras(meta.alvoSemanal)} por semana`
      : `${formatarHoras(porDia)} por dia · ${formatarHoras(meta.alvoSemanal)} por semana`;
  }
  return porDia === null
    ? `${contarUnidade(meta.alvoSemanal, meta.unidade)} por semana`
    : `${contarUnidade(porDia, meta.unidade)} por dia · ${meta.alvoSemanal} por semana`;
}

/** Horas aceitam decimais (1,5 h); vezes têm de ser um número inteiro. */
export function alvoValido(tipo: TipoMeta, valor: number): boolean {
  return Number.isFinite(valor) && valor > 0 && (tipo === 'horas' || Number.isInteger(valor));
}

type TextoDeMeta = { tipo: TipoMeta; alvoSemanal: number; periodo: PeriodoMeta; unidade: string | null };

/** "2 h por dia", "3 treinos por semana" — a meta tal como o utilizador a definiu. */
export function alvoDaMeta(meta: TextoDeMeta): string {
  const valor = meta.periodo === 'dia' ? meta.alvoSemanal / 7 : meta.alvoSemanal;
  return `${meta.tipo === 'horas' ? formatarHoras(valor) : contarUnidade(valor, meta.unidade)} por ${meta.periodo}`;
}

/** "14 h", "7 lições" — a mesma meta medida à semana. */
export function medidaSemanal(meta: TextoDeMeta): string {
  return meta.tipo === 'horas' ? formatarHoras(meta.alvoSemanal) : contarUnidade(meta.alvoSemanal, meta.unidade);
}
