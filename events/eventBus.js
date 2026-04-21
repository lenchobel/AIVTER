import { EventEmitter } from 'events';
import { logFailure } from '../utils/failureLogger.js';

const eventBus = new EventEmitter();

export function emitEvent(eventName, payload) {
  try {
    console.log(`[EVENT] ${eventName}`, JSON.stringify(payload));
    eventBus.emit(eventName, payload);
  } catch (err) {
    logFailure('EVENT_EMISSION', 'handler_crashed', {
      callId: payload?.callId || 'unknown',
      toolCallId: payload?.toolCallId || 'unknown',
      data: { eventName, error: err.message }
    });
  }
}

export function onEvent(eventName, handler) {
  eventBus.on(eventName, handler);
}

export function offEvent(eventName, handler) {
  eventBus.off(eventName, handler);
}

export default eventBus;
