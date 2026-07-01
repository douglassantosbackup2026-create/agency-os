import { Facebook, Instagram, Youtube, Music2, Search } from "lucide-react";

const PLATFORMS: { name: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { name: "Meta Ads", Icon: Facebook },
  { name: "Instagram", Icon: Instagram },
  { name: "Google Ads", Icon: Search },
  { name: "YouTube", Icon: Youtube },
  { name: "TikTok Ads", Icon: Music2 },
];

export function GestaoTrafegoPlatforms() {
  return (
    <section
      aria-label="Plataformas de mídia paga gerenciadas"
      className="border-y border-border/60 bg-muted/[0.35] py-6 dark:bg-muted/10"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Gestão em todas as plataformas de mídia paga
        </p>
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:gap-x-12">
          {PLATFORMS.map(({ name, Icon }) => (
            <li
              key={name}
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground/90"
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
