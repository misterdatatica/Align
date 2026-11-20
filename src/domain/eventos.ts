import { MINUTOS_DIA, paraDataISO } from './semana.ts';

/*
 * Eventos dos calendários do telemóvel (WeekAlign Plus): aparecem no calendário da semana como blocos
 * "Ocupado", só para ver. O calendário da app só tem blocos dentro de um dia, por isso um evento que
 * passa da meia-noite fica partido em pedaços, um por dia.
 */

/** Um evento lido do telemóvel. */
export type EventoDoTelemovel = {
  id: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  diaInteiro: boolean;
};

/** Um pedaço de um evento dentro de um dia (hora local). */
export type PedacoDeEvento = {
  /** O evento, o seu início (cada repetição tem o seu) e o dia: muda quando o evento muda de sítio. */
  chave: string;
  titulo: string | null;
  /** AAAA-MM-DD. */
  dia: string;
  inicioMin: number;
  fimMin: number;
};

/** Títulos muito longos não cabem num bloco nem fazem falta. */
const TITULO_MAXIMO = 80;

/**
 * Os pedaços do evento, um por dia, em hora local e ao minuto (o fim arredonda para cima). Os eventos
 * de dia inteiro não ocupam horas e ficam de fora, tal como os que acabam antes de começar.
 */
export function pedacosDoEvento(evento: EventoDoTelemovel): PedacoDeEvento[] {
  if (evento.diaInteiro || !(evento.fim.getTime() > evento.inicio.getTime())) return [];
  const titulo = evento.titulo.trim().slice(0, TITULO_MAXIMO) || null;
  const pedacos: PedacoDeEvento[] = [];
  let cursor = new Date(evento.inicio);
  cursor.setSeconds(0, 0);
  while (cursor.getTime() < evento.fim.getTime()) {
    const dia = paraDataISO(cursor);
    const meiaNoite = new Date(cursor);
    meiaNoite.setHours(24, 0, 0, 0);
    const inicioMin = cursor.getHours() * 60 + cursor.getMinutes();
    const fimMin =
      evento.fim.getTime() >= meiaNoite.getTime()
        ? MINUTOS_DIA
        : Math.min(MINUTOS_DIA, evento.fim.getHours() * 60 + evento.fim.getMinutes() + (evento.fim.getSeconds() > 0 || evento.fim.getMilliseconds() > 0 ? 1 : 0));
    if (fimMin > inicioMin) pedacos.push({ chave: `${evento.id}|${evento.inicio.getTime()}|${dia}`, titulo, dia, inicioMin, fimMin });
    cursor = meiaNoite;
  }
  return pedacos;
}
