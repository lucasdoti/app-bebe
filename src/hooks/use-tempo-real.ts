import { useEffect, useRef } from 'react';

import { supabase } from '@/lib/supabase';
import { exclusaoEhDaFamilia } from '@/lib/tempo-real';

// Recarrega as listas quando o outro celular muda algo nas tabelas indicadas.
// Inserções e edições vêm filtradas por bebê; exclusões não aceitam filtro e são conferidas aqui.
// Tabelas em semFiltro não têm a coluna bebe_id (o RLS continua valendo para inserções e edições).
export function useTempoReal(
  nome: string,
  familiaId: string | null,
  ids: string,
  tabelas: string[],
  recarregar: () => unknown,
  linhas: { id: string }[],
  semFiltro: string[] = [],
) {
  const conhecidos = useRef(new Set<string>());
  useEffect(() => {
    conhecidos.current = new Set(linhas.map((l) => l.id));
  }, [linhas]);

  const listaTabelas = tabelas.join(',');
  const listaSemFiltro = semFiltro.join(',');
  useEffect(() => {
    if (!familiaId || !ids) return;
    const idsBebes = ids.split(',');
    const canal = supabase.channel(`${nome}:${familiaId}`);
    for (const table of listaTabelas.split(',')) {
      const filtro = listaSemFiltro.split(',').includes(table) ? {} : { filter: `bebe_id=in.(${ids})` };
      canal
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, ...filtro }, () => recarregar())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, ...filtro }, () => recarregar())
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, ({ old }) => {
          if (exclusaoEhDaFamilia(old, conhecidos.current, idsBebes)) recarregar();
        });
    }
    canal.subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [nome, familiaId, ids, listaTabelas, listaSemFiltro, recarregar]);
}
