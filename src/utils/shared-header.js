document.addEventListener('DOMContentLoaded', function () {
  const header = document.querySelector('.unified-header');
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  const body = document.body;
  window.addEventListener('scroll', function () {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
  if (mobileMenuToggle && mobileNav) {
    mobileMenuToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      const isActive = mobileMenuToggle.classList.toggle('active');
      mobileNav.classList.toggle('active');
      if (isActive) {
        body.style.overflow = 'hidden';
      } else {
        body.style.overflow = '';
      }
    });
    const mobileNavLinks = document.querySelectorAll('.mobile-nav .nav-link');
    mobileNavLinks.forEach(link => {
      link.addEventListener('click', function () {
        mobileMenuToggle.classList.remove('active');
        mobileNav.classList.remove('active');
        body.style.overflow = '';
      });
    });
    document.addEventListener('click', function (event) {
      if (!header.contains(event.target)) {
        mobileMenuToggle.classList.remove('active');
        mobileNav.classList.remove('active');
        body.style.overflow = '';
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && mobileNav.classList.contains('active')) {
        mobileMenuToggle.classList.remove('active');
        mobileNav.classList.remove('active');
        body.style.overflow = '';
      }
    });
  }
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
  const anchorLinks = document.querySelectorAll('a[href^="#"]');
  anchorLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
        if (mobileNav.classList.contains('active')) {
          mobileMenuToggle.classList.remove('active');
          mobileNav.classList.remove('active');
          body.style.overflow = '';
        }
      }
    });
  });
  const logoutBtns = document.querySelectorAll('.logout-btn');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      if (confirm('Sigurado ka bang gusto mong mag-logout?')) {
        try {
          const authServiceModule = await import('../services/auth-service.js');
          const authService = authServiceModule.default;
          btn.disabled = true;
          btn.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Logging out...';
          await authService.logout();
          authService.forceClearAuthState();
          window.location.href = '/index.html';
        } catch (error) {
          console.error('Logout error:', error);
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
          alert('Logout failed. Please try again.');
        }
      }
    });
  });
});
function updateHeaderUserInfo(userData) {
  const userAvatar = document.querySelector('.user-avatar');
  const userName = document.querySelector('.user-name');
  const userRole = document.querySelector('.user-role');
  if (userAvatar && userData.name) {
    userAvatar.textContent = userData.name.charAt(0).toUpperCase();
  }
  if (userName && userData.name) {
    userName.textContent = userData.name;
  }
  if (userRole && userData.role) {
    userRole.textContent = userData.role;
  }
}
