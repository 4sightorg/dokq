import jwt from 'jsonwebtoken';
import configValidator from './config-validator.js';
class JWTHelper {
  constructor() {
    this.secret = null;
    this.algorithm = 'HS256';
    this.expiresIn = '24h';
    this.initializeSecret();
  }
  initializeSecret() {
    try {
      const validatedConfig = configValidator.getValidatedConfig();
      this.secret = validatedConfig.jwt.secret;
      if (!this.secret || this.secret.length < 32) {
        throw new Error('JWT secret is too short or invalid');
      }
    } catch (error) {
      if (configValidator.isProduction) {
        throw new Error('JWT secret is required in production');
      } else {
        this.secret = configValidator.generateSecureFallback('jwt-secret', 64);
      }
    }
  }
  generateToken(payload, options = {}) {
    if (!this.secret) {
      throw new Error('JWT secret not initialized');
    }
    const tokenOptions = {
      algorithm: this.algorithm,
      expiresIn: options.expiresIn || this.expiresIn,
      issuer: options.issuer || 'dokq-healthcare',
      audience: options.audience || 'dokq-users',
      ...options,
    };
    const securePayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      jti: this.generateTokenId(),
    };
    return jwt.sign(securePayload, this.secret, tokenOptions);
  }
  verifyToken(token, options = {}) {
    if (!this.secret) {
      throw new Error('JWT secret not initialized');
    }
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token provided');
    }
    const verifyOptions = {
      algorithms: [this.algorithm],
      issuer: options.issuer || 'dokq-healthcare',
      audience: options.audience || 'dokq-users',
      ...options,
    };
    try {
      const decoded = jwt.verify(token, this.secret, verifyOptions);
      this.validateTokenPayload(decoded);
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not yet valid');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }
  validateTokenPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid token payload');
    }
    if (!payload.sub && !payload.userId && !payload.uid) {
      throw new Error('Token missing user identifier');
    }
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = payload.exp - now;
      if (timeUntilExpiry > 30 * 24 * 60 * 60) {
        throw new Error('Token has unreasonably long expiration');
      }
    }
    return true;
  }
  generateTokenId() {
    return `jwt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  decodeToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token provided');
    }
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      throw new Error('Token decoding failed');
    }
  }
  getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      if (decoded && decoded.payload && decoded.payload.exp) {
        return new Date(decoded.payload.exp * 1000);
      }
      return null;
    } catch (error) {
      return null;
    }
  }
  isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true;
    }
    return expiration < new Date();
  }
  refreshTokenIfNeeded(token, payload, thresholdMinutes = 30) {
    if (this.isTokenExpired(token)) {
      throw new Error('Token has expired');
    }
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      throw new Error('Invalid token');
    }
    const now = new Date();
    const timeUntilExpiry = expiration.getTime() - now.getTime();
    const thresholdMs = thresholdMinutes * 60 * 1000;
    if (timeUntilExpiry < thresholdMs) {
      return this.generateToken(payload);
    }
    return token;
  }
}
const jwtHelper = new JWTHelper();
export default jwtHelper;
