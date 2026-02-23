import type { Item } from "./types";

export const ALL_ITEMS: Record<string, Item> = {
  // ── HP Potions ────────────────────────────────────────────────────────────
  potion_hp_small: {
    id: "potion_hp_small",
    name: "Small Health Potion",
    type: "potion_hp",
    description: "A small red vial. Restores 25 HP.",
    hpRestore: 25,
    color: "#ff4466",
  },
  potion_hp_medium: {
    id: "potion_hp_medium",
    name: "Health Potion",
    type: "potion_hp",
    description: "A glowing red flask. Restores 60 HP.",
    hpRestore: 60,
    color: "#ff2244",
  },
  potion_hp_large: {
    id: "potion_hp_large",
    name: "Mega Health Potion",
    type: "potion_hp",
    description: "A vibrant crimson brew. Restores 120 HP.",
    hpRestore: 120,
    color: "#ee0033",
  },

  // ── Mana Potions ──────────────────────────────────────────────────────────
  potion_mp_small: {
    id: "potion_mp_small",
    name: "Small Mana Potion",
    type: "potion_mp",
    description: "A tiny blue vial. Restores 20 Mana.",
    mpRestore: 20,
    color: "#4488ff",
  },
  potion_mp_medium: {
    id: "potion_mp_medium",
    name: "Mana Potion",
    type: "potion_mp",
    description: "A shimmering blue flask. Restores 45 Mana.",
    mpRestore: 45,
    color: "#2266ff",
  },
  potion_mp_large: {
    id: "potion_mp_large",
    name: "Mega Mana Potion",
    type: "potion_mp",
    description: "A deep sapphire brew. Restores 90 Mana.",
    mpRestore: 90,
    color: "#0044ee",
  },

  // ── Weapons ───────────────────────────────────────────────────────────────
  apprentice_staff: {
    id: "apprentice_staff",
    name: "Apprentice's Staff",
    type: "weapon",
    description: "A plain wooden staff. Increases attack power.",
    attackBonus: 3,
    color: "#8B5E3C",
  },
  crystal_wand: {
    id: "crystal_wand",
    name: "Crystal Wand",
    type: "weapon",
    description: "A wand tipped with raw crystal. Strong attack boost.",
    attackBonus: 6,
    color: "#00cccc",
  },
  shadow_scepter: {
    id: "shadow_scepter",
    name: "Shadow Scepter",
    type: "weapon",
    description: "A dark scepter crackling with void energy.",
    attackBonus: 12,
    color: "#8844cc",
  },

  // ── Armor ─────────────────────────────────────────────────────────────────
  cloth_robe: {
    id: "cloth_robe",
    name: "Warded Robe",
    type: "armor",
    description: "A simple robe stitched with protection runes.",
    defenseBonus: 2,
    color: "#aaaacc",
  },
  arcane_vest: {
    id: "arcane_vest",
    name: "Arcane Vestment",
    type: "armor",
    description: "A reinforced garment infused with arcane barriers.",
    defenseBonus: 5,
    color: "#8899cc",
  },
  lumina_mantle: {
    id: "lumina_mantle",
    name: "Mantle of Lumina",
    type: "armor",
    description: "Woven from the light of the Crystal Crown itself.",
    defenseBonus: 10,
    color: "#ffee88",
  },

  // ── Accessories ───────────────────────────────────────────────────────────
  mana_ring: {
    id: "mana_ring",
    name: "Mana Ring",
    type: "accessory",
    description: "Expands the wearer's mana pool.",
    mpRestore: 0,
    defenseBonus: 0,
    color: "#ff88ff",
  },
  vitality_charm: {
    id: "vitality_charm",
    name: "Vitality Charm",
    type: "accessory",
    description: "A charm that strengthens the body.",
    hpRestore: 0,
    color: "#ff8888",
  },

  // ── Key Item ─────────────────────────────────────────────────────────────
  crown_shard: {
    id: "crown_shard",
    name: "Crown Shard",
    type: "key_item",
    description: "A fragment of the Crystal Crown of Lumina. It hums with ancient light.",
    color: "#ffd700",
  },
};

export function getItem(id: string): Item {
  const item = ALL_ITEMS[id];
  if (!item) throw new Error(`Unknown item id: ${id}`);
  return item;
}

export const FLOOR_ITEM_POOL: Record<number, string[]> = {
  1: ["potion_hp_small", "potion_mp_small", "apprentice_staff"],
  2: ["potion_hp_small", "potion_hp_medium", "potion_mp_medium", "crystal_wand", "cloth_robe"],
  3: ["potion_hp_medium", "potion_mp_medium", "cloth_robe", "mana_ring"],
  4: ["potion_hp_large", "potion_mp_large", "arcane_vest", "vitality_charm"],
  5: ["potion_hp_large", "potion_mp_large", "shadow_scepter", "lumina_mantle"],
};

export function randomItemForFloor(floor: number): Item {
  const pool = FLOOR_ITEM_POOL[floor] ?? FLOOR_ITEM_POOL[1];
  const id = pool[Math.floor(Math.random() * pool.length)];
  return ALL_ITEMS[id];
}
