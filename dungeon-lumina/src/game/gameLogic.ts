import type {
  GameState,
  GameAction,
  Player,
  Enemy,
  PlacedItem,
  FloatingText,
  Vec2,
  StatusEffect,
} from "./types";
import {
  PLAYER_BASE_HP,
  PLAYER_BASE_MP,
  PLAYER_BASE_ATK,
  PLAYER_BASE_DEF,
  SIGHT_RADIUS,
  XP_PER_LEVEL,
  CANVAS_W,
  CANVAS_H,
  TILE_SIZE,
  VIEWPORT_W,
  VIEWPORT_H,
} from "./constants";
import { ALL_SPELLS, STARTING_SPELLS, getSpellsForLevel } from "./spells";
import { generateDungeon, populateDungeon } from "./dungeonGen";
import { STORY_EVENTS } from "./story";
import { getItem } from "./items";

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function addMessage(state: GameState, msg: string): GameState {
  const messages = [msg, ...state.messages].slice(0, 6);
  return { ...state, messages };
}

function addFloat(
  state: GameState,
  x: number,
  y: number,
  text: string,
  color: string
): GameState {
  const ft: FloatingText = { x, y, text, color, life: 1.0 };
  return { ...state, floatingTexts: [...state.floatingTexts, ft] };
}

function updateCamera(state: GameState): GameState {
  const halfW = Math.floor(VIEWPORT_W / 2);
  const halfH = Math.floor(VIEWPORT_H / 2);
  const cx = clamp(state.player.x - halfW, 0, state.dungeon.width - VIEWPORT_W);
  const cy = clamp(state.player.y - halfH, 0, state.dungeon.height - VIEWPORT_H);
  return { ...state, camera: { x: cx, y: cy } };
}

// ── Visibility (simple radius reveal) ────────────────────────────────────────

function updateVisibility(state: GameState): GameState {
  const { player, dungeon } = state;
  const newTiles = dungeon.tiles.map((row) => row.map((t) => ({ ...t, visible: false })));

  for (let dy = -SIGHT_RADIUS; dy <= SIGHT_RADIUS; dy++) {
    for (let dx = -SIGHT_RADIUS; dx <= SIGHT_RADIUS; dx++) {
      if (dx * dx + dy * dy > SIGHT_RADIUS * SIGHT_RADIUS) continue;
      const tx = player.x + dx;
      const ty = player.y + dy;
      if (tx >= 0 && tx < dungeon.width && ty >= 0 && ty < dungeon.height) {
        newTiles[ty][tx].visible = true;
        newTiles[ty][tx].explored = true;
      }
    }
  }

  return { ...state, dungeon: { ...dungeon, tiles: newTiles } };
}

// ── Combat ────────────────────────────────────────────────────────────────────

function calcMeleeDamage(atk: number, def: number): number {
  return Math.max(1, atk - def + rand(-2, 3));
}

