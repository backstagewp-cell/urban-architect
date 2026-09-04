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
      <div className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Ferramentas
      </div>
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
                "mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-panel-foreground/85 hover:bg-panel-hover",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.9} />
              {c.label}
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
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border text-[11px] transition-all",
                    active
                      ? "border-primary bg-primary/15 text-panel-foreground"
                      : "border-panel-border bg-panel-hover/50 text-panel-foreground/80 hover:bg-panel-hover",
                    !afford && "opacity-45",
                  )}
                >
                  <Icon className="size-6" strokeWidth={1.7} />
                  <span className="px-1 text-center leading-tight">{it.label}</span>
                  <span className="tabular-nums text-[10px] text-muted-foreground">
                    ${def?.cost}
                  </span>
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
