import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { avisarErro } from '@/components/dialogos';
import { cores } from '@/theme';

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> & {
  inicial: string;
  guardar: (texto: string) => Promise<void>;
  /** Campo que não pode ficar vazio (ex.: nome): o texto vazio não é guardado e é reposto ao sair. */
  obrigatorio?: boolean;
  /** Título do aviso se não for possível guardar. */
  erro: string;
};

/**
 * Guarda enquanto o utilizador escreve (com uma pequena pausa), ao sair do campo
 * e ao sair do ecrã — não depende de onEndEditing, que nem sempre dispara (web, voltar atrás).
 */
export function CampoAutoGuardado({ inicial, guardar: guardarTexto, obrigatorio, erro, ...resto }: Props) {
  const [texto, setTexto] = useState(inicial);
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
    funcaoGuardar.current(valor).catch((e: unknown) => avisarErro(erro, e));
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

  return <TextInput value={texto} onChangeText={mudar} onBlur={sair} placeholderTextColor={cores.texto3} {...resto} />;
}