function applyDamageToEnemy(
  state: GameState,
  enemyId: string,
  dmg: number,
  color = "#ff4444"
): { state: GameState; enemy: Enemy; died: boolean } {
  let died = false;
  const enemies = state.enemies.map((e) => {
    if (e.id !== enemyId) return e;
    const newHp = Math.max(0, e.hp - dmg);
    if (newHp === 0) died = true;
    return { ...e, hp: newHp, alive: newHp > 0 };
  });

  let newState = { ...state, enemies };
  const enemy = enemies.find((e) => e.id === enemyId)!;
  newState = addFloat(newState, enemy.x, enemy.y, `-${dmg}`, color);

  if (died) {
    newState = addMessage(newState, `${enemy.name} is defeated!`);
    newState = grantXP(newState, enemy.xpReward);

    // Drop loot
    const tmplEnemy = state.enemies.find((e) => e.id === enemyId)!;
    if (tmplEnemy.dropItemId && Math.random() < tmplEnemy.dropChance) {
      if (tmplEnemy.dropItemId === "crown_shard") {
        newState = collectCrownShard(newState, tmplEnemy);
      } else {
        const item = getItem(tmplEnemy.dropItemId);
        newState.player = { ...newState.player, inventory: [...newState.player.inventory, item] };
        newState = addMessage(newState, `${enemy.name} dropped ${item.name}!`);
      }
    }

    // Special: boss death story
    if (tmplEnemy.isBoss) {
      const storyId = `floor_${state.floor}_complete`;
      if (STORY_EVENTS[storyId] && !state.triggeredStories.includes(storyId)) {
        newState = triggerStory(newState, storyId);
      }
      // Also reveal the floor's story for Dorin
      if (tmplEnemy.type === "dark_apprentice") {
        const s2 = "floor_4_boss_defeat";
        if (!state.triggeredStories.includes(s2)) {
          newState = triggerStory(newState, s2);
        }
      }
    }

    // Victory on Malachar
    if (tmplEnemy.type === "malachar") {
      newState = triggerStory(newState, "victory");
      newState = { ...newState, phase: "story" };
    }
  }

  return { state: newState, enemy, died };
}

function collectCrownShard(state: GameState, _enemy: Enemy): GameState {
  const shards = state.player.crownShards + 1;
  let newState = {
    ...state,
    player: { ...state.player, crownShards: shards },
  };
  newState = addMessage(newState, `★ Crown Shard recovered! (${shards}/5)`);
  newState = addFloat(newState, state.player.x, state.player.y - 1, `★ SHARD!`, "#ffd700");

  // Unlock hidden crown shard item on map (make it visible)
  const placedItems = newState.placedItems.map((pi) =>
    pi.item.id === "crown_shard" ? { ...pi, collected: false } : pi
  );
  return { ...newState, placedItems };
}

function grantXP(state: GameState, amount: number): GameState {
  let player = { ...state.player };
  player.xp += amount;

  let newState: GameState = { ...state, player };

  if (player.xp >= player.xpToNext) {
    // Level up!
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = XP_PER_LEVEL(player.level);

    // Auto-learn spells for this level
    const newSpells = getSpellsForLevel(player.level).filter(
      (s) => !player.spells.some((ps) => ps.id === s.id)
    );
    if (newSpells.length > 0) {
      player.spells = [...player.spells, ...newSpells];
      for (const sp of newSpells) {
        newState = addMessage(newState, `✦ Learned new spell: ${sp.name}!`);
      }
    }

    newState = addMessage(newState, `★ Level up! You are now level ${player.level}!`);
    newState = {
      ...newState,
      player,
      pendingLevelUp: true,
    };
  } else {
    newState = { ...newState, player };
  }

  return newState;
}

// ── Player attack ─────────────────────────────────────────────────────────────

function playerMeleeAttack(state: GameState, enemy: Enemy): GameState {
  const player = state.player;
  const atk = player.baseAttack + (player.equipment.weapon?.attackBonus ?? 0);
  const dmg = calcMeleeDamage(atk, enemy.defense);

  let newState = addMessage(state, `You strike ${enemy.name} for ${dmg} damage.`);
  const result = applyDamageToEnemy(newState, enemy.id, dmg, "#ff8844");
  newState = result.state;

  return newState;
}

// ── Enemy AI ──────────────────────────────────────────────────────────────────

function processEnemyTurns(state: GameState): GameState {
  let newState = state;

  for (const enemy of newState.enemies) {
    if (!enemy.alive) continue;

    // Tick status effects on enemy
    newState = tickEnemyEffects(newState, enemy.id);
    const e = newState.enemies.find((en) => en.id === enemy.id)!;
    if (!e.alive) continue;

    // Alert if player in range
    const d = dist(e.x, e.y, newState.player.x, newState.player.y);
    if (d <= 7) {
      newState = setEnemyAlert(newState, e.id, true);
    }

    const updatedE = newState.enemies.find((en) => en.id === e.id)!;
    if (!updatedE.alert) continue;

    // Stunned enemies skip turn
    if (updatedE.effects.some((ef) => ef.type === "stunned")) continue;

    // Frozen enemies skip turn
    if (updatedE.effects.some((ef) => ef.type === "freeze")) continue;

    if (d <= 1) {
      // Attack player
      newState = enemyAttackPlayer(newState, updatedE);
    } else {
      // Move toward player
      newState = enemyMove(newState, updatedE);
    }
  }

  // Tick player effects
  newState = tickPlayerEffects(newState);

  return newState;
}

