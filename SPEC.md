# SPEC — "Rinde" (nombre provisional)
Diario nutricional + calculadora + generador de rutinas, con un agente IA que hace de nutricionista deportivo y preparador físico.

---

## 1. Visión

App web mobile-first (PWA) para deportistas amateurs que quieren **bajar grasa, comer mejor y rendir más en su deporte**.
El usuario carga lo que come, el agua que toma y el ejercicio que hace; la app calcula todo y un agente IA le devuelve feedback, le arma la rutina de gimnasio según su deporte y su foco (salto, potencia, stamina, etc.) y le ajusta los objetivos semana a semana.

- **Usuarios:** Toto (punta de vóley, también juega hockey) + amigos y jugadores. Multiusuario real desde el día 1.
- **Idioma y tono:** todo en español rioplatense informal ("vos", "che"). La UI y el agente hablan como un amigo que sabe, con humor, nunca culpabilizando.
- **Disclaimer visible:** la app no reemplaza a un médico, nutricionista ni deportólogo.

---

## 2. Fechas clave

| Fecha | Qué tiene que estar |
|---|---|
| **29/11** | Usable para arrancar el gimnasio: login, onboarding, objetivos, diario (comida/agua/peso), rutina generada y registro de sesiones |
| **30/11 → 13/12** | Pruebas reales con uso diario; se suman agente, push, social |
| **17/12** | App completa según este spec |

Detalle por hitos en la sección 15.

---

## 3. Stack

| Capa | Elección | Notas |
|---|---|---|
| Front + API | **Next.js (App Router) + TypeScript** | Server Actions / Route Handlers para lógica de servidor |
| UI | **Tailwind + shadcn/ui** | Mobile-first (diseñar a 375px), modo oscuro por defecto |
| Gráficos | **Recharts** | |
| PWA | Manifest + service worker (**Serwist**) | Instalable, íconos, splash, push |
| DB / Auth / Storage | **Supabase** (plan gratis) | Postgres + RLS, Google OAuth, Storage privado para fotos |
| IA | **Gemini API (free tier)** con SDK oficial `@google/genai` | Modelo en env var `GEMINI_MODEL` (usar el Flash vigente con soporte de imágenes). Todo detrás de `lib/ai/provider.ts` para poder cambiar a Claude u otro después |
| Validación | **zod** | Toda salida de la IA se valida con schema |
| Push | **Web Push (VAPID)** con librería `web-push` | |
| Cron | **pg_cron + pg_net de Supabase** cada 15 min → llama a `/api/cron/*` con `CRON_SECRET` | El cron de Vercel Hobby es solo diario, no alcanza |
| Alimentos | Base local argentina (seed) + **Open Food Facts** (sin key) + **USDA FoodData Central** (key gratis) | |
| Tests | **Vitest** para lógica de cálculo; tests de RLS | |
| Deploy | **Vercel Hobby** + GitHub (usuario To2003) | Sin tarjeta de crédito en ningún servicio |

---

## 4. Auth y onboarding

### Login
- Solo **Google** (Supabase Auth). Al primer login se crea `profiles` y se manda al onboarding.

### Onboarding — formulario por pasos (barra de progreso, se puede volver atrás, todo editable después en Perfil)
1. **Datos básicos:** nombre, @username (único), fecha de nacimiento, sexo (para las fórmulas), altura (cm), peso (kg).
2. **Objetivo:** bajar grasa / recomposición / mantener / ganar músculo / solo rendimiento. Ritmo para bajar: tranqui (0,25–0,5 % del peso/semana), moderado (0,5–0,75 %), rápido (hasta 1 %).
3. **Estilo de vida (sin contar entrenos):** mayormente sentado / mixto / mucho de pie / laburo físico.
4. **Deportes:** multi-selección (vóley, hockey, fútbol, básquet, handball, rugby, pádel/tenis, running, natación, otro) + posición (ej. vóley: punta, armador, central, opuesto, líbero) + nivel (recreativo / amateur competitivo / federado).
5. **Agenda semanal fija:** por cada día, actividades: deporte, tipo (entreno / partido), hora, duración, intensidad (suave / moderada / intensa). Ej. Toto: mar/jue vóley, mié/vie hockey, sáb partido vóley, dom hockey.
6. **Gimnasio:** días disponibles, minutos por sesión, equipamiento disponible (checklist: barras, mancuernas, máquinas, poleas, trap bar, cajón, bandas, etc.; por defecto "gym completo"), experiencia (principiante / intermedio / avanzado), molestias o lesiones (texto libre).
7. **Foco de la rutina:** principal + secundario (ver 7.2).
8. **Alimentación:** tipo (omnívoro / vegetariano / vegano / otro), comidas por día, alimentos que no le gustan, alergias o intolerancias (privado), tiempo para cocinar (poco / normal / mucho).
9. **Recordatorios:** activar push y elegir cuáles (sección 11). Si es iPhone: explicar que hay que agregar la app a la pantalla de inicio (iOS 16.4+).
10. **Privacidad:** cuenta pública o privada + qué secciones mostrar (sección 10).

