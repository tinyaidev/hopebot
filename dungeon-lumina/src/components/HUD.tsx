"use client";

import type { Player } from "@/game/types";

interface Props {
  player: Player;
  floor: number;
}

function Bar({ value, max, color, bg }: { value: number; max: number; color: string; bg: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className={`h-3 rounded-sm overflow-hidden ${bg}`}>
      <div
        className={`h-full rounded-sm transition-all duration-200 ${color}`}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

export default function HUD({ player, floor }: Props) {
  const xpPct = player.xp / player.xpToNext;

  return (
    <div className="bg-gray-950 border border-gray-800 rounded p-3 pixel-text text-xs space-y-2">
      {/* Name & floor */}
      <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-1">
        <span className="text-yellow-300 text-sm">{player.name}</span>
        <span className="text-gray-400">Lv.{player.level}</span>
        <span className="text-cyan-400">Floor {floor}</span>
      </div>

      {/* HP */}
      <div className="space-y-1">
        <div className="flex justify-between text-red-300">
          <span>HP</span>
          <span>{player.hp} / {player.maxHp}</span>
        </div>
        <Bar value={player.hp} max={player.maxHp} color="bg-red-500" bg="bg-red-950" />
      </div>

      {/* Mana */}
      <div className="space-y-1">
        <div className="flex justify-between text-blue-300">
          <span>MP</span>
          <span>{player.mana} / {player.maxMana}</span>
        </div>
        <Bar value={player.mana} max={player.maxMana} color="bg-blue-500" bg="bg-blue-950" />
      </div>

      {/* XP */}
      <div className="space-y-1">
        <div className="flex justify-between text-yellow-500">
          <span>XP</span>
          <span>{player.xp} / {player.xpToNext}</span>
        </div>
        <div className="h-2 rounded-sm overflow-hidden bg-yellow-950">
          <div
            className="h-full rounded-sm bg-yellow-500 transition-all duration-200"
            style={{ width: `${xpPct * 100}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="border-t border-gray-800 pt-2 space-y-1">
        <div className="flex justify-between text-gray-400">
          <span>⚔ ATK</span>
          <span className="text-orange-300">
            {player.baseAttack + (player.equipment.weapon?.attackBonus ?? 0)}
          </span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>🛡 DEF</span>
          <span className="text-cyan-300">
            {player.baseDefense + (player.equipment.armor?.defenseBonus ?? 0)}
          </span>
        </div>
      </div>

      {/* Equipment */}
      {(player.equipment.weapon || player.equipment.armor || player.equipment.accessory) && (
        <div className="border-t border-gray-800 pt-2 space-y-1">
          <div className="text-gray-600 text-xs">Equipment:</div>
          {player.equipment.weapon && (
            <div className="text-yellow-600 text-xs truncate">🗡 {player.equipment.weapon.name}</div>
          )}
          {player.equipment.armor && (
            <div className="text-blue-600 text-xs truncate">🛡 {player.equipment.armor.name}</div>
          )}
          {player.equipment.accessory && (
            <div className="text-pink-600 text-xs truncate">💍 {player.equipment.accessory.name}</div>
          )}
        </div>
      )}

      {/* Crown Shards */}
      <div className="border-t border-gray-800 pt-2">
        <div className="text-gray-400 text-xs mb-1">Crown Shards:</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={n <= player.crownShards ? "text-yellow-400" : "text-gray-700"}
            >
              ✦
            </span>
          ))}
        </div>
      </div>

      {/* Status effects */}
      {player.effects.length > 0 && (
        <div className="border-t border-gray-800 pt-2">
          <div className="flex flex-wrap gap-1">
            {player.effects.map((ef, i) => {
              const colors: Record<string, string> = {
                burn: "text-orange-400 bg-orange-950",
                freeze: "text-blue-300 bg-blue-950",
                poison: "text-green-400 bg-green-950",
                blessed: "text-yellow-200 bg-yellow-950",
                stunned: "text-yellow-400 bg-gray-800",
              };
              return (
                <span key={i} className={`text-xs px-1 rounded ${colors[ef.type] ?? "text-gray-300"}`}>
                  {ef.type}({ef.duration})
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
