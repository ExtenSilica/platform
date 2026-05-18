interface DailyPoint {
  day: string;
  count: number;
}

function fmtNum(n: number) {
  return n.toLocaleString();
}

export function AdoptionDailyChart({
  history,
  unitLabel,
}: {
  history: DailyPoint[];
  unitLabel: string;
}) {
  const max = Math.max(...history.map((h) => h.count), 1);
  const bars = history.slice(-30);

  if (bars.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-muted/20 py-8 text-center text-sm text-muted-foreground">
        No data in this window yet.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/10 p-4">
      <div className="flex h-28 items-end gap-[2px]">
        {bars.map((h) => {
          const pct = (h.count / max) * 100;
          const isZero = h.count === 0;
          return (
            <div
              key={h.day}
              className="group relative flex-1 cursor-default"
              title={`${h.day}: ${fmtNum(h.count)} ${unitLabel}`}
            >
              <div
                className={`w-full rounded-sm transition-colors ${
                  isZero
                    ? "bg-muted/40"
                    : "bg-primary/50 group-hover:bg-primary"
                }`}
                style={{ height: `${Math.max(pct, isZero ? 1 : 3)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        {bars
          .filter((_, i) => i % 7 === 0 || i === bars.length - 1)
          .map((h) => (
            <span key={h.day}>{h.day.slice(5)}</span>
          ))}
      </div>
    </div>
  );
}
