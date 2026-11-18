import { cn } from "@/lib/utils";

export function Avatar({ src, name, size = 64, className }: { src: string | null; name: string; size?: number; className?: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" className={cn("shrink-0 rounded-[30%] object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cn("score grid shrink-0 place-items-center rounded-[30%] bg-surface-2 text-muted", className)} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initials || "?"}
    </span>
  );
}
