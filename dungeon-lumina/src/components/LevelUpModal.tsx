"use client";

import type { Player } from "@/game/types";

interface Props {
  player: Player;
  onAllocate: (stat: "hp" | "mana" | "attack" | "defense") => void;
}

const choices: Array<{
  stat: "hp" | "mana" | "attack" | "defense";
  label: string;
  desc: string;
  color: string;
  icon: string;
}> = [
  {
    stat: "hp",
    label: "Vitality",
    desc: "+20 Max HP, restore 20 HP",
    color: "border-red-600 bg-red-950 hover:bg-red-900 text-red-200",
    icon: "❤",
  },
  {
    stat: "mana",
    label: "Arcane Power",
    desc: "+15 Max Mana, restore 15 Mana",
    color: "border-blue-600 bg-blue-950 hover:bg-blue-900 text-blue-200",
    icon: "✦",
  },
  {
    stat: "attack",
    label: "Strength",
    desc: "+3 Attack Power",
    color: "border-orange-600 bg-orange-950 hover:bg-orange-900 text-orange-200",
    icon: "⚔",
  },
  {
    stat: "defense",
    label: "Warding",
    desc: "+2 Defense",
    color: "border-cyan-600 bg-cyan-950 hover:bg-cyan-900 text-cyan-200",
    icon: "🛡",
  },
];

export default function LevelUpModal({ player, onAllocate }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
      <div
        className="bg-gray-950 border border-indigo-700 rounded max-w-md w-full p-6 pixel-text shadow-2xl"
        style={{ boxShadow: "0 0 50px rgba(100,80,255,0.4)" }}
      >
        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-indigo-300 text-lg mb-1">★ LEVEL UP! ★</div>
          <div className="text-yellow-400 text-sm">
            {player.name} is now Level {player.level}!
          </div>
          <div className="text-gray-500 text-xs mt-1">
            Choose a stat to improve:
          </div>
        </div>

        {/* Choices */}
        <div className="space-y-2">
          {choices.map((c) => (
            <button
              key={c.stat}
              onClick={() => onAllocate(c.stat)}
              className={`
                w-full p-3 rounded border transition-colors cursor-pointer text-left
                ${c.color}
              `}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{c.icon}</span>
                <div>
                  <div className="text-sm font-bold">{c.label}</div>
                  <div className="text-xs opacity-70">{c.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="text-center text-gray-600 text-xs mt-4">
          New spells are learned automatically.
        </div>
      </div>
    </div>
  );
}
