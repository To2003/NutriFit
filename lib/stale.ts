/** Errores típicos de una pestaña/PWA abierta con una versión vieja después de un deploy. */
export function isStaleDeployError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? "");
  return /Server Action .* was not found|Failed to find Server Action|ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg);
}

const KEY = "nf-stale-reload";

/** Recarga una sola vez por minuto (evita bucles si el error no era por versión). */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sin storage: recargamos igual */
  }
  window.location.reload();
  return true;
}
