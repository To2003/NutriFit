-- NutriFit · 0009 · Endurecimiento: alimentos propios privados

-- Los alimentos "custom" son de cada usuario: no se listan a otros.
drop policy if exists foods_select on public.foods;
create policy foods_select on public.foods for select to authenticated
  using (source <> 'custom' or created_by = (select auth.uid()));
