import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CampoAutoGuardado } from '@/components/CampoAutoGuardado';
import { avisarErro, confirmar } from '@/components/dialogos';
import { FormularioMeta } from '@/components/FormularioMeta';
import { Icone, type NomeIcone } from '@/components/Icone';
import { LinhaTarefa } from '@/components/LinhaTarefa';
import { BarraProgresso, Botao, Cartao, Seccao, SeletorCor, SeletorIcone, estilos } from '@/components/ui';
import { arquivarArea, atualizarArea, carregarAreaNaSemana, type MetaComProgresso } from '@/data/areas';
import { useConsulta } from '@/data/consulta';
import { alvoDaMeta, contarUnidade, formatarHoras, formatarProgressoHoras, medidaSemanal, progresso } from '@/domain/regras';
import { usePrepararSemana, useSemanaAtual } from '@/estado/semana';
import { cores, corDaArea, fontes } from '@/theme';

const TABELAS = ['areas', 'metas', 'tarefas', 'tarefas_semana', 'blocos'] as const;

export default function AreaEcra() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const areaId = Number(id);
  const router = useRouter();
  const semana = useSemanaAtual();
  usePrepararSemana(semana);
  const dados = useConsulta(() => carregarAreaNaSemana(areaId, semana), TABELAS, `${areaId}|${semana}`);
  /** Meta aberta no formulário: o id de uma meta, 'nova', ou null (nenhuma). */
  const [metaAberta, setMetaAberta] = useState<number | 'nova' | null>(null);

  if (!dados) return null;
  const { area, metas, tarefas } = dados;
  const cor = corDaArea(area.cor);

  async function arquivar() {
    const sim = await confirmar({
      titulo: 'Arquivar área?',
      mensagem: 'A área deixa de aparecer, mas o histórico fica guardado.',
      acao: 'Arquivar',
      destrutiva: true,
    });
    if (!sim) return;
    try {
      await arquivarArea(areaId);
      router.back();
    } catch (e) {
      avisarErro('Não foi possível arquivar a área', e);
    }
  }

  function mudar(campos: Parameters<typeof atualizarArea>[1]) {
    atualizarArea(areaId, campos).catch((e: unknown) => avisarErro('Não foi possível guardar', e));
  }

  return (
    <ScrollView style={estilos.ecra} contentContainerStyle={[estilos.conteudo, { paddingTop: 4 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: cor.tinta, alignItems: 'center', justifyContent: 'center' }}>
          <Icone nome={area.icone as NomeIcone} tamanho={24} cor={cor.texto} />
        </View>
        <CampoAutoGuardado
          key={`nome-${area.id}`}
          inicial={area.nome}
          guardar={(nome) => atualizarArea(areaId, { nome })}
          obrigatorio
          erro="Não foi possível guardar o nome"
          maxLength={40}
          accessibilityLabel="Nome da área"
          placeholder="Nome da área"
          style={[estilos.titulo, { flex: 1, paddingVertical: 4 }]}
        />
      </View>

      <Seccao titulo="Missão">
        <CampoAutoGuardado
          key={`missao-${area.id}`}
          inicial={area.missao}
          guardar={(missao) => atualizarArea(areaId, { missao })}
          erro="Não foi possível guardar a missão"
          placeholder="Porque é que esta área importa?"
          multiline
          maxLength={140}
          accessibilityLabel="Missão"
          style={[estilos.cartao, { padding: 16, fontFamily: fontes.tituloMedio, fontSize: 20, lineHeight: 26, color: cores.tinta }]}
        />
      </Seccao>

      <Seccao titulo="Metas">
        <Cartao>
          {metas.map((m, i) => (
            <View key={m.id} style={i === 0 ? null : { borderTopWidth: 1, borderTopColor: cores.linhaSuave }}>
              {metaAberta === m.id ? (
                <FormularioMeta areaId={areaId} meta={m} aoFechar={() => setMetaAberta(null)} />
              ) : (
                <LinhaMeta meta={m} cor={cor.forte} aoAbrir={() => setMetaAberta(m.id)} />
              )}
            </View>
          ))}
          <View style={metas.length > 0 ? { borderTopWidth: 1, borderTopColor: cores.linhaSuave } : null}>
            {metaAberta === 'nova' ? (
              <FormularioMeta areaId={areaId} aoFechar={() => setMetaAberta(null)} />
            ) : (
              <View style={{ paddingHorizontal: 8 }}>
                <Botao titulo="Adicionar meta" icone="mais" variante="texto" onPress={() => setMetaAberta('nova')} />
              </View>
            )}
          </View>
        </Cartao>
      </Seccao>

      <Seccao titulo="Tarefas desta semana">
        <View style={[estilos.cartao, { overflow: 'hidden' }]}>
          {tarefas.map((t, i) => (
            <LinhaTarefa key={t.id} tarefa={t} semana={semana} porExtenso semLinha={i === 0} />
          ))}
          <View style={[{ paddingHorizontal: 8 }, tarefas.length > 0 ? { borderTopWidth: 1, borderTopColor: cores.linhaSuave } : null]}>
            <Botao
              titulo="Nova tarefa"
              icone="mais"
              variante="texto"
              onPress={() => router.push({ pathname: '/tarefa/nova', params: { areaId: String(areaId), semana } })}
            />
          </View>
        </View>
      </Seccao>

      <Seccao titulo="Cor">
        <SeletorCor valor={area.cor} onChange={(c) => mudar({ cor: c })} />
      </Seccao>

      <Seccao titulo="Ícone">
        <SeletorIcone valor={area.icone} cor={area.cor} onChange={(i) => mudar({ icone: i })} />
      </Seccao>

      <Botao titulo="Arquivar área" variante="texto" onPress={arquivar} />
    </ScrollView>
  );
}