function setEnemyAlert(state: GameState, id: string, alert: boolean): GameState {
  return {
    ...state,
    enemies: state.enemies.map((e) => (e.id === id ? { ...e, alert } : e)),
  };
}

function enemyAttackPlayer(state: GameState, enemy: Enemy): GameState {
  const def = state.player.baseDefense + (state.player.equipment.armor?.defenseBonus ?? 0);
  const isBlessed = state.player.effects.some((ef) => ef.type === "blessed");
  const dmg = Math.max(0, calcMeleeDamage(enemy.attack, def) - (isBlessed ? 3 : 0));

  const player = { ...state.player, hp: Math.max(0, state.player.hp - dmg) };
  let newState = { ...state, player };
  newState = addMessage(newState, `${enemy.name} attacks you for ${dmg} damage!`);
  newState = addFloat(newState, state.player.x, state.player.y, `-${dmg}`, "#ff2222");

  if (player.hp <= 0) {
    return { ...newState, phase: "gameover" };
  }

  return newState;
}

function enemyMove(state: GameState, enemy: Enemy): GameState {
  const { player } = state;
  let dx = 0;
  let dy = 0;

  if (Math.abs(player.x - enemy.x) >= Math.abs(player.y - enemy.y)) {
    dx = player.x > enemy.x ? 1 : -1;
  } else {
    dy = player.y > enemy.y ? 1 : -1;
  }

  const nx = enemy.x + dx;
  const ny = enemy.y + dy;

  if (!canMoveTo(state, nx, ny)) {
    // Try alternate direction
    dx = dx !== 0 ? 0 : (player.x > enemy.x ? 1 : -1);
    dy = dy !== 0 ? 0 : (player.y > enemy.y ? 1 : -1);
    const nx2 = enemy.x + dx;
    const ny2 = enemy.y + dy;
    if (!canMoveTo(state, nx2, ny2)) return state;
    return moveEnemy(state, enemy.id, nx2, ny2);
  }

  return moveEnemy(state, enemy.id, nx, ny);
}

function canMoveTo(state: GameState, x: number, y: number): boolean {
  if (x < 0 || x >= state.dungeon.width || y < 0 || y >= state.dungeon.height) return false;
  const tile = state.dungeon.tiles[y][x];
  if (tile.type === "wall") return false;
  if (state.enemies.some((e) => e.alive && e.x === x && e.y === y)) return false;
  if (state.player.x === x && state.player.y === y) return false;
  return true;
}

function moveEnemy(state: GameState, id: string, x: number, y: number): GameState {
  return {
    ...state,
    enemies: state.enemies.map((e) => (e.id === id ? { ...e, x, y } : e)),
  };
}

// ── Status effects ────────────────────────────────────────────────────────────

function tickEnemyEffects(state: GameState, id: string): GameState {
  let newState = state;
  const enemy = state.enemies.find((e) => e.id === id);
  if (!enemy || !enemy.alive) return state;

  for (const effect of enemy.effects) {
    if (effect.type === "burn" || effect.type === "poison") {
      const result = applyDamageToEnemy(newState, id, effect.power, "#ff6600");
      newState = result.state;
    }
  }

  const newEffects = enemy.effects
    .map((ef) => ({ ...ef, duration: ef.duration - 1 }))
    .filter((ef) => ef.duration > 0);

  return {
    ...newState,
    enemies: newState.enemies.map((e) =>
      e.id === id ? { ...e, effects: newEffects } : e
    ),
  };
}

