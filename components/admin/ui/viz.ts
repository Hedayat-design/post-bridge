/**
 * Chart colours for the admin site, validated against the navy chart surface
 * (#122339) with the dataviz palette checker — not picked by eye.
 *
 *   delivered / failed  blue vs critical red: CVD ΔE 25.7, passes every check.
 *                       (Green vs red failed: ΔE 4.1 under deuteranopia.)
 *   magnitude           a deeper gold step inside the lightness band, for any
 *                       single-series bar or meter.
 *   track               the magnitude hue, dimmed: a meter's unfilled part.
 *
 * Status colours (account health) are the fixed status palette and always
 * travel with an icon and a label — see HealthBadge.
 */
export const VIZ = {
  delivered: '#3987e5',
  failed: '#d03b3b',
  magnitude: '#B98B3F',
  track: 'rgb(185 139 63 / 0.18)',
} as const

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
} as const
