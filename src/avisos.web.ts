/*
 * Versão para o navegador de avisos.ts: não há notificações agendadas na web, por isso os avisos dos
 * blocos ficam indisponíveis e as funções não fazem nada. (O Metro escolhe este ficheiro na web.)
 */

export const avisosDosBlocosDisponiveis = false;

export async function pedirPermissaoDosAvisos(): Promise<boolean> {
  return false;
}

export async function alarmesExatosPermitidos(): Promise<boolean> {
  return true;
}

export async function pedirAlarmesExatos(): Promise<boolean> {
  return true;
}

export async function reagendarAvisosDosBlocos(): Promise<void> {}

export function useAvisosDosBlocos() {}
