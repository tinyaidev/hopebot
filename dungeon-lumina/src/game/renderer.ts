import type { GameState, Enemy, FloatingText } from "./types";
import { TILE_SIZE, COLORS, VIEWPORT_W, VIEWPORT_H } from "./constants";

// ── Pixel helpers ─────────────────────────────────────────────────────────────

function px(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

function pxCircle(ctx: CanvasRenderingContext2D, color: string, cx: number, cy: number, r: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(Math.floor(cx), Math.floor(cy), r, 0, Math.PI * 2);
  ctx.fill();
}

// ── Tile rendering ────────────────────────────────────────────────────────────

function drawFloorTile(ctx: CanvasRenderingContext2D, sx: number, sy: number, visible: boolean): void {
  const base = visible ? COLORS.floor : COLORS.floorExplored;
  px(ctx, base, sx, sy, TILE_SIZE, TILE_SIZE);

  if (visible) {
    // Subtle grid lines
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(sx + 0.5, sy + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

    // Random noise pixels for texture
    const seed = (sx * 7 + sy * 13) % 100;
    if (seed < 20) {
      px(ctx, COLORS.floorAlt, sx + (seed % 5) * 6 + 5, sy + Math.floor(seed / 5) * 6 + 5, 3, 3);
    }
  }
}

function drawWallTile(ctx: CanvasRenderingContext2D, sx: number, sy: number, visible: boolean): void {
  const base = visible ? COLORS.wallEdge : COLORS.wallExplored;
  px(ctx, base, sx, sy, TILE_SIZE, TILE_SIZE);

  if (visible) {
    // Stone block pattern
    px(ctx, COLORS.wall, sx + 1, sy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    // Highlight top/left edges
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(sx + 1, sy + 1, TILE_SIZE - 2, 3);
    ctx.fillRect(sx + 1, sy + 1, 3, TILE_SIZE - 2);
  }
}

function drawStairsTile(ctx: CanvasRenderingContext2D, sx: number, sy: number, down: boolean, visible: boolean): void {
  const base = down ? (visible ? "#0a3a0a" : "#061006") : (visible ? "#0a0a4a" : "#06060e");
  px(ctx, base, sx, sy, TILE_SIZE, TILE_SIZE);

  if (visible) {
    const color = down ? "#22dd22" : "#2222dd";
    const cx = sx + TILE_SIZE / 2;
    const cy = sy + TILE_SIZE / 2;

    // Draw spiral arrow
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 8);
    const ay = down ? cy + 8 : cy - 10;
    const aDir = down ? 1 : -1;
    ctx.moveTo(cx - 5, ay - aDir * 5);
    ctx.lineTo(cx, ay);
    ctx.lineTo(cx + 5, ay - aDir * 5);
    ctx.stroke();

    // Label
    ctx.fillStyle = color;
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(down ? "▼" : "▲", cx, sy + TILE_SIZE - 6);
  }
}

// ── Entity sprites ────────────────────────────────────────────────────────────

function drawPlayer(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
  const s = TILE_SIZE;
  const m = 4; // margin

  // Hat (pointed wizard hat)
  px(ctx, COLORS.playerHat, sx + s * 0.35, sy + m, s * 0.3, s * 0.2);
  px(ctx, COLORS.playerHat, sx + s * 0.25, sy + m + s * 0.18, s * 0.5, s * 0.08);

  // Face
  px(ctx, COLORS.playerFace, sx + s * 0.3, sy + m + s * 0.25, s * 0.4, s * 0.28);

  // Eyes
  px(ctx, "#111122", sx + s * 0.35, sy + m + s * 0.32, 4, 4);
  px(ctx, "#111122", sx + s * 0.57, sy + m + s * 0.32, 4, 4);

  // Mouth
  px(ctx, "#aa6644", sx + s * 0.42, sy + m + s * 0.46, s * 0.16, 2);

  // Robe body
  px(ctx, COLORS.playerRobe, sx + s * 0.2, sy + m + s * 0.52, s * 0.6, s * 0.42);

  // Robe detail
  px(ctx, COLORS.playerRobeDark, sx + s * 0.47, sy + m + s * 0.52, 3, s * 0.42);

  // Arms
  px(ctx, COLORS.playerRobe, sx + s * 0.08, sy + m + s * 0.54, s * 0.15, s * 0.2);
  px(ctx, COLORS.playerRobe, sx + s * 0.77, sy + m + s * 0.54, s * 0.15, s * 0.2);

  // Staff
  px(ctx, COLORS.playerStaff, sx + s * 0.8, sy + m + s * 0.2, 3, s * 0.65);

  // Staff gem (glowing)
  pxCircle(ctx, COLORS.playerGem, sx + s * 0.815, sy + m + s * 0.15, 5);
  ctx.shadowColor = COLORS.playerGem;
  ctx.shadowBlur = 6;
  pxCircle(ctx, "#ffffff", sx + s * 0.815, sy + m + s * 0.15, 3);
  ctx.shadowBlur = 0;
}

function drawSlime(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string): void {
  const cx = sx + TILE_SIZE / 2;
  const cy = sy + TILE_SIZE / 2 + 4;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  px(ctx, "#ffffff", cx - 5, cy - 3, 4, 4);
  px(ctx, "#ffffff", cx + 2, cy - 3, 4, 4);
  px(ctx, "#000000", cx - 4, cy - 2, 2, 2);
  px(ctx, "#000000", cx + 3, cy - 2, 2, 2);
}

function drawHumanoid(ctx: CanvasRenderingContext2D, sx: number, sy: number, bodyColor: string, headColor: string): void {
  const s = TILE_SIZE;

  // Head
  px(ctx, headColor, sx + s * 0.35, sy + 4, s * 0.3, s * 0.25);

  // Eyes
  px(ctx, "#ff2222", sx + s * 0.38, sy + 10, 3, 3);
  px(ctx, "#ff2222", sx + s * 0.57, sy + 10, 3, 3);

  // Body
  px(ctx, bodyColor, sx + s * 0.25, sy + s * 0.38, s * 0.5, s * 0.38);

  // Arms
  px(ctx, bodyColor, sx + s * 0.1, sy + s * 0.42, s * 0.16, s * 0.22);
  px(ctx, bodyColor, sx + s * 0.74, sy + s * 0.42, s * 0.16, s * 0.22);

  // Legs
  px(ctx, bodyColor, sx + s * 0.28, sy + s * 0.74, s * 0.18, s * 0.22);
  px(ctx, bodyColor, sx + s * 0.54, sy + s * 0.74, s * 0.18, s * 0.22);
}

function drawBat(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
  const cx = sx + TILE_SIZE / 2;
  const cy = sy + TILE_SIZE / 2;

  // Wings
  ctx.fillStyle = "#663388";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx - 18, cy - 12, cx - 16, cy + 4, cx - 6, cy);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx + 18, cy - 12, cx + 16, cy + 4, cx + 6, cy);
  ctx.fill();

  // Body
  pxCircle(ctx, "#442255", cx, cy, 5);

  // Eyes
  px(ctx, "#ff0000", cx - 3, cy - 2, 2, 2);
  px(ctx, "#ff0000", cx + 1, cy - 2, 2, 2);
}