function tickPlayerEffects(state: GameState): GameState {
  const newEffects: StatusEffect[] = [];

  for (const effect of state.player.effects) {
    if (effect.type === "poison" || effect.type === "burn") {
      const player = { ...state.player, hp: Math.max(1, state.player.hp - effect.power) };
      state = { ...state, player };
    }
    const remaining = { ...effect, duration: effect.duration - 1 };
    if (remaining.duration > 0) newEffects.push(remaining);
  }

  return { ...state, player: { ...state.player, effects: newEffects } };
}

function applyEffectToEnemy(
  state: GameState,
  enemyId: string,
  effect: StatusEffect
): GameState {
  return {
    ...state,
    enemies: state.enemies.map((e) => {
      if (e.id !== enemyId) return e;
      const existing = e.effects.findIndex((ef) => ef.type === effect.type);
      if (existing >= 0) {
        const effects = [...e.effects];
        effects[existing] = { ...effect, duration: Math.max(effects[existing].duration, effect.duration) };
        return { ...e, effects };
      }
      return { ...e, effects: [...e.effects, effect] };
    }),
  };
}

// ── Story triggers ────────────────────────────────────────────────────────────

function triggerStory(state: GameState, storyId: string): GameState {
  const story = STORY_EVENTS[storyId];
  if (!story) return state;
  return {
    ...state,
    phase: "story",
    currentStory: story,
    triggeredStories: [...state.triggeredStories, storyId],
    storyTriggers: state.storyTriggers.map((st) =>
      st.storyId === storyId ? { ...st, triggered: true } : st
    ),
  };
}

function checkStoryTriggers(state: GameState): GameState {
  for (const trigger of state.storyTriggers) {
    if (
      !trigger.triggered &&
      trigger.x === state.player.x &&
      trigger.y === state.player.y &&
      !state.triggeredStories.includes(trigger.storyId)
    ) {
      return triggerStory(state, trigger.storyId);
    }
  }
  return state;
}

// ── Item collection ───────────────────────────────────────────────────────────

function checkItemPickup(state: GameState): GameState {
  let newState = state;
  const { player } = newState;

  const placedItems = newState.placedItems.map((pi) => {
    if (!pi.collected && pi.x === player.x && pi.y === player.y) {
      const item = pi.item;

      if (item.type === "key_item") {
        // Crown shards are handled on boss death
        return pi;
      }

      newState = addMessage(newState, `You pick up ${item.name}.`);

      if (item.type === "potion_hp" || item.type === "potion_mp") {
        newState = {
          ...newState,
          player: {
            ...newState.player,
            inventory: [...newState.player.inventory, item],
          },
        };
      } else {
        // Equipment: auto-equip if slot is empty, else add to inventory
        newState = {
          ...newState,
          player: {
            ...newState.player,
            inventory: [...newState.player.inventory, item],
          },
        };
      }

      return { ...pi, collected: true };
    }
    return pi;
  });

  return { ...newState, placedItems };
}

// ── Floor transition ──────────────────────────────────────────────────────────

function descendStairs(state: GameState): GameState {
  if (state.floor >= 5) return state;

  const nextFloor = state.floor + 1;
  const dungeon = generateDungeon(nextFloor);
  const { enemies, placedItems, storyTriggers } = populateDungeon(dungeon, nextFloor);

  const player: Player = {
    ...state.player,
    x: dungeon.startPos.x,
    y: dungeon.startPos.y,
    // Restore a bit of HP between floors
    hp: Math.min(state.player.maxHp, state.player.hp + Math.floor(state.player.maxHp * 0.2)),
  };

  let newState: GameState = {
    ...state,
    floor: nextFloor,
    dungeon,
    enemies,
    placedItems,
    storyTriggers: [...storyTriggers],
    player,
    messages: [`You descend to Floor ${nextFloor}: ${floorName(nextFloor)}`],
    floatingTexts: [],
  };

  newState = updateVisibility(newState);
  newState = updateCamera(newState);
  return newState;
}

