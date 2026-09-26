import { useEffect, useState } from 'react';
import { formatNumber } from '../utils/format';

/** Animates a number from 0 to `value` (respects reduced-motion). */
export default function CountUp({ value = 0, duration = 1100 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(value); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{formatNumber(n)}</>;
}
