/**
 * responsive.ts
 * Utilidad central de responsividad para toda la app.
 * Importar en cualquier pantalla: import { r, isTablet, isSmall } from '../../src/utils/responsive';
 */

import { Dimensions, PixelRatio } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// ─── Breakpoints ──────────────────────────────────────────────────────────────
export const isTablet  = W >= 768;
export const isSmall   = H < 700;   // Pantallas pequeñas: SE, Moto G4, etc.
export const isLarge   = H > 900;   // Pantallas grandes: Pro Max, tablets

// ─── Escala de fuentes ────────────────────────────────────────────────────────
const fontScale = PixelRatio.getFontScale();
const clamp = (min: number, val: number, max: number) => Math.min(max, Math.max(min, val));

export function fs(size: number): number {
  const scaled = isTablet ? size * 1.25 : isSmall ? size * 0.9 : size;
  return clamp(size * 0.85, scaled / fontScale, size * 1.4);
}

// ─── Valores responsivos ──────────────────────────────────────────────────────
export const r = {
  // Padding / márgenes
  padH:       isTablet ? 48   : isSmall ? 16  : 20,
  padV:       isTablet ? 32   : isSmall ? 12  : 16,
  gap:        isTablet ? 20   : isSmall ? 10  : 14,

  // Bordes
  radius:     isTablet ? 20   : 14,
  radiusSm:   isTablet ? 14   : 10,
  radiusLg:   isTablet ? 28   : 20,

  // Tipografía
  h1:         isTablet ? 32   : isSmall ? 20  : 24,
  h2:         isTablet ? 24   : isSmall ? 16  : 18,
  h3:         isTablet ? 20   : isSmall ? 14  : 16,
  body:       isTablet ? 17   : isSmall ? 13  : 15,
  small:      isTablet ? 14   : isSmall ? 11  : 12,
  label:      isTablet ? 15   : isSmall ? 12  : 13,

  // Inputs
  inputPadV:  isTablet ? 20   : isSmall ? 12  : 15,
  inputPadH:  isTablet ? 20   : 16,
  inputFontSz:isTablet ? 18   : isSmall ? 14  : 16,
  inputRadius:isTablet ? 18   : 14,

  // Botones
  btnPadV:    isTablet ? 22   : isSmall ? 14  : 17,
  btnFontSz:  isTablet ? 18   : isSmall ? 15  : 16,
  btnRadius:  isTablet ? 20   : 16,

  // Íconos
  iconSm:     isTablet ? 20   : 16,
  iconMd:     isTablet ? 26   : isSmall ? 18  : 22,
  iconLg:     isTablet ? 32   : 26,

  // Tabs
  tabFontSz:  isTablet ? 15   : isSmall ? 12  : 13,
  tabPadV:    isTablet ? 14   : isSmall ? 8   : 10,

  // Cards
  cardPad:    isTablet ? 24   : isSmall ? 12  : 16,
  cardRadius: isTablet ? 24   : 16,

  // Ancho máximo en tablet (centrar contenido)
  maxW:       isTablet ? 680  : ('100%' as const),

  // Avatar / foto perfil
  avatarSm:   isTablet ? 44   : 34,
  avatarMd:   isTablet ? 64   : 48,
  avatarLg:   isTablet ? 110  : isSmall ? 80  : 90,

  // Dimensiones de pantalla
  W, H,
};

export default r;