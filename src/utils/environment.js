class Environment {
  constructor() {
    this._isProduction = null;
    this._environment = null;
  }
  isProduction() {
    if (this._isProduction !== null) {
      return this._isProduction;
    }
    const checks = [
      () => {
        if (typeof import.meta !== 'undefined' && import.meta.env) {
          return (
            import.meta.env.PROD === true ||
            import.meta.env.MODE === 'production' ||
            import.meta.env.NODE_ENV === 'production'
          );
        }
        return false;
      },
      () => {
        if (typeof process !== 'undefined' && process.env) {
          return process.env.NODE_ENV === 'production';
        }
        return false;
      },
      () => {
        if (typeof window !== 'undefined' && window.location) {
          const hostname = window.location.hostname;
          const productionDomains = [
            'netlify.app',
            'herokuapp.com',
            'firebaseapp.com',
            'github.io',
            'dokq.app',
            'dokq.com',
          ];
          return productionDomains.some(
            domain => hostname.includes(domain) || hostname.endsWith(domain)
          );
        }
        return false;
      },
      () => {
        if (typeof window !== 'undefined' && window.location) {
          const isHTTPS = window.location.protocol === 'https:';
          const isNotLocalhost =
            !window.location.hostname.includes('localhost') &&
            !window.location.hostname.includes('127.0.0.1') &&
            !window.location.hostname.includes('0.0.0.0');
          return isHTTPS && isNotLocalhost;
        }
        return false;
      },
    ];
    this._isProduction = checks.some(check => {
      try {
        return check();
      } catch (error) {
        return false;
      }
    });
    return this._isProduction;
  }
  getEnvironment() {
    if (this._environment !== null) {
      return this._environment;
    }
    if (this.isProduction()) {
      this._environment = 'production';
    } else if (this.isTest()) {
      this._environment = 'test';
    } else {
      this._environment = 'development';
    }
    return this._environment;
  }
  isDevelopment() {
    return !this.isProduction() && !this.isTest();
  }
  isTest() {
    const testChecks = [
      () => {
        if (typeof process !== 'undefined' && process.env) {
          return (
            process.env.NODE_ENV === 'test' ||
            process.env.NODE_ENV === 'testing'
          );
        }
        return false;
      },
      () => {
        if (typeof import.meta !== 'undefined' && import.meta.env) {
          return (
            import.meta.env.MODE === 'test' ||
            import.meta.env.MODE === 'testing'
          );
        }
        return false;
      },
      () => {
        if (typeof window !== 'undefined') {
          return Boolean(window.__karma__ || window.jasmine || window.mocha);
        }
        return false;
      },
    ];
    return testChecks.some(check => {
      try {
        return check();
      } catch (error) {
        return false;
      }
    });
  }
  getInfo() {
    return {
      environment: this.getEnvironment(),
      isProduction: this.isProduction(),
      isDevelopment: this.isDevelopment(),
      isTest: this.isTest(),
      hostname:
        typeof window !== 'undefined' ? window.location?.hostname : 'unknown',
      protocol:
        typeof window !== 'undefined' ? window.location?.protocol : 'unknown',
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };
  }
}
const environment = new Environment();
export default environment;
