import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Aviso, Botao, Cabecalho, Campo, Escolha, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useRegistros } from '@/context/registros';
import { confirmar } from '@/lib/confirmar';
import { fase } from '@/lib/idade';
import { temposPorLado, type DetalhesFralda, type Lado, type Leite, type Registro, type Tipo } from '@/lib/registros';
import { lerPref } from '@/lib/storage';
import { combinar, diasAtras, horaCurta, mascaraHora, MINUTO, rotuloDia } from '@/lib/tempo';

type LadoForm = Lado | 'ambos';
type Oque = 'xixi' | 'coco' | 'ambos';
type Quantidade = NonNullable<Extract<Registro, { tipo: 'refeicao' }>['detalhes']['quantidade']>;
type Aceitacao = NonNullable<Extract<Registro, { tipo: 'refeicao' }>['detalhes']['aceitacao']>;

const titulos: Record<Tipo, string> = {
  mamada: 'Mamada no peito',
  mamadeira: 'Mamadeira',
  refeicao: 'Refeição',
  sono: 'Sono',
  fralda: 'Fralda',
  contracao: 'Contração',
};

// Hoje e ontem; ao editar um registro mais antigo, o dia dele também aparece.
function opcoesDia(extra: number) {
  const dias = [...new Set([0, 1, extra])].sort((a, b) => a - b);
  return dias.map((d) => ({ valor: String(d), titulo: rotuloDia(d) }));
}

function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

// Dia + hora num campo só, com máscara HH:MM.
function DiaHora({
  rotulo,
  dias,
  dia,
  hora,
  onDia,
  onHora,
}: {
  rotulo: string;
  dias: number;
  dia: string;
  hora: string;
  onDia: (d: string) => void;
  onHora: (h: string) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Escolha rotulo={rotulo} opcoes={opcoesDia(dias)} valor={dia} onChange={onDia} />
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
  const { id, tipo: tipoParam } = useLocalSearchParams<{ id: string; tipo?: Tipo }>();
  const { bebeAtual } = useBebes();
  const { doBebe, criar, atualizar, excluir } = useRegistros();
  const existente = id === 'novo' ? null : (doBebe.find((r) => r.id === id) ?? null);
  const tipo: Tipo = existente?.tipo ?? tipoParam ?? 'mamada';
  const andamento = existente ? existente.fim === null : false;

  const agora = new Date();
  const inicioBase = existente ? new Date(existente.inicio) : new Date(agora.getTime() - 15 * MINUTO);
  const fimBase = existente?.fim ? new Date(existente.fim) : agora;

  const [dia, setDia] = useState(String(diasAtras(inicioBase)));
  const [hora, setHora] = useState(horaCurta(inicioBase));
  const [diaFim, setDiaFim] = useState(String(diasAtras(fimBase)));
  const [horaFim, setHoraFim] = useState(horaCurta(fimBase));
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
  const [ml, setMl] = useState(existente?.tipo === 'mamadeira' ? String(existente.detalhes.ml) : '');
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

  function salvar() {
    setErro(null);
    const inicio = combinar(Number(dia), hora);
    if (!inicio) return setErro('Horário no formato HH:MM, por exemplo 14:05.');
    if (inicio.getTime() > Date.now() + MINUTO) return setErro('O horário está no futuro.');
    const ini = inicio.toISOString();

    // Registro em andamento: só o início muda.
    if (existente && andamento && !(existente.tipo === 'sono' && !aindaDormindo)) {
      if (existente.tipo === 'mamada') {
        const lados = existente.detalhes.lados.map((s, i) => (i === 0 ? { ...s, inicio: ini } : s));
        atualizar(existente.id, { inicio: ini, detalhes: { lados } });
      } else {
        atualizar(existente.id, { inicio: ini });
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
        const f = combinar(Number(diaFim), horaFim);
        if (!f) return setErro('Horário em que acordou no formato HH:MM.');
        if (f <= inicio) return setErro('O fim do sono precisa ser depois do início.');
        if (f.getTime() > Date.now() + MINUTO) return setErro('O horário em que acordou está no futuro.');
        fim = f.toISOString();
      }
    } else if (tipo === 'contracao') {
      // Só o horário muda; a duração medida no cronômetro é mantida.
      const duracaoMs = existente?.fim ? new Date(existente.fim).getTime() - new Date(existente.inicio).getTime() : MINUTO;
      fim = new Date(inicio.getTime() + duracaoMs).toISOString();
    } else {
      const d: DetalhesFralda = { xixi: oque !== 'coco', coco: oque !== 'xixi' };
      if (d.coco && cor) d.cor = cor;
      if (d.coco && consistencia) d.consistencia = consistencia;
      if (penico) d.penico = true;
      detalhes = d;
    }

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
        dias={diasAtras(inicioBase)}
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

      {tipo === 'refeicao' && (
        <>
          <Campo rotulo="O que comeu" value={alimento} onChangeText={setAlimento} placeholder="Ex.: papinha de abóbora" />
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
            <DiaHora rotulo="Acordou" dias={diasAtras(fimBase)} dia={diaFim} hora={horaFim} onDia={setDiaFim} onHora={setHoraFim} />
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
                opcoes={['líquido', 'pastoso', 'firme'].map((c) => ({
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

      <Aviso texto={erro} />
      <Botao titulo="Salvar" onPress={salvar} />
      {existente && <Botao titulo="Apagar registro" variante="texto" onPress={apagar} />}
    </Tela>
  );
}
