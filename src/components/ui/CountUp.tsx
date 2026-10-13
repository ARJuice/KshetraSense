import React, { useState, useEffect, useRef } from 'react';

export interface CountUpProps {
  to: number;
  from?: number;
  decimals?: number;
  duration?: number; // ms
  className?: string;
  suffix?: string;
}

/**
 * CountUp component adapted from React Bits.
 * Smoothly transitions numbers using requestAnimationFrame,
 * bringing subtle dynamic response to numerical field instrument values.
 */
export const CountUp: React.FC<CountUpProps> = ({
  to,
  from,
  decimals = 0,
  duration = 400,
  className = '',
  suffix = '',
}) => {
  const [current, setCurrent] = useState<number>(from ?? to);
  const prevToRef = useRef<number>(to);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion) {
      setCurrent(to);
      prevToRef.current = to;
      return;
    }

    const startVal = prevToRef.current;
    const endVal = to;
    prevToRef.current = to;

    if (startVal === endVal) {
      setCurrent(endVal);
      return;
    }

    let startTime: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const interpolated = startVal + (endVal - startVal) * easeOut;

      setCurrent(interpolated);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setCurrent(endVal);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [to, duration, prefersReducedMotion]);

  const formatted =
    decimals > 0 ? current.toFixed(decimals) : Math.round(current).toString();

  return (
    <span className={`tabular-nums ${className}`}>
      {formatted}
      {suffix && <span className="ml-0.5">{suffix}</span>}
    </span>
  );
};
