import { Platform } from 'react-native';

import { avisarErro } from '@/components/dialogos';
import { partilharFicheiro } from '@/copiaFicheiro';
import { exportarDados } from '@/data/copia';
import { registarCopia } from '@/data/definicoes';
import { paraDataISO } from '@/domain/semana';
import { t } from '@/i18n';

/** Onde guardar a cópia para ela ficar fora do telemóvel, dito para o sistema em que a app corre. */
export function ondeGuardarACopia(): string {
  if (Platform.OS === 'ios') return t('Na folha que abre, escolha “Guardar em Ficheiros” e depois iCloud Drive: assim a cópia fica fora do telemóvel e recupera-a noutro iPhone.');
  if (Platform.OS === 'android') return t('Na folha que abre, escolha “Drive” (Google Drive): assim a cópia fica fora do telemóvel e recupera-a noutro Android.');
  return t('O ficheiro é descarregado para este computador. Guarde-o numa pasta do iCloud Drive ou do Google Drive para o ter noutro lado.');
}

/** Escreve a cópia de segurança num ficheiro, abre a folha de partilha e regista a data da cópia. */
export async function exportarCopia(): Promise<boolean> {
  try {
    await partilharFicheiro(`align-${paraDataISO(new Date())}.json`, JSON.stringify(exportarDados(new Date(), { paraFicheiro: true }), null, 2));
    registarCopia();
    return true;
  } catch (erro) {
    avisarErro(t('Não foi possível exportar os dados'), erro);
    return false;
  }
}
