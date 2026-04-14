// ============================================================
// Shared type definitions for Career Forge frontend
// ============================================================

// ── CV / Resume Data ──────────────────────────────────────────

export interface Contact {
  phone: string;
  email: string;
  website: string;
  websiteIcon: string;
  linkedin: string;
  github: string;
  location: string;
}

export interface CoreCompetency {
  id: number | string;
  name: string;
}

export interface Language {
  id: number | string;
  name: string;
  level: number | null;
  proficiency: string;
}

export interface Skill {
  id: number | string;
  name: string;
}

export interface Achievement {
  id: number | string;
  title: string;
  description: string;
}

export interface Experience {
  id: number | string;
  title: string;
  company: string;
  period: string;
  location: string;
  description: string;
  achievements: string[];
}

export interface Education {
  id: number | string;
  type: string;
  degree: string;
  school: string;
  period: string;
  location: string;
  description?: string;
  title?: string;
  institution?: string;
}

export interface CustomSectionItem {
  id: number | string;
  title?: string;
  description?: string;
  subtitle?: string;
  period?: string;
  technologies?: string;
  link?: string;
  name?: string;
  issuer?: string;
  credentialId?: string;
  expiryDate?: string;
  journal?: string;
  date?: string;
  doi?: string;
  role?: string;
  organization?: string;
  company?: string;
  contact?: string;
}

export interface CustomSection {
  id: string;
  name?: string;
  title?: string;
  type: string;
  position: 'main' | 'sidebar';
  items: CustomSectionItem[];
}

export interface CVData {
  name: string;
  position: string;
  contact: Contact;
  summary: string;
  coreCompetencies: CoreCompetency[];
  languages: Language[];
  skills: Skill[];
  achievements: Achievement[];
  experience: Experience[];
  education: Education[];
  customSections: CustomSection[];
}

// ── Cover Letter Data ─────────────────────────────────────────

export interface CoverLetterData {
  name: string;
  street: string;
  city: string;
  phone: string;
  email: string;
  place: string;
  date: string;
  recipientCompany: string;
  recipientContact: string;
  recipientStreet: string;
  recipientCity: string;
  subject: string;
  salutation: string;
  body: string;
  closing: string;
  signature: string;
  signatureImage: string | null;
  extraPages: string[];
}

// ── Settings ──────────────────────────────────────────────────

export type LayoutType =
  | 'sidebar-left'
  | 'sidebar-right'
  | 'top-header'
  | 'ats-single-column';

export interface CVSettings {
  sidebarColor1: string;
  sidebarColor2: string;
  accentColor: string;
  layout: LayoutType;
  nameFont: string;
  nameFontSize: number;
  headingFont: string;
  headingFontSize: number;
  subtitleFont: string;
  subtitleFontSize: number;
  bodyFont: string;
  bodyFontSize: number;
  titleFont?: string;
}

export interface CLSettings {
  nameFont: string;
  nameFontSize: number;
  senderFont: string;
  senderFontSize: number;
  subjectFont: string;
  subjectFontSize: number;
  bodyFont: string;
  bodyFontSize: number;
}

// ── Visible Sections ──────────────────────────────────────────

export interface VisibleSections {
  summary: boolean;
  coreCompetencies: boolean;
  languages: boolean;
  skills: boolean;
  achievements: boolean;
  experience: boolean;
  education: boolean;
  [key: string]: boolean; // custom section IDs
}

// ── Document Type ─────────────────────────────────────────────

export type DocumentType = 'resume' | 'cover-letter';

// ── Templates ─────────────────────────────────────────────────

export interface ColorPreset {
  id: string;
  nameKey: string;
  sidebarColor1?: string;
  sidebarColor2?: string;
  accentColor: string;
}

export interface TemplatePreview {
  colors: string[];
  layout: string;
}

export interface CVTemplate {
  id: string;
  name: string;
  description: string;
  type: 'resume' | 'cover-letter';
  category: string;
  atsOptimized?: boolean;
  preview: TemplatePreview;
  settings: Partial<CVSettings> & Record<string, unknown>;
  clSettings?: Partial<CLSettings>;
  colorPresets: ColorPreset[];
  visibleSections?: Partial<VisibleSections>;
  sidebarOrder?: string[];
}

// ── Custom Section Templates ──────────────────────────────────

export interface CustomSectionTemplate {
  name: string;
  type: string;
  position: 'main' | 'sidebar';
  items: CustomSectionItem[];
}

// ── Pages ─────────────────────────────────────────────────────

export interface PageSections {
  sidebar: string[] | null;
  main: string[] | null;
}

export interface Page {
  id: string;
  pageNumber: number;
  sections: PageSections;
}

export interface PageConfig {
  width: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  contentWidth: number;
  contentHeight: number;
}

// ── Auth / User ───────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  theme?: string;
  language?: string;
  created_at?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}

// ── API / Document ────────────────────────────────────────────

export interface DocumentData {
  data?: CVData;
  settings?: CVSettings;
  clSettings?: CLSettings;
  visibleSections?: VisibleSections;
  sidebarOrder?: string[];
  profileImage?: string | null;
  documentType?: DocumentType;
  coverLetterData?: CoverLetterData;
  pages?: Page[];
}

export interface Document {
  id: string;
  title: string;
  data: DocumentData;
  document_type?: string;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
  share_token?: string;
}

export interface DocumentVersion {
  id: string;
  version_name: string;
  data: DocumentData;
  created_at: string;
}

// ── API Responses ─────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  expires_in?: number;
  token_type: string;
}

export interface ImageUploadResponse {
  url: string;
}

// ── Feature Flags ─────────────────────────────────────────────

export interface Features {
  CLOUD: boolean;
  AUTH_OAUTH: boolean;
  GDPR_BANNER: boolean;
  PDF_EXPORT: boolean;
  SHARING: boolean;
  CV_LIMITS: boolean;
}

// ── I18n ──────────────────────────────────────────────────────

export type TranslationFunction = (key: string) => string;

export interface I18nContextValue {
  lang: string;
  setLang: (lang: string) => void;
  t: TranslationFunction;
  availableLanguages: string[];
}

// ── Theme ─────────────────────────────────────────────────────

export type Theme = 'dark' | 'light';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}
