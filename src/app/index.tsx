import { useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';

import { Aviso, Botao, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { useSessao } from '@/context/sessao';
import { linkDoConvite } from '@/lib/convite';
import { mensagemDeErro, nomePapel, supabase } from '@/lib/supabase';
import { fontes } from '@/theme/cores';
import { useTema, type ModoTema } from '@/theme/tema';

function confirmar(pergunta: string, aoConfirmar: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(pergunta)) aoConfirmar();
    return;
  }
  Alert.alert(pergunta, undefined, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', style: 'destructive', onPress: aoConfirmar },
  ]);
}

// Home provisória da etapa 1: mostra a família e o convite. Os cartões do dia chegam na etapa 2.
export default function Inicio() {
  const { sessao, familia, membros, recarregarFamilia, sair } = useSessao();
  const { cores, modo, setModo } = useTema();
  const [aviso, setAviso] = useState<string | null>(null);

  if (!familia) return null;
  const eu = membros.find((m) => m.user_id === sessao?.user.id);
  const link = linkDoConvite(familia.codigo_convite);
  const sozinho = membros.length < 2;

  async function compartilhar() {
    const mensagem = `Entre na nossa família no Colinho: ${link}\nOu use o código ${familia!.codigo_convite}`;
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
    confirmar('Sair da família? Você deixa de ver os registros dos bebês.', async () => {
      const { error } = await supabase.rpc('sair_familia');
      if (error) setAviso(mensagemDeErro(error));
      else await recarregarFamilia();
    });
  }

  return (
    <Tela>
      <View style={{ gap: 4, marginTop: 8 }}>
        <Texto variante="suave">{familia.nome}</Texto>
        <Texto variante="titulo">Olá, {eu?.nome ?? 'você'}!</Texto>
      </View>

      <Cartao>
        <Texto variante="subtitulo">Quem está na família</Texto>
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

      <Cartao>
        <Texto variante="subtitulo">Em breve</Texto>
        <Texto variante="suave">Cadastro dos bebês e o resumo do dia chegam na próxima etapa.</Texto>
      </Cartao>

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

      <Botao titulo="Sair da família" variante="texto" onPress={sairDaFamilia} />
      <Botao titulo="Sair da conta" variante="texto" onPress={sair} />
    </Tela>
  );
}