function drawCrystalEntity(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string): void {
  const cx = sx + TILE_SIZE / 2;
  const cy = sy + TILE_SIZE / 2;

  ctx.fillStyle = color;
  // Diamond shape
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx + 10, cy);
  ctx.lineTo(cx, cy + 10);
  ctx.lineTo(cx - 10, cy);
  ctx.closePath();
  ctx.fill();

  // Sheen
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - 14);
  ctx.lineTo(cx + 8, cy - 4);
  ctx.lineTo(cx - 2, cy - 2);
  ctx.closePath();
  ctx.fill();
}

function drawGhost(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
  const cx = sx + TILE_SIZE / 2;
  const cy = sy + TILE_SIZE / 2;

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#aabbff";

  // Ghost body
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 11, Math.PI, 0);
  ctx.lineTo(cx + 11, cy + 8);
  ctx.bezierCurveTo(cx + 6, cy + 4, cx + 2, cy + 10, cx, cy + 6);
  ctx.bezierCurveTo(cx - 2, cy + 10, cx - 6, cy + 4, cx - 11, cy + 8);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1.0;

  // Eyes
  px(ctx, "#222266", cx - 4, cy - 6, 4, 5);
  px(ctx, "#222266", cx + 1, cy - 6, 4, 5);
}

function drawSkeleton(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
  const s = TILE_SIZE;

  // Skull
  px(ctx, "#eeeecc", sx + s * 0.35, sy + 4, s * 0.3, s * 0.25);
  px(ctx, "#000000", sx + s * 0.38, sy + 9, 4, 4);
  px(ctx, "#000000", sx + s * 0.56, sy + 9, 4, 4);

  // Ribcage
  px(ctx, "#eeeecc", sx + s * 0.37, sy + s * 0.38, s * 0.26, s * 0.06);
  px(ctx, "#eeeecc", sx + s * 0.37, sy + s * 0.48, s * 0.26, s * 0.06);
  px(ctx, "#eeeecc", sx + s * 0.37, sy + s * 0.58, s * 0.26, s * 0.06);
  px(ctx, "#eeeecc", sx + s * 0.47, sy + s * 0.33, s * 0.06, s * 0.38);

  // Legs
  px(ctx, "#ddddaa", sx + s * 0.33, sy + s * 0.74, s * 0.14, s * 0.22);
  px(ctx, "#ddddaa", sx + s * 0.54, sy + s * 0.74, s * 0.14, s * 0.22);
}

