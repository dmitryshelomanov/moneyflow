export const CHART = {
  income: {
    active: "#4F6BED",
    muted: "#C5CEF8",
  },
  expense: {
    active: "#E67E22",
    muted: "#F5C9A0",
  },
  balance: "#22c55e",
  leftover: "#334155",
  ratio: "#6B7280",
  grid: "rgba(148,163,184,0.2)",
  tick: {
    fontSize: 11,
    fill: "rgba(0,0,0,0.4)",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  heat: [
    "bg-[#f4ede4]",
    "bg-[#f5c9a0]",
    "bg-[#f0a05a]",
    "bg-[#e67e22]",
    "bg-[#c45a10]",
  ],
} as const;

export const CHART_GRID = {
  vertical: false,
  stroke: CHART.grid,
  strokeDasharray: "3 6",
} as const;

export const CHART_TOOLTIP_CLASS =
  "rounded-2xl border-2 border-black/90 bg-[#fffdf5] px-3 py-2 text-sm shadow-[0_4px_0_rgba(0,0,0,0.8)]";
