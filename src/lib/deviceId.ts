const DEVICE_ID_KEY = "imv_device_id";
const LAST_SUBMISSION_KEY = "imv_last_submission_date";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function hasSubmittedToday(): boolean {
  return localStorage.getItem(LAST_SUBMISSION_KEY) === todayIso();
}

export function markSubmittedToday(): void {
  localStorage.setItem(LAST_SUBMISSION_KEY, todayIso());
}