function floorName(floor: number): string {
  const names: Record<number, string> = {
    1: "The Mossy Depths",
    2: "The Crystal Mines",
    3: "The Sunken Catacombs",
    4: "The Dark Academy",
    5: "Malachar's Sanctum",
  };
  return names[floor] ?? `Floor ${floor}`;
}

// ── Spell casting ─────────────────────────────────────────────────────────────

function castSpell(state: GameState, targetX: number, targetY: number): GameState {
  const spell = state.player.spells[state.player.selectedSpellIndex];
  if (!spell) return addMessage(state, "No spell selected.");
  if (state.player.mana < spell.manaCost) return addMessage(state, "Not enough mana!");

  const d = dist(state.player.x, state.player.y, targetX, targetY);
  if (spell.range > 0 && d > spell.range) return addMessage(state, "Out of range!");

  let player = { ...state.player, mana: state.player.mana - spell.manaCost };
  let newState: GameState = { ...state, player, phase: "playing" };

  if (spell.school === "light") {
    // Healing spell
    const heal = Math.floor(spell.power + player.level * 2);
    player = { ...player, hp: Math.min(player.maxHp, player.hp + heal) };
    newState = { ...newState, player };
    newState = addMessage(newState, `${spell.name} restores ${heal} HP!`);
    newState = addFloat(newState, player.x, player.y, `+${heal}`, "#44ff88");

    if (spell.effect) {
      player = {
        ...player,
        effects: [...player.effects, { type: spell.effect, duration: spell.effectDuration ?? 2, power: 5 }],
      };
      newState = { ...newState, player };
    }
  } else {
    // Damage spell — find targets
    const targets: Enemy[] = [];

    if (spell.aoe > 0) {
      for (const e of newState.enemies) {
        if (e.alive && Math.abs(e.x - targetX) <= spell.aoe && Math.abs(e.y - targetY) <= spell.aoe) {
          targets.push(e);
        }
      }
    } else {
      const e = newState.enemies.find((en) => en.x === targetX && en.y === targetY && en.alive);
      if (e) targets.push(e);
    }

    if (targets.length === 0) {
      newState = addMessage(newState, `${spell.name} hits nothing.`);
    } else {
      newState = addMessage(newState, `You cast ${spell.name}!`);
      for (const target of targets) {
        const spellPow = spell.power + newState.player.level * 2;
        const def = Math.floor(target.defense / 2);
        const dmg = Math.max(1, spellPow - def + rand(-3, 4));

        const schemeColor: Record<string, string> = {
          fire: "#ff6600", ice: "#44aaff", lightning: "#ffff44", arcane: "#cc44ff",
        };
        const result = applyDamageToEnemy(newState, target.id, dmg, schemeColor[spell.school] ?? "#cc44ff");
        newState = result.state;

        if (!result.died && spell.effect && spell.effectDuration) {
          newState = applyEffectToEnemy(newState, target.id, {
            type: spell.effect,
            duration: spell.effectDuration,
            power: Math.floor(spell.power * 0.3),
          });
        }
      }
    }
  }

  // Enemy turns after casting
  newState = processEnemyTurns(newState);

  if (newState.player.hp <= 0) {
    return { ...newState, phase: "gameover" };
  }

  return newState;
}

// ── Stat allocation on level up ───────────────────────────────────────────────

function allocateStat(state: GameState, stat: "hp" | "mana" | "attack" | "defense"): GameState {
  let player = { ...state.player };

  switch (stat) {
    case "hp":
      player.maxHp += 20;
      player.hp = Math.min(player.maxHp, player.hp + 20);
      break;
    case "mana":
      player.maxMana += 15;
      player.mana = Math.min(player.maxMana, player.mana + 15);
      break;
    case "attack":
      player.baseAttack += 3;
      break;
    case "defense":
      player.baseDefense += 2;
      break;
  }

  return { ...state, player, pendingLevelUp: false, phase: "playing" };
}

