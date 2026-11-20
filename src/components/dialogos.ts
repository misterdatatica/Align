import { Alert, Platform } from 'react-native';

import { ErroDaApp } from '@/domain/erros';

/*
 * Avisos e confirmações. No telemóvel usam os diálogos nativos; no navegador o `Alert` do
 * React Native não faz nada, por isso usam-se os do próprio navegador.
 */

export function avisar(titulo: string, mensagem?: string) {
  if (Platform.OS === 'web') {
    window.alert(mensagem ? `${titulo}\n\n${mensagem}` : titulo);
    return;
  }
  Alert.alert(titulo, mensagem);
}

/** Mensagem para os erros técnicos, que não diriam nada a quem usa a app. */
export const MENSAGEM_GENERICA = 'Tente outra vez. Os seus dados estão seguros.';

export type ErroRegistado = { quando: string; titulo: string; detalhe: string };

/** Os últimos erros técnicos, mais recentes no fim (só em memória, para diagnosticar). */
const registo: ErroRegistado[] = [];
const MAXIMO_NO_REGISTO = 50;

export function errosRecentes(): readonly ErroRegistado[] {
  return registo;
}

/**
 * Mostra o erro de uma ação que falhou. As mensagens escritas para o utilizador (ErroDaApp) aparecem
 * tal como estão; os erros técnicos ficam no registo interno e o ecrã mostra uma mensagem simples
 * (com o detalhe só em desenvolvimento).
 */
export function avisarErro(titulo: string, erro: unknown) {
  if (erro instanceof ErroDaApp) {
    avisar(titulo, erro.message);
    return;
  }
  const detalhe = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
  registo.push({ quando: new Date().toISOString(), titulo, detalhe });
  if (registo.length > MAXIMO_NO_REGISTO) registo.shift();
  console.warn(`${titulo} — ${detalhe}`);
  avisar(titulo, __DEV__ ? `${MENSAGEM_GENERICA}\n\n${detalhe}` : MENSAGEM_GENERICA);
}

type Confirmacao = {
  titulo: string;
  mensagem?: string;
  /** Texto do botão que confirma, ex.: "Apagar". */
  acao: string;
  /** Ação que não se pode desfazer (botão a vermelho no iOS). */
  destrutiva?: boolean;
};

export function confirmar({ titulo, mensagem, acao, destrutiva }: Confirmacao): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(mensagem ? `${titulo}\n\n${mensagem}` : titulo));
  }
  return new Promise((resolver) => {
    Alert.alert(
      titulo,
      mensagem,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
        { text: acao, style: destrutiva ? 'destructive' : 'default', onPress: () => resolver(true) },
      ],
      { cancelable: true, onDismiss: () => resolver(false) },
    );
  });
}