Final: pantalla **"Tus objetivos"** con kcal por tipo de día, macros, agua, explicado en criollo y con opción de ajustar a mano.

**Menores de 18:** no se ofrece el objetivo "bajar grasa" (solo rendimiento/mantener con foco en hábitos), la cuenta queda privada y peso/medidas nunca son públicos.

---

## 5. Motor de cálculos (`lib/calc/` — determinístico, puro, 100 % testeado)

La IA **nunca** calcula los objetivos: los calcula este módulo. La IA solo interpreta, sugiere y explica.

### 5.1 Metabolismo basal — Mifflin-St Jeor
- Hombre: `10·kg + 6,25·cm − 5·edad + 5`
- Mujer: `10·kg + 6,25·cm − 5·edad − 161`

### 5.2 Gasto diario por tipo de día
`gasto_dia = BMR × factor_estilo_vida + gasto_ejercicio_del_día`

- Factor estilo de vida (sin ejercicio): sentado 1,2 · mixto 1,3 · de pie 1,4 · físico 1,5.
- Gasto de ejercicio: `(MET − 1) × kg × horas` (se resta el MET de reposo para no contarlo dos veces).
- Para el objetivo del día se usa lo **registrado** si existe; si no, lo **planificado** en la agenda.
- Tabla MET inicial (`lib/calc/mets.ts`, valores de referencia del Compendium of Physical Activities, revisar):
  - Vóley entreno moderado 4 · intenso/partido 6 · vóley playa 8
  - Hockey sobre césped entreno 6 · partido 7,8
  - Fútbol 7 · básquet 6,5 · running 8 km/h ≈ 8,3 · bici moderada 6,8 · caminata 3,5
  - Gimnasio pesas moderado 3,5 · intenso 6

### 5.3 Objetivo calórico
- Déficit diario = `ritmo_kg_semana × 7700 / 7`.
- Tope: déficit máximo 25 % del gasto del día.
- Piso: nunca por debajo de `max(BMR, 1500)` hombres / `max(BMR, 1200)` mujeres.
- Resultado: kcal distintas según el día (descanso / entreno / partido). Los carbohidratos absorben la diferencia → más carbos los días de partido.

### 5.4 Macros
- Proteína: 2,0 g/kg en déficit · 1,8 g/kg en mantener/ganar.
- Grasa: 0,8 g/kg (mínimo 20 % de las kcal).
- Carbohidratos: el resto.

### 5.5 Agua
`35 ml × kg + 600 ml por hora de actividad del día`.

### 5.6 TDEE adaptativo (revisión semanal, a partir de la semana 3)
- Peso de tendencia: media móvil exponencial (α ≈ 0,1) de los pesajes.
- Solo si hay ≥ 10 días con registro completo en los últimos 14.
- `gasto_real ≈ ingesta_promedio − (Δpeso_tendencia_kg × 7700 / días)`.
- Nuevo valor = promedio entre el estimado anterior y el observado. Cambio máximo del objetivo: ±200 kcal por semana. El usuario acepta o rechaza el ajuste.

### 5.7 Fuerza
- 1RM estimado (Epley): `kg × (1 + reps/30)`.
- Volumen: `Σ series × reps × kg` por sesión, por semana y por grupo muscular.

### 5.8 Rachas (ver sección 12).

**Tests Vitest obligatorios** para cada función de este módulo con casos borde (pisos, topes, menores, días sin datos).

---

## 6. Diario

Botón central **"+"** con: Comida · Agua · Peso · Actividad.

### 6.1 Comida
Momentos: desayuno · almuerzo · merienda · cena · colación.

**Tres formas de cargar:**
1. **Texto libre:** "2 empanadas de carne al horno y una coca chica".
2. **Foto del plato:** se sube a Storage privado y se manda a Gemini.
3. **Buscador:** base local + Open Food Facts + USDA, con "Recientes" y "Frecuentes" arriba; también escaneo de código de barras opcional (fase 2).

