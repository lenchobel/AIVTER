import express from 'express';
import { processBookingRequest } from '../services/receptionistEngine.js';
import { emitEvent } from '../events/eventBus.js';
import { logFailure } from '../utils/failureLogger.js';
import { createTraceContext, enterStage, succeedStage, failStage, printTraceSummary, attachTraceToFailure } from '../utils/executionTrace.js';
import { initFlowRecord, updateFlowSummary, syncFromTraceContext } from '../utils/flowDebugger.js';
import { getIdempotencyResponse, putIdempotencyResponse } from '../db/idempotency.js';
import { errorResponse, successResponse } from '../utils/errorResponse.js';
import { structuredLog } from '../utils/structuredLog.js';
import { recordRequestStart, recordRequestEnd, recordIdempotencyHit, recordSlotConflict, getMetricsSnapshot } from '../utils/metrics.js';
import { maybeTriggerAlerts } from '../utils/alerts.js';

// Basic in-memory rate limiting (simple + safe)
const ipBuckets = new Map();
const toolBuckets = new Map();

function rateLimitHit(bucket, key, limitPerSec) {
  const now = Date.now();
  const entry = bucket.get(key) || { ts: now, count: 0 };
  if (now - entry.ts >= 1000) {
    entry.ts = now;
    entry.count = 0;
  }
  entry.count += 1;
  bucket.set(key, entry);
  return entry.count > limitPerSec;
}

function extractArgs(body) {
  const args =
    body?.toolCall?.function?.arguments ||
    body?.message?.toolCalls?.[0]?.function?.arguments;

  if (!args) return null;

  try {
    return typeof args === 'string' ? JSON.parse(args) : args;
  } catch {
    return null;
  }
}

function extractCallId(body) {
  // Try multiple locations where VAPI might send the call ID
  return body?.call?.id || 
         body?.message?.call?.id || 
         body?.callId || 
         body?.chat?.id || 
         // Use toolCallId as fallback (present in VAPI payloads)
         extractToolCallId(body) ||
         null;
}

function extractToolCallId(body) {
  return body?.message?.toolCalls?.[0]?.id || body?.toolCall?.id || null;
}

