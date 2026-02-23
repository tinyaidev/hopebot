"use client";

import { useState } from "react";

interface Props {
  onStart: (name: string) => void;
}

export default function TitleScreen({ onStart }: Props) {
  const [name, setName] = useState("Ryn");

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-4">
      {/* Title */}
      <div className="mb-8">
        <div className="text-yellow-400 text-4xl font-bold mb-2 pixel-text tracking-wider">
          ✦ LUMINA&apos;S QUEST ✦
        </div>
        <div className="text-cyan-300 text-lg pixel-text">
          Crystal Caverns
        </div>
        <div className="text-gray-500 text-xs pixel-text mt-2">
          A Family-Friendly Dungeon Crawler
        </div>
      </div>

      {/* Animated crystal icon */}
      <div className="mb-8 text-6xl animate-pulse">💎</div>

      {/* Story teaser */}
      <div className="max-w-md mb-8 text-gray-400 text-sm pixel-text leading-relaxed border border-gray-700 p-4 rounded">
        The Crystal Crown of Lumina has been shattered.
        <br />Five shards scattered across five perilous floors.
        <br />Brightmoor needs a hero.
        <br /><span className="text-yellow-300">Will you answer the call?</span>
      </div>

      {/* Name input */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <label className="text-gray-400 text-xs pixel-text">Your Name, Wizard:</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 12))}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onStart(name.trim())}
          className="bg-gray-900 border border-cyan-700 text-cyan-200 px-4 py-2 text-sm pixel-text text-center rounded outline-none focus:border-cyan-400 w-48"
          maxLength={12}
        />
      </div>

      {/* Start button */}
      <button
        onClick={() => name.trim() && onStart(name.trim())}
        className="bg-indigo-900 hover:bg-indigo-700 border border-indigo-400 text-indigo-100 px-8 py-3 pixel-text text-sm rounded transition-colors cursor-pointer"
      >
        ▶ BEGIN QUEST
      </button>

      {/* Controls hint */}
      <div className="mt-10 text-gray-600 text-xs pixel-text space-y-1">
        <div>WASD / Arrow Keys — Move &amp; Attack</div>
        <div>1-9 — Select Spell &nbsp; T / Space — Cast Spell</div>
        <div>E / Enter — Use Stairs &nbsp; I — Use Item</div>
        <div>Escape — Cancel Targeting</div>
      </div>

      <div className="mt-6 text-gray-700 text-xs">
        5 floors · 14 spells · discoverable story
      </div>
    </div>
  );
}
