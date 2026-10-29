import { MAX_SCORE, trailPercent } from '../config';
import { REGIONS, regionIndexAt } from '../scene/world';

/** The whole journey at a glance: five regions, with the rider's position marked. */
export function TrailMap({ points }: { points: number }) {
  const pct = trailPercent(points);
  const exact = Math.min(1, Math.max(0, points / MAX_SCORE));
  const here = regionIndexAt(exact);
  return (
    <div className="trailmap" role="img" aria-label={`Trail progress ${pct}%, ${REGIONS[here].name}`}>
      <div className="trailmap__bar">
        {REGIONS.map((r, i) => {
          const end = REGIONS[i + 1]?.start ?? 1;
          return (
            <span
              key={r.id}
              className={`trailmap__seg trailmap__seg--${r.id}${i <= here ? ' is-reached' : ''}`}
              style={{ width: `${(end - r.start) * 100}%` }}
            />
          );
        })}
        <span className="trailmap__marker" style={{ left: `${exact * 100}%` }} />
      </div>
      <div className="trailmap__labels" aria-hidden="true">
        <span>{REGIONS[here].name}</span>
      </div>
    </div>
  );
}
