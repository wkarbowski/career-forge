import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import { defaultClSettings, defaultSettings } from "../../../contexts/AppStateContext";
import { getTemplateById } from "../../../data/templates";
import { documentApi } from "../../../services/api";
import type {
  CLSettings,
  CoverLetterData,
  CVData,
  CVSettings,
  Document as AppDocument,
  Page,
  User,
  VisibleSections,
} from "../../../types";
import { toApiDocumentType } from "../../../types";
import { decodeData } from "../../../utils/decodeData";

type SaveStatus = "saving" | "saved" | "error" | "";
type DocumentId = number | "template" | null;

type UpdatePreferences = (preferences: Record<string, unknown>) => Promise<User | null>;

interface UseEditorDocumentLifecycleParams {
  data: CVData;
  setData: Dispatch<SetStateAction<CVData>>;
  settings: CVSettings;
  setSettings: Dispatch<SetStateAction<CVSettings>>;
  clSettings: CLSettings;
  setClSettings: Dispatch<SetStateAction<CLSettings>>;
  profileImage: string | null;
  setProfileImage: Dispatch<SetStateAction<string | null>>;
  visibleSections: VisibleSections;
  setVisibleSections: Dispatch<SetStateAction<VisibleSections>>;
  sidebarOrder: string[];
  setSidebarOrder: Dispatch<SetStateAction<string[]>>;
  documentType: "resume" | "cover-letter";
  setDocumentType: Dispatch<SetStateAction<"resume" | "cover-letter">>;
  coverLetterData: CoverLetterData;
  setCoverLetterData: Dispatch<SetStateAction<CoverLetterData>>;
  documentTitle: string;
  setDocumentTitle: Dispatch<SetStateAction<string>>;
  migrateData: (data: CVData) => CVData;
  pages: Page[];
  setPages: Dispatch<SetStateAction<Page[]>>;
  setUserForcedMax: (count: number) => void;
  isAuthenticated: boolean;
  isGuest: boolean;
  saveDocument: (title: string, data: Record<string, unknown>) => Promise<AppDocument | null>;
  currentDocumentId: DocumentId;
  setCurrentDocumentId: Dispatch<SetStateAction<DocumentId>>;
  user: User | null;
  updatePreferences: UpdatePreferences;
  theme: string;
  lang: string;
  cvId: string | undefined;
  locationSearch: string;
  navigate: NavigateFunction;
  onSaveStatusChange: (status: SaveStatus) => void;
}

