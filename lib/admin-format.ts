/** "HH:MM UTC" for a "Updated ..." stamp; shared by the dashboard and the payments page. */
export function formatClock(value: Date): string {
  return `${value.toISOString().slice(11, 16)} UTC`;
}
