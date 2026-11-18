# NutriFit

Diario nutricional + rutinas de gimnasio con un agente IA ("el Profe"). PWA mobile-first, en rioplatense.
Spec: [`SPEC.md`](SPEC.md) · Guía para desarrollar: [`CLAUDE.md`](CLAUDE.md)

> NutriFit no reemplaza a un médico, nutricionista ni deportólogo.

## Puesta en marcha (sin tarjeta de crédito)

### 1. Supabase
1. Creá un proyecto en el plan gratis.
2. El SQL ya está generado en el repo: `supabase/dist/migrations.sql` y `supabase/dist/seed.sql` (si cambian las migraciones: `pnpm db:bundle`).
3. En **SQL Editor**, pegá y corré, en este orden:
   1. `supabase/dist/migrations.sql` (todas las migraciones);
   2. `supabase/dist/seed.sql` (ejercicios, alimentos argentinos y logros).

   Las dos se pueden volver a correr sin romper nada.
4. Cargá los secretos de los crons en Vault, en el SQL Editor y una sola vez. Antes de esto tenés que tener la URL de Vercel (paso 4) y un `CRON_SECRET` largo y aleatorio:
   ```sql
   select vault.create_secret('https://TU-APP.vercel.app', 'app_url');
   select vault.create_secret('EL_MISMO_CRON_SECRET_DE_VERCEL', 'cron_secret');
   ```
   No hace falta volver a correr nada: los crons leen estos secretos en cada llamada.

### 2. Google OAuth
1. Google Cloud Console → Credenciales → **ID de cliente OAuth (Web)**.
2. Como URI de redirección, poné la callback que muestra Supabase en **Auth → Providers → Google**.
3. Pegá el client ID y el secret en Supabase y activá Google.
4. En Supabase → **Auth → URL Configuration**, agregá la URL de Vercel a *Site URL* y `https://TU-APP.vercel.app/auth/callback` a *Redirect URLs*. Para desarrollo, sumá también `http://localhost:3000/auth/callback`.

### 3. Claves
- **Gemini:** API key en aistudio.google.com. `GEMINI_MODEL` = el Flash vigente con soporte de imágenes (por defecto `gemini-2.5-flash`).
- **USDA:** key en fdc.nal.usda.gov (api.data.gov).
- **VAPID (push):**
  ```bash
  pnpm dlx web-push generate-vapid-keys
  ```

### 4. Vercel (Hobby)
1. Importá el repo de GitHub.
2. Cargá las variables de `.env.example`.
3. Deploy. Después completá Vault (paso 1.4) con la URL final.

### Modo demo (sin Supabase)
```bash
pnpm demo   # http://localhost:3000 — entrás como "Toto" con una semana de datos de ejemplo
```
Todo corre en memoria (se borra al reiniciar), sin IA (usa los fallbacks) y sin RLS. Sirve para ver y probar las pantallas antes de tener Supabase. Capturas en `docs/capturas/`.

### Video tutorial
`bash scripts/tutorial/build.sh` (con `pnpm demo` corriendo) graba el recorrido en el modo demo y arma un video de 1080×1920 con títulos, música lo-fi generada y sonidos de toques, todo libre de derechos.

### Desarrollo local
```bash
cp .env.example .env.local   # completar
pnpm dev
```

## Cómo probar desde el celu
1. Abrí la URL de Vercel en Chrome (Android) o Safari (iPhone).
2. **Instalá la app:** en Android, menú → *Instalar app*; en iPhone, Compartir → *Agregar a inicio* (iOS 16.4+ para push).
3. Entrá con Google y completá el onboarding: al final ves **Tus objetivos** por tipo de día.
4. Con el botón **+** cargás comida (texto, foto o buscador), agua, peso o actividad.
5. En **Entreno** tocás **Armar mi rutina** y después **Empezar** en la sesión del día.

## Tests
```bash
pnpm test        # motor de cálculo, reglas de entreno, agente, búsqueda de alimentos y RLS entre usuarios (PGlite)
pnpm typecheck && pnpm lint && pnpm build
```
