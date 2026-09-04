import { BUILDINGS, SERVICE_RADIUS, type Demand, type Stats, type Tile, type TileType } from "./types";

export const W = 72;
export const H = 72;

const idx = (x: number, y: number) => y * W + x;

function hash(x: number, y: number, s = 1) {
  let h = x * 374761393 + y * 668265263 + s * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function noise(x: number, y: number, scale: number, s = 1) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, s);
  const b = hash(x0 + 1, y0, s);
  const c = hash(x0, y0 + 1, s);
  const d = hash(x0 + 1, y0 + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export interface GameState {
  tiles: Tile[];
  stats: Stats;
  history: { pop: number; money: number }[];
  ticks: number;
}

export function createMap(): Tile[] {
  const tiles: Tile[] = new Array(W * H);
  const forestMap = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let t: TileType = "empty";
      // Costa a sudoeste
      const coast = x * 0.55 + (H - y) * 0.45 + noise(x, y, 9, 3) * 9;
      // Rio a leste
      const riverCenter = W - 8 + Math.sin(y / 9) * 4 + noise(x, y, 14, 7) * 3;
      const lakeD = Math.hypot(x - 54, y - 58) + noise(x, y, 8, 11) * 4;

      if (coast < 14) t = "water";
      else if (coast < 18) t = "sand";
      else if (Math.abs(x - riverCenter) < 2.2) t = "water";
      else if (Math.abs(x - riverCenter) < 3.4) t = "sand";
      else if (lakeD < 6) t = "water";
      else if (lakeD < 7.4) t = "sand";

      forestMap[idx(x, y)] =
        noise(x, y, 9, 21) * 0.65 + noise(x, y, 3.5, 33) * 0.35 + hash(x, y, 41) * 0.05;
      tiles[idx(x, y)] = { t, lvl: 0, grow: 0, pow: false, v: noise(x, y, 3.2, 55) };
    }
  }

  // limiares por percentil: ~26% de árvores e ~5% de rochas no terreno livre
  const free = [...forestMap].filter((_, i) => tiles[i]!.t === "empty").sort((a, b) => a - b);
  const treeT = free[Math.floor(free.length * 0.74)]! ?? 1;
  const rockT = free[Math.floor(free.length * 0.69)]! ?? 1;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i]!.t !== "empty") continue;
    const f = forestMap[i]!;
    if (f >= treeT) tiles[i]!.t = "tree";
    else if (f >= rockT) tiles[i]!.t = "rock";
  }
  return tiles;
}


export function createGame(): GameState {
  return {
    tiles: createMap(),
    ticks: 0,
    history: [],
    stats: {
      money: 50000,
      pop: 0,
      jobs: 0,
      powerProd: 0,
      powerUse: 0,
      happiness: 0.7,
      demand: { r: 0.8, c: 0.3, i: 0.5 },
      day: 1,
      income: 0,
      upkeep: 0,
      taxRate: 9,
      unemployment: 0,
    },
  };
}

export const isZone = (t: TileType) => t === "res" || t === "com" || t === "ind";
export const isBuildable = (t: TileType) =>
  t === "empty" || t === "tree" || t === "rock" || t === "sand";

const isRoad = (t: TileType) => t === "road" || t === "road2";

export function canPlace(state: GameState, x: number, y: number, type: TileType) {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const tile = state.tiles[idx(x, y)]!;
  if (tile.t === "water") return false;
  if (tile.t === type) return false;
  return isBuildable(tile.t) || isZone(tile.t) || isRoad(tile.t) || tile.t === "park";
}

export function place(state: GameState, x: number, y: number, type: TileType): boolean {
  if (!canPlace(state, x, y, type)) return false;
  const def = BUILDINGS[type];
  if (!def) return false;
  if (state.stats.money < def.cost) return false;
  state.stats.money -= def.cost;
  state.tiles[idx(x, y)] = { t: type, lvl: 0, grow: 0, pow: false, v: hash(x, y, 99) };
  return true;
}

export function bulldoze(state: GameState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const tile = state.tiles[idx(x, y)]!;
  if (tile.t === "empty" || tile.t === "water" || tile.t === "sand") return false;
  if (state.stats.money < 4) return false;
  state.stats.money -= 4;
  state.tiles[idx(x, y)] = {
    t: tile.t === "tree" || tile.t === "rock" ? "empty" : "empty",
    lvl: 0,
    grow: 0,
    pow: false,
    v: hash(x, y, 99),
  };
  return true;
}

