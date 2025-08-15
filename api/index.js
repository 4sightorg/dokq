const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { body, param, query, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
let jwtHelper;
try {
  jwtHelper = require('../src/utils/jwt-helper.js').default;
} catch (err) {
  jwtHelper = null;
}
const morgan = require('morgan');
const admin = require('firebase-admin');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const validator = require('validator');
require('dotenv').config();

let errorSanitizer;
try {
  errorSanitizer = require('../src/utils/error-sanitizer.js');
} catch (err) {
  errorSanitizer = {
    sanitizeError: () => ({
      error: 'An error occurred',
      timestamp: new Date().toISOString(),
    }),
    sanitizeValidationErrors: () => ({
      error: 'Invalid input data',
      timestamp: new Date().toISOString(),
    }),
    secureErrorHandler: (err, req, res, next) => {
      res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    },
  };
}

let csrfProtection;
try {
  csrfProtection = require('../src/utils/csrf-protection.js');
} catch (err) {
  csrfProtection = {
    csrfMiddleware: () => (req, res, next) => next(),
    generateTokenResponse: () => ({
      csrfToken: 'disabled',
      message: 'CSRF protection disabled',
    }),
    cleanupSession: () => {},
    getCSRFStats: () => ({ disabled: true }),
  };
}

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          'https://fonts.googleapis.com',
          'https://cdnjs.cloudflare.com',
        ],
        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com',
          'https://cdnjs.cloudflare.com',
        ],
        scriptSrc: [
          "'self'",
          'https://cdn.jsdelivr.net',
          'https://apis.google.com',
          'https://www.gstatic.com',
        ],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          'https://dokq-ph.firebaseapp.com',
          'https://apis.google.com',
          'https://www.googleapis.com',
          'https://accounts.google.com',
        ],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        workerSrc: ["'none'"],
        mediaSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: false,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
  })
);

app.use((req, res, next) => {
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
  );
  if (req.path.includes('/api/')) {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

app.use((req, res, next) => {
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 10485760) {
    return res.status(413).json({
      error: 'Request Entity Too Large',
      message: 'Request size exceeds maximum allowed limit',
    });
  }
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (
      contentType &&
      !contentType.includes('application/json') &&
      !contentType.includes('application/x-www-form-urlencoded') &&
      !contentType.includes('multipart/form-data')
    ) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: 'Content type not supported',
      });
    }
  }
  const userAgent = req.headers['user-agent'];
  const suspiciousAgents = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /masscan/i,
    /nmap/i,
    /scanner/i,
    /burpsuite/i,
    /zap/i,
  ];
  if (userAgent && suspiciousAgents.some(pattern => pattern.test(userAgent))) {
    return res
      .status(403)
      .json({ error: 'Forbidden', message: 'Request blocked' });
  }
  const suspiciousHeaders = ['x-forwarded-host', 'x-real-ip'];
  for (const header of suspiciousHeaders) {
    if (req.headers[header] && req.headers[header] !== req.headers.host) {
      return res
        .status(403)
        .json({ error: 'Forbidden', message: 'Invalid request headers' });
    }
  }
  next();
});

