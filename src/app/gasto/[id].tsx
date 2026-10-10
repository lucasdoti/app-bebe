import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Aviso, Botao, Cabecalho, Campo, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { CATEGORIAS, useEnxoval, type Categoria, type Gasto } from '@/context/enxoval';
import { confirmar } from '@/lib/confirmar';
import { mascaraDinheiro, nomeForma, paraNumero, paraTextoDinheiro, reais, type FormaPagamento } from '@/lib/dinheiro';
import { deISO, hojeISO, mascaraData, paraISO } from '@/lib/idade';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const PARCELAS = [1, 2, 3, 4, 5, 6, 10, 12];

function Chips<T extends string | number>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: { valor: T; titulo: string }[];
  valor: T | null;
  onChange: (v: T | null) => void;
}) {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable
            key={String(o.valor)}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativo }}
            onPress={() => onChange(ativo ? null : o.valor)}
            style={{
              minHeight: 48,
              paddingHorizontal: 16,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: ativo ? cores.primaria : cores.borda,
              backgroundColor: ativo ? cores.primaria : cores.cartao,
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: fontes.negrito, fontSize: 15, color: ativo ? cores.textoNaPrimaria : cores.texto }}>
              {o.titulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/gastos');
}

// /gasto/novo?tipo=compra|presente lança; /gasto/<id> edita ou apaga.
export default function GastoForm() {
  // descricao e categoria chegam preenchidas quando vêm do "Conseguimos" da lista do que falta.
  const {
    id,
    tipo: tipoParam,
    descricao: descricaoParam,
    categoria: categoriaParam,
  } = useLocalSearchParams<{ id: string; tipo?: Gasto['tipo']; descricao?: string; categoria?: Categoria }>();
  const { bebeAtual } = useBebes();
  const { gastos, recarregar } = useEnxoval();
  const existente = id === 'novo' ? null : (gastos.find((g) => g.id === id) ?? null);

  const [tipo, setTipo] = useState<Gasto['tipo']>(existente?.tipo ?? tipoParam ?? 'compra');
  const [descricao, setDescricao] = useState(existente?.descricao ?? descricaoParam ?? '');
  const [valor, setValor] = useState(paraTextoDinheiro(existente?.valor ?? null));
  const [data, setData] = useState(deISO(existente?.data ?? hojeISO()));
  const [categoria, setCategoria] = useState<Categoria | null>(existente?.categoria ?? categoriaParam ?? null);
  const [forma, setForma] = useState<FormaPagamento | null>(existente?.forma_pagamento ?? 'pix');
  const [parcelas, setParcelas] = useState<number>(existente?.parcelas ?? 1);
  const [quemDeu, setQuemDeu] = useState(existente?.quem_deu ?? '');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const compra = tipo === 'compra';
  const v = paraNumero(valor);

  async function salvar() {
    setErro(null);
    if (!bebeAtual) return;
    const dataISO = paraISO(data);
    if (!descricao.trim()) return setErro(compra ? 'Onde comprou ou o que foi? Ex.: Loja X – bodies.' : 'O que vocês ganharam?');
    if (compra && !(v && v > 0)) return setErro('Qual o valor total da compra?');
    if (v !== null && v > 1_000_000) return setErro('Valor alto demais. Confira os números.');
    if (!dataISO) return setErro('Data no formato DD/MM/AAAA.');
    if (!compra && !quemDeu.trim()) return setErro('Quem deu o presente?');
    if (compra && !forma) return setErro('Escolha a forma de pagamento.');

    const dados = {
      tipo,
      descricao: descricao.trim(),
      valor: v,
      data: dataISO,
      categoria,
      forma_pagamento: compra ? forma : null,
      parcelas: compra && forma === 'credito' ? parcelas : null,
      quem_deu: compra ? null : quemDeu.trim(),
    };
    setCarregando(true);
    const { error } = existente
      ? await supabase.from('enxoval_gastos').update(dados).eq('id', existente.id)
      : await supabase.from('enxoval_gastos').insert({ ...dados, bebe_id: bebeAtual.id });
    setCarregando(false);
    if (error) return setErro(mensagemDeErro(error));
    await recarregar();
    voltar();
  }

  function apagar() {
    if (!existente) return;
    confirmar(`Apagar "${existente.descricao}"?`, 'Apagar', async () => {
      const { error } = await supabase.from('enxoval_gastos').delete().eq('id', existente.id);
      if (error) return setErro(mensagemDeErro(error));
      await recarregar();
      voltar();
    });
  }

  return (
    <Tela>
      <Cabecalho titulo={existente ? existente.descricao : compra ? 'Nova compra' : 'Novo presente'} />

      {!existente && (
        <Escolha<Gasto['tipo']>
          rotulo="Tipo"
          opcoes={[
            { valor: 'compra', titulo: 'Compra' },
            { valor: 'presente', titulo: 'Presente' },
          ]}
          valor={tipo}
          onChange={setTipo}
        />
      )}

      {compra ? (
        <Campo
          rotulo="Valor total (R$)"
          value={valor}
          onChangeText={(t) => setValor(mascaraDinheiro(t))}
          placeholder="0,00"
          keyboardType="number-pad"
          inputMode="numeric"
          style={{ fontSize: 24 }}
        />
      ) : (
        <Campo rotulo="Quem deu" value={quemDeu} onChangeText={setQuemDeu} placeholder="Ex.: Vó Maria" autoCapitalize="words" />
      )}

      <Campo
        rotulo={compra ? 'Onde ou o quê' : 'O que ganharam'}
        value={descricao}
        onChangeText={setDescricao}
        placeholder={compra ? 'Ex.: Loja X – bodies e meias' : 'Ex.: Carrinho e bebê-conforto'}
      />

      <Campo
        rotulo="Data"
        value={data}
        onChangeText={(t) => setData(mascaraData(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
      />

      {compra && (
        <>
          <Texto variante="rotulo">Forma de pagamento</Texto>
          <Chips<FormaPagamento>
            opcoes={(Object.keys(nomeForma) as FormaPagamento[]).map((f) => ({ valor: f, titulo: nomeForma[f] }))}
            valor={forma}
            onChange={setForma}
          />
          {forma === 'credito' && (
            <>
              <Texto variante="rotulo">Parcelas</Texto>
              <Chips<number>
                opcoes={PARCELAS.map((p) => ({ valor: p, titulo: p === 1 ? 'À vista' : `${p}x` }))}
                valor={parcelas}
                onChange={(p) => setParcelas(p ?? 1)}
              />
              {v && parcelas > 1 ? (
                <Texto variante="suave">
                  {parcelas}x de {reais(v / parcelas)}
                </Texto>
              ) : null}
            </>
          )}
        </>
      )}

      {!compra && (
        <Campo
          rotulo="Valor aproximado (opcional, não entra no total)"
          value={valor}
          onChangeText={(t) => setValor(mascaraDinheiro(t))}
          placeholder="0,00"
          keyboardType="number-pad"
          inputMode="numeric"
        />
      )}

      <Texto variante="rotulo">Categoria (opcional)</Texto>
      <Chips<Categoria> opcoes={CATEGORIAS.map((c) => ({ valor: c.valor, titulo: c.titulo }))} valor={categoria} onChange={setCategoria} />

      <Aviso texto={erro} />
      <Botao titulo="Salvar" onPress={salvar} carregando={carregando} />
      {existente && <Botao titulo="Apagar" variante="texto" onPress={apagar} />}
    </Tela>
  );
}
