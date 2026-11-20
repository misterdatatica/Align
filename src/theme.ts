import { createContext, useContext } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';

/*
 * Cores e tipografia do design (canvas "App Áreas de Responsabilidade — Ecrãs"), em modo claro e
 * escuro. Os ecrãs não importam cores fixas: leem o tema com `useTema()`, que dá a paleta, os
 * estilos partilhados e as cores das áreas do modo em uso.
 */

export type Paleta = {
  fundo: string;
  superficie: string;
  /** Texto principal e fundo dos botões principais. */
  tinta: string;
  /** Texto e ícones por cima de `tinta` (botão principal, faixas escuras). */
  sobreTinta: string;
  texto2: string;
  texto3: string;
  linha: string;
  linhaSuave: string;
  tracejado: string;
  ativoTab: string;
  pista: string;
  /** Contorno de botões e pílulas não selecionadas. */
  contorno: string;
  /** Contorno dos campos de texto (contraste 3:1 com o fundo). */
  contornoCampo: string;
  /** Linhas da grelha do calendário. */
  grelha: string;
  /** Riscas dos blocos "Ocupado". */
  ocupadoClaro: string;
  ocupadoEscuro: string;
  ocupadoRiscaLegenda: string;
  /** Contorno dos blocos "Ocupado". */
  contornoOcupado: string;
  /** Fundo do ícone e texto secundário sobre o cartão `tinta` (revisão). */
  tintaSuave: string;
  textoSobreTinta: string;
  /** Ações que apagam. */
  perigo: string;
  perigoTinta: string;
  /** Véu por trás das folhas que sobem do fundo do ecrã. */
  veu: string;
};

export const paletaClara: Paleta = {
  fundo: '#F5F6F8',
  superficie: '#FFFFFF',
  tinta: '#15171C',
  sobreTinta: '#FFFFFF',
  texto2: '#3F4450',
  texto3: '#5A606B',
  linha: '#E4E6EB',
  linhaSuave: '#ECEEF1',
  tracejado: '#7D838E',
  ativoTab: '#E9EBEF',
  pista: '#E8EAEE',
  contorno: '#D5D8DE',
  contornoCampo: '#8A909A',
  grelha: '#E6E8EC',
  ocupadoClaro: '#EEF0F3',
  ocupadoEscuro: '#E3E6EB',
  ocupadoRiscaLegenda: '#9AA0AA',
  contornoOcupado: '#3F445033',
  tintaSuave: '#2B2F38',
  textoSobreTinta: '#C9CCD3',
  perigo: '#B42318',
  perigoTinta: '#FEE4E2',
  veu: 'rgba(21, 23, 28, 0.45)',
};

/** Modo escuro: fundos quase pretos, texto claro e os botões principais claros com texto escuro. */
export const paletaEscura: Paleta = {
  fundo: '#0F1115',
  superficie: '#1A1D23',
  tinta: '#F2F3F5',
  sobreTinta: '#15171C',
  texto2: '#C4C8D0',
  texto3: '#9AA0AA',
  linha: '#2B2F37',
  linhaSuave: '#24282F',
  tracejado: '#80868F',
  ativoTab: '#2B2F37',
  pista: '#2B2F37',
  contorno: '#3A3F48',
  contornoCampo: '#6E747E',
  grelha: '#262A31',
  ocupadoClaro: '#22262D',
  ocupadoEscuro: '#2D3139',
  ocupadoRiscaLegenda: '#6E747E',
  contornoOcupado: '#FFFFFF26',
  tintaSuave: '#D5D8DE',
  textoSobreTinta: '#3F4450',
  perigo: '#F97066',
  perigoTinta: '#3B1C1A',
  veu: 'rgba(0, 0, 0, 0.6)',
};

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

export const fontes = {
  texto: 'Inter_400Regular',
  textoMedio: 'Inter_500Medium',
  textoForte: 'Inter_600SemiBold',
  titulo: 'SpaceGrotesk_600SemiBold',
  tituloMedio: 'SpaceGrotesk_500Medium',
} as const;

/** Estilos partilhados pelos ecrãs, com as cores de uma paleta. */
function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: 16, gap: 20, paddingBottom: 32 },
    titulo: { fontFamily: fontes.titulo, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: cores.tinta },
    subtitulo: { fontFamily: fontes.textoMedio, fontSize: 13, lineHeight: 18, color: cores.texto3 },
    rotulo: { fontFamily: fontes.textoForte, fontSize: 12, lineHeight: 16, letterSpacing: 0.7, color: cores.texto3 },
    cartao: { backgroundColor: cores.superficie, borderRadius: 16, borderWidth: 1, borderColor: cores.linha },
    botao: { minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
    textoBotao: { fontFamily: fontes.textoForte, fontSize: 15 },
    corpo: { fontFamily: fontes.texto, fontSize: 15, lineHeight: 20, color: cores.tinta } as TextStyle,
    pequeno: { fontFamily: fontes.texto, fontSize: 13, lineHeight: 18, color: cores.texto3 } as TextStyle,
    campo: {
      fontFamily: fontes.texto,
      fontSize: 16,
      color: cores.tinta,
      backgroundColor: cores.superficie,
      borderWidth: 1,
      borderColor: cores.contornoCampo,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      minHeight: 48,
    } as TextStyle,
  });
}

export type Esquema = 'claro' | 'escuro';

export type Tema = {
  esquema: Esquema;
  escuro: boolean;
  cores: Paleta;
  estilos: ReturnType<typeof criarEstilos>;
  coresArea: CorArea[];
  /** A cor de uma área pelo id; uma cor desconhecida fica violeta. */
  corDaArea: (id: string) => CorArea;
};

function criarTema(esquema: Esquema): Tema {
  const coresArea = esquema === 'escuro' ? coresAreaEscuras : coresAreaClaras;
  return {
    esquema,
    escuro: esquema === 'escuro',
    cores: esquema === 'escuro' ? paletaEscura : paletaClara,
    estilos: criarEstilos(esquema === 'escuro' ? paletaEscura : paletaClara),
    coresArea,
    corDaArea: (id) => coresArea.find((c) => c.id === id) ?? coresArea[0],
  };
}

/** Os dois temas, criados uma vez. */
export const TEMAS: Record<Esquema, Tema> = { claro: criarTema('claro'), escuro: criarTema('escuro') };

export const ContextoDoTema = createContext<Tema>(TEMAS.claro);

/** O tema em uso (claro ou escuro): paleta, estilos partilhados e cores das áreas. */
export function useTema(): Tema {
  return useContext(ContextoDoTema);
}