export function createWebhookRouter() {
  const router = express.Router();

  router.post('/vapi-webhook', async (req, res) => {
    const reqStart = Date.now();
    recordRequestStart();

    const callId = extractCallId(req.body);
    const toolCallId = extractToolCallId(req.body);
    const args = extractArgs(req.body);

    const limitPerSec = Math.max(1, Number(process.env.RATE_LIMIT_PER_SEC || 10));
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    if (rateLimitHit(ipBuckets, ip, limitPerSec) || (toolCallId && rateLimitHit(toolBuckets, toolCallId, 2))) {
      const out = errorResponse({ stage: 'WEBHOOK_RECEIVED', code: 'rate_limited', message: 'Rate limit exceeded' }, 429);

      const rt = Date.now() - reqStart;
      recordRequestEnd({ success: false, stage: 'WEBHOOK_RECEIVED', code: 'rate_limited', message: 'Rate limit exceeded', responseTimeMs: rt });
      const alerts = maybeTriggerAlerts({ metrics: getMetricsSnapshot(), dbErrorSpike: false });
      alerts.forEach((a) => structuredLog({ level: 'error', message: `ALERT ${a.type}: ${a.message}`, callId, stage: 'WEBHOOK_RECEIVED' }));
      if (rt > 1000) structuredLog({ level: 'error', message: `Slow request ${rt}ms`, callId, stage: 'WEBHOOK_RECEIVED' });

      return res.status(out.httpStatus).json(out.body);
    }

    // Initialize trace context and flow record for this request
    const traceContext = createTraceContext(callId, toolCallId);
    initFlowRecord(callId, toolCallId, args);
    
    // STAGE 1: WEBHOOK_RECEIVED
    enterStage(traceContext, 'WEBHOOK_RECEIVED', { 
      hasCallId: !!callId, 
      hasToolCallId: !!toolCallId, 
      hasArgs: !!args 
    });
    
    structuredLog({ level: 'info', message: 'Webhook received', callId, stage: 'WEBHOOK_RECEIVED', extra: { toolCallId } });
    succeedStage(traceContext, 'WEBHOOK_RECEIVED', { callId, toolCallId });

    // STAGE 2: REQUEST_VALIDATION
    enterStage(traceContext, 'REQUEST_VALIDATION', { fieldsPresent: { callId, toolCallId, args } });
    
    if (!callId || typeof callId !== 'string') {
      failStage(traceContext, 'REQUEST_VALIDATION', 'missing_callId', { callId });
      const failure = logFailure('WEBHOOK_VALIDATION', 'missing_callId', { callId, toolCallId });
      syncFromTraceContext(traceContext, 'failed', { 
        errorReason: 'missing_callId',
        stage: 'REQUEST_VALIDATION',
        responseStatus: 400 
      });
      const response = attachTraceToFailure(errorResponse({ stage: 'REQUEST_VALIDATION', code: 'missing_callId', message: 'Missing callId' }, 400).body, traceContext);

      const rt = Date.now() - reqStart;
      recordRequestEnd({ success: false, stage: 'REQUEST_VALIDATION', code: 'missing_callId', message: 'Missing callId', responseTimeMs: rt });
      const alerts = maybeTriggerAlerts({ metrics: getMetricsSnapshot(), dbErrorSpike: false });
      alerts.forEach((a) => structuredLog({ level: 'error', message: `ALERT ${a.type}: ${a.message}`, callId, stage: 'REQUEST_VALIDATION' }));
      structuredLog({ level: 'error', message: 'Request failed', callId, stage: 'REQUEST_VALIDATION', extra: { code: 'missing_callId' } });
      if (rt > 1000) structuredLog({ level: 'error', message: `Slow request ${rt}ms`, callId, stage: 'REQUEST_VALIDATION' });

      printTraceSummary(traceContext, 'FAILED');
      return res.status(400).json(response);
    }

    if (!toolCallId || typeof toolCallId !== 'string') {
      failStage(traceContext, 'REQUEST_VALIDATION', 'missing_toolCallId', { toolCallId });
      const failure = logFailure('WEBHOOK_VALIDATION', 'missing_toolCallId', { callId, toolCallId });
      syncFromTraceContext(traceContext, 'failed', { 
        errorReason: 'missing_toolCallId',
        stage: 'REQUEST_VALIDATION',
        responseStatus: 400 
      });
      const response = attachTraceToFailure(errorResponse({ stage: 'REQUEST_VALIDATION', code: 'missing_toolCallId', message: 'Missing toolCallId' }, 400).body, traceContext);

      const rt = Date.now() - reqStart;
      recordRequestEnd({ success: false, stage: 'REQUEST_VALIDATION', code: 'missing_toolCallId', message: 'Missing toolCallId', responseTimeMs: rt });
      const alerts = maybeTriggerAlerts({ metrics: getMetricsSnapshot(), dbErrorSpike: false });
      alerts.forEach((a) => structuredLog({ level: 'error', message: `ALERT ${a.type}: ${a.message}`, callId, stage: 'REQUEST_VALIDATION' }));
      structuredLog({ level: 'error', message: 'Request failed', callId, stage: 'REQUEST_VALIDATION', extra: { code: 'missing_toolCallId' } });
      if (rt > 1000) structuredLog({ level: 'error', message: `Slow request ${rt}ms`, callId, stage: 'REQUEST_VALIDATION' });

      printTraceSummary(traceContext, 'FAILED');
      return res.status(400).json(response);
    }

    if (!args || typeof args !== 'object') {
      failStage(traceContext, 'REQUEST_VALIDATION', 'missing_arguments', { args });
      const failure = logFailure('WEBHOOK_VALIDATION', 'missing_arguments', { callId, toolCallId });
      syncFromTraceContext(traceContext, 'failed', { 
        errorReason: 'missing_arguments',
        stage: 'REQUEST_VALIDATION',
        responseStatus: 400 
      });
      const response = attachTraceToFailure(errorResponse({ stage: 'REQUEST_VALIDATION', code: 'missing_arguments', message: 'Missing or invalid arguments' }, 400).body, traceContext);

      const rt = Date.now() - reqStart;
      recordRequestEnd({ success: false, stage: 'REQUEST_VALIDATION', code: 'missing_arguments', message: 'Missing or invalid arguments', responseTimeMs: rt });
      const alerts = maybeTriggerAlerts({ metrics: getMetricsSnapshot(), dbErrorSpike: false });
      alerts.forEach((a) => structuredLog({ level: 'error', message: `ALERT ${a.type}: ${a.message}`, callId, stage: 'REQUEST_VALIDATION' }));
      structuredLog({ level: 'error', message: 'Request failed', callId, stage: 'REQUEST_VALIDATION', extra: { code: 'missing_arguments' } });
      if (rt > 1000) structuredLog({ level: 'error', message: `Slow request ${rt}ms`, callId, stage: 'REQUEST_VALIDATION' });

      printTraceSummary(traceContext, 'FAILED');
      return res.status(400).json(response);
    }
    
    succeedStage(traceContext, 'REQUEST_VALIDATION', { callId, toolCallId, argsKeys: Object.keys(args) });
    
    // Update flow summary with extracted payload data
    updateFlowSummary(callId, {
      name: args?.name || null,
      service: args?.service || null,
      date: args?.date || null,
      time: args?.time || null
    });

    // STAGE 3: IDEMPOTENCY_CHECK
    enterStage(traceContext, 'IDEMPOTENCY_CHECK', { toolCallId });

    const existing = await getIdempotencyResponse(toolCallId);
    if (existing) {
      recordIdempotencyHit();
      failStage(traceContext, 'IDEMPOTENCY_CHECK', 'already_processed', { toolCallId });
      logFailure('IDEMPOTENCY_CHECK', 'already_processed', { callId, toolCallId });
      syncFromTraceContext(traceContext, 'duplicate', {
        errorReason: 'already_processed',
        stage: 'IDEMPOTENCY_CHECK',
        responseStatus: 200,
        summary: { errorReason: 'already_processed', responseTimeMs: Date.now() - reqStart, finalStatus: 'duplicate' }
      });
      const response = attachTraceToFailure(existing, traceContext);

      const rt = Date.now() - reqStart;
      recordRequestEnd({ success: true, stage: 'IDEMPOTENCY_CHECK', code: 'already_processed', message: 'Idempotency hit', responseTimeMs: rt });
      const alerts = maybeTriggerAlerts({ metrics: getMetricsSnapshot(), dbErrorSpike: false });
      alerts.forEach((a) => structuredLog({ level: 'error', message: `ALERT ${a.type}: ${a.message}`, callId, stage: 'IDEMPOTENCY_CHECK' }));
      if (rt > 1000) structuredLog({ level: 'error', message: `Slow request ${rt}ms`, callId, stage: 'IDEMPOTENCY_CHECK' });

      printTraceSummary(traceContext, 'DUPLICATE');
      return res.status(200).json(response);
    }
    succeedStage(traceContext, 'IDEMPOTENCY_CHECK', { isNew: true });

    // STAGE 4: PAYLOAD_EXTRACTION
    enterStage(traceContext, 'PAYLOAD_EXTRACTION', { rawArgs: args });
    succeedStage(traceContext, 'PAYLOAD_EXTRACTION', { extractedFields: Object.keys(args) });

    // Emit call received event
    emitEvent('CALL_RECEIVED', { callId, toolCallId, timestamp: new Date().toISOString() });

    try {
      // STAGE 5-7: Process booking (handled in receptionistEngine)
      enterStage(traceContext, 'BUSINESS_RULES', { raw: args });
      const result = await processBookingRequest({ callId, toolCallId, raw: args, traceContext });

      if (!result.ok) {
        if (result.stage === 'BUSINESS_RULES' && result.reason === 'slot-occupied') recordSlotConflict();

        // Trace already updated by receptionistEngine
        syncFromTraceContext(traceContext, 'failed', { 
          errorReason: result.reason, 
          stage: result.stage,
          responseStatus: 200,
          summary: {
            errorReason: result.reason,
            responseTimeMs: Date.now() - reqStart,
            finalStatus: 'failed'
          }
        });
        const out = errorResponse({
          stage: result.stage || 'BUSINESS_RULES',
          code: result.reason || 'failed',
          message: result.reason || 'Request failed'
        }, 200);
        const response = attachTraceToFailure(out.body, traceContext);
        await putIdempotencyResponse(toolCallId, response);

        const rt = Date.now() - reqStart;
        const isDbError = result.stage === 'DATABASE_WRITE';
        recordRequestEnd({ success: false, stage: result.stage, code: result.reason, message: result.reason, responseTimeMs: rt, isDbError });
        const m = getMetricsSnapshot();
        const dbSpike = m.recentFailures.filter(f => f.isDbError).length >= 3;
        const alerts = maybeTriggerAlerts({ metrics: m, dbErrorSpike: dbSpike });
        alerts.forEach((a) => structuredLog({ level: 'error', message: `ALERT ${a.type}: ${a.message}`, callId, stage: result.stage }));
        structuredLog({ level: 'error', message: 'Request failed', callId, stage: result.stage, extra: { code: result.reason } });
        if (rt > 1000) structuredLog({ level: 'error', message: `Slow request ${rt}ms`, callId, stage: result.stage });

        printTraceSummary(traceContext, 'FAILED');
        return res.status(200).json(response);
      }

      // STAGE 8: EVENT_EMISSION
      enterStage(traceContext, 'EVENT_EMISSION', { bookingId: result.booking.id, duplicate: result.duplicate });
      emitEvent('BOOKING_CREATED', { callId, toolCallId, booking: result.booking, duplicate: result.duplicate });
      succeedStage(traceContext, 'EVENT_EMISSION', { eventEmitted: 'BOOKING_CREATED' });

      // STAGE 9: RESPONSE_SENT
      enterStage(traceContext, 'RESPONSE_SENT', { status: 'success', hasBooking: true });
      const response = {
        ...successResponse({
          booking: result.booking,
          duplicate: result.duplicate || false
        }, 200).body,
        booking: result.booking,
        duplicate: result.duplicate || false
      };
      succeedStage(traceContext, 'RESPONSE_SENT', { responseStatus: 200 });
      
      // Sync trace to flow debugger and print summary
      syncFromTraceContext(traceContext, 'success', { 
        bookingId: result.booking.id, 
        responseStatus: 200,
        summary: {
          name: result.booking.name,
          service: result.booking.service,
          date: result.booking.date,
          time: result.booking.time,
          bookingId: result.booking.id,
          responseTimeMs: Date.now() - reqStart,
          finalStatus: 'success'
        }
      });
      printTraceSummary(traceContext, 'SUCCESS');
      await putIdempotencyResponse(toolCallId, response);

      const rt = Date.now() - reqStart;
      recordRequestEnd({ success: true, stage: 'RESPONSE_SENT', code: 'ok', message: 'success', responseTimeMs: rt });
      const alerts = maybeTriggerAlerts({ metrics: getMetricsSnapshot(), dbErrorSpike: false });
      alerts.forEach((a) => structuredLog({ level: 'error', message: `ALERT ${a.type}: ${a.message}`, callId, stage: 'RESPONSE_SENT' }));
      if (rt > 1000) structuredLog({ level: 'error', message: `Slow request ${rt}ms`, callId, stage: 'RESPONSE_SENT' });

      return res.status(200).json(response);
      
    } catch (error) {
      failStage(traceContext, 'UNKNOWN', 'unhandled_exception', { error: error.message, stack: error.stack });
      logFailure('UNKNOWN', 'unhandled_exception', { callId, toolCallId, data: { error: error.message } });
      syncFromTraceContext(traceContext, 'error', { 
        errorReason: 'unhandled_exception',
        responseStatus: 200,
        summary: {
          errorReason: 'unhandled_exception'
        }
      });
      const out = errorResponse({ stage: 'UNKNOWN', code: 'unhandled_exception', message: 'Unhandled exception' }, 200);
      const response = attachTraceToFailure(out.body, traceContext);
      await putIdempotencyResponse(toolCallId, response);

      const rt = Date.now() - reqStart;
      recordRequestEnd({ success: false, stage: 'UNKNOWN', code: 'unhandled_exception', message: 'Unhandled exception', responseTimeMs: rt, isDbError: false });
      const alerts = maybeTriggerAlerts({ metrics: getMetricsSnapshot(), dbErrorSpike: false });
      alerts.forEach((a) => structuredLog({ level: 'error', message: `ALERT ${a.type}: ${a.message}`, callId, stage: 'UNKNOWN' }));
      structuredLog({ level: 'error', message: 'Request failed', callId, stage: 'UNKNOWN', extra: { code: 'unhandled_exception' } });
      if (rt > 1000) structuredLog({ level: 'error', message: `Slow request ${rt}ms`, callId, stage: 'UNKNOWN' });

      printTraceSummary(traceContext, 'ERROR');
      return res.status(200).json(response);
    }
  });

  return router;
}
