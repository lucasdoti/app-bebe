import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Aviso, Botao, Cabecalho, Campo, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useRemedios } from '@/context/remedios';
import { confirmar } from '@/lib/confirmar';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { combinar, diasAtras, horaCurta, mascaraHora, rotuloDia } from '@/lib/tempo';

const INTERVALOS = ['4', '6', '8', '12', '24'];

function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/remedios');
}

// /remedio/novo cadastra; /remedio/<id> edita, encerra ou apaga.
export default function RemedioForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bebeAtual } = useBebes();
  const { remedios, recarregar } = useRemedios();
  const existente = id === 'novo' ? null : (remedios.find((r) => r.id === id) ?? null);

  const inicioBase = existente ? new Date(existente.inicio) : new Date();
  const intervaloInicial = existente ? String(existente.intervalo_h).replace('.', ',') : '8';
  const [nome, setNome] = useState(existente?.nome ?? '');
  const [dose, setDose] = useState(existente?.dose ?? '');
  const [intervalo, setIntervalo] = useState(INTERVALOS.includes(intervaloInicial) ? intervaloInicial : 'outro');
  const [intervaloOutro, setIntervaloOutro] = useState(INTERVALOS.includes(intervaloInicial) ? '' : intervaloInicial);
  const [dias, setDias] = useState(existente?.duracao_dias ? String(existente.duracao_dias) : '');
  const [dia, setDia] = useState(String(diasAtras(inicioBase)));
  const [hora, setHora] = useState(horaCurta(inicioBase));
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!bebeAtual) return;
    const horas = Number((intervalo === 'outro' ? intervaloOutro : intervalo).replace(',', '.'));
    const duracao = dias.trim() ? Number(dias) : null;
    const inicio = combinar(Number(dia), hora);
    if (!nome.trim()) return setErro('Qual o nome do remédio?');
    if (!dose.trim()) return setErro('Qual a dose que o pediatra receitou? Ex.: 2,5 ml ou 8 gotas.');
    if (!(horas >= 0.5 && horas <= 72)) return setErro('Intervalo em horas, entre 0,5 e 72.');
    if (duracao !== null && !(Number.isInteger(duracao) && duracao >= 1 && duracao <= 365))
      return setErro('Duração em dias, de 1 a 365. Deixe em branco se não tiver data para acabar.');
    if (!inicio) return setErro('Horário da primeira dose no formato HH:MM.');

    const dados = {
      nome: nome.trim(),
      dose: dose.trim(),
      intervalo_h: horas,
      duracao_dias: duracao,
      inicio: inicio.toISOString(),
      ativo: true,
    };
    setCarregando(true);
    const { error } = existente
      ? await supabase.from('remedios').update(dados).eq('id', existente.id)
      : await supabase.from('remedios').insert({ ...dados, bebe_id: bebeAtual.id });
    setCarregando(false);
    if (error) return setErro(mensagemDeErro(error));
    await recarregar();
    voltar();
  }

  function encerrar() {
    if (!existente) return;
    confirmar(`Encerrar ${existente.nome}? Os lembretes param e o histórico de doses fica guardado.`, 'Encerrar', async () => {
      const { error } = await supabase.from('remedios').update({ ativo: false }).eq('id', existente.id);
      if (error) return setErro(mensagemDeErro(error));
      await recarregar();
      voltar();
    });
  }

  if (id !== 'novo' && !existente) {
    return (
      <Tela>
        <Cabecalho titulo="Remédio" />
        <Texto variante="suave">Remédio não encontrado.</Texto>
      </Tela>
    );
  }

  return (
    <Tela>
      <Cabecalho titulo={existente ? existente.nome : 'Novo remédio'} />
      <Campo rotulo="Remédio" value={nome} onChangeText={setNome} placeholder="Ex.: Paracetamol" autoCapitalize="sentences" />
      <Campo rotulo="Dose receitada" value={dose} onChangeText={setDose} placeholder="Ex.: 2,5 ml ou 8 gotas" />
      <Escolha
        rotulo="De quantas em quantas horas"
        opcoes={[...INTERVALOS.map((h) => ({ valor: h, titulo: `${h}h` })), { valor: 'outro', titulo: 'Outro' }]}
        valor={intervalo}
        onChange={setIntervalo}
      />
      {intervalo === 'outro' && (
        <Campo
          rotulo="Intervalo (horas)"
          value={intervaloOutro}
          onChangeText={setIntervaloOutro}
          placeholder="Ex.: 3"
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
      )}
      <Campo
        rotulo="Por quantos dias (opcional)"
        value={dias}
        onChangeText={setDias}
        placeholder="Em branco = até vocês encerrarem"
        keyboardType="number-pad"
        inputMode="numeric"
      />
      <Escolha
        rotulo="Primeira dose"
        opcoes={[...new Set([0, 1, diasAtras(inicioBase)])].map((d) => ({ valor: String(d), titulo: rotuloDia(d) }))}
        valor={dia}
        onChange={setDia}
      />
      <Campo
        rotulo="Horário da primeira dose"
        value={hora}
        onChangeText={(t) => setHora(mascaraHora(t))}
        placeholder="HH:MM"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={5}
      />
      <Texto variante="suave">
        Se a primeira dose já foi dada, registre também em "Dei a dose" para o app contar a próxima a partir dela.
      </Texto>
      <Aviso texto={erro} />
      <Botao titulo="Salvar" onPress={salvar} carregando={carregando} />
      {existente && <Botao titulo="Encerrar tratamento" variante="texto" onPress={encerrar} />}
    </Tela>
  );
}
