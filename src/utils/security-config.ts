export const SECURITY_CONFIG = {
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    MAX_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, 
  },
  SESSION: {
    TIMEOUT: 30 * 60 * 1000, 
    REFRESH_THRESHOLD: 5 * 60 * 1000, 
    MAX_CONCURRENT_SESSIONS: 3,
  },
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, 
    MAX_REQUESTS: 100,
    SKIP_SUCCESSFUL_REQUESTS: false,
    SKIP_FAILED_REQUESTS: false,
  },
  CORS: {
    ALLOWED_ORIGINS: process.env.NODE_ENV === 'production' 
      ? ['https:
      : ['http:
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
    CREDENTIALS: true,
  },
  CSP: {
    DEFAULT_SRC: ["'self'"],
    SCRIPT_SRC: ["'self'", "'unsafe-inline'", 'https:
    STYLE_SRC: ["'self'", "'unsafe-inline'", 'https:
    FONT_SRC: ["'self'", 'https:
    IMG_SRC: ["'self'", 'data:', 'https:'],
    CONNECT_SRC: ["'self'", 'https:
    FRAME_SRC: ["'self'"],
    OBJECT_SRC: ["'none'"],
    BASE_URI: ["'self'"],
    FORM_ACTION: ["'self'"],
  },
  VALIDATION: {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_REGEX: /^[\d\s\-()+\+]+$/,
    NAME_REGEX: /^[a-zA-Z\s\-']+$/,
    MAX_STRING_LENGTH: 1000,
    MAX_FILE_SIZE: 10 * 1024 * 1024, 
    ALLOWED_FILE_TYPES: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
  },
  AUDIT: {
    ENABLED: true,
    LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    SENSITIVE_FIELDS: ['password', 'token', 'apiKey', 'secret'],
  },
} as const;
export const SecurityUtils = {
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') 
      .trim()
      .slice(0, SECURITY_CONFIG.VALIDATION.MAX_STRING_LENGTH);
  },
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (password.length < SECURITY_CONFIG.PASSWORD.MIN_LENGTH) {
      errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD.MIN_LENGTH} characters long`);
    }
    if (SECURITY_CONFIG.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (SECURITY_CONFIG.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (SECURITY_CONFIG.PASSWORD.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (SECURITY_CONFIG.PASSWORD.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  },
  generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomArray = new Uint8Array(length);
    crypto.getRandomValues(randomArray);
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomArray[i] % chars.length);
    }
    return result;
  },
  hashSensitiveData(data: string): string {
    return `***${data.slice(-4)}`;
  },
  validateFileUpload(file: File): { isValid: boolean; error?: string } {
    if (file.size > SECURITY_CONFIG.VALIDATION.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size must be less than ${SECURITY_CONFIG.VALIDATION.MAX_FILE_SIZE / (1024 * 1024)}MB`
      };
    }
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SECURITY_CONFIG.VALIDATION.ALLOWED_FILE_TYPES.includes(fileExtension)) {
      return {
        isValid: false,
        error: `File type not allowed. Allowed types: ${SECURITY_CONFIG.VALIDATION.ALLOWED_FILE_TYPES.join(', ')}`
      };
    }
    return { isValid: true };
  }
}; 