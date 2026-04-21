import { getBookingBySlot } from '../db/bookings.js';

export async function isSlotAvailable({ date, time }) {
  const existing = await getBookingBySlot(date, time);
  return !existing;
}
