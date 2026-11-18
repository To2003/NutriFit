# CLAUDE.md — NutriFit

> Leé esto antes de tocar nada. El spec completo está en `SPEC.md`. Si algo de acá contradice el spec, **gana este archivo** (son decisiones ya acordadas con Toto).

## Qué es
PWA mobile-first de diario nutricional + rutinas de gimnasio con un agente IA ("el Profe") que hace de nutricionista deportivo y preparador físico. Para deportistas amateurs (vóley, hockey, etc.) que quieren bajar grasa, comer mejor y rendir más. Multiusuario, español rioplatense informal, con humor y sin culpabilizar ni comentar el cuerpo.

**Principio rector:** la IA nunca calcula objetivos. `lib/calc` (determinístico, testeado) calcula; la IA interpreta, sugiere y explica. Toda salida de IA pasa por zod y tiene fallback: la app anda igual sin Gemini.

## Stack
| Capa | Elección |
|---|---|
| Front + API | Next.js 16 (App Router, Turbopack, `proxy.ts` en vez de middleware) + TypeScript estricto. `cacheComponents` desactivado: la app es 100 % por usuario. |
| UI | Tailwind CSS v4 + shadcn/ui, Motion (ex framer-motion) para animación |
| Gráficos | Recharts |
| PWA | Manifest (`app/manifest.ts`) + service worker propio (`public/sw.js`: offline + push). Sin Serwist: Next 16 usa Turbopack y Serwist necesita webpack. |
| DB/Auth/Storage | Supabase (Postgres + RLS, Google OAuth, bucket privado `food-photos`) |
| IA | Gemini (`@google/genai`), detrás de `lib/ai/provider.ts` |
| Validación | zod |
| Push | Web Push VAPID (`web-push`) |
| Cron | pg_cron + pg_net (Supabase) cada 15 min → `/api/cron/*` con `CRON_SECRET` |
| Alimentos | Seed local AR + Open Food Facts + USDA FDC |
| Tests | Vitest (lib/calc, lib/training) + tests de RLS con PGlite |
| Deploy | Vercel Hobby. Nada que pida tarjeta. |
| Package manager | pnpm |

## Comandos
```
pnpm dev          # dev server (http://localhost:3000). /dev/preview muestra componentes con datos de ejemplo (solo dev)
pnpm build        # build de producción
pnpm test         # vitest: lib/calc, lib/training, lib/agent, lib/food, lib/push + RLS (PGlite)
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm db:bundle    # migraciones → supabase/dist/migrations.sql y seeds → supabase/dist/seed.sql (para el SQL Editor)
pnpm db:types     # regenera lib/supabase/database.types.ts desde las migraciones (PGlite)
pnpm db:seeds     # regenera supabase/seed/*.sql desde lib/training/library-data.ts, lib/food/foods-ar-data.ts y logros
```
> Después de tocar una migración: `pnpm db:types && pnpm test`. Después de tocar datos de ejercicios/alimentos: `pnpm db:seeds`.

## Flujo con Supabase (acordado)
- **No hay conexión desde la sesión de desarrollo al proyecto Supabase.** El proyecto todavía no existe.
- Las migraciones se escriben en `supabase/migrations/NNNN_descripcion.sql`, numeradas, **idempotentes en lo posible** (`if not exists`, `create or replace`, `drop policy if exists`).
- Toto las pega en el **SQL Editor** de Supabase antes del deploy. `pnpm db:bundle` genera un único archivo con todo, en orden.
- Seeds en `supabase/seed/*.sql`, también para pegar.
- Tipos de DB: se mantienen a mano en `lib/supabase/database.types.ts`, con el mismo formato que `supabase gen types`. Cuando exista el proyecto se pueden regenerar con la CLI y comparar.
- RLS se testea localmente con PGlite (Postgres embebido en Vitest), con un stub del esquema `auth` (`auth.uid()` leído de `request.jwt.claims`).

