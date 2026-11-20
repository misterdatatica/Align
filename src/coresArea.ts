/** As cores que se podem dar a uma área, em modo claro e escuro (o tema escolhe; ver theme.ts). */

export type CorArea = {
  id: string;
  nome: string;
  /** Pontos, barras e ícones. */
  forte: string;
  /** Fundo dos blocos e dos ícones. */
  tinta: string;
  /** Texto sobre `tinta` (contraste ≥ 4,5:1). */
  texto: string;
};

export const coresAreaClaras: CorArea[] = [
  { id: 'violeta', nome: 'Violeta', forte: '#8B5CF6', tinta: '#EFE8FE', texto: '#4C1D95' },
  { id: 'azul', nome: 'Azul', forte: '#1E40AF', tinta: '#E3EAFB', texto: '#1E3A8A' },
  { id: 'laranja', nome: 'Laranja', forte: '#D9731A', tinta: '#FDEBD9', texto: '#7C2D12' },
  { id: 'verde', nome: 'Verde', forte: '#2E8B57', tinta: '#DFF2E6', texto: '#14532D' },
  { id: 'rosa', nome: 'Rosa', forte: '#C2417E', tinta: '#FCE7F1', texto: '#831843' },
  { id: 'petroleo', nome: 'Petróleo', forte: '#0E7C86', tinta: '#DDF3F4', texto: '#134E4A' },
];

/** As mesmas cores no escuro: o tom forte mais claro, o fundo escuro tingido e o texto claro. */
export const coresAreaEscuras: CorArea[] = [
  { id: 'violeta', nome: 'Violeta', forte: '#A78BFA', tinta: '#2E2346', texto: '#DDD3FE' },
  { id: 'azul', nome: 'Azul', forte: '#6B8EF0', tinta: '#1C2742', texto: '#C9D6FB' },
  { id: 'laranja', nome: 'Laranja', forte: '#F0954A', tinta: '#3A2617', texto: '#FCD9B8' },
  { id: 'verde', nome: 'Verde', forte: '#4CC27E', tinta: '#16301F', texto: '#BDEBCD' },
  { id: 'rosa', nome: 'Rosa', forte: '#E36AA3', tinta: '#3A1A2A', texto: '#F9C9DE' },
  { id: 'petroleo', nome: 'Petróleo', forte: '#2BB3BE', tinta: '#12302F', texto: '#B5E9EC' },
];
