-- Categoria "Fantasias e times": roupas de ocasião (festa junina, time, Carnaval, Natal...),
-- contadas à parte para não parecerem roupas do dia a dia.

alter table public.enxoval_itens drop constraint enxoval_itens_categoria_check;
alter table public.enxoval_itens
  add constraint enxoval_itens_categoria_check
  check (categoria in ('roupa', 'especial', 'higiene', 'quarto', 'passeio', 'alimentacao', 'outros'));

alter table public.enxoval_gastos drop constraint enxoval_gastos_categoria_check;
alter table public.enxoval_gastos
  add constraint enxoval_gastos_categoria_check
  check (categoria in ('roupa', 'especial', 'higiene', 'quarto', 'passeio', 'alimentacao', 'outros'));
