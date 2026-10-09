import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Aviso, Botao, Cabecalho, Campo, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useMedidas } from '@/context/medidas';
import { confirmar } from '@/lib/confirmar';
import { deISO, hojeISO, mascaraData, paraISO } from '@/lib/idade';
import { mensagemDeErro, supabase } from '@/lib/supabase';

function numero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}

const paraTexto = (n: number | null) => (n === null ? '' : String(Number(n)).replace('.', ','));

function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/medidas');
}

// /medida/novo registra; /medida/<id> edita ou apaga.
export default function MedidaForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bebeAtual } = useBebes();
  const { doBebe, recarregar } = useMedidas();
  const existente = id === 'novo' ? null : (doBebe.find((m) => m.id === id) ?? null);

  const [data, setData] = useState(deISO(existente?.data ?? hojeISO()));
  const [peso, setPeso] = useState(paraTexto(existente?.peso_kg ?? null));
  const [altura, setAltura] = useState(paraTexto(existente?.altura_cm ?? null));
  const [cabeca, setCabeca] = useState(paraTexto(existente?.perimetro_cefalico_cm ?? null));
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    const dataISO = paraISO(data);
    let pesoKg = numero(peso);
    const alturaCm = numero(altura);
    const cabecaCm = numero(cabeca);
    if (!bebeAtual) return;
    if (!dataISO) return setErro('Data no formato DD/MM/AAAA.');
    if (dataISO > hojeISO()) return setErro('A data está no futuro.');
    if (dataISO < bebeAtual.nascimento) return setErro('A data é anterior ao nascimento.');
    // Quem digita o peso em gramas (6450) recebe em kg (6,45).
    if (pesoKg !== null && pesoKg > 300) pesoKg = pesoKg / 1000;
    if (pesoKg === null && alturaCm === null && cabecaCm === null) return setErro('Preencha ao menos uma medida.');
    if (Number.isNaN(pesoKg) || (pesoKg !== null && (pesoKg < 0.3 || pesoKg > 30)))
      return setErro('Peso em kg, por exemplo 6,45.');
    if (Number.isNaN(alturaCm) || (alturaCm !== null && (alturaCm < 20 || alturaCm > 130)))
      return setErro('Altura em cm, por exemplo 62,5.');
    if (Number.isNaN(cabecaCm) || (cabecaCm !== null && (cabecaCm < 20 || cabecaCm > 60)))
      return setErro('Perímetro cefálico em cm, por exemplo 40,5.');

    const dados = { data: dataISO, peso_kg: pesoKg, altura_cm: alturaCm, perimetro_cefalico_cm: cabecaCm };
    setCarregando(true);
    const { error } = existente
      ? await supabase.from('medidas').update(dados).eq('id', existente.id)
      : await supabase.from('medidas').insert({ ...dados, bebe_id: bebeAtual.id });
    setCarregando(false);
    if (error) return setErro(mensagemDeErro(error));
    await recarregar();
    voltar();
  }

  function apagar() {
    if (!existente) return;
    confirmar('Apagar esta medida?', 'Apagar', async () => {
      const { error } = await supabase.from('medidas').delete().eq('id', existente.id);
      if (error) return setErro(mensagemDeErro(error));
      await recarregar();
      voltar();
    });
  }

  if (id !== 'novo' && !existente) {
    return (
      <Tela>
        <Cabecalho titulo="Medida" />
        <Texto variante="suave">Medida não encontrada.</Texto>
      </Tela>
    );
  }

  return (
    <Tela>
      <Cabecalho titulo={existente ? 'Editar medida' : 'Nova medida'} />
      <Campo
        rotulo="Data"
        value={data}
        onChangeText={(t) => setData(mascaraData(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
      />
      <Campo
        rotulo="Peso (kg)"
        value={peso}
        onChangeText={setPeso}
        placeholder="Ex.: 6,45"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <Campo
        rotulo="Altura (cm)"
        value={altura}
        onChangeText={setAltura}
        placeholder="Ex.: 62,5"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <Campo
        rotulo="Perímetro cefálico (cm)"
        value={cabeca}
        onChangeText={setCabeca}
        placeholder="Ex.: 40,5"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <Texto variante="suave">Preencha só o que foi medido. Precisa de internet para salvar.</Texto>
      <Aviso texto={erro} />
      <Botao titulo="Salvar" onPress={salvar} carregando={carregando} />
      {existente && <Botao titulo="Apagar medida" variante="texto" onPress={apagar} />}
    </Tela>
  );
}