/** Acesso viário: BFS a partir das ruas/avenidas até distância 3 */
function computeRoadAccess(tiles: Tile[]) {
  const access = new Uint8Array(W * H);
  const queue: number[] = [];
  for (let i = 0; i < tiles.length; i++) {
    if (isRoad(tiles[i]!.t)) {
      access[i] = 4;
      queue.push(i);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++]!;
    const d = access[i]!;
    if (d <= 1) continue;
    const x = i % W;
    const y = (i / W) | 0;
    const nb = [
      x > 0 ? i - 1 : -1,
      x < W - 1 ? i + 1 : -1,
      y > 0 ? i - W : -1,
      y < H - 1 ? i + W : -1,
    ];
    for (const n of nb) {
      if (n < 0) continue;
      if (access[n]! >= d - 1) continue;
      if (isRoad(tiles[n]!.t)) continue;
      access[n] = d - 1;
      queue.push(n);
    }
  }
  return access;
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

export function popOf(t: Tile) {
  return t.t === "res" ? t.lvl * 9 : 0;
}
export function jobsOf(t: Tile) {
  if (t.t === "com") return t.lvl * 6;
  if (t.t === "ind") return t.lvl * 11;
  return 0;
}

export function step(state: GameState) {
  const { tiles, stats } = state;
  state.ticks++;
  const access = computeRoadAccess(tiles);

  // --- serviços e coberturas ---
  const services: { x: number; y: number; t: TileType; r: number }[] = [];
  let powerProd = 0;
  let upkeep = 0;
  let roadCount = 0;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]!.t;
    const def = BUILDINGS[t];
    if (def) upkeep += def.upkeep;
    if (isRoad(t)) roadCount++;
    if (t === "power") powerProd += 900;
    const r = SERVICE_RADIUS[t];
    if (r) services.push({ x: i % W, y: (i / W) | 0, t, r });
  }

  const coverageAt = (x: number, y: number) => {
    let safety = 0;
    let health = 0;
    let edu = 0;
    let green = 0;
    for (const s of services) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d > s.r) continue;
      const w = 1 - d / s.r;
      if (s.t === "police" || s.t === "fire") safety += w;
      else if (s.t === "hospital") health += w;
      else if (s.t === "school") edu += w;
      else if (s.t === "park") green += w;
    }
    return {
      safety: clamp(safety, 0, 1),
      health: clamp(health, 0, 1),
      edu: clamp(edu, 0, 1),
      green: clamp(green, 0, 1),
    };
  };

  // --- energia ---
  let powerUse = 0;
  const zones: number[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]!;
    if (isZone(t.t)) {
      zones.push(i);
      powerUse += (t.lvl + 1) * (t.t === "ind" ? 12 : 6);
    }
  }
  const powered = powerProd >= powerUse;

  // --- demanda RCI ---
  let pop = 0;
  let jobs = 0;
  let resCap = 0;
  let comCap = 0;
  let indCap = 0;
  for (const i of zones) {
    const t = tiles[i]!;
    pop += popOf(t);
    jobs += jobsOf(t);
    if (t.t === "res") resCap++;
    if (t.t === "com") comCap++;
    if (t.t === "ind") indCap++;
  }
  const workers = pop * 0.55;
  const jobBalance = jobs - workers;
  const demand: Demand = {
    r: clamp(0.35 + jobBalance / Math.max(40, workers), -1, 1),
    c: clamp((pop * 0.22 - (comCap ? jobs * 0.35 : 0)) / Math.max(30, pop * 0.22) + 0.1, -1, 1),
    i: clamp((pop * 0.3 + 25 - indCap * 8) / Math.max(40, pop * 0.3), -1, 1),
  };

  // --- crescimento das zonas ---
  let poweredBudget = powerProd;
  let taxBase = 0;
  const taxFactor = clamp(1.35 - stats.taxRate / 14, 0.15, 1.2);

  for (const i of zones) {
    const t = tiles[i]!;
    const x = i % W;
    const y = (i / W) | 0;
    const need = (t.lvl + 1) * (t.t === "ind" ? 12 : 6);
    const hasPower = poweredBudget >= need;
    if (hasPower) poweredBudget -= need;
    t.pow = hasPower;

    const hasRoad = access[i]! > 0;
    const cov = coverageAt(x, y);
    const d = t.t === "res" ? demand.r : t.t === "com" ? demand.c : demand.i;

    let desirability = d * 0.9;
    desirability += cov.safety * 0.35 + cov.health * 0.25 + cov.edu * 0.3 + cov.green * 0.35;
    desirability += (taxFactor - 0.8) * 0.6;
    if (t.t === "res") {
      // moradores não gostam de indústria colada
      let bad = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (tiles[idx(nx, ny)]!.t === "ind") bad += 0.05;
        }
      desirability -= Math.min(bad, 0.5);
    }
    if (t.t === "ind") desirability += 0.15;

    const maxLvl = 1 + Math.round(cov.edu * 1.6 + cov.safety * 1.0 + cov.green * 0.8);

    if (!hasRoad || !hasPower) {
      t.grow -= 0.2;
    } else {
      if (t.lvl >= Math.min(4, Math.max(1, maxLvl))) desirability = Math.min(desirability, 0);
      t.grow += desirability * 0.4;
    }

    if (t.grow >= 1) {
      t.grow = 0;
      if (t.lvl < 4) t.lvl++;
    } else if (t.grow <= -1) {
      t.grow = 0;
      if (t.lvl > 0) t.lvl--;
    }

    taxBase += popOf(t) * 1.1 + jobsOf(t) * 1.35;
  }

  const income = (taxBase * stats.taxRate) / 100;
  upkeep += roadCount * 0;
  stats.money += income - upkeep;

  const cityCov = zones.length
    ? zones.reduce((acc, i) => {
        const c = coverageAt(i % W, (i / W) | 0);
        return acc + (c.safety + c.health + c.edu + c.green) / 4;
      }, 0) / zones.length
    : 0.5;

  const unemployment = pop > 0 ? clamp((workers - jobs) / Math.max(1, workers), 0, 1) : 0;
  stats.happiness = clamp(
    0.45 + cityCov * 0.45 - unemployment * 0.4 + (powered ? 0.12 : -0.25) + (taxFactor - 0.8) * 0.25,
    0,
    1,
  );

  stats.pop = pop;
  stats.jobs = jobs;
  stats.powerProd = powerProd;
  stats.powerUse = powerUse;
  stats.demand = demand;
  stats.income = income;
  stats.upkeep = upkeep;
  stats.unemployment = unemployment;
  stats.day += 1;

  if (state.ticks % 4 === 0) {
    state.history.push({ pop, money: stats.money });
    if (state.history.length > 120) state.history.shift();
  }
}
