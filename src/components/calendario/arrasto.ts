import { useCallback, useEffect, useRef } from 'react';
import { usePanGesture } from 'react-native-gesture-handler';
import type Animated from 'react-native-reanimated';
import { measure, useAnimatedRef, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/*
 * Arrastar e largar no calendário.
 *
 * O dedo é seguido na thread da interface (worklets do Reanimated), por isso o arrasto não depende
 * do JavaScript e mantém-se fluido. O ecrã só é avisado em três momentos: quando se pega em algo,
 * quando o destino muda de meia hora, e quando se larga — e é aí que se escreve na base de dados.
 *
 * Há três arrastos: mover um bloco, esticar um bloco pela borda de baixo, e trazer uma tarefa da
 * bandeja "Por alocar" para a grelha.
 */

/** Largura da coluna das horas e folga por cima da primeira linha (para a etiqueta "6h" não ficar cortada). */
export const LARGURA_HORAS = 28;
export const TOPO_GRELHA = 8;
/** Altura mínima de meia hora, como no design (14 px); ecrãs altos usam mais. */
export const MEIA_HORA_MINIMA = 14;
/** Altura máxima de meia hora, ao ampliar com dois dedos. */
export const MEIA_HORA_MAXIMA = 72;

export const MODO_NENHUM = 0;
export const MODO_MOVER = 1;
export const MODO_ESTICAR = 2;
export const MODO_BANDEJA = 3;

/** O que a thread da interface precisa de saber de cada bloco para perceber em qual se tocou. */
export type BlocoNaGrelha = { id: number; dia: number; inicio: number; fim: number; coluna: number; colunas: number };

export type Largada = {
  modo: number;
  /** Id do bloco (mover, esticar) ou da tarefa (bandeja). */
  id: number;
  /** Destino encaixado: dia (0 = segunda) e minutos desde a meia-noite. */
  dia: number;
  inicioMin: number;
  fimMin: number;
  /** Largou em cima da grelha. */
  naGrelha: boolean;
  /** Largou em cima da bandeja "Por alocar" (devolve um bloco). */
  naBandeja: boolean;
};

type Opcoes = {
  /** Limites da grelha em minutos desde a meia-noite. */
  inicioMin: number;
  fimMin: number;
  blocos: BlocoNaGrelha[];
  aoPegar: (modo: number, id: number) => void;
  aoMudarAlvo: (dia: number, inicioMin: number, fimMin: number, naGrelha: boolean) => void;
  aoLargar: (largada: Largada) => void;
};

/** Mantém a mesma função entre renders, a chamar sempre a versão mais recente. */
function useEstavel<A extends unknown[]>(funcao: (...args: A) => void): (...args: A) => void {
  const atual = useRef(funcao);
  useEffect(() => {
    atual.current = funcao;
  });
  return useCallback((...args: A) => atual.current(...args), []);
}

export function useArrasto({ inicioMin, fimMin, blocos, aoPegar, aoMudarAlvo, aoLargar }: Opcoes) {
  const grelhaRef = useAnimatedRef<Animated.View>();
  const bandejaRef = useAnimatedRef<Animated.View>();
  const camadaRef = useAnimatedRef<Animated.View>();

  // Geometria da grelha. A grelha mostra `numDias` dias seguidos a partir de `primeiroDia` (0 = segunda).
  const larguraColuna = useSharedValue(0);
  const primeiroDia = useSharedValue(0);
  const numDias = useSharedValue(7);
  const alturaMeiaHora = useSharedValue(MEIA_HORA_MINIMA);
  const grelhaInicio = useSharedValue(inicioMin);
  const grelhaFim = useSharedValue(fimMin);
  const blocosNaGrelha = useSharedValue<BlocoNaGrelha[]>([]);
  // Posições no ecrã, medidas quando o arrasto começa.
  const origemX = useSharedValue(0);
  const origemY = useSharedValue(0);
  const bandejaTopo = useSharedValue(Number.MAX_SAFE_INTEGER);
  const camadaX = useSharedValue(0);
  const camadaY = useSharedValue(0);
  // O arrasto em curso.
  const modo = useSharedValue(MODO_NENHUM);
  const idArrastado = useSharedValue(0);
  const duracao = useSharedValue(60);
  /** Minutos entre o topo do bloco e o dedo, para o bloco não saltar ao ser agarrado. */
  const desvio = useSharedValue(0);
  const dedoX = useSharedValue(0);
  const dedoY = useSharedValue(0);
  const alvoDia = useSharedValue(0);
  const alvoInicio = useSharedValue(0);
  const alvoFim = useSharedValue(0);
  const naGrelha = useSharedValue(false);
  const naBandeja = useSharedValue(false);
  /**
   * Entre largar e o ecrã mostrar o bloco no sítio novo passam uns instantes (escrever e voltar a ler).
   * Enquanto isso o destino tracejado continua visível, para o bloco não parecer que desaparece.
   */
  const aPousar = useSharedValue(false);

  useEffect(() => {
    grelhaInicio.set(inicioMin);
    grelhaFim.set(fimMin);
  }, [inicioMin, fimMin, grelhaInicio, grelhaFim]);
  useEffect(() => {
    blocosNaGrelha.set(blocos);
  }, [blocos, blocosNaGrelha]);

  const avisarPegar = useEstavel(aoPegar);
  const avisarAlvo = useEstavel(aoMudarAlvo);
  const avisarLargar = useEstavel(aoLargar);

  /** Mede onde estão a grelha, a bandeja e a camada do fantasma. Devolve false se a grelha ainda não existir. */
  const medir = () => {
    'worklet';
    const grelha = measure(grelhaRef);
    if (grelha === null) return false;
    origemX.set(grelha.pageX);
    origemY.set(grelha.pageY);
    const bandeja = measure(bandejaRef);
    bandejaTopo.set(bandeja === null ? Number.MAX_SAFE_INTEGER : bandeja.pageY);
    const camada = measure(camadaRef);
    camadaX.set(camada === null ? 0 : camada.pageX);
    camadaY.set(camada === null ? 0 : camada.pageY);
    return true;
  };

  /** Converte a posição do dedo no destino encaixado (dia e meias horas) e avisa o ecrã quando muda. */
  const seguir = (x: number, y: number) => {
    'worklet';
    dedoX.set(x);
    dedoY.set(y);
    const largura = larguraColuna.get();
    const meiaHora = alturaMeiaHora.get();
    const inicioGrelha = grelhaInicio.get();
    const fimGrelha = grelhaFim.get();
    const relX = x - origemX.get() - LARGURA_HORAS;
    const relY = y - origemY.get() - TOPO_GRELHA;
    const altura = ((fimGrelha - inicioGrelha) / 30) * meiaHora;
    const sobreBandeja = y >= bandejaTopo.get();
    const visiveis = numDias.get();
    const sobreGrelha = !sobreBandeja && largura > 0 && relX >= -largura / 2 && relX <= largura * (visiveis + 0.5) && relY >= -meiaHora * 2 && relY <= altura + meiaHora * 2;
    const minutos = inicioGrelha + (relY / meiaHora) * 30;

    let dia = alvoDia.get();
    let inicio = alvoInicio.get();
    let fim = alvoFim.get();
    if (modo.get() === MODO_ESTICAR) {
      // Só a hora de fim muda: pelo menos meia hora, no máximo até ao fim da grelha.
      fim = Math.min(Math.max(fimGrelha, inicio + 30), Math.max(inicio + 30, Math.round(minutos / 30) * 30));
    } else if (largura > 0) {
      dia = primeiroDia.get() + Math.min(visiveis - 1, Math.max(0, Math.floor(relX / largura)));
      const maximo = Math.max(inicioGrelha, fimGrelha - duracao.get());
      inicio = Math.min(maximo, Math.max(inicioGrelha, Math.round((minutos - desvio.get()) / 30) * 30));
      fim = inicio + duracao.get();
    }

    const mudou = dia !== alvoDia.get() || inicio !== alvoInicio.get() || fim !== alvoFim.get() || sobreGrelha !== naGrelha.get();
    alvoDia.set(dia);
    alvoInicio.set(inicio);
    alvoFim.set(fim);
    naGrelha.set(sobreGrelha);
    naBandeja.set(sobreBandeja);
    if (mudou) scheduleOnRN(avisarAlvo, dia, inicio, fim, sobreGrelha);
  };

  /** Fecha o arrasto e entrega o resultado ao ecrã. */
  const terminar = (cancelado: boolean) => {
    'worklet';
    const emCurso = modo.get();
    if (emCurso === MODO_NENHUM) return;
    modo.set(MODO_NENHUM);
    aPousar.set(!cancelado && naGrelha.get());
    scheduleOnRN(avisarLargar, {
      modo: emCurso,
      id: idArrastado.get(),
      dia: alvoDia.get(),
      inicioMin: alvoInicio.get(),
      fimMin: alvoFim.get(),
      naGrelha: !cancelado && naGrelha.get(),
      naBandeja: !cancelado && naBandeja.get(),
    });
  };

  /**
   * Manter um bloco premido pega nele: pela parte de baixo estica-o, pelo resto move-o.
   * A espera inicial deixa a grelha deslizar normalmente quando o dedo se mexe logo.
   */
  const gestoGrelha = usePanGesture({
    activateAfterLongPress: 250,
    onActivate: (e) => {
      if (!medir()) return;
      const largura = larguraColuna.get();
      const meiaHora = alturaMeiaHora.get();
      const relX = e.absoluteX - origemX.get() - LARGURA_HORAS;
      const relY = e.absoluteY - origemY.get() - TOPO_GRELHA;
      if (largura <= 0 || relX < 0 || relY < 0) return;
      const coluna0 = Math.floor(relX / largura);
      if (coluna0 >= numDias.get()) return;
      const dia = primeiroDia.get() + coluna0;
      const minutos = grelhaInicio.get() + (relY / meiaHora) * 30;
      const folga = (8 / meiaHora) * 30; // 8 px por baixo do bloco também agarram a borda

      const lista = blocosNaGrelha.get();
      let tocado: BlocoNaGrelha | null = null;
      let porBaixo: BlocoNaGrelha | null = null;
      for (let i = 0; i < lista.length; i++) {
        const b = lista[i];
        if (b.dia !== dia) continue;
        const coluna = Math.min(b.colunas - 1, Math.floor(((relX - coluna0 * largura) / largura) * b.colunas));
        if (coluna !== b.coluna) continue;
        if (minutos >= b.inicio && minutos < b.fim) tocado = b;
        else if (minutos >= b.fim && minutos < b.fim + folga) porBaixo = b;
      }
      const bloco = tocado ?? porBaixo;
      if (bloco === null) return;

      const alturaBloco = ((bloco.fim - bloco.inicio) / 30) * meiaHora;
      const ateAoFim = ((bloco.fim - minutos) / 30) * meiaHora;
      // A borda de baixo é uma faixa estreita (6 px dentro do bloco, 8 px fora): o resto do bloco move-o.
      const esticar = tocado === null || ateAoFim <= Math.min(6, alturaBloco * 0.3);
      idArrastado.set(bloco.id);
      duracao.set(bloco.fim - bloco.inicio);
      desvio.set(minutos - bloco.inicio);
      alvoDia.set(bloco.dia);
      alvoInicio.set(bloco.inicio);
      alvoFim.set(bloco.fim);
      naGrelha.set(true);
      naBandeja.set(false);
      modo.set(esticar ? MODO_ESTICAR : MODO_MOVER);
      dedoX.set(e.absoluteX);
      dedoY.set(e.absoluteY);
      scheduleOnRN(avisarPegar, esticar ? MODO_ESTICAR : MODO_MOVER, bloco.id);
      scheduleOnRN(avisarAlvo, bloco.dia, bloco.inicio, bloco.fim, true);
    },
    onUpdate: (e) => {
      const emCurso = modo.get();
      if (emCurso === MODO_MOVER || emCurso === MODO_ESTICAR) seguir(e.absoluteX, e.absoluteY);
    },
    onDeactivate: (e) => {
      const emCurso = modo.get();
      if (emCurso === MODO_MOVER || emCurso === MODO_ESTICAR) terminar(e.canceled);
    },
    onFinalize: () => {
      const emCurso = modo.get();
      if (emCurso === MODO_MOVER || emCurso === MODO_ESTICAR) terminar(true);
    },
  });

  return {
    grelhaRef,
    bandejaRef,
    camadaRef,
    gestoGrelha,
    larguraColuna,
    primeiroDia,
    numDias,
    alturaMeiaHora,
    grelhaInicio,
    camadaX,
    camadaY,
    modo,
    idArrastado,
    duracao,
    desvio,
    dedoX,
    dedoY,
    alvoDia,
    alvoInicio,
    alvoFim,
    naGrelha,
    aPousar,
    medir,
    seguir,
    terminar,
    avisarPegar,
  };
}

/** O arrasto sem as referências às vistas, que seguem à parte para cada componente as ligar à sua vista. */
export type Arrasto = Omit<ReturnType<typeof useArrasto>, 'grelhaRef' | 'bandejaRef' | 'camadaRef'>;
export type RefDeVista = ReturnType<typeof useArrasto>['grelhaRef'];

/**
 * Arrastar uma tarefa da bandeja: começa quando o dedo sobe ou desce (a bandeja desliza para os lados,
 * por isso um movimento horizontal continua a ser deslizar a lista).
 */
export function useGestoDaBandeja(arrasto: Arrasto, tarefaId: number, duracaoMin: number) {
  const { modo, idArrastado, duracao, desvio, medir, seguir, terminar, avisarPegar } = arrasto;
  return usePanGesture({
    activeOffsetY: [-10, 10],
    failOffsetX: [-16, 16],
    onActivate: (e) => {
      if (modo.get() !== MODO_NENHUM || !medir()) return;
      idArrastado.set(tarefaId);
      duracao.set(duracaoMin);
      // O dedo fica meia hora abaixo do topo do bloco, para o início se ver por cima do dedo.
      desvio.set(Math.min(30, duracaoMin / 2));
      modo.set(MODO_BANDEJA);
      scheduleOnRN(avisarPegar, MODO_BANDEJA, tarefaId);
      seguir(e.absoluteX, e.absoluteY);
    },
    onUpdate: (e) => {
      if (modo.get() === MODO_BANDEJA && idArrastado.get() === tarefaId) seguir(e.absoluteX, e.absoluteY);
    },
    onDeactivate: (e) => {
      if (modo.get() === MODO_BANDEJA && idArrastado.get() === tarefaId) terminar(e.canceled);
    },
    onFinalize: () => {
      if (modo.get() === MODO_BANDEJA && idArrastado.get() === tarefaId) terminar(true);
    },
  });
}
