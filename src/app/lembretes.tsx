import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Aviso, Botao, Cabecalho, Campo, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useRemedios, type Lembrete } from '@/context/remedios';
import { confirmar } from '@/lib/confirmar';
import {
  ativarNotificacoes,
  desativarNotificacoes,
  enviarTeste,
  estadoNotificacoes,
  type EstadoNotificacoes,
} from '@/lib/notificacoes';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { combinar, diasAtras, horaCurta, mascaraHora } from '@/lib/tempo';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const INTERVALOS_MAMADA = [120, 150, 180, 210, 240];
const rotuloIntervalo = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
const nomeRecorrencia = { nenhuma: 'uma vez', diaria: 'todo dia', semanal: 'toda semana' };

// "Hoje às 10:00", "Amanhã às 07:30" ou "qua., 22/10 às 16:00".
function quandoLembrete(iso: string) {
  const d = diasAtras(iso);
  const dia =
    d === 0
      ? 'Hoje'
      : d === -1
        ? 'Amanhã'
        : new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return `${dia} às ${horaCurta(iso)}`;
}

function Notificacoes() {
  const [estado, setEstado] = useState<EstadoNotificacoes | null>(null);
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: 'erro' | 'info' } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const atualizar = () => estadoNotificacoes().then(setEstado);
  useEffect(() => {
    atualizar();
  }, []);

  async function ativar() {
    setOcupado(true);
    setMensagem(null);
    try {
      const erro = await ativarNotificacoes();
      setMensagem(erro ? { texto: erro, tipo: 'erro' } : { texto: 'Notificações ativadas neste celular.', tipo: 'info' });
    } catch (e) {
      setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' });
    }
    setOcupado(false);
    atualizar();
  }

  async function testar() {
    setOcupado(true);
    const erro = await enviarTeste();
    setMensagem(erro ? { texto: erro, tipo: 'erro' } : { texto: 'Enviada! Deve chegar em alguns segundos.', tipo: 'info' });
    setOcupado(false);
  }

  return (
    <Cartao>
      <Texto variante="subtitulo">Notificações neste celular</Texto>
      {estado === 'instalar-no-iphone' && (
        <Texto>
          No iPhone, os lembretes só chegam com o app instalado: no Safari, toque em Compartilhar e depois em
          "Adicionar à Tela de Início". Depois abra o Colinho pelo ícone e volte aqui. Precisa do iOS 16.4 ou mais novo.
        </Texto>
      )}
      {estado === 'sem-suporte' && <Texto>Este navegador não recebe notificações. Tente pelo Chrome ou instale o app.</Texto>}
      {estado === 'bloqueadas' && (
        <Texto>As notificações estão bloqueadas. Libere nos ajustes do celular (ou do navegador) para o Colinho.</Texto>
      )}
      {estado === 'desativadas' && (
        <>
          <Texto variante="suave">Cada celular precisa ativar uma vez. Peça para o outro responsável ativar também.</Texto>
          <Botao titulo="Ativar notificações" onPress={ativar} carregando={ocupado} />
        </>
      )}
      {estado === 'ativadas' && (
        <>
          <Texto>Ativadas neste celular.</Texto>
          <Botao titulo="Enviar notificação de teste" variante="secundario" onPress={testar} carregando={ocupado} />
          <Botao
            titulo="Desativar neste celular"
            variante="texto"
            onPress={async () => {
              await desativarNotificacoes();
              atualizar();
            }}
          />
        </>
      )}
      {mensagem && <Aviso texto={mensagem.texto} tipo={mensagem.tipo} />}
    </Cartao>
  );
}

