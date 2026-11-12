import { GAUGE_MAX, GAUGE_MIN, gaugePct, usdK } from "@/lib/jobs/format";

type Props = { minUsd: number | null; maxUsd: number | null; confirmed: boolean; floorUsd: number; large?: boolean };

// Track from $150k to $400k; the range bar is green when its top clears the floor.
export function CompGauge({ minUsd, maxUsd, confirmed, floorUsd, large }: Props) {
  const top = maxUsd ?? minUsd;
  const floor = gaugePct(floorUsd);
  const label = top == null ? "Salary not posted" : `Top of range ${Math.round(top / 1000)}k USD vs ${usdK(floorUsd)} floor`;

  return (
    <div className={`gauge${large ? " gauge-lg" : ""}`} role="img" aria-label={label}>
      <div className="gauge-track">
        {top != null && (
          <div
            className={`gauge-range ${top >= floorUsd ? "is-pass" : "is-fail"}${confirmed ? "" : " is-soft"}`}
            style={{
              left: `${gaugePct(minUsd ?? top)}%`,
              width: `${Math.max(gaugePct(top) - gaugePct(minUsd ?? top), 1.5)}%`,
            }}
          />
        )}
        <div className="gauge-floor" style={{ left: `${floor}%` }} />
      </div>
      {large && (
        <div className="gauge-scale" aria-hidden>
          <span style={{ left: 0 }}>${GAUGE_MIN / 1000}k</span>
          <span className="gauge-scale-floor" style={{ left: `${floor}%` }}>{usdK(floorUsd)} floor</span>
          <span style={{ right: 0 }}>${GAUGE_MAX / 1000}k+</span>
        </div>
      )}
    </div>
  );
}
