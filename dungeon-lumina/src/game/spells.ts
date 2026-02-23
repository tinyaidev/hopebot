import type { Spell } from "./types";

export const ALL_SPELLS: Spell[] = [
  // ── Fire ──────────────────────────────────────────────────────────────────
  {
    id: "ember",
    name: "Ember",
    school: "fire",
    manaCost: 4,
    power: 8,
    range: 4,
    aoe: 0,
    description: "A small flame dart. Burns the target.",
    learnedAtLevel: 1,
    effect: "burn",
    effectDuration: 2,
  },
  {
    id: "fireball",
    name: "Fireball",
    school: "fire",
    manaCost: 12,
    power: 22,
    range: 6,
    aoe: 1,
    description: "A blazing sphere that scorches all nearby foes.",
    learnedAtLevel: 4,
    effect: "burn",
    effectDuration: 3,
  },
  {
    id: "inferno",
    name: "Inferno",
    school: "fire",
    manaCost: 22,
    power: 40,
    range: 5,
    aoe: 2,
    description: "A column of raging fire. Massive area damage.",
    learnedAtLevel: 9,
    effect: "burn",
    effectDuration: 4,
  },

  // ── Ice ───────────────────────────────────────────────────────────────────
  {
    id: "frost_bolt",
    name: "Frost Bolt",
    school: "ice",
    manaCost: 5,
    power: 9,
    range: 5,
    aoe: 0,
    description: "A shard of ice that slows the target.",
    learnedAtLevel: 2,
    effect: "freeze",
    effectDuration: 2,
  },
  {
    id: "ice_storm",
    name: "Ice Storm",
    school: "ice",
    manaCost: 15,
    power: 20,
    range: 6,
    aoe: 1,
    description: "A blizzard that freezes all nearby enemies.",
    learnedAtLevel: 6,
    effect: "freeze",
    effectDuration: 3,
  },

  // ── Lightning ─────────────────────────────────────────────────────────────
  {
    id: "spark",
    name: "Spark",
    school: "lightning",
    manaCost: 5,
    power: 10,
    range: 6,
    aoe: 0,
    description: "A quick electric bolt. Stuns briefly.",
    learnedAtLevel: 3,
    effect: "stunned",
    effectDuration: 1,
  },
  {
    id: "chain_lightning",
    name: "Chain Lightning",
    school: "lightning",
    manaCost: 18,
    power: 28,
    range: 7,
    aoe: 2,
    description: "Lightning that leaps between foes.",
    learnedAtLevel: 7,
  },
  {
    id: "thunderstorm",
    name: "Thunderstorm",
    school: "lightning",
    manaCost: 28,
    power: 50,
    range: 5,
    aoe: 3,
    description: "A catastrophic storm. Destroys everything in range.",
    learnedAtLevel: 11,
    effect: "stunned",
    effectDuration: 2,
  },

  // ── Light ─────────────────────────────────────────────────────────────────
  {
    id: "minor_heal",
    name: "Minor Heal",
    school: "light",
    manaCost: 5,
    power: 15,
    range: 0,
    aoe: 0,
    description: "Restore a small amount of HP to yourself.",
    learnedAtLevel: 1,
  },
  {
    id: "revitalize",
    name: "Revitalize",
    school: "light",
    manaCost: 12,
    power: 35,
    range: 0,
    aoe: 0,
    description: "A powerful healing wave. Restores significant HP.",
    learnedAtLevel: 5,
    effect: "blessed",
    effectDuration: 3,
  },
  {
    id: "sacred_light",
    name: "Sacred Light",
    school: "light",
    manaCost: 20,
    power: 60,
    range: 0,
    aoe: 0,
    description: "Lumina's blessing. Fully restores HP and blesses you.",
    learnedAtLevel: 10,
    effect: "blessed",
    effectDuration: 5,
  },

  // ── Arcane ────────────────────────────────────────────────────────────────
  {
    id: "magic_missile",
    name: "Magic Missile",
    school: "arcane",
    manaCost: 3,
    power: 7,
    range: 8,
    aoe: 0,
    description: "A reliable bolt of pure magic. Never misses.",
    learnedAtLevel: 1,
  },
  {
    id: "arcane_burst",
    name: "Arcane Burst",
    school: "arcane",
    manaCost: 20,
    power: 35,
    range: 4,
    aoe: 2,
    description: "An unstable surge of raw arcane energy.",
    learnedAtLevel: 8,
  },
  {
    id: "void_strike",
    name: "Void Strike",
    school: "arcane",
    manaCost: 30,
    power: 65,
    range: 10,
    aoe: 0,
    description: "A beam of void energy that tears through magic resistance.",
    learnedAtLevel: 12,
  },
];

export const STARTING_SPELLS = ["ember", "minor_heal", "magic_missile"];

export function getSpellById(id: string): Spell | undefined {
  return ALL_SPELLS.find((s) => s.id === id);
}

export function getSpellsForLevel(level: number): Spell[] {
  return ALL_SPELLS.filter((s) => s.learnedAtLevel === level);
}

export const SCHOOL_COLORS: Record<string, string> = {
  fire:      "#ff6600",
  ice:       "#44aaff",
  lightning: "#ffff44",
  light:     "#ffffaa",
  arcane:    "#cc44ff",
};
