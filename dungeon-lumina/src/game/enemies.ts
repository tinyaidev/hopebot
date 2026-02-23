import type { Enemy } from "./types";

let eidCounter = 0;
function eid(): string {
  return `e${++eidCounter}`;
}

export interface EnemyTemplate {
  type: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  xpReward: number;
  ai: "chase" | "patrol" | "ranged";
  isBoss: boolean;
  description: string;
  dropItemId?: string;
  dropChance: number;
}

export const ENEMY_TEMPLATES: Record<string, EnemyTemplate> = {
  // ── Floor 1: Mossy Depths ────────────────────────────────────────────────
  slime: {
    type: "slime",
    name: "Cave Slime",
    hp: 10, attack: 4, defense: 1,
    xpReward: 12,
    ai: "chase", isBoss: false,
    description: "A gelatinous blob that oozes from the walls.",
    dropItemId: "potion_hp_small", dropChance: 0.25,
  },
  goblin: {
    type: "goblin",
    name: "Goblin Scout",
    hp: 18, attack: 6, defense: 2,
    xpReward: 20,
    ai: "chase", isBoss: false,
    description: "A sneaky little creature with a rusty blade.",
    dropItemId: "potion_mp_small", dropChance: 0.2,
  },
  bat: {
    type: "bat",
    name: "Giant Bat",
    hp: 12, attack: 5, defense: 0,
    xpReward: 14,
    ai: "patrol", isBoss: false,
    description: "A fast-moving bat with razor-sharp fangs.",
    dropChance: 0.1,
  },
  slime_king: {
    type: "slime_king",
    name: "Slime King",
    hp: 80, attack: 10, defense: 3,
    xpReward: 120,
    ai: "chase", isBoss: true,
    description: "A colossal slime with three hungry eyes.",
    dropItemId: "crown_shard", dropChance: 1.0,
  },

  // ── Floor 2: Crystal Mines ───────────────────────────────────────────────
  crystal_shard: {
    type: "crystal_shard",
    name: "Crystal Shard",
    hp: 22, attack: 8, defense: 4,
    xpReward: 28,
    ai: "patrol", isBoss: false,
    description: "A floating shard of crystal that slices through the air.",
    dropItemId: "potion_hp_small", dropChance: 0.2,
  },
  gem_thief: {
    type: "gem_thief",
    name: "Gem Thief",
    hp: 28, attack: 11, defense: 3,
    xpReward: 35,
    ai: "chase", isBoss: false,
    description: "A nimble bandit who steals what gleams.",
    dropItemId: "potion_mp_medium", dropChance: 0.3,
  },
  stone_golem: {
    type: "stone_golem",
    name: "Stone Golem",
    hp: 45, attack: 14, defense: 7,
    xpReward: 55,
    ai: "chase", isBoss: false,
    description: "A hulking guardian of stone. Slow but powerful.",
    dropItemId: "potion_hp_medium", dropChance: 0.35,
  },
  crystal_guardian: {
    type: "crystal_guardian",
    name: "Crystal Guardian",
    hp: 130, attack: 16, defense: 8,
    xpReward: 200,
    ai: "chase", isBoss: true,
    description: "A towering sentinel of living crystal.",
    dropItemId: "crown_shard", dropChance: 1.0,
  },

  // ── Floor 3: Sunken Catacombs ────────────────────────────────────────────
  skeleton: {
    type: "skeleton",
    name: "Restless Skeleton",
    hp: 32, attack: 13, defense: 5,
    xpReward: 42,
    ai: "chase", isBoss: false,
    description: "Ancient bones animated by dark energy.",
    dropItemId: "potion_hp_medium", dropChance: 0.25,
  },
  ghost: {
    type: "ghost",
    name: "Wailing Ghost",
    hp: 28, attack: 15, defense: 2,
    xpReward: 50,
    ai: "chase", isBoss: false,
    description: "A tormented spirit that passes through walls.",
    dropItemId: "potion_mp_medium", dropChance: 0.3,
  },
  cursed_armor: {
    type: "cursed_armor",
    name: "Cursed Armor",
    hp: 55, attack: 17, defense: 10,
    xpReward: 70,
    ai: "patrol", isBoss: false,
    description: "Empty armor possessed by a hateful spirit.",
    dropItemId: "potion_hp_large", dropChance: 0.3,
  },
  forgotten_knight: {
    type: "forgotten_knight",
    name: "The Forgotten Knight",
    hp: 200, attack: 22, defense: 12,
    xpReward: 300,
    ai: "chase", isBoss: true,
    description: "An ancient guardian bound to eternal service.",
    dropItemId: "crown_shard", dropChance: 1.0,
  },

  // ── Floor 4: Dark Academy ────────────────────────────────────────────────
  shadow_scholar: {
    type: "shadow_scholar",
    name: "Shadow Scholar",
    hp: 45, attack: 18, defense: 6,
    xpReward: 65,
    ai: "ranged", isBoss: false,
    description: "A corrupted mage who hurls dark bolts.",
    dropItemId: "potion_mp_large", dropChance: 0.35,
  },
  enchanted_book: {
    type: "enchanted_book",
    name: "Tome of Chaos",
    hp: 30, attack: 20, defense: 3,
    xpReward: 60,
    ai: "patrol", isBoss: false,
    description: "A flying book filled with malevolent spells.",
    dropItemId: "potion_mp_medium", dropChance: 0.4,
  },
  construct_guard: {
    type: "construct_guard",
    name: "Construct Guard",
    hp: 70, attack: 22, defense: 13,
    xpReward: 90,
    ai: "chase", isBoss: false,
    description: "A mechanical golem built to protect the academy.",
    dropItemId: "potion_hp_large", dropChance: 0.4,
  },
  dark_apprentice: {
    type: "dark_apprentice",
    name: "Dorin, Dark Apprentice",
    hp: 280, attack: 28, defense: 14,
    xpReward: 450,
    ai: "ranged", isBoss: true,
    description: "Malachar's prodigy, trained in shadow magic.",
    dropItemId: "crown_shard", dropChance: 1.0,
  },

  // ── Floor 5: Malachar's Sanctum ──────────────────────────────────────────
  demon_scout: {
    type: "demon_scout",
    name: "Void Imp",
    hp: 60, attack: 25, defense: 8,
    xpReward: 90,
    ai: "chase", isBoss: false,
    description: "A vicious imp from the darkness between worlds.",
    dropItemId: "potion_hp_large", dropChance: 0.45,
  },
  void_walker: {
    type: "void_walker",
    name: "Void Walker",
    hp: 90, attack: 30, defense: 10,
    xpReward: 130,
    ai: "chase", isBoss: false,
    description: "A being of pure shadow that consumes light.",
    dropItemId: "potion_mp_large", dropChance: 0.45,
  },
  shadow_dragon: {
    type: "shadow_dragon",
    name: "Shadow Drake",
    hp: 120, attack: 35, defense: 15,
    xpReward: 180,
    ai: "ranged", isBoss: false,
    description: "A draconic creature woven from living shadow.",
    dropItemId: "potion_hp_large", dropChance: 0.5,
  },
  malachar: {
    type: "malachar",
    name: "Malachar Darkstone",
    hp: 400, attack: 38, defense: 18,
    xpReward: 800,
    ai: "ranged", isBoss: true,
    description: "The exiled archmage. Brilliant, bitter, and immensely powerful.",
    dropItemId: "crown_shard", dropChance: 1.0,
  },
};

export const FLOOR_ENEMY_TYPES: Record<number, string[]> = {
  1: ["slime", "goblin", "bat", "slime_king"],
  2: ["crystal_shard", "gem_thief", "stone_golem", "crystal_guardian"],
  3: ["skeleton", "ghost", "cursed_armor", "forgotten_knight"],
  4: ["shadow_scholar", "enchanted_book", "construct_guard", "dark_apprentice"],
  5: ["demon_scout", "void_walker", "shadow_dragon", "malachar"],
};

export function createEnemy(type: string, x: number, y: number): Enemy {
  const tmpl = ENEMY_TEMPLATES[type];
  if (!tmpl) throw new Error(`Unknown enemy type: ${type}`);
  return {
    id: eid(),
    type: tmpl.type,
    name: tmpl.name,
    x,
    y,
    hp: tmpl.hp,
    maxHp: tmpl.hp,
    attack: tmpl.attack,
    defense: tmpl.defense,
    xpReward: tmpl.xpReward,
    ai: tmpl.ai,
    effects: [],
    isBoss: tmpl.isBoss,
    description: tmpl.description,
    dropItemId: tmpl.dropItemId,
    dropChance: tmpl.dropChance,
    alive: true,
    alert: false,
  };
}
