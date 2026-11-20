/*
 * Versão para o navegador de lembrete.ts: não há notificações agendadas na web, por isso o
 * lembrete fica indisponível e as funções não fazem nada. (O Metro escolhe este ficheiro na web.)
 */

export const lembretesDisponiveis = false;

export function configurarLembretes() {}

export async function pedirPermissao(_criarCanalAntes: () => Promise<void>): Promise<boolean> {
  return false;
}

export async function pedirPermissaoDeLembrete(): Promise<boolean> {
  return false;
}

export async function notificacoesAutorizadas(): Promise<boolean> {
  return false;
}

export async function cancelarLembrete(): Promise<void> {}

export async function agendarLembrete(_diaRevisao: number, _horaRevisao: string): Promise<void> {}

export function useAbrirPelasNotificacoes() {}
