/** Small pixel-style icons drawn on a 10×10 grid. */
const common = { width: 20, height: 20, viewBox: '0 0 10 10', 'aria-hidden': true, shapeRendering: 'crispEdges' as const, fill: 'currentColor' };

export function HelpIcon() {
  return (
    <svg {...common}>
      <path d="M3 1h4v1h1v3H7v1H6v1H4V5h1V4h1V2H4v1H3zM4 8h2v2H4z" />
    </svg>
  );
}

export function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg {...common}>
      <path d="M1 3h2l2-2h1v8H5L3 7H1z" />
      {on ? <path d="M7 3h1v4H7zM8 2h1v1H8zm0 5h1v1H8zM9 3h1v4H9z" opacity="0.9" /> : <path d="M7 3h1v1H7zm2 0h1v1H9zM8 4h1v2H8zM7 6h1v1H7zm2 0h1v1H9z" />}
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg {...common}>
      <path d="M4 1h2v1h1v1h1v1h1v1H8v4H6V6H4v3H2V5H1V4h1V3h1V2h1z" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...common}>
      <path d="M1 1h2v1h1v1h2V2h1V1h2v2H8v1H7v2h1v1h1v2H7V8H6V7H4v1H3v1H1V7h1V6h1V4H2V3H1z" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1.5 5.2 4 7.7 8.6 2.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export function CrossIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2.2 2.2 7.8 7.8M7.8 2.2 2.2 7.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}
