/** Minutes between clock-in and clock-out. Overnight shifts use a 24h wrap. */
export function workedMinutes(
  startHour: number,
  startMin: number,
  endHour: number,
  endMin: number,
  crossesMidnight: boolean,
) {
  const start = startHour * 60 + startMin;
  let end = endHour * 60 + endMin;
  if (crossesMidnight) end += 24 * 60;
  return Math.max(0, end - start);
}

export function formatWorkedMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}