if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use((req, res, next) => {
  const suspiciousPatterns = [
    /(union|select|insert|delete|drop|update|exec|script)/i,
    /(<script|javascript:|on\w+\s*=|vbscript:)/i,
    /(\.\.\/|\.\.\\)/,
    /(;|&&|\|\|)/,
    /(\${|\{\{|\[\[)/,
  ];
  const checkForSuspiciousContent = (obj, path = '') => {
    if (typeof obj === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(obj)) {
          return true;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (checkForSuspiciousContent(value, `${path}.${key}`)) return true;
      }
    }
    return false;
  };
  checkForSuspiciousContent(req.query, 'query');
  if (req.body) checkForSuspiciousContent(req.body, 'body');
  Object.entries(req.headers).find(
    ([key, value]) =>
      typeof value === 'string' &&
      suspiciousPatterns.some(pattern => pattern.test(value))
  );
  next();
});

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const allowedOrigins =
        process.env.NODE_ENV === 'production'
          ? [process.env.CORS_ORIGIN || 'http://localhost:5173']
          : [
              'http://localhost:5173',
              'http://localhost:3000',
              'http://localhost:3001',
              'http://localhost:8080',
              'http://127.0.0.1:5173',
              'http://127.0.0.1:3000',
            ];
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400,
  })
);

app.use(mongoSanitize());
const cookieParser = require('cookie-parser');
app.use(cookieParser());

app.use(express.json({ limit: '10mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const sanitizeString = (str, maxLength = 1000) => {
  if (!str || typeof str !== 'string') return '';
  let sanitized = str
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/file:/gi, '')
    .trim()
    .substring(0, maxLength);
  return xss(validator.escape(sanitized));
};

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain:
    process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:
    process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
  measurementId:
    process.env.FIREBASE_MEASUREMENT_ID ||
    process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  process.exit(1);
}

let adminAuth;
let db;
try {
  if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : null;
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseConfig.projectId,
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: firebaseConfig.projectId,
      });
    }
  }
  if (admin.apps.length > 0) {
    adminAuth = admin.auth();
    db = admin.firestore();
  } else {
    adminAuth = null;
    db = null;
  }
} catch (error) {
  adminAuth = null;
  db = null;
}

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No valid authorization token provided',
      });
    }
    const token = authHeader.split(' ')[1];
    if (adminAuth) {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
    } else {
      if (jwtHelper) {
        try {
          const decoded = jwtHelper.verifyToken(token);
          req.user = decoded;
        } catch (jwtError) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token',
          });
        }
      } else {
        const jwtSecret = process.env.JWT_SECRET;
        if (
          !jwtSecret ||
          jwtSecret === 'fallback-secret' ||
          jwtSecret.length < 32
        ) {
          return res.status(500).json({
            error: 'Server configuration error',
            message: 'Authentication service unavailable',
          });
        }
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
      }
    }
    next();
  } catch (error) {
    res
      .status(401)
      .json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};

const requireRole = roles => {
  return (req, res, next) => {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'Authentication required' });
    const userRole = req.user.role || req.user.custom_claims?.role;
    if (!roles.includes(userRole))
      return res
        .status(403)
        .json({ error: 'Forbidden', message: 'Insufficient permissions' });
    next();
  };
};

const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const sanitizedResponse = errorSanitizer.sanitizeValidationErrors(
      errors.array()
    );
    return res.status(400).json(sanitizedResponse);
  }
  next();
};

const csrfErrorHandler = (err, req, res, next) => {
  if (err.code && err.code.startsWith('CSRF_')) {
    const sanitized = errorSanitizer.sanitizeError(err, {
      context: 'csrf-protection',
    });
    return res.status(err.status || 403).json({
      error: 'CSRF protection error',
      message: sanitized.error,
      code: err.code,
      timestamp: sanitized.timestamp,
    });
  }
  next(err);
};

if (csrfProtection.configureCSRFProtection) {
  const csrfOptions = {
    errorHandler: csrfErrorHandler,
    skipRoutes: [
      '/api/auth/csrf-token',
      '/api/health',
      '/api/dashboard/stats',
      '/api/surgery/queue',
      '/api/or/status',
      '/api/rural/patients',
      '/api/analytics/wait-times',
      '/api/patient/',
    ],
    skipMethods: ['GET', 'HEAD', 'OPTIONS'],
    sessionIdExtractor: req =>
      req.user?.uid || req.sessionID || `anonymous_${req.ip}`,
  };
  app.use(csrfProtection.csrfMiddleware(csrfOptions));
}

const errorHandler = (err, req, res, next) => {
  errorSanitizer.secureErrorHandler(err, req, res, next);
};

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'DokQ PH API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

