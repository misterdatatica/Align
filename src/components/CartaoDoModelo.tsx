import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icone } from '@/components/Icone';
import { descreverTarefaDoModelo, resumirModelo, type Modelo } from '@/domain/modelos';
import { formatarHoras } from '@/domain/regras';
import { t } from '@/i18n';
import { fontes, useTema } from '@/theme';

/**
 * Um modelo: o nome, para quem é, as suas áreas e quanto tempo pede por semana. Com `aoEscolher`, o
 * cartão escolhe-se tocando-lhe (no primeiro arranque); sem ele, `children` junta o que se faz com o
 * modelo (no ecrã dos modelos).
 */
export function CartaoDoModelo({ modelo, escolhido = false, aoEscolher, children }: { modelo: Modelo; escolhido?: boolean; aoEscolher?: () => void; children?: ReactNode }) {
  const { cores, estilos, corDaArea } = useTema();
  const resumo = resumirModelo(modelo);
  const conteudo = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: fontes.textoForte, fontSize: 17, lineHeight: 22, color: cores.tinta }}>{modelo.nome}</Text>
          <Text style={{ fontFamily: fontes.texto, fontSize: 14, lineHeight: 20, color: cores.texto2 }}>{modelo.descricao}</Text>
        </View>
        {escolhido ? (
          <View style={{ width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.tinta }}>
            <Icone nome="certo" tamanho={14} cor={cores.sobreTinta} espessura={2.6} />
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {modelo.areas.map((a) => {
          const cor = corDaArea(a.cor);
          return (
            <View key={a.nome} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: cor.tinta }}>
              <Icone nome={a.icone} tamanho={14} cor={cor.texto} />
              <Text style={{ fontFamily: fontes.textoForte, fontSize: 13, lineHeight: 18, color: cor.texto }}>{a.nome}</Text>
            </View>
          );
        })}
      </View>
      <Text style={estilos.pequeno}>
        {t('{areas} áreas · {tarefas} tarefas · {horas} por semana', { areas: resumo.areas, tarefas: resumo.tarefas, horas: formatarHoras(resumo.minutosPorSemana / 60) })}
      </Text>
      {children}
    </>
  );
  // A borda tem sempre 2 px, para o cartão não mudar de tamanho ao ser escolhido.
  const estilo = [estilos.cartao, { padding: 16, gap: 12, borderWidth: 2, borderColor: escolhido ? cores.tinta : cores.linha }];
  if (!aoEscolher) return <View style={estilo}>{conteudo}</View>;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${modelo.nome}. ${modelo.descricao}`}
      accessibilityState={{ selected: escolhido }}
      onPress={aoEscolher}
      style={({ pressed }) => [...estilo, { opacity: pressed ? 0.8 : 1 }]}
    >
      {conteudo}
    </Pressable>
  );
}

/** As áreas do modelo, com a missão e as tarefas, e quando se fazem. */
export function TarefasDoModelo({ modelo }: { modelo: Modelo }) {
  const { cores, estilos, corDaArea } = useTema();
  return (
    <View style={{ gap: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: cores.linhaSuave }}>
      {modelo.areas.map((a) => (
        <View key={a.nome} style={{ gap: 6, paddingTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: corDaArea(a.cor).forte }} />
            <Text style={{ fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 20, color: cores.tinta }}>{a.nome}</Text>
          </View>
          <Text style={[estilos.pequeno, { color: cores.texto2 }]}>{a.missao}</Text>
          {a.tarefas.map((tm) => (
            <View key={tm.nome} style={{ paddingLeft: 18, gap: 1 }}>
              <Text style={{ fontFamily: fontes.textoMedio, fontSize: 14, lineHeight: 20, color: cores.tinta }}>{tm.nome}</Text>
              <Text style={[estilos.pequeno, { fontSize: 12, lineHeight: 16 }]}>{descreverTarefaDoModelo(tm)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
