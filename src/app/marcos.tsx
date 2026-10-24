import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Folha } from '@/components/folha';
import { Aviso, Botao, Cabecalho, Campo, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { nasceu, useBebes } from '@/context/bebes';
import { useDentes } from '@/context/dentes';
import { useMarcos } from '@/context/marcos';
import { confirmar } from '@/lib/confirmar';
import { denteDoCodigo, nomeDente } from '@/lib/dentes';
import { deISO, hojeISO, idade, idadeTexto, mascaraData, paraISO } from '@/lib/idade';
import {
  DESENVOLVIMENTO,
  esperadoAte,
  faixaAtual,
  FAIXAS,
  nomeArea,
  nomeFaixa,
  PRIMEIRAS,
  type Marco,
  type MarcoDesenvolvimento,
  type TipoMarco,
} from '@/lib/marcos';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Aba = 'primeiras' | 'desenvolvimento';

// O que está aberto na folha: um marco sugerido, um marco livre ou um já anotado.
type Edicao = { tipo: TipoMarco; codigo: string | null; titulo: string; pergunta?: string; existente?: Marco };

// Marcos do bebê: "primeiras vezes" (lembranças, sem fotos) e o desenvolvimento da Caderneta da Criança.
export default function Marcos() {
  const params = useLocalSearchParams<{ aba?: Aba }>();
  const { bebeAtual } = useBebes();
  const { marcos, recarregar } = useMarcos();
  const { dentes } = useDentes();
  const { cores } = useTema();
  const [aba, setAba] = useState<Aba>(params.aba === 'desenvolvimento' ? 'desenvolvimento' : 'primeiras');
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [verAnteriores, setVerAnteriores] = useState(false);

  if (!nasceu(bebeAtual)) return null;
  const nascimento = bebeAtual.nascimento;
  const meses = idade(nascimento).meses;
  const porCodigo = new Map(marcos.filter((m) => m.codigo).map((m) => [m.codigo!, m]));
  const idadeNa = (iso: string) => idadeTexto(nascimento, new Date(`${iso}T12:00:00`)).replace('nasceu hoje', '0 dias');

  function abrir(e: Edicao) {
    setEdicao(e);
    setTitulo(e.existente?.titulo ?? e.titulo);
    setData(deISO(e.existente?.data ?? hojeISO()));
    setDetalhe(e.existente?.detalhe ?? '');
    setErro(null);
  }

  async function salvar() {
    if (!edicao) return;
    const iso = paraISO(data);
    if (!titulo.trim()) return setErro('Dê um nome ao marco.');
    if (!iso) return setErro('Data no formato DD/MM/AAAA.');
    if (iso > hojeISO()) return setErro('A data está no futuro.');
    if (iso < nascimento) return setErro(`A data é antes do nascimento (${deISO(nascimento)}).`);
    setSalvando(true);
    setErro(null);
    const campos = { titulo: titulo.trim().slice(0, 120), data: iso, detalhe: detalhe.trim().slice(0, 300) || null };
    const { error } = edicao.existente
      ? await supabase.from('marcos').update(campos).eq('id', edicao.existente.id)
      : await supabase.from('marcos').insert({ bebe_id: bebeAtual!.id, tipo: edicao.tipo, codigo: edicao.codigo, ...campos });
    setSalvando(false);
    if (error) return setErro(mensagemDeErro(error));
    await recarregar();
    setEdicao(null);
  }

  function apagar() {
    const m = edicao?.existente;
    if (!m) return;
    confirmar(`Apagar "${m.titulo}"? A data anotada some.`, 'Apagar', async () => {
      const { error } = await supabase.from('marcos').delete().eq('id', m.id);
      if (error) return setErro(mensagemDeErro(error));
      await recarregar();
      setEdicao(null);
    });
  }

  // ---------- Primeiras vezes ----------

  const primeiro = dentes[0];
  const denteVirtual = primeiro && {
    id: `dente-${primeiro.id}`,
    titulo: 'Primeiro dente',
    data: primeiro.nasceu_em,
    detalhe: denteDoCodigo(primeiro.codigo) ? nomeDente(denteDoCodigo(primeiro.codigo)!).toLowerCase() : null,
  };
  const aconteceram = [
    ...marcos.filter((m) => m.tipo === 'primeira').map((m) => ({ id: m.id, titulo: m.titulo, data: m.data, detalhe: m.detalhe, marco: m })),
    ...(denteVirtual ? [{ ...denteVirtual, marco: undefined }] : []),
  ].sort((a, b) => a.data.localeCompare(b.data));
  const porVir = PRIMEIRAS.filter((p) => !porCodigo.has(p.codigo));

  const textoCompartilhar = [
    `*Primeiras vezes de ${bebeAtual.nome}*`,
    '',
    ...aconteceram.map((a) => `• ${deISO(a.data)} (${idadeNa(a.data)}): ${a.titulo}${a.detalhe ? ` – "${a.detalhe}"` : ''}`),
  ].join('\n');

  const primeiras = (
    <>
      {aconteceram.length > 0 && (
        <Cartao>
          <Texto variante="subtitulo">Já aconteceram</Texto>
          {aconteceram.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              onPress={() =>
                a.marco
                  ? abrir({ tipo: 'primeira', codigo: a.marco.codigo, titulo: a.marco.titulo, existente: a.marco,
                      pergunta: PRIMEIRAS.find((p) => p.codigo === a.marco!.codigo)?.pergunta })
                  : router.push('/dentes')
              }
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: ALVO_TOQUE, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cores.sono, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name={a.marco ? 'star-outline' : 'tooth-outline'} size={20} color={cores.textoNaPrimaria} />
              </View>
              <View style={{ flex: 1 }}>
                <Texto style={{ fontFamily: fontes.negrito }}>{a.titulo}</Texto>
                <Texto variante="suave">
                  {deISO(a.data)}, com {idadeNa(a.data)}
                  {a.detalhe ? ` · “${a.detalhe}”` : ''}
                </Texto>
              </View>
            </Pressable>
          ))}
          <Botao
            titulo="Mandar para a família no WhatsApp"
            variante="secundario"
            onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(textoCompartilhar)}`)}
            icone={<MaterialCommunityIcons name="whatsapp" size={20} color={cores.texto} />}
          />
        </Cartao>
      )}

      <Cartao>
        <Texto variante="subtitulo">Ainda por vir</Texto>
        <Texto variante="suave">Toque quando acontecer. A data já vem com hoje.</Texto>
        {porVir.map((p) => (
          <Pressable
            key={p.codigo}
            accessibilityRole="button"
            onPress={() => abrir({ tipo: 'primeira', codigo: p.codigo, titulo: p.titulo, pergunta: p.pergunta })}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: ALVO_TOQUE, opacity: pressed ? 0.7 : 1 })}>
            <MaterialCommunityIcons name="star-four-points-outline" size={22} color={cores.textoSuave} />
            <Texto style={{ flex: 1 }}>{p.titulo}</Texto>
            <MaterialCommunityIcons name="plus" size={22} color={cores.textoSuave} />
          </Pressable>
        ))}
        <Botao titulo="Outro marco" variante="secundario" onPress={() => abrir({ tipo: 'primeira', codigo: null, titulo: '' })} />
      </Cartao>
    </>
  );

  // ---------- Desenvolvimento ----------

  const atual = faixaAtual(meses);
  const proxima = FAIXAS[FAIXAS.indexOf(atual) + 1];
  const daFaixa = (f: number) => DESENVOLVIMENTO.filter((d) => d.faixa === f);
  // Passaram da idade em que costumam aparecer e ainda não foram marcados.
  const paraComentar = DESENVOLVIMENTO.filter((d) => meses >= esperadoAte(d.faixa) && !porCodigo.has(d.codigo));
  const anteriores = FAIXAS.filter((f) => f < atual);

  const item = (d: MarcoDesenvolvimento) => {
    const m = porCodigo.get(d.codigo);
    return (
      <Pressable
        key={d.codigo}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!m }}
        onPress={() => abrir({ tipo: 'desenvolvimento', codigo: d.codigo, titulo: d.titulo, existente: m })}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: ALVO_TOQUE, opacity: pressed ? 0.7 : 1 })}>
        <MaterialCommunityIcons
          name={m ? 'check-circle' : 'checkbox-blank-circle-outline'}
          size={26}
          color={m ? cores.medidasForte : cores.textoSuave}
        />
        <View style={{ flex: 1 }}>
          <Texto>{d.titulo}</Texto>
          <Texto variante="suave">
            {nomeArea[d.area]}
            {m ? ` · ${deISO(m.data)}, com ${idadeNa(m.data)}` : ''}
          </Texto>
        </View>
      </Pressable>
    );
  };

  const desenvolvimento = (
    <>
      <Texto variante="suave">
        Marcos da Caderneta da Criança. Marque quando observar. Cada bebê tem seu ritmo: o que importa é ir avançando.
      </Texto>

      {paraComentar.length > 0 && (
        <Cartao>
          <Texto variante="subtitulo">Para comentar na próxima consulta</Texto>
          <Texto variante="suave">
            Costumam aparecer até esta idade e ainda não foram marcados. Se vocês já viram, é só marcar.
          </Texto>
          {paraComentar.map(item)}
        </Cartao>
      )}

      <Cartao>
        <Texto variante="subtitulo">Nesta fase ({nomeFaixa(atual)})</Texto>
        {daFaixa(atual).filter((d) => !paraComentar.includes(d)).map(item)}
      </Cartao>

      {proxima && (
        <Cartao>
          <Texto variante="subtitulo">Próxima fase ({nomeFaixa(proxima)})</Texto>
          {daFaixa(proxima).map(item)}
        </Cartao>
      )}

      {anteriores.length > 0 &&
        (verAnteriores ? (
          anteriores.map((f) => (
            <Cartao key={f}>
              <Texto variante="subtitulo">{nomeFaixa(f)}</Texto>
              {daFaixa(f).filter((d) => !paraComentar.includes(d)).map(item)}
            </Cartao>
          ))
        ) : (
          <Botao
            titulo={`Ver fases anteriores (${anteriores.length})`}
            variante="secundario"
            onPress={() => setVerAnteriores(true)}
          />
        ))}
    </>
  );

  return (
    <Tela>
      <Cabecalho titulo={`Marcos de ${bebeAtual.nome}`} />
      <Escolha<Aba>
        rotulo="Mostrar"
        opcoes={[
          { valor: 'primeiras', titulo: 'Primeiras vezes' },
          { valor: 'desenvolvimento', titulo: 'Desenvolvimento' },
        ]}
        valor={aba}
        onChange={setAba}
      />

      {aba === 'primeiras' ? primeiras : desenvolvimento}

      <Folha aberta={!!edicao} titulo={edicao?.existente ? 'Editar marco' : edicao?.codigo ? edicao.titulo : 'Novo marco'} onFechar={() => setEdicao(null)}>
        {edicao && (
          <>
            {!edicao.codigo && (
              <Campo rotulo="Marco" value={titulo} onChangeText={setTitulo} placeholder="Ex.: primeira vez que viu a vó" maxLength={120} />
            )}
            <Campo
              rotulo="Quando aconteceu"
              value={data}
              onChangeText={(t) => setData(mascaraData(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={10}
            />
            <Campo
              rotulo={edicao.pergunta ?? 'Observação (opcional)'}
              value={detalhe}
              onChangeText={setDetalhe}
              placeholder={edicao.tipo === 'primeira' ? 'Ex.: riu do cachorro latindo' : 'Ex.: na consulta, a pediatra também viu'}
              maxLength={300}
            />
            <Aviso texto={erro} />
            <Botao titulo={edicao.existente ? 'Salvar' : edicao.tipo === 'desenvolvimento' ? 'Marcar' : 'Aconteceu!'} onPress={salvar} carregando={salvando} />
            {edicao.existente && <Botao titulo="Apagar" variante="texto" onPress={apagar} />}
          </>
        )}
      </Folha>
    </Tela>
  );
}
