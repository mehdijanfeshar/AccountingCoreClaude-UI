/**
 * The chart palette for every report page — roles, not raw hex, so a colour decision is made once
 * here and never re-guessed in a component.
 *
 * <b>These values were validated, not chosen by eye.</b> They were run through the data-viz
 * skill's `validate_palette.js` against this app's own chart surface (`background.paper`,
 * `#FFFFFF`) in light mode, which is the only mode this theme ships:
 *
 * <pre>
 *   node validate_palette.js "#3B5BB5,#B58108" --mode light --surface "#FFFFFF"
 *     [PASS] Lightness band       all 2 inside L 0.43–0.77
 *     [PASS] Chroma floor         all 2 >= 0.1
 *     [PASS] CVD separation       worst adjacent ΔE 28.0 (protan) · 24.0 (tritan)   [target ≥ 8]
 *     [PASS] Normal-vision floor  worst adjacent ΔE 31.2 (normal)                   [floor ≥ 15]
 *     [PASS] Contrast vs surface  all 2 >= 3:1
 *     → ALL CHECKS PASS
 * </pre>
 *
 * ⚠️ <b>The brand's own `primary.main` (`#1E3A8A`) FAILED</b> the lightness band (L 0.379, band is
 * 0.43–0.77): as a chart mark it is so dark it reads as ink rather than as a colour, and it
 * collapses against text. The theme's `primary.light` (`#3B5BB5`) is the nearest passing step and
 * is what the charts use. This is the reason chart marks do not simply reuse `primary.main` — do
 * not "fix" that back without re-running the validator.
 *
 * The two candidate golds were also measured: `secondary.main` (`#B58108`) passes contrast
 * outright, while `secondary.light` (`#CA8A04`) lands at 2.94:1 and would have obliged visible
 * labels as relief. The stronger gold was taken.
 */

/** بدهکار — categorical slot 1. */
export const DEBTOR_COLOR = '#3B5BB5';

/** بستانکار — categorical slot 2. */
export const CREDITOR_COLOR = '#B58108';

/**
 * Single hue for magnitude bars. A bar list already encodes magnitude with length, so shading each
 * bar differently would double-encode the same variable and imply a second dimension that is not
 * there; every bar therefore carries one flat hue.
 */
export const MAGNITUDE_COLOR = DEBTOR_COLOR;

/** Recessive chrome. Grid and track sit behind the data, never compete with it. */
export const CHART_TRACK = 'rgba(15, 23, 42, 0.07)';

/**
 * Status colours for the balance verdict. Kept separate from the two series colours on purpose: a
 * status colour must never be mistaken for "another series". Both are always shipped with an icon
 * and a label, never colour alone.
 */
export const BALANCE_OK_COLOR = '#15803D';
export const BALANCE_OFF_COLOR = '#B91C1C';
