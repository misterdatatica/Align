import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Opcao } from '@/components/ui';
import { dataValida } from '@/domain/metas';
import { somarMeses } from '@/domain/semana';
import { useTema } from '@/theme';
import { t } from '@/i18n';

type Props = {
  /** AAAA-MM-DD, ou '' enquanto a data não estiver completa. */
  valor: string;
  onChange: (dataISO: string) => void;
  /** Dia de hoje, para os atalhos ("3 meses", "1 ano"). */
  hoje: string;
  /** O que a data representa, para o leitor de ecrã (ex.: "Prazo"). */
  rotulo: string;
};

const ATALHOS = () => [
  { titulo: t('1 mês'), meses: 1 },
  { titulo: t('3 meses'), meses: 3 },
  { titulo: t('6 meses'), meses: 6 },
  { titulo: t('1 ano'), meses: 12 },
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
        <TextInput value={dia} onChangeText={(tf) => mudar(so_digitos(tf, 2), mes, ano)} placeholder={t('Dia')} placeholderTextColor={cores.texto3} keyboardType="number-pad" maxLength={2} accessibilityLabel={t('{campo}: dia', { campo: rotulo })} style={[estilos.campo, { width: 64, textAlign: 'center' }]} />
        <Text style={estilos.corpo}>/</Text>
        <TextInput value={mes} onChangeText={(tf) => mudar(dia, so_digitos(tf, 2), ano)} placeholder={t('Mês')} placeholderTextColor={cores.texto3} keyboardType="number-pad" maxLength={2} accessibilityLabel={t('{campo}: mês', { campo: rotulo })} style={[estilos.campo, { width: 64, textAlign: 'center' }]} />
        <Text style={estilos.corpo}>/</Text>
        <TextInput value={ano} onChangeText={(tf) => mudar(dia, mes, so_digitos(tf, 4))} placeholder={t('Ano')} placeholderTextColor={cores.texto3} keyboardType="number-pad" maxLength={4} accessibilityLabel={t('{campo}: ano', { campo: rotulo })} style={[estilos.campo, { width: 84, textAlign: 'center' }]} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ATALHOS().map((a) => (
          <Opcao key={a.titulo} titulo={a.titulo} rotulo={t('{campo} daqui a {tempo}', { campo: rotulo, tempo: a.titulo })} ativa={valor !== '' && valor === somarMeses(hoje, a.meses)} onPress={() => atalho(a.meses)} />
        ))}
      </View>
      {completa && !valor ? <Text style={[estilos.pequeno, { color: cores.perigo }]}>{t('Esta data não existe.')}</Text> : null}
    </View>
  );
}
