import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';

import { Aviso, Botao, Cabecalho, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useSessao } from '@/context/sessao';
import { NOME_APP } from '@/lib/app';
import { confirmar } from '@/lib/confirmar';
import { linkDoConvite } from '@/lib/convite';
import { idadeGestacional, semanasTexto } from '@/lib/gestacao';
import { idadeTexto } from '@/lib/idade';
import { mensagemDeErro, nomePapel, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema, type ModoTema } from '@/theme/tema';

// Família, convite, bebês e aparência.
export default function Ajustes() {
  const { sessao, familia, membros, recarregarFamilia, sair } = useSessao();
  const { bebes } = useBebes();
  const { cores, modo, setModo } = useTema();
  const [aviso, setAviso] = useState<string | null>(null);

  if (!familia) return null;
  const link = linkDoConvite(familia.codigo_convite);
  const sozinho = membros.length < 2;

  async function compartilhar() {
    const mensagem = `Entre na nossa família no ${NOME_APP}: ${link}\nOu use o código ${familia!.codigo_convite}`;
    try {
      if (Platform.OS === 'web' && !navigator.share) {
        await navigator.clipboard.writeText(mensagem);
        setAviso('Convite copiado. Cole no WhatsApp.');
        return;
      }
      await Share.share({ message: mensagem });
    } catch {
      // Compartilhamento cancelado.
    }
  }

  function sairDaFamilia() {
    confirmar('Sair da família? Você deixa de ver os registros dos bebês.', 'Sair', async () => {
      const { error } = await supabase.rpc('sair_familia');
      if (error) setAviso(mensagemDeErro(error));
      else await recarregarFamilia();
    });
  }

  return (
    <Tela>
      <Cabecalho titulo="Ajustes" />

      <Cartao>
        <Texto variante="subtitulo">Bebês</Texto>
        {bebes.map((b) => (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/bebe/[id]', params: { id: b.id } })}
            style={({ pressed }) => [
              {
                minHeight: ALVO_TOQUE,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <View style={{ flex: 1 }}>
              <Texto style={{ fontFamily: fontes.negrito }}>{b.nome}</Texto>
              <Texto variante="suave">
                {b.nascimento
                  ? idadeTexto(b.nascimento)
                  : b.parto_previsto
                    ? 'a caminho · ' + semanasTexto(idadeGestacional(b.parto_previsto).semanas, idadeGestacional(b.parto_previsto).dias)
                    : 'a caminho'}
              </Texto>
            </View>
            <Ionicons name="create-outline" size={22} color={cores.textoSuave} />
          </Pressable>
        ))}
        <Botao
          titulo="Adicionar bebê"
          variante="secundario"
          onPress={() => router.push({ pathname: '/bebe/[id]', params: { id: 'novo' } })}
        />
      </Cartao>

      <Cartao>
        <Texto variante="subtitulo">{familia.nome}</Texto>
        {membros.map((m) => (
          <Texto key={m.user_id}>
            {m.nome} · {nomePapel[m.papel]}
            {m.user_id === sessao?.user.id ? ' (você)' : ''}
          </Texto>
        ))}
        {sozinho && <Texto variante="suave">Convide o outro responsável para registrarem juntos.</Texto>}
      </Cartao>

      <Cartao style={{ backgroundColor: cores.sono, borderColor: cores.sono }}>
        <Texto variante="rotulo" style={{ color: cores.texto }}>
          Código de convite
        </Texto>
        <Texto selectable style={{ fontFamily: fontes.extra, fontSize: 32, lineHeight: 40, letterSpacing: 1 }}>
          {familia.codigo_convite}
        </Texto>
        <Botao titulo="Enviar convite" variante="secundario" onPress={compartilhar} />
      </Cartao>

      <Aviso texto={aviso} tipo="info" />

      <Escolha<ModoTema>
        rotulo="Aparência"
        opcoes={[
          { valor: 'auto', titulo: 'Auto' },
          { valor: 'dia', titulo: 'Dia' },
          { valor: 'noite', titulo: 'Noite' },
        ]}
        valor={modo}
        onChange={setModo}
      />
      <Texto variante="suave">No automático, o modo noite liga das 20h às 6h.</Texto>

      <Botao titulo="Lembretes e notificações" variante="secundario" onPress={() => router.push('/lembretes')} />
      <Botao titulo="Remédios e febre" variante="secundario" onPress={() => router.push('/remedios')} />
      <Botao titulo="Enxoval" variante="secundario" onPress={() => router.push('/enxoval')} />

      <Botao titulo="Sair da família" variante="texto" onPress={sairDaFamilia} />
      <Botao titulo="Sair da conta" variante="texto" onPress={sair} />
      <Texto variante="suave" style={{ textAlign: 'center' }}>
        {NOME_APP} · versão {process.env.EXPO_PUBLIC_VERSAO || 'local'}
      </Texto>
    </Tela>
  );
}
