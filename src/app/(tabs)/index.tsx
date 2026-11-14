import { and, count, eq, sum } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icone, type NomeIcone } from '@/components/Icone';
import { Botao, Seccao, Titulo, estilos } from '@/components/ui';
import { consultaAreasAtivas, criarArea } from '@/data/areas';
import { db } from '@/db/client';
import { tarefas, tarefasSemana } from '@/db/schema';
import { MAX_AREAS, formatarHoras, podeCriarArea } from '@/domain/regras';
import { descreverSemana, inicioDaSemana } from '@/domain/semana';
import { cores, corDaArea, fontes } from '@/theme';

const SUGESTOES: { nome: string; cor: string; icone: NomeIcone }[] = [
  { nome: 'Espiritual', cor: 'violeta', icone: 'folha' },
  { nome: 'Família', cor: 'laranja', icone: 'casa' },
  { nome: 'Trabalho', cor: 'azul', icone: 'pasta' },
  { nome: 'Saúde', cor: 'rosa', icone: 'coracao' },
  { nome: 'Desporto', cor: 'verde', icone: 'bola' },
  { nome: 'Finanças', cor: 'petroleo', icone: 'livro' },
];

export default function AreasEcra() {
  const router = useRouter();
  const semana = useMemo(() => inicioDaSemana(new Date()), []);
  const { data: lista } = useLiveQuery(consultaAreasAtivas());
  const { data: resumo } = useLiveQuery(
    db
      .select({ areaId: tarefas.areaId, n: count(), minutos: sum(tarefas.duracaoMin) })
      .from(tarefasSemana)
      .innerJoin(tarefas, eq(tarefasSemana.tarefaId, tarefas.id))
      .where(and(eq(tarefasSemana.semana, semana)))
      .groupBy(tarefas.areaId),
    [semana],
  );
  const [aCriar, setACriar] = useState<string | null>(null);

  const porArea = new Map(resumo.map((r) => [r.areaId, r]));
  const podeCriar = podeCriarArea(lista.length);

  async function criarSugestao(s: (typeof SUGESTOES)[number]) {
    setACriar(s.nome);
    try {
      await criarArea({ ...s, missao: '' });
    } catch (e) {
      Alert.alert('Não foi possível criar a área', (e as Error).message);
    } finally {
      setACriar(null);
    }
  }

  return (
    <SafeAreaView style={estilos.ecra} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Titulo subtitulo={`Semana de ${descreverSemana(semana)}`}>As minhas áreas</Titulo>

        <Seccao titulo="Áreas" direita={<Text style={estilos.pequeno}>{`${lista.length} de ${MAX_AREAS} no máximo`}</Text>}>
          <View style={{ gap: 10 }}>
            {lista.map((area) => {
              const cor = corDaArea(area.cor);
              const r = porArea.get(area.id);
              const n = r?.n ?? 0;
              const horas = Number(r?.minutos ?? 0) / 60;
              return (
                <Link key={area.id} href={{ pathname: '/area/[id]', params: { id: String(area.id) } }} asChild>
                  <Pressable
                    accessibilityRole="link"
                    style={({ pressed }) => [
                      estilos.cartao,
                      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: cor.tinta, alignItems: 'center', justifyContent: 'center' }}>
                      <Icone nome={area.icone as NomeIcone} cor={cor.texto} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: fontes.textoForte, fontSize: 17, lineHeight: 22, color: cores.tinta }}>{area.nome}</Text>
                      <Text style={{ fontFamily: fontes.texto, fontSize: 14, lineHeight: 20, color: area.missao ? cores.texto2 : cores.texto3, marginTop: 2 }} numberOfLines={2}>
                        {area.missao || 'Sem missão — toque para definir'}
                      </Text>
                      <Text style={[estilos.pequeno, { marginTop: 6 }]}>
                        {n === 0 ? 'Sem tarefas esta semana' : `${n} ${n === 1 ? 'tarefa' : 'tarefas'} · ${formatarHoras(horas)} esta semana`}
                      </Text>
                    </View>
                    <Icone nome="seta-direita" tamanho={16} cor={cores.texto3} espessura={2} />
                  </Pressable>
                </Link>
              );
            })}
          </View>

          {lista.length === 0 ? (
            <View style={{ gap: 12, marginTop: 4 }}>
              <Text style={estilos.corpo}>Comece por escolher as áreas da sua vida. Pode mudar tudo depois.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SUGESTOES.map((s) => {
                  const cor = corDaArea(s.cor);
                  return (
                    <Pressable
                      key={s.nome}
                      accessibilityRole="button"
                      accessibilityLabel={`Criar área ${s.nome}`}
                      disabled={aCriar !== null}
                      onPress={() => criarSugestao(s)}
                      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: cor.tinta }}
                    >
                      <Icone nome={s.icone} tamanho={16} cor={cor.texto} />
                      <Text style={{ fontFamily: fontes.textoForte, fontSize: 14, color: cor.texto }}>{s.nome}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Botao
            titulo="Nova área"
            icone="mais"
            variante="tracejado"
            disabled={!podeCriar}
            onPress={() => router.push('/area/nova')}
            accessibilityHint={podeCriar ? undefined : `Já tem ${MAX_AREAS} áreas. Arquive uma para criar outra.`}
            style={{ marginTop: 2 }}
          />
        </Seccao>
      </ScrollView>
    </SafeAreaView>
  );
}
