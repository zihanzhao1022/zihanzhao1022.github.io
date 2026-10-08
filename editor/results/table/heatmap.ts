/** The manuscript's orange/red and blue/violet piecewise heat key (scripts/heat_key.py). */
export function heatColor(delta: number, higherIsBetter: boolean): string | null {
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) return null;
  const intensity = Math.min(90, Math.max(8, 2 * Math.abs(delta)));
  const worse = higherIsBetter ? delta < 0 : delta > 0;
  const light = worse ? [242, 150, 60] : [92, 142, 222];
  const dark = worse ? [217, 84, 77] : [78, 66, 186];
  const from = intensity <= 30 ? [255, 255, 255] : light;
  const to = intensity <= 30 ? light : dark;
  const fraction = intensity <= 30 ? intensity / 30 : (intensity - 30) / 60;
  return '#' + from.map((channel, i) => Math.round(channel + (to[i] - channel) * fraction).toString(16).padStart(2, '0')).join('');
}
