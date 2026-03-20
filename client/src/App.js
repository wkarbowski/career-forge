import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import './App.css';
import VerticalMenu from './components/VerticalMenu';
import TextToolbar from './components/TextToolbar';
import CVPagesEditor from './components/CVPagesEditor';
import CoverLetterEditor from './components/CoverLetterEditor';
import { I18nProvider, useTranslation } from './i18n';
import { AppStateProvider, useAppState } from './contexts/AppStateContext';
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
import html2canvas from 'html2canvas';

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
  const navigate = useNavigate();
  const { cvId } = useParams();
  const location = useLocation();
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const titleInputRef = useRef(null);
  
  const { data, setData, settings, setSettings, profileImage, setProfileImage, visibleSections, setVisibleSections, sidebarOrder, setSidebarOrder, documentType, setDocumentType, coverLetterData, setCoverLetterData, documentTitle, setDocumentTitle } = useAppState();
  const { pages, setPages, setUserForcedMax } = usePages();
  const { isAuthenticated, isGuest, saveDocument, currentDocumentId, setCurrentDocumentId, user, updatePreferences } = useAuth();
  const { t, lang } = useTranslation();
  const { theme } = useTheme();
  
  const [showExportMenu, setShowExportMenu] = useState(false);
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
    try {
      const result = await documentApi.uploadProfileImage(currentDocumentId, file);
      if (result && result.url) {
        setProfileImage(result.url);
      }
    } catch (err) {
      if (onSaveStatusChange) {
        onSaveStatusChange('error');
        setTimeout(() => onSaveStatusChange(''), 3000);
      }
      console.error('Image upload failed:', err);
    }
  };

  const handleTextSelect = useCallback((e) => {
    const toolbar = document.querySelector('.text-toolbar');

    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setShowToolbar(false);
        return;
      }

      let node = sel.anchorNode || sel.focusNode;
      if (!node) {
        setShowToolbar(false);
        return;
      }

      const anchorElement = node.nodeType === 3 ? node.parentElement : node;
      if (toolbar && anchorElement && toolbar.contains(anchorElement)) {
        return;
      }

      let inEditable = false;
      let checkNode = anchorElement;
      while (checkNode) {
        if (checkNode.nodeType === 1 && checkNode.isContentEditable) {
          inEditable = true;
          break;
        }
        checkNode = checkNode.parentNode;
      }
      if (!inEditable) {
        setShowToolbar(false);
        return;
      }

      if (sel.isCollapsed) {
        setShowToolbar(false);
        return;
      }

      const range = sel.getRangeAt(0);
      let rect = null;
      const rects = range.getClientRects();
      rect = rects && rects.length ? rects[0] : range.getBoundingClientRect();
      if (!rect) return;

      setToolbarPosition({ left: rect.left + window.scrollX, top: rect.top + window.scrollY });
      setShowToolbar(true);
    } catch (err) {
      return;
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelect);
    document.addEventListener('selectionchange', handleTextSelect);
    document.addEventListener('keyup', handleTextSelect);
    return () => {
      document.removeEventListener('mouseup', handleTextSelect);
      document.removeEventListener('selectionchange', handleTextSelect);
      document.removeEventListener('keyup', handleTextSelect);
    };
  }, [handleTextSelect]);

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

  useEffect(() => {
    if (!isAuthenticated || isGuest) return;
    // Don't auto-save until a document has been loaded from the API.
    if (!documentLoadedRef.current) return;
    
    const currentData = JSON.stringify({ data, settings, visibleSections, sidebarOrder, profileImage, documentType, coverLetterData, pages });
    const currentTitle = documentTitle;
    
    if (currentData === lastSavedDataRef.current && currentTitle === lastSavedTitleRef.current) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      // Only mark 'saving' inside the timeout so cancelling the debounce
      // never leaves the indicator stuck.
      if (onSaveStatusChange) onSaveStatusChange('saving');
      try {
        const documentData = { data, settings, visibleSections, sidebarOrder, profileImage, documentType, coverLetterData, pages };
            const title = documentTitle
          || (documentType === 'cover-letter'
            ? (coverLetterData?.name ? `${coverLetterData.name}'s Cover Letter` : 'My Cover Letter')
            : (data?.name ? `${data.name}'s CV` : 'My CV'));
        const result = await saveDocument(title, documentData);
        if (!result) throw new Error('Save returned no result');
        lastSavedDataRef.current = currentData;
        lastSavedTitleRef.current = currentTitle;
        if (onSaveStatusChange) onSaveStatusChange('saved');
        setTimeout(() => { if (onSaveStatusChange) onSaveStatusChange(''); }, 3000);
      } catch (err) {
        console.error('Auto-save failed:', err);
        if (onSaveStatusChange) onSaveStatusChange('error');
        setTimeout(() => { if (onSaveStatusChange) onSaveStatusChange(''); }, 3000);
      }
    }, 2000);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, settings, visibleSections, sidebarOrder, profileImage, documentType, coverLetterData, pages, documentTitle, isAuthenticated, isGuest, saveDocument, onSaveStatusChange]);

  useEffect(() => {
    const loadDocumentById = async () => {
      if (cvId && isAuthenticated) {
        try {
          const doc = await documentApi.get(cvId);
          if (doc && doc.data) {
            const documentData = doc.data;
            if (documentData.data) setData(decodeData(documentData.data));
            if (documentData.settings) setSettings(documentData.settings);
            if (documentData.visibleSections) setVisibleSections(documentData.visibleSections);
            if (documentData.sidebarOrder) setSidebarOrder(documentData.sidebarOrder);
            if (documentData.profileImage) setProfileImage(documentData.profileImage);
            if (documentData.documentType) setDocumentType(documentData.documentType);
            if (documentData.coverLetterData) setCoverLetterData(documentData.coverLetterData);
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
              settings: documentData.settings,
              visibleSections: documentData.visibleSections,
              sidebarOrder: documentData.sidebarOrder,
              profileImage: documentData.profileImage,
              documentType: documentData.documentType,
              coverLetterData: documentData.coverLetterData,
              pages: documentData.pages,
            };
            lastSavedDataRef.current = JSON.stringify(decodedDocumentData);
            lastSavedTitleRef.current = loadedTitle;
            documentLoadedRef.current = true;
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
  }, [cvId, isAuthenticated, setData, setSettings, setVisibleSections, setSidebarOrder, setProfileImage, setDocumentType, setCoverLetterData, setCurrentDocumentId, setPages, setUserForcedMax, setDocumentTitle, navigate, location.search]);

  useEffect(() => {
    const loadDefaultDocument = async () => {
      if (isAuthenticated && !cvId && sessionStorage.getItem('isTemplate') !== 'true') {
        try {
          const doc = await documentApi.getDefault();
          if (doc && doc.data) {
            const documentData = doc.data;
            if (documentData.data) setData(decodeData(documentData.data));
            if (documentData.settings) setSettings(documentData.settings);
            if (documentData.visibleSections) setVisibleSections(documentData.visibleSections);
            if (documentData.sidebarOrder) setSidebarOrder(documentData.sidebarOrder);
            if (documentData.profileImage) setProfileImage(documentData.profileImage);
            if (documentData.documentType) setDocumentType(documentData.documentType);
            if (documentData.coverLetterData) setCoverLetterData(documentData.coverLetterData);
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
              settings: documentData.settings,
              visibleSections: documentData.visibleSections,
              sidebarOrder: documentData.sidebarOrder,
              profileImage: documentData.profileImage,
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
          documentLoadedRef.current = true;
        }
      }
    };
    loadDefaultDocument();
  }, [isAuthenticated, cvId, setData, setSettings, setVisibleSections, setSidebarOrder, setProfileImage, setDocumentType, setCoverLetterData, setCurrentDocumentId, setPages, setUserForcedMax, setDocumentTitle, navigate]);

  // Re-apply template styling from sessionStorage on mount.
  useEffect(() => {
    try {
      const isTemplateMode = sessionStorage.getItem('isTemplate') === 'true';
      const selectedTemplateId = sessionStorage.getItem('selectedTemplateId');
      if (isTemplateMode && selectedTemplateId) {
        const template = getTemplateById(selectedTemplateId);
        if (template && template.type === 'resume') {

          if (template.settings) setSettings(template.settings);
          if (template.visibleSections) setVisibleSections(template.visibleSections);
          if (template.sidebarOrder) setSidebarOrder(template.sidebarOrder);
          setCurrentDocumentId('template');
          const titleVal = template.name || 'Template';
          setDocumentTitle(titleVal);
          lastSavedTitleRef.current = titleVal;
        }
      }
      if (isGuest) {
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

  const handleExportPng = async () => {
    setShowExportMenu(false);
    const target = document.querySelector('.cv-pages-editor-canvas') || document.querySelector('.cl-editor');
    if (!target) return;
    try {
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      const fileName = data?.name
        ? `${data.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.png`
        : `document-${new Date().toISOString().split('T')[0]}.png`;
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG export failed:', err);
    }
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
        if (importedData.settings) setSettings(importedData.settings);
        if (importedData.visibleSections) setVisibleSections(importedData.visibleSections);
        if (importedData.sidebarOrder) setSidebarOrder(importedData.sidebarOrder);
        if (importedData.profileImage) setProfileImage(importedData.profileImage);
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

  return (
    <>
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
                <button role="menuitem" onClick={handleExportPng}>
                  <i className="fas fa-file-image"></i> {t('toolbar.exportPng')}
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
        </div>
      </div>

      {showToolbar && <TextToolbar position={toolbarPosition} onClose={() => setShowToolbar(false)} />}

      <div className="editor-layout">
        <VerticalMenu />
        {documentType === 'cover-letter' ? (
          <CoverLetterEditor />
        ) : (
          <CVPagesEditor
            profileImage={profileImage}
            onImageUpload={handleImageUpload}
          />
        )}
      </div>
    </>
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
  const { setSettings, setVisibleSections, setSidebarOrder, setData, setProfileImage, setDocumentType, setCoverLetterData } = useAppState();
  const { isAuthenticated, isGuest, setCurrentDocumentId } = useAuth();

  const handleSelectTemplate = (template) => {
    if (template.type === 'cover-letter') {
      const { initialCoverLetterData } = require('./data/initialData');
      setCoverLetterData({ ...initialCoverLetterData });
      setDocumentType('cover-letter');
      if (template.settings) setSettings(prev => ({ ...prev, ...template.settings }));
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
                <AppContentInner />
              </AuthProvider>
            </PageProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;