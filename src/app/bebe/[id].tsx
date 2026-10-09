import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Aviso, Botao, Cabecalho, Campo, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes, type Bebe, type Sexo } from '@/context/bebes';
import { useSessao } from '@/context/sessao';
import { confirmar } from '@/lib/confirmar';
import { idadeGestacional, partoPelaDum, partoPeloUltrassom, semanasTexto } from '@/lib/gestacao';
import { deISO, hojeISO, mascaraData, paraISO } from '@/lib/idade';
import { mensagemDeErro, supabase } from '@/lib/supabase';

type Status = Bebe['status'];
type Calculo = 'parto' | 'dum' | 'ultrassom';

function numero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}

function paraTexto(n: number | null) {
  return n === null ? '' : String(n).replace('.', ',');
}

function somarDiasISO(iso: string, dias: number) {
  const [a, m, d] = iso.split('-').map(Number);
  const data = new Date(a, m - 1, d + dias);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

// /bebe/novo cadastra; /bebe/<id> edita; /bebe/<id>?nascer=1 registra o nascimento de quem estava a caminho.
export default function BebeForm() {
  const { id, nascer } = useLocalSearchParams<{ id: string; nascer?: string }>();
  const { familia } = useSessao();
  const { bebes, escolherBebe, recarregar } = useBebes();
  const existente = id === 'novo' ? null : (bebes.find((b) => b.id === id) ?? null);
  const registrandoNascimento = !!nascer && existente?.status === 'gestacao';

  const [status, setStatus] = useState<Status>(registrandoNascimento ? 'nascido' : (existente?.status ?? 'nascido'));
  const [nome, setNome] = useState(existente?.nome ?? '');
  const [nascimento, setNascimento] = useState(
    existente?.nascimento ? deISO(existente.nascimento) : registrandoNascimento ? deISO(hojeISO()) : '',
  );
  const [sexo, setSexo] = useState<Sexo | null>(existente?.sexo ?? null);
  const [peso, setPeso] = useState(paraTexto(existente?.peso_nascer_kg ?? null));
  const [altura, setAltura] = useState(paraTexto(existente?.altura_nascer_cm ?? null));

  // Gestação: a data prevista do parto vem direto, pela DUM ou pelo ultrassom.
  const [calculo, setCalculo] = useState<Calculo>('parto');
  const [parto, setParto] = useState(existente?.parto_previsto ? deISO(existente.parto_previsto) : '');
  const [dum, setDum] = useState('');
  const [dataUs, setDataUs] = useState('');
  const [semanasUs, setSemanasUs] = useState('');
  const [diasUs, setDiasUs] = useState('');

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function partoCalculado(): string | null {
    if (calculo === 'parto') return paraISO(parto);
    if (calculo === 'dum') {
      const d = paraISO(dum);
      return d && partoPelaDum(d);
    }
    const d = paraISO(dataUs);
    const s = Number(semanasUs);
    const dd = Number(diasUs || '0');
    if (!d || !Number.isInteger(s) || s < 4 || s > 42 || !Number.isInteger(dd) || dd < 0 || dd > 6) return null;
    return partoPeloUltrassom(d, s, dd);
  }

  const previsto = status === 'gestacao' ? partoCalculado() : null;
  const ig = previsto ? idadeGestacional(previsto) : null;

  async function salvar() {
    setErro(null);
    if (!nome.trim()) return setErro(status === 'gestacao' ? 'Como vocês chamam o bebê? Pode ser um apelido.' : 'Qual o nome do bebê?');

    let dados: Partial<Bebe>;
    if (status === 'gestacao') {
      if (!previsto)
        return setErro(
          calculo === 'ultrassom'
            ? 'Preencha a data do ultrassom e a idade gestacional (semanas e dias) informada no laudo.'
            : 'Data no formato DD/MM/AAAA.',
        );
      if (previsto < hojeISO() && !existente) return setErro('A data prevista já passou. Se o bebê nasceu, escolha "Já nasceu".');
      if (previsto > somarDiasISO(hojeISO(), 300)) return setErro('A data prevista está longe demais. Confira os dados.');
      dados = { nome: nome.trim(), status, parto_previsto: previsto, sexo, nascimento: null };
    } else {
      const nascISO = paraISO(nascimento);
      const pesoKg = numero(peso);
      const alturaCm = numero(altura);
      if (!nascISO) return setErro('Data de nascimento no formato DD/MM/AAAA.');
      if (nascISO > hojeISO()) return setErro('A data de nascimento está no futuro.');
      if (nascISO < '2020-01-01') return setErro('O app acompanha bebês de 0 a 3 anos.');
      if (!sexo) return setErro('Escolha menina ou menino (usado na curva da OMS).');
      if (Number.isNaN(pesoKg) || (pesoKg !== null && (pesoKg < 0.3 || pesoKg > 7)))
        return setErro('Peso ao nascer em kg, por exemplo 3,25.');
      if (Number.isNaN(alturaCm) || (alturaCm !== null && (alturaCm < 20 || alturaCm > 65)))
        return setErro('Altura ao nascer em cm, por exemplo 49.');
      dados = {
        nome: nome.trim(),
        status,
        nascimento: nascISO,
        sexo,
        peso_nascer_kg: pesoKg,
        altura_nascer_cm: alturaCm,
      };
    }

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
    confirmar(`Remover ${existente.nome}? Todos os registros serão apagados.`, 'Remover', async () => {
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

  const titulo = registrandoNascimento
    ? `${existente!.nome} nasceu!`
    : existente
      ? `Editar ${existente.nome}`
      : 'Novo bebê';

  return (
    <Tela>
      <Cabecalho titulo={titulo} />

      {registrandoNascimento ? (
        <Texto>Parabéns! Confira a data e conte como o bebê chegou. O histórico da gestação fica guardado.</Texto>
      ) : (
        <Escolha<Status>
          rotulo="O bebê"
          opcoes={[
            { valor: 'gestacao', titulo: 'Está a caminho' },
            { valor: 'nascido', titulo: 'Já nasceu' },
          ]}
          valor={status}
          onChange={setStatus}
        />
      )}

      <Campo
        rotulo={status === 'gestacao' ? 'Nome ou apelido' : 'Nome'}
        value={nome}
        onChangeText={setNome}
        placeholder={status === 'gestacao' ? 'Ex.: Feijãozinho' : 'Ex.: Theo'}
        autoCapitalize="words"
      />

      {status === 'gestacao' ? (
        <>
          <Escolha<Calculo>
            rotulo="Como calcular a data do parto"
            opcoes={[
              { valor: 'parto', titulo: 'Já sei a data' },
              { valor: 'dum', titulo: 'Última menstr.' },
              { valor: 'ultrassom', titulo: 'Ultrassom' },
            ]}
            valor={calculo}
            onChange={setCalculo}
          />
          {calculo === 'parto' && (
            <Campo
              rotulo="Data provável do parto"
              value={parto}
              onChangeText={(t) => setParto(mascaraData(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={10}
            />
          )}
          {calculo === 'dum' && (
            <Campo
              rotulo="Primeiro dia da última menstruação"
              value={dum}
              onChangeText={(t) => setDum(mascaraData(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={10}
            />
          )}
          {calculo === 'ultrassom' && (
            <>
              <Campo
                rotulo="Data do ultrassom (o primeiro é o mais preciso)"
                value={dataUs}
                onChangeText={(t) => setDataUs(mascaraData(t))}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={10}
              />
              <Texto variante="rotulo">Idade gestacional no laudo</Texto>
              <Campo
                rotulo="Semanas"
                value={semanasUs}
                onChangeText={setSemanasUs}
                placeholder="Ex.: 8"
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={2}
              />
              <Campo
                rotulo="Dias"
                value={diasUs}
                onChangeText={setDiasUs}
                placeholder="Ex.: 3"
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={1}
              />
            </>
          )}
          {previsto && ig && (
            <Texto style={{ textAlign: 'center' }}>
              Parto previsto para {deISO(previsto)} · hoje com {semanasTexto(ig.semanas, ig.dias)}
            </Texto>
          )}
          <Escolha<Sexo>
            rotulo="Sexo (opcional)"
            opcoes={[
              { valor: 'F', titulo: 'Menina' },
              { valor: 'M', titulo: 'Menino' },
            ]}
            valor={sexo}
            onChange={setSexo}
            aoLimpar={() => setSexo(null)}
          />
          <Texto variante="suave">Se ainda não sabem, deixem em branco. Tocar de novo desmarca.</Texto>
        </>
      ) : (
        <>
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
        </>
      )}

      <Aviso texto={erro} />

      <Botao
        titulo={registrandoNascimento ? 'Registrar nascimento' : existente ? 'Salvar' : 'Cadastrar bebê'}
        onPress={salvar}
        carregando={carregando}
      />
      {existente && !registrandoNascimento && <Botao titulo="Remover bebê" variante="texto" onPress={remover} />}
    </Tela>
  );
}
