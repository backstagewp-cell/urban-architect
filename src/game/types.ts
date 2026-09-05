export type ToolCategory = "estradas" | "zonas" | "servicos" | "decoracoes" | "apagar";

export type TileType =
  | "empty"
  | "water"
  | "sand"
  | "tree"
  | "rock"
  | "road"
  | "road2"
  | "road_curve"
  | "res"
  | "com"
  | "ind"
  | "power"
  | "police"
  | "fire"
  | "hospital"
  | "school"
  | "park";

export interface Tile {
  t: TileType;
  lvl: number; // 0..4 nível de desenvolvimento
  grow: number; // progresso interno de crescimento
  pow: boolean;
  v: number; // variação visual determinística
}

export interface Demand {
  r: number;
  c: number;
  i: number;
}

export interface Stats {
  money: number;
  pop: number;
  jobs: number;
  powerProd: number;
  powerUse: number;
  happiness: number;
  demand: Demand;
  day: number;
  income: number;
  upkeep: number;
  taxRate: number;
  unemployment: number;
}

export interface BuildDef {
  id: TileType;
  label: string;
  cost: number;
  upkeep: number;
  category: ToolCategory;
  desc: string;
}

export const BUILDINGS: Record<string, BuildDef> = {
  road: {
    id: "road",
    label: "Rua",
    cost: 12,
    upkeep: 0.15,
    category: "estradas",
    desc: "Conecta zonas. Sem rua não há desenvolvimento.",
  },
  road2: {
    id: "road2",
    label: "Avenida",
    cost: 25,
    upkeep: 0.4,
    category: "estradas",
    desc: "Avenida de mão dupla, mais larga e realista. Conecta zonas com maior capacidade.",
  },
  road_curve: {
    id: "road_curve",
    label: "Rua com curva",
    cost: 18,
    upkeep: 0.25,
    category: "estradas",
    desc: "Rua de mão simples com curva em L para conectar vias em ângulo. Não tem canteiro central.",
  },
  res: {
    id: "res",
    label: "Residencial",
    cost: 25,
    upkeep: 0,
    category: "zonas",
    desc: "Casas. Geram população e impostos.",
  },
  com: {
    id: "com",
    label: "Comercial",
    cost: 35,
    upkeep: 0,
    category: "zonas",
    desc: "Lojas. Geram empregos e comércio.",
  },
  ind: {
    id: "ind",
    label: "Industrial",
    cost: 45,
    upkeep: 0,
    category: "zonas",
    desc: "Fábricas. Muitos empregos, poluição.",
  },
  power: {
    id: "power",
    label: "Usina",
    cost: 2500,
    upkeep: 18,
    category: "servicos",
    desc: "Fornece 900 MW de energia.",
  },
  police: {
    id: "police",
    label: "Polícia",
    cost: 900,
    upkeep: 9,
    category: "servicos",
    desc: "Segurança num raio de 12 tiles.",
  },
  fire: {
    id: "fire",
    label: "Bombeiros",
    cost: 900,
    upkeep: 9,
    category: "servicos",
    desc: "Proteção contra incêndio (raio 12).",
  },
  hospital: {
    id: "hospital",
    label: "Hospital",
    cost: 1400,
    upkeep: 14,
    category: "servicos",
    desc: "Saúde num raio de 14 tiles.",
  },
  school: {
    id: "school",
    label: "Escola",
    cost: 1100,
    upkeep: 11,
    category: "servicos",
    desc: "Educação: eleva o nível dos prédios.",
  },
  park: {
    id: "park",
    label: "Parque",
    cost: 180,
    upkeep: 1,
    category: "decoracoes",
    desc: "Aumenta o valor da terra por perto.",
  },
  tree: {
    id: "tree",
    label: "Árvores",
    cost: 40,
    upkeep: 0,
    category: "decoracoes",
    desc: "Vegetação decorativa.",
  },
};

export const SERVICE_RADIUS: Partial<Record<TileType, number>> = {
  police: 12,
  fire: 12,
  hospital: 14,
  school: 13,
  park: 6,
};