app.get('/api/auth/csrf-token', authenticateUser, async (req, res) => {
  try {
    const sessionId = req.user?.uid || req.sessionID || `anonymous_${req.ip}`;
    if (!csrfProtection.generateTokenResponse) {
      return res.json({
        error: 'CSRF protection not available',
        message: 'CSRF tokens are disabled in this configuration',
      });
    }
    const tokenResponse = csrfProtection.generateTokenResponse(
      req,
      res,
      sessionId
    );
    res.json({
      success: true,
      ...tokenResponse,
      message: 'CSRF token generated successfully',
      instructions: {
        header: `Include token in '${tokenResponse.headerName}' header for all state-changing requests`,
        cookie: `Token also set as '${tokenResponse.cookieName}' cookie for double-submit pattern`,
        expiry: 'Token expires in 30 minutes and should be refreshed as needed',
      },
    });
  } catch (error) {
    const sanitized = errorSanitizer.sanitizeError(error, {
      context: 'csrf-token-generation',
    });
    res
      .status(500)
      .json({ error: 'Failed to generate CSRF token', ...sanitized });
  }
});

app.post('/api/auth/csrf-token/refresh', authenticateUser, async (req, res) => {
  try {
    const sessionId = req.user?.uid || req.sessionID || `anonymous_${req.ip}`;
    const currentToken =
      req.headers[csrfProtection.CSRF_CONFIG?.HEADER_NAME] || req.body?._csrf;
    const shouldRotate =
      !currentToken || csrfProtection.shouldRotateToken?.(currentToken);
    if (!shouldRotate) {
      return res.json({
        success: true,
        message: 'Current CSRF token is still valid',
        shouldRefresh: false,
      });
    }
    const tokenResponse = csrfProtection.generateTokenResponse(
      req,
      res,
      sessionId
    );
    res.json({
      success: true,
      ...tokenResponse,
      message: 'CSRF token refreshed successfully',
      rotated: true,
    });
  } catch (error) {
    const sanitized = errorSanitizer.sanitizeError(error, {
      context: 'csrf-token-refresh',
    });
    res
      .status(500)
      .json({ error: 'Failed to refresh CSRF token', ...sanitized });
  }
});

app.get(
  '/api/dashboard/stats',
  authenticateUser,
  requireRole(['admin', 'doctor', 'nurse']),
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be in ISO8601 format'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be in ISO8601 format'),
    query('hospital')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z0-9\s\-\_\.]+$/)
      .withMessage(
        'Hospital must be under 100 characters and contain only alphanumeric characters'
      ),
  ],
  validateInput,
  async (req, res) => {
    try {
      const userRole = req.user.role || req.user.custom_claims?.role;
      const stats = {
        patientsInQueue: userRole === 'admin' ? 847 : 156,
        averageWaitTime: '89 days',
        orUtilization: '78%',
        urgentCases: 23,
        mobileClinicVisits: 42,
        offlineConsultations: 31,
        lastUpdated: new Date().toISOString(),
      };
      res.json(stats);
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, {
        context: 'fetch-dashboard-stats',
      });
      res
        .status(500)
        .json({ error: 'Failed to fetch dashboard statistics', ...sanitized });
    }
  }
);