function drawShadowFigure(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string): void {
  const s = TILE_SIZE;

  // Shadow aura
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  // Robed figure
  px(ctx, "#111111", sx + s * 0.3, sy + 4, s * 0.4, s * 0.25);
  px(ctx, color,     sx + s * 0.35, sy + 10, 4, 4);
  px(ctx, color,     sx + s * 0.55, sy + 10, 4, 4);
  px(ctx, "#1a1a1a", sx + s * 0.18, sy + s * 0.38, s * 0.64, s * 0.58);
  // Hood
  px(ctx, "#222222", sx + s * 0.25, sy + 2, s * 0.5, s * 0.12);

  ctx.shadowBlur = 0;
}

function drawBoss(ctx: CanvasRenderingContext2D, sx: number, sy: number, type: string): void {
  // Bosses are larger and pulsing
  ctx.shadowBlur = 10;

  switch (type) {
    case "slime_king":
      ctx.shadowColor = "#44ff44";
      drawSlime(ctx, sx - 4, sy - 6, "#228822");
      // Crown
      px(ctx, "#ffcc00", sx + TILE_SIZE * 0.3, sy + 2, TILE_SIZE * 0.4, 5);
      px(ctx, "#ffcc00", sx + TILE_SIZE * 0.3, sy, 4, 7);
      px(ctx, "#ffcc00", sx + TILE_SIZE * 0.46, sy - 2, 4, 9);
      px(ctx, "#ffcc00", sx + TILE_SIZE * 0.62, sy, 4, 7);
      break;
    case "crystal_guardian":
      ctx.shadowColor = "#00cccc";
      drawCrystalEntity(ctx, sx, sy - 4, "#00bbbb");
      // Extra crystals
      ctx.fillStyle = "#00aaaa";
      ctx.beginPath();
      ctx.moveTo(sx + 6, sy + 20);
      ctx.lineTo(sx + 12, sy + 8);
      ctx.lineTo(sx + 18, sy + 20);
      ctx.closePath();
      ctx.fill();
      break;
    case "forgotten_knight":
      ctx.shadowColor = "#888888";
      drawHumanoid(ctx, sx, sy, "#666677", "#888899");
      // Helmet plume
      px(ctx, "#cc2222", sx + TILE_SIZE * 0.4, sy, 4, 8);
      break;
    case "dark_apprentice":
      ctx.shadowColor = "#8844cc";
      drawShadowFigure(ctx, sx, sy, "#8844cc");
      break;
    case "malachar":
      ctx.shadowColor = "#cc0000";
      // Large imposing figure
      px(ctx, "#220000", sx + 4, sy + 2, TILE_SIZE - 8, TILE_SIZE - 4);
      px(ctx, "#440000", sx + 8, sy + 4, TILE_SIZE - 16, TILE_SIZE - 8);
      // Glowing eyes
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 12;
      px(ctx, "#ff0000", sx + TILE_SIZE * 0.32, sy + 12, 5, 5);
      px(ctx, "#ff0000", sx + TILE_SIZE * 0.6, sy + 12, 5, 5);
      // Crown (shattered)
      for (let i = 0; i < 3; i++) {
        px(ctx, "#cc3300", sx + TILE_SIZE * (0.3 + i * 0.18), sy + 4, 4, 6);
      }
      break;
    default:
      drawHumanoid(ctx, sx, sy, "#880000", "#aa2222");
  }

  ctx.shadowBlur = 0;
}

