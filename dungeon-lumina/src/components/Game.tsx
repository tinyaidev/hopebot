"use client";

import { useReducer, useEffect, useRef, useCallback, useState } from "react";
import type { GameState, FloatingText } from "@/game/types";
import { gameReducer, initGameState } from "@/game/gameLogic";
import { renderGame } from "@/game/renderer";
import { CANVAS_W, CANVAS_H, FLOOR_NAMES } from "@/game/constants";
import HUD from "./HUD";
import SpellBar from "./SpellBar";
import MessageLog from "./MessageLog";
import StoryModal from "./StoryModal";
import LevelUpModal from "./LevelUpModal";
import InventoryPanel from "./InventoryPanel";
import TitleScreen from "./TitleScreen";

const INITIAL_STATE: GameState = {
  phase: "title",
  player: {} as GameState["player"],
  dungeon: {} as GameState["dungeon"],
  floor: 1,
  enemies: [],
  placedItems: [],
  storyTriggers: [],
  messages: [],
  currentStory: null,
  triggeredStories: [],
  camera: { x: 0, y: 0 },
  floatingTexts: [],
  targetCursor: { x: 0, y: 0 },
  pendingLevelUp: false,
};

export default function Game() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const rafRef = useRef<number>(0);
  const [showInventory, setShowInventory] = useState(false);

  // Sync floating texts from state into ref
  useEffect(() => {
    if (state.floatingTexts.length > 0) {
      floatingTextsRef.current = [...floatingTextsRef.current, ...state.floatingTexts];
    }
  }, [state.floatingTexts]);

  // Render loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (state.phase !== "title") {
      renderGame(ctx, state, floatingTextsRef.current);

      // Tick floating texts
      floatingTextsRef.current = floatingTextsRef.current
        .map((ft) => ({ ...ft, y: ft.y - 0.04, life: ft.life - 0.04 }))
        .filter((ft) => ft.life > 0);
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [state]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  // Keyboard handler
  useEffect(() => {
    if (state.phase === "title") return;

    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;

      const { phase } = state;

      // Story / level-up dismissal
      if (phase === "story") {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "DISMISS_STORY" });
        }
        return;
      }

      if (phase === "levelup") {
        const map: Record<string, "hp" | "mana" | "attack" | "defense"> = {
          "1": "hp", "2": "mana", "3": "attack", "4": "defense",
        };
        if (map[e.key]) {
          e.preventDefault();
          dispatch({ type: "ALLOCATE_STAT", stat: map[e.key] });
        }
        return;
      }

      // Targeting mode
      if (phase === "targeting") {
        e.preventDefault();
        switch (e.key) {
          case "ArrowUp":    case "w": dispatch({ type: "MOVE_CURSOR", dx: 0, dy: -1 }); break;
          case "ArrowDown":  case "s": dispatch({ type: "MOVE_CURSOR", dx: 0, dy: 1 }); break;
          case "ArrowLeft":  case "a": dispatch({ type: "MOVE_CURSOR", dx: -1, dy: 0 }); break;
          case "ArrowRight": case "d": dispatch({ type: "MOVE_CURSOR", dx: 1, dy: 0 }); break;
          case "Enter": case " ":       dispatch({ type: "CAST_AT_CURSOR" }); break;
          case "Escape":                dispatch({ type: "EXIT_TARGETING" }); break;
        }
        return;
      }

      // Normal play
      switch (e.key) {
        case "ArrowUp":    case "w": e.preventDefault(); dispatch({ type: "MOVE", dx: 0, dy: -1 }); break;
        case "ArrowDown":  case "s": e.preventDefault(); dispatch({ type: "MOVE", dx: 0, dy: 1 }); break;
        case "ArrowLeft":  case "a": e.preventDefault(); dispatch({ type: "MOVE", dx: -1, dy: 0 }); break;
        case "ArrowRight": case "d": e.preventDefault(); dispatch({ type: "MOVE", dx: 1, dy: 0 }); break;

        case "t": case "T": case " ":
          e.preventDefault();
          dispatch({ type: "ENTER_TARGETING" });
          break;

        case "e": case "Enter":
          e.preventDefault();
          dispatch({ type: "DESCEND_STAIRS" });
          break;

        case "i": case "I":
          e.preventDefault();
          setShowInventory((v) => !v);
          break;

        case "Escape":
          setShowInventory(false);
          break;

        default:
          if (e.key >= "1" && e.key <= "9") {
            e.preventDefault();
            dispatch({ type: "SELECT_SPELL", index: parseInt(e.key) - 1 });
          }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state]);

  // Canvas click for spell targeting
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (state.phase !== "targeting") return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = Math.floor(((e.clientX - rect.left) * scaleX) / 40) + state.camera.x;
      const cy = Math.floor(((e.clientY - rect.top) * scaleY) / 40) + state.camera.y;

      dispatch({ type: "MOVE_CURSOR", dx: cx - state.targetCursor.x, dy: cy - state.targetCursor.y });
      setTimeout(() => dispatch({ type: "CAST_AT_CURSOR" }), 0);
    },
    [state.phase, state.camera, state.targetCursor]
  );

  // ── Title screen ───────────────────────────────────────────────────────────
  if (state.phase === "title") {
    return (
      <TitleScreen
        onStart={(name) => dispatch({ type: "START_GAME", playerName: name })}
      />
    );
  }

  // ── Game over ──────────────────────────────────────────────────────────────
  if (state.phase === "gameover") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-4">
        <div className="text-red-500 text-3xl pixel-text mb-4">✗ GAME OVER ✗</div>
        <div className="text-gray-400 text-sm pixel-text mb-2">
          {state.player.name} fell on Floor {state.floor}.
        </div>
        <div className="text-gray-600 text-xs pixel-text mb-6">
          Crown Shards recovered: {state.player.crownShards}/5 &nbsp;·&nbsp;
          Level: {state.player.level}
        </div>
        <button
          onClick={() => dispatch({ type: "RESTART" })}
          className="border border-red-700 bg-red-950 text-red-200 px-6 py-2 pixel-text text-sm rounded hover:bg-red-900 transition-colors cursor-pointer"
        >
          ▶ Try Again
        </button>
      </div>
    );
  }

  // ── Victory ────────────────────────────────────────────────────────────────
  if (state.phase === "victory" && !state.currentStory) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-4">
        <div className="text-yellow-400 text-3xl pixel-text mb-4 animate-pulse">
          ✦ VICTORY ✦
        </div>
        <div className="text-gray-200 text-sm pixel-text mb-1">
          {state.player.name} saved Brightmoor!
        </div>
        <div className="text-gray-400 text-xs pixel-text mb-6">
          All 5 Crown Shards recovered &nbsp;·&nbsp; Level {state.player.level}
        </div>
        <div className="text-6xl mb-8 animate-bounce">👑</div>
        <div className="text-gray-500 text-xs pixel-text mb-6 max-w-sm">
          The Crystal Crown of Lumina shines over Brightmoor once more.
          The darkness retreats. The light endures.
        </div>
        <button
          onClick={() => dispatch({ type: "RESTART" })}
          className="border border-yellow-700 bg-yellow-950 text-yellow-200 px-6 py-2 pixel-text text-sm rounded hover:bg-yellow-900 transition-colors cursor-pointer"
        >
          ▶ Play Again
        </button>
      </div>
    );
  }

  // ── Main game UI ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black flex flex-col items-center p-2 md:p-4">
      {/* Floor name banner */}
      <div className="text-center mb-2">
        <span className="text-cyan-600 text-xs pixel-text">
          Floor {state.floor}: {FLOOR_NAMES[state.floor] ?? "Unknown"}
        </span>
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-3 w-full max-w-6xl">
        {/* Left sidebar */}
        <div className="lg:w-52 space-y-2 shrink-0">
          <HUD player={state.player} floor={state.floor} />
          {showInventory && (
            <InventoryPanel
              inventory={state.player.inventory}
              onUse={(id) => dispatch({ type: "USE_ITEM", itemId: id })}
            />
          )}
          {!showInventory && (
            <button
              onClick={() => setShowInventory(true)}
              className="w-full text-xs py-1 border border-gray-700 rounded text-gray-500 pixel-text hover:border-gray-500 transition-colors cursor-pointer"
            >
              [I] Inventory ({state.player.inventory.length})
            </button>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onClick={handleCanvasClick}
            className="rounded border border-gray-800 cursor-crosshair"
            style={{
              imageRendering: "pixelated",
              maxWidth: "100%",
              height: "auto",
            }}
          />

          {/* Message log below canvas */}
          <div className="w-full max-w-[760px]">
            <MessageLog messages={state.messages} />
          </div>

          {/* Controls hint */}
          <div className="text-gray-700 text-xs pixel-text text-center">
            WASD/Arrows move &nbsp;·&nbsp; T/Space cast spell &nbsp;·&nbsp;
            E/Enter use stairs &nbsp;·&nbsp; 1-{state.player.spells.length} select spell
          </div>
        </div>

        {/* Right sidebar */}
        <div className="lg:w-56 shrink-0">
          <SpellBar
            player={state.player}
            onSelect={(i) => dispatch({ type: "SELECT_SPELL", index: i })}
            onCast={() => dispatch({ type: "ENTER_TARGETING" })}
            targeting={state.phase === "targeting"}
          />
        </div>
      </div>

      {/* Modals */}
      {state.phase === "story" && state.currentStory && (
        <StoryModal
          story={state.currentStory}
          onDismiss={() => dispatch({ type: "DISMISS_STORY" })}
        />
      )}

      {state.phase === "levelup" && (
        <LevelUpModal
          player={state.player}
          onAllocate={(stat) => dispatch({ type: "ALLOCATE_STAT", stat })}
        />
      )}
    </div>
  );
}
