import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { planearSemana } from '@/data/semanas';
import { deDataISO, inicioDaSemana, paraDataISO } from '@/domain/semana';

/*
 * O dia de hoje e a semana escolhida: a que se está a planear. É partilhada pelos separadores Áreas,
 * Semana e Calendário e pelos detalhes das áreas e das metas, para todos mostrarem a mesma semana.
 * Depois de umas horas com a app em segundo plano, volta sozinha à semana atual.
 */

/** Horas em segundo plano ao fim das quais a semana escolhida volta à atual. */
export const HORAS_ATE_VOLTAR_A_ESTA_SEMANA = 3;

let hoje = paraDataISO(new Date());
/** null = acompanha a semana atual (muda sozinha à segunda-feira). */
let escolhida: string | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

function subscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function atualizarHoje() {
  const agora = paraDataISO(new Date());
  if (agora === hoje) return;
  hoje = agora;
  avisar();
}

/** Quando a app foi para segundo plano (ms); null enquanto está à vista. */
let emSegundoPlanoDesde: number | null = null;

/** Ao voltar à app depois de muito tempo, quem a abre quer ver a semana de agora. */
function voltarAEstaSemanaSeFoiHaMuito() {
  const desde = emSegundoPlanoDesde;
  emSegundoPlanoDesde = null;
  if (escolhida === null || desde === null) return;
  if (Date.now() - desde < HORAS_ATE_VOLTAR_A_ESTA_SEMANA * 60 * 60 * 1000) return;
  escolhida = null;
  avisar();
}

// O dia pode mudar com a app aberta ou em segundo plano.
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') {
    voltarAEstaSemanaSeFoiHaMuito();
    atualizarHoje();
  } else if (emSegundoPlanoDesde === null) {
    emSegundoPlanoDesde = Date.now();
  }
});
setInterval(atualizarHoje, 60_000);

function semanaAtual(): string {
  return inicioDaSemana(deDataISO(hoje));
}

/**
 * Planeia a semana (igual à anterior) e cria as instâncias das tarefas recorrentes, se ainda
 * faltarem. Nunca interrompe o ecrã.
 */
function prepararSemana(semana: string) {
  try {
    planearSemana(semana);
  } catch (erro) {
    console.warn('Não foi possível preparar a semana', erro);
  }
}

/** Dia de hoje, AAAA-MM-DD. */
export function useHoje(): string {
  return useSyncExternalStore(
    subscrever,
    () => hoje,
    () => hoje,
  );
}

/** Segunda-feira da semana de hoje. */
export function useSemanaAtual(): string {
  return inicioDaSemana(deDataISO(useHoje()));
}

export function escolherSemana(semana: string) {
  prepararSemana(semana);
  escolhida = semana === semanaAtual() ? null : semana;
  avisar();
}

/** A semana que se está a planear: a dos separadores Áreas, Semana e Calendário e dos detalhes. */
export function useSemanaEscolhida(): string {
  return useSyncExternalStore(
    subscrever,
    () => escolhida ?? semanaAtual(),
    () => escolhida ?? semanaAtual(),
  );
}

/** Prepara a semana sempre que o ecrã ganha foco ou a semana muda. */
export function usePrepararSemana(semana: string) {
  useFocusEffect(
    useCallback(() => {
      prepararSemana(semana);
    }, [semana]),
  );
}
