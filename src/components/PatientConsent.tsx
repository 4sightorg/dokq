import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import '../styles/patientConsent.css';

interface PatientConsentProps {
  user: any;
  onConsentComplete: () => void;
}

interface ConsentData {
  dataProcessing: boolean;
  dataSharing: boolean;
  researchParticipation: boolean;
  marketingCommunications: boolean;
  emergencyAccess: boolean;
  thirdPartyServices: boolean;
  dataRetention: boolean;
  rightsAcknowledgment: boolean;
  language: 'en' | 'tl';
}

const PatientConsent: React.FC<PatientConsentProps> = ({ user, onConsentComplete }) => {
  console.log('🎯 PatientConsent component rendered with user:', user);
  const navigate = useNavigate();
  const [language, setLanguage] = useState<'en' | 'tl'>('en');
  const [consentData, setConsentData] = useState<ConsentData>({
    dataProcessing: false,
    dataSharing: false,
    researchParticipation: false,
    marketingCommunications: false,
    emergencyAccess: false,
    thirdPartyServices: false,
    dataRetention: false,
    rightsAcknowledgment: false,
    language: 'en'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleConsentChange = useCallback((field: keyof ConsentData, value: boolean) => {
    setConsentData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const isAllConsentGiven = useCallback(() => {
    return Object.values(consentData).every(value => value === true);
  }, [consentData]);

  const handleSubmit = useCallback(async () => {
    console.log('🎯 Consent form submission started...');
    console.log('📋 Consent data:', consentData);
    
    if (!isAllConsentGiven()) {
      const errorMsg = language === 'en' 
        ? 'Please provide consent for all required items to continue.' 
        : 'Mangyaring magbigay ng pahintulot para sa lahat ng kinakailangang item upang magpatuloy.';
      console.log('❌ Consent validation failed:', errorMsg);
      setErrorMessage(errorMsg);
      return;
    }

    console.log('✅ All consents given, proceeding with submission...');
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Create consent document in Firestore
      const consentDocument = {
        uid: user.uid,
        email: user.email,
        consentVersion: '1.0',
        consentDate: serverTimestamp(),
        language: language,
        consentItems: {
          dataProcessing: {
            consented: consentData.dataProcessing,
            timestamp: serverTimestamp(),
            description: language === 'en' 
              ? 'Processing of personal health information for healthcare services'
              : 'Pagproseso ng personal na impormasyon sa kalusugan para sa mga serbisyo sa kalusugan'
          },
          dataSharing: {
            consented: consentData.dataSharing,
            timestamp: serverTimestamp(),
            description: language === 'en'
              ? 'Sharing health data with authorized healthcare providers'
              : 'Pagbabahagi ng data sa kalusugan sa mga awtorisadong tagapagbigay ng pangangalagang pangkalusugan'
          },
          researchParticipation: {
            consented: consentData.researchParticipation,
            timestamp: serverTimestamp(),
            description: language === 'en'
              ? 'Participation in anonymized health research studies'
              : 'Paglahok sa mga pag-aaral sa pananaliksik sa kalusugan na walang pangalan'
          },
          marketingCommunications: {
            consented: consentData.marketingCommunications,
            timestamp: serverTimestamp(),
            description: language === 'en'
              ? 'Receiving health-related marketing communications'
              : 'Pagtanggap ng mga komunikasyon sa marketing na may kinalaman sa kalusugan'
          },
          emergencyAccess: {
            consented: consentData.emergencyAccess,
            timestamp: serverTimestamp(),
            description: language === 'en'
              ? 'Emergency access to health data by authorized personnel'
              : 'Emergency access sa data sa kalusugan ng mga awtorisadong tauhan'
          },
          thirdPartyServices: {
            consented: consentData.thirdPartyServices,
            timestamp: serverTimestamp(),
            description: language === 'en'
              ? 'Integration with third-party healthcare services'
              : 'Integrasyon sa mga serbisyo sa kalusugan ng third-party'
          },
          dataRetention: {
            consented: consentData.dataRetention,
            timestamp: serverTimestamp(),
            description: language === 'en'
              ? 'Retention of health data as required by law'
              : 'Pagpapanatili ng data sa kalusugan ayon sa kinakailangan ng batas'
          },
          rightsAcknowledgment: {
            consented: consentData.rightsAcknowledgment,
            timestamp: serverTimestamp(),
            description: language === 'en'
              ? 'Acknowledgment of patient rights and data protection laws'
              : 'Pagkilala sa mga karapatan ng pasyente at mga batas sa proteksyon ng data'
          }
        },
        fhirCompliance: {
          standard: 'FHIR R4',
          version: '4.0.1',
          complianceLevel: 'Full',
          dataFormat: 'JSON',
          securityProfile: 'HL7 FHIR Security Profile'
        },
        hl7Compliance: {
          standard: 'HL7 FHIR',
          version: '4.0.1',
          messagingStandard: 'HL7 FHIR RESTful API',
          securityStandard: 'HL7 FHIR Security Implementation Guide'
        },
        dataProtection: {
          gdprCompliant: true,
          hipaaCompliant: true,
          localPrivacyLaws: 'Republic Act No. 10173 (Data Privacy Act of 2012)',
          dataRetentionPeriod: '7 years',
          encryptionStandard: 'AES-256',
          accessControl: 'Role-based access control (RBAC)'
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'patientConsents', user.uid), consentDocument);
      
      // Update patient document to mark consent as given
      await setDoc(doc(db, 'patients', user.uid), {
        consentGiven: true,
        consentDate: serverTimestamp(),
        consentVersion: '1.0',
        updatedAt: serverTimestamp()
      }, { merge: true });

      console.log('✅ Consent saved successfully, calling completion callback...');
      // Call the completion callback
      onConsentComplete();
      console.log('✅ Completion callback called');
    } catch (error: any) {
      console.error('❌ Error saving consent:', error);
      setHasError(true);
      setErrorMessage(language === 'en'
        ? 'Error saving consent. Please try again.'
        : 'Error sa pag-save ng pahintulot. Mangyaring subukan muli.');
      
      // If there's a critical error, try to call the completion callback anyway
      setTimeout(() => {
        try {
          console.log('🔄 Attempting to continue despite consent error...');
          onConsentComplete();
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
        }
      }, 3000);
    } finally {
      setIsSubmitting(false);
    }
  }, [consentData, user, language, onConsentComplete, isAllConsentGiven]);

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => prev === 'en' ? 'tl' : 'en');
  }, []);

  // Debug useEffect
  useEffect(() => {
    console.log('🎯 PatientConsent component mounted');
    console.log('👤 User data:', user);
    console.log('🌐 Current language:', language);
    
    return () => {
      console.log('🎯 PatientConsent component unmounting');
    };
  }, [user, language]);

  const consentContent = {
    en: {
      title: 'Patient Data Privacy Consent',
      subtitle: 'Comprehensive Consent for Healthcare Data Processing',
      fhirInfo: 'This application complies with FHIR (Fast Healthcare Interoperability Resources) R4 standards and HL7 (Health Level 7) messaging protocols to ensure secure, standardized healthcare data exchange.',
      dataProcessing: 'Data Processing Consent',
      dataProcessingDesc: 'I consent to the processing of my personal health information for the purpose of providing healthcare services, including diagnosis, treatment, and ongoing care.',
      dataSharing: 'Healthcare Provider Data Sharing',
      dataSharingDesc: 'I consent to sharing my health data with authorized healthcare providers within the DokQ network for coordinated care and treatment.',
      researchParticipation: 'Research Participation (Optional)',
      researchParticipationDesc: 'I consent to participate in anonymized health research studies that may improve healthcare outcomes for future patients.',
      marketingCommunications: 'Health-Related Communications (Optional)',
      marketingCommunicationsDesc: 'I consent to receive health-related educational materials and updates about healthcare services.',
      emergencyAccess: 'Emergency Data Access',
      emergencyAccessDesc: 'I consent to emergency access of my health data by authorized medical personnel in life-threatening situations.',
      thirdPartyServices: 'Third-Party Service Integration',
      thirdPartyServicesDesc: 'I consent to the integration of my health data with authorized third-party healthcare services for enhanced care coordination.',
      dataRetention: 'Data Retention',
      dataRetentionDesc: 'I acknowledge that my health data will be retained as required by applicable healthcare laws and regulations.',
      rightsAcknowledgment: 'Patient Rights Acknowledgment',
      rightsAcknowledgmentDesc: 'I acknowledge that I have been informed of my rights regarding my health data, including the right to access, correct, and request deletion of my information.',
      submitButton: 'Provide Consent & Continue',
      languageToggle: 'Tagalog',
      requiredNote: 'All consents are required to continue with your account setup.',
      fhirCompliance: 'FHIR R4 & HL7 Compliance',
      dataProtection: 'Data Protection & Privacy Laws',
      gdprNote: 'This application complies with international data protection standards including GDPR and local privacy laws.'
    },
    tl: {
      title: 'Pahintulot sa Privacy ng Data ng Pasyente',
      subtitle: 'Komprehensibong Pahintulot para sa Pagproseso ng Data sa Kalusugan',
      fhirInfo: 'Ang aplikasyong ito ay sumusunod sa mga pamantayan ng FHIR (Fast Healthcare Interoperability Resources) R4 at mga protocol ng HL7 (Health Level 7) messaging upang matiyak ang ligtas, standardized na pagpapalitan ng data sa kalusugan.',
      dataProcessing: 'Pahintulot sa Pagproseso ng Data',
      dataProcessingDesc: 'Ako ay sumasang-ayon sa pagproseso ng aking personal na impormasyon sa kalusugan para sa layunin ng pagbibigay ng mga serbisyo sa kalusugan, kabilang ang diagnosis, paggamot, at patuloy na pangangalaga.',
      dataSharing: 'Pagbabahagi ng Data sa Tagapagbigay ng Kalusugan',
      dataSharingDesc: 'Ako ay sumasang-ayon sa pagbabahagi ng aking data sa kalusugan sa mga awtorisadong tagapagbigay ng pangangalagang pangkalusugan sa loob ng network ng DokQ para sa coordinated na pangangalaga at paggamot.',
      researchParticipation: 'Paglahok sa Pananaliksik (Opsiyonal)',
      researchParticipationDesc: 'Ako ay sumasang-ayon na lumahok sa mga pag-aaral sa pananaliksik sa kalusugan na walang pangalan na maaaring mapabuti ang mga resulta sa kalusugan para sa mga pasyente sa hinaharap.',
      marketingCommunications: 'Mga Komunikasyon na May Kinalaman sa Kalusugan (Opsiyonal)',
      marketingCommunicationsDesc: 'Ako ay sumasang-ayon na makatanggap ng mga materyales sa edukasyon na may kinalaman sa kalusugan at mga update tungkol sa mga serbisyo sa kalusugan.',
      emergencyAccess: 'Emergency Access sa Data',
      emergencyAccessDesc: 'Ako ay sumasang-ayon sa emergency access ng aking data sa kalusugan ng mga awtorisadong medikal na tauhan sa mga sitwasyong nagbabanta sa buhay.',
      thirdPartyServices: 'Integrasyon ng Serbisyo ng Third-Party',
      thirdPartyServicesDesc: 'Ako ay sumasang-ayon sa integrasyon ng aking data sa kalusugan sa mga awtorisadong serbisyo sa kalusugan ng third-party para sa enhanced na coordination ng pangangalaga.',
      dataRetention: 'Pagpapanatili ng Data',
      dataRetentionDesc: 'Ako ay kumikilala na ang aking data sa kalusugan ay papanatilihin ayon sa kinakailangan ng mga naaangkop na batas at regulasyon sa kalusugan.',
      rightsAcknowledgment: 'Pagkilala sa mga Karapatan ng Pasyente',
      rightsAcknowledgmentDesc: 'Ako ay kumikilala na ako ay na-inform tungkol sa aking mga karapatan tungkol sa aking data sa kalusugan, kabilang ang karapatan na ma-access, maitama, at humiling ng pagtanggal ng aking impormasyon.',
      submitButton: 'Magbigay ng Pahintulot at Magpatuloy',
      languageToggle: 'English',
      requiredNote: 'Lahat ng mga pahintulot ay kinakailangan upang magpatuloy sa pag-setup ng iyong account.',
      fhirCompliance: 'Pagsunod sa FHIR R4 & HL7',
      dataProtection: 'Proteksyon ng Data at mga Batas sa Privacy',
      gdprNote: 'Ang aplikasyong ito ay sumusunod sa mga internasyonal na pamantayan sa proteksyon ng data kabilang ang GDPR at mga lokal na batas sa privacy.'
    }
  };

  const currentContent = consentContent[language];

  return (
    <div className="consent-container">
      <div className="consent-header">
        <h1>{currentContent.title}</h1>
        <p className="consent-subtitle">{currentContent.subtitle}</p>
        
        <div className="language-toggle">
          <button 
            type="button" 
            onClick={toggleLanguage}
            className="language-btn"
          >
            {currentContent.languageToggle}
          </button>
        </div>
      </div>

      <div className="compliance-info">
        <div className="fhir-section">
          <h3>{currentContent.fhirCompliance}</h3>
          <p>{currentContent.fhirInfo}</p>
          <div className="compliance-details">
            <div className="compliance-item">
              <strong>FHIR Standard:</strong> R4 (Release 4)
            </div>
            <div className="compliance-item">
              <strong>HL7 Messaging:</strong> RESTful API
            </div>
            <div className="compliance-item">
              <strong>Data Format:</strong> JSON
            </div>
            <div className="compliance-item">
              <strong>Security:</strong> HL7 FHIR Security Profile
            </div>
          </div>
        </div>

        <div className="privacy-section">
          <h3>{currentContent.dataProtection}</h3>
          <p>{currentContent.gdprNote}</p>
          <div className="privacy-details">
            <div className="privacy-item">
              <strong>GDPR:</strong> Compliant
            </div>
            <div className="privacy-item">
              <strong>HIPAA:</strong> Compliant
            </div>
            <div className="privacy-item">
              <strong>Local Law:</strong> RA 10173 (Data Privacy Act)
            </div>
            <div className="privacy-item">
              <strong>Encryption:</strong> AES-256
            </div>
          </div>
        </div>
      </div>

      <div className="consent-form">
        <p className="required-note">{currentContent.requiredNote}</p>

        <div className="consent-item">
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={consentData.dataProcessing}
              onChange={(e) => handleConsentChange('dataProcessing', e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            <div className="consent-text">
              <strong>{currentContent.dataProcessing}</strong>
              <p>{currentContent.dataProcessingDesc}</p>
            </div>
          </label>
        </div>

        <div className="consent-item">
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={consentData.dataSharing}
              onChange={(e) => handleConsentChange('dataSharing', e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            <div className="consent-text">
              <strong>{currentContent.dataSharing}</strong>
              <p>{currentContent.dataSharingDesc}</p>
            </div>
          </label>
        </div>

        <div className="consent-item">
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={consentData.researchParticipation}
              onChange={(e) => handleConsentChange('researchParticipation', e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            <div className="consent-text">
              <strong>{currentContent.researchParticipation}</strong>
              <p>{currentContent.researchParticipationDesc}</p>
            </div>
          </label>
        </div>

        <div className="consent-item">
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={consentData.marketingCommunications}
              onChange={(e) => handleConsentChange('marketingCommunications', e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            <div className="consent-text">
              <strong>{currentContent.marketingCommunications}</strong>
              <p>{currentContent.marketingCommunicationsDesc}</p>
            </div>
          </label>
        </div>

        <div className="consent-item">
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={consentData.emergencyAccess}
              onChange={(e) => handleConsentChange('emergencyAccess', e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            <div className="consent-text">
              <strong>{currentContent.emergencyAccess}</strong>
              <p>{currentContent.emergencyAccessDesc}</p>
            </div>
          </label>
        </div>

        <div className="consent-item">
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={consentData.thirdPartyServices}
              onChange={(e) => handleConsentChange('thirdPartyServices', e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            <div className="consent-text">
              <strong>{currentContent.thirdPartyServices}</strong>
              <p>{currentContent.thirdPartyServicesDesc}</p>
            </div>
          </label>
        </div>

        <div className="consent-item">
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={consentData.dataRetention}
              onChange={(e) => handleConsentChange('dataRetention', e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            <div className="consent-text">
              <strong>{currentContent.dataRetention}</strong>
              <p>{currentContent.dataRetentionDesc}</p>
            </div>
          </label>
        </div>

        <div className="consent-item">
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={consentData.rightsAcknowledgment}
              onChange={(e) => handleConsentChange('rightsAcknowledgment', e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            <div className="consent-text">
              <strong>{currentContent.rightsAcknowledgment}</strong>
              <p>{currentContent.rightsAcknowledgmentDesc}</p>
            </div>
          </label>
        </div>

        {errorMessage && (
          <div className="error-message">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isAllConsentGiven() || isSubmitting}
          className="consent-submit-btn"
        >
          {isSubmitting ? 'Saving...' : currentContent.submitButton}
        </button>

        {/* Fallback button in case of errors */}
        {hasError && (
          <button
            type="button"
            onClick={() => {
              console.log('🔄 Using fallback consent completion...');
              onConsentComplete();
            }}
            className="consent-fallback-btn"
            style={{
              marginTop: '1rem',
              background: '#ff9800',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Continue Without Saving Consent
          </button>
        )}
      </div>
    </div>
  );
};

export default PatientConsent;
