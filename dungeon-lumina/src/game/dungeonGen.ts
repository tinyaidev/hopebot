import type { DungeonMap, Tile, Room, Vec2, PlacedItem, StoryTrigger } from "./types";
import type { Enemy } from "./types";
import { MAP_WIDTH, MAP_HEIGHT } from "./constants";
import { FLOOR_ENEMY_TYPES, createEnemy } from "./enemies";
import { randomItemForFloor, getItem } from "./items";

function blankTile(): Tile {
  return { type: "wall", visible: false, explored: false };
}

function roomsOverlap(a: Room, b: Room, pad = 1): boolean {
  return (
    a.x - pad < b.x + b.w + pad &&
    a.x + a.w + pad > b.x - pad &&
    a.y - pad < b.y + b.h + pad &&
    a.y + a.h + pad > b.y - pad
  );
}

function carveRoom(tiles: Tile[][], room: Room, id: number): void {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      tiles[y][x] = { type: "floor", visible: false, explored: false, roomId: id };
    }
  }
}

function carveCorridor(tiles: Tile[][], x1: number, y1: number, x2: number, y2: number): void {
  // Horizontal then vertical
  const hx0 = Math.min(x1, x2);
  const hx1 = Math.max(x1, x2);
  for (let x = hx0; x <= hx1; x++) {
    tiles[y1][x] = { type: "floor", visible: false, explored: false };
  }
  const vy0 = Math.min(y1, y2);
  const vy1 = Math.max(y1, y2);
  for (let y = vy0; y <= vy1; y++) {
    tiles[y][x2] = { type: "floor", visible: false, explored: false };
  }
}

function roomCenter(room: Room): Vec2 {
  return {
    x: Math.floor(room.x + room.w / 2),
    y: Math.floor(room.y + room.h / 2),
  };
}

export function generateDungeon(floor: number): DungeonMap {
  const width = MAP_WIDTH;
  const height = MAP_HEIGHT;

  // Init all walls
  const tiles: Tile[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, blankTile)
  );

  const rooms: Room[] = [];
  const targetRooms = 8 + floor;

  for (let attempts = 0; attempts < 500 && rooms.length < targetRooms; attempts++) {
    const w = 4 + Math.floor(Math.random() * 7);
    const h = 4 + Math.floor(Math.random() * 6);
    const x = 1 + Math.floor(Math.random() * (width - w - 2));
    const y = 1 + Math.floor(Math.random() * (height - h - 2));

    const candidate: Room = { x, y, w, h, id: rooms.length };
    if (!rooms.some((r) => roomsOverlap(r, candidate, 1))) {
      carveRoom(tiles, candidate, rooms.length);
      if (rooms.length > 0) {
        const prev = roomCenter(rooms[rooms.length - 1]);
        const cur = roomCenter(candidate);
        carveCorridor(tiles, prev.x, prev.y, cur.x, cur.y);
      }
      rooms.push(candidate);
    }
  }

  // Ensure we have at least 2 rooms
  if (rooms.length < 2) {
    const fallback: Room = { x: 2, y: 2, w: 8, h: 6, id: 0 };
    const fallback2: Room = { x: 20, y: 15, w: 8, h: 6, id: 1 };
    carveRoom(tiles, fallback, 0);
    carveRoom(tiles, fallback2, 1);
    carveCorridor(tiles, 6, 5, 24, 18);
    rooms.push(fallback, fallback2);
  }

  const startPos = roomCenter(rooms[0]);
  const lastRoom = rooms[rooms.length - 1];
  const stairsDownPos = roomCenter(lastRoom);

  tiles[stairsDownPos.y][stairsDownPos.x] = {
    type: "stairs_down",
    visible: false,
    explored: false,
    roomId: lastRoom.id,
  };

  let stairsUp: Vec2 | null = null;
  if (floor > 1) {
    stairsUp = { x: startPos.x, y: startPos.y };
    tiles[startPos.y][startPos.x] = {
      type: "stairs_up",
      visible: false,
      explored: false,
      roomId: rooms[0].id,
    };
  }

  return {
    width,
    height,
    tiles,
    rooms,
    stairsDown: stairsDownPos,
    stairsUp,
    startPos,
  };
}

