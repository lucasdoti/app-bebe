import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Aviso, Botao, Cabecalho, Campo, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes, type Sexo } from '@/context/bebes';
import { useSessao } from '@/context/sessao';
import { confirmar } from '@/lib/confirmar';
import { deISO, hojeISO, mascaraData, paraISO } from '@/lib/idade';
import { mensagemDeErro, supabase } from '@/lib/supabase';

function numero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}

function paraTexto(n: number | null) {
  return n === null ? '' : String(n).replace('.', ',');
}

// /bebe/novo cadastra; /bebe/<id> edita.
export default function BebeForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { familia } = useSessao();
  const { bebes, escolherBebe, recarregar } = useBebes();
  const existente = id === 'novo' ? null : (bebes.find((b) => b.id === id) ?? null);

  const [nome, setNome] = useState(existente?.nome ?? '');
  const [nascimento, setNascimento] = useState(existente ? deISO(existente.nascimento) : '');
  const [sexo, setSexo] = useState<Sexo | null>(existente?.sexo ?? null);
  const [peso, setPeso] = useState(paraTexto(existente?.peso_nascer_kg ?? null));
  const [altura, setAltura] = useState(paraTexto(existente?.altura_nascer_cm ?? null));
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    const nascISO = paraISO(nascimento);
    const pesoKg = numero(peso);
    const alturaCm = numero(altura);
    if (!nome.trim()) return setErro('Qual o nome do bebê?');
    if (!nascISO) return setErro('Data de nascimento no formato DD/MM/AAAA.');
    if (nascISO > hojeISO()) return setErro('A data de nascimento está no futuro.');
    if (nascISO < '2020-01-01') return setErro('O app acompanha bebês de 0 a 3 anos.');
    if (!sexo) return setErro('Escolha menina ou menino (usado na curva da OMS).');
    if (Number.isNaN(pesoKg) || (pesoKg !== null && (pesoKg < 0.3 || pesoKg > 7)))
      return setErro('Peso ao nascer em kg, por exemplo 3,25.');
    if (Number.isNaN(alturaCm) || (alturaCm !== null && (alturaCm < 20 || alturaCm > 65)))
      return setErro('Altura ao nascer em cm, por exemplo 49.');

    const dados = {
      nome: nome.trim(),
      nascimento: nascISO,
      sexo,
      peso_nascer_kg: pesoKg,
      altura_nascer_cm: alturaCm,
    };

    setCarregando(true);
    const resposta = existente
      ? await supabase.from('bebes').update(dados).eq('id', existente.id).select('id').single()
      : await supabase
          .from('bebes')
          .insert({ ...dados, familia_id: familia!.id })
          .select('id')
          .single();
    setCarregando(false);
    if (resposta.error) return setErro(mensagemDeErro(resposta.error));

    await recarregar();
    escolherBebe(resposta.data.id);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function remover() {
    if (!existente) return;
    confirmar(`Remover ${existente.nome}? Todos os registros dele(a) serão apagados.`, 'Remover', async () => {
      const { error } = await supabase.from('bebes').delete().eq('id', existente.id);
      if (error) return setErro(mensagemDeErro(error));
      await recarregar();
      router.replace('/');
    });
  }

  if (id !== 'novo' && !existente) {
    return (
      <Tela>
        <Cabecalho titulo="Bebê" />
        <Texto variante="suave">Bebê não encontrado.</Texto>
      </Tela>
    );
  }

  return (
    <Tela>
      <Cabecalho titulo={existente ? `Editar ${existente.nome}` : 'Novo bebê'} />

      <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Ex.: Theo" autoCapitalize="words" />
      <Campo
        rotulo="Data de nascimento"
        value={nascimento}
        onChangeText={(t) => setNascimento(mascaraData(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
      />
      <Escolha<Sexo>
        rotulo="Sexo (para a curva de crescimento da OMS)"
        opcoes={[
          { valor: 'F', titulo: 'Menina' },
          { valor: 'M', titulo: 'Menino' },
        ]}
        valor={sexo}
        onChange={setSexo}
      />
      <Campo
        rotulo="Peso ao nascer (kg)"
        value={peso}
        onChangeText={setPeso}
        placeholder="Ex.: 3,25"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <Campo
        rotulo="Altura ao nascer (cm)"
        value={altura}
        onChangeText={setAltura}
        placeholder="Ex.: 49"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <Texto variante="suave">Peso e altura ao nascer são opcionais e ficam no início da curva de crescimento.</Texto>

      <Aviso texto={erro} />

      <Botao titulo={existente ? 'Salvar' : 'Cadastrar bebê'} onPress={salvar} carregando={carregando} />
      {existente && <Botao titulo="Remover bebê" variante="texto" onPress={remover} />}
    </Tela>
  );
}
