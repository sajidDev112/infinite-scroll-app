/**
 * GSAP-compatible easing names implemented as pure functions so the engine
 * (and the server's validator) does not depend on GSAP. Names match GSAP's,
 * so the same value can be handed to gsap tweens on the intro screen.
 */
const pow = (n) => ({
  in: (t) => t ** n,
  out: (t) => 1 - (1 - t) ** n,
  inOut: (t) => (t < 0.5 ? (2 * t) ** n / 2 : 1 - (2 * (1 - t)) ** n / 2),
});

const BACK = 1.70158;

const FUNCS = {
  none: (t) => t,
  'power1.in': pow(2).in,
  'power1.out': pow(2).out,
  'power1.inOut': pow(2).inOut,
  'power2.in': pow(3).in,
  'power2.out': pow(3).out,
  'power2.inOut': pow(3).inOut,
  'power3.in': pow(4).in,
  'power3.out': pow(4).out,
  'power3.inOut': pow(4).inOut,
  'power4.out': pow(5).out,
  'power4.inOut': pow(5).inOut,
  'sine.in': (t) => 1 - Math.cos((t * Math.PI) / 2),
  'sine.out': (t) => Math.sin((t * Math.PI) / 2),
  'sine.inOut': (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  'expo.out': (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  'expo.inOut': (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2,
  'circ.out': (t) => Math.sqrt(1 - (t - 1) ** 2),
  'back.out': (t) => 1 + (BACK + 1) * (t - 1) ** 3 + BACK * (t - 1) ** 2,
};

export const EASINGS = [
  { value: 'none', label: 'Linear' },
  { value: 'power1.out', label: 'Gentle out' },
  { value: 'power2.out', label: 'Smooth out' },
  { value: 'power3.out', label: 'Strong out' },
  { value: 'power4.out', label: 'Dramatic out' },
  { value: 'power1.inOut', label: 'Gentle in-out' },
  { value: 'power2.inOut', label: 'Smooth in-out' },
  { value: 'power3.inOut', label: 'Strong in-out' },
  { value: 'sine.inOut', label: 'Sine in-out' },
  { value: 'expo.out', label: 'Expo out' },
  { value: 'expo.inOut', label: 'Expo in-out' },
  { value: 'circ.out', label: 'Circular out' },
  { value: 'back.out', label: 'Back out (overshoot)' },
  { value: 'power2.in', label: 'Smooth in' },
];

export const EASING_NAMES = Object.keys(FUNCS);

export function getEase(name) {
  return FUNCS[name] || FUNCS['power2.out'];
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
