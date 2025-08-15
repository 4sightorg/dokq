import authService, { USER_ROLES } from '../services/auth-service.js';

class GlobalRedirectManager {
    constructor() {
        this.isRedirecting = false;
        this.redirectCount = 0;
        this.maxRedirects = 3;
        this.redirectCooldown = 3000;
        this.lastRedirectTime = 0;
        this.redirectTimeouts = new Set();
        
        window.isRedirecting = false;
        window.redirectCount = 0;
        window.lastRedirectTime = 0;
    }
    
    canRedirect() {
        const now = Date.now();
        const timeSinceLastRedirect = now - this.lastRedirectTime;
        
        if (timeSinceLastRedirect < this.redirectCooldown) {
            return false;
        }
        
        if (this.redirectCount >= this.maxRedirects) {
            return false;
        }
        
        if (this.isRedirecting || window.isRedirecting) {
            return false;
        }
        
        return true;
    }
    
    startRedirect() {
        this.isRedirecting = true;
        this.redirectCount++;
        this.lastRedirectTime = Date.now();
        
        window.isRedirecting = true;
        window.redirectCount = this.redirectCount;
        window.lastRedirectTime = this.lastRedirectTime;
        
        const timeout = setTimeout(() => {
            this.isRedirecting = false;
            window.isRedirecting = false;
        }, 5000);
        
        this.redirectTimeouts.add(timeout);
        
        setTimeout(() => {
            this.redirectCount = Math.max(0, this.redirectCount - 1);
            window.redirectCount = this.redirectCount;
        }, this.redirectCooldown * 2);
    }
    
    reset() {
        this.isRedirecting = false;
        this.redirectCount = 0;
        this.lastRedirectTime = 0;
        
        this.redirectTimeouts.forEach(timeout => clearTimeout(timeout));
        this.redirectTimeouts.clear();
        
        window.isRedirecting = false;
        window.redirectCount = 0;
        window.lastRedirectTime = 0;
    }
}

const globalRedirectManager = new GlobalRedirectManager();

window.redirectManager = globalRedirectManager;

class AuthGuard {
    constructor() {
        this.protectedRoutes = new Map();
        this.currentRoute = window.location.pathname;
        this.initialized = false;
        this.authCheckInProgress = false;
        

    }


    canRedirect() {
        return globalRedirectManager.canRedirect();
    }


    recordRedirect() {
        globalRedirectManager.startRedirect();
    }


