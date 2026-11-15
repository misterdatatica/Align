/** Cores e tipografia do design (canvas "App Áreas de Responsabilidade — Ecrãs"). */

export const cores = {
  fundo: '#F5F6F8',
  superficie: '#FFFFFF',
  tinta: '#15171C',
  texto2: '#3F4450',
  texto3: '#5A606B',
  linha: '#E4E6EB',
  linhaSuave: '#ECEEF1',
  tracejado: '#7D838E',
  ativoTab: '#E9EBEF',
  pista: '#E8EAEE',
  /** Contorno de botões e pílulas não selecionadas. */
  contorno: '#D5D8DE',
  /** Contorno dos campos de texto (contraste 3:1 com o fundo). */
  contornoCampo: '#8A909A',
  /** Linhas da grelha do calendário. */
  grelha: '#E6E8EC',
  /** Riscas dos blocos "Ocupado". */
  ocupadoClaro: '#EEF0F3',
  ocupadoEscuro: '#E3E6EB',
  ocupadoRiscaLegenda: '#9AA0AA',
  /** Fundo do ícone e texto secundário sobre o cartão escuro (revisão). */
  tintaSuave: '#2B2F38',
  textoSobreTinta: '#C9CCD3',
  /** Ações que apagam. */
  perigo: '#B42318',
  perigoTinta: '#FEE4E2',
} as const;

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

export const coresArea: CorArea[] = [
  { id: 'violeta', nome: 'Violeta', forte: '#8B5CF6', tinta: '#EFE8FE', texto: '#4C1D95' },
  { id: 'azul', nome: 'Azul', forte: '#1E40AF', tinta: '#E3EAFB', texto: '#1E3A8A' },
  { id: 'laranja', nome: 'Laranja', forte: '#D9731A', tinta: '#FDEBD9', texto: '#7C2D12' },
  { id: 'verde', nome: 'Verde', forte: '#2E8B57', tinta: '#DFF2E6', texto: '#14532D' },
  { id: 'rosa', nome: 'Rosa', forte: '#C2417E', tinta: '#FCE7F1', texto: '#831843' },
  { id: 'petroleo', nome: 'Petróleo', forte: '#0E7C86', tinta: '#DDF3F4', texto: '#134E4A' },
];

export function corDaArea(id: string): CorArea {
  return coresArea.find((c) => c.id === id) ?? coresArea[0];
}

export const fontes = {
  texto: 'Inter_400Regular',
  textoMedio: 'Inter_500Medium',
  textoForte: 'Inter_600SemiBold',
  titulo: 'SpaceGrotesk_600SemiBold',
  tituloMedio: 'SpaceGrotesk_500Medium',
} as const;
