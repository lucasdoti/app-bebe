import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Bonequinho } from '@/components/bonequinho';
import { Aviso, Botao, Cabecalho, Campo, Cartao, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useClima } from '@/context/clima';
import { useRoupa } from '@/context/roupa';
import { useSugestao } from '@/hooks/use-sugestao';
import { buscarCidades, descricaoTempo, type Cidade } from '@/lib/clima';
import { nomePeca, type Contexto, type Transporte } from '@/lib/roupa';
import { lerPref, salvarPref } from '@/lib/storage';
import { horaCurta } from '@/lib/tempo';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const graus = (t: number) => `${Math.round(t)}°`;

function quandoTexto(d: Date) {
  const hoje = new Date();
  const amanha = d.getDate() !== hoje.getDate();
  return `${amanha ? 'amanhã ' : ''}às ${horaCurta(d)}`;
}

export default function Roupa() {
  const { bebeAtual } = useBebes();
  const { clima, local, carregando, erro, usarLocalizacao, escolherCidade, atualizar } = useClima();
  const { vouUsar } = useRoupa();
  const { cores } = useTema();

  const [contexto, setContextoState] = useState<Contexto>(() => (lerPref('roupa_contexto') as Contexto) || 'casa');
  const [transporte, setTransporteState] = useState<Transporte>(
    () => (lerPref('roupa_transporte') as Transporte) || 'carrinho',
  );
  const [quarto, setQuarto] = useState(() => lerPref('temp_quarto') ?? '');
  const [busca, setBusca] = useState('');
  const [cidades, setCidades] = useState<Cidade[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const tempQuarto = quarto.trim() ? Number(quarto.replace(',', '.')) : null;
  const quartoValido = tempQuarto !== null && Number.isFinite(tempQuarto) && tempQuarto >= 5 && tempQuarto <= 40;
  const sugestao = useSugestao(contexto, transporte, quartoValido ? tempQuarto : null);

  function setContexto(c: Contexto) {
    setContextoState(c);
    salvarPref('roupa_contexto', c);
    setAviso(null);
  }
  function setTransporte(t: Transporte) {
    setTransporteState(t);
    salvarPref('roupa_transporte', t);
  }

  async function procurar() {
    if (!busca.trim()) return;
    setBuscando(true);
    try {
      setCidades(await buscarCidades(busca.trim()));
    } catch {
      setCidades([]);
    } finally {
      setBuscando(false);
    }
  }

  if (!bebeAtual) return null;
  const tempo = clima && descricaoTempo(clima.atual.codigo, clima.atual.dia);

  return (
    <Tela>
      <Cabecalho titulo={`O que vestir em ${bebeAtual.nome}`} />

      {clima && tempo ? (
        <Cartao style={{ backgroundColor: cores.clima, borderColor: cores.clima }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <MaterialCommunityIcons name={tempo.icone} size={44} color={cores.textoNaPrimaria} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontes.extra, fontSize: 36, lineHeight: 42, color: cores.textoNaPrimaria }}>
                {graus(clima.atual.temp)}
              </Text>
              <Text style={{ fontFamily: fontes.media, fontSize: 15, color: cores.textoNaPrimaria }}>
                Sensação {graus(clima.atual.sensacao)} · {tempo.texto}
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: fontes.regular, fontSize: 14, color: cores.textoNaPrimaria }}>
            {local?.nome ?? 'Sua localização'} · vento {Math.round(clima.atual.vento)} km/h · umidade{' '}
            {clima.atual.umidade}% · atualizado às {horaCurta(new Date(clima.obtidoEm))}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {clima.horas.slice(1, 7).map((h) => {
              const t = descricaoTempo(h.codigo);
              return (
                <View key={h.hora} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontFamily: fontes.media, fontSize: 12, color: cores.textoNaPrimaria }}>
                    {h.hora.replace(':00', 'h')}
                  </Text>
                  <MaterialCommunityIcons name={t.icone} size={20} color={cores.textoNaPrimaria} />
                  <Text style={{ fontFamily: fontes.negrito, fontSize: 14, color: cores.textoNaPrimaria }}>
                    {graus(h.sensacao)}
                  </Text>
                  {h.chuvaProb >= 30 && (
                    <Text style={{ fontFamily: fontes.regular, fontSize: 11, color: cores.textoNaPrimaria }}>
                      {h.chuvaProb}%
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
          <Texto variante="suave" style={{ color: cores.textoNaPrimaria }}>
            Temperaturas por hora: sensação térmica.
          </Texto>
        </Cartao>
      ) : (
        <Cartao>
          <Texto variante="subtitulo">Clima de onde vocês estão</Texto>
          <Texto variante="suave">
            A sugestão de roupa usa a sensação térmica e a previsão das próximas 6 horas.
          </Texto>
        </Cartao>
      )}

      <Aviso texto={erro} />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Botao
            titulo={clima ? 'Atualizar' : 'Usar localização'}
            variante="secundario"
            carregando={carregando}
            onPress={clima && local ? atualizar : usarLocalizacao}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Botao titulo="Escolher cidade" variante="secundario" onPress={() => setMostrarBusca(!mostrarBusca)} />
        </View>
      </View>
      {clima && local?.nome && (
        <Botao titulo="Voltar a usar a localização do celular" variante="texto" onPress={usarLocalizacao} />
      )}

      {mostrarBusca && (
        <Cartao>
          <Campo
            rotulo="Cidade"
            value={busca}
            onChangeText={setBusca}
            placeholder="Ex.: Campinas"
            onSubmitEditing={procurar}
            returnKeyType="search"
          />
          <Botao titulo="Buscar" variante="secundario" onPress={procurar} carregando={buscando} />
          {cidades?.length === 0 && <Texto variante="suave">Nenhuma cidade encontrada.</Texto>}
          {cidades?.map((c) => (
            <Pressable
              key={`${c.lat},${c.lon}`}
              accessibilityRole="button"
              onPress={() => {
                escolherCidade(c);
                setMostrarBusca(false);
                setCidades(null);
              }}
              style={({ pressed }) => ({ minHeight: ALVO_TOQUE, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Texto style={{ fontFamily: fontes.negrito }}>{c.nome}</Texto>
              <Texto variante="suave">{c.regiao}</Texto>
            </Pressable>
          ))}
        </Cartao>
      )}

      <Escolha<Contexto>
        rotulo="Onde o bebê vai estar"
        opcoes={[
          { valor: 'casa', titulo: 'Em casa' },
          { valor: 'passeio', titulo: 'Passeio' },
          { valor: 'sono', titulo: 'Dormindo' },
        ]}
        valor={contexto}
        onChange={setContexto}
      />
      {contexto === 'passeio' && (
        <Escolha<Transporte>
          rotulo="Como"
          opcoes={[
            { valor: 'carrinho', titulo: 'Carrinho' },
            { valor: 'sling', titulo: 'Sling/colo' },
            { valor: 'carro', titulo: 'Carro' },
          ]}
          valor={transporte}
          onChange={setTransporte}
        />
      )}
      {contexto === 'sono' && (
        <Campo
          rotulo="Temperatura do quarto (°C)"
          value={quarto}
          onChangeText={(t) => {
            setQuarto(t);
            salvarPref('temp_quarto', t);
          }}
          placeholder="Ex.: 22"
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
      )}

      {sugestao ? (
        <Cartao>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Bonequinho pecas={sugestao.pecas} tamanho={110} />
            <View style={{ flex: 1, gap: 4 }}>
              <Texto variante="rotulo">Sugestão</Texto>
              {contexto === 'sono' && <Texto style={{ fontFamily: fontes.extra }}>{sugestao.titulo}</Texto>}
              {sugestao.pecas.map((p) => (
                <Texto key={p} style={{ fontFamily: fontes.negrito }}>
                  · {nomePeca[p]}
                </Texto>
              ))}
            </View>
          </View>
          {sugestao.avisos.map((a) => (
            <View
              key={a}
              style={{ flexDirection: 'row', gap: 8, backgroundColor: cores.fralda, borderRadius: 14, padding: 12 }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={cores.textoNaPrimaria} />
              <Text style={{ flex: 1, fontFamily: fontes.media, fontSize: 15, color: cores.textoNaPrimaria }}>{a}</Text>
            </View>
          ))}
          {sugestao.motivos.map((m) => (
            <Texto key={m} variante="suave">
              {m}
            </Texto>
          ))}
          <Texto variante="suave">
            Sugestão, não regra. Para saber se está bom, sinta a nuca e o peito do bebê: devem estar mornos, sem suor.
          </Texto>
          <Botao
            titulo="Vou vestir assim"
            onPress={() => {
              const quando = vouUsar({
                bebeId: bebeAtual.id,
                contexto,
                sensacao: contexto === 'sono' && tempQuarto !== null ? tempQuarto : clima!.atual.sensacao,
                sugestao: sugestao.titulo,
              });
              setAviso(`Combinado. ${quandoTexto(quando)} pergunto como ${bebeAtual.nome} ficou.`);
            }}
          />
          <Aviso texto={aviso} tipo="info" />
        </Cartao>
      ) : (
        clima &&
        contexto === 'sono' && (
          <Texto variante="suave">Informe a temperatura do quarto para ver o saco de dormir indicado.</Texto>
        )
      )}
    </Tela>
  );
}