// ── Use item ──────────────────────────────────────────────────────────────────

function useItem(state: GameState, itemId: string): GameState {
  const itemIndex = state.player.inventory.findIndex((i) => i.id === itemId);
  if (itemIndex < 0) return state;

  const item = state.player.inventory[itemIndex];
  let player = { ...state.player };
  const newInv = [...player.inventory];
  newInv.splice(itemIndex, 1);
  player.inventory = newInv;

  if (item.hpRestore) {
    const restored = Math.min(player.maxHp - player.hp, item.hpRestore);
    player.hp = player.hp + restored;
    let newState = { ...state, player };
    newState = addMessage(newState, `Used ${item.name}. Restored ${restored} HP.`);
    newState = addFloat(newState, player.x, player.y, `+${restored} HP`, "#44ff88");
    return newState;
  }

  if (item.mpRestore) {
    const restored = Math.min(player.maxMana - player.mana, item.mpRestore);
    player.mana = player.mana + restored;
    let newState = { ...state, player };
    newState = addMessage(newState, `Used ${item.name}. Restored ${restored} Mana.`);
    newState = addFloat(newState, player.x, player.y, `+${restored} MP`, "#4488ff");
    return newState;
  }

  // Equipment
  if (item.type === "weapon") {
    if (player.equipment.weapon) player.inventory = [...player.inventory, player.equipment.weapon];
    player.equipment = { ...player.equipment, weapon: item };
    return addMessage({ ...state, player }, `Equipped ${item.name}.`);
  }
  if (item.type === "armor") {
    if (player.equipment.armor) player.inventory = [...player.inventory, player.equipment.armor];
    player.equipment = { ...player.equipment, armor: item };
    return addMessage({ ...state, player }, `Equipped ${item.name}.`);
  }
  if (item.type === "accessory") {
    if (player.equipment.accessory) player.inventory = [...player.inventory, player.equipment.accessory];
    player.equipment = { ...player.equipment, accessory: item };
    return addMessage({ ...state, player }, `Equipped ${item.name}.`);
  }

  return { ...state, player };
}

// ── Initial state ─────────────────────────────────────────────────────────────

export function initGameState(playerName: string): GameState {
  const dungeon = generateDungeon(1);
  const { enemies, placedItems, storyTriggers } = populateDungeon(dungeon, 1);

  const startingSpells = ALL_SPELLS.filter((s) => STARTING_SPELLS.includes(s.id));

  const player: Player = {
    x: dungeon.startPos.x,
    y: dungeon.startPos.y,
    hp: PLAYER_BASE_HP,
    maxHp: PLAYER_BASE_HP,
    mana: PLAYER_BASE_MP,
    maxMana: PLAYER_BASE_MP,
    level: 1,
    xp: 0,
    xpToNext: XP_PER_LEVEL(1),
    baseAttack: PLAYER_BASE_ATK,
    baseDefense: PLAYER_BASE_DEF,
    spells: startingSpells,
    selectedSpellIndex: 0,
    inventory: [],
    equipment: { weapon: null, armor: null, accessory: null },
    effects: [],
    crownShards: 0,
    name: playerName,
  };

  let state: GameState = {
    phase: "playing",
    player,
    dungeon,
    floor: 1,
    enemies,
    placedItems,
    storyTriggers,
    messages: ["Welcome to the Crystal Caverns!", "Find the Crown Shards and save Brightmoor!"],
    currentStory: null,
    triggeredStories: [],
    camera: { x: 0, y: 0 },
    floatingTexts: [],
    targetCursor: { x: dungeon.startPos.x, y: dungeon.startPos.y },
    pendingLevelUp: false,
  };

  state = updateVisibility(state);
  state = updateCamera(state);

  // Show intro story
  state = triggerStory(state, "intro");

  return state;
}

