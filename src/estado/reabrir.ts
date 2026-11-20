/**
 * Mudar o idioma volta a desenhar a app toda (para os textos já mostrados também mudarem), o que a
 * leva de volta ao primeiro ecrã. As Definições marcam aqui que querem ser reabertas a seguir.
 */
let reabrirDefinicoes = false;

export function pedirParaReabrirDefinicoes(): void {
  reabrirDefinicoes = true;
}

/** Devolve true uma única vez depois de pedido. */
export function deveReabrirDefinicoes(): boolean {
  const pedido = reabrirDefinicoes;
  reabrirDefinicoes = false;
  return pedido;
}
