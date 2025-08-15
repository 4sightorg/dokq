const crypto = require('crypto');
const CSRF_CONFIG = {
  TOKEN_LENGTH: 32,
  TOKEN_EXPIRY: 30 * 60 * 1000,
  COOKIE_NAME: '__csrf_token',
  HEADER_NAME: 'x-csrf-token',
  ROTATION_INTERVAL: 15 * 60 * 1000,
  MAX_TOKENS_PER_SESSION: 3,
};
class CSRFTokenStore {
  constructor() {
    this.tokens = new Map();
    this.sessionTokens = new Map();
    setInterval(() => this.cleanupExpiredTokens(), 5 * 60 * 1000);
  }
  storeToken(sessionId, token, expiry) {
    const tokenData = {
      sessionId,
      expiry,
      created: Date.now(),
    };
    this.tokens.set(token, tokenData);
    if (!this.sessionTokens.has(sessionId)) {
      this.sessionTokens.set(sessionId, new Set());
    }
    const sessionSet = this.sessionTokens.get(sessionId);
    sessionSet.add(token);
    if (sessionSet.size > CSRF_CONFIG.MAX_TOKENS_PER_SESSION) {
      const oldestToken = sessionSet.values().next().value;
      this.removeToken(oldestToken);
    }
  }
  validateToken(token, sessionId) {
    const tokenData = this.tokens.get(token);
    if (!tokenData) {
      return false;
    }
    if (Date.now() > tokenData.expiry) {
      this.removeToken(token);
      return false;
    }
    if (tokenData.sessionId !== sessionId) {
      return false;
    }
    return true;
  }
  removeToken(token) {
    const tokenData = this.tokens.get(token);
    if (tokenData) {
      this.tokens.delete(token);
      const sessionSet = this.sessionTokens.get(tokenData.sessionId);
      if (sessionSet) {
        sessionSet.delete(token);
        if (sessionSet.size === 0) {
          this.sessionTokens.delete(tokenData.sessionId);
        }
      }
    }
  }
  removeSessionTokens(sessionId) {
    const sessionSet = this.sessionTokens.get(sessionId);
    if (sessionSet) {
      for (const token of sessionSet) {
        this.tokens.delete(token);
      }
      this.sessionTokens.delete(sessionId);
    }
  }
  cleanupExpiredTokens() {
    const now = Date.now();
    const expiredTokens = [];
    for (const [token, tokenData] of this.tokens) {
      if (now > tokenData.expiry) {
        expiredTokens.push(token);
      }
    }
    for (const token of expiredTokens) {
      this.removeToken(token);
    }
    console.log(`Cleaned up ${expiredTokens.length} expired CSRF tokens`);
  }
  getStats() {
    return {
      totalTokens: this.tokens.size,
      activeSessions: this.sessionTokens.size,
      timestamp: new Date().toISOString(),
    };
  }
}
const tokenStore = new CSRFTokenStore();
function generateCSRFToken() {
  return crypto.randomBytes(CSRF_CONFIG.TOKEN_LENGTH).toString('base64url');
}
function createCSRFToken(sessionId) {
  const token = generateCSRFToken();
  const expiry = Date.now() + CSRF_CONFIG.TOKEN_EXPIRY;
  tokenStore.storeToken(sessionId, token, expiry);
  return {
    token,
    expiry,
    maxAge: CSRF_CONFIG.TOKEN_EXPIRY,
  };
}
function validateCSRFToken(req, sessionId) {
  const headerToken = req.headers[CSRF_CONFIG.HEADER_NAME];
  const bodyToken = req.body?._csrf;
  const cookieToken = req.cookies?.[CSRF_CONFIG.COOKIE_NAME];
  const token = headerToken || bodyToken;
  if (!token) {
    return {
      valid: false,
      error: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING',
    };
  }
  if (cookieToken && token !== cookieToken) {
    return {
      valid: false,
      error: 'CSRF token mismatch',
      code: 'CSRF_TOKEN_MISMATCH',
    };
  }
  const isValid = tokenStore.validateToken(token, sessionId);
  if (!isValid) {
    return {
      valid: false,
      error: 'Invalid or expired CSRF token',
      code: 'CSRF_TOKEN_INVALID',
    };
  }
  return {
    valid: true,
    token,
  };
}
function csrfMiddleware(options = {}) {
  const {
    skipRoutes = [],
    skipMethods = ['GET', 'HEAD', 'OPTIONS'],
    sessionIdExtractor = req => req.user?.uid || req.sessionID,
    errorHandler = null,
  } = options;
  return (req, res, next) => {
    if (skipMethods.includes(req.method)) {
      return next();
    }
    if (skipRoutes.some(route => req.path.includes(route))) {
      return next();
    }
    const sessionId = sessionIdExtractor(req);
    if (!sessionId) {
      const error = new Error('Session required for CSRF protection');
      error.status = 401;
      error.code = 'CSRF_SESSION_REQUIRED';
      return errorHandler ? errorHandler(error, req, res, next) : next(error);
    }
    const validation = validateCSRFToken(req, sessionId);
    if (!validation.valid) {
      const error = new Error(validation.error);
      error.status = 403;
      error.code = validation.code;
      return errorHandler ? errorHandler(error, req, res, next) : next(error);
    }
    req.csrf = {
      token: validation.token,
      sessionId,
      valid: true,
    };
    next();
  };
}
function generateTokenResponse(req, res, sessionId) {
  const tokenData = createCSRFToken(sessionId);
  res.cookie(CSRF_CONFIG.COOKIE_NAME, tokenData.token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: tokenData.maxAge,
    path: '/',
  });
  return {
    csrfToken: tokenData.token,
    expiry: tokenData.expiry,
    headerName: CSRF_CONFIG.HEADER_NAME,
    cookieName: CSRF_CONFIG.COOKIE_NAME,
  };
}
function cleanupSession(sessionId) {
  tokenStore.removeSessionTokens(sessionId);
}
function shouldRotateToken(token) {
  const tokenData = tokenStore.tokens.get(token);
  if (!tokenData) return true;
  const age = Date.now() - tokenData.created;
  return age > CSRF_CONFIG.ROTATION_INTERVAL;
}
function configureCSRFProtection(app, options = {}) {
  const {
    errorHandler,
    skipRoutes = ['/api/auth/csrf-token', '/api/health'],
    skipMethods = ['GET', 'HEAD', 'OPTIONS'],
    sessionIdExtractor,
  } = options;
  app.use(
    csrfMiddleware({
      skipRoutes,
      skipMethods,
      sessionIdExtractor,
      errorHandler,
    })
  );
  console.log('✅ CSRF protection configured');
  console.log(`   Skip routes: ${skipRoutes.join(', ')}`);
  console.log(`   Skip methods: ${skipMethods.join(', ')}`);
}
function getCSRFStats() {
  return {
    ...tokenStore.getStats(),
    config: {
      tokenLength: CSRF_CONFIG.TOKEN_LENGTH,
      tokenExpiry: CSRF_CONFIG.TOKEN_EXPIRY,
      rotationInterval: CSRF_CONFIG.ROTATION_INTERVAL,
      maxTokensPerSession: CSRF_CONFIG.MAX_TOKENS_PER_SESSION,
    },
  };
}
const csrfProtection = {
  generateCSRFToken,
  createCSRFToken,
  validateCSRFToken,
  csrfMiddleware,
  generateTokenResponse,
  cleanupSession,
  shouldRotateToken,
  configureCSRFProtection,
  getCSRFStats,
  CSRF_CONFIG,
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = csrfProtection;
} else if (typeof window !== 'undefined') {
  window.csrfProtection = csrfProtection;
}
export default csrfProtection;
