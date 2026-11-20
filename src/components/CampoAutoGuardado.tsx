import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { avisarErro } from '@/components/dialogos';
import { cores, fontes } from '@/theme';

/** Quanto tempo fica à vista o "Guardado ✓". */
const GUARDADO_MS = 1500;

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> & {
  inicial: string;
  guardar: (texto: string) => Promise<void>;
  /** Campo que não pode ficar vazio (ex.: nome): o texto vazio não é guardado e é reposto ao sair. */
  obrigatorio?: boolean;
  /** Título do aviso se não for possível guardar. */
  erro: string;
  /** Estilo da caixa à volta do campo (ex.: `flex: 1` numa linha). */
  contentor?: StyleProp<ViewStyle>;
};

/**
 * Guarda enquanto o utilizador escreve (com uma pequena pausa), ao sair do campo
 * e ao sair do ecrã — não depende de onEndEditing, que nem sempre dispara (web, voltar atrás).
 * Cada vez que guarda mostra um "Guardado ✓" discreto por baixo do campo, durante um instante.
 */
export function CampoAutoGuardado({ inicial, guardar: guardarTexto, obrigatorio, erro, contentor, ...resto }: Props) {
  const [texto, setTexto] = useState(inicial);
  const [guardadoVisivel, setGuardadoVisivel] = useState(false);
  const temporizadorDoAviso = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (temporizadorDoAviso.current) clearTimeout(temporizadorDoAviso.current);
    },
    [],
  );
  const guardado = useRef(inicial.trim());
  const pendente = useRef<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const funcaoGuardar = useRef(guardarTexto);
  useEffect(() => {
    funcaoGuardar.current = guardarTexto;
  });

  const guardar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    const valor = pendente.current;
    pendente.current = null;
    if (valor === null || valor === guardado.current) return;
    if (obrigatorio && !valor) return;
    guardado.current = valor;
    funcaoGuardar.current(valor).then(
      () => {
        setGuardadoVisivel(true);
        if (temporizadorDoAviso.current) clearTimeout(temporizadorDoAviso.current);
        temporizadorDoAviso.current = setTimeout(() => setGuardadoVisivel(false), GUARDADO_MS);
      },
      (e: unknown) => avisarErro(erro, e),
    );
  }, [obrigatorio, erro]);

  // Ao sair do ecrã, guarda o que ainda estiver por guardar.
  useEffect(() => guardar, [guardar]);

  function mudar(novo: string) {
    setTexto(novo);
    pendente.current = novo.trim();
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(guardar, 600);
  }

  function sair() {
    guardar();
    // Um campo obrigatório deixado vazio volta ao último valor guardado.
    if (obrigatorio && !texto.trim()) setTexto(guardado.current);
  }

  return (
    <View style={contentor}>
      <TextInput value={texto} onChangeText={mudar} onBlur={sair} placeholderTextColor={cores.texto3} {...resto} />
      {/* Fora do fluxo, para o ecrã não saltar quando aparece e desaparece. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: '100%', right: 4, marginTop: 2, opacity: guardadoVisivel ? 1 : 0 }} accessibilityLiveRegion="polite">
        <Text style={{ fontFamily: fontes.textoMedio, fontSize: 11, lineHeight: 14, color: cores.texto3 }}>{guardadoVisivel ? 'Guardado ✓' : ''}</Text>
      </View>
    </View>
  );
}