**Flujo IA (texto o foto):**
1. Gemini devuelve JSON validado con zod: `[{nombre, cantidad, unidad, gramos_estimados, kcal, proteina, carbos, grasa, confianza}]`.
2. Se intenta matchear cada ítem con la base de alimentos; si matchea, se usan esos valores × gramos; si no, quedan los estimados de la IA marcados como `fuente: "estimado IA"`.
3. **Pantalla de confirmación siempre:** cada ítem editable (gramos con presets de porción: "1 unidad", "1 plato", "100 g"), borrar o agregar ítems. Nada se guarda sin confirmar.
4. Al guardar → feedback corto del agente (sección 8).

**Base local argentina (`supabase/seed/foods_ar.sql`):** ~150 alimentos típicos con valores por 100 g y por porción típica: empanadas (carne, jyq, pollo), milanesa (frita/al horno, carne/pollo), medialunas, facturas, tostado jyq, pan francés, galletitas de agua, mate cocido, dulce de leche, alfajor, choripán, asado (tira, vacío, matambre), pizza muzza (porción), fainá, fideos, ñoquis, arroz, tarta de jyq, ensalada mixta, guiso de lentejas, milanesa napolitana, fernet con coca, cerveza, gaseosas, frutas, lácteos, etc. Valores tomados de tablas de referencia; marcar `verificado: false` para revisar.

### 6.2 Agua
- Botones rápidos +250 ml / +500 ml / personalizado; tamaño de vaso y botella configurables.
- Anillo de progreso contra el objetivo del día.

### 6.3 Actividad (deporte / cardio)
- Si hoy hay algo en la agenda: tarjeta **"Hoy tenés vóley 20 hs — ¿lo hiciste?"** → un toque para confirmar, o editar duración/intensidad, o marcar "no fui".
- Carga manual: actividad + duración + intensidad → kcal por MET.
- Las sesiones de gimnasio se registran desde Entreno (sección 7).

### 6.4 Peso y cuerpo
- **Peso:** idealmente a la mañana en ayunas; gráfico con tendencia.
- **Medidas con cinta** (cada 2 semanas, recordatorio): cintura (a la altura del ombligo), cadera, pecho, brazo, muslo, cuello.
- **Tests físicos** (cada 4 semanas, recordatorio): salto vertical CMJ (cm), salto con alcance (cm), salto en largo (cm), sprint 10 m / 20 m (s), plancha (s). Con instrucciones de cómo medir cada uno.

---

## 7. Entrenamiento

### 7.1 Biblioteca de ejercicios (`supabase/seed/exercises.sql`)
~120 ejercicios con tags: patrón (sentadilla, bisagra, empuje horizontal/vertical, tracción, zancada, pliometría, core, carry, prevención), grupos musculares, equipamiento, foco(s), impacto (bajo/medio/alto), nivel, unilateral sí/no, alternativas (ids), instrucciones cortas y errores comunes.

### 7.2 Focos disponibles
Salto vertical · Potencia · Velocidad y aceleración · Stamina / resistencia · Fuerza máxima · Hipertrofia · Recomposición corporal · Prevención de lesiones · Movilidad.
El usuario elige **uno principal y uno secundario**.

Plantillas base por foco (la IA las usa como guía):
- **Salto:** pliometría progresiva (saltos al cajón, CMJ, drop jumps livianos) + potencia (jump squat, trap bar jump, lanzamientos de balón medicinal) + fuerza (sentadilla, peso muerto rumano, búlgara, hip thrust) + accesorios (gemelos, tibial, core) + prevención.
- **Potencia:** contrastes fuerza–salto/lanzamiento, cargas medias a alta velocidad.
- **Velocidad:** aceleraciones, técnica de sprint, trineo/resistidos si hay, fuerza unilateral.
- **Stamina:** circuitos, intervalos, trabajo de tempo, densidad.
- **Prevención por deporte:**
  - Vóley (punta/opuesto): manguito rotador, escápula, aterrizajes, tendón rotuliano, tobillo.
  - Hockey: isquios (nórdicos), aductores (Copenhague), zona lumbar y core por la postura agachada, cambios de dirección.

### 7.3 Programa
- **Mesociclo de 4 semanas:** 3 de carga progresiva + 1 de descarga. Después se genera el siguiente teniendo en cuenta los registros y los tests.
- Cantidad de sesiones = días de gym disponibles; duración ajustada a los minutos elegidos.

