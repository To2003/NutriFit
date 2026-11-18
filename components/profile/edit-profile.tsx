"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { updateProfileAction, uploadAvatarAction, updateWaterSizesAction } from "@/app/actions/social";
import { Avatar } from "./avatar";

async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const s = Math.min(bmp.width, bmp.height);
  c.getContext("2d")?.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/webp", 0.8));
}

export function EditProfile({ name, bio, avatar, glass, bottle }: { name: string; bio: string; avatar: string | null; glass: number; bottle: number }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name, bio, glass: String(glass), bottle: String(bottle) });
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  return (
    <>
      <Button variant="secondary" block onClick={() => setOpen(true)}>
        Editar perfil
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Editar perfil">
        <div className="space-y-4 pb-2">
          <div className="flex items-center gap-3">
            <Avatar src={avatar} name={name} size={64} />
            <input
              ref={ref}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Cambiar foto"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                start(async () => {
                  const blob = await shrink(f);
                  const fd = new FormData();
                  fd.set("avatar", new File([blob], "avatar.webp", { type: "image/webp" }));
                  const r = await uploadAvatarAction(fd);
                  if (!r.ok) toast.error(r.error);
                  else router.refresh();
                });
              }}
            />
            <Button variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={pending}>
              <Camera className="size-4" /> Cambiar foto
            </Button>
          </div>
          <Field label="Nombre">
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={40} />
          </Field>
          <Field label="Bio" hint="Máx. 280 caracteres.">
            <Textarea value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} maxLength={280} placeholder="Punta en el club, hockey los domingos…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tu vaso (ml)">
              <Input inputMode="numeric" value={v.glass} onChange={(e) => setV({ ...v, glass: e.target.value.replace(/\D/g, "") })} />
            </Field>
            <Field label="Tu botella (ml)">
              <Input inputMode="numeric" value={v.bottle} onChange={(e) => setV({ ...v, bottle: e.target.value.replace(/\D/g, "") })} />
            </Field>
          </div>
          <Button
            block
            disabled={pending}
            onClick={() =>
              start(async () => {
                const a = await updateProfileAction({ display_name: v.name, bio: v.bio });
                const b = await updateWaterSizesAction({ glass: Number(v.glass), bottle: Number(v.bottle) });
                if (!a.ok || !b.ok) return void toast.error(!a.ok ? a.error : !b.ok ? b.error : "");
                toast.success("Guardado");
                setOpen(false);
                router.refresh();
              })
            }
          >
            Guardar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