/**
 * Uma meta com o progresso desta semana. As metas de tempo comparam as horas planeadas com o alvo;
 * as de vezes contam as tarefas já feitas. Só contam as tarefas ligadas à meta.
 */
function LinhaMeta({ meta, cor, aoAbrir }: { meta: MetaComProgresso; cor: string; aoAbrir: () => void }) {
  const p = meta.progresso;
  const deTempo = meta.tipo === 'horas';
  const legenda = deTempo ? 'Planeado para esta semana' : 'Feito esta semana';
  const valor = deTempo
    ? formatarProgressoHoras(p.minutosPlaneados / 60, meta.alvoSemanal)
    : `${p.vezesFeitas} de ${contarUnidade(meta.alvoSemanal, meta.unidade)}`;
  const proporcao = deTempo ? progresso(p.minutosPlaneados / 60, meta.alvoSemanal) : progresso(p.vezesFeitas, meta.alvoSemanal);

  let nota: string | null = null;
  if (p.vezesPlaneadas === 0) nota = 'Ainda não há tarefas desta semana ligadas a esta meta.';
  else if (deTempo && p.minutosCalendario < p.minutosPlaneados) nota = `Falta pôr ${formatarHoras((p.minutosPlaneados - p.minutosCalendario) / 60)} no calendário.`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.descricao}, ${alvoDaMeta(meta)}. ${legenda}: ${valor}.`}
      accessibilityHint="Abre a meta para a alterar"
      onPress={aoAbrir}
      style={({ pressed }) => ({ padding: 16, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fontes.textoForte, fontSize: 16, lineHeight: 22, color: cores.tinta }}>{`${meta.descricao} ${alvoDaMeta(meta)}`}</Text>
          <Text style={[estilos.pequeno, { marginTop: 2 }]}>{`Medida à semana: ${medidaSemanal(meta)}`}</Text>
        </View>
        <Icone nome="lapis" tamanho={16} cor={cores.texto3} />
      </View>
      <View style={{ marginTop: 12, marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text style={estilos.pequeno}>{legenda}</Text>
        <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, lineHeight: 18, color: cores.tinta, fontVariant: ['tabular-nums'] }}>{valor}</Text>
      </View>
      <BarraProgresso valor={proporcao} cor={cor} pista={cores.linhaSuave} />
      {nota ? <Text style={[estilos.pequeno, { marginTop: 8 }]}>{nota}</Text> : null}
    </Pressable>
  );
}