### 7.4 Reglas de colocación según la agenda (validador determinístico `lib/training/rules.ts`)
Notación MD = día de partido.
- **MD-1:** nada de pierna pesada ni pliometría. Solo tren superior liviano, movilidad/activación, o descanso.
- **MD+1:** recuperación o tren superior; sin pliometría.
- Pierna pesada / pliometría: idealmente a ≥ 48 h del partido.
- Máximo 2 sesiones de tren inferior pesado por semana.
- Los entrenos y partidos del deporte **cuentan como carga**: si el deporte tiene muchos saltos (vóley), baja el volumen pliométrico del gym esa semana.
- Si la IA propone algo que viola una regla → se corrige automáticamente o se regenera.

### 7.5 Generación con IA
1. Se arma el contexto: perfil, deportes y posición, agenda, foco, equipamiento, experiencia, molestias, historial de cargas y tests.
2. Gemini elige ejercicios **solo de la biblioteca (por id)** y devuelve JSON: días → ejercicios → series, rango de reps, descanso, RIR objetivo, notas.
3. zod valida → validador de reglas → se guarda.
4. El usuario puede cambiar cualquier ejercicio por una alternativa del mismo patrón.

### 7.6 Progresión
- **Doble progresión:** si completás el tope del rango de reps en todas las series con RIR ≥ 1 → la próxima sesión sube la carga (+2,5 kg tren superior, +5 kg tren inferior; en mancuernas, al siguiente par).
- El peso sugerido aparece precargado.

### 7.7 Modo "en el gym" (registro de sesión)
- Lista de ejercicios del día; por serie: kg, reps, RIR opcional; se muestra lo de la vez anterior.
- Timer de descanso con vibración.
- Botón "molestia" por ejercicio (zona + intensidad 1–10).
- Al terminar: duración, volumen, PRs (1RM estimado), sensación general 1–10 → feedback del agente.
- Si se reporta dolor: el agente recomienda consultar a un profesional y ajusta/quita ejercicios que carguen esa zona. **No diagnostica.**

---

## 8. Agente IA

### 8.1 Personalidad
Nutricionista deportivo + preparador físico. Rioplatense, con humor, breve, concreto. Celebra lo bueno, propone un ajuste por vez. **Nunca** hace comentarios sobre el cuerpo ni culpabiliza ("ayer hubo pizza, hoy le metemos más verde y listo").

### 8.2 Tipos de intervención
| Tipo | Cuándo | Qué hace |
|---|---|---|
| **Feedback por carga** | Al guardar comida, agua, actividad o sesión | 1–2 oraciones: cómo viene el día y un tip |
| **Cierre del día** | Hora configurable (default 22:00) + push | Balance kcal/macros/agua/entreno vs objetivo, 1 cosa que salió bien, 1 ajuste concreto para mañana |
| **Revisión semanal** | Domingo a la noche + push | Tendencia de peso, adherencia, TDEE adaptativo (propone nuevo objetivo, el usuario acepta), progreso en gym y tests, **3 objetivos de la semana** tildables; al cerrar la semana evalúa cuáles se cumplieron |
| **"¿Qué como?"** | Botón en el diario | 3 opciones con receta corta y macros según lo que te falta del día, el momento, el tiempo para cocinar, lo que tenés en casa (texto libre: "tengo huevos, arroz y atún") y tus gustos. Botón "Registrar esta" |

(No hay chat libre en v1.)

### 8.3 Implementación
- `lib/ai/provider.ts`: interfaz única (`generateText`, `generateJSON(schema)`, `analyzeImage`) con implementación Gemini.
- `lib/ai/context.ts`: arma un contexto compacto (perfil, objetivos, hoy, agregados de los últimos 7 días, agenda, rutina actual, objetivos semanales). Nunca manda nombre ni email.
- `lib/ai/prompts/`: un archivo por tipo de intervención, con system prompt + ejemplos.
- Todas las respuestas que se guardan son JSON validado con zod; se persisten en `agent_messages`.
- **Límites del free tier:** reintentos con backoff, cola simple y **fallback por reglas** (mensajes predefinidos) si se agota la cuota. Que la app nunca se rompa porque la IA no responde.
- Aviso en el onboarding: el plan gratis de Gemini puede usar los datos enviados para mejorar los productos de Google; no se mandan datos identificatorios.

