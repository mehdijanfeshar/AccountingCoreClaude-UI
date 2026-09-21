import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn's standard class combiner: `clsx` resolves conditionals, `twMerge` then drops
 * Tailwind classes that a later one overrides, so a caller's `className` can actually beat a
 * component's own defaults instead of both landing and CSS order deciding.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
