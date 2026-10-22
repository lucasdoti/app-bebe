import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Folha } from '@/components/folha';
import { MapaDentes } from '@/components/mapa-dentes';
import { Aviso, Botao, Cabecalho, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { nasceu, useBebes } from '@/context/bebes';
import { useDentes } from '@/context/dentes';
import { confirmar } from '@/lib/confirmar';
import { denteDoCodigo, faixaTexto, nomeDente, proximos, type Dente } from '@/lib/dentes';
import { deISO, hojeISO, idade, mascaraData, paraISO } from '@/lib/idade';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const mesesTexto = (m: number) => (m === 1 ? '1 mês' : `${m} meses`);

// Dentinhos: mapa da boca com a data em que cada dente de leite nasceu. Sem fotos, por privacidade.
export default function Dentinhos() {
  const { bebeAtual } = useBebes();
  const { dentes, recarregar } = useDentes();
  const { cores } = useTema();
  const [aberto, setAberto] = useState<Dente | null>(null);
  const [data, setData] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!nasceu(bebeAtual)) return null;
  const nascimento = bebeAtual.nascimento;

  const porCodigo = new Map(dentes.map((d) => [d.codigo, d]));
  const nascidos = new Set(porCodigo.keys());
  const recente = dentes.at(-1)?.codigo ?? null;
  const proximosDentes = proximos(nascidos).slice(0, 4);
  const idadeEm = (iso: string) => mesesTexto(idade(nascimento, new Date(`${iso}T12:00:00`)).meses);
  const meses = idade(nascimento).meses;

  function abrir(d: Dente) {
    const ja = porCodigo.get(d.codigo);
    setAberto(d);
    setData(deISO(ja?.nasceu_em ?? hojeISO()));
    setObservacao(ja?.observacao ?? '');
    setErro(null);
  }

  async function salvar() {
    if (!aberto) return;
    const iso = paraISO(data);
    if (!iso) return setErro('Data no formato DD/MM/AAAA.');
    if (iso > hojeISO()) return setErro('A data está no futuro.');
    if (iso < nascimento) return setErro(`A data é antes do nascimento (${deISO(nascimento)}).`);
    setSalvando(true);
    setErro(null);
    const ja = porCodigo.get(aberto.codigo);
    const obs = observacao.trim().slice(0, 300) || null;
    const primeiro = dentes.length === 0;
    const { error } = ja
      ? await supabase.from('dentes').update({ nasceu_em: iso, observacao: obs }).eq('id', ja.id)
      : await supabase.from('dentes').insert({ bebe_id: bebeAtual!.id, codigo: aberto.codigo, nasceu_em: iso, observacao: obs });
    setSalvando(false);
    if (error) return setErro(mensagemDeErro(error));
    await recarregar();
    setAberto(null);
    if (primeiro && !ja)
      setAviso('Primeiro dentinho! É a hora de marcar a primeira consulta com o dentista de bebês (odontopediatra).');
  }

  function desmarcar() {
    const ja = aberto && porCodigo.get(aberto.codigo);
    if (!ja) return;
    confirmar('Desmarcar este dente? A data anotada some.', 'Desmarcar', async () => {
      const { error } = await supabase.from('dentes').delete().eq('id', ja.id);
      if (error) return setErro(mensagemDeErro(error));
      await recarregar();
      setAberto(null);
    });
  }

  const marcado = aberto ? porCodigo.get(aberto.codigo) : undefined;

  return (
    <Tela>
      <Cabecalho titulo={`Dentinhos de ${bebeAtual.nome}`} />
      <Texto variante="suave">
        {dentes.length
          ? `${dentes.length} de 20 dentes de leite · o último nasceu em ${deISO(dentes.at(-1)!.nasceu_em)}`
          : 'Toque no dente que nasceu para anotar a data. O desenho é como se você olhasse de frente para o bebê.'}
      </Texto>

      <Aviso texto={aviso} tipo="info" />

      <Cartao>
        <MapaDentes nascidos={nascidos} recente={recente} selecionado={aberto?.codigo ?? null} onEscolher={abrir} />
      </Cartao>

      {dentes.length > 0 && meses < 36 && (
        <View
          style={{ backgroundColor: cores.aviso, borderWidth: 1, borderColor: cores.fralda, borderRadius: 16, padding: 14, gap: 4 }}>
          <Texto style={{ fontFamily: fontes.negrito }}>Primeira consulta no dentista</Texto>
          <Texto>
            A recomendação é levar ao odontopediatra quando nasce o primeiro dente, até 1 ano de idade. Desde o primeiro dente,
            escove com uma escova macia e um pouquinho de creme dental com flúor (do tamanho de um grão de arroz).
          </Texto>
        </View>
      )}

      {proximosDentes.length > 0 && (
        <Cartao>
          <Texto variante="subtitulo">Próximos a nascer</Texto>
          {proximosDentes.map((d) => (
            <Pressable
              key={d.codigo}
              accessibilityRole="button"
              onPress={() => abrir(d)}
              style={({ pressed }) => ({ minHeight: ALVO_TOQUE, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Texto style={{ fontFamily: fontes.negrito }}>{nomeDente(d)}</Texto>
              <Texto variante="suave">{faixaTexto(d)}</Texto>
            </Pressable>
          ))}
        </Cartao>
      )}

      {dentes.length > 0 && (
        <Cartao>
          <Texto variante="subtitulo">Linha do tempo</Texto>
          {dentes.map((n, i) => {
            const d = denteDoCodigo(n.codigo)!;
            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                onPress={() => abrir(d)}
                style={({ pressed }) => ({ minHeight: ALVO_TOQUE, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
                <Texto style={{ fontFamily: fontes.negrito }}>
                  {i + 1}º · {nomeDente(d)}
                </Texto>
                <Texto variante="suave">
                  {deISO(n.nasceu_em)}, com {idadeEm(n.nasceu_em)}
                  {n.observacao ? ` · “${n.observacao}”` : ''}
                </Texto>
              </Pressable>
            );
          })}
        </Cartao>
      )}

      <Texto variante="suave">
        As idades são médias e variar alguns meses é normal. Se nenhum dente nascer até 1 ano e meio, comente com o pediatra.
      </Texto>

      <Folha aberta={!!aberto} titulo={aberto ? nomeDente(aberto) : ''} onFechar={() => setAberto(null)}>
        {aberto && (
          <>
            <Texto variante="suave">
              {marcado ? `Nasceu com ${idadeEm(marcado.nasceu_em)}. ` : ''}
              {faixaTexto(aberto).replace(/^c/, 'C')}.
            </Texto>
            <Campo
              rotulo="Data em que nasceu"
              value={data}
              onChangeText={(t) => setData(mascaraData(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={10}
            />
            <Campo
              rotulo="Observação (opcional)"
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Ex.: babou muito, gengiva inchada desde o dia 10"
              maxLength={300}
            />
            <Aviso texto={erro} />
            <Botao titulo={marcado ? 'Salvar' : 'Nasceu!'} onPress={salvar} carregando={salvando} />
            {marcado && <Botao titulo="Desmarcar este dente" variante="texto" onPress={desmarcar} />}
          </>
        )}
      </Folha>
    </Tela>
  );
}
