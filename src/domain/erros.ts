/**
 * Um erro com uma mensagem escrita para o utilizador (ex.: "Indique um número."). Os ecrãs mostram
 * a mensagem tal como está; os outros erros (do SQLite, de programação) são técnicos e ficam no
 * registo interno, com uma mensagem genérica no ecrã.
 */
export class ErroDaApp extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDaApp';
  }
}