app.get(
  '/api/surgery/queue',
  authenticateUser,
  requireRole(['admin', 'doctor', 'surgeon']),
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
    query('urgency')
      .optional()
      .isIn(['Low', 'Medium', 'High', 'Critical'])
      .withMessage('Invalid urgency level'),
    query('specialty')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-Z\s\-]+$/)
      .withMessage(
        'Specialty must be under 50 characters and contain only letters'
      ),
    query('location')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z0-9\s\,\.\-]+$/)
      .withMessage('Location must be under 100 characters'),
  ],
  validateInput,
  async (req, res) => {
    try {
      const userRole = req.user.role || req.user.custom_claims?.role;
      const surgeryQueue = [
        {
          id: '1',
          patientName: 'Maria Santos',
          patientId: 'patient_001',
          procedure: 'Hysterectomy',
          urgency: 'Critical',
          waitTime: 156,
          location: 'Manila',
          urgencyScore: 89,
          estimatedDuration: '2-3 hours',
          requiredSpecialty: 'Gynecology',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          patientName: 'Ana Rodriguez',
          patientId: 'patient_002',
          procedure: 'Fibroid Removal',
          urgency: 'High',
          waitTime: 134,
          location: 'Quezon City',
          urgencyScore: 82,
          estimatedDuration: '1-2 hours',
          requiredSpecialty: 'Gynecology',
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          patientName: 'Carmen Dela Cruz',
          patientId: 'patient_003',
          procedure: 'Ovarian Cyst Surgery',
          urgency: 'High',
          waitTime: 98,
          location: 'Rural Bataan',
          urgencyScore: 78,
          estimatedDuration: '1-2 hours',
          requiredSpecialty: 'Gynecology',
          createdAt: new Date().toISOString(),
        },
      ];
      const filteredQueue =
        userRole === 'admin'
          ? surgeryQueue
          : surgeryQueue.filter(item => item.location === req.user.location);
      res.json({
        queue: filteredQueue,
        totalCount: filteredQueue.length,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, {
        context: 'fetch-surgery-queue',
      });
      res
        .status(500)
        .json({ error: 'Failed to fetch surgery queue', ...sanitized });
    }
  }
);

app.get(
  '/api/or/status',
  authenticateUser,
  requireRole(['admin', 'doctor', 'nurse', 'or_coordinator']),
  [
    query('status')
      .optional()
      .isIn(['Available', 'In Use', 'Maintenance', 'Scheduled'])
      .withMessage('Invalid OR status'),
    query('specialty')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-Z\s\-]+$/)
      .withMessage(
        'Specialty must be under 50 characters and contain only letters'
      ),
    query('minUtilization')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('Minimum utilization must be between 0 and 100'),
    query('maxUtilization')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('Maximum utilization must be between 0 and 100'),
  ],
  validateInput,
  async (req, res) => {
    try {
      const orStatus = [
        {
          id: 'OR-1',
          status: 'In Use',
          utilization: 85,
          specialty: 'Gynecology',
          currentProcedure: 'Hysterectomy',
          estimatedCompletion: '2024-01-15T14:30:00Z',
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'OR-2',
          status: 'Available',
          utilization: 72,
          specialty: 'General Surgery',
          currentProcedure: null,
          estimatedCompletion: null,
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'OR-3',
          status: 'Maintenance',
          utilization: 45,
          specialty: 'Orthopedics',
          currentProcedure: null,
          estimatedCompletion: '2024-01-15T16:00:00Z',
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'OR-4',
          status: 'In Use',
          utilization: 92,
          specialty: 'Gynecology',
          currentProcedure: 'Fibroid Removal',
          estimatedCompletion: '2024-01-15T15:00:00Z',
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'OR-5',
          status: 'Scheduled',
          utilization: 68,
          specialty: 'Cardiology',
          currentProcedure: null,
          estimatedCompletion: '2024-01-15T13:00:00Z',
          lastUpdated: new Date().toISOString(),
        },
      ];
      res.json({
        orStatus,
        totalRooms: orStatus.length,
        averageUtilization: Math.round(
          orStatus.reduce((acc, or) => acc + or.utilization, 0) /
            orStatus.length
        ),
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, {
        context: 'fetch-or-status',
      });
      res
        .status(500)
        .json({ error: 'Failed to fetch OR status', ...sanitized });
    }
  }
);

