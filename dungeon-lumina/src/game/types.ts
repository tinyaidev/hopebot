export type GamePhase =
  | "title"
  | "playing"
  | "targeting"
  | "levelup"
  | "story"
  | "gameover"
  | "victory";

export type TileType = "wall" | "floor" | "stairs_down" | "stairs_up";

export type SpellSchool = "fire" | "ice" | "lightning" | "light" | "arcane";

export type ItemType =
  | "potion_hp"
  | "potion_mp"
  | "weapon"
  | "armor"
  | "accessory"
  | "key_item";

export type EffectType = "burn" | "freeze" | "poison" | "blessed" | "stunned";

export type EnemyAI = "chase" | "patrol" | "ranged";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Tile {
  type: TileType;
  visible: boolean;
  explored: boolean;
  roomId?: number;
}

export interface StatusEffect {
  type: EffectType;
  duration: number;
  power: number;
}

export interface Spell {
  id: string;
  name: string;
  school: SpellSchool;
  manaCost: number;
  power: number;
  range: number;
  aoe: number; // 0 = single target, >0 = blast radius
  description: string;
  learnedAtLevel: number;
  effect?: EffectType;
  effectDuration?: number;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  hpRestore?: number;
  mpRestore?: number;
  attackBonus?: number;
  defenseBonus?: number;
  color: string;
}

export interface Equipment {
  weapon: Item | null;
  armor: Item | null;
  accessory: Item | null;
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  level: number;
  xp: number;
  xpToNext: number;
  baseAttack: number;
  baseDefense: number;
  spells: Spell[];
  selectedSpellIndex: number;
  inventory: Item[];
  equipment: Equipment;
  effects: StatusEffect[];
  crownShards: number;
  name: string;
}

export interface Enemy {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  xpReward: number;
  ai: EnemyAI;
  effects: StatusEffect[];
  isBoss: boolean;
  description: string;
  dropItemId?: string;
  dropChance: number;
  alive: boolean;
  alert: boolean;
}

export interface PlacedItem {
  item: Item;
  x: number;
  y: number;
  collected: boolean;
}

export interface StoryEvent {
  id: string;
  title: string;
  lines: string[];
  speaker?: string;
}

export interface StoryTrigger {
  x: number;
  y: number;
  storyId: string;
  triggered: boolean;
}

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  id: number;
}

export interface DungeonMap {
  width: number;
  height: number;
  tiles: Tile[][];
  rooms: Room[];
  stairsDown: Vec2;
  stairsUp: Vec2 | null;
  startPos: Vec2;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface GameState {
  phase: GamePhase;
  player: Player;
  dungeon: DungeonMap;
  floor: number;
  enemies: Enemy[];
  placedItems: PlacedItem[];
  storyTriggers: StoryTrigger[];
  messages: string[];
  currentStory: StoryEvent | null;
  triggeredStories: string[];
  camera: Vec2;
  floatingTexts: FloatingText[];
  targetCursor: Vec2;
  pendingLevelUp: boolean;
}

export type GameAction =
  | { type: "START_GAME"; playerName: string }
  | { type: "MOVE"; dx: number; dy: number }
  | { type: "SELECT_SPELL"; index: number }
  | { type: "ENTER_TARGETING" }
  | { type: "EXIT_TARGETING" }
  | { type: "MOVE_CURSOR"; dx: number; dy: number }
  | { type: "CAST_AT_CURSOR" }
  | { type: "USE_ITEM"; itemId: string }
  | { type: "DESCEND_STAIRS" }
  | { type: "DISMISS_STORY" }
  | { type: "ALLOCATE_STAT"; stat: "hp" | "mana" | "attack" | "defense" }
  | { type: "RESTART" };