export function useEditorDocumentLifecycle({
  data,
  setData,
  settings,
  setSettings,
  clSettings,
  setClSettings,
  profileImage,
  setProfileImage,
  visibleSections,
  setVisibleSections,
  sidebarOrder,
  setSidebarOrder,
  documentType,
  setDocumentType,
  coverLetterData,
  setCoverLetterData,
  documentTitle,
  setDocumentTitle,
  migrateData,
  pages,
  setPages,
  setUserForcedMax,
  isAuthenticated,
  isGuest,
  saveDocument,
  currentDocumentId,
  setCurrentDocumentId,
  user,
  updatePreferences,
  theme,
  lang,
  cvId,
  locationSearch,
  navigate,
  onSaveStatusChange,
}: UseEditorDocumentLifecycleParams): void {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDataRef = useRef<string | null>(null);
  const lastSavedTitleRef = useRef<string | null>(null);
  const prefsInitializedRef = useRef(false);
  const documentLoadedRef = useRef(false);

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
    if (
      isAuthenticated &&
      prefsInitializedRef.current &&
      user?.theme !== theme
    ) {
      updatePreferences({ theme });
    }
  }, [theme, isAuthenticated, updatePreferences, user?.theme]);

  useEffect(() => {
    if (
      isAuthenticated &&
      prefsInitializedRef.current &&
      user?.language !== lang
    ) {
      updatePreferences({ language: lang });
    }
  }, [lang, isAuthenticated, updatePreferences, user?.language]);

  // Track pending (unsaved) data for flush-on-unload
  interface PendingSave {
    title: string;
    documentData: Record<string, unknown>;
    currentData: string;
    currentTitle: string;
  }
  const pendingSaveRef = useRef<PendingSave | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isGuest) return;
    // Don't auto-save until a document has been loaded from the API.
    if (!documentLoadedRef.current) return;

    const currentData = JSON.stringify({
      data,
      settings,
      clSettings,
      visibleSections,
      sidebarOrder,
      profileImage,
      documentType,
      coverLetterData,
      pages,
    });
    const currentTitle = documentTitle;

    if (
      currentData === lastSavedDataRef.current &&
      currentTitle === lastSavedTitleRef.current
    ) {
      pendingSaveRef.current = null;
      return;
    }

    // Store pending save data for flush-on-unload
    const documentData = {
      data,
      settings,
      clSettings,
      visibleSections,
      sidebarOrder,
      profileImage,
      documentType,
      coverLetterData,
      pages,
    };
    const title =
      documentTitle ||
      (documentType === "cover-letter"
        ? coverLetterData?.name
          ? `${coverLetterData.name}'s Cover Letter`
          : "My Cover Letter"
        : data?.name
          ? `${data.name}'s CV`
          : "My CV");
    pendingSaveRef.current = { title, documentData, currentData, currentTitle };

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      // Only mark 'saving' inside the timeout so cancelling the debounce
      // never leaves the indicator stuck.
      if (onSaveStatusChange) onSaveStatusChange("saving");
      try {
        const result = await saveDocument(title, documentData);
        if (!result) throw new Error("Save returned no result");
        lastSavedDataRef.current = currentData;
        lastSavedTitleRef.current = currentTitle;
        pendingSaveRef.current = null;
        if (onSaveStatusChange) onSaveStatusChange("saved");
        setTimeout(() => {
          if (onSaveStatusChange) onSaveStatusChange("");
        }, 3000);
      } catch (err) {
        console.error("Auto-save failed:", err);
        if (onSaveStatusChange) onSaveStatusChange("error");
        setTimeout(() => {
          if (onSaveStatusChange) onSaveStatusChange("");
        }, 3000);
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    data,
    settings,
    clSettings,
    visibleSections,
    sidebarOrder,
    profileImage,
    documentType,
    coverLetterData,
    pages,
    documentTitle,
    isAuthenticated,
    isGuest,
    saveDocument,
    onSaveStatusChange,
  ]);

  // Flush pending save when the browser tab closes or user navigates away
  useEffect(() => {
    const flushSave = () => {
      const pending = pendingSaveRef.current;
      if (!pending || !currentDocumentId || currentDocumentId === "template")
        return;
      try {
        const payload = JSON.stringify({
          title: pending.title,
          data: pending.documentData,
        });
        fetch(`/api/documents/${currentDocumentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {
          /* best-effort */
        });
      } catch (_e) {
        /* best-effort */
      }
    };
    window.addEventListener("beforeunload", flushSave);
    return () => {
      window.removeEventListener("beforeunload", flushSave);
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
            const mergedSettings = {
              ...defaultSettings,
              ...(documentData.settings || {}),
            };
            const loadedImage = documentData.profileImage || null;
            if (documentData.data)
              setData(migrateData(decodeData(documentData.data) as CVData));
            setSettings(mergedSettings);
            if (documentData.visibleSections)
              setVisibleSections(documentData.visibleSections);
            if (documentData.sidebarOrder)
              setSidebarOrder(documentData.sidebarOrder);
            setProfileImage(loadedImage);
            if (documentData.documentType)
              setDocumentType(documentData.documentType);
            if (documentData.coverLetterData)
              setCoverLetterData(documentData.coverLetterData);
            if (documentData.clSettings)
              setClSettings({
                ...defaultClSettings,
                ...documentData.clSettings,
              });
            if (documentData.pages) {
              setPages(documentData.pages);
              setUserForcedMax(documentData.pages.length);
            }
            sessionStorage.removeItem("isTemplate");
            sessionStorage.removeItem("selectedTemplateId");
            setCurrentDocumentId(doc.id);
            const loadedTitle = doc.title || "";
            setDocumentTitle(loadedTitle);
            const decodedDocumentData = {
              data: decodeData(documentData.data),
              settings: mergedSettings,
              clSettings: documentData.clSettings
                ? { ...defaultClSettings, ...documentData.clSettings }
                : undefined,
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
            const expectedDbType = toApiDocumentType(
              (documentData.documentType as "resume" | "cover-letter") ||
                "resume",
            );
            if (doc.document_type && doc.document_type !== expectedDbType) {
              documentApi
                .update(String(doc.id), { document_type: expectedDbType })
                .catch(() => {});
            }

            const params = new URLSearchParams(locationSearch);
            if (params.get("print") === "1") {
              setTimeout(() => window.print(), 800);
            } else if (params.get("pdf") === "1") {
              setTimeout(() => window.print(), 800);
            }
          }
        } catch (err) {
          console.error("Failed to load document:", err);
          navigate("/editor");
        }
      }
    };
    loadDocumentById();
  }, [
    cvId,
    isAuthenticated,
    setData,
    setSettings,
    setClSettings,
    setVisibleSections,
    setSidebarOrder,
    setProfileImage,
    setDocumentType,
    setCoverLetterData,
    setCurrentDocumentId,
    setPages,
    setUserForcedMax,
    setDocumentTitle,
    navigate,
    locationSearch,
    migrateData,
  ]);

  useEffect(() => {
    const loadDefaultDocument = async () => {
      if (
        isAuthenticated &&
        !cvId &&
        sessionStorage.getItem("isTemplate") !== "true"
      ) {
        try {
          const doc = await documentApi.getDefault();
          if (doc && doc.data) {
            const documentData = doc.data;
            const mergedSettings = {
              ...defaultSettings,
              ...(documentData.settings || {}),
            };
            const loadedImage = documentData.profileImage || null;
            if (documentData.data)
              setData(migrateData(decodeData(documentData.data) as CVData));
            setSettings(mergedSettings);
            if (documentData.visibleSections)
              setVisibleSections(documentData.visibleSections);
            if (documentData.sidebarOrder)
              setSidebarOrder(documentData.sidebarOrder);
            setProfileImage(loadedImage);
            if (documentData.documentType)
              setDocumentType(documentData.documentType);
            if (documentData.coverLetterData)
              setCoverLetterData(documentData.coverLetterData);
            if (documentData.clSettings)
              setClSettings({
                ...defaultClSettings,
                ...documentData.clSettings,
              });
            if (documentData.pages) {
              setPages(documentData.pages);
              setUserForcedMax(documentData.pages.length);
            }
            sessionStorage.removeItem("isTemplate");
            sessionStorage.removeItem("selectedTemplateId");
            setCurrentDocumentId(doc.id);
            const loadedTitle = doc.title || "";
            setDocumentTitle(loadedTitle);
            const decodedDocumentData = {
              data: decodeData(documentData.data),
              settings: mergedSettings,
              clSettings: documentData.clSettings
                ? { ...defaultClSettings, ...documentData.clSettings }
                : undefined,
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
          // No documents found — redirect to Templates so user can pick one
          if (sessionStorage.getItem("isTemplate") !== "true") {
            navigate("/templates", {
              replace: true,
              state: { fromEditor: true },
            });
          }
          documentLoadedRef.current = true;
        }
      }
    };
    loadDefaultDocument();
  }, [
    isAuthenticated,
    cvId,
    setData,
    setSettings,
    setClSettings,
    setVisibleSections,
    setSidebarOrder,
    setProfileImage,
    setDocumentType,
    setCoverLetterData,
    setCurrentDocumentId,
    setPages,
    setUserForcedMax,
    setDocumentTitle,
    navigate,
    migrateData,
  ]);

  // Re-apply template styling from sessionStorage on mount.
  useEffect(() => {
    try {
      const isTemplateMode = sessionStorage.getItem("isTemplate") === "true";
      const selectedTemplateId = sessionStorage.getItem("selectedTemplateId");
      if (isTemplateMode && selectedTemplateId) {
        const template = getTemplateById(selectedTemplateId);
        if (template && template.type === "resume") {
          if (template.settings)
            setSettings({
              ...defaultSettings,
              ...template.settings,
            } as CVSettings);
          if (template.visibleSections)
            setVisibleSections({
              ...({} as VisibleSections),
              ...template.visibleSections,
            } as VisibleSections);
          if (template.sidebarOrder) setSidebarOrder(template.sidebarOrder);
          setCurrentDocumentId("template");
          const titleVal = template.name || "Template";
          setDocumentTitle(titleVal);
          lastSavedTitleRef.current = titleVal;
        } else if (template && template.type === "cover-letter") {
          setCurrentDocumentId("template");
          const titleVal = template.name || "Cover Letter";
          setDocumentTitle(titleVal);
          lastSavedTitleRef.current = titleVal;
        }
      }
      // Enable auto-save for new/template documents (guests and authenticated users)
      if (isTemplateMode || isGuest) {
        documentLoadedRef.current = true;
      }
    } catch (err) {
      console.error("Failed to apply template from session:", err);
    }
  }, [
    setSettings,
    setVisibleSections,
    setSidebarOrder,
    setCurrentDocumentId,
    setDocumentTitle,
    isGuest,
  ]);
}
