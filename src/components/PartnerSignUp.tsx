/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';
import '../styles/partnerSignUp.css';
import '../styles/csp-utilities.css';

interface FormData {
  // Step 1: Basic Information
  facilityName: string;
  facilityType: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;

  licenseNumber: string;
}

interface ValidationErrors {
  facilityName?: string;
  facilityType?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  specialties?: string;
  licenseNumber?: string;
  general?: string;
}

const PartnerSignUp: React.FC = React.memo(() => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>({
    facilityName: '',
    facilityType: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    licenseNumber: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );

  const formRef = useRef<HTMLFormElement>(null);

  // Validation patterns
  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  // Available options
  const facilityTypes = useMemo(
    () => [
      'Hospital',
      'Medical Clinic',
      'Dental Clinic',
      'Specialty Clinic',
      'Diagnostic Center',
      'Rehabilitation Center',
      'Mental Health Facility',
      'Maternity Clinic',
      'Pediatric Clinic',
      'Surgical Center',
      'Urgent Care Center',
      'Other',
    ],
    []
  );

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    const errors: ValidationErrors = {};
    if (!formData.facilityName.trim()) {
      errors.facilityName = 'Facility name is required';
    }
    if (!formData.facilityType) {
      errors.facilityType = 'Please select a facility type';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, emailRegex]);

  const handleSubmit = useCallback(async () => {
    if (!validateCurrentStep()) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Update user's display name to facility name
      await updateProfile(userCredential.user, {
        displayName: formData.facilityName,
      });

      // Create facility document in Firestore
      try {
        const { createFacilityDocument } = await import(
          '../services/firestoredb.js'
        );
        await createFacilityDocument(userCredential.user, {
          facilityName: formData.facilityName,
          facilityType: formData.facilityType,
          email: formData.email,
          phone: formData.phone,
          authProvider: 'email',
        });
        console.log('Facility document created successfully');
      } catch (error) {
        console.error('Error creating facility document:', error);
        // Continue with registration even if document creation fails
      }

      // Send email verification
      await sendEmailVerification(userCredential.user);

      console.log('Registration completed successfully!');
      console.log('User:', userCredential.user);
      console.log('Facility name set to:', formData.facilityName);
      console.log('Redirecting to dashboard...');

      showNotification(
        'Facility registration successful! Welcome to DokQ.',
        'success'
      );

      // Redirect to dashboard immediately
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Registration error:', error);
      setErrorMessage(
        error.message || 'Registration failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [formData, validateCurrentStep, navigate]);

  const showNotification = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setErrorMessage(type === 'error' ? message : '');
    },
    []
  );

  return (
    <div className='partner-signup-container'>
      <div className='signup-content'>
        <div className='signup-header'>
          <h1>Partner with DokQ</h1>
          <p>Join our network of healthcare facilities</p>
        </div>

        <form
          ref={formRef}
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
          className='signup-form'
        >
          <div className='form-step'>
            <h2>Basic Information</h2>
            <p>Tell us about your healthcare facility</p>

            <div className='form-group'>
              <label htmlFor='facilityName'>Facility Name *</label>
              <input
                type='text'
                id='facilityName'
                value={formData.facilityName}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    facilityName: e.target.value,
                  }))
                }
                className={validationErrors.facilityName ? 'error' : ''}
                placeholder='Enter your facility name'
              />
              {validationErrors.facilityName && (
                <span className='error-message'>
                  {validationErrors.facilityName}
                </span>
              )}
            </div>

            <div className='form-group'>
              <label htmlFor='facilityType'>Facility Type *</label>
              <select
                id='facilityType'
                value={formData.facilityType}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    facilityType: e.target.value,
                  }))
                }
                className={validationErrors.facilityType ? 'error' : ''}
              >
                <option value=''>Select facility type</option>
                {facilityTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {validationErrors.facilityType && (
                <span className='error-message'>
                  {validationErrors.facilityType}
                </span>
              )}
            </div>

            <div className='form-group'>
              <label htmlFor='email'>Email Address *</label>
              <input
                type='email'
                id='email'
                value={formData.email}
                onChange={e =>
                  setFormData(prev => ({ ...prev, email: e.target.value }))
                }
                className={validationErrors.email ? 'error' : ''}
                placeholder='Enter your email address'
              />
              {validationErrors.email && (
                <span className='error-message'>{validationErrors.email}</span>
              )}
            </div>

            <div className='form-group'>
              <label htmlFor='phone'>Phone Number *</label>
              <input
                type='tel'
                id='phone'
                value={formData.phone}
                onChange={e =>
                  setFormData(prev => ({ ...prev, phone: e.target.value }))
                }
                className={validationErrors.phone ? 'error' : ''}
                placeholder='Enter your phone number'
              />
              {validationErrors.phone && (
                <span className='error-message'>{validationErrors.phone}</span>
              )}
            </div>

            <div className='form-group'>
              <label htmlFor='password'>Password *</label>
              <div className='password-input'>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id='password'
                  value={formData.password}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, password: e.target.value }))
                  }
                  className={validationErrors.password ? 'error' : ''}
                  placeholder='Create a password'
                />
                <button
                  type='button'
                  className='password-toggle'
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i
                    className={`fas fa-${showPassword ? 'eye-slash' : 'eye'}`}
                  ></i>
                </button>
              </div>
              {validationErrors.password && (
                <span className='error-message'>
                  {validationErrors.password}
                </span>
              )}
            </div>

            <div className='form-group'>
              <label htmlFor='confirmPassword'>Confirm Password *</label>
              <div className='password-input'>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id='confirmPassword'
                  value={formData.confirmPassword}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  className={validationErrors.confirmPassword ? 'error' : ''}
                  placeholder='Confirm your password'
                />
                <button
                  type='button'
                  className='password-toggle'
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword ? 'Hide password' : 'Show password'
                  }
                >
                  <i
                    className={`fas fa-${showConfirmPassword ? 'eye-slash' : 'eye'}`}
                  ></i>
                </button>
              </div>
              {validationErrors.confirmPassword && (
                <span className='error-message'>
                  {validationErrors.confirmPassword}
                </span>
              )}
            </div>

            <div className='form-actions'>
              <button
                type='submit'
                className='btn btn-primary'
                disabled={isLoading}
                onClick={() => {
                  // Form submission is handled by onSubmit
                }}
              >
                {isLoading ? 'Creating Account...' : 'Complete Registration'}
              </button>
            </div>

            <div
              className='form-alt-action'
              style={{ marginTop: '16px', textAlign: 'center' }}
            >
              <p>
                Already a partner? <a href='/partner-sign-in'>Sign in here</a>
              </p>
            </div>
          </div>
        </form>

        {errorMessage && (
          <div className='error-message general-error'>
            <i className='fas fa-exclamation-circle'></i>
            {errorMessage}
          </div>
        )}
      </div>

      <div className='signup-footer'>
        <p>
          Need help? <a href='/help'>Contact our support team</a>
        </p>
      </div>
    </div>
  );
});

PartnerSignUp.displayName = 'PartnerSignUp';

export default PartnerSignUp;
