let secureErrorHandler = null;

class CSRFService {
  constructor() {
    this.csrfToken = null;
    this.tokenExpiry = null;
    this.headerName = 'x-csrf-token';
    this.cookieName = '__csrf_token';
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.refreshThreshold = 5 * 60 * 1000;

    this.STORAGE_KEYS = {
      TOKEN: 'csrf_token',
      EXPIRY: 'csrf_token_expiry',
      HEADER_NAME: 'csrf_header_name',
      COOKIE_NAME: 'csrf_cookie_name',
    };

    this.loadStoredToken();
    this.setupTokenRefresh();
  }

  loadStoredToken() {
    try {
      const token = sessionStorage.getItem(this.STORAGE_KEYS.TOKEN);
      const expiry = sessionStorage.getItem(this.STORAGE_KEYS.EXPIRY);
      const headerName = sessionStorage.getItem(this.STORAGE_KEYS.HEADER_NAME);
      const cookieName = sessionStorage.getItem(this.STORAGE_KEYS.COOKIE_NAME);

      if (token && expiry) {
        const expiryTime = parseInt(expiry);

        if (Date.now() < expiryTime) {
          this.csrfToken = token;
          this.tokenExpiry = expiryTime;
          this.headerName = headerName || this.headerName;
          this.cookieName = cookieName || this.cookieName;
        } else {
          this.clearStoredToken();
        }
      }
    } catch (error) {
      this.clearStoredToken();
    }
  }

  storeToken(token, expiry, headerName, cookieName) {
    try {
      sessionStorage.setItem(this.STORAGE_KEYS.TOKEN, token);
      sessionStorage.setItem(this.STORAGE_KEYS.EXPIRY, expiry.toString());
      sessionStorage.setItem(this.STORAGE_KEYS.HEADER_NAME, headerName);
      sessionStorage.setItem(this.STORAGE_KEYS.COOKIE_NAME, cookieName);
    } catch (error) {}
  }

  clearStoredToken() {
    try {
      Object.values(this.STORAGE_KEYS).forEach(key => {
        sessionStorage.removeItem(key);
      });
      this.csrfToken = null;
      this.tokenExpiry = null;
    } catch (error) {}
  }

  setupTokenRefresh() {
    setInterval(() => {
      if (this.shouldRefreshToken()) {
        this.refreshToken();
      }
    }, 60 * 1000);
  }

  shouldRefreshToken() {
    if (!this.csrfToken || !this.tokenExpiry) {
      return false;
    }

    const timeUntilExpiry = this.tokenExpiry - Date.now();
    return timeUntilExpiry <= this.refreshThreshold;
  }

  async fetchToken() {
    try {
      const response = await fetch('/api/auth/csrf-token', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getAuthHeader(),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required for CSRF token');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !data.csrfToken) {
        throw new Error(data.message || 'Failed to fetch CSRF token');
      }

      this.csrfToken = data.csrfToken;
      this.tokenExpiry = data.expiry;
      this.headerName = data.headerName || this.headerName;
      this.cookieName = data.cookieName || this.cookieName;

      this.storeToken(
        this.csrfToken,
        this.tokenExpiry,
        this.headerName,
        this.cookieName
      );

      return data;
    } catch (error) {
      let errorMessage = 'Failed to fetch CSRF token';

      if (secureErrorHandler && secureErrorHandler.handleNetworkError) {
        const secureError = secureErrorHandler.handleNetworkError(error, {
          context: 'csrf-token-fetch',
          endpoint: '/api/auth/csrf-token',
        });
        errorMessage = secureError.message;
      } else {
        if (error.status === 401) {
          errorMessage = 'Authentication required for CSRF token';
        } else if (error.message) {
          errorMessage = `Network error: ${error.message}`;
        }
      }

      throw new Error(errorMessage);
    }
  }

  async refreshToken() {
    if (this.isRefreshing) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;

    try {
      this.refreshPromise = this.performTokenRefresh();
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  async performTokenRefresh() {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: this.getAuthHeader(),
      };

      if (this.csrfToken) {
        headers[this.headerName] = this.csrfToken;
      }

      const response = await fetch('/api/auth/csrf-token/refresh', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          _csrf: this.csrfToken,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required for CSRF token refresh');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to refresh CSRF token');
      }

      if (data.rotated && data.csrfToken) {
        this.csrfToken = data.csrfToken;
        this.tokenExpiry = data.expiry;
        this.headerName = data.headerName || this.headerName;
        this.cookieName = data.cookieName || this.cookieName;

        this.storeToken(
          this.csrfToken,
          this.tokenExpiry,
          this.headerName,
          this.cookieName
        );
      }

      return data;
    } catch (error) {
      let errorMessage = 'Failed to refresh CSRF token';

      if (secureErrorHandler && secureErrorHandler.handleNetworkError) {
        const secureError = secureErrorHandler.handleNetworkError(error, {
          context: 'csrf-token-refresh',
          endpoint: '/api/auth/csrf-token/refresh',
        });
        errorMessage = secureError.message;
      } else {
        if (error.status === 401) {
          errorMessage = 'Authentication required for CSRF token refresh';
        } else if (error.message) {
          errorMessage = `Network error: ${error.message}`;
        }
      }

      return this.fetchToken();
    }
  }

  async getToken() {
    if (
      this.csrfToken &&
      this.tokenExpiry &&
      this.tokenExpiry - Date.now() > this.refreshThreshold
    ) {
      return this.csrfToken;
    }

    if (!this.isRefreshing) {
      await this.fetchToken();
    } else {
      await this.refreshPromise;
    }

    return this.csrfToken;
  }

  async addTokenToHeaders(headers = {}) {
    try {
      const token = await this.getToken();
      if (token) {
        headers[this.headerName] = token;
      }
      return headers;
    } catch (error) {
      return headers;
    }
  }

  async addTokenToBody(body = {}) {
    try {
      const token = await this.getToken();
      if (token) {
        body._csrf = token;
      }
      return body;
    } catch (error) {
      return body;
    }
  }

  async secureFetch(url, options = {}) {
    const method = options.method || 'GET';

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      try {
        options.headers = await this.addTokenToHeaders(options.headers || {});

        if (options.body && typeof options.body === 'string') {
          try {
            const bodyObj = JSON.parse(options.body);
            const secureBody = await this.addTokenToBody(bodyObj);
            options.body = JSON.stringify(secureBody);
          } catch (parseError) {}
        } else if (options.body && typeof options.body === 'object') {
          options.body = await this.addTokenToBody(options.body);
        }

        options.credentials = options.credentials || 'include';
      } catch (error) {}
    }

    return fetch(url, options);
  }

  getAuthHeader() {
    const authService = window.authService;
    if (authService && authService.getCurrentUser) {
      try {
        const user = authService.getCurrentUser();
        return user ? `Bearer ${user.accessToken}` : '';
      } catch (error) {}
    }

    const token =
      localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    return token ? `Bearer ${token}` : '';
  }

  logout() {
    this.clearStoredToken();
  }

  getStatus() {
    return {
      hasToken: !!this.csrfToken,
      tokenExpiry: this.tokenExpiry,
      isExpiring: this.shouldRefreshToken(),
      timeUntilExpiry: this.tokenExpiry
        ? Math.max(0, this.tokenExpiry - Date.now())
        : 0,
      headerName: this.headerName,
      cookieName: this.cookieName,
      isRefreshing: this.isRefreshing,
    };
  }
}

const csrfService = new CSRFService();

export default csrfService;

if (typeof window !== 'undefined') {
  window.csrfService = csrfService;
}
