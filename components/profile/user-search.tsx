"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock, Search } from "lucide-react";
import { Input } from "@/components/ui/field";
import { searchUsersAction } from "@/app/actions/social";
import { Avatar } from "./avatar";

export function UserSearch() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Awaited<ReturnType<typeof searchUsersAction>>>([]);
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      setRes(await searchUsersAction(q));
      setSearched(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length < 2) {
              setRes([]);
              setSearched(false);
            }
          }}
          placeholder="Buscá por @usuario o nombre"
          className="pl-11"
          aria-label="Buscar personas"
        />
      </div>
      <ul className="divide-y divide-line">
        {res.map((u) => (
          <li key={u.id}>
            <Link href={`/perfil/${u.username}`} className="flex items-center gap-3 py-3">
              <Avatar src={u.avatar_url} name={u.display_name || u.username} size={44} />
              <span className="flex-1">
                <span className="block font-semibold">{u.display_name || u.username}</span>
                <span className="block text-sm text-muted">@{u.username}</span>
              </span>
              {u.is_private ? <Lock className="size-4 text-muted" aria-label="Cuenta privada" /> : null}
            </Link>
          </li>
        ))}
      </ul>
      {searched && res.length === 0 ? <p className="text-sm text-muted">No encontramos a nadie con eso. Probá con el @usuario exacto.</p> : null}
    </div>
  );
}
