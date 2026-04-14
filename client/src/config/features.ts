/**
 * Feature flags for Career Forge client
 * ======================================
 *
 * All flags default to false (no env vars needed)
 * Extended build: set REACT_APP_CLOUD_FEATURES=true
 *
 * Usage:
 *   import { FEATURES } from '../config/features';
 *   if (FEATURES.CLOUD) { ... }
 *
 * Flags default to false when CLOUD_FEATURES is unset.
 *       
 */

import type { Features } from '../types';

const CLOUD: boolean = process.env.REACT_APP_CLOUD_FEATURES === 'true';

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
  PREMIUM_TEMPLATES: CLOUD,

  /**
   * Public shareable document links with view-count analytics.
   * Optional extended feature.
   */
  SHARING: CLOUD,

  /**
   * Admin panel UI (multi-tenant user management).
   * Optional extended feature.
   */
  ADMIN_PANEL: CLOUD,

  /**
   * Subscription / billing UI (Stripe).
   * Optional extended.
   */
  BILLING: CLOUD,

  /**
   * Document storage limits per tier.
   * When false, unlimited documents are allowed (self-host).
   * When true, limits are enforced from the subscription tier.
   */
  CV_LIMITS: CLOUD,
});
