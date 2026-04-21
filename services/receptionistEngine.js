import { normalizeDate, normalizeTime, isWithinClinicHours, isPastDateTime } from './normalizer.js';
import { isSlotAvailable } from './scheduler.js';
import { isDuplicate } from './idempotency.js';
import { getBookingByCallId, createBooking } from '../db/bookings.js';
import { bookingCreated, bookingRejected, idempotencyHit, normalizedData, validationResult } from '../utils/logger.js';
import { emitEvent } from '../events/eventBus.js';
import { logFailure, createBookingFailedEvent } from '../utils/failureLogger.js';
import { succeedStage, failStage } from '../utils/executionTrace.js';

function nonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

export async function processBookingRequest({ callId, toolCallId, raw, traceContext }) {
  if (!raw || typeof raw !== 'object') {
    failStage(traceContext, 'REQUEST_VALIDATION', 'missing_arguments', { rawType: typeof raw });
    return { ok: false, stage: 'REQUEST_VALIDATION', reason: 'missing_arguments' };
  }

  if (!nonEmptyString(raw.name) || !nonEmptyString(raw.service) || !nonEmptyString(raw.date) || !nonEmptyString(raw.time)) {
    failStage(traceContext, 'REQUEST_VALIDATION', 'missing_required_fields', {
      hasName: nonEmptyString(raw.name),
      hasService: nonEmptyString(raw.service),
      hasDate: nonEmptyString(raw.date),
      hasTime: nonEmptyString(raw.time)
    });
    return { ok: false, stage: 'REQUEST_VALIDATION', reason: 'missing_required_fields' };
  }

  // STAGE 5: NORMALIZATION (continues from webhook's BUSINESS_RULES entry)
  const date = normalizeDate(raw.date);
  const time = normalizeTime(raw.time);

  const normalized = {
    name: raw.name.trim(),
    service: raw.service.trim(),
    date,
    time
  };

  normalizedData({ callId, toolCallId, original: raw, normalized });

  if (!date || !time) {
    failStage(traceContext, 'NORMALIZATION', 'unresolved-date-or-time', { rawDate: raw.date, rawTime: raw.time });
    bookingRejected({ callId, toolCallId, reason: 'unresolved-date-or-time', data: normalized });
    logFailure('NORMALIZATION', 'unresolved-date-or-time', { callId, toolCallId, data: { date: raw.date, time: raw.time } });
    emitEvent('BOOKING_FAILED', createBookingFailedEvent('NORMALIZATION', 'unresolved-date-or-time', { callId, toolCallId, data: normalized }));
    return { ok: false, stage: 'NORMALIZATION', reason: 'unresolved-date-or-time' };
  }
  
  succeedStage(traceContext, 'NORMALIZATION', { 
    originalDate: raw.date, 
    originalTime: raw.time, 
    normalizedDate: date, 
    normalizedTime: time 
  });

  // STAGE 6: BUSINESS_RULES validation
  succeedStage(traceContext, 'BUSINESS_RULES', { 
    validationStep: 'field_validation',
    fields: Object.keys(normalized) 
  });

  // Sub-stage: Clinic hours check
  if (!isWithinClinicHours(time)) {
    failStage(traceContext, 'BUSINESS_RULES', 'outside-clinic-hours', { time, clinicHours: '9am-6pm' });
    bookingRejected({ callId, toolCallId, reason: 'outside-clinic-hours', data: normalized });
    logFailure('BUSINESS_RULES', 'outside-clinic-hours', { callId, toolCallId, data: { time } });
    emitEvent('BOOKING_FAILED', createBookingFailedEvent('BUSINESS_RULES', 'outside-clinic-hours', { callId, toolCallId, data: normalized }));
    return { ok: false, stage: 'BUSINESS_RULES', reason: 'outside-clinic-hours' };
  }

  // Sub-stage: Past datetime check
  if (isPastDateTime(date, time)) {
    failStage(traceContext, 'BUSINESS_RULES', 'past-datetime', { date, time });
    bookingRejected({ callId, toolCallId, reason: 'past-datetime', data: normalized });
    logFailure('BUSINESS_RULES', 'past-datetime', { callId, toolCallId, data: { date, time } });
    emitEvent('BOOKING_FAILED', createBookingFailedEvent('BUSINESS_RULES', 'past-datetime', { callId, toolCallId, data: normalized }));
    return { ok: false, stage: 'BUSINESS_RULES', reason: 'past-datetime' };
  }

  // Sub-stage: Slot availability check
  const available = await isSlotAvailable({ date, time });
  if (!available) {
    failStage(traceContext, 'BUSINESS_RULES', 'slot-occupied', { date, time });
    bookingRejected({ callId, toolCallId, reason: 'slot-occupied', data: normalized });
    logFailure('BUSINESS_RULES', 'slot-occupied', { callId, toolCallId, data: { date, time } });
    emitEvent('BOOKING_FAILED', createBookingFailedEvent('BUSINESS_RULES', 'slot-occupied', { callId, toolCallId, data: normalized }));
    return { ok: false, stage: 'BUSINESS_RULES', reason: 'slot-occupied' };
  }

  succeedStage(traceContext, 'BUSINESS_RULES', { 
    passed: ['clinic_hours', 'past_datetime', 'slot_availability'],
    date,
    time 
  });

  // STAGE 7: DATABASE_WRITE
  let booking;
  try {
    booking = await createBooking({ callId, ...normalized });
    booking.createdAt = new Date().toISOString();
    succeedStage(traceContext, 'DATABASE_WRITE', { 
      bookingId: booking.id, 
      inserted: true 
    });
  } catch (dbError) {
    const msg = String(dbError?.message || '');
    if (msg.includes('UNIQUE constraint failed') && msg.includes('bookings.date') && msg.includes('bookings.time') && msg.includes('bookings.service')) {
      failStage(traceContext, 'BUSINESS_RULES', 'slot-occupied', { date, time, service: normalized.service });
      logFailure('BUSINESS_RULES', 'slot-occupied', { callId, toolCallId, data: { date, time, service: normalized.service } });
      emitEvent('BOOKING_FAILED', createBookingFailedEvent('BUSINESS_RULES', 'slot-occupied', { callId, toolCallId, data: { date, time, service: normalized.service } }));
      return { ok: false, stage: 'BUSINESS_RULES', reason: 'slot-occupied' };
    }
    failStage(traceContext, 'DATABASE_WRITE', 'db_insert_failed', { error: dbError.message });
    logFailure('DATABASE_WRITE', 'db_insert_failed', { callId, toolCallId, data: { error: dbError.message } });
    emitEvent('BOOKING_FAILED', createBookingFailedEvent('DATABASE_WRITE', 'db_insert_failed', { callId, toolCallId, data: { error: dbError.message } }));
    return { ok: false, stage: 'DATABASE_WRITE', reason: 'db_insert_failed' };
  }

  bookingCreated({ callId, toolCallId, bookingId: booking.id, booking });
  return { ok: true, booking, duplicate: false };
}
