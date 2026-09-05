import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Coins,
  Factory,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  ShoppingBag,
  Smile,
  Users,
  Zap,
} from "lucide-react";
import { Sidebar } from "./Sidebar";
import { H, W, bulldoze, createGame, place, step, type GameState } from "@/game/engine";
import { render, type Camera } from "@/game/render";
import type { Stats, TileType, ToolCategory } from "@/game/types";
import { cn } from "@/lib/utils";

const SPEEDS = [0, 1, 2, 4];

function fmt(n: number) {
  return Math.round(n).toLocaleString("pt-BR");
}

function DemandBar({ label, value, color, icon: Icon }: any) {
  const v = Math.max(-1, Math.min(1, value));
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-panel-hover">
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            background: color,
            left: v >= 0 ? "50%" : `${50 + v * 50}%`,
            width: `${Math.abs(v) * 50}%`,
          }}
        />
        <div className="absolute left-1/2 top-0 h-full w-px bg-panel-border" />
      </div>
      <span className="w-6 shrink-0 text-[10px] uppercase text-muted-foreground">{label}</span>
    </div>
  );
}

export function CityGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(createGame());
  const camRef = useRef<Camera>({ x: W / 2, y: H / 2, zoom: 18 });
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const paintRef = useRef(false);
  const panRef = useRef<{ px: number; py: number } | null>(null);
  const brushRef = useRef<TileType | "bulldoze">("road");
  const gridRef = useRef(true);

  const [category, setCategory] = useState<ToolCategory>("estradas");
  const [brush, setBrush] = useState<TileType | "bulldoze">("road");
  const [showGrid, setShowGrid] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState<Stats>({ ...gameRef.current.stats });
  const [toast, setToast] = useState<string | null>(null);

  brushRef.current = brush;
  gridRef.current = showGrid;

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800);
  }, []);

  // loop de simulação
  useEffect(() => {
    if (speed === 0) return;
    const id = window.setInterval(() => {
      step(gameRef.current);
      setStats({ ...gameRef.current.stats });
    }, 1000 / speed);
    return () => window.clearInterval(id);
  }, [speed]);

  // render loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(ctx, gameRef.current, camRef.current, {
        width: rect.width,
        height: rect.height,
        hover: hoverRef.current,
        brush: brushRef.current,
        showGrid: gridRef.current,
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toTile = (e: React.PointerEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const cam = camRef.current;
    const originX = rect.width / 2 - cam.x * cam.zoom;
    const originY = rect.height / 2 - cam.y * cam.zoom;
    return {
      x: Math.floor((e.clientX - rect.left - originX) / cam.zoom),
      y: Math.floor((e.clientY - rect.top - originY) / cam.zoom),
    };
  };

  const apply = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const g = gameRef.current;
    const b = brushRef.current;
    const before = g.stats.money;
    const ok = b === "bulldoze" ? bulldoze(g, x, y) : place(g, x, y, b as TileType);
    if (!ok && g.stats.money === before) {
      const cost = b === "bulldoze" ? 4 : 0;
      if (g.stats.money < cost) notify("Dinheiro insuficiente!");
    }
    setStats({ ...g.stats });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      panRef.current = { px: e.clientX, py: e.clientY };
      return;
    }
    paintRef.current = true;
    const { x, y } = toTile(e);
    apply(x, y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const t = toTile(e);
    hoverRef.current = t;
    if (panRef.current) {
      const cam = camRef.current;
      cam.x -= (e.clientX - panRef.current.px) / cam.zoom;
      cam.y -= (e.clientY - panRef.current.py) / cam.zoom;
      cam.x = Math.max(0, Math.min(W, cam.x));
      cam.y = Math.max(0, Math.min(H, cam.y));
      panRef.current = { px: e.clientX, py: e.clientY };
      return;
    }
    if (paintRef.current) apply(t.x, t.y);
  };

  const endPointer = () => {
    paintRef.current = false;
    panRef.current = null;
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const cam = camRef.current;
    cam.zoom = Math.max(6, Math.min(48, cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
  };

  const reset = () => {
    // createGame() já inicializa state.agents = [], garantindo reset da simulação.
    gameRef.current = createGame();
    setStats({ ...gameRef.current.stats });
    notify("Nova cidade fundada!");
  };

  const powerRatio = stats.powerProd > 0 ? stats.powerUse / stats.powerProd : stats.powerUse > 0 ? 2 : 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-panel">
      <Sidebar
        category={category}
        onCategory={setCategory}
        brush={brush}
        onBrush={setBrush}
        showGrid={showGrid}
        onShowGrid={setShowGrid}
        money={stats.money}
      />

      <main className="relative flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-crosshair touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerLeave={() => {
            endPointer();
            hoverRef.current = null;
          }}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* HUD superior */}
        <div className="pointer-events-none absolute left-4 right-4 top-4 flex flex-wrap items-start justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-panel-border bg-panel/92 px-1 py-1 backdrop-blur">
            <HudStat icon={Coins} value={`$ ${fmt(stats.money)}`} tone="money" />
            <HudStat icon={Users} value={fmt(stats.pop)} tone="pop" />
            <HudStat icon={Building2} value={`${fmt(stats.jobs)} vagas`} tone="pop" />
            <HudStat
              icon={Zap}
              value={`${fmt(stats.powerUse)}/${fmt(stats.powerProd)}`}
              tone={powerRatio > 1 ? "bad" : "power"}
            />
            <HudStat
              icon={Smile}
              value={`${Math.round(stats.happiness * 100)}%`}
              tone={stats.happiness < 0.4 ? "bad" : "pop"}
            />
          </div>

          <div className="pointer-events-auto w-56 rounded-xl border border-panel-border bg-panel/92 p-3 backdrop-blur">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Gauge className="size-3.5" /> Demanda
            </div>
            <div className="space-y-1.5">
              <DemandBar label="R" value={stats.demand.r} color="#8fbf5a" icon={Building2} />
              <DemandBar label="C" value={stats.demand.c} color="#4f9fd8" icon={ShoppingBag} />
              <DemandBar label="I" value={stats.demand.i} color="#d9a53c" icon={Factory} />
            </div>
            <div className="mt-3 space-y-1 border-t border-panel-border pt-2 text-[11px] text-muted-foreground">
              <Row l="Impostos" v={`+$${fmt(stats.income)}/dia`} />
              <Row l="Manutenção" v={`-$${fmt(stats.upkeep)}/dia`} />
              <Row l="Desemprego" v={`${Math.round(stats.unemployment * 100)}%`} />
              <Row l="Dia" v={fmt(stats.day)} />
            </div>
          </div>
        </div>

        {/* Controles inferiores */}
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div className="rounded-xl border border-panel-border bg-panel/92 px-4 py-3 text-xs text-panel-foreground/80 backdrop-blur">
            <p className="font-medium text-panel-foreground">
              {brush === "bulldoze" ? "Demolir" : "Construir"} — clique e arraste
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Shift + arrastar ou botão direito: mover a câmera · Scroll: zoom
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-panel-border bg-panel/92 p-1 backdrop-blur">
              <button
                onClick={() => setSpeed(0)}
                className={cn(
                  "rounded-lg p-2 transition-colors",
                  speed === 0 ? "bg-primary text-primary-foreground" : "hover:bg-panel-hover",
                )}
                aria-label="Pausar"
              >
                <Pause className="size-4" />
              </button>
              {SPEEDS.slice(1).map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={cn(
                    "flex items-center rounded-lg px-2 py-2 text-xs font-semibold transition-colors",
                    speed === s ? "bg-primary text-primary-foreground" : "hover:bg-panel-hover",
                  )}
                >
                  <Play className="size-3.5" />
                  {s > 1 && <span className="ml-0.5">{s}x</span>}
                </button>
              ))}
            </div>
            <button
              onClick={reset}
              className="rounded-xl border border-panel-border bg-panel/92 p-3 backdrop-blur transition-colors hover:bg-panel-hover"
              aria-label="Reiniciar cidade"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
        </div>

        {toast && (
          <div className="animate-fade-in absolute left-1/2 top-24 -translate-x-1/2 rounded-lg border border-panel-border bg-panel/95 px-4 py-2 text-sm text-panel-foreground shadow-lg backdrop-blur">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{l}</span>
      <span className="tabular-nums text-panel-foreground/90">{v}</span>
    </div>
  );
}

function HudStat({
  icon: Icon,
  value,
  tone,
}: {
  icon: typeof Coins;
  value: string;
  tone: "money" | "pop" | "power" | "bad";
}) {
  const toneClass = {
    money: "text-hud-money",
    pop: "text-hud-pop",
    power: "text-hud-power",
    bad: "text-destructive",
  }[tone];
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2">
      <Icon className={cn("size-4", toneClass)} strokeWidth={2.1} />
      <span className={cn("text-sm font-semibold tabular-nums", toneClass)}>{value}</span>
    </div>
  );
}
