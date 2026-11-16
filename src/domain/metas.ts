/** Regras das metas (resultados com prazo) que não dependem da base de dados. */

import { deDataISO } from './semana';

export const MAX_METAS_ATIVAS = 3;

export type MedidaMeta = 'numero' | 'marco';
export type EstadoMeta = 'ativa' | 'concluida' | 'pausada' | 'abandonada';

export const NOME_DO_ESTADO: Record<EstadoMeta, string> = {
  ativa: 'Ativa',
  concluida: 'Concluída',
  pausada: 'Pausada',
  abandonada: 'Abandonada',
};

export function podeAtivarMeta(ativasNaArea: number): boolean {
  return ativasNaArea < MAX_METAS_ATIVAS;
}

/** Os três valores de uma meta de número. */
export type ValoresMeta = { valorInicial: number; valorAtual: number; valorAlvo: number };

/** O alvo fica abaixo do ponto de partida (tempo aos 10 km, peso): avançar é descer. */
export function alvoDescendente(valorInicial: number, valorAlvo: number): boolean {
  return valorAlvo < valorInicial;
}

/** Proporção (0–1) do caminho já feito entre o valor inicial e o alvo, nos dois sentidos. */
export function progressoDaMeta({ valorInicial, valorAtual, valorAlvo }: ValoresMeta): number {
  const caminho = valorAlvo - valorInicial;
  if (caminho === 0) return 1;
  return Math.min(1, Math.max(0, (valorAtual - valorInicial) / caminho));
}

export function alvoAlcancado({ valorInicial, valorAtual, valorAlvo }: ValoresMeta): boolean {
  return alvoDescendente(valorInicial, valorAlvo) ? valorAtual <= valorAlvo : valorAtual >= valorAlvo;
}

/**
 * A meta não avançou nas últimas 3 atualizações: nenhuma delas passou o melhor valor que já se tinha
 * alcançado antes (o valor inicial conta). Oscilar à volta do mesmo valor (53 → 53,2 → 53) não é avançar.
 * `valores` são as atualizações por ordem (sem o valor inicial).
 */
export function estagnada(valorInicial: number, valorAlvo: number, valores: number[]): boolean {
  if (valores.length < 3) return false;
  const descendente = alvoDescendente(valorInicial, valorAlvo);
  const melhor = (a: number, b: number) => (descendente ? Math.min(a, b) : Math.max(a, b));
  const antes = [valorInicial, ...valores.slice(0, -3)].reduce(melhor);
  return valores.slice(-3).every((v) => (descendente ? v >= antes : v <= antes));
}

/** Dias entre hoje e o prazo: 0 = termina hoje, negativo = já passou. */
export function diasQueFaltam(hoje: string, prazo: string): number {
  const a = deDataISO(hoje);
  const b = deDataISO(prazo);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000);
}

/** "faltam 135 dias", "falta 1 dia", "termina hoje", "o prazo passou há 3 dias". */
export function descreverDiasQueFaltam(dias: number): string {
  if (dias === 0) return 'termina hoje';
  if (dias === 1) return 'falta 1 dia';
  if (dias > 1) return `faltam ${dias} dias`;
  return dias === -1 ? 'o prazo passou há 1 dia' : `o prazo passou há ${-dias} dias`;
}

/** Números à portuguesa, com duas casas decimais no máximo: 60 → "60", 52.5 → "52,5". */
export function formatarValor(valor: number): string {
  return String(Math.round(valor * 100) / 100).replace('.', ',');
}

/** "52,5 min", "60" — o valor com a unidade da meta, se a tiver. */
export function valorComUnidade(valor: number, unidade: string | null): string {
  const u = unidade?.trim();
  return u ? `${formatarValor(valor)} ${u}` : formatarValor(valor);
}

/** Lê um número escrito à portuguesa ("52,5") ou com ponto. Devolve null se não for um número. */
export function lerValor(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A data existe mesmo no calendário (31 de fevereiro não passa). */
export function dataValida(iso: string): boolean {
  const partes = DATA_ISO.exec(iso);
  if (!partes) return false;
  const [a, m, d] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const data = new Date(a, m - 1, d);
  return data.getFullYear() === a && data.getMonth() === m - 1 && data.getDate() === d;
}

export type DadosMeta = {
  descricao: string;
  /** AAAA-MM-DD. */
  prazo: string;
  medida: MedidaMeta;
  valorInicial?: number | null;
  valorAlvo?: number | null;
  unidade?: string | null;
};

/** Valida e arruma uma meta antes de a guardar. As metas de marco não guardam valores. */
export function normalizarMeta(dados: DadosMeta) {
  const descricao = dados.descricao.trim();
  if (!descricao) throw new Error('A meta precisa de uma descrição.');
  if (!dataValida(dados.prazo)) throw new Error('A meta precisa de um prazo: escolha uma data válida.');
  if (dados.medida === 'marco') return { descricao, prazo: dados.prazo, medida: 'marco' as const, valorInicial: null, valorAlvo: null, unidade: null };

  const { valorInicial, valorAlvo } = dados;
  if (typeof valorInicial !== 'number' || !Number.isFinite(valorInicial)) throw new Error('Indique o valor de partida.');
  if (typeof valorAlvo !== 'number' || !Number.isFinite(valorAlvo)) throw new Error('Indique o valor a que quer chegar.');
  if (valorAlvo === valorInicial) throw new Error('O alvo tem de ser diferente do valor de partida.');
  return { descricao, prazo: dados.prazo, medida: 'numero' as const, valorInicial, valorAlvo, unidade: dados.unidade?.trim() || null };
}

export type PontoDaLinha = { data: string; valor: number };

/**
 * Pontos da linha de progresso: o valor inicial no dia em que a meta foi criada, seguido das
 * atualizações. Um registo no próprio dia da criação fica por cima do ponto de partida (mesma data).
 */
export function pontosDaLinha(criadaEm: string, valorInicial: number, registos: PontoDaLinha[]): PontoDaLinha[] {
  const ordenados = [...registos].sort((a, b) => a.data.localeCompare(b.data));
  const inicio = ordenados.length && ordenados[0].data < criadaEm ? ordenados[0].data : criadaEm;
  return [{ data: inicio, valor: valorInicial }, ...ordenados];
}
