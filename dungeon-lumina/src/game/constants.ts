export const TILE_SIZE = 40;
export const MAP_WIDTH = 52;
export const MAP_HEIGHT = 40;
export const VIEWPORT_W = 19; // tiles wide
export const VIEWPORT_H = 13; // tiles tall
export const CANVAS_W = TILE_SIZE * VIEWPORT_W; // 760
export const CANVAS_H = TILE_SIZE * VIEWPORT_H; // 520

// Colors
export const COLORS = {
  // Tiles
  wall:            "#1a2030",
  wallEdge:        "#2a3040",
  wallExplored:    "#111520",
  floor:           "#252545",
  floorAlt:        "#222240",
  floorExplored:   "#151525",
  stairsDown:      "#1a5c1a",
  stairsUp:        "#1a1a7a",
  fog:             "#000000",

  // Player
  playerRobe:      "#3355dd",
  playerRobeDark:  "#223399",
  playerFace:      "#ffddaa",
  playerHat:       "#222288",
  playerStaff:     "#8B5E3C",
  playerGem:       "#00eeff",

  // UI
  hpBar:           "#cc2222",
  hpBarBg:         "#441111",
  mpBar:           "#2244cc",
  mpBarBg:         "#111133",
  xpBar:           "#ddaa00",
  xpBarBg:         "#443300",

  // Effects
  fire:            "#ff6600",
  ice:             "#44aaff",
  lightning:       "#ffff44",
  light:           "#ffffaa",
  arcane:          "#cc44ff",
  heal:            "#44ff88",

  // Items
  potionHp:        "#ff4466",
  potionMp:        "#4488ff",
  weapon:          "#ffcc44",
  armor:           "#aabbcc",
  accessory:       "#ff88ff",
  crownShard:      "#ffd700",

  // Targeting
  targetValid:     "rgba(255,255,0,0.25)",
  targetInvalid:   "rgba(255,0,0,0.15)",
  targetCursor:    "#ffff00",
};

export const FLOOR_NAMES: Record<number, string> = {
  1: "The Mossy Depths",
  2: "The Crystal Mines",
  3: "The Sunken Catacombs",
  4: "The Dark Academy",
  5: "Malachar's Sanctum",
};

export const SIGHT_RADIUS = 6;

export const XP_PER_LEVEL = (level: number) => level * 80 + 20;

export const PLAYER_BASE_HP = 50;
export const PLAYER_BASE_MP = 30;
export const PLAYER_BASE_ATK = 8;
export const PLAYER_BASE_DEF = 3;

// Stat growth on each level-up choice
export const STAT_GROWTH = {
  hp:      { maxHp: 20, hpHeal: 20 },
  mana:    { maxMana: 15, manaHeal: 15 },
  attack:  { baseAttack: 3 },
  defense: { baseDefense: 2 },
};
