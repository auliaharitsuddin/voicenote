import { useColorScheme } from 'react-native';

// Semantic tokens — single accent (amber/ember), neutral warm-zinc base. No AI-purple, no pure black.
const light = {
  bg: '#FAFAF9', surface: '#FFFFFF', surfaceRaised: '#FFFFFF', border: '#E7E5E4',
  fg: '#1C1917', muted: '#57534E', faint: '#A8A29E',
  primary: '#EA580C', onPrimary: '#FFFFFF', accent: '#EA580C', onAccent: '#FFFFFF',
  success: '#15803D', danger: '#DC2626', accentSoft: '#FFEDD5', dangerSoft: '#FEE2E2', successSoft: '#DCFCE7',
  shadow: 'rgba(28,25,23,0.10)',
};
const dark: typeof light = {
  bg: '#141311', surface: '#1C1A17', surfaceRaised: '#242118', border: '#332F2A',
  fg: '#F5F5F4', muted: '#B5B0A9', faint: '#78716C',
  primary: '#FB923C', onPrimary: '#1C1917', accent: '#FB923C', onAccent: '#1C1917',
  success: '#4ADE80', danger: '#F87171', accentSoft: '#3A2410', dangerSoft: '#3F1D1D', successSoft: '#123420',
  shadow: 'rgba(0,0,0,0.45)',
};
export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? dark : light);

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 10, md: 18, lg: 28, full: 999 } as const;
export const type = { title: 28, h2: 20, body: 16, small: 14, tiny: 12 } as const;

// Motion tokens — spring-first, no linear easing (taste-skill §4/§6)
export const spring = { stiffness: 220, damping: 20, mass: 0.6 } as const;
export const springSoft = { stiffness: 140, damping: 18, mass: 0.7 } as const;
