import { asString, joiningDateFrom } from "#lib/worker-payload.js";
import { positiveInt } from "#lib/inventory.js";

export const LEAVE_TYPES = [
  { id: "annual", label: "Annual", paid: true },
  { id: "sick", label: "Sick", paid: true },
  { id: "casual", label: "Casual", paid: true },
  { id: "unpaid", label: "Unpaid", paid: false },
];

export const LEAVE_STATUSES = ["pending", "approved", "rejected"];

export const LEAVE_STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export function publicLeave(row) {
  return {
    id: row.id,
    userId: row.userId || "",
    worker: row.user?.name || row.worker,
    type: row.type,
    typeLabel: LEAVE_TYPES.find((item) => item.id === row.type)?.label || row.type,
    paid: row.paid,
    days: row.days,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    status: row.status,
    statusLabel: LEAVE_STATUS_LABELS[row.status] || row.status,
    createdAt: row.createdAt,
  };
}

export function parseLeaveBody(body) {
  const userId = asString(body?.userId);
  const type = asString(body?.type);
  const known = LEAVE_TYPES.find((item) => item.id === type);
  const days = positiveInt(body?.days);
  const startsOn = joiningDateFrom(body?.startsOn);
  const endsOn = joiningDateFrom(body?.endsOn);
  if (!userId) return { error: "A worker is required." };
  if (!known) return { error: "Select a valid leave type." };
  if (!days || days < 1) return { error: "Days must be greater than 0." };
  if (!startsOn || !endsOn) return { error: "Start and end dates are required." };
  if (endsOn < startsOn) return { error: "End date cannot be before the start date." };
  return {
    data: {
      userId,
      type: known.id,
      paid: known.paid,
      days,
      startsOn,
      endsOn,
    },
  };
}
