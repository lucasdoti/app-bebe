import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, Text, View } from 'react-native';

import { Aviso, Botao, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { CATEGORIAS } from '@/context/enxoval';
import { NOME_APP } from '@/lib/app';
import { linkSeguro, siteDoLink } from '@/lib/links';
import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { horaCurta } from '@/lib/tempo';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type ItemPublico = {
  id: string;
  categoria: string;
  nome: string;
  tamanho: string | null;
  prioridade: 'essencial' | 'bom' | null;
  quantidade: number;
  reservados: number;
  link: string | null;
};
type ChaPublico = {
  nome: string;
  data_evento: string | null;
  local: string | null;
  mensagem: string | null;
  pix: string | null;
  itens: ItemPublico[];
};
type MinhaReserva = { id: string; codigo: string; itemNome: string; quantidade: number };

const nomeCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.titulo])) as Record<string, string>;

function BotaoQtd({ icone, onPress }: { icone: 'minus' | 'plus'; onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icone === 'minus' ? 'Menos' : 'Mais'}
      onPress={onPress}
      style={{
        width: ALVO_TOQUE,
        height: ALVO_TOQUE,
        borderRadius: ALVO_TOQUE / 2,
        borderWidth: 1.5,
        borderColor: cores.borda,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <MaterialCommunityIcons name={icone} size={22} color={cores.texto} />
    </Pressable>
  );
}

function erroLegivel(e: unknown) {
  const msg = (e as { message?: string })?.message ?? '';
  return /fetch|network/i.test(msg) ? 'Sem conexão com a internet. Tente de novo.' : msg || 'Não deu certo. Tente de novo.';
}

// Página do convidado (sem login): a lista do que falta, com reserva para ninguém repetir o presente.
export default function ChaPublicoPagina() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { cores } = useTema();
  const chaveMinhas = `cha_minhas:${token}`;
  const [cha, setCha] = useState<ChaPublico | null | undefined>(undefined);
  const [escolhido, setEscolhido] = useState<ItemPublico | null>(null);
  const [nome, setNome] = useState(() => lerPref('cha_nome') ?? '');
  const [quantidade, setQuantidade] = useState(1);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [obrigado, setObrigado] = useState<string | null>(null);
  const [minhas, setMinhas] = useState<MinhaReserva[]>(() => {
    try {
      return JSON.parse(lerPref(chaveMinhas) ?? '[]');
    } catch {
      return [];
    }
  });

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('cha_publico', { p_token: token });
    if (error) {
      setCha((atual) => (atual === undefined ? null : atual));
      return;
    }
    setCha(data as ChaPublico | null);
  }, [token]);

  // Recarrega de tempos em tempos para mostrar o que outros convidados reservaram.
  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 30_000);
    return () => clearInterval(id);
  }, [carregar]);

  function guardarMinhas(lista: MinhaReserva[]) {
    setMinhas(lista);
    salvarPref(chaveMinhas, JSON.stringify(lista));
  }

  async function reservar() {
    if (!escolhido) return;
    setErro(null);
    if (!nome.trim()) return setErro('Escreva seu nome para os pais saberem quem vai dar.');
    setEnviando(true);
    const { data, error } = await supabase.rpc('cha_reservar', {
      p_token: token,
      p_item: escolhido.id,
      p_nome: nome.trim(),
      p_quantidade: quantidade,
      p_mensagem: mensagem.trim() || null,
    });
    setEnviando(false);
    if (error) {
      setErro(erroLegivel(error));
      await carregar();
      return;
    }
    salvarPref('cha_nome', nome.trim());
    const r = data as { id: string; codigo: string };
    guardarMinhas([...minhas, { id: r.id, codigo: r.codigo, itemNome: escolhido.nome, quantidade }]);
    setObrigado(`Obrigado, ${nome.trim().split(' ')[0]}! ${quantidade} ${escolhido.nome} ficou reservado no seu nome.`);
    setEscolhido(null);
    setMensagem('');
    await carregar();
  }

  async function desfazer(r: MinhaReserva) {
    const { error } = await supabase.rpc('cha_desfazer', { p_token: token, p_reserva: r.id, p_codigo: r.codigo });
    if (error) return setErro(erroLegivel(error));
    // Se os pais já tinham cancelado, a reserva também sai da lista do convidado.
    guardarMinhas(minhas.filter((m) => m.id !== r.id));
    setObrigado(`Reserva de ${r.itemNome} desfeita.`);
    await carregar();
  }

  async function copiarPix(chave: string) {
    if (Platform.OS === 'web' && navigator.clipboard) {
      await navigator.clipboard.writeText(chave);
      setObrigado('Chave Pix copiada.');
    }
  }

  if (cha === undefined) {
    return (
      <Tela centralizar>
        <ActivityIndicator color={cores.texto} />
      </Tela>
    );
  }

  if (cha === null) {
    return (
      <Tela centralizar>
        <Image source={require('@/assets/images/logo.png')} style={{ width: 96, height: 96, alignSelf: 'center' }} />
        <Texto variante="subtitulo" style={{ textAlign: 'center' }}>
          Este link não está mais ativo
        </Texto>
        <Texto variante="suave" style={{ textAlign: 'center' }}>
          Peça um link novo para quem te convidou.
        </Texto>
      </Tela>
    );
  }

  const ordenados = [...cha.itens].sort(
    (a, b) => Number(a.reservados >= a.quantidade) - Number(b.reservados >= b.quantidade),
  );
  const livres = cha.itens.filter((i) => i.reservados < i.quantidade).length;

  return (
    <Tela>
      <View style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
        <Image source={require('@/assets/images/logo.png')} style={{ width: 88, height: 88 }} accessibilityLabel={NOME_APP} />
        <Texto variante="rotulo">Chá de bebê</Texto>
        <Texto variante="titulo" style={{ textAlign: 'center' }}>
          {cha.nome}
        </Texto>
        {cha.data_evento && (
          <Texto style={{ textAlign: 'center' }}>
            {new Date(cha.data_evento).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às{' '}
            {horaCurta(cha.data_evento)}
          </Texto>
        )}
        {cha.local && (
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cha.local!)}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
            <MaterialCommunityIcons name="map-marker" size={18} color={cores.textoSuave} />
            <Texto variante="suave" style={{ textDecorationLine: 'underline' }}>
              {cha.local}
            </Texto>
          </Pressable>
        )}
      </View>

      {cha.mensagem && (
        <Cartao>
          <Texto style={{ textAlign: 'center' }}>{cha.mensagem}</Texto>
        </Cartao>
      )}

      <Aviso texto={obrigado} tipo="info" />

      {minhas.length > 0 && (
        <Cartao style={{ backgroundColor: cores.medidas, borderColor: cores.medidas }}>
          <Text style={{ fontFamily: fontes.extra, fontSize: 17, color: cores.textoNaPrimaria }}>Seus presentes reservados</Text>
          {minhas.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontFamily: fontes.media, fontSize: 16, color: cores.textoNaPrimaria }}>
                {r.quantidade} {r.itemNome}
              </Text>
              <Botao titulo="Desfazer" variante="texto" onPress={() => desfazer(r)} />
            </View>
          ))}
        </Cartao>
      )}

      <Texto variante="subtitulo">
        {livres ? `O que ainda falta (${livres})` : 'Tudo já foi reservado. Obrigado! 💛'}
      </Texto>
      <Texto variante="suave">Escolha um item e toque em "Vou dar este" para ninguém repetir o presente.</Texto>

      {ordenados.map((i) => {
        const restante = i.quantidade - i.reservados;
        const esgotado = restante <= 0;
        const aberto = escolhido?.id === i.id;
        return (
          <Cartao key={i.id} style={esgotado ? { opacity: 0.6 } : undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Texto style={{ fontFamily: fontes.extra, fontSize: 18 }}>
                  {i.prioridade === 'essencial' ? '⭐ ' : ''}
                  {i.nome}
                  {i.tamanho ? ` (${i.tamanho})` : ''}
                </Texto>
                <Texto variante="suave">
                  {nomeCategoria[i.categoria] ?? 'Outros'} ·{' '}
                  {esgotado
                    ? 'já reservado ✓'
                    : i.quantidade > 1
                      ? `faltam ${restante} de ${i.quantidade}`
                      : i.prioridade === 'essencial'
                        ? 'muito importante'
                        : 'disponível'}
                </Texto>
              </View>
              {esgotado && <MaterialCommunityIcons name="gift" size={26} color={cores.medidasForte} />}
            </View>
            {!esgotado && linkSeguro(i.link) && (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Ver o produto em ${siteDoLink(i.link)}`}
                onPress={() => Linking.openURL(i.link!)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, opacity: pressed ? 0.7 : 1 })}>
                <MaterialCommunityIcons name="open-in-new" size={18} color={cores.texto} />
                <Text style={{ fontFamily: fontes.negrito, fontSize: 15, color: cores.texto, textDecorationLine: 'underline' }}>
                  Ver o produto que os pais escolheram · {siteDoLink(i.link)}
                </Text>
              </Pressable>
            )}
            {!esgotado && !aberto && (
              <Botao
                titulo="Vou dar este"
                onPress={() => {
                  setEscolhido(i);
                  setQuantidade(1);
                  setErro(null);
                  setObrigado(null);
                }}
              />
            )}
            {aberto && (
              <View style={{ gap: 12 }}>
                <Campo rotulo="Seu nome" value={nome} onChangeText={setNome} placeholder="Ex.: Tia Ana" autoCapitalize="words" />
                {restante > 1 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Texto variante="rotulo" style={{ flex: 1 }}>
                      Quantos você vai dar?
                    </Texto>
                    <BotaoQtd icone="minus" onPress={() => setQuantidade(Math.max(1, quantidade - 1))} />
                    <Text style={{ minWidth: 32, textAlign: 'center', fontFamily: fontes.extra, fontSize: 22, color: cores.texto }}>
                      {quantidade}
                    </Text>
                    <BotaoQtd icone="plus" onPress={() => setQuantidade(Math.min(restante, quantidade + 1))} />
                  </View>
                )}
                <Campo
                  rotulo="Recado para os pais (opcional)"
                  value={mensagem}
                  onChangeText={setMensagem}
                  placeholder="Ex.: Com muito carinho!"
                />
                <Aviso texto={erro} />
                <Botao titulo="Confirmar reserva" onPress={reservar} carregando={enviando} />
                <Botao titulo="Voltar" variante="texto" onPress={() => setEscolhido(null)} />
              </View>
            )}
          </Cartao>
        );
      })}

      {cha.pix && (
        <Cartao>
          <Texto variante="subtitulo">Prefere dar em dinheiro?</Texto>
          <Texto selectable>Chave Pix: {cha.pix}</Texto>
          {Platform.OS === 'web' && <Botao titulo="Copiar chave Pix" variante="secundario" onPress={() => copiarPix(cha.pix!)} />}
        </Cartao>
      )}

      <Texto variante="suave" style={{ textAlign: 'center' }}>
        Lista feita com o {NOME_APP}. Os pais veem quem reservou cada presente.
      </Texto>
    </Tela>
  );
}
