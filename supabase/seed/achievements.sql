-- NutriFit · logros. Generado por `pnpm db:seeds`. Idempotente.
insert into public.achievements (code, name, description, emoji, sort)
values
  ('first_log', 'Arrancó el partido', 'Cargaste tu primera comida.', '🍽️', 0),
  ('first_workout', 'Primer entreno', 'Registraste tu primera sesión de gym.', '🏋️', 1),
  ('streak_7', 'Una semana al hilo', '7 días seguidos cargando al menos 3 comidas.', '🔥', 2),
  ('streak_30', 'Un mes imparable', '30 días seguidos cargando al menos 3 comidas.', '🏆', 3),
  ('water_7', 'Camello', '7 días seguidos cumpliendo el agua.', '💧', 4),
  ('protein_7', 'Proteína al día', '7 días seguidos llegando a la proteína.', '🥚', 5),
  ('first_pr', 'Récord personal', 'Superaste tu mejor 1RM estimado en un ejercicio.', '📈', 6),
  ('training_week', 'Semana completa', 'Cumpliste todas las sesiones planificadas de la semana.', '✅', 7),
  ('meso_complete', 'Mesociclo completo', 'Terminaste un mesociclo de 4 semanas.', '🎯', 8),
  ('jump_plus_3', 'Resorte', '+3 cm de salto vertical (CMJ) desde tu primer test.', '🦘', 9),
  ('jump_plus_5', 'Te sale volando', '+5 cm de salto vertical (CMJ) desde tu primer test.', '🚀', 10),
  ('four_weeks_logging', 'Cuatro semanas cargando', 'Cargaste comidas al menos 5 días por semana durante 4 semanas.', '📒', 11),
  ('first_test', 'Medido y pesado', 'Hiciste tu primer test físico.', '⏱️', 12)
on conflict (code) do update set name = excluded.name, description = excluded.description, emoji = excluded.emoji, sort = excluded.sort;
