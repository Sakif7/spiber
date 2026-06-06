/**
 * SPIBER MED — Design System Tokens
 *
 * The single source of truth for colors, type scale, spacing, radii, shadows
 * and motion. Mirrors `app/globals.css` so JS/TS code can consume the same
 * values without parsing CSS. Carry this file across projects to seed any
 * other surface (Storybook, marketing site, native app) with the same system.
 */

export const colors = {
  brand: {
    teal: "#0D8F91",
    orange: "#E66B26",
  },
  teal: {
    50: "#EEFBFB",
    100: "#C9F3F3",
    200: "#8EE0E1",
    300: "#51CACD",
    400: "#1CB8BA",
    500: "#0D8F91",
    600: "#097377",
    700: "#085659",
    800: "#07393C",
    900: "#062527",
  },
  orange: {
    50: "#FDF1E9",
    100: "#FBDDC8",
    200: "#F7BB94",
    300: "#F19660",
    400: "#EC7D3F",
    500: "#E66B26",
    600: "#C2531A",
    700: "#9A4014",
    800: "#732F0F",
    900: "#4A1E09",
  },
  aqua: {
    300: "#54E8E3",
    400: "#19E1DE",
    500: "#10BCBC",
    600: "#0B9193",
  },
  slate: {
    0: "#FFFFFF",
    50: "#F7F9FA",
    100: "#EFF3F4",
    200: "#E3E9EB",
    300: "#CBD4D7",
    400: "#97A4A9",
    500: "#6D7C82",
    600: "#4F5D63",
    700: "#364045",
    800: "#1E262A",
    900: "#0A1318",
  },
  semantic: {
    bg: "var(--slate-50)",
    surface: "var(--slate-0)",
    surface2: "var(--slate-100)",
    surfaceInv: "var(--slate-900)",
    border: "var(--slate-200)",
    hairline: "#E8EDEF",
    text: "var(--slate-900)",
    textStrong: "#02080B",
    textMuted: "var(--slate-500)",
    textSubtle: "var(--slate-400)",
    textInv: "var(--slate-0)",
    textInvMuted: "#B7C2C7",
    brand: "var(--teal-500)",
    brandDeep: "var(--teal-700)",
    brandSoft: "var(--teal-50)",
    secondary: "var(--orange-500)",
    secondaryDeep: "var(--orange-600)",
    secondarySoft: "var(--orange-50)",
    accent: "var(--aqua-500)",
    success: "#1B9E6F",
    warning: "#D89614",
    error: "#D14343",
    info: "#2A78D0",
  },
} as const;

export const typography = {
  family: {
    display: "var(--font-display)",
    body: "var(--font-body)",
    serif: "var(--font-serif)",
    bn: "var(--font-bn)",
    mono: "var(--font-mono)",
  },
  scale: {
    display: "clamp(3.25rem, 2rem + 4.5vw, 5.5rem)",
    h1: "clamp(2.25rem, 1.5rem + 2.6vw, 3.75rem)",
    h2: "clamp(1.75rem, 1.25rem + 1.8vw, 2.75rem)",
    h3: "clamp(1.375rem, 1.1rem + 1vw, 1.875rem)",
    h4: "clamp(1.125rem, 1rem + 0.5vw, 1.375rem)",
    h5: "1.0625rem",
    h6: "0.9375rem",
    bodyLg: "1.0625rem",
    body: "1rem",
    bodySm: "0.9375rem",
    small: "0.875rem",
    caption: "0.75rem",
    micro: "0.6875rem",
  },
  lineHeight: {
    display: 1.02,
    heading: 1.12,
    body: 1.55,
    tight: 1.3,
  },
  tracking: {
    display: "-0.025em",
    heading: "-0.015em",
    body: "0em",
    eyebrow: "0.14em",
  },
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  "2xl": 32,
  pill: 999,
} as const;

export const shadow = {
  xs: "0 1px 2px rgba(10, 31, 44, 0.04)",
  sm: "0 1px 2px rgba(10, 31, 44, 0.04), 0 2px 6px rgba(10, 31, 44, 0.04)",
  md: "0 1px 2px rgba(10, 31, 44, 0.05), 0 6px 16px rgba(10, 31, 44, 0.06)",
  lg: "0 2px 4px rgba(10, 31, 44, 0.05), 0 12px 32px rgba(10, 31, 44, 0.08)",
  xl: "0 4px 8px rgba(10, 31, 44, 0.05), 0 24px 60px rgba(10, 31, 44, 0.12)",
  brand: "0 8px 24px -8px color-mix(in srgb, #0D8F91 50%, transparent)",
} as const;

export const motion = {
  ease: {
    outQuad: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    outExpo: "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  duration: {
    fast: 120,
    base: 220,
    slow: 420,
    page: 700,
  },
} as const;

export const layout = {
  containerMax: 1240,
  containerPad: "clamp(20px, 4vw, 56px)",
  gridCols: 12,
  gridGutter: 24,
} as const;

/**
 * Component spec contract — describes the canonical look of every reusable
 * block. Components in `components/` follow these specs; if you fork a
 * component, deviate intentionally and document the variation.
 */
export const componentSpecs = {
  button: {
    primary: {
      bg: "var(--color-brand)",
      fg: "white",
      radius: radius.pill,
      paddingX: 18,
      height: 44,
      fontSize: 14,
      fontWeight: 500,
      shadow: shadow.brand,
      hover: "lift + magnetic",
    },
    secondary: {
      bg: "transparent",
      fg: "var(--color-text-strong)",
      border: "1px solid var(--color-border)",
      radius: radius.pill,
      paddingX: 18,
      height: 44,
    },
    ghost: {
      bg: "transparent",
      fg: "var(--color-text-muted)",
      hoverFg: "var(--color-brand-deep)",
    },
  },
  card: {
    radius: radius.xl,
    padding: 28,
    border: "1px solid var(--color-border)",
    bg: "var(--color-surface)",
    hover: {
      bg: "linear-gradient(180deg, var(--teal-50), var(--color-surface))",
      borderColor: "var(--teal-200)",
      shadow: shadow.lg,
      lift: -4,
    },
    transition: `all 320ms ${motion.ease.outExpo}`,
  },
  badge: {
    radius: radius.pill,
    paddingX: 11,
    paddingY: 5,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    family: typography.family.mono,
  },
  eyebrow: {
    family: typography.family.mono,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: typography.tracking.eyebrow,
    textTransform: "uppercase",
    color: "var(--color-brand-deep)",
  },
  section: {
    paddingBlock: "clamp(72px, 8vw, 128px)",
    container: layout.containerMax,
    containerPad: layout.containerPad,
  },
  header: {
    sticky: true,
    heightResting: 76,
    heightScrolled: 62,
    blur: "20px",
    bgResting: "rgba(255,255,255,.96)",
    bgScrolled: "rgba(255,255,255,.78)",
    transition: `all 280ms ${motion.ease.outExpo}`,
  },
} as const;

export const designSystem = {
  colors,
  typography,
  space,
  radius,
  shadow,
  motion,
  layout,
  componentSpecs,
} as const;

export default designSystem;
