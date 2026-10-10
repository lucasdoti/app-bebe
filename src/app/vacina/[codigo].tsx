import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Aviso, Botao, Cabecalho, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useVacinas } from '@/context/vacinas';
import { confirmar } from '@/lib/confirmar';
import { deISO, hojeISO, mascaraData, paraISO } from '@/lib/idade';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { CALENDARIO_BEBE, CALENDARIO_MAE, type Para } from '@/lib/vacinas';

function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/vacinas');
}

// /vacina/<codigo>?para=bebe marca uma dose do calendário; /vacina/outra para vacinas fora dele.
export default function VacinaForm() {
  const { codigo, para: paraParam, id } = useLocalSearchParams<{ codigo: string; para?: Para; id?: string }>();
  const para: Para = paraParam === 'mae' ? 'mae' : 'bebe';
  const { bebeAtual } = useBebes();
  const { aplicadas, recarregar } = useVacinas();
  const dose = (para === 'mae' ? CALENDARIO_MAE : CALENDARIO_BEBE).find((d) => d.codigo === codigo);
  const existente = id
    ? (aplicadas.find((a) => a.id === id) ?? null)
    : codigo !== 'outra'
      ? (aplicadas.find((a) => a.para === para && a.codigo === codigo) ?? null)
      : null;

  const [nome, setNome] = useState(existente?.nome ?? '');
  const [data, setData] = useState(deISO(existente?.data ?? hojeISO()));
  const [local, setLocal] = useState(existente?.local ?? '');
  const [lote, setLote] = useState(existente?.lote ?? '');
  const [observacao, setObservacao] = useState(existente?.observacao ?? '');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const titulo = dose ? `${dose.vacina} · ${dose.dose}` : existente?.nome ?? 'Outra vacina';

  async function salvar() {
    setErro(null);
    if (!bebeAtual) return;
    const dataISO = paraISO(data);
    if (!dataISO) return setErro('Data no formato DD/MM/AAAA.');
    if (dataISO > hojeISO()) return setErro('A data está no futuro. Marque a vacina depois de tomar.');
    if (!dose && !nome.trim()) return setErro('Qual vacina?');
    const dados = {
      nome: dose ? `${dose.vacina} (${dose.dose})` : nome.trim(),
      data: dataISO,
      local: local.trim() || null,
      lote: lote.trim() || null,
      observacao: observacao.trim() || null,
    };
    setCarregando(true);
    const { error } = existente
      ? await supabase.from('vacinas_aplicadas').update(dados).eq('id', existente.id)
      : await supabase
          .from('vacinas_aplicadas')
          .insert({ ...dados, bebe_id: bebeAtual.id, para, codigo: dose ? dose.codigo : null });
    setCarregando(false);
    if (error) return setErro(error.code === '23505' ? 'Essa dose já está marcada.' : mensagemDeErro(error));
    await recarregar();
    voltar();
  }

  function desmarcar() {
    if (!existente) return;
    confirmar(dose ? 'Desmarcar esta vacina como tomada?' : 'Apagar esta vacina?', 'Confirmar', async () => {
      const { error } = await supabase.from('vacinas_aplicadas').delete().eq('id', existente.id);
      if (error) return setErro(mensagemDeErro(error));
      await recarregar();
      voltar();
    });
  }

  if (codigo !== 'outra' && !dose) {
    return (
      <Tela>
        <Cabecalho titulo="Vacina" />
        <Texto variante="suave">Vacina não encontrada no calendário.</Texto>
      </Tela>
    );
  }

  return (
    <Tela>
      <Cabecalho titulo={titulo} />
      {dose && (
        <Cartao>
          <Texto>Protege contra: {dose.protege}.</Texto>
          {dose.nota && <Texto variante="suave">{dose.nota}</Texto>}
        </Cartao>
      )}
      {!dose && (
        <Campo rotulo="Vacina" value={nome} onChangeText={setNome} placeholder="Ex.: Meningocócica B" />
      )}
      <Campo
        rotulo="Data em que tomou"
        value={data}
        onChangeText={(t) => setData(mascaraData(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
      />
      <Campo rotulo="Local (opcional)" value={local} onChangeText={setLocal} placeholder="Ex.: UBS do bairro" />
      <Campo rotulo="Lote (opcional)" value={lote} onChangeText={setLote} placeholder="Está na caderneta" />
      <Campo
        rotulo="Observação (opcional)"
        value={observacao}
        onChangeText={setObservacao}
        placeholder="Ex.: teve febre baixa no dia seguinte"
        multiline
        style={{ minHeight: 88, paddingTop: 14, textAlignVertical: 'top' }}
      />
      <Aviso texto={erro} />
      <Botao titulo={existente ? 'Salvar' : 'Marcar como tomada'} onPress={salvar} carregando={carregando} />
      {existente && <Botao titulo={dose ? 'Desmarcar' : 'Apagar'} variante="texto" onPress={desmarcar} />}
    </Tela>
  );
}
