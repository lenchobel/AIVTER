import { ignoredEvent } from '../utils/logger.js';

export function classifyVapiEvent(body) {
  const hasToolCalls = Array.isArray(body?.message?.toolCalls) && body.message.toolCalls.length > 0;

  if (hasToolCalls) {
    const first = body.message.toolCalls[0];
    const toolName = first?.function?.name;
    if (toolName === 'book_appointment') {
      return { type: 'tool-call', toolName, toolCall: first };
    }
    return { type: 'ignored', reason: 'tool-call-not-book_appointment', toolName };
  }

  const altToolName = body?.toolCall?.function?.name;
  if (altToolName === 'book_appointment') {
    return { type: 'tool-call', toolName: altToolName, toolCall: body.toolCall };
  }

  return { type: 'ignored', reason: 'non-tool-event' };
}

export function routeEvent(body) {
  const cls = classifyVapiEvent(body);
  if (cls.type === 'ignored') {
    ignoredEvent({ eventType: cls.reason || 'ignored', reason: cls.reason || 'ignored' });
  }
  return cls;
}
