import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Aviso, Botao, Cabecalho, Campo, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useGestacao, type TipoPreNatal } from '@/context/gestacao';
import { confirmar } from '@/lib/confirmar';
import { idadeGestacionalNaData, semanasTexto } from '@/lib/gestacao';
import { mascaraData, paraISO } from '@/lib/idade';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { horaCurta, mascaraHora } from '@/lib/tempo';

const titulosPadrao: Record<TipoPreNatal, string> = {
  consulta: 'Consulta com a obstetra',
  exame: 'Exame',
  ultrassom: 'Ultrassom',
};

function inteiro(texto: string): number | null {
  const t = texto.trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/pre-natal');
}

// /pre-natal/novo?tipo=consulta agenda ou registra; /pre-natal/<id> edita ou apaga.
export default function PreNatalForm() {
  const { id, tipo: tipoParam } = useLocalSearchParams<{ id: string; tipo?: TipoPreNatal }>();
  const { bebeAtual } = useBebes();
  const { preNatal, recarregar } = useGestacao();
  const existente = id === 'novo' ? null : (preNatal.find((p) => p.id === id) ?? null);

  const dataBase = existente ? new Date(existente.data) : new Date();
  const [tipo, setTipo] = useState<TipoPreNatal>(existente?.tipo ?? tipoParam ?? 'consulta');
  const [titulo, setTitulo] = useState(existente?.titulo ?? '');
  const [data, setData] = useState(
    `${String(dataBase.getDate()).padStart(2, '0')}/${String(dataBase.getMonth() + 1).padStart(2, '0')}/${dataBase.getFullYear()}`,
  );
  const [hora, setHora] = useState(existente ? horaCurta(dataBase) : '');
  const [local, setLocal] = useState(existente?.local ?? '');
  const [perguntas, setPerguntas] = useState(existente?.perguntas ?? '');
  const [anotacoes, setAnotacoes] = useState(existente?.anotacoes ?? '');
  const [peso, setPeso] = useState(existente?.peso_fetal_g ? String(existente.peso_fetal_g) : '');
  const [comprimento, setComprimento] = useState(
    existente?.comprimento_cm ? String(existente.comprimento_cm).replace('.', ',') : '',
  );
  const [bpm, setBpm] = useState(existente?.batimentos_bpm ? String(existente.batimentos_bpm) : '');
  const [percentil, setPercentil] = useState(
    existente?.percentil_laudo !== null && existente?.percentil_laudo !== undefined
      ? String(existente.percentil_laudo).replace('.', ',')
      : '',
  );
  const [pesoMae, setPesoMae] = useState(existente?.peso_mae_kg ? String(existente.peso_mae_kg).replace('.', ',') : '');
  const [pressaoMax, setPressaoMax] = useState(existente?.pressao_sistolica ? String(existente.pressao_sistolica) : '');
  const [pressaoMin, setPressaoMin] = useState(existente?.pressao_diastolica ? String(existente.pressao_diastolica) : '');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const dataISO = paraISO(data);
  const ig = bebeAtual?.parto_previsto && dataISO ? idadeGestacionalNaData(bebeAtual.parto_previsto, dataISO) : null;

  async function salvar() {
    setErro(null);
    if (!bebeAtual) return;
    if (!dataISO) return setErro('Data no formato DD/MM/AAAA.');
    const h = hora.trim() ? hora.match(/^(\d{1,2}):(\d{2})$/) : ['', '09', '00'];
    if (!h || Number(h[1]) > 23 || Number(h[2]) > 59) return setErro('Horário no formato HH:MM.');
    const [a, m, d] = dataISO.split('-').map(Number);
    const quando = new Date(a, m - 1, d, Number(h[1]), Number(h[2]));

    const pesoG = inteiro(peso);
    const compCm = inteiro(comprimento);
    const batimentos = inteiro(bpm);
    const perc = inteiro(percentil);
    const kgMae = inteiro(pesoMae);
    // Aceita "120 / 80" em mmHg ou "12 por 8" como se fala no consultório.
    const mmHg = (v: number | null) => (v !== null && v < 30 ? v * 10 : v);
    const sis = mmHg(inteiro(pressaoMax));
    const dia = mmHg(inteiro(pressaoMin));
    if (Number.isNaN(kgMae) || (kgMae !== null && (kgMae < 30 || kgMae > 200)))
      return setErro('Peso da mãe em kg, por exemplo 68,5.');
    if (Number.isNaN(sis) || Number.isNaN(dia) || (sis === null) !== (dia === null))
      return setErro('Preencha a pressão máxima e a mínima, por exemplo 12 e 8 (ou 120 e 80).');
    if (sis !== null && dia !== null && (sis < 60 || sis > 250 || dia < 30 || dia > 160 || dia >= sis))
      return setErro('Confira a pressão: a máxima vem primeiro, por exemplo 12 por 8.');
    if (Number.isNaN(pesoG) || (pesoG !== null && (pesoG < 1 || pesoG > 6000)))
      return setErro('Peso fetal estimado em gramas, por exemplo 620.');
    if (Number.isNaN(compCm) || (compCm !== null && (compCm <= 0 || compCm > 65)))
      return setErro('Comprimento em cm, por exemplo 30,5.');
    if (Number.isNaN(batimentos) || (batimentos !== null && (batimentos < 50 || batimentos > 250)))
      return setErro('Batimentos por minuto, por exemplo 145.');
    if (Number.isNaN(perc) || (perc !== null && (perc < 0 || perc > 100))) return setErro('Percentil entre 0 e 100.');

    const dados = {
      tipo,
      titulo: titulo.trim() || titulosPadrao[tipo],
      data: quando.toISOString(),
      local: local.trim() || null,
      perguntas: perguntas.trim() || null,
      anotacoes: anotacoes.trim() || null,
      peso_fetal_g: tipo === 'ultrassom' && pesoG !== null ? Math.round(pesoG) : null,
      comprimento_cm: tipo === 'ultrassom' ? compCm : null,
      batimentos_bpm: tipo === 'ultrassom' && batimentos !== null ? Math.round(batimentos) : null,
      percentil_laudo: tipo === 'ultrassom' ? perc : null,
      peso_mae_kg: tipo === 'consulta' ? kgMae : null,
      pressao_sistolica: tipo === 'consulta' && sis !== null ? Math.round(sis) : null,
      pressao_diastolica: tipo === 'consulta' && dia !== null ? Math.round(dia) : null,
    };

    setCarregando(true);
    const { error } = existente
      ? await supabase.from('pre_natal').update(dados).eq('id', existente.id)
      : await supabase.from('pre_natal').insert({ ...dados, bebe_id: bebeAtual.id });
    setCarregando(false);
    if (error) return setErro(mensagemDeErro(error));
    await recarregar();
    voltar();
  }

  function apagar() {
    if (!existente) return;
    confirmar('Apagar este item do pré-natal?', 'Apagar', async () => {
      const { error } = await supabase.from('pre_natal').delete().eq('id', existente.id);
      if (error) return setErro(mensagemDeErro(error));
      await recarregar();
      voltar();
    });
  }

  if (id !== 'novo' && !existente) {
    return (
      <Tela>
        <Cabecalho titulo="Pré-natal" />
        <Texto variante="suave">Item não encontrado.</Texto>
      </Tela>
    );
  }

  return (
    <Tela>
      <Cabecalho titulo={existente ? existente.titulo : `Novo: ${titulosPadrao[tipo].toLowerCase()}`} />

      <Escolha<TipoPreNatal>
        rotulo="Tipo"
        opcoes={[
          { valor: 'consulta', titulo: 'Consulta' },
          { valor: 'exame', titulo: 'Exame' },
          { valor: 'ultrassom', titulo: 'Ultrassom' },
        ]}
        valor={tipo}
        onChange={setTipo}
      />
      <Campo
        rotulo="Título"
        value={titulo}
        onChangeText={setTitulo}
        placeholder={tipo === 'exame' ? 'Ex.: Curva glicêmica' : tipo === 'ultrassom' ? 'Ex.: Morfológico do 2º trimestre' : titulosPadrao[tipo]}
      />
      <Campo
        rotulo="Data"
        value={data}
        onChangeText={(t) => setData(mascaraData(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
      />
      {ig && ig.totalDias >= 0 && (
        <Texto variante="suave">Nessa data: {semanasTexto(ig.semanas, ig.dias)} de gestação.</Texto>
      )}
      <Campo
        rotulo="Horário (opcional)"
        value={hora}
        onChangeText={(t) => setHora(mascaraHora(t))}
        placeholder="HH:MM"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={5}
      />
      <Campo rotulo="Local (opcional)" value={local} onChangeText={setLocal} placeholder="Clínica, laboratório ou endereço" />

      {tipo === 'ultrassom' && (
        <>
          <Texto variante="rotulo">Medidas do laudo (opcionais)</Texto>
          <Campo
            rotulo="Peso fetal estimado (g)"
            value={peso}
            onChangeText={setPeso}
            placeholder="Ex.: 620"
            keyboardType="number-pad"
            inputMode="numeric"
          />
          <Campo
            rotulo="Comprimento (cm)"
            value={comprimento}
            onChangeText={setComprimento}
            placeholder="Ex.: 30,5"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          <Campo
            rotulo="Batimentos do coração (bpm)"
            value={bpm}
            onChangeText={setBpm}
            placeholder="Ex.: 145"
            keyboardType="number-pad"
            inputMode="numeric"
          />
          <Campo
            rotulo="Percentil do peso no laudo"
            value={percentil}
            onChangeText={setPercentil}
            placeholder="Ex.: 48"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
        </>
      )}

      {tipo === 'consulta' && (
        <>
          <Texto variante="rotulo">Da mãe, nesta consulta (opcional)</Texto>
          <Campo
            rotulo="Peso (kg)"
            value={pesoMae}
            onChangeText={setPesoMae}
            placeholder="Ex.: 68,5"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          <Campo
            rotulo="Pressão máxima"
            value={pressaoMax}
            onChangeText={setPressaoMax}
            placeholder="Ex.: 12 ou 120"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={3}
          />
          <Campo
            rotulo="Pressão mínima"
            value={pressaoMin}
            onChangeText={setPressaoMin}
            placeholder="Ex.: 8 ou 80"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={3}
          />
        </>
      )}

      {tipo !== 'ultrassom' && (
        <Campo
          rotulo="Perguntas para levar"
          value={perguntas}
          onChangeText={setPerguntas}
          placeholder="Uma por linha"
          multiline
          style={{ minHeight: 96, paddingTop: 14, textAlignVertical: 'top' }}
        />
      )}
      <Campo
        rotulo="Anotações"
        value={anotacoes}
        onChangeText={setAnotacoes}
        placeholder={tipo === 'consulta' ? 'O que a médica disse, pressão, peso da mãe...' : 'Resultado, observações...'}
        multiline
        style={{ minHeight: 120, paddingTop: 14, textAlignVertical: 'top' }}
      />

      <Aviso texto={erro} />
      <Botao titulo="Salvar" onPress={salvar} carregando={carregando} />
      {existente && <Botao titulo="Apagar" variante="texto" onPress={apagar} />}
    </Tela>
  );
}
