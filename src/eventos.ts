import * as Calendario from 'expo-calendar';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { carregarDefinicoes } from '@/data/definicoes';
import { apagarEventos, sincronizarEventos } from '@/data/eventos';
import type { EventoDoTelemovel } from '@/domain/eventos';
import { deDataISO, inicioDaSemana, somarSemanas } from '@/domain/semana';
import { temPlus } from '@/plus';

/*
 * Eventos dos calendários do telemóvel (Align Plus): os do Google Calendar, do iCloud e de outras contas
 * que o telemóvel tenha. Leem-se da semana atual e das seguintes e guardam-se como blocos "Ocupado"
 * (ver src/data/eventos.ts), refeitos quando a app abre, quando volta a ficar à frente e quando as
 * definições mudam. A app só lê: não cria nem muda eventos. Na web não há: ver eventos.web.ts.
 */

export const eventosDisponiveis = true;

/** Quantas semanas, a começar na atual, se trazem do telemóvel. */
const SEMANAS = 5;

export type CalendarioDoTelemovel = { id: string; titulo: string; cor: string | null; conta: string | null };

/** Pede acesso aos calendários, se ainda for preciso. Devolve se ficou com acesso. */
export async function pedirAcessoAosCalendarios(): Promise<boolean> {
  const atual = await Calendario.getCalendarPermissions();
  if (atual.granted) return true;
  if (!atual.canAskAgain) return false;
  return (await Calendario.requestCalendarPermissions()).granted;
}

/** Os calendários de eventos do telemóvel, por conta e por nome. */
export async function listarCalendarios(): Promise<CalendarioDoTelemovel[]> {
  const lista = await Calendario.getCalendars(Calendario.EntityTypes.EVENT);
  return lista
    .map((c) => ({ id: c.id, titulo: c.title, cor: c.color ?? null, conta: c.source?.name ?? null }))
    .sort((a, b) => (a.conta ?? '').localeCompare(b.conta ?? '') || a.titulo.localeCompare(b.titulo));
}

async function sincronizar(agora: Date): Promise<void> {
  const { eventosTelemovel, calendariosEscondidos } = carregarDefinicoes();
  if (!eventosTelemovel || !temPlus() || !(await Calendario.getCalendarPermissions()).granted) {
    apagarEventos();
    return;
  }
  const desde = inicioDaSemana(agora);
  const ate = somarSemanas(desde, SEMANAS);
  const calendarios = (await Calendario.getCalendars(Calendario.EntityTypes.EVENT)).map((c) => c.id).filter((id) => !calendariosEscondidos.includes(id));
  const eventos = calendarios.length ? await Calendario.listEvents(calendarios, deDataISO(desde), deDataISO(ate)) : [];
  sincronizarEventos(
    eventos
      // Os cancelados e os marcados como "livre" não ocupam tempo.
      .filter((e) => e.status !== Calendario.EventStatus.CANCELED && e.availability !== Calendario.Availability.FREE)
      .map((e): EventoDoTelemovel => ({ id: e.id, titulo: e.title ?? '', inicio: new Date(e.startDate), fim: new Date(e.endDate), diaInteiro: e.allDay })),
    desde,
    ate,
  );
}

let fila: Promise<void> = Promise.resolve();
let aEspera: Promise<void> | null = null;

/** Traz os eventos do telemóvel outra vez. Uma de cada vez; os pedidos que chegam entretanto juntam-se. */
export function sincronizarEventosDoTelemovel(): Promise<void> {
  if (aEspera) return aEspera;
  const proximo = fila
    .catch(() => {})
    .then(() => {
      aEspera = null;
      return sincronizar(new Date());
    });
  aEspera = proximo;
  fila = proximo;
  return proximo;
}

/** Mantém os eventos do telemóvel em dia enquanto a app corre. Usar uma vez, no layout principal. */
export function useEventosDoTelemovel() {
  useEffect(() => {
    let pendente: ReturnType<typeof setTimeout> | null = null;
    const pedir = (atraso: number) => {
      if (pendente) clearTimeout(pendente);
      pendente = setTimeout(() => {
        pendente = null;
        sincronizarEventosDoTelemovel().catch((erro: unknown) => console.warn('Eventos do telemóvel:', erro));
      }, atraso);
    };
    pedir(0);
    const ouvinte = addDatabaseChangeListener((alteracao) => {
      if (alteracao.tableName === 'definicoes') pedir(500);
    });
    // Ao voltar à app: os eventos podem ter mudado na app de calendário, e a semana pode ter avançado.
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
