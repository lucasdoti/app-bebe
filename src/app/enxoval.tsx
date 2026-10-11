import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, Share, Text, View } from 'react-native';

import { Folha } from '@/components/folha';
import { Aviso, Botao, Cabecalho, Campo, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import {
  CATEGORIAS,
  temTamanho,
  TAMANHOS,
  textoDoEnxoval,
  textoDoQueFalta,
  useEnxoval,
  type Categoria,
  type ItemEnxoval,
  type Tamanho,
} from '@/context/enxoval';
import { confirmar } from '@/lib/confirmar';
import { reais } from '@/lib/dinheiro';
import { linkSeguro, normalizarLink, siteDoLink } from '@/lib/links';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Aba = 'temos' | 'falta';
type Prioridade = ItemEnxoval['prioridade'];

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

const nomeCompleto = (i: { nome: string; tamanho: Tamanho | null }) => `${i.nome}${i.tamanho ? ` ${i.tamanho}` : ''}`;

export default function Enxoval() {
  const { bebeAtual } = useBebes();
  const { itens, faltam, gastos, reservas, cha, recarregar } = useEnxoval();
  const reservasDo = (item: ItemEnxoval) => reservas.filter((r) => r.item_id === item.id);
  const { aba: abaParam } = useLocalSearchParams<{ aba?: Aba }>();
  const { cores } = useTema();
  const [aba, setAba] = useState<Aba>(abaParam === 'falta' ? 'falta' : 'temos');
  const [categoria, setCategoria] = useState<Categoria>('roupa');
  const [nome, setNome] = useState('');
  const [tamanho, setTamanho] = useState<Tamanho | null>('RN');
  const [quantidade, setQuantidade] = useState(1);
  const [prioridade, setPrioridade] = useState<Prioridade>(null);
  const [link, setLink] = useState('');
  const [editandoLink, setEditandoLink] = useState<ItemEnxoval | null>(null);
  const [textoLink, setTextoLink] = useState('');
  const [conseguindo, setConseguindo] = useState<ItemEnxoval | null>(null);
  const [qtdConseguida, setQtdConseguida] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!bebeAtual) return null;
  const falta = aba === 'falta';
  const lista = falta ? faltam : itens;
  const ehRoupa = temTamanho(categoria);
  const total = lista.reduce((s, i) => s + i.quantidade, 0);
  const roupas = itens.filter((i) => i.categoria === 'roupa').reduce((s, i) => s + i.quantidade, 0);
  const especiais = itens.filter((i) => i.categoria === 'especial').reduce((s, i) => s + i.quantidade, 0);
  const gastoTotal = gastos.filter((g) => g.tipo === 'compra').reduce((s, g) => s + (g.valor ?? 0), 0);

  async function executar(acao: PromiseLike<{ error: { message: string } | null }>) {
    setErro(null);
    const { error } = await acao;
    if (error) setErro(mensagemDeErro(error));
    await recarregar();
    return !error;
  }

  const igualEm = (onde: ItemEnxoval[], c: Categoria, n: string, t: Tamanho | null) =>
    onde.find((i) => i.categoria === c && i.nome.toLowerCase() === n.toLowerCase() && i.tamanho === t);

  async function adicionar() {
    const n = nome.trim().replace(/\s+/g, ' ');
    if (!n) return setErro(falta ? 'O que está faltando? Escolha uma sugestão ou escreva.' : 'O que vocês têm? Escolha uma sugestão ou escreva.');
    const t = ehRoupa ? tamanho : null;
    const linkOk = falta ? normalizarLink(link) : null;
    if (falta && link.trim() && !linkOk) return setErro('Esse link não parece válido. Copie o endereço da página do produto.');
    // O mesmo item no mesmo tamanho soma na quantidade em vez de repetir a linha.
    const igual = igualEm(lista, categoria, n, t);
    await executar(
      igual
        ? supabase
            .from('enxoval_itens')
            .update({
              quantidade: igual.quantidade + quantidade,
              ...(falta && prioridade && { prioridade }),
              ...(linkOk && { link: linkOk }),
            })
            .eq('id', igual.id)
        : supabase.from('enxoval_itens').insert({
            bebe_id: bebeAtual!.id,
            categoria,
            nome: n,
            tamanho: t,
            quantidade,
            falta,
            prioridade: falta ? prioridade : null,
            link: linkOk,
          }),
    );
    setLink('');
    setAviso(`${quantidade} ${n}${t ? ` ${t}` : ''} ${igual ? 'somado à lista' : falta ? 'na lista do que falta' : 'adicionado'}.`);
    setNome('');
    setQuantidade(1);
  }

  function mudar(item: ItemEnxoval, delta: number) {
    const nova = item.quantidade + delta;
    if (nova <= 0) {
      confirmar(`Tirar ${nomeCompleto(item)} da lista?`, 'Tirar', () =>
        executar(supabase.from('enxoval_itens').delete().eq('id', item.id)),
      );
      return;
    }
    executar(supabase.from('enxoval_itens').update({ quantidade: nova }).eq('id', item.id));
  }

  // "Conseguimos": passa a quantidade para "já temos" (somando se o item já existe lá) e tira do que falta.
  async function conseguir(item: ItemEnxoval, n: number, depois: 'compra' | 'presente' | null) {
    const jaTem = igualEm(itens, item.categoria, item.nome, item.tamanho);
    const tudo = n >= item.quantidade;
    let ok = true;
    if (jaTem) {
      ok = await executar(supabase.from('enxoval_itens').update({ quantidade: jaTem.quantidade + n }).eq('id', jaTem.id));
      if (ok)
        ok = await executar(
          tudo
            ? supabase.from('enxoval_itens').delete().eq('id', item.id)
            : supabase.from('enxoval_itens').update({ quantidade: item.quantidade - n }).eq('id', item.id),
        );
    } else if (tudo) {
      ok = await executar(
        supabase.from('enxoval_itens').update({ falta: false, prioridade: null, quantidade: n }).eq('id', item.id),
      );
    } else {
      ok = await executar(
        supabase.from('enxoval_itens').insert({
          bebe_id: bebeAtual!.id,
          categoria: item.categoria,
          nome: item.nome,
          tamanho: item.tamanho,
          quantidade: n,
          falta: false,
        }),
      );
      if (ok) ok = await executar(supabase.from('enxoval_itens').update({ quantidade: item.quantidade - n }).eq('id', item.id));
    }
    setConseguindo(null);
    if (!ok) return;
    setAviso(`${n} ${nomeCompleto(item)} ${n === 1 ? 'foi' : 'foram'} para o enxoval.`);
    // Presente reservado no chá: o nome de quem reservou já vai preenchido.
    const quemReservou = [...new Set(reservasDo(item).map((r) => r.nome))].join(', ');
    if (depois)
      router.push({
        pathname: '/gasto/[id]',
        params: {
          id: 'novo',
          tipo: depois,
          descricao: `${n} ${nomeCompleto(item)}`,
          categoria: item.categoria,
          ...(depois === 'presente' && quemReservou && { quemDeu: quemReservou }),
        },
      });
  }

  const texto = falta ? textoDoQueFalta(bebeAtual.nome, faltam) : textoDoEnxoval(bebeAtual.nome, itens);

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

      <Escolha<Aba>
        rotulo="Lista"
        opcoes={[
          { valor: 'temos', titulo: `Já temos (${itens.reduce((s, i) => s + i.quantidade, 0)})` },
          { valor: 'falta', titulo: `Falta (${faltam.reduce((s, i) => s + i.quantidade, 0)})` },
        ]}
        valor={aba}
        onChange={(a) => {
          setAba(a);
          setAviso(null);
          setErro(null);
        }}
      />

      <Cartao>
        <Texto variante="subtitulo">
          {falta
            ? total
              ? `Faltam ${total} ${total === 1 ? 'item' : 'itens'}`
              : 'Nada faltando por enquanto'
            : `${total} ${total === 1 ? 'item' : 'itens'}${roupas ? ` · ${roupas} ${roupas === 1 ? 'roupa' : 'roupas'}` : ''}${
                especiais ? ` · ${especiais} ${especiais === 1 ? 'fantasia ou time' : 'fantasias e times'}` : ''
              }`}
        </Texto>
        <Texto variante="suave">
          {falta
            ? 'Quando conseguirem um item, toquem em "Conseguimos": ele vai para o enxoval e dá para lançar o gasto ou o presente.'
            : 'Os dois veem e editam a mesma lista.'}
        </Texto>
        {falta && (
          <Botao
            titulo={cha ? `Chá de bebê: ${reservas.length} ${reservas.length === 1 ? 'reserva' : 'reservas'}` : 'Criar lista do chá de bebê'}
            variante="secundario"
            onPress={() => router.push('/cha')}
            icone={<MaterialCommunityIcons name="gift-outline" size={20} color={cores.texto} />}
          />
        )}
        {!falta && (
          <Botao
            titulo={gastoTotal ? `Gastos: ${reais(gastoTotal)}` : 'Anotar gastos e presentes'}
            variante="secundario"
            onPress={() => router.push('/gastos')}
            icone={<MaterialCommunityIcons name="cash-multiple" size={20} color={cores.texto} />}
          />
        )}
        {total > 0 && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Botao
                titulo={falta ? 'Enviar o que falta' : 'WhatsApp'}
                onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(texto)}`)}
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
        <Texto variante="subtitulo">{falta ? 'O que está faltando' : 'Adicionar'}</Texto>
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
        {falta && (
          <Escolha<'essencial' | 'bom'>
            rotulo="Prioridade (opcional)"
            opcoes={[
              { valor: 'essencial', titulo: 'Essencial' },
              { valor: 'bom', titulo: 'Seria bom ter' },
            ]}
            valor={prioridade}
            onChange={setPrioridade}
            aoLimpar={() => setPrioridade(null)}
          />
        )}
        {falta && (
          <Campo
            rotulo="Link do produto (opcional)"
            value={link}
            onChangeText={setLink}
            placeholder="Cole aqui o endereço da loja"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            inputMode="url"
          />
        )}
        <Botao titulo={falta ? 'Pôr na lista do que falta' : 'Adicionar à lista'} onPress={adicionar} />
        <Aviso texto={erro} />
        <Aviso texto={aviso} tipo="info" />
      </Cartao>

      {CATEGORIAS.map((c) => {
        const daCategoria = lista
          .filter((i) => i.categoria === c.valor)
          .sort((a, b) => (falta ? Number(b.prioridade === 'essencial') - Number(a.prioridade === 'essencial') : 0));
        if (!daCategoria.length) return null;
        const grupos: (Tamanho | null)[] = c.valor === 'roupa' ? [...TAMANHOS, null] : [null];
        return (
          <Cartao key={c.valor}>
            <Texto variante="subtitulo">
              {c.titulo} · {daCategoria.reduce((s, i) => s + i.quantidade, 0)}
            </Texto>
            {grupos.map((t) => {
              const doGrupo = daCategoria.filter((i) => (c.valor === 'roupa' ? i.tamanho === t : true));
              if (!doGrupo.length) return null;
              return (
                <View key={t ?? 'sem'} style={{ gap: 4 }}>
                  {c.valor === 'roupa' && <Texto variante="rotulo">{t ? `Tamanho ${t}` : 'Sem tamanho'}</Texto>}
                  {doGrupo.map((i) => (
                    <View key={i.id} style={{ gap: 6, paddingVertical: falta ? 4 : 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: ALVO_TOQUE }}>
                        <View style={{ flex: 1 }}>
                          <Texto style={{ fontFamily: fontes.media }}>
                            {i.prioridade === 'essencial' ? '⭐ ' : ''}
                            {i.nome}
                            {c.valor !== 'roupa' && i.tamanho ? ` (${i.tamanho})` : ''}
                          </Texto>
                          {i.prioridade === 'bom' && <Texto variante="suave">seria bom ter</Texto>}
                          {falta && reservasDo(i).length > 0 && (
                            <Texto variante="suave">
                              🎁 reservado no chá por {reservasDo(i).map((r) => `${r.nome} (${r.quantidade})`).join(', ')}
                            </Texto>
                          )}
                        </View>
                        <BotaoQtd icone="minus" rotulo={`Um ${i.nome} a menos`} onPress={() => mudar(i, -1)} />
                        <Text
                          style={{ minWidth: 32, textAlign: 'center', fontFamily: fontes.extra, fontSize: 18, color: cores.texto }}>
                          {i.quantidade}
                        </Text>
                        <BotaoQtd icone="plus" rotulo={`Um ${i.nome} a mais`} onPress={() => mudar(i, 1)} />
                      </View>
                      {falta && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {linkSeguro(i.link) ? (
                            <Pressable
                              accessibilityRole="link"
                              accessibilityLabel={`Abrir o produto em ${siteDoLink(i.link)}`}
                              onPress={() => Linking.openURL(i.link!)}
                              style={({ pressed }) => ({
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                minHeight: 44,
                                opacity: pressed ? 0.7 : 1,
                              })}>
                              <MaterialCommunityIcons name="open-in-new" size={18} color={cores.texto} />
                              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontes.negrito, fontSize: 15, color: cores.texto, textDecorationLine: 'underline' }}>
                                Ver produto · {siteDoLink(i.link)}
                              </Text>
                            </Pressable>
                          ) : (
                            <View style={{ flex: 1 }} />
                          )}
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={i.link ? `Mudar o link de ${i.nome}` : `Pôr link em ${i.nome}`}
                            onPress={() => {
                              setTextoLink(i.link ?? '');
                              setEditandoLink(i);
                            }}
                            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 }}>
                            <MaterialCommunityIcons name="link-variant" size={18} color={cores.textoSuave} />
                            <Text style={{ fontFamily: fontes.media, fontSize: 14, color: cores.textoSuave }}>
                              {i.link ? 'Mudar link' : 'Pôr link'}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                      {falta && (
                        <Botao
                          titulo="Conseguimos"
                          variante="secundario"
                          icone={<MaterialCommunityIcons name="check" size={20} color={cores.texto} />}
                          onPress={() => {
                            setQtdConseguida(i.quantidade);
                            setConseguindo(i);
                          }}
                        />
                      )}
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
          {falta
            ? 'Anotem aqui o que ainda precisam. Dá para mandar a lista para quem perguntar.'
            : 'Comece pelas roupas: escolha o item, o tamanho e a quantidade.'}
        </Texto>
      )}

      <Folha
        aberta={!!editandoLink}
        titulo={editandoLink ? `Link: ${nomeCompleto(editandoLink)}` : ''}
        onFechar={() => setEditandoLink(null)}>
        {editandoLink && (
          <>
            <Campo
              rotulo="Link do produto"
              value={textoLink}
              onChangeText={setTextoLink}
              placeholder="Cole aqui o endereço da loja"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              inputMode="url"
            />
            <Aviso texto={erro} />
            <Botao
              titulo="Salvar link"
              onPress={async () => {
                const ok = normalizarLink(textoLink);
                if (textoLink.trim() && !ok) return setErro('Esse link não parece válido. Copie o endereço da página do produto.');
                if (await executar(supabase.from('enxoval_itens').update({ link: ok }).eq('id', editandoLink.id))) setEditandoLink(null);
              }}
            />
            {editandoLink.link && (
              <Botao
                titulo="Tirar o link"
                variante="texto"
                onPress={async () => {
                  if (await executar(supabase.from('enxoval_itens').update({ link: null }).eq('id', editandoLink.id))) setEditandoLink(null);
                }}
              />
            )}
          </>
        )}
      </Folha>

      <Folha aberta={!!conseguindo} titulo={conseguindo ? `Conseguimos: ${nomeCompleto(conseguindo)}` : ''} onFechar={() => setConseguindo(null)}>
        {conseguindo && (
          <>
            {conseguindo.quantidade > 1 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Texto variante="rotulo" style={{ flex: 1 }}>
                  Quantos? (faltavam {conseguindo.quantidade})
                </Texto>
                <BotaoQtd icone="minus" rotulo="Menos" onPress={() => setQtdConseguida(Math.max(1, qtdConseguida - 1))} />
                <Text style={{ minWidth: 36, textAlign: 'center', fontFamily: fontes.extra, fontSize: 22, color: cores.texto }}>
                  {qtdConseguida}
                </Text>
                <BotaoQtd
                  icone="plus"
                  rotulo="Mais"
                  onPress={() => setQtdConseguida(Math.min(conseguindo.quantidade, qtdConseguida + 1))}
                />
              </View>
            )}
            <Texto variante="suave">Vai para "Já temos". Querem lançar também?</Texto>
            <Botao titulo="Foi compra (lançar o valor)" onPress={() => conseguir(conseguindo, qtdConseguida, 'compra')} />
            <Botao
              titulo="Foi presente (anotar quem deu)"
              variante="secundario"
              onPress={() => conseguir(conseguindo, qtdConseguida, 'presente')}
            />
            <Botao titulo="Só passar para o enxoval" variante="texto" onPress={() => conseguir(conseguindo, qtdConseguida, null)} />
          </>
        )}
      </Folha>
    </Tela>
  );
}