app.post(
  '/api/or/optimize',
  authenticateUser,
  requireRole(['admin', 'or_coordinator']),
  [
    body('orData').isArray().withMessage('OR data must be an array'),
    body('orData.*.id').notEmpty().withMessage('OR ID is required'),
    body('orData.*.utilization')
      .isNumeric()
      .withMessage('Utilization must be a number'),
    body('demandData')
      .optional()
      .isObject()
      .withMessage('Demand data must be an object'),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { orData, demandData } = req.body;
      const sanitizedOrData = orData.map(or => ({
        id: or.id,
        status: or.status,
        utilization: Math.min(Math.max(or.utilization, 0), 100),
        specialty: or.specialty,
      }));
      const suggestions = [
        {
          suggestion:
            'Reschedule OR-3 maintenance to off-peak hours (6 PM - 6 AM)',
          impact: '+12% utilization',
          priority: 'High',
          estimatedImplementationTime: '1 week',
        },
        {
          suggestion:
            'Cross-train staff for gynecology procedures to reduce bottlenecks',
          impact: '+8% efficiency',
          priority: 'Medium',
          estimatedImplementationTime: '2-3 months',
        },
        {
          suggestion:
            'Extend OR-1 operating hours on Wednesdays to handle backlog',
          impact: '+15% capacity',
          priority: 'High',
          estimatedImplementationTime: '2 weeks',
        },
        {
          suggestion: 'Implement rapid turnover protocols between procedures',
          impact: '+20 min saved per surgery',
          priority: 'Medium',
          estimatedImplementationTime: '1 month',
        },
      ];
      res.json({
        suggestions,
        generatedAt: new Date().toISOString(),
        basedOn: {
          orRoomsAnalyzed: sanitizedOrData.length,
          averageUtilization: Math.round(
            sanitizedOrData.reduce((acc, or) => acc + or.utilization, 0) /
              sanitizedOrData.length
          ),
        },
      });
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, {
        context: 'generate-optimization-suggestions',
      });
      res.status(500).json({
        error: 'Failed to generate optimization suggestions',
        ...sanitized,
      });
    }
  }
);

