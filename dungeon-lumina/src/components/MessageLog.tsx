"use client";

interface Props {
  messages: string[];
}

export default function MessageLog({ messages }: Props) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded p-3 pixel-text">
      <div className="text-gray-600 text-xs mb-1">Combat Log</div>
      <div className="space-y-0.5 max-h-28 overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className="text-xs leading-relaxed"
            style={{
              color: i === 0
                ? msg.startsWith("★") || msg.startsWith("✦")
                  ? "#ffd700"
                  : "#e2e8f0"
                : `rgba(160,170,180,${Math.max(0.2, 1 - i * 0.18)})`,
            }}
          >
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}
