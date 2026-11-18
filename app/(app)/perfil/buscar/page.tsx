import { BackHeader } from "@/components/profile/back-header";
import { UserSearch } from "@/components/profile/user-search";

export const metadata = { title: "Buscar personas" };

export default function BuscarPage() {
  return (
    <main className="px-4 pt-[max(12px,env(safe-area-inset-top))]">
      <BackHeader title="Buscar gente" subtitle="Seguí a tu equipo y compartí rutinas." />
      <UserSearch />
    </main>
  );
}
