/**
 * Feature flags for Career Forge client
 * ======================================
 *
 * All flags default to false (no env vars needed)
 *
 * Usage:
 *   import { FEATURES } from '../config/features';
 *   if (FEATURES.GDPR_BANNER) { ... }
 *
 */

import type { Features } from '../types';

export const FEATURES: Readonly<Features> = Object.freeze({
  /**
   * GDPR consent banner.
   * Opt-in via VITE_GDPR=true.
   */
  GDPR_BANNER: import.meta.env.VITE_GDPR === 'true',
});
