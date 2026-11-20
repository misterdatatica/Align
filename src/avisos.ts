import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { blocosParaAvisar } from '@/data/avisos';
import { carregarDefinicoes } from '@/data/definicoes';
import { avisosParaAgendar, eAvisoDeBloco } from '@/domain/avisos';
import { t } from '@/i18n';
import { notificacoesAutorizadas, pedirPermissao } from '@/lembrete';
import { temPlus } from '@/plus';

/*
 * Avisos dos blocos (Align Plus), no telemóvel: notificações locais, agendadas uns minutos antes de cada
 * bloco das tarefas por fazer (ver src/domain/avisos.ts). Refazem-se quando a app abre, quando volta a
 * ficar à frente e sempre que os blocos, as tarefas ou as definições mudam. Na web não há avisos: ver
 * avisos.web.ts.
 */

const CANAL = 'blocos';
/** As tabelas de que os avisos dependem. */
const TABELAS = new Set(['areas', 'tarefas', 'tarefas_semana', 'blocos', 'semanas', 'definicoes']);

export const avisosDosBlocosDisponiveis = true;

async function criarCanal() {
  await Notifications.setNotificationChannelAsync(CANAL, { name: t('Avisos dos blocos'), importance: AndroidImportance.HIGH });
}

/** Pede autorização para notificações, se ainda for preciso. Devolve se os avisos podem ser agendados. */
export function pedirPermissaoDosAvisos(): Promise<boolean> {
  return pedirPermissao(criarCanal);
}

/**
 * No Android 12+, sem a autorização "Alarmes e lembretes" as notificações agendadas não são exatas: o
 * sistema pode atrasá-las até uma hora. No iOS chegam sempre à hora.
 */
export async function alarmesExatosPermitidos(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return (await Notifications.getExactAlarmPermissionsAsync()).granted;
}

/** Abre as definições do Android onde se permitem os "Alarmes e lembretes". Devolve se ficaram permitidos. */
export async function pedirAlarmesExatos(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
}

async function reagendar(agora: Date): Promise<void> {
  const { avisosBlocos, minutosAntes } = carregarDefinicoes();
  const ligados = avisosBlocos && temPlus() && (await notificacoesAutorizadas());
  // Ao permitir (ou retirar) os alarmes exatos, os identificadores mudam e os avisos refazem-se.
  const variante = ligados && !(await alarmesExatosPermitidos()) ? '-i' : '';
  const avisos = ligados ? avisosParaAgendar(blocosParaAvisar(agora), agora, minutosAntes, { variante }) : [];

  const agendados = (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier).filter(eAvisoDeBloco);
  const queridos = new Set(avisos.map((a) => a.identificador));
  for (const identificador of agendados) {
    if (!queridos.has(identificador)) await Notifications.cancelScheduledNotificationAsync(identificador);
  }
  const jaAgendados = new Set(agendados);
  const novos = avisos.filter((a) => !jaAgendados.has(a.identificador));
  if (novos.length === 0) return;
  await criarCanal();
  for (const a of novos) {
    await Notifications.scheduleNotificationAsync({
      identifier: a.identificador,
      content: { title: a.titulo, body: a.corpo },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: a.quando, channelId: CANAL },
    });
  }
}

let fila: Promise<void> = Promise.resolve();
let aEspera: Promise<void> | null = null;

/**
 * Refaz os avisos agendados, conforme as definições e os blocos de agora. Um de cada vez (dois ao mesmo
 * tempo podiam cancelar o que o outro acabou de agendar); os pedidos que chegam entretanto juntam-se
 * todos no seguinte.
 */
export function reagendarAvisosDosBlocos(): Promise<void> {
  if (aEspera) return aEspera;
  const proximo = fila
    .catch(() => {})
    .then(() => {
      aEspera = null;
      return reagendar(new Date());
    });
  aEspera = proximo;
  fila = proximo;
  return proximo;
}

/** Mantém os avisos em dia enquanto a app corre. Usar uma vez, no layout principal. */
export function useAvisosDosBlocos() {
  useEffect(() => {
    let pendente: ReturnType<typeof setTimeout> | null = null;
    const pedir = (atraso: number) => {
      if (pendente) clearTimeout(pendente);
      pendente = setTimeout(() => {
        pendente = null;
        reagendarAvisosDosBlocos().catch((erro: unknown) => console.warn('Avisos dos blocos:', erro));
      }, atraso);
    };
    pedir(0);
    // Uma mudança de várias linhas (ex.: arrastar um bloco) dá vários avisos da base de dados: junta-os.
    const ouvinte = addDatabaseChangeListener((alteracao) => {
      if (TABELAS.has(alteracao.tableName)) pedir(1000);
    });
    // Ao voltar à app: a janela de 7 dias avança, e as autorizações podem ter mudado.
    const estado = AppState.addEventListener('change', (e) => {
      if (e === 'active') pedir(0);
    });
    return () => {
      if (pendente) clearTimeout(pendente);
      ouvinte.remove();
      estado.remove();
    };
  }, []);
}
