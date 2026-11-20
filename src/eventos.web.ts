/*
 * Versão para o navegador de eventos.ts: o navegador não tem acesso aos calendários do telemóvel, por
 * isso a funcionalidade fica indisponível e as funções não fazem nada. (O Metro escolhe este ficheiro na web.)
 */

export const eventosDisponiveis = false;

export type CalendarioDoTelemovel = { id: string; titulo: string; cor: string | null; conta: string | null };

export async function pedirAcessoAosCalendarios(): Promise<boolean> {
  return false;
}

export async function listarCalendarios(): Promise<CalendarioDoTelemovel[]> {
  return [];
}

export async function sincronizarEventosDoTelemovel(): Promise<void> {}

export function useEventosDoTelemovel() {}
