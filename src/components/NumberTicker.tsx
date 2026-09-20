import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { toPersianDigits } from '../lib/format/numbers';

/**
 * Counts a number up to its value when it first appears, and animates between values afterwards.
 *
 * The `ui-ux-pro-max` skill's "Financial Dashboard" style row asks for exactly this ("Number
 * animations (count-up)") — on a KPI the movement is what makes the eye notice the figure
 * changed, which a silently-replaced number does not.
 *
 * <b>Reduced motion is honoured, not approximated.</b> `useReducedMotion` reads the OS setting
 * and the number is simply set, with no tween — skill rule `reduced-motion`. That is also why the
 * DOM text is written directly rather than through React state: no re-render per frame, so a row
 * of tiles animating together costs nothing measurable.
 *
 * Digits are Persian, matching every other number in the app. The animation runs on the Latin
 * value and converts on each frame, because interpolating Persian digit strings is meaningless.
 */
export function NumberTicker({ value, durationMs = 700 }: { value: number; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const from = previous.current;
    previous.current = value;

    if (prefersReducedMotion) {
      node.textContent = toPersianDigits(value.toLocaleString('en-US'));
      return;
    }

    const controls = animate(from, value, {
      duration: durationMs / 1000,
      ease: 'easeOut',
      onUpdate: (latest) => {
        node.textContent = toPersianDigits(Math.round(latest).toLocaleString('en-US'));
      },
    });

    return () => controls.stop();
  }, [value, durationMs, prefersReducedMotion]);

  // Seeded with the final value so the number is correct even if JS animation never runs
  // (SSR, a crashed effect, or a screen reader reading before the tween starts).
  return <span ref={ref}>{toPersianDigits(value.toLocaleString('en-US'))}</span>;
}
