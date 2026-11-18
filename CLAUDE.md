# CLAUDE.md — NutriFit

> Leé esto antes de tocar nada. El spec completo está en `SPEC.md`. Si algo de acá contradice el spec, **gana este archivo** (son decisiones ya acordadas con Toto).

## Qué es
PWA mobile-first de diario nutricional + rutinas de gimnasio con un agente IA ("el Profe") que hace de nutricionista deportivo y preparador físico. Para deportistas amateurs (vóley, hockey, etc.) que quieren bajar grasa, comer mejor y rendir más. Multiusuario, español rioplatense informal, con humor y sin culpabilizar ni comentar el cuerpo.

**Principio rector:** la IA nunca calcula objetivos. `lib/calc` (determinístico, testeado) calcula; la IA interpreta, sugiere y explica. Toda salida de IA pasa por zod y tiene fallback: la app anda igual sin Gemini.

## Stack
| Capa | Elección |
|---|---|
| Front + API | Next.js (App Router) + TypeScript estricto, Server Actions / Route Handlers |
| UI | Tailwind CSS v4 + shadcn/ui, Motion (ex framer-motion) para animación |
| Gráficos | Recharts |
| PWA | Manifest + Serwist (service worker, push) |
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
> Se completan al terminar el scaffolding (H0).
```
pnpm dev          # dev server
pnpm build        # build de producción
pnpm test         # vitest (calc, training, RLS)
pnpm lint
pnpm db:bundle    # concatena supabase/migrations/*.sql → supabase/dist/all.sql (para pegar en el SQL Editor)
```

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
| D6 | Diseño | Dirección "Cancha nocturna" (ver abajo). Animación "expresiva con propósito". |
| D7 | Agente | Personaje con nombre, **"el Profe"**: monograma propio que firma los mensajes. |

## Diseño — "Cancha nocturna"
- Tokens (CSS vars, modo oscuro por defecto):
  - `--bg #0B0D0C` · `--surface #151917` · `--surface-2 #1D2320` · `--border #2A312D`
  - `--accent #C6FF3D` (lima) · `--alert #FF6B3D` (naranja pelota) · `--water #3DD6FF`
  - Macros: proteína `#C6FF3D`, carbos `#FFC93D`, grasa `#FF6B3D` (a validar en contraste)
- Tipografía: **Big Shoulders Display** para números y títulos (tipo marcador) y **Manrope** para el texto. Números con `tabular-nums`.
- Mobile-first a 375 px. Targets ≥ 44 px. Cargar cualquier cosa en ≤ 3 toques.
- Motion: anillos que se llenan, contadores, transiciones entre pantallas, sheet del "+" con resorte, celebración en PRs y rachas, `navigator.vibrate` en Android. Siempre se respeta `prefers-reduced-motion`.
- Copy: rioplatense, con "vos", humor. Nunca culpabilizar ni comentar el cuerpo.

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
| H0 – Base | ⏳ planificado | Esperando el OK del plan |
| H1 – Diario | — | |
| H2 – Entreno | — | Tiene que estar usable el 29/11 |
| H3 – Agente | — | |
| H4 – Push + social | — | |
| H5 – Cierre | — | 17/12 |

## Decisiones menores (bitácora)
- pnpm como package manager.
- Tests de RLS con PGlite: no hace falta Docker ni un proyecto remoto.
