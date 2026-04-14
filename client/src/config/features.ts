/**
 * Feature flags for Career Forge client
 * ======================================
 *
 * All flags default to false (no env vars needed)
 *
 * Usage:
 *   import { FEATURES } from '../config/features';
 *   if (FEATURES.CLOUD) { ... }
 *
 *       
 */

import type { Features } from '../types';


export const FEATURES: Readonly<Features> = Object.freeze({
  /**
   * Master switch for optional extended features.
   * All other flags below derive from this unless individually overridden.
   */
  CLOUD,

  /**
   * Authentication providers.
   * Default: local email + password (AuthModal base).
   * Extended: + OAuth (Google, GitHub), magic links, SSO.
   */
  AUTH_OAUTH: CLOUD,

  /**
   * GDPR consent banner.
   * Opt-in via REACT_APP_GDPR=true.
   * Enabled via VITE_GDPR=true or extended features.
   */
  GDPR_BANNER: CLOUD || process.env.REACT_APP_GDPR === 'true',

  /**
   * Server-side PDF export (pixel-perfect, no browser print dialog).
   * Default: browser window.print().
   * Extended: POST /api/cloud/pdf/export → returns a PDF blob.
   */
  PDF_EXPORT: CLOUD,

  /**
   * Additional document templates (available with extended features).
   * All bundled templates are included.
   */

  /**
   * Public shareable document links with view-count analytics.
   * Optional extended feature.
   */
  SHARING: CLOUD,

  /**
   * Optional extended feature.
   */

  /**
   * Optional extended.
   */

  /**
   * Document storage limits per tier.
   * When false, unlimited documents are allowed (self-host).
   * When true, limits are enforced from the subscription tier.
   */
  CV_LIMITS: CLOUD,
});
