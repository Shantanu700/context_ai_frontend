/**
 * Stand-in for a video frame. Glass needs something underneath it worth
 * refracting — swap this for real footage once the media pipeline serves
 * keyframes.
 */
export const FRAME =
  "radial-gradient(70% 80% at 30% 25%, oklch(0.86 0.09 20 / 0.95), transparent 60%), " +
  "radial-gradient(60% 70% at 72% 60%, oklch(0.78 0.13 330 / 0.9), transparent 62%), " +
  "radial-gradient(90% 90% at 55% 100%, oklch(0.62 0.11 200), transparent 70%), " +
  "linear-gradient(160deg, oklch(0.55 0.09 200), oklch(0.42 0.08 260))";
