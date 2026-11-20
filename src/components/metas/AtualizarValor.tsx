import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { avisarErro } from '@/components/dialogos';
import { Botao } from '@/components/ui';
import { registarValor, type MetaDetalhada } from '@/data/metas';
import { formatarValor, lerValor } from '@/domain/metas';
import { useTema } from '@/theme';

type Props = {
  meta: Pick<MetaDetalhada, 'id' | 'descricao' | 'valorAtual' | 'unidade' | 'registos'>;
  /** Dia de hoje, AAAA-MM-DD: a atualização fica registada com esta data. */
  hoje: string;
};

/**
 * Atualizar o valor atual de uma meta de número. Cada registo fica no histórico com a data de hoje;
 * registar o mesmo valor também conta ("continua em 25").
 */
export function AtualizarValor({ meta, hoje }: Props) {
  const { cores, estilos } = useTema();
  const [texto, setTexto] = useState(meta.valorAtual === null ? '' : formatarValor(meta.valorAtual));
  const valor = lerValor(texto);
  const registadoHoje = meta.registos.at(-1)?.data === hoje;

  function registar() {
    if (valor === null) return;
    try {
      registarValor(meta.id, valor, hoje);
    } catch (erro) {
      avisarErro('Não foi possível registar o valor', erro);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          keyboardType="decimal-pad"
          maxLength={9}
          selectTextOnFocus
          accessibilityLabel={`Valor atual de ${meta.descricao}`}
          placeholderTextColor={cores.texto3}
          style={[estilos.campo, { width: 92, textAlign: 'center' }]}
        />
        {meta.unidade ? (
          <Text style={[estilos.corpo, { flexShrink: 1 }]} numberOfLines={2}>
            {meta.unidade}
          </Text>
        ) : null}
        <Botao
          titulo={registadoHoje ? 'Corrigir' : 'Registar'}
          variante={registadoHoje ? 'contorno' : 'primario'}
          accessibilityLabel={`${registadoHoje ? 'Corrigir' : 'Registar'} o valor de ${meta.descricao}`}
          onPress={registar}
          disabled={valor === null}
          style={{ marginLeft: 'auto', minHeight: 44, paddingHorizontal: 14 }}
        />
      </View>
      {registadoHoje ? <Text style={estilos.pequeno}>{`Registado hoje: ${formatarValor(meta.valorAtual ?? 0)}.`}</Text> : null}
    </View>
  );
}
