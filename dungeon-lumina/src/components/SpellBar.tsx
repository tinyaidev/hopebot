"use client";

import type { Spell, Player } from "@/game/types";
import { SCHOOL_COLORS } from "@/game/spells";

interface Props {
  player: Player;
  onSelect: (index: number) => void;
  onCast: () => void;
  targeting: boolean;
}

export default function SpellBar({ player, onSelect, onCast, targeting }: Props) {
  const { spells, selectedSpellIndex, mana } = player;
  const selectedSpell = spells[selectedSpellIndex];

  return (
    <div className="bg-gray-950 border border-gray-800 rounded p-3 pixel-text">
      <div className="text-gray-500 text-xs mb-2 flex items-center justify-between">
        <span>Spells (1–{spells.length})</span>
        {targeting && <span className="text-yellow-300 animate-pulse">★ TARGETING</span>}
      </div>

      {/* Spell grid */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {spells.map((spell, i) => {
          const color = SCHOOL_COLORS[spell.school] ?? "#ffffff";
          const canCast = mana >= spell.manaCost;
          const selected = i === selectedSpellIndex;

          return (
            <button
              key={spell.id}
              onClick={() => onSelect(i)}
              title={`${spell.name} (${spell.manaCost} MP)\n${spell.description}`}
              className={`
                relative text-xs px-1 py-2 rounded border cursor-pointer transition-all
                ${selected
                  ? "border-yellow-400 bg-gray-800"
                  : "border-gray-700 bg-gray-900 hover:border-gray-500"}
                ${!canCast ? "opacity-40" : ""}
              `}
            >
              <span className="text-xs font-bold" style={{ color }}>{i + 1}</span>
              <div
                className="text-xs mt-0.5 leading-tight truncate"
                style={{ color, fontSize: "9px" }}
              >
                {spell.name}
              </div>
              <div className="text-blue-400 text-xs" style={{ fontSize: "9px" }}>
                {spell.manaCost}mp
              </div>
              {selected && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected spell info */}
      {selectedSpell && (
        <div className="border-t border-gray-800 pt-2 space-y-1">
          <div className="flex items-center justify-between">
            <span style={{ color: SCHOOL_COLORS[selectedSpell.school] }} className="text-xs">
              {selectedSpell.name}
            </span>
            <span className="text-blue-300 text-xs">{selectedSpell.manaCost} MP</span>
          </div>
          <div className="text-gray-500 text-xs leading-relaxed">
            {selectedSpell.description}
          </div>
          <div className="flex gap-3 text-xs text-gray-600">
            <span>⚡ {selectedSpell.power} pow</span>
            {selectedSpell.range > 0 && <span>📏 {selectedSpell.range} rng</span>}
            {selectedSpell.aoe > 0 && <span>💥 {selectedSpell.aoe} aoe</span>}
          </div>

          <button
            onClick={onCast}
            disabled={mana < selectedSpell.manaCost}
            className={`
              w-full mt-2 py-1.5 rounded text-xs border transition-colors cursor-pointer
              ${targeting
                ? "border-yellow-400 bg-yellow-950 text-yellow-200 animate-pulse"
                : mana >= selectedSpell.manaCost
                  ? "border-indigo-500 bg-indigo-950 text-indigo-200 hover:bg-indigo-900"
                  : "border-gray-700 bg-gray-900 text-gray-600 cursor-not-allowed"
              }
            `}
          >
            {targeting
              ? "[ Arrow keys to aim, Space/Enter to fire ]"
              : selectedSpell.school === "light"
                ? "✦ CAST (self)"
                : "T — Enter Targeting"}
          </button>
        </div>
      )}
    </div>
  );
}