export function populateDungeon(
  dungeon: DungeonMap,
  floor: number
): { enemies: Enemy[]; placedItems: PlacedItem[]; storyTriggers: StoryTrigger[] } {
  const enemies: Enemy[] = [];
  const placedItems: PlacedItem[] = [];
  const storyTriggers: StoryTrigger[] = [];

  const enemyTypes = FLOOR_ENEMY_TYPES[floor] ?? FLOOR_ENEMY_TYPES[1];
  const regularTypes = enemyTypes.slice(0, -1);
  const bossType = enemyTypes[enemyTypes.length - 1];

  const occupied = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  occupied.add(key(dungeon.startPos.x, dungeon.startPos.y));
  occupied.add(key(dungeon.stairsDown.x, dungeon.stairsDown.y));

  // Populate non-start, non-last rooms with enemies and items
  for (let i = 1; i < dungeon.rooms.length - 1; i++) {
    const room = dungeon.rooms[i];
    const numEnemies = 1 + Math.floor(Math.random() * 3);

    for (let n = 0; n < numEnemies; n++) {
      const pos = randomFloorPos(dungeon, room, occupied);
      if (pos) {
        const type = regularTypes[Math.floor(Math.random() * regularTypes.length)];
        enemies.push(createEnemy(type, pos.x, pos.y));
        occupied.add(key(pos.x, pos.y));
      }
    }

    // 60% chance of item in each room
    if (Math.random() < 0.6) {
      const pos = randomFloorPos(dungeon, room, occupied);
      if (pos) {
        placedItems.push({ item: randomItemForFloor(floor), x: pos.x, y: pos.y, collected: false });
        occupied.add(key(pos.x, pos.y));
      }
    }
  }

  // Boss in last room
  const lastRoom = dungeon.rooms[dungeon.rooms.length - 1];
  const bossPos = { x: lastRoom.x + Math.floor(lastRoom.w / 2), y: lastRoom.y + Math.floor(lastRoom.h / 2) };
  // Offset boss from stairs
  const bossX = bossPos.x === dungeon.stairsDown.x ? bossPos.x - 1 : bossPos.x;
  enemies.push(createEnemy(bossType, bossX, bossPos.y));
  occupied.add(key(bossX, bossPos.y));

  // Crown shard near boss (will auto-collect on boss death in gameLogic)
  placedItems.push({
    item: getItem("crown_shard"),
    x: dungeon.stairsDown.x,
    y: dungeon.stairsDown.y,
    collected: true, // hidden until boss dies
  });

  // Story trigger in the third room (or second if few rooms)
  const storyRoomIdx = Math.min(2, dungeon.rooms.length - 2);
  const storyRoom = dungeon.rooms[storyRoomIdx];
  const storyCenter = roomCenter(storyRoom);
  storyTriggers.push({
    x: storyCenter.x,
    y: storyCenter.y,
    storyId: `floor_${floor}_discover`,
    triggered: false,
  });

  // Boss intro trigger right before boss room entrance
  const preLastRoom = dungeon.rooms[dungeon.rooms.length - 2];
  const preLastCenter = roomCenter(preLastRoom);
  storyTriggers.push({
    x: preLastCenter.x,
    y: preLastCenter.y,
    storyId: `floor_${floor}_boss_intro`,
    triggered: false,
  });

  return { enemies, placedItems, storyTriggers };
}

function randomFloorPos(
  dungeon: DungeonMap,
  room: Room,
  occupied: Set<string>
): Vec2 | null {
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
    const y = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
    const tile = dungeon.tiles[y]?.[x];
    if (tile && tile.type === "floor" && !occupied.has(`${x},${y}`)) {
      return { x, y };
    }
  }
  return null;
}