// ── Main reducer ──────────────────────────────────────────────────────────────

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.phase === "story" && action.type !== "DISMISS_STORY" && action.type !== "RESTART") {
    return state;
  }

  if (state.phase === "levelup" && action.type !== "ALLOCATE_STAT" && action.type !== "RESTART") {
    return state;
  }

  switch (action.type) {
    case "START_GAME":
      return initGameState(action.playerName);

    case "RESTART":
      return { ...state, phase: "title" };

    case "DISMISS_STORY": {
      const wasVictory = state.currentStory?.id === "victory";
      return {
        ...state,
        phase: wasVictory ? "victory" : state.pendingLevelUp ? "levelup" : "playing",
        currentStory: null,
      };
    }

    case "ALLOCATE_STAT":
      return allocateStat(state, action.stat);

    case "SELECT_SPELL": {
      if (action.index < 0 || action.index >= state.player.spells.length) return state;
      return { ...state, player: { ...state.player, selectedSpellIndex: action.index } };
    }

    case "ENTER_TARGETING": {
      if (state.player.spells.length === 0) return state;
      const spell = state.player.spells[state.player.selectedSpellIndex];
      if (!spell || spell.school === "light") {
        // Self-cast spells don't need targeting
        return castSpell(state, state.player.x, state.player.y);
      }
      return {
        ...state,
        phase: "targeting",
        targetCursor: { x: state.player.x, y: state.player.y },
      };
    }

    case "EXIT_TARGETING":
      return { ...state, phase: "playing" };

    case "MOVE_CURSOR": {
      if (state.phase !== "targeting") return state;
      const nx = clamp(state.targetCursor.x + action.dx, 0, state.dungeon.width - 1);
      const ny = clamp(state.targetCursor.y + action.dy, 0, state.dungeon.height - 1);
      return { ...state, targetCursor: { x: nx, y: ny } };
    }

    case "CAST_AT_CURSOR": {
      return castSpell(state, state.targetCursor.x, state.targetCursor.y);
    }

    case "MOVE": {
      if (state.phase !== "playing") return state;

      const { dx, dy } = action;
      const nx = state.player.x + dx;
      const ny = state.player.y + dy;

      if (nx < 0 || nx >= state.dungeon.width || ny < 0 || ny >= state.dungeon.height) return state;

      const tile = state.dungeon.tiles[ny][nx];
      if (tile.type === "wall") return state;

      // Check enemy collision → melee attack
      const enemy = state.enemies.find((e) => e.alive && e.x === nx && e.y === ny);
      if (enemy) {
        let newState = playerMeleeAttack(state, enemy);
        newState = processEnemyTurns(newState);
        if (newState.player.hp <= 0) return { ...newState, phase: "gameover" };
        return newState;
      }

      // Move player
      let newState: GameState = {
        ...state,
        player: { ...state.player, x: nx, y: ny },
      };

      newState = checkItemPickup(newState);
      newState = checkStoryTriggers(newState);

      // Stairs message
      if (tile.type === "stairs_down") {
        newState = addMessage(newState, "Press [E] or [Enter] to descend.");
      }

      newState = updateVisibility(newState);
      newState = updateCamera(newState);
      newState = processEnemyTurns(newState);

      if (newState.player.hp <= 0) return { ...newState, phase: "gameover" };
      if (newState.pendingLevelUp && newState.phase === "playing") {
        return { ...newState, phase: "levelup" };
      }

      return newState;
    }

    case "USE_ITEM":
      return useItem(state, action.itemId);

    case "DESCEND_STAIRS": {
      const { player, dungeon } = state;
      if (dungeon.tiles[player.y][player.x].type !== "stairs_down") {
        return addMessage(state, "You're not on the stairs.");
      }
      if (state.floor >= 5 && state.player.crownShards < 5) {
        return addMessage(state, "You sense you must recover all Crown Shards first.");
      }
      return descendStairs(state);
    }

    default:
      return state;
  }
}
