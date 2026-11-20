import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Opcao } from '@/components/ui';
import { dataValida } from '@/domain/metas';
import { somarMeses } from '@/domain/semana';
import { useTema } from '@/theme';

type Props = {
  /** AAAA-MM-DD, ou '' enquanto a data não estiver completa. */
  valor: string;
  onChange: (dataISO: string) => void;
  /** Dia de hoje, para os atalhos ("3 meses", "1 ano"). */
  hoje: string;
  /** O que a data representa, para o leitor de ecrã (ex.: "Prazo"). */
  rotulo: string;
};

const ATALHOS = [
  { titulo: '1 mês', meses: 1 },
  { titulo: '3 meses', meses: 3 },
  { titulo: '6 meses', meses: 6 },
  { titulo: '1 ano', meses: 12 },
];

const so_digitos = (texto: string, maximo: number) => texto.replace(/\D/g, '').slice(0, maximo);

/**
 * Escolha de uma data sem depender de um seletor nativo (funciona igual no telemóvel e no navegador):
 * dia, mês e ano escritos com o teclado numérico, e atalhos para os prazos mais comuns.
 */
export function CampoData({ valor, onChange, hoje, rotulo }: Props) {
  const { cores, estilos } = useTema();
  const [ano0, mes0, dia0] = valor ? valor.split('-') : ['', '', ''];
  const [dia, setDia] = useState(dia0 ? String(Number(dia0)) : '');
  const [mes, setMes] = useState(mes0 ? String(Number(mes0)) : '');
  const [ano, setAno] = useState(ano0);

  function mudar(d: string, m: string, a: string) {
    setDia(d);
    setMes(m);
    setAno(a);
    const iso = a.length === 4 && d && m ? `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
    onChange(dataValida(iso) ? iso : '');
  }

  function atalho(meses: number) {
    const [a, m, d] = somarMeses(hoje, meses).split('-');
    mudar(String(Number(d)), String(Number(m)), a);
  }

  const completa = ano.length === 4 && dia !== '' && mes !== '';
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput value={dia} onChangeText={(t) => mudar(so_digitos(t, 2), mes, ano)} placeholder="Dia" placeholderTextColor={cores.texto3} keyboardType="number-pad" maxLength={2} accessibilityLabel={`${rotulo}: dia`} style={[estilos.campo, { width: 64, textAlign: 'center' }]} />
        <Text style={estilos.corpo}>/</Text>
        <TextInput value={mes} onChangeText={(t) => mudar(dia, so_digitos(t, 2), ano)} placeholder="Mês" placeholderTextColor={cores.texto3} keyboardType="number-pad" maxLength={2} accessibilityLabel={`${rotulo}: mês`} style={[estilos.campo, { width: 64, textAlign: 'center' }]} />
        <Text style={estilos.corpo}>/</Text>
        <TextInput value={ano} onChangeText={(t) => mudar(dia, mes, so_digitos(t, 4))} placeholder="Ano" placeholderTextColor={cores.texto3} keyboardType="number-pad" maxLength={4} accessibilityLabel={`${rotulo}: ano`} style={[estilos.campo, { width: 84, textAlign: 'center' }]} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ATALHOS.map((a) => (
          <Opcao key={a.titulo} titulo={a.titulo} rotulo={`${rotulo} daqui a ${a.titulo}`} ativa={valor !== '' && valor === somarMeses(hoje, a.meses)} onPress={() => atalho(a.meses)} />
        ))}
      </View>
      {completa && !valor ? <Text style={[estilos.pequeno, { color: cores.perigo }]}>Esta data não existe.</Text> : null}
    </View>
  );
}
