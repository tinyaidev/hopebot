"use client";

import type { Item } from "@/game/types";

interface Props {
  inventory: Item[];
  onUse: (itemId: string) => void;
}

export default function InventoryPanel({ inventory, onUse }: Props) {
  if (inventory.length === 0) {
    return (
      <div className="bg-gray-950 border border-gray-800 rounded p-3 pixel-text">
        <div className="text-gray-600 text-xs mb-1">Inventory</div>
        <div className="text-gray-700 text-xs italic">Empty</div>
      </div>
    );
  }

  const typeOrder: Record<string, number> = {
    potion_hp: 0, potion_mp: 1, weapon: 2, armor: 3, accessory: 4, key_item: 5,
  };

  const sorted = [...inventory].sort(
    (a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9)
  );

  return (
    <div className="bg-gray-950 border border-gray-800 rounded p-3 pixel-text">
      <div className="text-gray-600 text-xs mb-2">Inventory ({inventory.length})</div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {sorted.map((item, i) => {
          const isUsable = item.type !== "key_item";
          return (
            <button
              key={`${item.id}-${i}`}
              onClick={() => isUsable && onUse(item.id)}
              disabled={!isUsable}
              title={item.description}
              className={`
                w-full text-left px-2 py-1 rounded text-xs flex items-center gap-2 transition-colors
                ${isUsable
                  ? "hover:bg-gray-800 cursor-pointer"
                  : "cursor-default"
                }
              `}
            >
              <span style={{ color: item.color }}>●</span>
              <span className="flex-1 truncate" style={{ color: item.type === "key_item" ? "#ffd700" : "#d1d5db" }}>
                {item.name}
              </span>
              {isUsable && (
                <span className="text-gray-600 text-xs shrink-0">use</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="text-gray-700 text-xs mt-1">Click to use • I key to toggle</div>
    </div>
  );
}
