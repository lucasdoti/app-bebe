import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Aviso, Botao, Cabecalho, Campo, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { pontos, useGestacao, type Nome, type Voto } from '@/context/gestacao';
import { useSessao } from '@/context/sessao';
import { confirmar } from '@/lib/confirmar';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Sexo = 'F' | 'M';
const OPCOES: { valor: Voto; icone: 'heart' | 'thumb-up-outline' | 'thumb-down-outline'; rotulo: string }[] = [
  { valor: 2, icone: 'heart', rotulo: 'Amo' },
  { valor: 1, icone: 'thumb-up-outline', rotulo: 'Gosto' },
  { valor: -1, icone: 'thumb-down-outline', rotulo: 'Não' },
];
const nomeVoto: Record<Voto, string> = { 2: 'ama', 1: 'gosta', [-1]: 'não gosta' };

// Lista de nomes: cada um sugere e vota (amo, gosto, não); a lista se ordena pelos votos dos dois.
export default function Nomes() {
  const { bebeAtual } = useBebes();
  const { sessao, membros } = useSessao();
  const { nomes, recarregar } = useGestacao();
  const { cores } = useTema();
  const [novo, setNovo] = useState('');
  const [sexoNovo, setSexoNovo] = useState<Sexo | null>(bebeAtual?.sexo ?? null);
  const [filtro, setFiltro] = useState<'todos' | Sexo>(bebeAtual?.sexo ?? 'todos');
  const [erro, setErro] = useState<string | null>(null);

  if (!bebeAtual || !sessao) return null;
  const eu = sessao.user.id;
  const nomeDe = (id: string) => membros.find((m) => m.user_id === id)?.nome ?? 'alguém';

  async function sugerir() {
    const nome = novo.trim().replace(/\s+/g, ' ');
    if (!nome) return;
    setErro(null);
    setNovo('');
    const { error } = await supabase.from('nomes').insert({ bebe_id: bebeAtual!.id, nome, sexo: sexoNovo });
    if (error) setErro(error.code === '23505' ? `${nome} já está na lista.` : mensagemDeErro(error));
    await recarregar();
  }

  async function votar(n: Nome, valor: Voto) {
    setErro(null);
    const atual = n.votos[eu];
    const { error } =
      atual === valor
        ? await supabase.from('nomes_votos').delete().eq('nome_id', n.id).eq('user_id', eu)
        : atual !== undefined
          ? await supabase.from('nomes_votos').update({ valor, atualizado_em: new Date().toISOString() }).eq('nome_id', n.id).eq('user_id', eu)
          : await supabase.from('nomes_votos').insert({ nome_id: n.id, valor });
    if (error) setErro(mensagemDeErro(error));
    await recarregar();
  }

  function remover(n: Nome) {
    confirmar(`Tirar ${n.nome} da lista?`, 'Tirar', async () => {
      const { error } = await supabase.from('nomes').delete().eq('id', n.id);
      if (error) setErro(mensagemDeErro(error));
      await recarregar();
    });
  }

  const visiveis = nomes.filter((n) => filtro === 'todos' || n.sexo === null || n.sexo === filtro);
  const favorito = visiveis.find((n) => pontos(n) > 0);

  return (
    <Tela>
      <Cabecalho titulo="Nomes" />

      <Cartao>
        <Campo
          rotulo="Sugerir um nome"
          value={novo}
          onChangeText={setNovo}
          onSubmitEditing={sugerir}
          returnKeyType="done"
          autoCapitalize="words"
          placeholder="Ex.: Helena"
        />
        <Escolha<Sexo>
          rotulo="Para (opcional)"
          opcoes={[
            { valor: 'F', titulo: 'Menina' },
            { valor: 'M', titulo: 'Menino' },
          ]}
          valor={sexoNovo}
          onChange={setSexoNovo}
          aoLimpar={() => setSexoNovo(null)}
        />
        <Botao titulo="Adicionar à lista" onPress={sugerir} />
      </Cartao>

      <Aviso texto={erro} />

      {!bebeAtual.sexo && (
        <Escolha<'todos' | Sexo>
          rotulo="Mostrar"
          opcoes={[
            { valor: 'todos', titulo: 'Todos' },
            { valor: 'F', titulo: 'Menina' },
            { valor: 'M', titulo: 'Menino' },
          ]}
          valor={filtro}
          onChange={setFiltro}
        />
      )}

      {favorito && (
        <Texto style={{ textAlign: 'center' }}>
          Favorito por enquanto: <Text style={{ fontFamily: fontes.extra }}>{favorito.nome}</Text>
        </Texto>
      )}

      <Cartao>
        {visiveis.length === 0 && <Texto variante="suave">A lista está vazia. Cada um pode sugerir e votar.</Texto>}
        {visiveis.map((n) => {
          const outros = Object.entries(n.votos).filter(([u]) => u !== eu);
          return (
            <View key={n.id} style={{ gap: 6, paddingVertical: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Texto style={{ fontFamily: fontes.extra, fontSize: 20 }}>{n.nome}</Texto>
                  <Texto variante="suave">
                    {[
                      `${pontos(n)} ${Math.abs(pontos(n)) === 1 ? 'ponto' : 'pontos'}`,
                      ...outros.map(([u, v]) => `${nomeDe(u)} ${nomeVoto[v]}`),
                      `sugerido por ${n.autor_id === eu ? 'você' : nomeDe(n.autor_id)}`,
                    ].join(' · ')}
                  </Texto>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Tirar ${n.nome} da lista`}
                  onPress={() => remover(n)}
                  style={{ width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="delete-outline" size={22} color={cores.textoSuave} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {OPCOES.map((o) => {
                  const ativo = n.votos[eu] === o.valor;
                  return (
                    <Pressable
                      key={o.valor}
                      accessibilityRole="button"
                      accessibilityState={{ selected: ativo }}
                      accessibilityLabel={`${o.rotulo} ${n.nome}`}
                      onPress={() => votar(n, o.valor)}
                      style={{
                        flex: 1,
                        minHeight: ALVO_TOQUE,
                        flexDirection: 'row',
                        gap: 6,
                        borderRadius: 18,
                        borderWidth: 1.5,
                        borderColor: ativo ? cores.mamada : cores.borda,
                        backgroundColor: ativo ? cores.mamada : cores.cartao,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <MaterialCommunityIcons
                        name={o.icone}
                        size={18}
                        color={ativo ? cores.textoNaPrimaria : cores.textoSuave}
                      />
                      <Text
                        style={{
                          fontFamily: fontes.negrito,
                          fontSize: 15,
                          color: ativo ? cores.textoNaPrimaria : cores.texto,
                        }}>
                        {o.rotulo}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </Cartao>
      <Texto variante="suave">Amo vale 2 pontos, gosto vale 1 e não tira 1. Tocar de novo no seu voto desfaz.</Texto>
    </Tela>
  );
}
