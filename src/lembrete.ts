import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus, SchedulableTriggerInputTypes } from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

/*
 * Lembrete local da revisão semanal: uma notificação que repete todas as semanas, agendada no
 * próprio telemóvel (sem servidor). A permissão só é pedida quando o utilizador ativa o lembrete.
 * No navegador não há notificações agendadas: ver lembrete.web.ts.
 */

const IDENTIFICADOR = 'revisao-semanal';
const CANAL = 'revisao';

export const lembretesDisponiveis = true;

/** Mostra o lembrete mesmo que a app esteja aberta nesse momento. Chamar uma vez, ao arrancar. */
export function configurarLembretes() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

/** No Android as notificações precisam de um canal; no iOS esta chamada não faz nada. */
async function criarCanal() {
  await Notifications.setNotificationChannelAsync(CANAL, { name: 'Revisão semanal', importance: AndroidImportance.DEFAULT });
}

function concedida(permissao: Notifications.NotificationPermissionsStatus): boolean {
  return permissao.granted || permissao.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

/** Pede autorização para notificações, se ainda for preciso. Devolve se o lembrete pode ser agendado. */
export async function pedirPermissaoDeLembrete(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync();
  if (concedida(atual)) return true;
  if (!atual.canAskAgain) return false;
  // No Android 13+, o pedido do sistema só aparece depois de existir um canal.
  await criarCanal();
  return concedida(await Notifications.requestPermissionsAsync());
}

export async function cancelarLembrete(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFICADOR);
}

/**
 * Agenda (ou reagenda) o lembrete para o dia e a hora da revisão.
 * @param diaRevisao 0 = domingo … 6 = sábado, como nas definições.
 * @param horaRevisao "HH:MM".
 */
export async function agendarLembrete(diaRevisao: number, horaRevisao: string): Promise<void> {
  const [hora, minuto] = horaRevisao.split(':').map(Number);
  await cancelarLembrete();
  await criarCanal();
  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFICADOR,
    content: { title: 'Revisão da semana', body: 'Veja como correu a semana e planeie a próxima.' },
    // Nas notificações semanais o domingo é o dia 1.
    trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday: diaRevisao + 1, hour: hora, minute: minuto, channelId: CANAL },
  });
}

/** Tocar no lembrete abre o separador Revisão. Usar uma vez, no layout principal. */
export function useAbrirRevisaoPeloLembrete() {
  const router = useRouter();
  const resposta = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (resposta?.notification.request.identifier !== IDENTIFICADOR) return;
    router.navigate('/revisao');
    // Para a mesma resposta não voltar a abrir a revisão no próximo arranque.
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [resposta, router]);
}
