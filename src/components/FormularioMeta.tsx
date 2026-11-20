import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { CampoData } from '@/components/CampoData';
import { avisarErro } from '@/components/dialogos';
import { Botao, Opcao, Seccao } from '@/components/ui';
import { atualizarMeta, criarMeta } from '@/data/metas';
import type { Meta } from '@/db/schema';
import { alvoDescendente, descreverDiasQueFaltam, diasQueFaltam, formatarValor, lerValor, valorComUnidade, type MedidaMeta } from '@/domain/metas';
import { descreverData } from '@/domain/semana';
import { useTema } from '@/theme';

type Props = {
  areaId: number;
  /** Meta a alterar; sem ela, o formulário cria uma nova. */
  meta?: Meta;
  /** Dia de hoje, AAAA-MM-DD. */
  hoje: string;
  aoFechar: () => void;
};

const MEDIDAS: { medida: MedidaMeta; titulo: string; ajuda: string }[] = [
  { medida: 'numero', titulo: 'Número', ajuda: 'Tem um valor de partida e um alvo, e vai registando por onde anda. O alvo pode ser mais baixo do que a partida (tempo, peso).' },
  { medida: 'marco', titulo: 'Marco', ajuda: 'Sim ou não: alcançou ou ainda não. Ex.: “Fazer uma viagem com os pais”.' },
];

/**
 * Criar ou alterar uma meta: um resultado a alcançar até uma data, medido com um número ou como um
 * marco. O que se faz para lá chegar são as tarefas, que se ligam à meta no formulário da tarefa.
 */
export function FormularioMeta({ areaId, meta, hoje, aoFechar }: Props) {
  const { cores, estilos } = useTema();
  const [medida, setMedida] = useState<MedidaMeta>(meta?.medida ?? 'numero');
  const [descricao, setDescricao] = useState(meta?.descricao ?? '');
  const [prazo, setPrazo] = useState(meta?.prazo ?? '');
  const [inicial, setInicial] = useState(meta?.valorInicial != null ? formatarValor(meta.valorInicial) : '');
  const [alvo, setAlvo] = useState(meta?.valorAlvo != null ? formatarValor(meta.valorAlvo) : '');
  const [unidade, setUnidade] = useState(meta?.unidade ?? '');
  const [aGuardar, setAGuardar] = useState(false);

  const valorInicial = lerValor(inicial);
  const valorAlvo = lerValor(alvo);
  const numeroValido = medida === 'marco' || (valorInicial !== null && valorAlvo !== null && valorInicial !== valorAlvo);
  const valido = descricao.trim().length > 0 && prazo !== '' && numeroValido;
  const faltam = prazo ? diasQueFaltam(hoje, prazo) : null;

  function guardar() {
    const dados = { descricao, prazo, medida, valorInicial, valorAlvo, unidade };
    setAGuardar(true);
    try {
      if (meta) atualizarMeta(meta.id, dados);
      else criarMeta({ areaId, ...dados });
      aoFechar();
    } catch (erro) {
      avisarErro('Não foi possível guardar a meta', erro);
      setAGuardar(false);
    }
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Seccao titulo="Onde quer chegar?">
        <TextInput
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Ex.: Conseguir meditar 1 h seguida"
          placeholderTextColor={cores.texto3}
          style={estilos.campo}
          accessibilityLabel="Descrição da meta"
          autoFocus={!meta}
          maxLength={80}
          returnKeyType="done"
        />
        <Text style={estilos.pequeno}>Um resultado, não uma atividade: o que faz para lá chegar são as tarefas.</Text>
      </Seccao>

      <Seccao titulo="Como se mede?">
        {meta ? (
          <Text style={estilos.corpo}>{MEDIDAS.find((m) => m.medida === medida)?.titulo}</Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Como se mede">
            {MEDIDAS.map((m) => (
              <Opcao key={m.medida} titulo={m.titulo} ativa={medida === m.medida} onPress={() => setMedida(m.medida)} />
            ))}
          </View>
        )}
        <Text style={estilos.pequeno}>{MEDIDAS.find((m) => m.medida === medida)?.ajuda}</Text>
      </Seccao>

      {medida === 'numero' ? (
        <Seccao titulo="Valores">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Text style={estilos.corpo}>De</Text>
            <TextInput value={inicial} onChangeText={setInicial} placeholder="20" placeholderTextColor={cores.texto3} keyboardType="decimal-pad" maxLength={9} accessibilityLabel="Valor de partida" style={[estilos.campo, { width: 84 }]} />
            <Text style={estilos.corpo}>para</Text>
            <TextInput value={alvo} onChangeText={setAlvo} placeholder="60" placeholderTextColor={cores.texto3} keyboardType="decimal-pad" maxLength={9} accessibilityLabel="Valor alvo" style={[estilos.campo, { width: 84 }]} />
            <TextInput
              value={unidade}
              onChangeText={setUnidade}
              placeholder="unidade, ex.: min seguidos"
              placeholderTextColor={cores.texto3}
              autoCapitalize="none"
              maxLength={24}
              accessibilityLabel="Unidade (opcional)"
              style={[estilos.campo, { flexGrow: 1, flexBasis: 160 }]}
            />
          </View>
          {valorInicial !== null && valorAlvo !== null ? (
            <Text style={estilos.pequeno}>
              {valorInicial === valorAlvo
                ? 'O alvo tem de ser diferente do valor de partida.'
                : `De ${formatarValor(valorInicial)} para ${valorComUnidade(valorAlvo, unidade)}${alvoDescendente(valorInicial, valorAlvo) ? ': avançar é descer.' : '.'}`}
            </Text>
          ) : null}
        </Seccao>
      ) : null}

      <Seccao titulo="Prazo">
        <CampoData valor={prazo} onChange={setPrazo} hoje={hoje} rotulo="Prazo" />
        {prazo && faltam !== null ? (
          <Text style={[estilos.pequeno, faltam < 0 ? { color: cores.perigo } : null]}>{`Até ${descreverData(prazo)}: ${descreverDiasQueFaltam(faltam)}.`}</Text>
        ) : (
          <Text style={estilos.pequeno}>Uma meta precisa de uma data para lá chegar.</Text>
        )}
      </Seccao>

      <Botao titulo={meta ? 'Guardar alterações' : 'Criar meta'} onPress={guardar} disabled={!valido || aGuardar} />
    </ScrollView>
  );
}