### 8.4 Guardrails
- Respeta los pisos del motor de cálculo; nunca sugiere ayunos extremos, saltear comidas para compensar ni "quemar" lo comido.
- Si detecta varios días muy por debajo del piso calórico: no felicita, sugiere con tacto hablar con un profesional.
- Menores: sin mensajes sobre bajar de peso.
- Dolor o lesión: derivar a profesional.

---

## 9. Home (estadísticas)

Orden de tarjetas:
1. **Hoy:** tipo de día ("Día de partido 🏐"), anillo de kcal consumidas vs objetivo, barras de proteína/carbos/grasas.
2. **Agua:** progreso + botón +250 rápido.
3. **Entreno de hoy / próxima sesión** con botón "Empezar".
4. **Peso:** gráfico 7 / 30 / 90 días, pesajes + línea de tendencia + proyección a la meta.
5. **Rachas** (registro, agua, entreno).
6. **Gym y rendimiento:** volumen semanal, últimos PRs, último test de salto vs anterior.
7. **Último mensaje del agente.**

Navegación inferior: **Inicio · Diario · (+) · Entreno · Perfil**.

---

## 10. Social (perfiles tipo Instagram, sin feed)

- Perfil: @username, foto (avatar de Google o propia), bio, deportes y posición.
- **Cuenta pública o privada.** Privada → solicitudes de seguimiento (aceptar/rechazar). Pública → cualquiera sigue y ve.
- **Visibilidad por sección** (toggle cada una):
  | Sección | Default |
  |---|---|
  | Rachas y logros | visible |
  | Entrenos y rutina | visible |
  | Tests físicos | visible |
  | Comidas | oculto |
  | Peso y medidas | oculto |
- Buscar usuarios, seguir, dejar de seguir, eliminar seguidor, bloquear. Listas de seguidores/seguidos.
- **Copiar rutina** de otro perfil (si tiene entrenos visibles) como base para la propia.
- Sin feed, likes ni comentarios en v1.
- **Seguridad:** la visibilidad se aplica en la base con RLS (función SQL `can_view_section(viewer_id, owner_id, section)`), no solo en la UI. Tests que lo prueben.

---

## 11. Notificaciones push

- Web Push con VAPID + service worker. Suscripciones en `push_subscriptions` (varias por usuario).
- Tipos configurables uno por uno:
  - Agua: cada X horas entre hora A y hora B.
  - Comidas: si a cierta hora no cargaste el almuerzo/cena.
  - Gym: el día de gym a la hora elegida.
  - Cierre del día listo · Revisión semanal lista · Nueva solicitud de seguimiento · Toca medirte / toca test.
- Horario de silencio.
- Envío: pg_cron cada 15 min → `POST /api/cron/notifications` (con `CRON_SECRET`) → decide qué mandar por usuario según su zona horaria (default `America/Argentina/Buenos_Aires`).
- Textos en rioplatense ("Che, ¿y el agua? Vas 1 de 3 litros 💧").

---

## 12. Gamificación

- **Rachas diarias:** registro (al menos 3 comidas cargadas), agua (meta cumplida), proteína (≥ 90 % del objetivo).
- **Racha semanal de entreno:** cumplir las sesiones planificadas de la semana.
- **Logros:** primer entreno, 7/30 días de racha, primer PR, mesociclo completo, +X cm de salto, 4 semanas cargando todo, etc.

---

## 13. Modelo de datos (Supabase / Postgres, RLS en todas las tablas)

