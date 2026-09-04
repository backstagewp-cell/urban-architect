import {
  Building2,
  Eraser,
  Factory,
  FlameKindling,
  GraduationCap,
  Hammer,
  Hospital,
  Landmark,
  Route as RouteIcon,
  Shield,
  ShoppingBag,
  Sparkles,
  TreePine,
  Zap,
} from "lucide-react";
import type { ToolCategory } from "@/game/types";
import type { TileType } from "@/game/types";
import { cn } from "@/lib/utils";

const CATEGORIES: { id: ToolCategory; label: string; icon: typeof Hammer }[] = [
  { id: "estradas", label: "Estradas", icon: RouteIcon },
  { id: "zonas", label: "Zonas", icon: Building2 },
  { id: "servicos", label: "Serviços", icon: Landmark },
  { id: "decoracoes", label: "Decorações", icon: Sparkles },
  { id: "apagar", label: "Apagar", icon: Eraser },
];

const ITEMS: Record<ToolCategory, { id: TileType; label: string; icon: typeof Hammer }[]> = {
  estradas: [
    { id: "road", label: "Rua", icon: RouteIcon },
    { id: "road2", label: "Avenida", icon: RouteIcon },
  ],
  zonas: [
    { id: "res", label: "Residencial", icon: Building2 },
    { id: "com", label: "Comercial", icon: ShoppingBag },
    { id: "ind", label: "Industrial", icon: Factory },
  ],
  servicos: [
    { id: "power", label: "Usina", icon: Zap },
    { id: "police", label: "Polícia", icon: Shield },
    { id: "fire", label: "Bombeiros", icon: FlameKindling },
    { id: "hospital", label: "Hospital", icon: Hospital },
    { id: "school", label: "Escola", icon: GraduationCap },
  ],
  decoracoes: [
    { id: "park", label: "Parque", icon: TreePine },
    { id: "tree", label: "Árvores", icon: TreePine },
  ],
  apagar: [],
};

import { BUILDINGS } from "@/game/types";

interface Props {
  category: ToolCategory;
  onCategory: (c: ToolCategory) => void;
  brush: TileType | "bulldoze";
  onBrush: (b: TileType | "bulldoze") => void;
  showGrid: boolean;
  onShowGrid: (v: boolean) => void;
  money: number;
}

export function Sidebar({
  category,
  onCategory,
  brush,
  onBrush,
  showGrid,
  onShowGrid,
  money,
}: Props) {
  const items = ITEMS[category]!;
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-panel-border bg-panel text-panel-foreground">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <span
          aria-hidden="true"
          className="inline-block size-1.5 rounded-full bg-[var(--color-primary)]/70 shadow-[0_0_6px_var(--color-primary)]/40"
        />
        Ferramentas
      </div>
      <div
        aria-hidden="true"
        className="mx-3 mb-1 h-px bg-gradient-to-r from-transparent via-panel-border to-transparent"
      />
      <nav className="px-2 pb-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.id;
          return (
            <button
              key={c.id}
              onClick={() => {
                onCategory(c.id);
                if (c.id === "apagar") onBrush("bulldoze");
                else {
                  const first = ITEMS[c.id]![0];
                  if (first) onBrush(first.id);
                }
              }}
              className={cn(
                "group relative mb-1 flex w-full items-center gap-3 overflow-hidden rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                active
                  ? "border-primary bg-gradient-to-r from-primary/25 via-primary/15 to-primary/5 text-primary shadow-lg shadow-primary/30 ring-1 ring-primary/20"
                  : "border-transparent text-panel-foreground/85 hover:translate-x-0.5 hover:border-primary/60 hover:bg-panel-hover/80 hover:shadow-md hover:shadow-primary/10 hover:text-panel-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md transition-all duration-200",
                  active
                    ? "bg-primary/25 text-primary shadow-inner shadow-primary/20"
                    : "bg-panel-hover/40 text-panel-foreground/80 group-hover:bg-primary/15 group-hover:text-primary",
                )}
              >
                <Icon className="size-5" strokeWidth={2.1} />
              </span>
              <span className="flex-1 text-left">{c.label}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {items.length > 0 && (
        <>
          <div className="border-t border-panel-border px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {CATEGORIES.find((c) => c.id === category)?.label}
          </div>
          <div className="grid grid-cols-2 gap-2 px-3 pb-3">
            {items.map((it) => {
              const Icon = it.icon;
              const def = BUILDINGS[it.id];
              const active = brush === it.id;
              const afford = money >= (def?.cost ?? 0);
              return (
                <button
                  key={it.id}
                  onClick={() => onBrush(it.id)}
                  title={def?.desc}
                  className={cn(
                    "group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border bg-gradient-to-br p-2 text-[11px] transition-all duration-200 ease-out",
                    active
                      ? "border-primary bg-primary/15 text-panel-foreground shadow-md shadow-primary/25 ring-2 ring-primary/30"
                      : "border-panel-border/60 from-panel to-panel-hover/40 text-panel-foreground/80 hover:scale-[1.02] hover:border-primary/40 hover:from-panel-hover/60 hover:to-panel-hover/30 hover:text-panel-foreground hover:shadow-md hover:shadow-primary/15",
                    !afford && "opacity-45",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg transition-all duration-200",
                      active
                        ? "bg-primary/25 text-primary shadow-inner shadow-primary/20"
                        : "bg-panel/60 text-panel-foreground/80 group-hover:bg-primary/15 group-hover:text-primary",
                    )}
                  >
                    <Icon className="size-6" strokeWidth={1.8} />
                  </span>
                  <span className="px-1 text-center text-[11px] font-semibold leading-tight">
                    {it.label}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums rounded-full px-1.5 text-[10px] transition-colors",
                      active
                        ? "bg-primary/25 text-primary"
                        : "bg-panel/60 text-muted-foreground group-hover:bg-panel-hover/80",
                    )}
                  >
                    ${def?.cost}
                  </span>
                  {active && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]"
                    />
                  )}
                  {active && (
                    <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary/85 px-1.5 text-[8px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
                      Selecionado
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {category === "apagar" && (
        <p className="px-4 pb-3 text-xs leading-relaxed text-muted-foreground">
          Clique e arraste no mapa para demolir. Custo de $4 por tile.
        </p>
      )}

      <div className="mt-auto border-t border-panel-border px-4 pb-4 pt-4">
        <div className="pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Camadas
        </div>
        <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => onShowGrid(e.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          Grade
        </label>
        <div className="flex items-center gap-3 py-1.5 text-sm">
          <span className="size-4 rounded-[3px] bg-[#8fbf5a]" /> Residencial
        </div>
        <div className="flex items-center gap-3 py-1.5 text-sm">
          <span className="size-4 rounded-[3px] bg-[#4f9fd8]" /> Comercial
        </div>
        <div className="flex items-center gap-3 py-1.5 text-sm">
          <span className="size-4 rounded-[3px] bg-[#d9a53c]" /> Industrial
        </div>
      </div>
    </aside>
  );
}
