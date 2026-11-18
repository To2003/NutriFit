import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/auth", "/offline", "/legal", "/api/cron", "/manifest.webmanifest", "/sw.js"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isSupabaseConfigured()) {
    // Sin Supabase configurado mostramos la pantalla de login con el aviso correspondiente.
    if (!isPublic) return NextResponse.redirect(new URL("/login", request.url));
    return response;
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // No meter lógica entre createServerClient y getClaims (refresca el token).
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (path !== "/") url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (userId && path === "/login") {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }
  return response;
}
