"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function GoogleButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        size="lg"
        block
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          const supabase = createClient();
          const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
          const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
          if (error) {
            setError("No pudimos abrir el login de Google. Probá de nuevo.");
            setLoading(false);
          }
        }}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5">
          <path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.23 1.5-1.68 4.4-5.35 4.4-3.22 0-5.85-2.67-5.85-5.95S8.78 6.5 12 6.5c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.95 14.55 3 12 3 6.98 3 2.9 7.03 2.9 12s4.08 9 9.1 9c5.25 0 8.73-3.69 8.73-8.89 0-.6-.07-1.05-.15-1.51Z" />
        </svg>
        {loading ? "Abriendo Google…" : "Entrar con Google"}
      </Button>
      {error ? (
        <p role="alert" className="mt-3 text-center text-sm text-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
