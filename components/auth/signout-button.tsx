"use client";

/** Cierra sesión y limpia lo que quedó en el dispositivo (páginas cacheadas y suscripción push). */
export function SignOutButton() {
  return (
    <form
      action="/auth/signout"
      method="post"
      onSubmit={async (e) => {
        const form = e.currentTarget;
        e.preventDefault();
        try {
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => k.includes("-pages")).map((k) => caches.delete(k)));
          const reg = await navigator.serviceWorker?.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          if (sub) {
            const { removePushSubscription } = await import("@/app/actions/push");
            await removePushSubscription(sub.endpoint);
            await sub.unsubscribe();
          }
        } catch {
          /* seguimos igual */
        }
        form.submit();
      }}
    >
      <button type="submit" className="h-12 w-full rounded-[14px] border border-line text-muted">
        Cerrar sesión
      </button>
    </form>
  );
}
