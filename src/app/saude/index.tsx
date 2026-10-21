import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { useDesfazer } from '@/components/desfazer';
import { Aviso, Botao, Cabecalho, Campo, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useSaude } from '@/context/saude';
import { deISO, hojeISO, mascaraData, paraISO } from '@/lib/idade';
import { nomeStatus, separarLista, textoDaFicha, type ItemSaude, type StatusSaude, type TipoSaude } from '@/lib/saude';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Executar = (acao: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>;

function LinhaItem({ item, onRemover }: { item: ItemSaude; onRemover: () => void }) {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: ALVO_TOQUE }}>
      <View style={{ flex: 1 }}>
        <Texto style={{ fontFamily: fontes.negrito }}>{item.nome}</Texto>
        {(item.status || item.detalhe) && (
          <Texto variante="suave">
            {[item.status && nomeStatus[item.status], item.detalhe].filter(Boolean).join(' · ')}
          </Texto>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Tirar ${item.nome}`}
        onPress={onRemover}
        style={{ width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="delete-outline" size={22} color={cores.textoSuave} />
      </Pressable>
    </View>
  );
}

// Lista em que dá para colar vários itens de uma vez (um por linha).
function Lista({
  titulo,
  explicacao,
  tipo,
  itens,
  placeholder,
  executar,
  remover,
  bebeId,
}: {
  titulo: string;
  explicacao: string;
  tipo: TipoSaude;
  itens: ItemSaude[];
  placeholder: string;
  executar: Executar;
  remover: (item: ItemSaude) => void;
  bebeId: string;
}) {
  const [texto, setTexto] = useState('');
  async function adicionar() {
    const ja = new Set(itens.map((i) => i.nome.toLowerCase()));
    const novos = separarLista(texto).filter((n) => !ja.has(n.toLowerCase()));
    if (!novos.length) return setTexto('');
    if (await executar(supabase.from('saude_itens').insert(novos.map((nome) => ({ bebe_id: bebeId, tipo, nome })))))
      setTexto('');
  }
  return (
    <Cartao>
      <Texto variante="subtitulo">{titulo}</Texto>
      <Texto variante="suave">{explicacao}</Texto>
      {itens.map((i) => (
        <LinhaItem key={i.id} item={i} onRemover={() => remover(i)} />
      ))}
      <Campo
        rotulo="Adicionar (um por linha; pode colar a lista inteira)"
        value={texto}
        onChangeText={setTexto}
        placeholder={placeholder}
        multiline
        style={{ minHeight: 88, paddingTop: 14, textAlignVertical: 'top' }}
      />
      <Botao titulo="Adicionar à lista" variante="secundario" onPress={adicionar} />
    </Cartao>
  );
}

// Ficha de saúde: teste do pezinho, condições, o que evitar e alergias. Para mostrar ao médico em toda consulta.
export default function FichaDeSaude() {
  const { bebeAtual } = useBebes();
  const saude = useSaude();
  const { cores } = useTema();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const p = saude.pezinho;
  const [coleta, setColeta] = useState(p?.data ? deISO(p.data) : '');
  const [resultado, setResultado] = useState<StatusSaude | null>(p?.status ?? null);
  const [obsPezinho, setObsPezinho] = useState(p?.detalhe ?? '');
  const [novaCondicao, setNovaCondicao] = useState('');
  const [statusCondicao, setStatusCondicao] = useState<StatusSaude>('confirmado');
  const [detalheCondicao, setDetalheCondicao] = useState('');
  const [fonte, setFonte] = useState(saude.fonte?.nome ?? '');
  const { oferecer, barra } = useDesfazer();

  // Se a ficha chegar depois de a tela abrir (ou mudar no outro celular), atualiza os campos.
  useEffect(() => {
    setColeta(p?.data ? deISO(p.data) : '');
    setResultado(p?.status ?? null);
    setObsPezinho(p?.detalhe ?? '');
  }, [p?.id, p?.data, p?.status, p?.detalhe]);
  useEffect(() => setFonte(saude.fonte?.nome ?? ''), [saude.fonte?.nome]);

  if (!bebeAtual) return null;

  const executar: Executar = async (acao) => {
    setErro(null);
    const { error } = await acao;
    if (error) setErro(mensagemDeErro(error));
    await saude.recarregar();
    return !error;
  };

  async function remover(i: ItemSaude) {
    if (!(await executar(supabase.from('saude_itens').delete().eq('id', i.id)))) return;
    const { id, bebe_id, tipo, nome, status, data, detalhe } = i;
    oferecer(`"${nome}" saiu da ficha`, () =>
      executar(supabase.from('saude_itens').insert({ id, bebe_id, tipo, nome, status, data, detalhe })),
    );
  }

  async function salvarPezinho() {
    const d = coleta.trim() ? paraISO(coleta) : null;
    if (coleta.trim() && !d) return setErro('Data da coleta no formato DD/MM/AAAA.');
    if (d && d > hojeISO()) return setErro('A data da coleta está no futuro.');
    const dados = { nome: 'Teste do pezinho', status: resultado, data: d, detalhe: obsPezinho.trim() || null };
    const ok = await executar(
      p
        ? supabase.from('saude_itens').update(dados).eq('id', p.id)
        : supabase.from('saude_itens').insert({ ...dados, bebe_id: bebeAtual!.id, tipo: 'pezinho' }),
    );
    if (ok) setAviso('Teste do pezinho salvo.');
  }

  async function adicionarCondicao() {
    if (!novaCondicao.trim()) return setErro('Qual a condição? Ex.: Deficiência de G6PD.');
    const ok = await executar(
      supabase.from('saude_itens').insert({
        bebe_id: bebeAtual!.id,
        tipo: 'condicao',
        nome: novaCondicao.trim(),
        status: statusCondicao,
        detalhe: detalheCondicao.trim() || null,
      }),
    );
    if (ok) {
      setNovaCondicao('');
      setDetalheCondicao('');
    }
  }

  async function salvarFonte() {
    const t = fonte.trim();
    const f = saude.fonte;
    const ok = await executar(
      !t && f
        ? supabase.from('saude_itens').delete().eq('id', f.id)
        : f
          ? supabase.from('saude_itens').update({ nome: t }).eq('id', f.id)
          : supabase.from('saude_itens').insert({ bebe_id: bebeAtual!.id, tipo: 'fonte', nome: t }),
    );
    if (ok) setAviso('Origem da lista salva.');
  }

  const texto = textoDaFicha(bebeAtual.nome, saude.ficha);

  return (
    <Tela rodape={barra}>
      <Cabecalho titulo="Ficha de saúde" />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Botao
            titulo="Mostrar ao médico"
            onPress={() => router.push('/saude/medico')}
            icone={<MaterialCommunityIcons name="doctor" size={20} color={cores.textoNaPrimaria} />}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Botao
            titulo="WhatsApp"
            variante="secundario"
            onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(texto)}`)}
            icone={<MaterialCommunityIcons name="whatsapp" size={20} color={cores.texto} />}
          />
        </View>
      </View>

      <View style={{ backgroundColor: cores.fralda, borderRadius: 16, padding: 14 }}>
        <Text style={{ fontFamily: fontes.media, fontSize: 15, color: cores.textoNaPrimaria }}>
          Copie aqui exatamente a lista que o médico ou o serviço de triagem entregou. O app não traz listas prontas: as que
          circulam na internet não batem entre si. Na dúvida, pergunte ao médico.
        </Text>
      </View>
      <Aviso texto={erro} />
      <Aviso texto={aviso} tipo="info" />

      <Cartao>
        <Texto variante="subtitulo">Teste do pezinho</Texto>
        <Campo
          rotulo="Data da coleta"
          value={coleta}
          onChangeText={(t) => setColeta(mascaraData(t))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={10}
        />
        <Escolha<StatusSaude>
          rotulo="Resultado"
          opcoes={[
            { valor: 'pendente', titulo: 'Aguardando' },
            { valor: 'normal', titulo: 'Normal' },
            { valor: 'alterado', titulo: 'Alterado' },
          ]}
          valor={resultado}
          onChange={setResultado}
          aoLimpar={() => setResultado(null)}
        />
        {resultado === 'alterado' && (
          <Texto variante="suave">
            Um primeiro resultado alterado muitas vezes ainda não é diagnóstico: costuma vir um reteste ou exame de
            confirmação. Anote a condição abaixo como "Em investigação" até confirmar.
          </Texto>
        )}
        <Campo
          rotulo="Observação (opcional)"
          value={obsPezinho}
          onChangeText={setObsPezinho}
          placeholder="Ex.: reteste marcado para 20/11"
        />
        <Botao titulo="Salvar teste do pezinho" variante="secundario" onPress={salvarPezinho} />
      </Cartao>

      <Cartao>
        <Texto variante="subtitulo">Condições de saúde</Texto>
        {saude.condicoes.length === 0 && <Texto variante="suave">Nenhuma condição anotada.</Texto>}
        {saude.condicoes.map((c) => (
          <LinhaItem key={c.id} item={c} onRemover={() => remover(c)} />
        ))}
        <Campo rotulo="Condição" value={novaCondicao} onChangeText={setNovaCondicao} placeholder="Ex.: Deficiência de G6PD" />
        <Escolha<StatusSaude>
          rotulo="Situação"
          opcoes={[
            { valor: 'investigacao', titulo: 'Investigando' },
            { valor: 'confirmado', titulo: 'Confirmado' },
            { valor: 'descartado', titulo: 'Descartado' },
          ]}
          valor={statusCondicao}
          onChange={setStatusCondicao}
        />
        <Campo
          rotulo="Observação (opcional)"
          value={detalheCondicao}
          onChangeText={setDetalheCondicao}
          placeholder="Ex.: acompanhamento no hemocentro"
        />
        <Botao titulo="Adicionar condição" variante="secundario" onPress={adicionarCondicao} />
      </Cartao>

      <Lista
        titulo="Remédios e substâncias a evitar"
        explicacao="Inclua também os nomes comerciais (ex.: Novalgina, AAS) e produtos como naftalina. O app avisa se alguém cadastrar um remédio desta lista."
        tipo="evitar_remedio"
        itens={saude.remediosEvitar}
        placeholder={'Ex.:\nDipirona (Novalgina)\nÁcido acetilsalicílico (AAS)'}
        executar={executar}
        remover={remover}
        bebeId={bebeAtual.id}
      />

      <Lista
        titulo="Alimentos a evitar"
        explicacao="O app avisa se uma refeição registrada tiver um destes alimentos."
        tipo="evitar_alimento"
        itens={saude.alimentosEvitar}
        placeholder="Ex.: Feijão-fava"
        executar={executar}
        remover={remover}
        bebeId={bebeAtual.id}
      />

      <Lista
        titulo="Alergias"
        explicacao="Remédios, alimentos ou outras coisas que já deram reação."
        tipo="alergia"
        itens={saude.alergias}
        placeholder="Ex.: Amoxicilina – manchas na pele"
        executar={executar}
        remover={remover}
        bebeId={bebeAtual.id}
      />

      <Cartao>
        <Texto variante="subtitulo">De onde veio a lista</Texto>
        <Campo
          rotulo="Quem entregou e quando"
          value={fonte}
          onChangeText={setFonte}
          placeholder="Ex.: Hemocentro, outubro de 2026"
        />
        <Botao titulo="Salvar" variante="secundario" onPress={salvarFonte} />
      </Cartao>

      <Texto variante="suave">
        A ficha fica guardada no celular e abre mesmo sem internet. Ela não substitui a orientação médica.
      </Texto>
    </Tela>
  );
}
