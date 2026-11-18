import Link from "next/link";
import { requireMe } from "@/lib/data/me";
import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/profile/back-header";
import { RemoveFollowerButton } from "@/components/profile/follow-button";
import { Avatar } from "@/components/profile/avatar";
import { Empty } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export const metadata = { title: "Seguidores" };

export default async function SeguidoresPage({ searchParams }: PageProps<"/perfil/seguidores">) {
  const me = await requireMe();
  const tab = (await searchParams).tab === "siguiendo" ? "siguiendo" : "seguidores";
  const supabase = await createClient();
  const rel =
    tab === "seguidores"
      ? await supabase.from("follows").select("follower_id").eq("following_id", me.userId).eq("status", "accepted")
      : await supabase.from("follows").select("following_id").eq("follower_id", me.userId).eq("status", "accepted");
  const ids = (rel.data ?? []).map((r) => ("follower_id" in r ? r.follower_id : (r as { following_id: string }).following_id));
  const profs = ids.length ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids) : { data: [] };
  return (
    <main className="px-4 pt-[max(12px,env(safe-area-inset-top))]">
      <BackHeader title={tab === "seguidores" ? "Seguidores" : "Seguidos"} />
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-[12px] border border-line bg-surface-2 p-1">
        {(["seguidores", "siguiendo"] as const).map((t) => (
          <Link key={t} href={`/perfil/seguidores?tab=${t}`} className={cn("grid h-10 place-items-center rounded-[9px] text-sm font-semibold", tab === t ? "bg-accent text-accent-ink" : "text-muted")}>
            {t === "seguidores" ? "Seguidores" : "Seguidos"}
          </Link>
        ))}
      </div>
      {!profs.data?.length ? (
        <Empty title={tab === "seguidores" ? "Todavía no te sigue nadie" : "Todavía no seguís a nadie"} action={<Link href="/perfil/buscar" className="font-semibold text-accent">Buscar gente</Link>} />
      ) : (
        <ul className="divide-y divide-line">
          {profs.data.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <Link href={`/perfil/${p.username}`} className="flex flex-1 items-center gap-3">
                <Avatar src={p.avatar_url} name={p.display_name || p.username} size={40} />
                <span>
                  <span className="block font-semibold">{p.display_name || p.username}</span>
                  <span className="block text-sm text-muted">@{p.username}</span>
                </span>
              </Link>
              {tab === "seguidores" ? <RemoveFollowerButton followerId={p.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
