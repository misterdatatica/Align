/*
 * Align Plus: as funcionalidades pagas (estatísticas, avisos dos blocos, modelos, calendário do
 * telemóvel, widget).
 *
 * Ainda não há base de pagamentos, por isso todas estão abertas: temPlus() responde sempre que sim.
 * Quando a subscrição chegar (RevenueCat), é só aqui que se muda: os ecrãs perguntam a temPlus() ou a
 * usePlus() e não sabem de onde vem a resposta.
 */

/** O utilizador tem o Align Plus? */
export function temPlus(): boolean {
  return true;
}

/** O mesmo que temPlus(), para os componentes (passará a reagir quando a subscrição mudar). */
export function usePlus(): boolean {
  return temPlus();
}
