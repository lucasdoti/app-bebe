import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { INICIO } from '@/lib/app';
import { AvisoFicha } from '@/components/aviso-ficha';
import { Aviso, Botao, Cabecalho, Campo, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useRegistros } from '@/context/registros';
import { useSaude } from '@/context/saude';
import { confirmar } from '@/lib/confirmar';
import { itensNaLista } from '@/lib/saude';
import { deISO, fase, hojeISO, mascaraData, paraISO } from '@/lib/idade';
import {
  observacaoDe,
  temposPorLado,
  type DetalhesFralda,
  type Lado,
  type Leite,
  type Registro,
  type Tipo,
} from '@/lib/registros';
import { lerPref } from '@/lib/storage';
import { combinar, diasAtras, horaCurta, mascaraHora, MINUTO } from '@/lib/tempo';

type LadoForm = Lado | 'ambos';
type Oque = 'xixi' | 'coco' | 'ambos';
type Quantidade = NonNullable<Extract<Registro, { tipo: 'refeicao' }>['detalhes']['quantidade']>;
type Aceitacao = NonNullable<Extract<Registro, { tipo: 'refeicao' }>['detalhes']['aceitacao']>;

const titulos: Record<Tipo, string> = {
  mamada: 'Mamada no peito',
  mamadeira: 'Mamadeira',
  refeicao: 'Refeição',
  agua: 'Água',
  sono: 'Sono',
  fralda: 'Fralda',
  contracao: 'Contração',
  movimentos: 'Movimentos do bebê',
  dose: 'Dose de remédio',
  febre: 'Temperatura',
};

// Dia do registro: hoje, ontem ou outro dia digitado (DD/MM/AAAA).
type Dia = { opcao: 'hoje' | 'ontem' | 'outro'; data: string };

function diaDe(d: Date): Dia {
  const n = diasAtras(d);
  if (n === 0) return { opcao: 'hoje', data: '' };
  if (n === 1) return { opcao: 'ontem', data: '' };
  return { opcao: 'outro', data: deISO(hojeISO(d)) };
}

// Dias antes de hoje (0 = hoje); null se a data digitada for inválida.
function diasDoDia(d: Dia): number | null {
  if (d.opcao === 'hoje') return 0;
  if (d.opcao === 'ontem') return 1;
  const iso = paraISO(d.data);
  return iso ? diasAtras(new Date(`${iso}T12:00:00`)) : null;
}

function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace(INICIO);
}

// Dia + hora, com máscaras DD/MM/AAAA e HH:MM.
function DiaHora({
  rotulo,
  dia,
  hora,
  onDia,
  onHora,
}: {
  rotulo: string;
  dia: Dia;
  hora: string;
  onDia: (d: Dia) => void;
  onHora: (h: string) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Escolha<Dia['opcao']>
        rotulo={rotulo}
        opcoes={[
          { valor: 'hoje', titulo: 'Hoje' },
          { valor: 'ontem', titulo: 'Ontem' },
          { valor: 'outro', titulo: 'Outro dia' },
        ]}
        valor={dia.opcao}
        onChange={(opcao) => onDia({ ...dia, opcao })}
      />
      {dia.opcao === 'outro' && (
        <Campo
          rotulo="Data"
          value={dia.data}
          onChangeText={(t) => onDia({ ...dia, data: mascaraData(t) })}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={10}
        />
      )}
      <Campo
        rotulo="Horário"
        value={hora}
        onChangeText={(t) => onHora(mascaraHora(t))}
        placeholder="HH:MM"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={5}
      />
    </View>
  );
}

