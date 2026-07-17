export const PROJECT_TRASH_RETENTION_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function projectPurgeDate(trashedAt: string | Date) {
  const purgeDate = new Date(trashedAt);
  purgeDate.setTime(purgeDate.getTime() + PROJECT_TRASH_RETENTION_DAYS * MILLISECONDS_PER_DAY);
  return purgeDate;
}

export function projectTrashDaysRemaining(trashedAt: string | Date, now = new Date()) {
  const millisecondsRemaining = projectPurgeDate(trashedAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(millisecondsRemaining / MILLISECONDS_PER_DAY));
}
