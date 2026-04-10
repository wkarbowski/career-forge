import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import './App.css';
import VerticalMenu from './components/VerticalMenu';
import CentralToolbar from './components/CentralToolbar';
import CLToolbar from './components/CLToolbar';
import CVPagesEditor from './components/CVPagesEditor';
import CoverLetterEditor from './components/CoverLetterEditor';
import { I18nProvider, useTranslation } from './i18n';
import { AppStateProvider, useAppState } from './contexts/AppStateContext';
import { defaultSettings, defaultClSettings } from './contexts/AppStateContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PageProvider, usePages } from './contexts/PageContext';
import GlobalHeader from './components/GlobalHeader';
import HomePage from './components/HomePage';
import DocumentDashboard from './components/DocumentDashboard';
import TemplatesGallery from './components/TemplatesGallery';
import AuthModal from './components/AuthModal';
import GdprBanner from './components/GdprBanner';
import PrivacyPolicyPage from './components/PrivacyPolicyPage';
import { FEATURES } from './config/features';
import { documentApi } from './services/api';
import { getTemplateById } from './data/templates';
import ImageCropperModal from './components/ImageCropperModal';
import OnboardingWizard from './components/OnboardingWizard';
import AccountSettings from './components/AccountSettings';
import VersionHistory from './components/VersionHistory';
import KeywordMatcher from './components/KeywordMatcher';
import ProfileCompleteness from './components/ProfileCompleteness';
import { UndoProvider } from './contexts/UndoContext';

const decodeEntities = (str) => {
  if (typeof str !== 'string') return str;
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
};

const decodeData = (item) => {
  if (Array.isArray(item)) return item.map(decodeData);
  if (item && typeof item === 'object') {
    const out = {};
    Object.keys(item).forEach((k) => {
      out[k] = decodeData(item[k]);
    });
    return out;
  }
  if (typeof item === 'string') return decodeEntities(item);
  return item;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-spinner" aria-hidden="true" />
        <span className="loading-text">Loading...</span>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  
  return children;
};

