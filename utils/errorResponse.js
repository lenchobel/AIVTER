export function errorResponse({ stage, code, message }, httpStatus = 200) {
  return {
    httpStatus,
    body: {
      success: false,
      error: {
        stage: stage || 'UNKNOWN',
        code: code || 'unknown',
        message: message || 'Unknown error'
      }
    }
  };
}

export function successResponse(payload, httpStatus = 200) {
  return {
    httpStatus,
    body: {
      success: true,
      ...payload
    }
  };
}
