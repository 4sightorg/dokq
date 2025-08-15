/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import YearUpdater from './YearUpdater';
import '../styles/index.css';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    initializeAccessibility();

    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
  }, []);

  const initializeAccessibility = () => {
    announceToScreenReader(
      'DokQ healthcare platform loaded. Use Tab to navigate.'
    );
  };

  const handleSearch = () => {
    if (!searchTerm && !location) {
      showNotification('Please enter a search term or location', 'warning');
      return;
    }

    setIsSearching(true);

    setTimeout(() => {
      showNotification(
        `Searching for "${searchTerm}" ${location ? `in ${location}` : 'nationwide'}...`,
        'info'
      );

      setIsSearching(false);

      setTimeout(() => {
        navigate('/patient-portal');
      }, 1500);
    }, 1000);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      showNotification('Geolocation is not supported by this browser', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setTimeout(() => {
          const mockLocation = 'Makati City, Metro Manila';
          setLocation(mockLocation);
          showNotification('Location detected successfully!', 'success');
        }, 1000);
      },
      error => {
        let message = 'Unable to detect location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timeout';
            break;
        }

        showNotification(message, 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 600000,
      }
    );
  };

  const handleAppointmentBooking = (facilityName: string) => {
    showNotification(
      `Redirecting to book appointment with ${facilityName}...`,
      'info'
    );

    setTimeout(() => {
      navigate('/patient-sign-up');
    }, 1500);
  };

  const handleViewAllFacilities = () => {
    showNotification('Loading all healthcare facilities...', 'info');
    setTimeout(() => {
      navigate('/patient-portal');
    }, 1000);
  };

  const handleSocialLink = (platform: string) => {
    showNotification(`Opening ${platform}...`, 'info');
  };

  const handlePartnerSignup = () => {
    showNotification('Redirecting to partner registration...', 'info');
    setTimeout(() => {
      navigate('/partner-sign-up');
    }, 1500);
  };

  const handlePartnerSignin = () => {
    showNotification('Redirecting to partner login...', 'info');
    setTimeout(() => {
      navigate('/partner-sign-in');
    }, 1500);
  };

  const handleBusinessPortal = () => {
    showNotification('Redirecting to business portal...', 'info');
    setTimeout(() => {
      navigate('/dashboard');
    }, 1500);
  };

  const showNotification = (message: string, type: string = 'info') => {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${getNotificationColor(type)};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      max-width: 350px;
    `;

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn?.addEventListener('click', () => notification.remove());

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);

    announceToScreenReader(message);
  };

  const getNotificationIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle',
    };
    return icons[type] || icons.info;
  };

  const getNotificationColor = (type: string) => {
    const colors: { [key: string]: string } = {
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    };
    return colors[type] || colors.info;
  };

  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.cssText = `
      position: absolute !important;
      left: -10000px !important;
      width: 1px !important;
      height: 1px !important;
      overflow: hidden !important;
    `;
    announcement.textContent = message;

    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  };

  return (
    <>
      <YearUpdater />
      <div
        id='live-region'
        aria-live='polite'
        aria-atomic='true'
        className='sr-only'
      ></div>

      <header className='header' role='banner'>
        <div className='header-container'>
          <div className='logo'>
            <span>DokQ</span>
          </div>

          <nav
            className='header-actions landing-header-actions'
            style={{ display: 'flex' }}
            role='navigation'
            aria-label='Main navigation'
          >
            <button
              onClick={() => navigate('/patient-sign-in')}
              className='login-btn'
              aria-label='Sign in to your patient account'
            >
              Login
            </button>
            <button
              onClick={() => navigate('/patient-sign-up')}
              className='register-btn'
              aria-label='Create a new patient account'
            >
              Register
            </button>
          </nav>
        </div>
      </header>

      <main id='main-content' className='main-hero' role='main'>
        <div className='hero-container'>
          <div className='hero-content'>
            <div className='hero-left'></div>
          </div>
        </div>

        <section
          className='search-section'
          aria-label='Healthcare facility search'
        >
          <div className='search-container'>
            <form
              className='search-bar'
              role='search'
              aria-label='Search for healthcare facilities'
              onSubmit={e => {
                e.preventDefault();
                handleSearch();
              }}
            >
              <div className='search-input'>
                <label htmlFor='facility-search' className='sr-only'>
                  Search for hospitals and clinics
                </label>
                <i className='fas fa-search' aria-hidden='true'></i>
                <input
                  type='text'
                  id='facility-search'
                  name='facility-search'
                  placeholder='Find hospitals and clinics'
                  aria-describedby='search-help'
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <div id='search-help' className='sr-only'>
                  Enter the name or type of healthcare facility you're looking
                  for
                </div>
              </div>
              <div className='location-input'>
                <label htmlFor='location-search' className='sr-only'>
                  Enter location
                </label>
                <i className='fas fa-map-marker-alt' aria-hidden='true'></i>
                <input
                  type='text'
                  id='location-search'
                  name='location-search'
                  placeholder='Location'
                  aria-describedby='location-help'
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                />
                <div id='location-help' className='sr-only'>
                  Enter city, province, or area to search nearby facilities
                </div>
                <button
                  type='button'
                  className='location-detect-btn'
                  aria-label='Detect current location'
                  title='Use my current location'
                  onClick={detectLocation}
                >
                  <i className='fas fa-crosshairs' aria-hidden='true'></i>
                </button>
              </div>
              <button
                type='submit'
                className='search-button'
                aria-label='Search healthcare facilities'
                disabled={isSearching}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        </section>
      </main>

      <section className='nearby-facilities' aria-labelledby='nearby-heading'>
        <div className='container'>
          <h2 id='nearby-heading'>Nearby Healthcare Facilities</h2>
          <div className='location-prompt'>
            <div className='location-icon'>
              <i className='fas fa-map-marker-alt' aria-hidden='true'></i>
            </div>
            <div className='location-message'>
              <p>
                Please enable your location, so we can find nearby healthcare
                facilities
              </p>
              <a
                href='#'
                className='enable-location'
                aria-label='Enable location services to find nearby facilities'
                onClick={e => {
                  e.preventDefault();
                  detectLocation();
                }}
              >
                Enable Now
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className='provider-cta' aria-labelledby='provider-heading'>
        <div className='container'>
          <div className='cta-content'>
            <div className='cta-text'>
              <h2 id='provider-heading'>Are you a Healthcare Provider?</h2>
              <p>
                Join DokQ and connect with thousands of patients across the
                Philippines. Streamline your practice with our comprehensive
                healthcare platform.
              </p>
              <div
                className='cta-features'
                role='list'
                aria-label='Platform features for healthcare providers'
              >
                <div className='cta-feature' role='listitem'>
                  <i className='fas fa-check-circle' aria-hidden='true'></i>
                  <span>Patient Management System</span>
                </div>

                <div className='cta-feature' role='listitem'>
                  <i className='fas fa-check-circle' aria-hidden='true'></i>
                  <span>Appointment Scheduling</span>
                </div>
                <div className='cta-feature' role='listitem'>
                  <i className='fas fa-check-circle' aria-hidden='true'></i>
                  <span>Analytics & Reports</span>
                </div>
              </div>
            </div>
            <div className='cta-action'>
              <button
                onClick={handlePartnerSignup}
                className='partner-btn'
                aria-label='Register your healthcare practice with DokQ'
              >
                <i className='fas fa-handshake' aria-hidden='true'></i>
                Partner with DokQ
              </button>
              <p className='cta-note'>
                Join 150+ healthcare providers already on our platform
              </p>
            </div>
          </div>
        </div>
      </section>

      <div
        id='toast-container'
        className='toast-container'
        aria-live='polite'
        aria-atomic='false'
      ></div>
    </>
  );
};

export default LandingPage;
