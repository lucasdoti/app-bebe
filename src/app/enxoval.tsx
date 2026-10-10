import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Linking, Platform, Pressable, Share, Text, View } from 'react-native';

import { Aviso, Botao, Cabecalho, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import {
  CATEGORIAS,
  TAMANHOS,
  textoDoEnxoval,
  useEnxoval,
  type Categoria,
  type ItemEnxoval,
  type Tamanho,
} from '@/context/enxoval';
import { confirmar } from '@/lib/confirmar';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

// Botões em várias linhas (as categorias não cabem lado a lado).
function Chips<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: { valor: T; titulo: string }[];
  valor: T | null;
  onChange: (v: T) => void;
}) {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativo }}
            onPress={() => onChange(o.valor)}
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

function BotaoQtd({ icone, rotulo, onPress }: { icone: 'minus' | 'plus'; rotulo: string; onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={onPress}
      style={({ pressed }) => ({
        width: ALVO_TOQUE,
        height: ALVO_TOQUE,
        borderRadius: ALVO_TOQUE / 2,
        borderWidth: 1.5,
        borderColor: cores.borda,
        backgroundColor: cores.cartao,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}>
      <MaterialCommunityIcons name={icone} size={22} color={cores.texto} />
    </Pressable>
  );
}

export default function Enxoval() {
  const { bebeAtual } = useBebes();
  const { itens, recarregar } = useEnxoval();
  const { cores } = useTema();
  const [categoria, setCategoria] = useState<Categoria>('roupa');
  const [nome, setNome] = useState('');
  const [tamanho, setTamanho] = useState<Tamanho | null>('RN');
  const [quantidade, setQuantidade] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!bebeAtual) return null;
  const ehRoupa = categoria === 'roupa';
  const total = itens.reduce((s, i) => s + i.quantidade, 0);
  const roupas = itens.filter((i) => i.categoria === 'roupa').reduce((s, i) => s + i.quantidade, 0);

  async function executar(acao: PromiseLike<{ error: { message: string } | null }>) {
    setErro(null);
    const { error } = await acao;
    if (error) setErro(mensagemDeErro(error));
    await recarregar();
  }

  async function adicionar() {
    const n = nome.trim().replace(/\s+/g, ' ');
    if (!n) return setErro('O que vocês têm? Escolha uma sugestão ou escreva.');
    const t = ehRoupa ? tamanho : null;
    // O mesmo item no mesmo tamanho soma na quantidade em vez de repetir a linha.
    const igual = itens.find(
      (i) => i.categoria === categoria && i.nome.toLowerCase() === n.toLowerCase() && i.tamanho === t,
    );
    await executar(
      igual
        ? supabase.from('enxoval_itens').update({ quantidade: igual.quantidade + quantidade }).eq('id', igual.id)
        : supabase
            .from('enxoval_itens')
            .insert({ bebe_id: bebeAtual!.id, categoria, nome: n, tamanho: t, quantidade }),
    );
    setAviso(`${quantidade} ${n}${t ? ` ${t}` : ''} ${igual ? 'somado à lista' : 'adicionado'}.`);
    setNome('');
    setQuantidade(1);
  }

  function mudar(item: ItemEnxoval, delta: number) {
    const nova = item.quantidade + delta;
    if (nova <= 0) {
      confirmar(`Tirar ${item.nome}${item.tamanho ? ` ${item.tamanho}` : ''} da lista?`, 'Tirar', () =>
        executar(supabase.from('enxoval_itens').delete().eq('id', item.id)),
      );
      return;
    }
    executar(supabase.from('enxoval_itens').update({ quantidade: nova }).eq('id', item.id));
  }

  const texto = textoDoEnxoval(bebeAtual.nome, itens);

  async function enviarWhatsApp() {
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(texto)}`);
  }

  async function compartilhar() {
    try {
      if (Platform.OS === 'web' && !navigator.share) {
        await navigator.clipboard.writeText(texto);
        setAviso('Lista copiada. É só colar onde quiser.');
        return;
      }
      await Share.share({ message: texto });
    } catch {
      // Compartilhamento cancelado.
    }
  }

  const sugestoes = CATEGORIAS.find((c) => c.valor === categoria)!.sugestoes;

  return (
    <Tela>
      <Cabecalho titulo={`Enxoval de ${bebeAtual.nome}`} />

      <Cartao>
        <Texto variante="subtitulo">
          {total} {total === 1 ? 'item' : 'itens'}
          {roupas ? ` · ${roupas} ${roupas === 1 ? 'roupa' : 'roupas'}` : ''}
        </Texto>
        <Texto variante="suave">Os dois veem e editam a mesma lista.</Texto>
        {total > 0 && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Botao
                titulo="WhatsApp"
                onPress={enviarWhatsApp}
                icone={<MaterialCommunityIcons name="whatsapp" size={20} color={cores.textoNaPrimaria} />}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Botao titulo="Compartilhar" variante="secundario" onPress={compartilhar} />
            </View>
          </View>
        )}
      </Cartao>

      <Cartao>
        <Texto variante="subtitulo">Adicionar</Texto>
        <Chips
          opcoes={CATEGORIAS.map((c) => ({ valor: c.valor, titulo: c.titulo }))}
          valor={categoria}
          onChange={(c) => {
            setCategoria(c);
            setNome('');
          }}
        />
        <Texto variante="rotulo">Sugestões</Texto>
        <Chips opcoes={sugestoes.map((s) => ({ valor: s, titulo: s }))} valor={nome} onChange={setNome} />
        <Campo rotulo="Item" value={nome} onChangeText={setNome} placeholder="Ou escreva aqui" />
        {ehRoupa && (
          <>
            <Texto variante="rotulo">Tamanho</Texto>
            <Chips opcoes={TAMANHOS.map((t) => ({ valor: t, titulo: t }))} valor={tamanho} onChange={setTamanho} />
          </>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Texto variante="rotulo" style={{ flex: 1 }}>
            Quantidade
          </Texto>
          <BotaoQtd icone="minus" rotulo="Diminuir" onPress={() => setQuantidade(Math.max(1, quantidade - 1))} />
          <Text style={{ minWidth: 36, textAlign: 'center', fontFamily: fontes.extra, fontSize: 22, color: cores.texto }}>
            {quantidade}
          </Text>
          <BotaoQtd icone="plus" rotulo="Aumentar" onPress={() => setQuantidade(quantidade + 1)} />
        </View>
        <Botao titulo="Adicionar à lista" onPress={adicionar} />
        <Aviso texto={erro} />
        <Aviso texto={aviso} tipo="info" />
      </Cartao>

      {CATEGORIAS.map((c) => {
        const daCategoria = itens.filter((i) => i.categoria === c.valor);
        if (!daCategoria.length) return null;
        const grupos: (Tamanho | null)[] = c.valor === 'roupa' ? [...TAMANHOS, null] : [null];
        return (
          <Cartao key={c.valor}>
            <Texto variante="subtitulo">
              {c.titulo} · {daCategoria.reduce((s, i) => s + i.quantidade, 0)}
            </Texto>
            {grupos.map((t) => {
              const lista = daCategoria.filter((i) => (c.valor === 'roupa' ? i.tamanho === t : true));
              if (!lista.length) return null;
              return (
                <View key={t ?? 'sem'} style={{ gap: 4 }}>
                  {c.valor === 'roupa' && (
                    <Texto variante="rotulo">{t ? `Tamanho ${t}` : 'Sem tamanho'}</Texto>
                  )}
                  {lista.map((i) => (
                    <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: ALVO_TOQUE }}>
                      <Texto style={{ flex: 1, fontFamily: fontes.media }}>{i.nome}</Texto>
                      <BotaoQtd icone="minus" rotulo={`Um ${i.nome} a menos`} onPress={() => mudar(i, -1)} />
                      <Text
                        style={{ minWidth: 32, textAlign: 'center', fontFamily: fontes.extra, fontSize: 18, color: cores.texto }}>
                        {i.quantidade}
                      </Text>
                      <BotaoQtd icone="plus" rotulo={`Um ${i.nome} a mais`} onPress={() => mudar(i, 1)} />
                    </View>
                  ))}
                </View>
              );
            })}
          </Cartao>
        );
      })}

      {total === 0 && (
        <Texto variante="suave" style={{ textAlign: 'center' }}>
          Comece pelas roupas: escolha o item, o tamanho e a quantidade.
        </Texto>
      )}
    </Tela>
  );
}
