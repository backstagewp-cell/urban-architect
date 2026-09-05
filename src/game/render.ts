import { H, W, type GameState } from "./engine";
import type { TileType } from "./types";
import { drawAgents } from "./agents";

export interface Camera {
  x: number; // centro em tiles
  y: number;
  zoom: number; // px por tile
}

const idx = (x: number, y: number) => y * W + x;

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

const GRASS = ["#4c7a34", "#527f37", "#476f30", "#568539", "#43682d"];

function terrainColor(t: TileType, v: number) {
  switch (t) {
    case "water":
      return v > 0.5 ? "#1d4f6b" : "#1a4760";
    case "sand":
      return v > 0.5 ? "#c8b183" : "#bfa679";
    default:
      return GRASS[Math.floor(v * GRASS.length) % GRASS.length]!;
  }
}

const ZONE_COLORS: Record<string, { base: string; roof: string; tint: string }> = {
  res: { base: "#8fbf5a", roof: "#d9c9a3", tint: "#7fae4e" },
  com: { base: "#4f9fd8", roof: "#cfe4f2", tint: "#3f8fc8" },
  ind: { base: "#d9a53c", roof: "#e8d6a8", tint: "#c4912f" },
};

const isRoad = (t: TileType) => t === "road" || t === "road2" || t === "road_curve";

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cam: Camera,
  opts: {
    width: number;
    height: number;
    hover: { x: number; y: number } | null;
    brush: TileType | "bulldoze" | null;
    showGrid: boolean;
    dragCells?: { x: number; y: number }[];
  },
) {
  const { width, height, hover, showGrid } = opts;
  const z = cam.zoom;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#12301c";
  ctx.fillRect(0, 0, width, height);

  const originX = width / 2 - cam.x * z;
  const originY = height / 2 - cam.y * z;

  const x0 = Math.max(0, Math.floor(-originX / z) - 1);
  const y0 = Math.max(0, Math.floor(-originY / z) - 1);
  const x1 = Math.min(W - 1, Math.ceil((width - originX) / z) + 1);
  const y1 = Math.min(H - 1, Math.ceil((height - originY) / z) + 1);

  const tiles = state.tiles;

  // terreno
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = tiles[idx(x, y)]!;
      const px = originX + x * z;
      const py = originY + y * z;
      const base: TileType =
        t.t === "water" ? "water" : t.t === "sand" ? "sand" : "empty";
      ctx.fillStyle = terrainColor(base, t.v);
      ctx.fillRect(px, py, z + 1, z + 1);
    }
  }

  // grade
  if (showGrid && z > 7) {
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1 + 1; x++) {
      const px = Math.round(originX + x * z) + 0.5;
      ctx.moveTo(px, originY + y0 * z);
      ctx.lineTo(px, originY + (y1 + 1) * z);
    }
    for (let y = y0; y <= y1 + 1; y++) {
      const py = Math.round(originY + y * z) + 0.5;
      ctx.moveTo(originX + x0 * z, py);
      ctx.lineTo(originX + (x1 + 1) * z, py);
    }
    ctx.stroke();
  }

  // --- RUAS SIMPLES (road) ---
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (tiles[idx(x, y)]!.t !== "road") continue;
      const px = originX + x * z;
      const py = originY + y * z;
      const inset = z * 0.08;
      ctx.fillStyle = "#3a3a3d";
      ctx.fillRect(px, py, z + 1, z + 1);
      ctx.fillStyle = "#4a4a4e";
      ctx.fillRect(px + inset, py + inset, z - inset * 2, z - inset * 2);
      const n = y > 0 && tiles[idx(x, y - 1)]!.t === "road";
      const s = y < H - 1 && tiles[idx(x, y + 1)]!.t === "road";
      const w = x > 0 && tiles[idx(x - 1, y)]!.t === "road";
      const e = x < W - 1 && tiles[idx(x + 1, y)]!.t === "road";
      ctx.strokeStyle = "rgba(240,235,200,0.65)";
      ctx.lineWidth = Math.max(1, z * 0.045);
      ctx.setLineDash([z * 0.22, z * 0.22]);
      ctx.beginPath();
      if ((n || s) && !(w || e)) {
        ctx.moveTo(px + z / 2, py);
        ctx.lineTo(px + z / 2, py + z);
      } else if ((w || e) && !(n || s)) {
        ctx.moveTo(px, py + z / 2);
        ctx.lineTo(px + z, py + z / 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // --- AVENIDAS (road2) — aparência mais realista ---
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (tiles[idx(x, y)]!.t !== "road2") continue;
      const px = originX + x * z;
      const py = originY + y * z;

      // vizinhança (4 e 8 direções)
      const n = y > 0 && tiles[idx(x, y - 1)]!.t === "road2";
      const s = y < H - 1 && tiles[idx(x, y + 1)]!.t === "road2";
      const w = x > 0 && tiles[idx(x - 1, y)]!.t === "road2";
      const e = x < W - 1 && tiles[idx(x + 1, y)]!.t === "road2";
      const nw = x > 0 && y > 0 && tiles[idx(x - 1, y - 1)]!.t === "road2";
      const ne = x < W - 1 && y > 0 && tiles[idx(x + 1, y - 1)]!.t === "road2";
      const sw = x > 0 && y < H - 1 && tiles[idx(x - 1, y + 1)]!.t === "road2";
      const se = x < W - 1 && y < H - 1 && tiles[idx(x + 1, y + 1)]!.t === "road2";

      const isCross = n && s && w && e;
      const isT =
        ((n && s && w) && !e) ||
        ((n && s && e) && !w) ||
        ((n && w && e) && !s) ||
        ((s && w && e) && !n);
      const isStraightNS = n || s;
      const isStraightEW = w || e;
      const hasNeighbor = n || s || w || e;
      // tile totalmente isolado (sem nenhuma conexão, nem diagonal)
      const isIsolated = !n && !s && !w && !e && !nw && !ne && !sw && !se;

      // ============ 1) CALÇADA / MEIO-FIO ============
      ctx.fillStyle = "#9c958a";
      ctx.fillRect(px, py, z + 1, z + 1);
      ctx.fillStyle = "#b3ab9e";
      ctx.fillRect(px + 0.5, py + 0.5, z, z);

      // ============ 2) ASFALTO BASE (sempre desenhado, inclusive isolado) ============
      const curb = z * 0.06;
      const grad = ctx.createLinearGradient(
        px,
        py + curb,
        px,
        py + z - curb,
      );
      grad.addColorStop(0, "#2f3033");
      grad.addColorStop(0.5, "#3d3f44");
      grad.addColorStop(1, "#2a2b2e");
      ctx.fillStyle = grad;
      ctx.fillRect(px + curb, py + curb, z - curb * 2, z - curb * 2);

      // ============ 3) CURVAS L SUAVES (preenchem quinas com asfalto arredondado) ============
      // Estas curvas cobrem os cantos onde NÃO há conexão naquela direção,
      // arredondando o asfalto para que o segmento "receba" o vizinho de forma suave.
      const cornerR = z * 0.22;
      if (!n && w && !isIsolated) {
        // canto NW: arredonda o canto superior-esquerdo (conexões a oeste e norte esperadas)
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px + curb, py + z / 2);
        ctx.lineTo(px + z / 2 - cornerR, py + z / 2);
        ctx.arcTo(px + z / 2, py + z / 2, px + z / 2, py + curb, cornerR);
        ctx.lineTo(px + z / 2, py + curb);
        ctx.fill();
      }
      if (!n && e && !isIsolated) {
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px + z / 2, py + curb);
        ctx.lineTo(px + z / 2, py + z / 2 - cornerR);
        ctx.arcTo(px + z / 2, py + z / 2, px + z - curb, py + z / 2, cornerR);
        ctx.lineTo(px + z - curb, py + z / 2);
        ctx.fill();
      }
      if (!s && w && !isIsolated) {
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px + curb, py + z / 2);
        ctx.lineTo(px + z / 2 - cornerR, py + z / 2);
        ctx.arcTo(px + z / 2, py + z / 2, px + z / 2, py + z - curb, cornerR);
        ctx.lineTo(px + z / 2, py + z - curb);
        ctx.fill();
      }
      if (!s && e && !isIsolated) {
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px + z / 2, py + z - curb);
        ctx.lineTo(px + z / 2, py + z / 2 + cornerR);
        ctx.arcTo(px + z / 2, py + z / 2, px + z - curb, py + z / 2, cornerR);
        ctx.lineTo(px + z - curb, py + z / 2);
        ctx.fill();
      }

      // cantos diagonais: arredondar asfalto quando o vizinho diagonal existe
      // (evita quinas afiadas visíveis em curvas entre duas direções)
      if ((nw || ne || sw || se) && !isCross) {
        const r2 = z * 0.14;
        if (nw) {
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(px + curb, py + z / 2);
          ctx.lineTo(px + z / 2 - r2, py + z / 2);
          ctx.arcTo(px + z / 2, py + z / 2, px + z / 2, py + curb, r2);
          ctx.lineTo(px + z / 2, py + curb);
          ctx.fill();
        }
        if (ne) {
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(px + z / 2, py + curb);
          ctx.lineTo(px + z / 2, py + z / 2 - r2);
          ctx.arcTo(px + z / 2, py + z / 2, px + z - curb, py + z / 2, r2);
          ctx.lineTo(px + z - curb, py + z / 2);
          ctx.fill();
        }
        if (sw) {
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(px + curb, py + z / 2);
          ctx.lineTo(px + z / 2 - r2, py + z / 2);
          ctx.arcTo(px + z / 2, py + z / 2, px + z / 2, py + z - curb, r2);
          ctx.lineTo(px + z / 2, py + z - curb);
          ctx.fill();
        }
        if (se) {
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(px + z / 2, py + z - curb);
          ctx.lineTo(px + z / 2, py + z / 2 + r2);
          ctx.arcTo(px + z / 2, py + z / 2, px + z - curb, py + z / 2, r2);
          ctx.lineTo(px + z - curb, py + z / 2);
          ctx.fill();
        }
      }

      // ============ 4) CANTEIRO CENTRAL (faixa dupla amarela) ============
      // O canteiro fica oculto apenas em cruzamento completo (4 vias).
      if (!isCross) {
        const medianW = Math.max(2, z * 0.1);
        const medianX = px + z / 2 - medianW / 2;
        const medianY = py + curb;
        const medianH = z - curb * 2;
        const mg = ctx.createLinearGradient(medianX, medianY, medianX + medianW, medianY);
        mg.addColorStop(0, "#1f1d1a");
        mg.addColorStop(0.5, "#33312c");
        mg.addColorStop(1, "#1f1d1a");
        ctx.fillStyle = mg;
        ctx.fillRect(medianX, medianY, medianW, medianH);

        // linha amarela contínua nas bordas do canteiro (faixa dupla)
        ctx.strokeStyle = "rgba(245,210,80,0.9)";
        ctx.lineWidth = Math.max(1, z * 0.025);
        ctx.beginPath();
        if (isStraightNS) {
          ctx.moveTo(medianX + 0.5, medianY);
          ctx.lineTo(medianX + 0.5, medianY + medianH);
          ctx.moveTo(medianX + medianW - 0.5, medianY);
          ctx.lineTo(medianX + medianW - 0.5, medianY + medianH);
        } else if (isStraightEW) {
          ctx.moveTo(medianX, medianY + 0.5);
          ctx.lineTo(medianX + medianW, medianY + 0.5);
          ctx.moveTo(medianX, medianY + medianH - 0.5);
          ctx.lineTo(medianX + medianW, medianY + medianH - 0.5);
        } else {
          // tile isolado (ou sem vizinhos nas 4 direções): pinta linhas amarelas duplas
          // em ambos os eixos para que o tile sempre mostre o canteiro marcado.
          ctx.moveTo(medianX + 0.5, medianY);
          ctx.lineTo(medianX + 0.5, medianY + medianH);
          ctx.moveTo(medianX + medianW - 0.5, medianY);
          ctx.lineTo(medianX + medianW - 0.5, medianY + medianH);
          ctx.moveTo(medianX, medianY + 0.5);
          ctx.lineTo(medianX + medianW, medianY + 0.5);
          ctx.moveTo(medianX, medianY + medianH - 0.5);
          ctx.lineTo(medianX + medianW, medianY + medianH - 0.5);
        }
        ctx.stroke();
      }

      // ============ 5) MARCAS DE FAIXA TRACEJADAS (duas pistas) ============
      ctx.strokeStyle = "rgba(240,235,210,0.85)";
      ctx.lineWidth = Math.max(1, z * 0.035);
      ctx.setLineDash([z * 0.18, z * 0.22]);
      ctx.beginPath();
      if (isStraightNS) {
        const xL = px + z * 0.22;
        const xR = px + z - z * 0.22;
        ctx.moveTo(xL, py + curb + 1);
        ctx.lineTo(xL, py + z - curb - 1);
        ctx.moveTo(xR, py + curb + 1);
        ctx.lineTo(xR, py + z - curb - 1);
      } else if (isStraightEW) {
        const yT = py + z * 0.22;
        const yB = py + z - z * 0.22;
        ctx.moveTo(px + curb + 1, yT);
        ctx.lineTo(px + z - curb - 1, yT);
        ctx.moveTo(px + curb + 1, yB);
        ctx.lineTo(px + z - curb - 1, yB);
      } else if (isIsolated || !hasNeighbor) {
        // tile isolado (ou sem vizinhos nas 4 direções): desenha as faixas nos
        // dois eixos para que as duas pistas fiquem visíveis em qualquer direção.
        const xL = px + z * 0.22;
        const xR = px + z - z * 0.22;
        ctx.moveTo(xL, py + curb + 1);
        ctx.lineTo(xL, py + z - curb - 1);
        ctx.moveTo(xR, py + curb + 1);
        ctx.lineTo(xR, py + z - curb - 1);
        const yT = py + z * 0.22;
        const yB = py + z - z * 0.22;
        ctx.moveTo(px + curb + 1, yT);
        ctx.lineTo(px + z - curb - 1, yT);
        ctx.moveTo(px + curb + 1, yB);
        ctx.lineTo(px + z - curb - 1, yB);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // ============ 6) CRUZAMENTOS / T: faixas de pedestre (zebra) ============
      if (isCross || isT) {
        const stripeW = Math.max(1, z * 0.04);
        const stripeL = z * 0.18;
        ctx.fillStyle = "rgba(245,240,220,0.85)";
        // zebra horizontal (cobrindo entrada N/S quando há conexão N ou S)
        if (n || s) {
          const cy = py + z * 0.5 - stripeW / 2;
          for (let i = -2; i <= 2; i++) {
            ctx.fillRect(
              px + z * 0.5 - stripeL + i * (stripeL * 0.55),
              cy,
              stripeL * 0.4,
              stripeW,
            );
          }
        }
        // zebra vertical (cobrindo entrada E/W quando há conexão E ou W)
        if (w || e) {
          const cx = px + z * 0.5 - stripeW / 2;
          for (let i = -2; i <= 2; i++) {
            ctx.fillRect(
              cx,
              py + z * 0.5 - stripeL + i * (stripeL * 0.55),
              stripeW,
              stripeL * 0.4,
            );
          }
        }
        // linha amarela contínua cruzando em cruzamento completo
        if (isCross) {
          ctx.strokeStyle = "rgba(245,210,80,0.85)";
          ctx.lineWidth = Math.max(1, z * 0.02);
          ctx.beginPath();
          ctx.moveTo(px + z / 2, py + curb + 1);
          ctx.lineTo(px + z / 2, py + z - curb - 1);
          ctx.moveTo(px + curb + 1, py + z / 2);
          ctx.lineTo(px + z - curb - 1, py + z / 2);
          ctx.stroke();
        }
      }
    }
  }

  // --- RUAS COM CURVA (road_curve) — rua de mão simples com curva em L ---
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (tiles[idx(x, y)]!.t !== "road_curve") continue;
      const px = originX + x * z;
      const py = originY + y * z;

      // Vizinhança específica de road_curve nas 4 direções cardeais.
      const nC = y > 0 && tiles[idx(x, y - 1)]!.t === "road_curve";
      const sC = y < H - 1 && tiles[idx(x, y + 1)]!.t === "road_curve";
      const wC = x > 0 && tiles[idx(x - 1, y)]!.t === "road_curve";
      const eC = x < W - 1 && tiles[idx(x + 1, y)]!.t === "road_curve";

      // Direção dominante da curva (escolhida a partir das conexões existentes).
      // Cada combinação representa um canto de curva em L.
      const isNW = nC && wC && !sC && !eC;
      const isNE = nC && eC && !sC && !wC;
      const isSW = sC && wC && !nC && !eC;
      const isSE = sC && eC && !nC && !wC;
      // Casos degenerados (sem vizinhos ou mais de duas direções):
      // se houver exatamente uma direção, mantém-se reta naquele eixo.
      const onlyNS = !wC && !eC && (nC ? 1 : 0) + (sC ? 1 : 0) > 0;
      const onlyEW = !nC && !sC && (wC ? 1 : 0) + (eC ? 1 : 0) > 0;
      const isIsolatedCurve = !nC && !sC && !wC && !eC;

      // ============ 1) CALÇADA / MEIO-FIO (esquerda e direita de cada via) ============
      ctx.fillStyle = "#9c958a";
      ctx.fillRect(px, py, z + 1, z + 1);
      ctx.fillStyle = "#b3ab9e";
      ctx.fillRect(px + 0.5, py + 0.5, z, z);

      // ============ 2) ASFALTO BASE — sempre desenhado, inclusive isolado ============
      const curb = z * 0.06;
      const grad = ctx.createLinearGradient(px, py + curb, px, py + z - curb);
      grad.addColorStop(0, "#2f3033");
      grad.addColorStop(0.5, "#3d3f44");
      grad.addColorStop(1, "#2a2b2e");
      ctx.fillStyle = grad;
      ctx.fillRect(px + curb, py + curb, z - curb * 2, z - curb * 2);

      // ============ 3) CURVAS EM L (preenchem a quina onde há conexão) ============
      // Aqui a "conexão" relevante é justamente o lado por onde a via chega;
      // arredondamos o asfalto do lado da curva para uma aparência suave.
      const cornerR = z * 0.28;

      if (isNW) {
        // Curva conectando norte + oeste: arredonda canto NW.
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px + z / 2, py + curb);
        ctx.lineTo(px + z / 2, py + z / 2 - cornerR);
        ctx.arcTo(px + z / 2, py + z / 2, px + z / 2 - cornerR, py + z / 2, cornerR);
        ctx.lineTo(px + curb, py + z / 2);
        ctx.closePath();
        ctx.fill();
      } else if (isNE) {
        // Curva conectando norte + leste: arredonda canto NE.
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px + z / 2, py + curb);
        ctx.lineTo(px + z / 2, py + z / 2 - cornerR);
        ctx.arcTo(px + z / 2, py + z / 2, px + z / 2 + cornerR, py + z / 2, cornerR);
        ctx.lineTo(px + z - curb, py + z / 2);
        ctx.closePath();
        ctx.fill();
      } else if (isSW) {
        // Curva conectando sul + oeste: arredonda canto SW.
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px + z / 2, py + z - curb);
        ctx.lineTo(px + z / 2, py + z / 2 + cornerR);
        ctx.arcTo(px + z / 2, py + z / 2, px + z / 2 - cornerR, py + z / 2, cornerR);
        ctx.lineTo(px + curb, py + z / 2);
        ctx.closePath();
        ctx.fill();
      } else if (isSE) {
        // Curva conectando sul + leste: arredonda canto SE.
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px + z / 2, py + z - curb);
        ctx.lineTo(px + z / 2, py + z / 2 + cornerR);
        ctx.arcTo(px + z / 2, py + z / 2, px + z / 2 + cornerR, py + z / 2, cornerR);
        ctx.lineTo(px + z - curb, py + z / 2);
        ctx.closePath();
        ctx.fill();
      }

      // ============ 4) FAIXA AMARELA CENTRAL ÚNICA (sem canteiro, sem dupla) ============
      // Apenas onde existe de fato um trecho da via; nas quinas curvas ela
      // segue a linha central do "L".
      ctx.strokeStyle = "rgba(245,210,80,0.9)";
      ctx.lineWidth = Math.max(1, z * 0.04);
      ctx.setLineDash([z * 0.22, z * 0.2]);
      ctx.beginPath();
      if (isNW) {
        // Faixa que desce do norte e dobra para oeste.
        ctx.moveTo(px + z / 2, py + curb);
        ctx.lineTo(px + z / 2, py + z / 2);
        ctx.arcTo(px + z / 2, py + z / 2, px + z / 2 - cornerR * 0.2, py + z / 2, cornerR);
        ctx.lineTo(px + curb, py + z / 2);
      } else if (isNE) {
        ctx.moveTo(px + z / 2, py + curb);
        ctx.lineTo(px + z / 2, py + z / 2);
        ctx.arcTo(px + z / 2, py + z / 2, px + z / 2 + cornerR * 0.2, py + z / 2, cornerR);
        ctx.lineTo(px + z - curb, py + z / 2);
      } else if (isSW) {
        ctx.moveTo(px + z / 2, py + z - curb);
        ctx.lineTo(px + z / 2, py + z / 2);
        ctx.arcTo(px + z / 2, py + z / 2, px + z / 2 - cornerR * 0.2, py + z / 2, cornerR);
        ctx.lineTo(px + curb, py + z / 2);
      } else if (isSE) {
        ctx.moveTo(px + z / 2, py + z - curb);
        ctx.lineTo(px + z / 2, py + z / 2);
        ctx.arcTo(px + z / 2, py + z / 2, px + z / 2 + cornerR * 0.2, py + z / 2, cornerR);
        ctx.lineTo(px + z - curb, py + z / 2);
      } else if (onlyNS) {
        ctx.moveTo(px + z / 2, py + curb);
        ctx.lineTo(px + z / 2, py + z - curb);
      } else if (onlyEW) {
        ctx.moveTo(px + curb, py + z / 2);
        ctx.lineTo(px + z - curb, py + z / 2);
      } else if (isIsolatedCurve) {
        // sem vizinhos: desenha a faixa amarela em ambos os eixos para não
        // deixar o tile vazio visualmente.
        ctx.moveTo(px + z / 2, py + curb);
        ctx.lineTo(px + z / 2, py + z - curb);
        ctx.moveTo(px + curb, py + z / 2);
        ctx.lineTo(px + z - curb, py + z / 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // ============ 5) CONTORNO INTERNO DO ASFALTO (sutil) ============
      // Suaviza a borda entre asfalto e meio-fio nos lados onde há conexão.
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = Math.max(1, z * 0.02);
      ctx.beginPath();
      if (nC) ctx.moveTo(px + z / 2 - z * 0.18, py + curb); ctx.lineTo(px + z / 2 - z * 0.18, py + z / 2);
      if (sC) ctx.moveTo(px + z / 2 + z * 0.18, py + z / 2); ctx.lineTo(px + z / 2 + z * 0.18, py + z - curb);
      if (wC) ctx.moveTo(px + curb, py + z / 2 + z * 0.18); ctx.lineTo(px + z / 2, py + z / 2 + z * 0.18);
      if (eC) ctx.moveTo(px + z / 2, py + z / 2 - z * 0.18); ctx.lineTo(px + z - curb, py + z / 2 - z * 0.18);
      ctx.stroke();
    }
  }

  // natureza e construções
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = tiles[idx(x, y)]!;
      const px = originX + x * z;
      const py = originY + y * z;
      switch (t.t) {
        case "tree": {
          ctx.fillStyle = "#2c5424";
          const r = z * 0.34;
          ctx.beginPath();
          ctx.arc(px + z * 0.35, py + z * 0.42, r, 0, Math.PI * 2);
          ctx.arc(px + z * 0.68, py + z * 0.62, r * 0.85, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#3a6b2e";
          ctx.beginPath();
          ctx.arc(px + z * 0.32, py + z * 0.36, r * 0.7, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "rock": {
          ctx.fillStyle = "#7c7a72";
          ctx.beginPath();
          ctx.ellipse(px + z * 0.5, py + z * 0.55, z * 0.3, z * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#95938a";
          ctx.beginPath();
          ctx.ellipse(px + z * 0.44, py + z * 0.46, z * 0.2, z * 0.14, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "park": {
          ctx.fillStyle = "#3f7a38";
          ctx.fillRect(px + 1, py + 1, z - 2, z - 2);
          ctx.fillStyle = "#2c5424";
          ctx.beginPath();
          ctx.arc(px + z * 0.5, py + z * 0.5, z * 0.26, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "res":
        case "com":
        case "ind": {
          const c = ZONE_COLORS[t.t]!;
          // marcação da zona
          ctx.fillStyle = c.tint + "";
          ctx.globalAlpha = 0.35;
          ctx.fillRect(px + 1, py + 1, z - 2, z - 2);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = c.base;
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 1.5, py + 1.5, z - 3, z - 3);
          if (t.lvl > 0) {
            const h = 0.1 + t.lvl * 0.07;
            const pad = z * (t.t === "ind" ? 0.06 : 0.14);
            const bw = z - pad * 2;
            const lift = z * h;
            // sombra
            ctx.fillStyle = "rgba(0,0,0,0.28)";
            ctx.fillRect(px + pad + z * 0.06, py + pad + z * 0.06, bw, bw);
            // corpo
            ctx.fillStyle = shade(c.base, -60 + t.lvl * 6);
            ctx.fillRect(px + pad, py + pad - lift, bw, bw + lift);
            // telhado
            ctx.fillStyle = t.t === "res" ? "#b4553f" : shade(c.roof, -10);
            ctx.fillRect(px + pad, py + pad - lift, bw, bw);
            // janelas
            ctx.fillStyle = t.pow ? "rgba(255,236,170,0.8)" : "rgba(90,100,110,0.7)";
            const cells = Math.min(3, 1 + t.lvl);
            const gw = bw / (cells * 2 + 1);
            for (let i = 0; i < cells; i++)
              for (let j = 0; j < cells; j++)
                ctx.fillRect(
                  px + pad + gw * (1 + i * 2),
                  py + pad - lift + gw * (1 + j * 2),
                  gw,
                  gw,
                );
          }
          if (!t.pow && t.lvl >= 0) {
            ctx.fillStyle = "rgba(255,80,80,0.85)";
            ctx.beginPath();
            ctx.arc(px + z * 0.85, py + z * 0.15, Math.max(1.5, z * 0.07), 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case "power":
        case "police":
        case "fire":
        case "hospital":
        case "school": {
          const colors: Record<string, string> = {
            power: "#6b6f76",
            police: "#2f4d8a",
            fire: "#a5352d",
            hospital: "#d9dde2",
            school: "#c98a3a",
          };
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(px + z * 0.12, py + z * 0.12, z * 0.85, z * 0.85);
          ctx.fillStyle = colors[t.t]!;
          ctx.fillRect(px + z * 0.06, py - z * 0.12, z * 0.85, z * 0.95);
          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.fillRect(px + z * 0.06, py - z * 0.12, z * 0.85, z * 0.2);
          break;
        }
        default:
          break;
      }
    }
  }

  // --- AGENTES (carros e pedestres) sobre as vias ---
  // Desenhados após o cenário para ficarem sobrepostos corretamente.
  drawAgents(ctx, originX, originY, z, { x0, y0, x1, y1 }, state);

  // preview de construção
  const cells = opts.dragCells && opts.dragCells.length ? opts.dragCells : hover ? [hover] : [];
  if (opts.brush) {
    for (const c of cells) {
      if (c.x < 0 || c.y < 0 || c.x >= W || c.y >= H) continue;
      const px = originX + c.x * z;
      const py = originY + c.y * z;
      const bad =
        tiles[idx(c.x, c.y)]!.t === "water" ||
        (opts.brush === "bulldoze" && tiles[idx(c.x, c.y)]!.t === "empty");
      ctx.fillStyle = bad ? "rgba(220,60,60,0.45)" : "rgba(255,255,255,0.35)";
      ctx.fillRect(px, py, z, z);
      ctx.strokeStyle = bad ? "rgba(255,90,90,0.9)" : "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 0.5, py + 0.5, z - 1, z - 1);
    }
  }
}