- `profiles` — id (= auth.users), username, nombre, avatar_url, bio, fecha_nac, sexo, altura_cm, is_private, timezone
- `user_goals` — objetivo, ritmo, factor_estilo_vida, foco_principal, foco_secundario, kcal/macros/agua por tipo de día, tdee_estimado, vigente_desde
- `user_sports` — deporte, posición, nivel
- `weekly_schedule` — día_semana, deporte, tipo (entreno/partido), hora, duración, intensidad
- `gym_preferences` — días, minutos, equipamiento[], experiencia, molestias
- `diet_preferences` — tipo, comidas_por_día, no_le_gusta[], alergias (privado), tiempo_cocina
- `foods` — nombre, marca, fuente (local/off/usda), por_100g (kcal, prot, carb, grasa, fibra), porciones jsonb, verificado
- `food_logs` — fecha, momento, foto_path, input_texto, origen (texto/foto/buscador)
- `food_log_items` — food_log_id, food_id (nullable), nombre, gramos, kcal, prot, carb, grasa, fuente
- `water_logs` — fecha_hora, ml
- `weight_logs` — fecha, kg
- `body_measurements` — fecha, cintura, cadera, pecho, brazo, muslo, cuello
- `fitness_tests` — fecha, tipo, valor, unidad
- `activity_logs` — fecha, actividad, duración, intensidad, met, kcal, schedule_id (nullable)
- `exercises` — biblioteca (ver 7.1)
- `programs` — mesociclo: inicio, semanas, foco, estado
- `program_sessions` — program_id, semana, día, nombre
- `program_exercises` — session_id, exercise_id, orden, series, reps_min, reps_max, descanso_s, rir, notas
- `workout_sessions` — fecha, program_session_id, duración, sensación, notas
- `set_logs` — workout_session_id, exercise_id, n_serie, kg, reps, rir
- `pain_reports` — fecha, exercise_id, zona, intensidad
- `agent_messages` — tipo (carga/diario/semanal/sugerencia), contenido jsonb, fecha, referencia
- `weekly_goals` — semana, texto, cumplido
- `streaks` / `achievements` / `user_achievements`
- `follows` — follower_id, following_id, estado (pendiente/aceptado)
- `blocks` — blocker_id, blocked_id
- `privacy_settings` — rachas, entrenos, tests, comidas, peso_medidas (bool)
- `push_subscriptions` — endpoint, keys, user_agent
- `notification_prefs` — por tipo: activo, horarios, silencio

Fotos: bucket privado `food-photos/{user_id}/...` con políticas por usuario.

---

## 14. Estructura del proyecto

```
app/
  (auth)/login
  (onboarding)/onboarding/[step]
  (app)/inicio  diario  entreno  entreno/sesion/[id]  perfil  perfil/[username]  ajustes
  api/cron/notifications  api/cron/daily  api/cron/weekly
lib/
  calc/        # BMR, gasto, objetivos, macros, agua, tdee adaptativo, 1RM, rachas (+ tests)
  training/    # reglas de colocación, progresión, plantillas por foco
  ai/          # provider, context, prompts, schemas zod, fallbacks
  food/        # búsqueda unificada local + OFF + USDA
  push/        # web-push
  supabase/    # clientes server/browser, tipos generados
supabase/
  migrations/  seed/ (foods_ar.sql, exercises.sql, achievements.sql)
```

---

## 15. Hitos

| Hito | Fechas | Entregable | Criterio de aceptación |
|---|---|---|---|
| **H0 – Base** | 17–19/11 | Repo, Supabase, login Google, PWA instalable, onboarding completo, motor de cálculo con tests | Me logueo, completo el onboarding y veo mis objetivos por tipo de día; `vitest` pasa |
| **H1 – Diario** | 19–23/11 | Comida (texto, foto, buscador) con confirmación, agua, peso, actividad desde agenda; Home v1 | Cargo un día real completo desde el celu en < 2 min por comida |
| **H2 – Entreno** | 23–29/11 | Biblioteca, generador de mesociclo con IA + reglas, modo "en el gym", progresión | El 30/11 tengo rutina y registro mi primera sesión |
| **H3 – Agente** | 30/11–6/12 | Feedback por carga, cierre del día, "¿Qué como?", fallbacks | Recibo feedback útil y en tono; si corto la key de Gemini, la app sigue andando |
| **H4 – Push + social** | 7–12/12 | Notificaciones configurables, perfiles, privacidad por sección, seguir, copiar rutina, rachas y logros | Un amigo me sigue, ve mis entrenos y no ve mi peso (probado también por RLS) |
| **H5 – Cierre** | 13–17/12 | Revisión semanal + TDEE adaptativo + objetivos semanales, medidas, tests físicos, pulido, performance | Todo el spec funcionando en producción |

---

## 16. Fuera de alcance v1 (fase 2)
Chat libre con el agente · feed con likes/comentarios · integración con relojes/Strava/Google Fit · escaneo de código de barras · fotos de progreso · % de grasa · plan semanal de comidas completo · integración con House Keeper (heladera/recetero) · override puntual de la agenda (partido que pasa de sábado a domingo).

---

## 17. Calidad
- Mobile-first real: probar a 375 px; botones grandes, cargar algo en ≤ 3 toques.
- Accesible (contraste, labels, foco).
- Loading y estados vacíos con copy rioplatense.
- Nada se rompe sin IA (fallbacks).
- RLS en todas las tablas + tests de acceso entre usuarios.
- Variables de entorno documentadas en `.env.example`; ningún secreto en el repo.
