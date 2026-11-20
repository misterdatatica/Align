import { t } from '../i18n/index.ts';
import { deDataISO } from './semana.ts';
import { formatarIntervalo } from './calendario.ts';

/*
 * Avisos dos blocos (WeekAlign Plus): uma notificação uns minutos antes de cada bloco das tarefas. O
 * telemóvel só guarda um número limitado de notificações agendadas (64 no iOS), por isso agendam-se as
 * mais próximas, numa janela que se refaz sempre que os blocos mudam ou a app abre.
 */

/** Quantos avisos de blocos ficam agendados ao mesmo tempo (o lembrete da revisão também conta). */
export const MAXIMO_DE_AVISOS = 60;
/** Até quantos dias à frente se agendam. */
export const DIAS_DE_AVISOS = 7;

export type BlocoParaAvisar = {
  id: number;
  nome: string;
  area: string | null;
  /** Dia do bloco, AAAA-MM-DD, e minutos desde a meia-noite. */
  dia: string;
  inicioMin: number;
  fimMin: number;
};

export type Aviso = {
  /** Muda quando muda alguma coisa no aviso: assim sabe-se o que reagendar. */
  identificador: string;
  quando: Date;
  titulo: string;
  corpo: string;
};

/** Hash curto (FNV-1a), para o identificador mudar quando o texto do aviso muda. */
function resumo(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** O momento (hora local) em que o bloco começa. */
export function inicioDoBloco(b: Pick<BlocoParaAvisar, 'dia' | 'inicioMin'>): Date {
  const d = deDataISO(b.dia);
  d.setHours(0, b.inicioMin, 0, 0);
  return d;
}

/**
 * Os avisos a agendar: um por bloco, `minutosAntes` antes de começar, só os que ainda estão para vir
 * e dentro da janela, os mais próximos primeiro, no máximo `maximo`.
 *
 * `variante` entra no identificador: muda quando muda a forma de agendar (no Android, à hora exata ou
 * não), para os avisos já agendados serem refeitos.
 */
export function avisosParaAgendar(
  blocos: BlocoParaAvisar[],
  agora: Date,
  minutosAntes: number,
  { maximo = MAXIMO_DE_AVISOS, variante = '' }: { maximo?: number; variante?: string } = {},
): Aviso[] {
  const limite = agora.getTime() + DIAS_DE_AVISOS * 24 * 60 * 60 * 1000;
  return blocos
    .map((b) => {
      const quando = new Date(inicioDoBloco(b).getTime() - minutosAntes * 60 * 1000);
      const intervalo = formatarIntervalo(b.inicioMin, b.fimMin);
      const corpo = minutosAntes > 0 ? [t('Daqui a {n} min', { n: minutosAntes }), intervalo, b.area].filter(Boolean).join(' · ') : [intervalo, b.area].filter(Boolean).join(' · ');
      return { identificador: `bloco-${b.id}-${quando.getTime()}-${resumo(b.nome + corpo)}${variante}`, quando, titulo: b.nome, corpo };
    })
    .filter((a) => a.quando.getTime() > agora.getTime() && a.quando.getTime() <= limite)
    .sort((a, b) => a.quando.getTime() - b.quando.getTime())
    .slice(0, maximo);
}

/** O identificador é de um aviso de bloco (e não do lembrete da revisão). */
export function eAvisoDeBloco(identificador: string): boolean {
  return identificador.startsWith('bloco-');
}
