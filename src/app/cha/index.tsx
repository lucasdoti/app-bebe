import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, Share, Text, View } from 'react-native';

import { Aviso, Botao, Cabecalho, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useEnxoval, type ItemEnxoval } from '@/context/enxoval';
import { confirmar } from '@/lib/confirmar';
import { mascaraData, paraISO, deISO, hojeISO } from '@/lib/idade';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { horaCurta, mascaraHora } from '@/lib/tempo';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

// Segredo do link: 32 caracteres aleatórios (impossível de adivinhar).
const novoToken = () => (randomUUID() + randomUUID()).replace(/-/g, '').slice(0, 32);

export const linkDoCha = (token: string) =>
  `${typeof window !== 'undefined' && window.location ? window.location.origin : ''}/cha/${token}`;

function textoDoConvite(nome: string, link: string, data: string | null, local: string | null) {
  const quando = data
    ? new Date(data).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) + ` às ${horaCurta(data)}`
    : null;
  return [
    `🍼 *Chá de bebê de ${nome}*`,
    quando && `📅 ${quando}`,
    local && `📍 ${local}`,
    '',
    'Preparamos uma lista com o que ainda falta. Se quiser presentear, escolha um item e reserve para ninguém repetir:',
    link,
  ]
    .filter((l) => l !== null && l !== undefined)
    .join('\n');
}

