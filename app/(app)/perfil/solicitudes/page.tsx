import Link from "next/link";
import { requireMe } from "@/lib/data/me";
import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/profile/back-header";
import { RequestRow } from "@/components/profile/follow-button";
import { Avatar } from "@/components/profile/avatar";
import { Empty } from "@/components/ui/empty";

export const metadata = { title: "Solicitudes" };

export default async function SolicitudesPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const reqs = await supabase.from("follows").select("follower_id, created_at").eq("following_id", me.userId).eq("status", "pending").order("created_at", { ascending: false });
  const ids = (reqs.data ?? []).map((r) => r.follower_id);
  const profs = ids.length ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids) : { data: [] };
  return (
    <main className="px-4 pt-[max(12px,env(safe-area-inset-top))]">
      <BackHeader title="Solicitudes" />
      {ids.length === 0 ? (
        <Empty title="No hay solicitudes pendientes">Cuando alguien quiera seguirte, aparece acá.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {(profs.data ?? []).map((p) => (
            <RequestRow key={p.id} followerId={p.id}>
              <Link href={`/perfil/${p.username}`} className="flex items-center gap-3">
                <Avatar src={p.avatar_url} name={p.display_name || p.username} size={40} />
                <span>
                  <span className="block font-semibold">{p.display_name || p.username}</span>
                  <span className="block text-sm text-muted">@{p.username}</span>
                </span>
              </Link>
            </RequestRow>
          ))}
        </ul>
      )}
    </main>
  );
}
