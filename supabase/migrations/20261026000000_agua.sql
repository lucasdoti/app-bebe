-- Água: a partir dos 6 meses, registrada em ml como a mamadeira (detalhes: { ml }).
alter table public.registros drop constraint registros_tipo_check;
alter table public.registros
  add constraint registros_tipo_check
  check (tipo in ('mamada', 'mamadeira', 'refeicao', 'agua', 'sono', 'fralda', 'contracao', 'movimentos', 'dose', 'febre'));
