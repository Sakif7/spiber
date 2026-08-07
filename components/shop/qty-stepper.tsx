"use client";

export function QtyStepper({
  value,
  onChange,
  max = 999,
  min = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  min?: number;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const btn: React.CSSProperties = {
    width: 36,
    height: 36,
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    borderRadius: "var(--r-sm)",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    color: "var(--color-text)",
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        aria-label="Decrease"
        style={btn}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(clamp(parseInt(e.target.value || "1", 10)))}
        style={{
          width: 56,
          height: 36,
          textAlign: "center",
          border: "1px solid var(--color-border-field)",
          borderRadius: "var(--r-sm)",
          font: "inherit",
        }}
      />
      <button
        type="button"
        aria-label="Increase"
        style={btn}
        onClick={() => onChange(clamp(value + 1))}
      >
        +
      </button>
    </div>
  );
}
