const isProduction = () => {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
        return true;
    }
    if (typeof import.meta.env !== 'undefined' && import.meta.env.PROD) {
        return true;
    }
    if (typeof window !== 'undefined') {
        return !['localhost', '127.0.0.1'].includes(window.location.hostname);
    }
    return true;
};
const SAFE_ERROR_MESSAGES = {
    'auth/user-not-found': 'Invalid login credentials',
    'auth/wrong-password': 'Invalid login credentials',
    'auth/invalid-email': 'Please enter a valid email address',
    'auth/user-disabled': 'Account access has been restricted',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Please check your connection',
    'auth/email-already-in-use': 'Email address is already registered',
    'auth/weak-password': 'Password does not meet security requirements',
    'auth/operation-not-allowed': 'This operation is not available',
    'permission-denied': 'Access denied',
    'not-found': 'Requested resource not found',
    'already-exists': 'Resource already exists',
    'failed-precondition': 'Operation cannot be completed',
    'out-of-range': 'Invalid request parameters',
    'invalid-argument': 'Invalid request data',
    'deadline-exceeded': 'Request timeout',
    'unavailable': 'Service temporarily unavailable',
    'validation-error': 'Invalid input data',
    'rate-limit-exceeded': 'Too many requests. Please try again later',
    'internal-error': 'An unexpected error occurred',
    'network-error': 'Network connection error',
    'timeout-error': 'Request timeout',
    'forbidden': 'Access forbidden',
    'unauthorized': 'Authentication required'
};
function sanitizeError(error, options = {}) {
    const {
        includeCode = false,
        includeDetails = false,
        logOriginal = true,
        context = 'general'
    } = options;
    if (logOriginal && typeof console !== 'undefined') {
        console.error(`[${context}] Original error:`, error);
    }
    let errorCode = '';
    let errorMessage = '';
    let originalMessage = '';
    if (error && typeof error === 'object') {
        errorCode = error.code || error.name || 'unknown-error';
        errorMessage = error.message || '';
        originalMessage = errorMessage;
    } else if (typeof error === 'string') {
        originalMessage = error;
        errorMessage = error;
        errorCode = 'string-error';
    } else {
        originalMessage = String(error);
        errorMessage = 'Unknown error occurred';
        errorCode = 'unknown-error';
    }
    if (isProduction()) {
        const safeMessage = SAFE_ERROR_MESSAGES[errorCode];
        if (safeMessage) {
            errorMessage = safeMessage;
        } else {
            if (errorMessage.toLowerCase().includes('password')) {
                errorMessage = 'Authentication failed';
            } else if (errorMessage.toLowerCase().includes('email')) {
                errorMessage = 'Invalid email address';
            } else if (errorMessage.toLowerCase().includes('permission') || 
                      errorMessage.toLowerCase().includes('unauthorized') ||
                      errorMessage.toLowerCase().includes('forbidden')) {
                errorMessage = 'Access denied';
            } else if (errorMessage.toLowerCase().includes('network') ||
                      errorMessage.toLowerCase().includes('connection')) {
                errorMessage = 'Network error occurred';
            } else if (errorMessage.toLowerCase().includes('timeout')) {
                errorMessage = 'Request timeout';
            } else if (
                      errorMessage.toLowerCase().includes('too many')) {
                errorMessage = 'Too many requests. Please try again later';
            } else {
                errorMessage = 'An error occurred. Please try again';
            }
        }
    }
    const sanitizedResponse = {
        error: errorMessage,
        timestamp: new Date().toISOString()
    };
    if ((includeCode || !isProduction()) && errorCode) {
        sanitizedResponse.code = errorCode;
    }
    if ((includeDetails || !isProduction()) && originalMessage !== errorMessage) {
        sanitizedResponse.originalMessage = originalMessage;
    }
    return sanitizedResponse;
}
function sanitizeValidationErrors(validationErrors) {
    if (isProduction()) {
        return {
            error: 'Invalid input data',
            message: 'Please check your input and try again',
            timestamp: new Date().toISOString()
        };
    }
    const sanitizedErrors = validationErrors.map(err => ({
        field: err.param || err.path || 'unknown',
        message: err.msg || 'Invalid value',
        value: undefined 
    }));
    return {
        error: 'Validation Error',
        message: 'Please correct the following issues',
        details: sanitizedErrors,
        timestamp: new Date().toISOString()
    };
}
function createSafeErrorResponse(error, statusCode = 500, options = {}) {
    const sanitized = sanitizeError(error, {
        context: options.context || 'http-api',
        ...options
    });
    return {
        status: statusCode,
        error: sanitized.error,
        timestamp: sanitized.timestamp,
        ...(sanitized.code && { code: sanitized.code }),
        ...(sanitized.originalMessage && { debug: sanitized.originalMessage })
    };
}
function secureErrorHandler(err, req, res, next) {
    console.error(`[${req.method} ${req.path}] Error:`, err);
    let statusCode = err.status || err.statusCode || 500;
    if (err.code) {
        if (err.code.startsWith('auth/')) {
            statusCode = 401;
        } else if (err.code === 'permission-denied') {
            statusCode = 403;
        } else if (err.code === 'not-found') {
            statusCode = 404;
        } else if (err.code === 'already-exists') {
            statusCode = 409;
        }
    }
    const safeResponse = createSafeErrorResponse(err, statusCode, {
        context: `${req.method} ${req.path}`
    });
    res.status(statusCode).json(safeResponse);
}
function secureErrorLog(context, error, additionalInfo = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        context,
        error: {
            message: error.message,
            code: error.code,
            name: error.name,
            ...(isProduction() ? {} : { stack: error.stack })
        },
        ...additionalInfo
    };
    console.error('Secure Error Log:', JSON.stringify(logEntry, null, 2));
}
const errorSanitizerModule = {
    sanitizeError,
    sanitizeValidationErrors,
    createSafeErrorResponse,
    secureErrorHandler,
    secureErrorLog,
    isProduction
};
if (typeof module !== 'undefined' && module.exports) {
    module.exports = errorSanitizerModule;
} else if (typeof window !== 'undefined') {
    window.errorSanitizer = errorSanitizerModule;
}
export default errorSanitizerModule; 