const EditorRoute = ({ children }) => {
  const { isAuthenticated, isGuest, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-spinner" aria-hidden="true" />
        <span className="loading-text">Loading...</span>
      </div>
    );
  }
  
  if (!isAuthenticated && !isGuest) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function CVEditor({ onSaveStatusChange }) {
    // ...existing code...
    const { data, setData, settings, setSettings, clSettings, setClSettings, profileImage, setProfileImage, visibleSections, setVisibleSections, sidebarOrder, setSidebarOrder, documentType, setDocumentType, coverLetterData, setCoverLetterData, documentTitle, setDocumentTitle } = useAppState();
    // Defensive: ensure profileImage is always string or null
    React.useEffect(() => {
      if (profileImage && typeof profileImage !== 'string') {
        setProfileImage(null);
      }
    }, [profileImage, setProfileImage]);
  const navigate = useNavigate();
  const { cvId } = useParams();
  const location = useLocation();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const titleInputRef = useRef(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState(null);
  const STANDARD_SIZE = 320;

  // (removed duplicate destructuring)
  const { pages, setPages, setUserForcedMax } = usePages();
  const { isAuthenticated, isGuest, saveDocument, currentDocumentId, setCurrentDocumentId, user, updatePreferences } = useAuth();
  const { t, lang } = useTranslation();
  const { theme } = useTheme();
  
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'versions' | 'keywords' | null
  const exportMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const lastSavedDataRef = useRef(null);
  const lastSavedTitleRef = useRef(null);
  const prefsInitializedRef = useRef(false);
  const documentLoadedRef = useRef(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!isAuthenticated || !currentDocumentId) {
      console.warn('Image upload attempted without authenticated user or document selected.');
      return;
    }
    // Check image size
    const dataUrl = await readFileAsDataURL(file);
    const img = new window.Image();
    img.src = dataUrl;
    img.onload = async () => {
      if (img.width > STANDARD_SIZE || img.height > STANDARD_SIZE) {
        setCropperImage(dataUrl);
        setCropperOpen(true);
      } else {
        // Direct upload if small enough
        try {
          const result = await documentApi.uploadProfileImage(currentDocumentId, file);
          if (result && typeof result.url === 'string') {
            setProfileImage(result.url);
          } else {
            setProfileImage(null);
          }
        } catch (err) {
          if (onSaveStatusChange) {
            onSaveStatusChange('error');
            setTimeout(() => onSaveStatusChange(''), 3000);
          }
          setProfileImage(null);
          console.error('Image upload failed:', err);
        }
      }
    };
  };

  const handleImageRemove = async () => {
    if (!isAuthenticated || !currentDocumentId) {
      console.warn('Image remove attempted without authenticated user or document selected.');
      return;
    }
    try {
      await documentApi.removeProfileImage(currentDocumentId);
      setProfileImage(null);
    } catch (err) {
      if (onSaveStatusChange) {
        onSaveStatusChange('error');
        setTimeout(() => onSaveStatusChange(''), 3000);
      }
      console.error('Image remove failed:', err);
    }
  };

  // Helper to read file as data URL
  const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle crop confirm
  const handleCropComplete = async (croppedBlob) => {
    setCropperOpen(false);
    setCropperImage(null);
    if (!isAuthenticated || !currentDocumentId) return;
    try {
      const croppedFile = new File([croppedBlob], 'profile.png', { type: 'image/png' });
      const result = await documentApi.uploadProfileImage(currentDocumentId, croppedFile);
      if (result && typeof result.url === 'string') {
        setProfileImage(result.url);
      } else {
        setProfileImage(null);
      }
    } catch (err) {
      if (onSaveStatusChange) {
        onSaveStatusChange('error');
        setTimeout(() => onSaveStatusChange(''), 3000);
      }
      setProfileImage(null);
      console.error('Image upload failed:', err);
    }
    // ...existing code...
  };

  const handleOnboardingComplete = ({ templateId, basics, visibleSections: onboardingSections }) => {
    setShowOnboarding(false);
    const template = getTemplateById(templateId);
    if (template) {
      if (template.settings) setSettings({ ...defaultSettings, ...template.settings });
      if (template.visibleSections) setVisibleSections(template.visibleSections);
      if (template.sidebarOrder) setSidebarOrder(template.sidebarOrder);
    }
    if (onboardingSections) {
      setVisibleSections(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key] = onboardingSections.includes(key);
        });
        return updated;
      });
    }
    if (basics) {
      setData(prev => ({
        ...prev,
        name: basics.fullName || prev.name,
        position: basics.jobTitle || prev.position,
        contact: {
          ...prev.contact,
          email: basics.email || prev.contact?.email,
          phone: basics.phone || prev.contact?.phone,
        },
      }));
    }
    sessionStorage.setItem('onboarding_done', 'true');
    documentLoadedRef.current = true;
  };

  // localStorage is the source of truth — push local prefs to server on login
  useEffect(() => {
    if (user && !prefsInitializedRef.current) {
      prefsInitializedRef.current = true;
      documentLoadedRef.current = false;
      
      if (user.theme !== theme) {
        updatePreferences({ theme });
      }
      if (user.language !== lang) {
        updatePreferences({ language: lang });
      }
    }
    if (!user) {
      prefsInitializedRef.current = false;
    }
  }, [user, theme, lang, updatePreferences]);

  useEffect(() => {
    if (isAuthenticated && prefsInitializedRef.current && user?.theme !== theme) {
      updatePreferences({ theme });
    }
  }, [theme, isAuthenticated, updatePreferences, user?.theme]);

  useEffect(() => {
    if (isAuthenticated && prefsInitializedRef.current && user?.language !== lang) {
      updatePreferences({ language: lang });
    }
  }, [lang, isAuthenticated, updatePreferences, user?.language]);

  // Track pending (unsaved) data for flush-on-unload
  const pendingSaveRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || isGuest) return;
    // Don't auto-save until a document has been loaded from the API.
    if (!documentLoadedRef.current) return;
    
    const currentData = JSON.stringify({ data, settings, clSettings, visibleSections, sidebarOrder, profileImage, documentType, coverLetterData, pages });
    const currentTitle = documentTitle;
    
    if (currentData === lastSavedDataRef.current && currentTitle === lastSavedTitleRef.current) {
      pendingSaveRef.current = null;
      return;
    }

    // Store pending save data for flush-on-unload
    const documentData = { data, settings, clSettings, visibleSections, sidebarOrder, profileImage, documentType, coverLetterData, pages };
    const title = documentTitle
      || (documentType === 'cover-letter'
        ? (coverLetterData?.name ? `${coverLetterData.name}'s Cover Letter` : 'My Cover Letter')
        : (data?.name ? `${data.name}'s CV` : 'My CV'));
    pendingSaveRef.current = { title, documentData, currentData, currentTitle };
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      // Only mark 'saving' inside the timeout so cancelling the debounce
      // never leaves the indicator stuck.
      if (onSaveStatusChange) onSaveStatusChange('saving');
      try {
        const result = await saveDocument(title, documentData);
        if (!result) throw new Error('Save returned no result');
        lastSavedDataRef.current = currentData;
        lastSavedTitleRef.current = currentTitle;
        pendingSaveRef.current = null;
        if (onSaveStatusChange) onSaveStatusChange('saved');
        setTimeout(() => { if (onSaveStatusChange) onSaveStatusChange(''); }, 3000);
      } catch (err) {
        console.error('Auto-save failed:', err);
        if (onSaveStatusChange) onSaveStatusChange('error');
        setTimeout(() => { if (onSaveStatusChange) onSaveStatusChange(''); }, 3000);
      }
    }, 1000);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, settings, clSettings, visibleSections, sidebarOrder, profileImage, documentType, coverLetterData, pages, documentTitle, isAuthenticated, isGuest, saveDocument, onSaveStatusChange]);

  // Flush pending save when the browser tab closes or user navigates away
  useEffect(() => {
    const flushSave = () => {
      const pending = pendingSaveRef.current;
      if (!pending || !currentDocumentId || currentDocumentId === 'template') return;
      try {
        const payload = JSON.stringify({ title: pending.title, data: pending.documentData });
        fetch(`/api/documents/${currentDocumentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      } catch (_e) { /* best-effort */ }
    };
    window.addEventListener('beforeunload', flushSave);
    return () => {
      window.removeEventListener('beforeunload', flushSave);
      // Also flush when CVEditor unmounts (in-app navigation)
      flushSave();
    };
  }, [currentDocumentId]);

  useEffect(() => {
    const loadDocumentById = async () => {
      if (cvId && isAuthenticated) {
        try {
          const doc = await documentApi.get(cvId);
          if (doc && doc.data) {
            const documentData = doc.data;
            const mergedSettings = { ...defaultSettings, ...(documentData.settings || {}) };
            const loadedImage = documentData.profileImage || null;
            if (documentData.data) setData(decodeData(documentData.data));
            setSettings(mergedSettings);
            if (documentData.visibleSections) setVisibleSections(documentData.visibleSections);
            if (documentData.sidebarOrder) setSidebarOrder(documentData.sidebarOrder);
            setProfileImage(loadedImage);
            if (documentData.documentType) setDocumentType(documentData.documentType);
            if (documentData.coverLetterData) setCoverLetterData(documentData.coverLetterData);
            if (documentData.clSettings) setClSettings({ ...defaultClSettings, ...documentData.clSettings });
            if (documentData.pages) {
              setPages(documentData.pages);
              setUserForcedMax(documentData.pages.length);
            }
            sessionStorage.removeItem('isTemplate');
            sessionStorage.removeItem('selectedTemplateId');
            setCurrentDocumentId(doc.id);
            const loadedTitle = doc.title || '';
            setDocumentTitle(loadedTitle);
            const decodedDocumentData = {
              data: decodeData(documentData.data),
              settings: mergedSettings,
              clSettings: documentData.clSettings ? { ...defaultClSettings, ...documentData.clSettings } : undefined,
              visibleSections: documentData.visibleSections,
              sidebarOrder: documentData.sidebarOrder,
              profileImage: loadedImage,
              documentType: documentData.documentType,
              coverLetterData: documentData.coverLetterData,
              pages: documentData.pages,
            };
            lastSavedDataRef.current = JSON.stringify(decodedDocumentData);
            lastSavedTitleRef.current = loadedTitle;
            documentLoadedRef.current = true;

            // Auto-repair: if the DB document_type doesn't match the data blob, silently patch it.
            const expectedDbType = documentData.documentType === 'cover-letter' ? 'cover_letter' : 'resume';
            if (doc.document_type && doc.document_type !== expectedDbType) {
              documentApi.update(doc.id, { document_type: expectedDbType }).catch(() => {});
            }

            const params = new URLSearchParams(location.search);
            if (params.get('print') === '1') {
              setTimeout(() => window.print(), 800);
            } else if (params.get('pdf') === '1') {
              setTimeout(() => window.print(), 800);
            }
          }
        } catch (err) {
          console.error('Failed to load document:', err);
          navigate('/editor');
        }
      }
    };
    loadDocumentById();
  }, [cvId, isAuthenticated, setData, setSettings, setClSettings, setVisibleSections, setSidebarOrder, setProfileImage, setDocumentType, setCoverLetterData, setCurrentDocumentId, setPages, setUserForcedMax, setDocumentTitle, navigate, location.search]);

  useEffect(() => {
    const loadDefaultDocument = async () => {
      if (isAuthenticated && !cvId && sessionStorage.getItem('isTemplate') !== 'true') {
        try {
          const doc = await documentApi.getDefault();
          if (doc && doc.data) {
            const documentData = doc.data;
            const mergedSettings = { ...defaultSettings, ...(documentData.settings || {}) };
            const loadedImage = documentData.profileImage || null;
            if (documentData.data) setData(decodeData(documentData.data));
            setSettings(mergedSettings);
            if (documentData.visibleSections) setVisibleSections(documentData.visibleSections);
            if (documentData.sidebarOrder) setSidebarOrder(documentData.sidebarOrder);
            setProfileImage(loadedImage);
            if (documentData.documentType) setDocumentType(documentData.documentType);
            if (documentData.coverLetterData) setCoverLetterData(documentData.coverLetterData);
            if (documentData.clSettings) setClSettings({ ...defaultClSettings, ...documentData.clSettings });
            if (documentData.pages) {
              setPages(documentData.pages);
              setUserForcedMax(documentData.pages.length);
            }
            sessionStorage.removeItem('isTemplate');
            sessionStorage.removeItem('selectedTemplateId');
            setCurrentDocumentId(doc.id);
            const loadedTitle = doc.title || '';
            setDocumentTitle(loadedTitle);
            const decodedDocumentData = {
              data: decodeData(documentData.data),
              settings: mergedSettings,
              clSettings: documentData.clSettings ? { ...defaultClSettings, ...documentData.clSettings } : undefined,
              visibleSections: documentData.visibleSections,
              sidebarOrder: documentData.sidebarOrder,
              profileImage: loadedImage,
              documentType: documentData.documentType,
              coverLetterData: documentData.coverLetterData,
              pages: documentData.pages,
            };
            lastSavedDataRef.current = JSON.stringify(decodedDocumentData);
            lastSavedTitleRef.current = loadedTitle;
            documentLoadedRef.current = true;
            // Redirect to the document's URL so the editor always reflects the last edited document
            navigate(`/editor/${doc.id}`, { replace: true });
          }
        } catch (_err) {
          // No documents found — show onboarding if not done before
          if (sessionStorage.getItem('onboarding_done') !== 'true' && sessionStorage.getItem('isTemplate') !== 'true') {
            setShowOnboarding(true);
          }
          documentLoadedRef.current = true;
        }
      }
    };
    loadDefaultDocument();
  }, [isAuthenticated, cvId, setData, setSettings, setClSettings, setVisibleSections, setSidebarOrder, setProfileImage, setDocumentType, setCoverLetterData, setCurrentDocumentId, setPages, setUserForcedMax, setDocumentTitle, navigate]);

  // Re-apply template styling from sessionStorage on mount.
  useEffect(() => {
    try {
      const isTemplateMode = sessionStorage.getItem('isTemplate') === 'true';
      const selectedTemplateId = sessionStorage.getItem('selectedTemplateId');
      if (isTemplateMode && selectedTemplateId) {
        const template = getTemplateById(selectedTemplateId);
        if (template && template.type === 'resume') {

          if (template.settings) setSettings({ ...defaultSettings, ...template.settings });
          if (template.visibleSections) setVisibleSections(template.visibleSections);
          if (template.sidebarOrder) setSidebarOrder(template.sidebarOrder);
          setCurrentDocumentId('template');
          const titleVal = template.name || 'Template';
          setDocumentTitle(titleVal);
          lastSavedTitleRef.current = titleVal;
        } else if (template && template.type === 'cover-letter') {
          setCurrentDocumentId('template');
          const titleVal = template.name || 'Cover Letter';
          setDocumentTitle(titleVal);
          lastSavedTitleRef.current = titleVal;
        }
      }
      // Enable auto-save for new/template documents (guests and authenticated users)
      if (isTemplateMode || isGuest) {
        documentLoadedRef.current = true;
      }
    } catch (err) {
      console.error('Failed to apply template from session:', err);
    }
  }, [setSettings, setVisibleSections, setSidebarOrder, setCurrentDocumentId, setDocumentTitle, isGuest]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleEdit = () => {
    setEditingTitleValue(documentTitle);
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    const newTitle = editingTitleValue.trim();
    if (newTitle && newTitle !== documentTitle) {
      setDocumentTitle(newTitle);
      if (isAuthenticated && currentDocumentId) {
        try {
          await documentApi.update(currentDocumentId, { title: newTitle });
        } catch (err) {
          console.error('Failed to update title:', err);
        }
      }
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleExport = () => {
    const exportData = {
      data,
      settings,
      visibleSections,
      sidebarOrder,
      profileImage,
      documentType,
      coverLetterData,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = data?.personal?.name 
      ? `${data.personal.name.replace(/\s+/g, '-')}-cv-${new Date().toISOString().split('T')[0]}.json`
      : `cv-export-${new Date().toISOString().split('T')[0]}.json`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    setShowExportMenu(false);
    window.print();
  };

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        if (importedData.data) setData(importedData.data);
        if (importedData.settings) setSettings({ ...defaultSettings, ...importedData.settings });
        if (importedData.visibleSections) setVisibleSections(importedData.visibleSections);
        if (importedData.sidebarOrder) setSidebarOrder(importedData.sidebarOrder);
        setProfileImage(importedData.profileImage || null);
        if (importedData.documentType) setDocumentType(importedData.documentType);
        if (importedData.coverLetterData) setCoverLetterData(importedData.coverLetterData);
        
        if (onSaveStatusChange) {
          onSaveStatusChange('saved');
          setTimeout(() => onSaveStatusChange(''), 3000);
        }
      } catch (err) {
        if (onSaveStatusChange) {
          onSaveStatusChange('error');
          setTimeout(() => onSaveStatusChange(''), 3000);
        }
        console.error('Import error:', err);
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const togglePanel = (panel) => setActivePanel(prev => prev === panel ? null : panel);

  const handleVersionRestore = (doc) => {
    if (!doc) return;
    try {
      const restored = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
      if (restored) {
        const decoded = decodeData(restored);
        if (decoded.data) setData(decoded.data);
        if (decoded.settings) setSettings(decoded.settings);
        if (decoded.visibleSections) setVisibleSections(decoded.visibleSections);
        if (decoded.sidebarOrder) setSidebarOrder(decoded.sidebarOrder);
        setProfileImage(decoded.profileImage || null);
      }
      setActivePanel(null);
    } catch (err) {
      console.error('Version restore failed:', err);
    }
  };

  // Build plain text from CV data for keyword matching
  const resumeText = React.useMemo(() => {
    const parts = [];
    if (data.contact?.fullName) parts.push(data.contact.fullName);
    if (data.contact?.position) parts.push(data.contact.position);
    if (data.summary) parts.push(data.summary);
    (data.experience || []).forEach(e => {
      if (e.position) parts.push(e.position);
      if (e.company) parts.push(e.company);
      if (e.description) parts.push(e.description);
    });
    (data.education || []).forEach(e => {
      if (e.degree) parts.push(e.degree);
      if (e.school) parts.push(e.school);
      if (e.description) parts.push(e.description);
    });
    (data.skills || []).forEach(s => { if (s.name) parts.push(s.name); });
    (data.languages || []).forEach(l => { if (l.name) parts.push(l.name); });
    (data.coreCompetencies || []).forEach(c => { if (c.name) parts.push(c.name); });
    (data.achievements || []).forEach(a => { if (a.title) parts.push(a.title); if (a.description) parts.push(a.description); });
    return parts.join(' ');
  }, [data]);

  return (
    <>
      {showOnboarding && (
        <div className="onboarding-overlay">
          <OnboardingWizard
            templates={require('./data/templates').cvTemplates.filter(t => t.type === 'resume')}
            onComplete={handleOnboardingComplete}
          />
        </div>
      )}
      {cropperOpen && cropperImage && (
        <ImageCropperModal
          imageSrc={cropperImage}
          onCancel={() => { setCropperOpen(false); setCropperImage(null); }}
          onCropComplete={handleCropComplete}
          aspect={1}
        />
      )}
      {/* Editor-specific toolbar for print/export/import */}
      <div className="editor-toolbar" role="toolbar" aria-label="Document actions">
        <div className="document-title-wrapper">
          {isEditingTitle ? (
            <div className="title-edit-container">
              <input
                ref={titleInputRef}
                type="text"
                className="document-title-input"
                value={editingTitleValue}
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                aria-label={t('editor.documentTitle') || 'Document title'}
              />
              <button className="title-action-btn save" onClick={handleTitleSave} title={t('common.save')} aria-label={t('common.save')}>
                <i className="fas fa-check"></i>
              </button>
              <button className="title-action-btn cancel" onClick={() => setIsEditingTitle(false)} title={t('common.cancel')} aria-label={t('common.cancel')}>
                <i className="fas fa-times"></i>
              </button>
            </div>
          ) : (
            <button className="document-title" onClick={handleTitleEdit} aria-label={t('editor.editTitle') || 'Edit document title'}>
              <i className="fas fa-file-alt"></i>
              <span>{documentTitle || t('editor.untitledDocument') || 'Untitled Document'}</span>
              <i className="fas fa-pen edit-icon"></i>
            </button>
          )}
        </div>
        <div className="toolbar-buttons">
          <div className="export-dropdown" ref={exportMenuRef}>
            <button className="secondary" onClick={() => setShowExportMenu(prev => !prev)} aria-expanded={showExportMenu} aria-haspopup="true">
              <i className="fas fa-download"></i> {t('toolbar.export')}
              <i className={`fas fa-chevron-${showExportMenu ? 'up' : 'down'} export-chevron`}></i>
            </button>
            {showExportMenu && (
              <div className="export-dropdown-menu" role="menu">
                <button role="menuitem" onClick={() => { handleExport(); setShowExportMenu(false); }}>
                  <i className="fas fa-file-code"></i> {t('toolbar.exportJson')}
                </button>
                <button role="menuitem" onClick={handleExportPdf}>
                  <i className="fas fa-file-pdf"></i> {t('toolbar.exportPdf')}
                </button>
              </div>
            )}
          </div>
          <label className="secondary toolbar-import-btn">
            <i className="fas fa-upload"></i> {t('toolbar.import')}
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".json" 
              style={{ display: 'none' }} 
              onChange={handleImport}
              aria-label={t('toolbar.import')}
            />
          </label>
          {documentType !== 'cover-letter' && isAuthenticated && currentDocumentId && (
            <>
              <button
                className={`secondary${activePanel === 'versions' ? ' active' : ''}`}
                onClick={() => togglePanel('versions')}
                title={t('versions.title')}
              >
                <i className="fas fa-history"></i> {t('versions.title')}
              </button>
              <button
                className={`secondary${activePanel === 'keywords' ? ' active' : ''}`}
                onClick={() => togglePanel('keywords')}
                title={t('keywords.title')}
              >
                <i className="fas fa-search"></i> {t('keywords.title')}
              </button>
            </>
          )}
        </div>
      </div>

      {documentType === 'cover-letter' ? <CLToolbar /> : <CentralToolbar />}

      <div className="editor-layout">
        <VerticalMenu />
        {documentType === 'cover-letter' ? (
          <CoverLetterEditor />
        ) : (
          <CVPagesEditor
            profileImage={profileImage}
            onImageUpload={handleImageUpload}
            onImageRemove={handleImageRemove}
          />
        )}
        {activePanel && documentType !== 'cover-letter' && (
          <div className="editor-side-panel">
            <button className="side-panel-close" onClick={() => setActivePanel(null)} title={t('common.close') || 'Close'}>
              <i className="fas fa-times"></i>
            </button>
            {activePanel === 'versions' && (
              <VersionHistory documentId={currentDocumentId} onRestore={handleVersionRestore} />
            )}
            {activePanel === 'keywords' && (
              <KeywordMatcher resumeText={resumeText} />
            )}
          </div>
        )}
      </div>
      {documentType !== 'cover-letter' && (
        <div className="editor-completeness-bar">
          <ProfileCompleteness data={data} />
        </div>
      )}
    </>
  );
}

function SharedDocumentViewer() {
  const { shareToken } = useParams();
  const { t } = useTranslation();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const { publicApi } = require('./services/api');
    publicApi.getSharedDocument(shareToken)
      .then(d => { if (!cancelled) setDoc(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [shareToken]);

  if (error) return <div className="shared-doc-error"><h2>{t('shared.notFound')}</h2></div>;
  if (!doc) return <div className="shared-doc-loading"><i className="fas fa-spinner fa-spin"></i></div>;

  return (
    <div className="shared-document-viewer">
      <h1>{doc.title}</h1>
      <div className="shared-document-readonly" dangerouslySetInnerHTML={{ __html: '' }}>
      </div>
      <p className="shared-doc-notice">{t('shared.readOnly')}</p>
    </div>
  );
}

function HomePageWrapper() {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated, isGuest, startGuestMode } = useAuth();

  const handleGuestStart = () => {
    startGuestMode();
    navigate('/templates');
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    navigate('/dashboard');
  };

  if (isAuthenticated || isGuest) {
    return (
      <HomePage 
        onLogin={() => setShowAuthModal(true)} 
        onGuestStart={() => navigate('/templates')}
        onBrowseTemplates={() => navigate('/templates')}
        isLoggedIn={isAuthenticated}
        isGuest={isGuest}
      />
    );
  }

  return (
    <>
      <HomePage 
        onLogin={() => setShowAuthModal(true)} 
        onGuestStart={handleGuestStart}
        onBrowseTemplates={() => navigate('/templates')}
      />
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}

function TemplatesGalleryWrapper() {
  const navigate = useNavigate();
  const { setSettings, setClSettings, setVisibleSections, setSidebarOrder, setData, setProfileImage, setDocumentType, setCoverLetterData } = useAppState();
  const { isAuthenticated, isGuest, setCurrentDocumentId } = useAuth();

  const handleSelectTemplate = (template) => {
    if (template.type === 'cover-letter') {
      const { initialCoverLetterData } = require('./data/initialData');
      setCoverLetterData({ ...initialCoverLetterData });
      setDocumentType('cover-letter');
      if (template.settings) setSettings(prev => ({ ...prev, ...template.settings }));
      if (template.clSettings) setClSettings(prev => ({ ...prev, ...template.clSettings }));
      setCurrentDocumentId('template');
      sessionStorage.setItem('isTemplate', 'true');
      sessionStorage.setItem('selectedTemplateId', template.id);
      if (isAuthenticated || isGuest) {
        navigate('/editor');
      } else {
        navigate('/');
      }
      return;
    }

    if (template.type === 'resume') {
      const { initialData } = require('./data/initialData');
      setData({ ...initialData });
      setProfileImage(null); // Clear any existing profile image
      setDocumentType('resume');
      
      if (template.settings) setSettings(template.settings);
      setCurrentDocumentId("template");
      sessionStorage.setItem("isTemplate", "true");
      sessionStorage.setItem("selectedTemplateId", template.id);
      if (template.visibleSections) setVisibleSections(template.visibleSections);
      if (template.sidebarOrder) setSidebarOrder(template.sidebarOrder);
      
      if (isAuthenticated || isGuest) {
        navigate('/editor');
      } else {
        navigate('/');
      }
    }
  };

  const handleBack = () => {
    if (isAuthenticated || isGuest) {
      navigate('/editor');
    } else {
      navigate('/');
    }
  };

  return (
    <TemplatesGallery 
      onSelectTemplate={handleSelectTemplate}
      onBack={handleBack}
    />
  );
}

function DashboardWrapper() {
  const navigate = useNavigate();

  const handleEditDocument = (documentId) => {
    navigate(`/editor/${documentId}`);
  };

  const handlePrintDocument = (documentId) => {
    navigate(`/editor/${documentId}?print=1`);
  };

  const handleSavePdfDocument = (documentId) => {
    navigate(`/editor/${documentId}?pdf=1`);
  };

  return (
    <DocumentDashboard 
      onBack={() => navigate('/editor')}
      onEditDocument={handleEditDocument}
      onPrintDocument={handlePrintDocument}
      onSavePdfDocument={handleSavePdfDocument}
    />
  );
}

function AppContentInner() {
  const [saveStatus, setSaveStatus] = useState('');
  const { resetToInitial } = useAppState();
  const { resetPages } = usePages();
  const { setCurrentDocumentId } = useAuth();
  const navigate = useNavigate();

  const handleLoadDocument = useCallback((docId) => {
    if (!docId) {
      resetToInitial();
      resetPages();
      setCurrentDocumentId("template");
      sessionStorage.setItem("isTemplate", "true");
      navigate('/editor');
      return;
    }
    navigate(`/editor/${docId}`);
  }, [resetToInitial, resetPages, setCurrentDocumentId, navigate]);

  return (
    <>
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <GlobalHeader onLoadDocument={handleLoadDocument} saveStatus={saveStatus} />
      <main className="app-main" id="main-content">
        <Routes>
          <Route path="/" element={<HomePageWrapper />} />
          <Route path="/templates" element={<TemplatesGalleryWrapper />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/shared/:shareToken" element={<SharedDocumentViewer />} />
          <Route 
            path="/account" 
            element={
              <ProtectedRoute>
                <AccountSettings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardWrapper />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/editor" 
            element={
              <EditorRoute>
                <CVEditor onSaveStatusChange={setSaveStatus} />
              </EditorRoute>
            } 
          />
          <Route 
            path="/editor/:cvId" 
            element={
              <ProtectedRoute>
                <CVEditor onSaveStatusChange={setSaveStatus} />
              </ProtectedRoute>
            } 
          />
          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {/* GDPR banner: opt-in via REACT_APP_GDPR=true */}
      {FEATURES.GDPR_BANNER && <GdprBanner />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <PageProvider>
              <AuthProvider>
                <UndoProvider>
                  <AppContentInner />
                </UndoProvider>
              </AuthProvider>
            </PageProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;