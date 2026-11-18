"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { blockAction, followAction, removeFollowerAction, unblockAction, unfollowAction } from "@/app/actions/social";
import { copyProgramAction } from "@/app/actions/training";

export function FollowControls({
  targetId,
  username,
  state,
  followsMe,
  blocked,
  canCopy,
}: {
  targetId: string;
  username: string;
  state: "none" | "pending" | "accepted";
  followsMe: boolean;
  blocked: boolean;
  canCopy: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; status?: string }>, msg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "No se pudo");
      if (msg) toast.success(msg);
      setMenu(false);
      router.refresh();
    });

  if (blocked)
    return (
      <Button variant="outline" block disabled={pending} onClick={() => run(() => unblockAction(targetId), "Desbloqueado")}>
        Desbloquear
      </Button>
    );

  return (
    <div className="flex gap-2">
      {state === "none" ? (
        <Button className="flex-1" disabled={pending} onClick={() => run(() => followAction(targetId))}>
          {followsMe ? "Seguir también" : "Seguir"}
        </Button>
      ) : (
        <Button variant="secondary" className="flex-1" disabled={pending} onClick={() => run(() => unfollowAction(targetId))}>
          {state === "pending" ? "Solicitud enviada" : "Siguiendo ✓"}
        </Button>
      )}
      {canCopy ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await copyProgramAction(targetId);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Rutina copiada y adaptada a tu agenda", { action: { label: "Ver", onClick: () => router.push("/entreno") } });
            })
          }
        >
          Copiar rutina
        </Button>
      ) : null}
      <Button variant="outline" size="icon" className="size-12 rounded-[14px]" aria-label="Más opciones" onClick={() => setMenu(true)}>
        <MoreHorizontal className="size-5" />
      </Button>
      <Sheet open={menu} onOpenChange={setMenu} title={`@${username}`}>
        <div className="space-y-2 pb-2">
          {followsMe ? (
            <Button block variant="secondary" disabled={pending} onClick={() => run(() => removeFollowerAction(targetId), "Ya no te sigue")}>
              Eliminar seguidor
            </Button>
          ) : null}
          <Button block variant="danger" disabled={pending} onClick={() => run(() => blockAction(targetId), "Bloqueado. No va a poder verte ni seguirte.")}>
            Bloquear
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

export function RequestRow({ followerId, children }: { followerId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex-1">{children}</div>
      <Button size="sm" disabled={pending} onClick={() => run(() => import("@/app/actions/social").then((m) => m.acceptRequestAction(followerId)))}>
        Aceptar
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => removeFollowerAction(followerId))}>
        Rechazar
      </Button>
    </li>
  );
}

export function RemoveFollowerButton({ followerId }: { followerId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await removeFollowerAction(followerId);
          router.refresh();
        })
      }
    >
      Eliminar
    </Button>
  );
}