    async initialize() {
        if (this.initialized) return;
        
        try {
            this.setupRouteProtection();
            
            authService.onAuthStateChange(this.debounce((user, role) => {
                this.handleAuthStateChange(user, role);
            }, 500));
            
            setTimeout(() => {
                this.checkCurrentRoute();
            }, 1000);
            
            this.initialized = true;

            
        } catch (error) {
        }
    }


    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }


    setupRouteProtection() {
        const routes = [
            {
                path: '/public/patientPortal.html',
                roles: [USER_ROLES.PATIENT],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/public/patientDashboard.html',
                roles: [USER_ROLES.PATIENT],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            {
                path: '/admin',
                roles: [USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/admin/dashboard.html',
                roles: [USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/admin/users.html',
                roles: [USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            {
                path: '/doctor',
                roles: [USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/doctor/dashboard.html',
                roles: [USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/doctor/patients.html',
                roles: [USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            {
                path: '/nurse',
                roles: [USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/nurse/dashboard.html',
                roles: [USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            {
                path: '/staff',
                roles: [USER_ROLES.CLINIC_STAFF, USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            {
                path: '/business/organization-dashboard.html',
                roles: [USER_ROLES.ORGANIZATION_ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/business/member-dashboard.html',
                roles: [USER_ROLES.ORGANIZATION_MEMBER, USER_ROLES.ORGANIZATION_ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/business/staff-management.html',
                roles: [USER_ROLES.ORGANIZATION_ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/business/patient-management.html',
                roles: [USER_ROLES.ORGANIZATION_ADMIN, USER_ROLES.ORGANIZATION_MEMBER],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            {
                path: '/admin/system-dashboard.html',
                roles: [USER_ROLES.SYSTEM_ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            {
                path: '/api',
                roles: [USER_ROLES.PATIENT, USER_ROLES.CLINIC_STAFF, USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN, USER_ROLES.ORGANIZATION_ADMIN, USER_ROLES.ORGANIZATION_MEMBER, USER_ROLES.SYSTEM_ADMIN],
                requireAuth: true,
                requireEmailVerification: false
            }
        ];
        
        routes.forEach(route => {
            this.protectedRoutes.set(route.path, route);
        });
    }


    handleAuthStateChange(user, role) {
        if (this.authCheckInProgress) {
            return;
        }
        
        if (window.isProcessingGoogleAuth) {
            return;
        }
        
        if (window.isRedirecting) {
            return;
        }
        

        
        this.debounce(() => {
            this.checkCurrentRoute();
        }, 1000)();
    }


    async checkCurrentRoute() {
        if (this.authCheckInProgress) {
            return true;
        }
        
        if (window.isProcessingGoogleAuth) {
            return true;
        }
        
        if (window.isRedirecting) {
            return true;
        }
        
        this.authCheckInProgress = true;
        
        try {
            const currentPath = window.location.pathname;
            const protection = this.getRouteProtection(currentPath);
            
            if (!protection) {
                return true;
            }
            

            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const isAuthenticated = authService.isAuthenticated();
            const user = authService.getCurrentUser();
            

            
            if (protection.requireAuth) {
                if (!isAuthenticated || !user || !user.uid) {
                    this.redirectToLogin('This page requires authentication');
                    return false;
                }
                
                try {
                    const reloadPromise = user.reload();
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Reload timeout')), 5000)
                    );
                    
                    await Promise.race([reloadPromise, timeoutPromise]);
                } catch (error) {
                    if (error.code && error.code.includes('auth/')) {
                        await authService.logout();
                        this.redirectToLogin('Session expired, please sign in again');
                        return false;
                    }
                }
            }
            
            if (protection.requireEmailVerification && authService.isAuthenticated()) {
                const user = authService.getCurrentUser();
                const isGoogleUser = user.providerData.some(provider => provider.providerId === 'google.com');
                
                if (!user.emailVerified && !isGoogleUser) {
                    this.redirectToEmailVerification();
                    return false;
                }
            }
            
            if (protection.roles && protection.roles.length > 0) {
                const userRole = authService.getUserRole();
                
                if (!userRole) {
                    if (authService.isAuthenticated() && protection.roles.includes(USER_ROLES.PATIENT)) {
                        return true;
                    }
                }
                
                if (!protection.roles.includes(userRole)) {
                    this.redirectToUnauthorized();
                    return false;
                }
            }
            
            return true;
            
        } catch (error) {
            if (authService.isAuthenticated() && currentPath.includes('patientPortal')) {
                return true;
            }
            
            this.redirectToLogin('An error occurred. Please login again.');
            return false;
        } finally {
            this.authCheckInProgress = false;
        }
    }


    getRouteProtection(path) {
        if (this.protectedRoutes.has(path)) {
            return this.protectedRoutes.get(path);
        }
        
        for (const [routePath, protection] of this.protectedRoutes) {
            if (path.startsWith(routePath)) {
                return protection;
            }
        }
        
        return null;
    }


    redirectToLogin(message = '') {
        if (!this.canRedirect()) {
            return;
        }
        
        if (window.isProcessingGoogleAuth) {
            return;
        }
        
        this.recordRedirect();
        
        if (message) {
            sessionStorage.setItem('auth_redirect_message', message);
        }
        
        sessionStorage.setItem('auth_return_url', window.location.href);
        
        const currentPath = window.location.pathname;
        
        setTimeout(() => {
            if (currentPath.includes('/admin')) {
                window.location.href = '/admin/login.html';
            } else if (currentPath.includes('/doctor')) {
                window.location.href = '/doctor/login.html';
            } else if (currentPath.includes('/nurse')) {
                window.location.href = '/nurse/login.html';
            } else if (currentPath.includes('/staff')) {
                window.location.href = '/staff/login.html';
            } else {
                window.location.href = '/public/patientSign-in.html';
            }
        }, 500);
    }


    redirectToEmailVerification() {
        if (!this.canRedirect()) {
            return;
        }
        
        this.recordRedirect();
        
        sessionStorage.setItem('auth_return_url', window.location.href);
        
        setTimeout(() => {
            window.location.href = '/email-verification.html';
        }, 500);
    }


    redirectToUnauthorized() {
        this.showUnauthorizedMessage();
    }


    showUnauthorizedMessage() {
        const userRole = authService.getUserRole();
        const message = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; text-align: center;">
                    <h3 style="color: #dc3545;">Access Denied</h3>
                    <p>You don't have permission to access this page.</p>
                    <p>Your role: <strong>${userRole || 'None'}</strong></p>
                    <div style="margin-top: 20px;">
                        <button onclick="window.history.back()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                            Go Back
                        </button>
                        <button onclick="window.location.href='/public/patientPortal.html'" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                            Go to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', message);
    }


    protectElement(element, requiredRoles, hideIfUnauthorized = true) {
        if (!element) return;
        
        const userRole = authService.getUserRole();
        const hasAccess = Array.isArray(requiredRoles) 
            ? requiredRoles.includes(userRole)
            : userRole === requiredRoles;
        
        if (!hasAccess) {
            if (hideIfUnauthorized) {
                element.style.display = 'none';
            } else {
                element.style.opacity = '0.5';
                element.style.pointerEvents = 'none';
                element.title = 'You do not have permission to access this feature';
            }
        }
    }


    protectElements(selector, requiredRoles, hideIfUnauthorized = true) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            this.protectElement(element, requiredRoles, hideIfUnauthorized);
        });
    }


    hasPermission(permission) {
        return authService.hasPermission(permission);
    }


    hasRole(role) {
        return authService.hasRole(role);
    }


    async secureFetch(url, options = {}) {
        const user = authService.getCurrentUser();
        
        if (!user) {
            throw new Error('Authentication required');
        }
        
        try {
            // Get ID token
            const idToken = await user.getIdToken();
            
            // Add authorization header
            const headers = {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            };
            
            // Make request
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            if (response.status === 401) {
                this.redirectToLogin('Session expired. Please login again.');
                return;
            }
            
            if (response.status === 403) {
                throw new Error('You do not have permission to perform this action');
            }
            
            return response;
            
        } catch (error) {
            throw error;
        }
    }


    initializePageProtections() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.applyPageProtections();
            });
        } else {
            this.applyPageProtections();
        }
    }


    applyPageProtections() {
        this.protectElements('[data-admin-only]', [USER_ROLES.ADMIN]);
        
        this.protectElements('[data-system-admin-only]', [USER_ROLES.SYSTEM_ADMIN]);
        
        this.protectElements('[data-org-admin-only]', [USER_ROLES.ORGANIZATION_ADMIN]);
        
        this.protectElements('[data-org-member-only]', [USER_ROLES.ORGANIZATION_MEMBER, USER_ROLES.ORGANIZATION_ADMIN]);
        
        this.protectElements('[data-doctor-only]', [USER_ROLES.DOCTOR, USER_ROLES.ADMIN]);
        
        this.protectElements('[data-nurse-only]', [USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN]);
        
        this.protectElements('[data-staff-only]', [USER_ROLES.CLINIC_STAFF, USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN]);
        
        this.protectElements('[data-patient-only]', [USER_ROLES.PATIENT]);
        
        this.showRoleSpecificContent();
    }


    showRoleSpecificContent() {
        const userRole = authService.getUserRole();
        
        document.querySelectorAll('[data-role]').forEach(element => {
            element.style.display = 'none';
        });
        
        if (userRole) {
            document.querySelectorAll(`[data-role="${userRole}"]`).forEach(element => {
                element.style.display = '';
            });
            
            document.querySelectorAll('[data-role="authenticated"]').forEach(element => {
                element.style.display = '';
            });
        } else {
            document.querySelectorAll('[data-role="unauthenticated"]').forEach(element => {
                element.style.display = '';
            });
        }
    }


    createRouteMiddleware(requiredRoles = [], options = {}) {
        return async () => {
            const {
                requireAuth = true,
                requireEmailVerification = true,
                redirectOnFail = true
            } = options;
            
            if (requireAuth && !authService.isAuthenticated()) {
                if (redirectOnFail) {
                    this.redirectToLogin('Authentication required');
                }
                return false;
            }
            
            if (requireEmailVerification && authService.isAuthenticated()) {
                const user = authService.getCurrentUser();
                if (!user.emailVerified) {
                    if (redirectOnFail) {
                        this.redirectToEmailVerification();
                    }
                    return false;
                }
            }
            
            if (requiredRoles.length > 0) {
                const userRole = authService.getUserRole();
                if (!userRole || !requiredRoles.includes(userRole)) {
                    if (redirectOnFail) {
                        this.redirectToUnauthorized();
                    }
                    return false;
                }
            }
            
            return true;
        };
    }
}

const authGuard = new AuthGuard();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        authGuard.initialize();
        authGuard.initializePageProtections();
    });
} else {
    authGuard.initialize();
    authGuard.initializePageProtections();
}

export default authGuard;
export { AuthGuard, USER_ROLES }; 