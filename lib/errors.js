// ============================================================
// ERROR HANDLING
// ============================================================
// ApiError       — throw this to return a specific status + message.
// asyncHandler   — wraps async route handlers so thrown errors
//                  reach the central error handler.
// errorHandler   — final Express middleware. Formats all errors
//                  as { error, details? }.
// ============================================================

class ApiError extends Error {
    constructor(status, message, details = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
    }
}

// Wrap an async handler so rejections go to next(err)
function asyncHandler(fn) {
    return (req, res, next) =>
        Promise.resolve(fn(req, res, next)).catch(next);
}

// Central Express error middleware (must be registered last)
function errorHandler(err, req, res, next) {   // eslint-disable-line no-unused-vars
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal server error.';

    // Log full details for 5xx
    if (status >= 500) {
        console.error('[500]', req.method, req.originalUrl, '→', err);
    }

    res.status(status).json({
        error: message,
        ...(err.details ? { details: err.details } : {})
    });
}

module.exports = {
    ApiError,
    asyncHandler,
    errorHandler
};