function drawEnemySprite(ctx: CanvasRenderingContext2D, enemy: Enemy, sx: number, sy: number): void {
  if (enemy.isBoss) {
    drawBoss(ctx, sx, sy, enemy.type);
    return;
  }

  switch (enemy.type) {
    case "slime":
      drawSlime(ctx, sx, sy, "#44aa44");
      break;
    case "goblin":
      drawHumanoid(ctx, sx, sy, "#2d5c2d", "#5a8a4a");
      break;
    case "bat":
      drawBat(ctx, sx, sy);
      break;
    case "crystal_shard":
      drawCrystalEntity(ctx, sx, sy, "#44cccc");
      break;
    case "gem_thief":
      drawHumanoid(ctx, sx, sy, "#886622", "#bb9944");
      break;
    case "stone_golem":
      drawHumanoid(ctx, sx, sy, "#667788", "#889aaa");
      break;
    case "skeleton":
      drawSkeleton(ctx, sx, sy);
      break;
    case "ghost":
      drawGhost(ctx, sx, sy);
      break;
    case "cursed_armor":
      drawHumanoid(ctx, sx, sy, "#446688", "#668899");
      break;
    case "shadow_scholar":
      drawShadowFigure(ctx, sx, sy, "#6622aa");
      break;
    case "enchanted_book":
      // Flying book
      px(ctx, "#885522", sx + 8, sy + 10, TILE_SIZE - 16, TILE_SIZE - 16);
      px(ctx, "#aa7733", sx + 9, sy + 11, TILE_SIZE - 18, 4);
      px(ctx, "#aa7733", sx + 9, sy + 17, TILE_SIZE - 18, 4);
      ctx.fillStyle = "#cc0000";
      ctx.font = "bold 14px serif";
      ctx.textAlign = "center";
      ctx.fillText("✦", sx + TILE_SIZE / 2, sy + TILE_SIZE / 2 + 4);
      break;
    case "construct_guard":
      drawHumanoid(ctx, sx, sy, "#334455", "#446677");
      // Glowing eye
      ctx.shadowColor = "#00ffff";
      ctx.shadowBlur = 6;
      px(ctx, "#00ffff", sx + TILE_SIZE * 0.45, sy + 10, 5, 5);
      ctx.shadowBlur = 0;
      break;
    case "demon_scout":
      drawHumanoid(ctx, sx, sy, "#660022", "#990033");
      // Horns
      px(ctx, "#440011", sx + TILE_SIZE * 0.3, sy + 2, 4, 7);
      px(ctx, "#440011", sx + TILE_SIZE * 0.62, sy + 2, 4, 7);
      break;
    case "void_walker":
      ctx.globalAlpha = 0.85;
      drawShadowFigure(ctx, sx, sy, "#220044");
      ctx.globalAlpha = 1;
      break;
    case "shadow_dragon":
      drawHumanoid(ctx, sx, sy, "#220033", "#440055");
      // Wings
      ctx.fillStyle = "#330044";
      ctx.beginPath();
      ctx.moveTo(sx + 4, sy + 20);
      ctx.lineTo(sx - 8, sy + 8);
      ctx.lineTo(sx + 10, sy + 18);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx + TILE_SIZE - 4, sy + 20);
      ctx.lineTo(sx + TILE_SIZE + 8, sy + 8);
      ctx.lineTo(sx + TILE_SIZE - 10, sy + 18);
      ctx.fill();
      break;
    default:
      drawHumanoid(ctx, sx, sy, "#882222", "#aa3333");
  }
}