## Decisiones que cambian o completan el spec
| # | Tema | Decisión |
|---|---|---|
| D1 | Nombre | **NutriFit** (no "Rinde"). |
| D2 | Edad | **Solo mayores de 18.** El onboarding bloquea a menores de 18. Se elimina todo el flujo de menores del spec (§4 y §8.4). |
| D3 | Carbohidratos | **Piso de 3 g/kg en días de entreno/partido.** Si no entra: 1) bajar grasa hasta el mínimo del 20 % de las kcal, 2) achicar el déficit de ese día. En los días de descanso no hay piso. |
| D4 | Agenda | Se puede editar en cualquier momento (vacaciones, cambios de equipo). Al editarla, se ofrece volver a generar la rutina. El override de un solo día sigue en la fase 2. |
| D5 | Días de gym | Por defecto queda **≥1 día de descanso entre sesiones de gym**. Hay una opción por usuario, "permitir días seguidos". El gym **puede** caer el mismo día que el deporte, y MD-1/MD+1 se mantienen. |
| D6 | Diseño | Dirección **"Deportivo vibrante"** (ver abajo; reemplaza a "Cancha nocturna" el 18/11). Animación "expresiva con propósito". |
| D7 | Agente | Personaje con nombre, **"el Profe"**: monograma propio que firma los mensajes. |

## Diseño — "Deportivo vibrante"
- Tokens (CSS vars en `app/globals.css`, modo oscuro por defecto):
  - `--bg #0E0B1A` (violeta noche) · `--surface #17122A` · `--surface-2 #211A3A` · `--line #2F2752`
  - Degradé de marca `--grad`: `#6D3BFF → #B04BD6 → #FF7A45` (clases `bg-grad`, `bg-grad-soft`, `text-grad`)
  - `--accent #FFD84D` (amarillo: botones principales y selección) · `--alert #FF5C7A` · `--water #4FD1FF`
  - Macros: proteína `#A98BFF`, carbos `#FFD84D`, grasa `#FF8A5C`
- Tipografía: **Plus Jakarta Sans** para todo (números y títulos en 800 con tracking negativo, clase `.score`, `tabular-nums`).
- La tarjeta protagonista (marcador del día, día de partido) va con el degradé. Botones redondeados (pill). El Profe firma con un monograma en degradé.
- Mobile-first a 375 px. Targets ≥ 44 px. Cargar cualquier cosa en ≤ 3 toques.
- Motion: anillos, contadores, sheet del "+" con resorte, chips flotando en el login, celebración en PRs. Siempre se respeta `prefers-reduced-motion`.
- Copy: rioplatense, con "vos", humor. Nunca culpabilizar ni comentar el cuerpo. Poco texto por pantalla.

## Convenciones
- TypeScript `strict`. Nada de `any` salvo en los bordes, y con un comentario.
- `lib/calc/*` y `lib/training/rules.ts`: funciones puras y **TDD** (primero el test). Unidades explícitas en los nombres (`kg`, `cm`, `ml`, `kcal`, `g`).
- IA: cada intervención tiene `prompts/<tipo>.ts`, `schemas/<tipo>.ts` (zod) y `fallbacks/<tipo>.ts`. Al modelo nunca se le manda nombre ni email.
- Server: el cliente Supabase server usa cookies (`@supabase/ssr`). El service role se usa **solo** en `/api/cron/*`.
- Commits chicos, en español, en imperativo ("Agrega cálculo de BMR").
- Secretos: solo en `.env.local` / Vercel. `.env.example` sin valores.

## Estructura
```
app/
  (auth)/login
  (onboarding)/onboarding/[step]
  (app)/inicio diario entreno entreno/sesion/[id] perfil perfil/[username] ajustes
  api/cron/{notifications,daily,weekly}
lib/
  calc/  training/  ai/  food/  push/  supabase/
supabase/
  migrations/  seed/  dist/ (generado)
tests/rls/
```

