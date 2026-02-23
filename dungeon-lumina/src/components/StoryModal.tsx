"use client";

import type { StoryEvent } from "@/game/types";

interface Props {
  story: StoryEvent;
  onDismiss: () => void;
}

export default function StoryModal({ story, onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div
        className="bg-gray-950 border border-yellow-800 rounded max-w-lg w-full p-6 pixel-text shadow-2xl"
        style={{ boxShadow: "0 0 40px rgba(180,140,0,0.3)" }}
      >
        {/* Title */}
        <div className="text-yellow-400 text-base mb-1 border-b border-yellow-900 pb-2">
          {story.title}
        </div>

        {/* Speaker */}
        {story.speaker && (
          <div className="text-cyan-400 text-xs mb-3">— {story.speaker}</div>
        )}

        {/* Content */}
        <div className="text-gray-300 text-xs leading-loose space-y-1 max-h-64 overflow-y-auto pr-1 mb-4">
          {story.lines.map((line, i) => (
            <div key={i} className={line === "" ? "h-2" : ""}>
              {line}
            </div>
          ))}
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          autoFocus
          className="w-full py-2 border border-yellow-700 bg-yellow-950 text-yellow-300 text-xs rounded hover:bg-yellow-900 transition-colors cursor-pointer"
        >
          [ Continue — Press Enter or Click ]
        </button>

        <div className="text-center text-gray-700 text-xs mt-2">Press Enter to continue</div>
      </div>
    </div>
  );
}