// /registro/novo?tipo=mamada registra algo que já passou; /registro/<id> edita ou apaga.
export default function RegistroForm() {
  // ?data=AAAA-MM-DD vem do histórico ("Registrar algo neste dia").
  const { id, tipo: tipoParam, data: dataParam } = useLocalSearchParams<{ id: string; tipo?: Tipo; data?: string }>();
  const { bebeAtual } = useBebes();
  const saude = useSaude();
  const { doBebe, criar, atualizar, excluir } = useRegistros();
  const existente = id === 'novo' ? null : (doBebe.find((r) => r.id === id) ?? null);
  const tipo: Tipo = existente?.tipo ?? tipoParam ?? 'mamada';
  const andamento = existente ? existente.fim === null : false;

  const agora = new Date();
  // Mamada e sono anteriores costumam ter começado há pouco; fralda e o resto, agora.
  const noDia = !existente && dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam) && dataParam !== hojeISO(agora);
  const inicioBase = existente
    ? new Date(existente.inicio)
    : noDia
      ? new Date(`${dataParam}T12:00:00`)
      : new Date(agora.getTime() - (tipo === 'mamada' || tipo === 'sono' ? 15 * MINUTO : 0));
  const fimBase = existente?.fim
    ? new Date(existente.fim)
    : noDia
      ? new Date(inicioBase.getTime() + 60 * MINUTO)
      : agora;

  const [dia, setDia] = useState<Dia>(diaDe(inicioBase));
  const [hora, setHora] = useState(noDia ? '' : horaCurta(inicioBase));
  const [diaFim, setDiaFim] = useState<Dia>(diaDe(fimBase));
  const [horaFim, setHoraFim] = useState(noDia ? '' : horaCurta(fimBase));
  const [erro, setErro] = useState<string | null>(null);

  // Peito
  const tempos = existente?.tipo === 'mamada' ? temposPorLado(existente.detalhes) : null;
  const [lado, setLado] = useState<LadoForm>(
    tempos ? (tempos.E && tempos.D ? 'ambos' : tempos.D ? 'D' : 'E') : 'E',
  );
  const [minutos, setMinutos] = useState(
    tempos ? String(Math.round((tempos.E + tempos.D) / MINUTO)) : '15',
  );

  // Mamadeira
  const [ml, setMl] = useState(
    existente?.tipo === 'mamadeira' || existente?.tipo === 'agua' ? String(existente.detalhes.ml) : '',
  );
  const [leite, setLeite] = useState<Leite>(
    existente?.tipo === 'mamadeira' ? existente.detalhes.leite : ((lerPref('leite_preferido') as Leite) ?? 'materno'),
  );

  // Refeição
  const refeicao = existente?.tipo === 'refeicao' ? existente.detalhes : null;
  const [alimento, setAlimento] = useState(refeicao?.alimento ?? '');
  const [quantidade, setQuantidade] = useState<Quantidade | null>(refeicao?.quantidade ?? null);
  const [aceitacao, setAceitacao] = useState<Aceitacao | null>(refeicao?.aceitacao ?? null);
  const recentes = [
    ...new Set(doBebe.flatMap((r) => (r.tipo === 'refeicao' ? [r.detalhes.alimento] : [])).slice(0, 12)),
  ].slice(0, 6);

  // Fralda
  const fralda = existente?.tipo === 'fralda' ? existente.detalhes : null;
  const [oque, setOque] = useState<Oque>(
    fralda ? (fralda.xixi && fralda.coco ? 'ambos' : fralda.coco ? 'coco' : 'xixi') : 'xixi',
  );
  const [cor, setCor] = useState<string | null>(fralda?.cor ?? null);
  const [consistencia, setConsistencia] = useState<string | null>(fralda?.consistencia ?? null);
  const [penico, setPenico] = useState(fralda?.penico ?? false);
  const mostraPenico = penico || (bebeAtual?.nascimento ? fase(bebeAtual.nascimento) === 'crianca' : false);

  // Sono
  const [aindaDormindo, setAindaDormindo] = useState(andamento);

  // Comentário livre, em qualquer tipo de registro (fica junto dos detalhes).
  const [observacao, setObservacao] = useState(observacaoDe(existente) ?? '');
  const comObservacao = <T extends object>(d: T): T => {
    const { observacao: _antiga, ...resto } = d as T & { observacao?: string };
    return (observacao.trim() ? { ...resto, observacao: observacao.trim().slice(0, 300) } : resto) as T;
  };

  // Refeição com alimento da lista "a evitar" ou das alergias: avisa e pede confirmação.
  const alimentoNaLista =
    tipo === 'refeicao' ? [...itensNaLista(alimento, saude.alimentosEvitar), ...itensNaLista(alimento, saude.alergias)] : [];

  function salvar() {
    if (alimentoNaLista.length)
      return confirmar(
        `Atenção: "${alimento.trim()}" parece estar na ficha de saúde (${alimentoNaLista.map((i) => i.nome).join(', ')}). Registrar mesmo assim?`,
        'Registrar',
        gravar,
      );
    gravar();
  }

  function gravar() {
    setErro(null);
    const dias = diasDoDia(dia);
    if (dias === null) return setErro('Data no formato DD/MM/AAAA, por exemplo 05/10/2026.');
    const inicio = combinar(dias, hora);
    if (!inicio) return setErro('Horário no formato HH:MM, por exemplo 14:05.');
    if (inicio.getTime() > Date.now() + MINUTO) return setErro('O dia e o horário estão no futuro.');
    if (bebeAtual?.nascimento && hojeISO(inicio) < bebeAtual.nascimento && !existente)
      return setErro(`A data é antes do nascimento (${deISO(bebeAtual.nascimento)}).`);
    const ini = inicio.toISOString();

    // Registro em andamento: só o início muda.
    if (existente && andamento && !(existente.tipo === 'sono' && !aindaDormindo)) {
      if (existente.tipo === 'mamada') {
        const lados = existente.detalhes.lados.map((s, i) => (i === 0 ? { ...s, inicio: ini } : s));
        atualizar(existente.id, { inicio: ini, detalhes: comObservacao({ ...existente.detalhes, lados }) });
      } else {
        atualizar(existente.id, { inicio: ini, detalhes: comObservacao(existente.detalhes) } as Partial<Registro>);
      }
      return voltar();
    }

    let fim: string | null = ini;
    let detalhes: Registro['detalhes'] = {};

    if (tipo === 'mamada') {
      const min = Number(minutos.replace(',', '.'));
      if (!(min > 0 && min <= 180)) return setErro('Duração em minutos, entre 1 e 180.');
      const total = min * MINUTO;
      const termino = new Date(inicio.getTime() + total).toISOString();
      fim = termino;
      const meio = new Date(inicio.getTime() + total / 2).toISOString();
      detalhes = {
        lados:
          lado === 'ambos'
            ? [
                { lado: 'E', inicio: ini, fim: meio },
                { lado: 'D', inicio: meio, fim: termino },
              ]
            : [{ lado, inicio: ini, fim: termino }],
      };
    } else if (tipo === 'mamadeira') {
      const n = Number(ml);
      if (!(n > 0 && n <= 500)) return setErro('Volume em ml, entre 1 e 500.');
      detalhes = { ml: n, leite };
    } else if (tipo === 'agua') {
      const n = Number(ml);
      if (!(n > 0 && n <= 500)) return setErro('Quantidade em ml, entre 1 e 500.');
      detalhes = { ml: n };
    } else if (tipo === 'refeicao') {
      if (!alimento.trim()) return setErro('O que o bebê comeu?');
      detalhes = {
        alimento: alimento.trim(),
        ...(quantidade && { quantidade }),
        ...(aceitacao && { aceitacao }),
      };
    } else if (tipo === 'sono') {
      if (aindaDormindo) {
        fim = null;
      } else {
        const diasFim = diasDoDia(diaFim);
        if (diasFim === null) return setErro('Data em que acordou no formato DD/MM/AAAA.');
        const f = combinar(diasFim, horaFim);
        if (!f) return setErro('Horário em que acordou no formato HH:MM.');
        if (f <= inicio) return setErro('O fim do sono precisa ser depois do início.');
        if (f.getTime() > Date.now() + MINUTO) return setErro('O horário em que acordou está no futuro.');
        fim = f.toISOString();
      }
    } else if (tipo === 'contracao' || tipo === 'movimentos' || tipo === 'dose' || tipo === 'febre') {
      // Só o horário muda; a duração medida no cronômetro (e a contagem) é mantida.
      const duracaoMs = existente?.fim ? new Date(existente.fim).getTime() - new Date(existente.inicio).getTime() : MINUTO;
      fim = new Date(inicio.getTime() + duracaoMs).toISOString();
      detalhes = existente?.detalhes ?? {};
    } else {
      const d: DetalhesFralda = { xixi: oque !== 'coco', coco: oque !== 'xixi' };
      if (d.coco && cor) d.cor = cor;
      if (d.coco && consistencia) d.consistencia = consistencia;
      if (penico) d.penico = true;
      detalhes = d;
    }

    detalhes = comObservacao(detalhes);
    if (existente) atualizar(existente.id, { inicio: ini, fim, detalhes } as Partial<Registro>);
    else criar({ tipo, inicio: ini, fim, detalhes } as Parameters<typeof criar>[0]);
    voltar();
  }

  function apagar() {
    if (!existente) return;
    confirmar('Apagar este registro?', 'Apagar', () => {
      excluir(existente.id);
      voltar();
    });
  }

  if (id !== 'novo' && !existente) {
    return (
      <Tela>
        <Cabecalho titulo="Registro" />
        <Texto variante="suave">Registro não encontrado. Ele pode ter sido apagado no outro celular.</Texto>
      </Tela>
    );
  }

  const soInicio = andamento && !(tipo === 'sono' && !aindaDormindo);

  return (
    <Tela>
      <Cabecalho titulo={existente ? titulos[tipo] : `${titulos[tipo]} anterior`} />
      {andamento && (
        <Texto variante="suave">Em andamento. Para encerrar, use o botão na tela inicial.</Texto>
      )}

      <DiaHora
        rotulo={tipo === 'sono' ? 'Dormiu' : 'Quando'}
        dia={dia}
        hora={hora}
        onDia={setDia}
        onHora={setHora}
      />

      {!soInicio && tipo === 'mamada' && (
        <>
          <Escolha<LadoForm>
            rotulo="Peito"
            opcoes={[
              { valor: 'E', titulo: 'Esquerdo' },
              { valor: 'D', titulo: 'Direito' },
              { valor: 'ambos', titulo: 'Os dois' },
            ]}
            valor={lado}
            onChange={setLado}
          />
          <Campo
            rotulo="Duração (minutos)"
            value={minutos}
            onChangeText={setMinutos}
            keyboardType="number-pad"
            inputMode="numeric"
          />
        </>
      )}

      {tipo === 'mamadeira' && (
        <>
          <Campo
            rotulo="Volume (ml)"
            value={ml}
            onChangeText={setMl}
            placeholder="Ex.: 120"
            keyboardType="number-pad"
            inputMode="numeric"
          />
          <Escolha<Leite>
            rotulo="Leite"
            opcoes={[
              { valor: 'materno', titulo: 'Materno' },
              { valor: 'formula', titulo: 'Fórmula' },
            ]}
            valor={leite}
            onChange={setLeite}
          />
        </>
      )}

      {tipo === 'agua' && (
        <Campo
          rotulo="Quantidade de água (ml)"
          value={ml}
          onChangeText={setMl}
          placeholder="Ex.: 50"
          keyboardType="number-pad"
          inputMode="numeric"
        />
      )}

      {tipo === 'refeicao' && (
        <>
          <Campo rotulo="O que comeu" value={alimento} onChangeText={setAlimento} placeholder="Ex.: papinha de abóbora" />
          {alimentoNaLista.length > 0 && (
            <AvisoFicha texto={`Está na ficha de saúde: ${alimentoNaLista.map((i) => i.nome).join(', ')}.`} />
          )}
          {recentes.length > 0 && (
            <Escolha
              rotulo="Recentes"
              opcoes={recentes.slice(0, 3).map((a) => ({ valor: a, titulo: a }))}
              valor={alimento}
              onChange={setAlimento}
            />
          )}
          <Escolha<Quantidade>
            rotulo="Quanto comeu (opcional)"
            opcoes={[
              { valor: 'pouco', titulo: 'Pouco' },
              { valor: 'metade', titulo: 'Metade' },
              { valor: 'tudo', titulo: 'Tudo' },
            ]}
            valor={quantidade}
            onChange={setQuantidade}
            aoLimpar={() => setQuantidade(null)}
          />
          <Escolha<Aceitacao>
            rotulo="Aceitação (opcional)"
            opcoes={[
              { valor: 'gostou', titulo: 'Gostou' },
              { valor: 'normal', titulo: 'Normal' },
              { valor: 'recusou', titulo: 'Recusou' },
            ]}
            valor={aceitacao}
            onChange={setAceitacao}
            aoLimpar={() => setAceitacao(null)}
          />
        </>
      )}

      {tipo === 'sono' && (
        <>
          <Escolha
            rotulo="Situação"
            opcoes={[
              { valor: 'nao', titulo: 'Já acordou' },
              { valor: 'sim', titulo: 'Ainda dormindo' },
            ]}
            valor={aindaDormindo ? 'sim' : 'nao'}
            onChange={(v) => setAindaDormindo(v === 'sim')}
          />
          {!aindaDormindo && (
            <DiaHora rotulo="Acordou" dia={diaFim} hora={horaFim} onDia={setDiaFim} onHora={setHoraFim} />
          )}
        </>
      )}

      {tipo === 'fralda' && (
        <>
          <Escolha<Oque>
            rotulo="O que tinha"
            opcoes={[
              { valor: 'xixi', titulo: 'Xixi' },
              { valor: 'coco', titulo: 'Cocô' },
              { valor: 'ambos', titulo: 'Os dois' },
            ]}
            valor={oque}
            onChange={setOque}
          />
          {oque !== 'xixi' && (
            <>
              <Escolha
                rotulo="Cor do cocô (opcional)"
                opcoes={['amarelo', 'verde', 'marrom', 'escuro'].map((c) => ({
                  valor: c,
                  titulo: c[0].toUpperCase() + c.slice(1),
                }))}
                valor={cor}
                onChange={setCor}
                aoLimpar={() => setCor(null)}
              />
              <Escolha
                rotulo="Consistência (opcional)"
                opcoes={['líquido', 'mole', 'pastoso', 'duro'].map((c) => ({
                  valor: c,
                  titulo: c[0].toUpperCase() + c.slice(1),
                }))}
                valor={consistencia}
                onChange={setConsistencia}
                aoLimpar={() => setConsistencia(null)}
              />
            </>
          )}
          {mostraPenico && (
            <Escolha
              rotulo="Onde"
              opcoes={[
                { valor: 'fralda', titulo: 'Na fralda' },
                { valor: 'penico', titulo: 'No penico' },
              ]}
              valor={penico ? 'penico' : 'fralda'}
              onChange={(v) => setPenico(v === 'penico')}
            />
          )}
        </>
      )}

      <Campo
        rotulo="Observação (opcional)"
        value={observacao}
        onChangeText={setObservacao}
        placeholder={
          tipo === 'fralda'
            ? 'Ex.: assadura leve, cocô com muco, xixi escuro'
            : tipo === 'sono'
              ? 'Ex.: acordou chorando, dormiu no colo'
              : tipo === 'mamada' || tipo === 'mamadeira'
                ? 'Ex.: regurgitou, pegou bem o peito'
                : tipo === 'agua'
                  ? 'Ex.: no copinho de transição, recusou'
                  : 'O que quiser anotar'
        }
        multiline
        maxLength={300}
        style={{ minHeight: 80, paddingTop: 14, textAlignVertical: 'top' }}
      />

      <Aviso texto={erro} />
      <Botao titulo="Salvar" onPress={salvar} />
      {existente && <Botao titulo="Apagar registro" variante="texto" onPress={apagar} />}
    </Tela>
  );
}
