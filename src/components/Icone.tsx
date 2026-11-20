import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTema } from '@/theme';

export type NomeIcone =
  | 'folha'
  | 'casa'
  | 'pasta'
  | 'bola'
  | 'coracao'
  | 'livro'
  | 'grelha'
  | 'lista'
  | 'calendario'
  | 'grafico'
  | 'revisao'
  | 'mais'
  | 'seta-direita'
  | 'seta-esquerda'
  | 'certo'
  | 'repetir'
  | 'lapis'
  | 'menos'
  | 'fechar'
  | 'lixo'
  | 'pegas'
  | 'engrenagem'
  | 'sino'
  | 'estrela'
  | 'aviso'
  | 'alvo'
  | 'pausa'
  | 'sol';

/** Ícones de areas que o utilizador pode escolher. */
export const iconesArea: NomeIcone[] = ['folha', 'casa', 'pasta', 'bola', 'coracao', 'livro'];

type Props = { nome: NomeIcone; tamanho?: number; cor?: string; espessura?: number };

/**
 * Os ícones são decorativos: o leitor de ecrã lê o rótulo do botão, não o desenho.
 * No navegador o SVG só conhece `aria-hidden`; no telemóvel usam-se as propriedades nativas.
 */
const ESCONDIDO =
  process.env.EXPO_OS === 'web' ? ({ 'aria-hidden': true } as const) : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const);

/** Ícones de traço simples, desenhados à mão (viewBox 24×24). */
export function Icone({ nome, tamanho = 20, cor: corPedida, espessura = 1.8 }: Props) {
  const { cores } = useTema();
  const cor = corPedida ?? cores.tinta;
  const traco = { stroke: cor, strokeWidth: espessura, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" {...ESCONDIDO}>
      {desenho(nome, traco, cor)}
    </Svg>
  );
}

function desenho(nome: NomeIcone, t: object, cor: string) {
  switch (nome) {
    case 'sol':
      return (
        <>
          <Circle cx="12" cy="12" r="4" {...t} />
          <Path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5" {...t} />
        </>
      );
    case 'folha':
      return (
        <>
          <Path d="M5 19c0-8.3 5.7-14 14-14 0 8.3-5.7 14-14 14z" {...t} />
          <Path d="M5 19l8-8" {...t} />
        </>
      );
    case 'casa':
      return (
        <>
          <Path d="M3 10.5 12 3l9 7.5" {...t} />
          <Path d="M5.5 9v11h13V9" {...t} />
          <Path d="M10 20v-5h4v5" {...t} />
        </>
      );
    case 'pasta':
      return (
        <>
          <Rect x="3" y="7" width="18" height="13" rx="2" {...t} />
          <Path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" {...t} />
        </>
      );
    case 'bola':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...t} />
          <Path d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z" {...t} />
          <Path d="M12 3v4.5M16 10.4l4.6-1.5M14.5 15.1l2.8 3.9M9.5 15.1 6.7 19M8 10.4 3.4 8.9" {...t} />
        </>
      );
    case 'coracao':
      return <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...t} />;
    case 'livro':
      return (
        <>
          <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" {...t} />
          <Path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" {...t} />
        </>
      );
    case 'grelha':
      return (
        <>
          <Rect x="3" y="3" width="7" height="7" rx="1.5" {...t} />
          <Rect x="14" y="3" width="7" height="7" rx="1.5" {...t} />
          <Rect x="3" y="14" width="7" height="7" rx="1.5" {...t} />
          <Rect x="14" y="14" width="7" height="7" rx="1.5" {...t} />
        </>
      );
    case 'lista':
      return (
        <>
          <Path d="M9 6h11M9 12h11M9 18h11" {...t} />
          <Circle cx="4.5" cy="6" r="1.2" fill={cor} />
          <Circle cx="4.5" cy="12" r="1.2" fill={cor} />
          <Circle cx="4.5" cy="18" r="1.2" fill={cor} />
        </>
      );
    case 'calendario':
      return (
        <>
          <Rect x="3" y="5" width="18" height="16" rx="2" {...t} />
          <Path d="M3 10h18M8 3v4M16 3v4" {...t} />
        </>
      );
    case 'grafico':
      return <Path d="M4 20h16M7 16v-5M12 16V6M17 16V9" {...t} />;
    case 'revisao':
      return (
        <>
          <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" {...t} />
          <Path d="M3 3v5h5" {...t} />
        </>
      );
    case 'mais':
      return <Path d="M12 5v14M5 12h14" {...t} />;
    case 'seta-direita':
      return <Path d="m9 6 6 6-6 6" {...t} />;
    case 'seta-esquerda':
      return <Path d="m15 6-6 6 6 6" {...t} />;
    case 'certo':
      return <Path d="m5 12.5 4.5 4.5L19 7" {...t} />;
    case 'repetir':
      return <Path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" {...t} />;
    case 'lapis':
      return <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" {...t} />;
    case 'menos':
      return <Path d="M5 12h14" {...t} />;
    case 'fechar':
      return <Path d="M6 6l12 12M18 6 6 18" {...t} />;
    case 'lixo':
      return <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" {...t} />;
    case 'pegas':
      // Seis pontos: indica que o elemento se pode arrastar.
      return (
        <>
          {[6, 12, 18].flatMap((y) => [9, 15].map((x) => <Circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill={cor} />))}
        </>
      );
    case 'engrenagem':
      return (
        <>
          <Circle cx="12" cy="12" r="3" {...t} />
          <Path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0-1.2-2.8H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 2.8-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0 1.2 2.8h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
            {...t}
          />
        </>
      );
    case 'sino':
      return <Path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0" {...t} />;
    case 'estrela':
      return <Path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9-4.3-4.1 5.9-.8z" {...t} />;
    case 'aviso':
      return <Path d="M12 4.5 2.8 20h18.4zM12 10.5v4M12 17.3v.1" {...t} />;
    case 'alvo':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...t} />
          <Circle cx="12" cy="12" r="5" {...t} />
          <Circle cx="12" cy="12" r="1.2" fill={cor} />
        </>
      );
    case 'pausa':
      return <Path d="M9 5v14M15 5v14" {...t} />;
  }
}