## Estado de hitos
| Hito | Estado | Notas |
|---|---|---|
| H0 – Base | ✅ código listo | Login Google, onboarding 10 pasos, "Tus objetivos", motor de cálculo con tests, PWA. Falta: crear proyecto Supabase + OAuth y probar en el celu. |
| H1 – Diario | ✅ código listo | Comida (texto/foto/buscador + confirmación), agua, peso, actividad desde agenda, Home v1. OFF/USDA no se pudieron probar desde el entorno de desarrollo (red bloqueada). |
| H2 – Entreno | ✅ código listo | Biblioteca 134 ejercicios, generador IA + reglas + fallback, modo gym, progresión, molestias. |
| H3 – Agente | ✅ código listo | Feedback por carga, cierre del día, ¿Qué como?, guardrails y fallbacks testeados. Gemini sin probar en vivo (red bloqueada en el entorno). |
| H4 – Push + social | ✅ código listo | Push VAPID + crons, perfiles, privacidad por sección en RLS (tests), seguir/bloquear/copiar rutina, rachas y logros. |
| H5 – Cierre | ✅ código listo | Revisión semanal + TDEE adaptativo + objetivos semanales, medidas, tests físicos. Pendiente: pruebas reales, pulido con uso. |

**Siguiente:** desplegar (ver README) y probar con datos reales. Revisar valores de `foods_ar` (verified=false) y MET.

## Decisiones menores (bitácora)
- pnpm como package manager. DB y código en inglés (snake_case en SQL); UI y copy en español.
- Tests de RLS con PGlite: no hace falta Docker ni un proyecto remoto. Vitest aliasa `server-only` a un stub.
- `profiles` (público) separado de `profile_details` (privado: fecha de nac., sexo, altura, objetivo). Así la RLS no expone datos del cuerpo.
- Objetivo/ritmo/estilo/foco viven en `profile_details`; `user_goals` guarda snapshots calculados (+ override manual + offset del TDEE adaptativo).
- Ritmos de pérdida: punto medio de cada rango (0,375 / 0,625 / 0,875 % del peso por semana).
- Recomposición = déficit 10 %; ganar músculo = superávit 10 % con tope de 350 kcal.
- Caminata sola no convierte el día en "entreno".
- Tablas hijas (`food_log_items`, `program_sessions`, `program_exercises`, `set_logs`) llevan `user_id` + FK compuesta (parent_id, user_id): RLS simple y no se puede colgar nada en datos de otro.
- `follows.status` lo decide un trigger según la privacidad del seguido (el cliente no puede autoaceptarse). Bloquear borra follows.
- La IA de rutinas recibe la biblioteca filtrada (equipamiento, nivel, molestias) + un plan base por reglas; elige por id. Si el plan IA no pasa el validador después de `fixPlan`, se usa el de reglas.
- Días livianos (MD±1): ≤ 2 series y RIR ≥ 3, y no se progresan en el mesociclo. Lo que no tiene RIR (movilidad, saltos) sigue sin RIR; accesorios/prevención con RIR base ≥ 3 no bajan de RIR 2.
- Modo demo (`pnpm demo`): backend en memoria (`lib/demo/*`) con la API del query builder; sin RLS, sin IA. Solo para ver/probar sin Supabase.
- **Cupo de Gemini (plan gratis): ~5 RPM y 20 RPD por modelo y por proyecto.** Por eso:
  - cadena de modelos `GEMINI_MODEL` → `GEMINI_FALLBACK_MODELS` (cada uno con su cupo); un 429 pasa al siguiente sin reintentar y ese modelo no se vuelve a probar en el día;
  - la IA se usa solo en: interpretar comida (texto/foto), ¿Qué como?, rutina y revisión semanal. Feedback por carga, cierre del día y feedback de sesión salen de reglas salvo `GEMINI_RICH=1`;
  - tope blando de 15 llamadas por usuario por día (`ai_usage` + `bump_ai_usage`).
- Guardrail: se prohíbe "ayuno/ayunar", no "en ayunas" (pesarse).
- Ingesta baja: si ≥ 3 días completos < 80 % del piso calórico, el Profe no felicita y sugiere ver a un profesional.
- Avatar propio: data URL de 256 px en `profiles.avatar_url` (evita un bucket público).
- Copiar rutina: copia la semana 1 del otro perfil, la adapta a tus días de gym y agenda con `fixPlan` y genera el mesociclo.
- Usernames reservados: ajustes, progreso, logros, buscar, solicitudes, seguidores, siguiendo, admin, nutrifit, profe.
- Crons: notifications cada 15 min; daily en :07/:22/:37/:52; weekly cada hora domingo y lunes (la lógica usa la hora local del usuario).
