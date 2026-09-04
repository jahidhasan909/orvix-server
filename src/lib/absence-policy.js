export const ABSENCE_REASONS = [
  { id: "sick", label: "Sick", paid: true },
  { id: "personal", label: "Personal", paid: false },
  { id: "emergency", label: "Emergency", paid: false },
  { id: "family", label: "Family", paid: false },
  { id: "other", label: "Other", paid: false },
];

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function resolveAbsencePolicy(reason, reasons = ABSENCE_REASONS) {
  const key = normalize(reason);
  if (!key) {
    return { id: "unrecorded", label: "No attendance recorded", paid: false, known: false };
  }

  const match = reasons.find((item) => {
    const id = normalize(item.id);
    const label = normalize(item.label);
    return key === id || key === label || key.startsWith(`${id}:`) || key.startsWith(`${label}:`);
  });
  if (match) {
    return { ...match, known: true };
  }

  return { id: "other", label: String(reason).trim(), paid: false, known: false };
}

export function isPaidAbsence(record, reasons = ABSENCE_REASONS) {
  if (!record) return false;
  const status = String(record.status || "").toLowerCase();
  if (status !== "absent") return false;

  const policy = resolveAbsencePolicy(record.reason, reasons);
  if (policy.known) return policy.paid === true;
  return record.leavePaid === true;
}