// Lembretes que chegam para pai e mãe: remédios (automático), mamada e personalizados.
export default function Lembretes() {
  const { bebeAtual } = useBebes();
  const { lembretes, recarregar } = useRemedios();
  const { cores } = useTema();
  const [titulo, setTitulo] = useState('');
  const [dia, setDia] = useState('0');
  const [hora, setHora] = useState('');
  const [recorrencia, setRecorrencia] = useState<Lembrete['recorrencia']>('nenhuma');
  const [erro, setErro] = useState<string | null>(null);

  if (!bebeAtual) return null;
  const mamada = lembretes.find((l) => l.tipo === 'mamada');
  const pessoais = lembretes.filter((l) => l.tipo === 'personalizado' && l.ativo);

  async function executar(acao: PromiseLike<{ error: { message: string } | null }>) {
    setErro(null);
    const { error } = await acao;
    if (error) setErro(mensagemDeErro(error));
    await recarregar();
  }

  function configurarMamada(intervalo: number | null) {
    if (intervalo === null) {
      if (mamada) executar(supabase.from('lembretes').update({ ativo: false }).eq('id', mamada.id));
      return;
    }
    executar(
      mamada
        ? supabase.from('lembretes').update({ ativo: true, intervalo_min: intervalo }).eq('id', mamada.id)
        : supabase
            .from('lembretes')
            .insert({ bebe_id: bebeAtual!.id, tipo: 'mamada', titulo: 'Mamada', intervalo_min: intervalo }),
    );
  }

  async function adicionar() {
    setErro(null);
    if (!titulo.trim()) return setErro('Do que é o lembrete? Ex.: Banho de sol.');
    let quando = combinar(Number(dia), hora);
    if (!quando) return setErro('Horário no formato HH:MM.');
    if (quando.getTime() <= Date.now()) {
      if (recorrencia === 'nenhuma') return setErro('Esse horário já passou.');
      while (quando.getTime() <= Date.now())
        quando = new Date(quando.getTime() + (recorrencia === 'diaria' ? 1 : 7) * 24 * 3600_000);
    }
    await executar(
      supabase.from('lembretes').insert({
        bebe_id: bebeAtual!.id,
        tipo: 'personalizado',
        titulo: titulo.trim(),
        proximo_em: quando.toISOString(),
        recorrencia,
      }),
    );
    setTitulo('');
    setHora('');
  }

  return (
    <Tela>
      <Cabecalho titulo="Lembretes" />
      <Notificacoes />

      <Cartao>
        <Texto variante="subtitulo">Remédios</Texto>
        <Texto variante="suave">
          Automático: na hora da próxima dose de cada remédio ativo, os dois recebem o aviso. Se alguém registrar a dose
          antes, o aviso não é enviado.
        </Texto>
      </Cartao>

      {bebeAtual.status === 'nascido' && (
        <Cartao>
          <Texto variante="subtitulo">Mamada</Texto>
          <Escolha
            rotulo="Avisar quando passar desde a última"
            opcoes={[
              { valor: 'nao', titulo: 'Não' },
              ...INTERVALOS_MAMADA.map((m) => ({ valor: String(m), titulo: rotuloIntervalo(m) })),
            ]}
            valor={mamada?.ativo ? String(mamada.intervalo_min) : 'nao'}
            onChange={(v) => configurarMamada(v === 'nao' ? null : Number(v))}
          />
          <Texto variante="suave">Um aviso por mamada. Começar uma nova mamada cancela o aviso.</Texto>
        </Cartao>
      )}

      {bebeAtual.status === 'gestacao' && (
        <Cartao>
          <Texto variante="subtitulo">Pré-natal</Texto>
          <Texto variante="suave">
            Automático: até 24 h antes de cada consulta ou exame agendado, os dois recebem o aviso.
          </Texto>
        </Cartao>
      )}

      <Cartao>
        <Texto variante="subtitulo">Personalizados</Texto>
        {pessoais.length === 0 && <Texto variante="suave">Ex.: banho de sol, troca de fralda da madrugada, vacina.</Texto>}
        {pessoais.map((l) => (
          <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: ALVO_TOQUE }}>
            <View style={{ flex: 1 }}>
              <Texto style={{ fontFamily: fontes.negrito }}>{l.titulo}</Texto>
              <Texto variante="suave">
                {l.proximo_em ? `${quandoLembrete(l.proximo_em)} · ` : ''}
                {nomeRecorrencia[l.recorrencia]}
              </Texto>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Apagar lembrete ${l.titulo}`}
              onPress={() =>
                confirmar(`Apagar o lembrete "${l.titulo}"?`, 'Apagar', () =>
                  executar(supabase.from('lembretes').delete().eq('id', l.id)),
                )
              }
              style={{ width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="delete-outline" size={22} color={cores.textoSuave} />
            </Pressable>
          </View>
        ))}
        <Campo rotulo="Novo lembrete" value={titulo} onChangeText={setTitulo} placeholder="Ex.: Banho de sol" />
        <Escolha
          rotulo="Dia"
          opcoes={[
            { valor: '0', titulo: 'Hoje' },
            { valor: '-1', titulo: 'Amanhã' },
          ]}
          valor={dia}
          onChange={setDia}
        />
        <Campo
          rotulo="Horário"
          value={hora}
          onChangeText={(t) => setHora(mascaraHora(t))}
          placeholder="HH:MM"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={5}
        />
        <Escolha<Lembrete['recorrencia']>
          rotulo="Repetir"
          opcoes={[
            { valor: 'nenhuma', titulo: 'Não' },
            { valor: 'diaria', titulo: 'Todo dia' },
            { valor: 'semanal', titulo: 'Toda semana' },
          ]}
          valor={recorrencia}
          onChange={setRecorrencia}
        />
        <Botao titulo="Criar lembrete" variante="secundario" onPress={adicionar} />
      </Cartao>

      <Aviso texto={erro} />
    </Tela>
  );
}