function LinhaItem({ item, reservados, nomes, onAlternar }: { item: ItemEnxoval; reservados: number; nomes: string[]; onAlternar: () => void }) {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: ALVO_TOQUE }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.no_cha }}
        accessibilityLabel={`${item.nome} aparece no chá`}
        onPress={onAlternar}
        style={{ width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons
          name={item.no_cha ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
          size={28}
          color={item.no_cha ? cores.medidasForte : cores.textoSuave}
        />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Texto style={{ fontFamily: fontes.negrito, color: item.no_cha ? cores.texto : cores.textoSuave }}>
          {item.prioridade === 'essencial' ? '⭐ ' : ''}
          {item.quantidade} {item.nome}
          {item.tamanho ? ` (${item.tamanho})` : ''}
        </Texto>
        <Texto variante="suave">
          {reservados
            ? `🎁 ${reservados} de ${item.quantidade} reservado${reservados > 1 ? 's' : ''}: ${nomes.join(', ')}`
            : item.no_cha
              ? 'Ninguém reservou ainda'
              : 'Não aparece no chá'}
        </Texto>
      </View>
    </View>
  );
}

// Chá de bebê: dados do evento, link para os convidados, itens visíveis e quem reservou o quê.
export default function ChaDeBebe() {
  const { bebeAtual } = useBebes();
  const { cha, faltam, reservas, recarregar } = useEnxoval();
  const { cores } = useTema();
  const dataBase = cha?.data_evento ? new Date(cha.data_evento) : null;
  const [data, setData] = useState(dataBase ? deISO(hojeISO(dataBase)) : '');
  const [hora, setHora] = useState(dataBase ? horaCurta(dataBase) : '');
  const [local, setLocal] = useState(cha?.local ?? '');
  const [mensagem, setMensagem] = useState(cha?.mensagem ?? '');
  const [pix, setPix] = useState(cha?.pix ?? '');
  const [editando, setEditando] = useState(!cha);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!bebeAtual) return null;

  async function executar(acao: PromiseLike<{ error: { message: string } | null }>) {
    setErro(null);
    const { error } = await acao;
    if (error) setErro(mensagemDeErro(error));
    await recarregar();
    return !error;
  }

  async function salvar() {
    setErro(null);
    let quando: string | null = null;
    if (data.trim()) {
      const d = paraISO(data);
      if (!d) return setErro('Data no formato DD/MM/AAAA.');
      const h = hora.trim() ? hora.match(/^(\d{1,2}):(\d{2})$/) : ['', '15', '00'];
      if (!h || Number(h[1]) > 23 || Number(h[2]) > 59) return setErro('Horário no formato HH:MM.');
      const [a, m, dd] = d.split('-').map(Number);
      quando = new Date(a, m - 1, dd, Number(h[1]), Number(h[2])).toISOString();
    }
    const dados = {
      data_evento: quando,
      local: local.trim() || null,
      mensagem: mensagem.trim() || null,
      pix: pix.trim() || null,
    };
    setCarregando(true);
    const ok = await executar(
      cha
        ? supabase.from('cha_bebe').update(dados).eq('bebe_id', bebeAtual!.id)
        : supabase.from('cha_bebe').insert({ ...dados, bebe_id: bebeAtual!.id, token: novoToken() }),
    );
    setCarregando(false);
    if (ok) setEditando(false);
  }

  const link = cha ? linkDoCha(cha.token) : '';
  const convite = cha ? textoDoConvite(bebeAtual.nome, link, cha.data_evento, cha.local) : '';

  async function compartilhar() {
    try {
      if (Platform.OS === 'web' && !navigator.share) {
        await navigator.clipboard.writeText(convite);
        setAviso('Convite copiado. Cole no grupo da família.');
        return;
      }
      await Share.share({ message: convite });
    } catch {
      // Cancelado.
    }
  }

  const visiveis = faltam.filter((i) => i.no_cha).length;
  const totalReservas = reservas.reduce((s, r) => s + r.quantidade, 0);

  return (
    <Tela>
      <Cabecalho titulo="Chá de bebê" />

      {cha && !editando && (
        <Cartao style={{ backgroundColor: cores.mamada, borderColor: cores.mamada }}>
          <Text style={{ fontFamily: fontes.extra, fontSize: 20, color: cores.textoNaPrimaria }}>
            {cha.ativo ? 'Link do chá ativo' : 'Link pausado'}
          </Text>
          <Text style={{ fontFamily: fontes.media, fontSize: 15, color: cores.textoNaPrimaria }}>
            {visiveis} {visiveis === 1 ? 'item na lista' : 'itens na lista'} · {totalReservas}{' '}
            {totalReservas === 1 ? 'presente reservado' : 'presentes reservados'}
          </Text>
          {cha.ativo && (
            <>
              <Botao
                titulo="Enviar convite pelo WhatsApp"
                variante="secundario"
                icone={<MaterialCommunityIcons name="whatsapp" size={20} color={cores.texto} />}
                onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(convite)}`)}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Botao titulo="Compartilhar" variante="secundario" onPress={compartilhar} />
                </View>
                <View style={{ flex: 1 }}>
                  <Botao
                    titulo="Ver a página"
                    variante="secundario"
                    onPress={() => router.push({ pathname: '/cha/[token]', params: { token: cha.token } })}
                  />
                </View>
              </View>
            </>
          )}
        </Cartao>
      )}
      <Aviso texto={aviso} tipo="info" />

      {editando ? (
        <Cartao>
          <Texto variante="subtitulo">{cha ? 'Dados do chá' : 'Criar a página do chá'}</Texto>
          {!cha && (
            <Texto variante="suave">
              Os convidados abrem um link (sem precisar de conta), veem a lista do que falta e reservam um presente. Eles não
              veem nada além disso.
            </Texto>
          )}
          <Campo
            rotulo="Data (opcional)"
            value={data}
            onChangeText={(t) => setData(mascaraData(t))}
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={10}
          />
          <Campo
            rotulo="Horário (opcional)"
            value={hora}
            onChangeText={(t) => setHora(mascaraHora(t))}
            placeholder="HH:MM"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={5}
          />
          <Campo rotulo="Local (opcional)" value={local} onChangeText={setLocal} placeholder="Endereço ou nome do lugar" />
          <Campo
            rotulo="Mensagem para os convidados (opcional)"
            value={mensagem}
            onChangeText={setMensagem}
            placeholder="Ex.: Vamos adorar ter vocês com a gente!"
            multiline
            style={{ minHeight: 88, paddingTop: 14, textAlignVertical: 'top' }}
          />
          <Campo
            rotulo="Chave Pix para quem preferir dar em dinheiro (opcional)"
            value={pix}
            onChangeText={setPix}
            placeholder="E-mail, telefone ou chave aleatória"
            autoCapitalize="none"
          />
          <Aviso texto={erro} />
          <Botao titulo={cha ? 'Salvar' : 'Criar link do chá'} onPress={salvar} carregando={carregando} />
          {cha && <Botao titulo="Cancelar" variante="texto" onPress={() => setEditando(false)} />}
        </Cartao>
      ) : (
        cha && (
          <Cartao>
            <Texto variante="subtitulo">Dados do chá</Texto>
            <Texto>
              {cha.data_evento
                ? `${new Date(cha.data_evento).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às ${horaCurta(cha.data_evento)}`
                : 'Sem data definida'}
            </Texto>
            {cha.local && <Texto variante="suave">{cha.local}</Texto>}
            {cha.pix && <Texto variante="suave">Pix: {cha.pix}</Texto>}
            <Botao titulo="Editar dados" variante="secundario" onPress={() => setEditando(true)} />
          </Cartao>
        )
      )}

      {cha && (
        <Cartao>
          <Texto variante="subtitulo">Itens no chá</Texto>
          <Texto variante="suave">
            Vêm da aba "Falta" do enxoval. Toque no círculo para mostrar ou esconder um item na página.
          </Texto>
          {faltam.length === 0 && <Texto>A lista do que falta está vazia.</Texto>}
          {faltam.map((i) => {
            const dele = reservas.filter((r) => r.item_id === i.id);
            return (
              <LinhaItem
                key={i.id}
                item={i}
                reservados={dele.reduce((s, r) => s + r.quantidade, 0)}
                nomes={dele.map((r) => r.nome)}
                onAlternar={() => executar(supabase.from('enxoval_itens').update({ no_cha: !i.no_cha }).eq('id', i.id))}
              />
            );
          })}
          <Botao
            titulo="Adicionar itens ao que falta"
            variante="secundario"
            onPress={() => router.push({ pathname: '/enxoval', params: { aba: 'falta' } })}
          />
        </Cartao>
      )}

      {reservas.length > 0 && (
        <Cartao>
          <Texto variante="subtitulo">Reservas</Texto>
          {reservas.map((r) => {
            const item = faltam.find((i) => i.id === r.item_id);
            return (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Texto style={{ fontFamily: fontes.negrito }}>
                    {r.nome} · {r.quantidade} {item ? item.nome : 'item já recebido'}
                  </Texto>
                  {r.mensagem && <Texto variante="suave">“{r.mensagem}”</Texto>}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Cancelar a reserva de ${r.nome}`}
                  onPress={() =>
                    confirmar(`Cancelar a reserva de ${r.nome}? O item volta a ficar livre.`, 'Cancelar reserva', () =>
                      executar(supabase.from('cha_reservas').delete().eq('id', r.id)),
                    )
                  }
                  style={{ width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="close-circle-outline" size={22} color={cores.textoSuave} />
                </Pressable>
              </View>
            );
          })}
        </Cartao>
      )}

      {cha && (
        <Cartao>
          <Texto variante="subtitulo">Link</Texto>
          <Texto variante="suave" selectable>
            {link}
          </Texto>
          <Botao
            titulo={cha.ativo ? 'Pausar o link' : 'Reativar o link'}
            variante="secundario"
            onPress={() => executar(supabase.from('cha_bebe').update({ ativo: !cha.ativo }).eq('bebe_id', bebeAtual!.id))}
          />
          <Botao
            titulo="Gerar um link novo"
            variante="texto"
            onPress={() =>
              confirmar('Gerar um link novo? O link antigo para de funcionar; as reservas continuam.', 'Gerar', () =>
                executar(supabase.from('cha_bebe').update({ token: novoToken() }).eq('bebe_id', bebeAtual!.id)),
              )
            }
          />
        </Cartao>
      )}
    </Tela>
  );
}
