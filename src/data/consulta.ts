import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';

export type Tabela = 'areas' | 'metas' | 'tarefas' | 'tarefas_semana' | 'blocos' | 'revisoes' | 'definicoes';

const pedidos = new Set<() => void>();

/**
 * Faz todos os ecrãs lerem os dados outra vez, já. Normalmente não é preciso (a base de dados avisa
 * sozinha quando muda), mas esse aviso chega uns instantes depois; depois de largar um bloco no
 * calendário quer-se o bloco no sítio novo no mesmo instante.
 */
export function recarregarConsultas() {
  pedidos.forEach((pedido) => pedido());
}

/**
 * Lê dados da base e volta a ler quando alguma das tabelas indicadas muda.
 *
 * O `useLiveQuery` do Drizzle só observa a tabela principal da consulta; os ecrãs da semana juntam
 * várias (tarefas, instâncias, blocos), por isso observam-se aqui todas. A leitura é síncrona,
 * logo os dados já vêm no primeiro render, sem um estado vazio a piscar.
 *
 * @param chave muda quando os parâmetros da consulta mudam (ex.: a semana), para ler de novo.
 */
export function useConsulta<T>(carregar: () => T, tabelas: readonly Tabela[], chave: string | number = ''): T {
  const [estado, setEstado] = useState(() => ({ chave, dados: carregar() }));
  const carregarAtual = useRef(carregar);
  useEffect(() => {
    carregarAtual.current = carregar;
  });

  let dados = estado.dados;
  if (estado.chave !== chave) {
    // Os parâmetros mudaram: lê já, para este render não mostrar os dados antigos.
    dados = carregar();
    setEstado({ chave, dados });
  }

  const nomes = tabelas.join(',');
  useEffect(() => {
    const observadas = new Set(nomes.split(','));
    let pendente: ReturnType<typeof setTimeout> | null = null;
    const ler = () => setEstado({ chave, dados: carregarAtual.current() });
    // Uma escrita de várias linhas dispara um aviso por linha: junta-os numa só leitura.
    const ouvinte = addDatabaseChangeListener((alteracao) => {
      if (pendente || !observadas.has(alteracao.tableName)) return;
      pendente = setTimeout(() => {
        pendente = null;
        ler();
      }, 0);
    });
    pedidos.add(ler);
    return () => {
      if (pendente) clearTimeout(pendente);
      ouvinte.remove();
      pedidos.delete(ler);
    };
  }, [nomes, chave]);

  return dados;
}