// ── HP bar over enemy ─────────────────────────────────────────────────────────

function drawHPBar(ctx: CanvasRenderingContext2D, entity: { hp: number; maxHp: number }, sx: number, sy: number): void {
  const barW = TILE_SIZE - 4;
  const barH = 4;
  const pct = entity.hp / entity.maxHp;

  px(ctx, "#220000", sx + 2, sy + TILE_SIZE - 6, barW, barH);
  px(ctx, pct > 0.5 ? "#22cc22" : pct > 0.25 ? "#cccc22" : "#cc2222", sx + 2, sy + TILE_SIZE - 6, Math.ceil(barW * pct), barH);
}

// ── Items ─────────────────────────────────────────────────────────────────────

function drawItemSprite(ctx: CanvasRenderingContext2D, color: string, sx: number, sy: number): void {
  const cx = sx + TILE_SIZE / 2;
  const cy = sy + TILE_SIZE / 2;

  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  pxCircle(ctx, color, cx, cy, 7);
  pxCircle(ctx, "#ffffff", cx, cy, 3);
  ctx.shadowBlur = 0;
}

function drawCrownShard(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
  const cx = sx + TILE_SIZE / 2;
  const cy = sy + TILE_SIZE / 2;

  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 12;

  ctx.fillStyle = "#ffd700";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx + 5, cy);
  ctx.lineTo(cx + 12, cy - 4);
  ctx.lineTo(cx + 8, cy + 10);
  ctx.lineTo(cx - 8, cy + 10);
  ctx.lineTo(cx - 12, cy - 4);
  ctx.lineTo(cx - 5, cy);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx + 5, cy);
  ctx.lineTo(cx, cy - 4);
  ctx.closePath();
  ctx.fill();
}

// ── Status effect indicators ──────────────────────────────────────────────────

function drawEffectIndicators(
  ctx: CanvasRenderingContext2D,
  effects: Array<{ type: string }>,
  sx: number,
  sy: number
): void {
  const colors: Record<string, string> = {
    burn: "#ff6600",
    freeze: "#44aaff",
    poison: "#44cc44",
    stunned: "#ffff44",
    blessed: "#ffffaa",
  };

  let i = 0;
  for (const ef of effects) {
    const c = colors[ef.type];
    if (c) {
      pxCircle(ctx, c, sx + 5 + i * 8, sy + 5, 3);
      i++;
    }
  }
}

// ── Targeting overlay ─────────────────────────────────────────────────────────

function drawTargetingOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number
): void {
  const spell = state.player.spells[state.player.selectedSpellIndex];
  if (!spell) return;

  const { targetCursor, player } = state;

  // Draw range circle
  for (let ty = 0; ty < state.dungeon.height; ty++) {
    for (let tx = 0; tx < state.dungeon.width; tx++) {
      const d = Math.abs(tx - player.x) + Math.abs(ty - player.y);
      if (d <= spell.range) {
        const sx = (tx - camX) * TILE_SIZE;
        const sy = (ty - camY) * TILE_SIZE;
        if (sx >= 0 && sy >= 0 && sx < VIEWPORT_W * TILE_SIZE && sy < VIEWPORT_H * TILE_SIZE) {
          ctx.fillStyle = COLORS.targetValid;
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // Draw AoE preview
  if (spell.aoe > 0) {
    for (let dy = -spell.aoe; dy <= spell.aoe; dy++) {
      for (let dx = -spell.aoe; dx <= spell.aoe; dx++) {
        const tx = targetCursor.x + dx;
        const ty = targetCursor.y + dy;
        const sx = (tx - camX) * TILE_SIZE;
        const sy = (ty - camY) * TILE_SIZE;
        ctx.fillStyle = "rgba(255,120,0,0.3)";
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Draw cursor
  const curSx = (targetCursor.x - camX) * TILE_SIZE;
  const curSy = (targetCursor.y - camY) * TILE_SIZE;
  ctx.strokeStyle = COLORS.targetCursor;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 2]);
  ctx.strokeRect(curSx + 1, curSy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  ctx.setLineDash([]);
}

// ── Floating texts ────────────────────────────────────────────────────────────

function drawFloatingTexts(
  ctx: CanvasRenderingContext2D,
  texts: FloatingText[],
  camX: number,
  camY: number
): void {
  for (const ft of texts) {
    const sx = (ft.x - camX) * TILE_SIZE + TILE_SIZE / 2;
    const sy = (ft.y - camY) * TILE_SIZE - (1 - ft.life) * 30;

    ctx.globalAlpha = Math.min(1, ft.life * 1.5);
    ctx.fillStyle = ft.color;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 4;
    ctx.fillText(ft.text, sx, sy);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

// ── Main render ───────────────────────────────────────────────────────────────

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  floatingTexts: FloatingText[]
): void {
  const { dungeon, player, enemies, placedItems, camera } = state;
  const camX = camera.x;
  const camY = camera.y;

  // Clear
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, VIEWPORT_W * TILE_SIZE, VIEWPORT_H * TILE_SIZE);

  // Draw tiles
  for (let ty = camY; ty < Math.min(camY + VIEWPORT_H + 1, dungeon.height); ty++) {
    for (let tx = camX; tx < Math.min(camX + VIEWPORT_W + 1, dungeon.width); tx++) {
      const tile = dungeon.tiles[ty][tx];
      if (!tile.explored) continue;

      const sx = (tx - camX) * TILE_SIZE;
      const sy = (ty - camY) * TILE_SIZE;

      switch (tile.type) {
        case "floor":
          drawFloorTile(ctx, sx, sy, tile.visible);
          break;
        case "wall":
          drawWallTile(ctx, sx, sy, tile.visible);
          break;
        case "stairs_down":
          drawStairsTile(ctx, sx, sy, true, tile.visible);
          break;
        case "stairs_up":
          drawStairsTile(ctx, sx, sy, false, tile.visible);
          break;
      }
    }
  }

  // Draw placed items (only visible tiles)
  for (const pi of placedItems) {
    if (pi.collected) continue;
    const tile = dungeon.tiles[pi.y]?.[pi.x];
    if (!tile?.visible) continue;

    const sx = (pi.x - camX) * TILE_SIZE;
    const sy = (pi.y - camY) * TILE_SIZE;

    if (pi.item.id === "crown_shard") {
      drawCrownShard(ctx, sx, sy);
    } else {
      drawItemSprite(ctx, pi.item.color, sx, sy);
    }
  }

  // Draw enemies (only visible)
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const tile = dungeon.tiles[enemy.y]?.[enemy.x];
    if (!tile?.visible) continue;

    const sx = (enemy.x - camX) * TILE_SIZE;
    const sy = (enemy.y - camY) * TILE_SIZE;

    drawEnemySprite(ctx, enemy, sx, sy);
    drawHPBar(ctx, enemy, sx, sy);
    drawEffectIndicators(ctx, enemy.effects, sx, sy);
  }

  // Draw targeting overlay
  if (state.phase === "targeting") {
    drawTargetingOverlay(ctx, state, camX, camY);
  }

  // Draw player
  const psx = (player.x - camX) * TILE_SIZE;
  const psy = (player.y - camY) * TILE_SIZE;
  drawPlayer(ctx, psx, psy);
  drawEffectIndicators(ctx, player.effects, psx, psy);

  // Floating texts
  drawFloatingTexts(ctx, floatingTexts, camX, camY);
}