app.post(
  '/api/ai/consultation',
  authenticateUser,
  requireRole(['admin', 'doctor', 'nurse', 'patient']),
  [
    body('symptoms')
      .isString()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Symptoms must be between 10 and 1000 characters'),
    body('patientHistory')
      .optional()
      .isString()
      .isLength({ max: 2000 })
      .withMessage('Patient history must be less than 2000 characters'),
    body('urgency')
      .isIn(['Low', 'Medium', 'High', 'Critical'])
      .withMessage('Urgency must be Low, Medium, High, or Critical'),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { symptoms, patientHistory, urgency } = req.body;
      const userId = req.user.uid;
      const sanitizedSymptoms = symptoms.trim().substring(0, 1000);
      const sanitizedHistory = patientHistory
        ? patientHistory.trim().substring(0, 2000)
        : '';
      const assessment = {
        preliminaryAssessment:
          'Based on the symptoms provided, further medical evaluation is recommended.',
        recommendedUrgency: urgency,
        nextSteps: [
          'Schedule consultation with healthcare provider',
          'Monitor symptoms closely',
          'Seek immediate care if symptoms worsen',
        ],
        immediateAttention: urgency === 'Critical' || urgency === 'High',
        disclaimer:
          'This is not a medical diagnosis. Please consult with a qualified healthcare professional.',
      };
      res.json({
        assessment,
        consultationId: `consult_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId,
      });
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, {
        context: 'generate-ai-consultation',
      });
      res
        .status(500)
        .json({ error: 'Failed to generate consultation', ...sanitized });
    }
  }
);

app.get(
  '/api/patient/:id',
  authenticateUser,
  requireRole(['admin', 'doctor', 'nurse', 'patient']),
  [
    param('id')
      .isString()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Invalid patient ID format'),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.uid;
      const userRole = req.user.role || req.user.custom_claims?.role;
      const sanitizedId = sanitizeString(id, 50);
      if (userRole === 'patient' && sanitizedId !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only access your own patient data',
        });
      }
      const patient = {
        id: sanitizedId,
        name: 'Maria Santos',
        age: 34,
        condition: 'Uterine Fibroids',
        nextAppointment: '2024-01-15',
        lastVisit: '2023-12-10',
        medications: ['Ibuprofen 400mg', 'Iron supplements'],
        documents: [
          { name: 'Lab Results', type: 'PDF', date: '2024-01-10' },
          { name: 'Ultrasound Report', type: 'PDF', date: '2023-12-08' },
        ],
        contactInfo: {
          email: 'maria.santos@email.com',
          phone: '+63 917 123 4567',
        },
        emergencyContact: {
          name: 'Juan Santos',
          relationship: 'Spouse',
          phone: '+63 917 987 6543',
        },
        lastUpdated: new Date().toISOString(),
      };
      res.json(patient);
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, {
        context: 'fetch-patient-data',
      });
      res
        .status(500)
        .json({ error: 'Failed to fetch patient data', ...sanitized });
    }
  }
);

app.get(
  '/api/analytics/wait-times',
  authenticateUser,
  requireRole(['admin', 'doctor', 'analyst']),
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be in ISO8601 format'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be in ISO8601 format'),
    query('department')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Department must be under 100 characters'),
  ],
  validateInput,
  async (req, res) => {
    try {
      const waitTimeData = [
        { month: 'Sep', averageWait: 165, target: 120, improvement: -27 },
        { month: 'Oct', averageWait: 158, target: 120, improvement: -4 },
        { month: 'Nov', averageWait: 142, target: 120, improvement: -10 },
        { month: 'Dec', averageWait: 128, target: 120, improvement: -10 },
        { month: 'Jan', averageWait: 89, target: 120, improvement: -30 },
      ];
      res.json({
        data: waitTimeData,
        totalImprovement: 46,
        trend: 'decreasing',
        filters: {
          startDate: req.query.startDate || null,
          endDate: req.query.endDate || null,
          department: req.query.department || 'All',
        },
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, {
        context: 'fetch-wait-time-analytics',
      });
      res
        .status(500)
        .json({ error: 'Failed to fetch wait time analytics', ...sanitized });
    }
  }
);

app.post(
  '/api/patient',
  authenticateUser,
  requireRole(['admin', 'doctor', 'nurse']),
  [
    body('name')
      .isString()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('age')
      .isInt({ min: 0, max: 150 })
      .withMessage('Age must be a valid number between 0 and 150'),
    body('condition')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Condition must be less than 500 characters'),
    body('medications')
      .optional()
      .isArray()
      .withMessage('Medications must be an array'),
    body('contactInfo.email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('contactInfo.phone')
      .optional()
      .isString()
      .isLength({ min: 10, max: 20 })
      .withMessage('Phone number must be between 10 and 20 characters'),
  ],
  validateInput,
  async (req, res) => {
    try {
      const patientData = req.body;
      const userId = req.user.uid;
      const sanitizedData = {
        ...patientData,
        name: patientData.name.trim(),
        age: parseInt(patientData.age),
        condition: patientData.condition ? patientData.condition.trim() : '',
        medications: patientData.medications || [],
        contactInfo: {
          email: patientData.contactInfo?.email?.trim() || '',
          phone: patientData.contactInfo?.phone?.trim() || '',
        },
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const docRef = db
        .collection('patients')
        .doc(patientData.id || Date.now().toString());
      await docRef.set(sanitizedData);
      res.json({
        success: true,
        message: 'Patient data saved successfully',
        patientId: docRef.id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, {
        context: 'save-patient-data',
      });
      res
        .status(500)
        .json({ error: 'Failed to save patient data', ...sanitized });
    }
  }
);

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    message: 'The requested endpoint does not exist',
    timestamp: new Date().toISOString(),
  });
});

const port = process.env.PORT || 3001;

process.on('SIGTERM', () => {
  process.exit(0);
});

process.on('SIGINT', () => {
  process.exit(0);
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port);
}

module.exports = app;
