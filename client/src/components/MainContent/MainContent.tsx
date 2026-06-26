import React from "react";
import { useTranslation } from "../../i18n";
import EditableText from "../EditableText";
import SocialLinkEditor from "./SocialLinkEditor";
import { useAppState } from "../../contexts/AppStateContext";
import type {
  CVData,
  CVSettings,
  VisibleSections,
  Experience,
  Education,
  CustomSection,
  CustomSectionItem,
} from "../../types";

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface MainContentProps {
  data?: CVData;
  updateField?: (field: string, value: unknown) => void;
  updateArrayItem?: (
    arrayName: string,
    id: string | number,
    key: string,
    value: unknown,
  ) => void;
  deleteArrayItem?: (arrayName: string, id: string | number) => void;
  addArrayItem?: (arrayName: string, item: Record<string, unknown>) => void;
  settings?: CVSettings;
  visibleSections?: VisibleSections;
  showHeader?: boolean;
  headerOnly?: boolean;
  pageIndex?: number;
}

const MainContent = ({
  data,
  updateField,
  updateArrayItem,
  deleteArrayItem,
  addArrayItem,
  settings,
  visibleSections,
  showHeader = true,
  headerOnly = false,
}: MainContentProps) => {
  const { t } = useTranslation();
  const appState = useAppState();

  const _data = data ?? appState.data;
  // Defensive: ensure experience and education are arrays
  const experienceArr = Array.isArray(_data.experience) ? _data.experience : [];
  const educationArr = Array.isArray(_data.education) ? _data.education : [];
  const _settings = settings ?? appState.settings;
  const _visibleSections = visibleSections ?? appState.visibleSections;
  const _updateField =
    updateField ??
    ((field: string, value: unknown) =>
      appState.setData((prev) => {
        if (field.includes(".")) {
          const [parent, child] = field.split(".");
          return {
            ...prev,
            [parent]: {
              ...(prev as unknown as Record<string, Record<string, unknown>>)[
                parent
              ],
              [child]: value,
            },
          };
        }
        return { ...prev, [field]: value };
      }));
  const _updateArrayItem =
    updateArrayItem ??
    ((arrayName: string, id: string | number, key: string, value: unknown) =>
      appState.setData((prev) => ({
        ...prev,
        [arrayName]: (
          (prev as unknown as Record<string, unknown>)[arrayName] as Array<
            Record<string, unknown>
          >
        ).map((item: Record<string, unknown>) =>
          item.id === id ? { ...item, [key]: value } : item,
        ),
      })));
  const _deleteArrayItem =
    deleteArrayItem ??
    ((arrayName: string, id: string | number) =>
      appState.setData((prev) => ({
        ...prev,
        [arrayName]: (
          (prev as unknown as Record<string, unknown>)[arrayName] as Array<
            Record<string, unknown>
          >
        ).filter((item: Record<string, unknown>) => item.id !== id),
      })));
  const _addArrayItem =
    addArrayItem ??
    ((arrayName: string, item: Record<string, unknown>) =>
      appState.setData((prev) => ({
        ...prev,
        [arrayName]: [
          ...((prev as unknown as Record<string, unknown>)[arrayName] as Array<
            Record<string, unknown>
          >),
          { ...item, id: Date.now() },
        ],
      })));

  const isCoursesSection = (section: CustomSection) => {
    const normalizedTitle = (section?.title || "").trim().toLowerCase();
    return (
      section?.type === "courses" ||
      normalizedTitle === "courses" ||
      normalizedTitle === "kurse"
    );
  };

  const getCustomSectionTitle = (section: CustomSection) =>
    isCoursesSection(section)
      ? t("sections.courses")
      : section.title || section.name || "";

  return (
    <div className="main-content">
      {/* Header */}
      {showHeader && (
        <div className="header">
          <EditableText
            value={_data.name}
            onChange={(val) => _updateField("name", val)}
            tag="h1"
            placeholder={t("placeholders.name")}
          />
          <EditableText
            value={_data.position}
            onChange={(val) => _updateField("position", val)}
            tag="p"
            style={{ color: _settings.accentColor }}
            placeholder={t("placeholders.position")}
          />
          <div className="contact-info">
            <span className="contact-item">
              <i className="fas fa-phone"></i>
              <EditableText
                value={_data.contact.phone}
                onChange={(val) => _updateField("contact.phone", val)}
                placeholder={t("placeholders.phone")}
              />
            </span>
            <span className="contact-item">
              <i className="fas fa-envelope"></i>
              <EditableText
                value={_data.contact.email}
                onChange={(val) => _updateField("contact.email", val)}
                placeholder={t("placeholders.email")}
              />
            </span>
            <span className="contact-item">
              <i className="fas fa-map-marker-alt"></i>
              <EditableText
                value={_data.contact.location}
                onChange={(val) => _updateField("contact.location", val)}
                placeholder={t("placeholders.location")}
              />
            </span>
            {(_data.contact.links || []).map((link) => {
              return (
                <SocialLinkEditor
                  key={link.id}
                  icon={link.icon || "fas fa-globe"}
                  url={link.url}
                  onIconChange={(cls) =>
                    appState.setData((prev) => ({
                      ...prev,
                      contact: {
                        ...prev.contact,
                        links: (prev.contact.links || []).map((l) =>
                          l.id === link.id ? { ...l, icon: cls } : l,
                        ),
                      },
                    }))
                  }
                  onUrlChange={(val) =>
                    appState.setData((prev) => ({
                      ...prev,
                      contact: {
                        ...prev.contact,
                        links: (prev.contact.links || []).map((l) =>
                          l.id === link.id ? { ...l, url: val } : l,
                        ),
                      },
                    }))
                  }
                  onDelete={() =>
                    appState.setData((prev) => ({
                      ...prev,
                      contact: {
                        ...prev.contact,
                        links: (prev.contact.links || []).filter(
                          (l) => l.id !== link.id,
                        ),
                      },
                    }))
                  }
                  t={t}
                />
              );
            })}
            <button
              type="button"
              className="add-link-btn hide-on-print"
              title={t("placeholders.addLink") || "Add link"}
              aria-label={t("placeholders.addLink") || "Add link"}
              onClick={() =>
                appState.setData((prev) => ({
                  ...prev,
                  contact: {
                    ...prev.contact,
                    links: [
                      ...(prev.contact.links || []),
                      { id: createId(), icon: "fas fa-globe", url: "" },
                    ],
                  },
                }))
              }
            >
              <i className="fas fa-plus" />
            </button>
          </div>
        </div>
      )}

      {!headerOnly && (
        <>
          {/* Experience Section */}
          {_visibleSections.experience && (
            <div className="section">
              <h2 className="section-title">{t("sections.experience")}</h2>
              {experienceArr.map((exp: Experience) => (
                <div key={exp.id} className="experience-item">
                  <div className="experience-header">
                    <div className="experience-top">
                      <EditableText
                        value={exp.title}
                        onChange={(val) =>
                          _updateArrayItem("experience", exp.id, "title", val)
                        }
                        tag="h3"
                        style={{ color: _settings.accentColor }}
                        placeholder={t("placeholders.title")}
                      />
                      <EditableText
                        value={exp.period}
                        onChange={(val) =>
                          _updateArrayItem("experience", exp.id, "period", val)
                        }
                        tag="span"
                        className="text-muted-inline"
                        placeholder={t("placeholders.period")}
                      />
                    </div>

                    <div className="experience-bottom">
                      <EditableText
                        value={exp.company}
                        onChange={(val) =>
                          _updateArrayItem("experience", exp.id, "company", val)
                        }
                        tag="p"
                        className="experience-subtitle"
                        style={{ color: _settings.accentColor }}
                        placeholder={t("placeholders.company")}
                      />
                      <EditableText
                        value={exp.location || ""}
                        onChange={(val) =>
                          _updateArrayItem(
                            "experience",
                            exp.id,
                            "location",
                            val,
                          )
                        }
                        tag="span"
                        className="text-muted-inline"
                        placeholder={t("placeholders.location")}
                      />
                    </div>
                  </div>
                  <div className="experience-description">
                    <EditableText
                      value={exp.description || ""}
                      onChange={(val) =>
                        _updateArrayItem(
                          "experience",
                          exp.id,
                          "description",
                          val,
                        )
                      }
                      tag="p"
                      placeholder={t("placeholders.description")}
                    />
                  </div>
                  <button
                    className="delete-btn"
                    onClick={() => _deleteArrayItem("experience", exp.id)}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M1 1L9 9M9 1L1 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                className="add-btn"
                onClick={() =>
                  _addArrayItem("experience", {
                    title: "",
                    company: "",
                    period: "",
                    location: "",
                    description: "",
                    achievements: [],
                  })
                }
              >
                <i className="fas fa-plus"></i> {t("buttons.add")}{" "}
                {t("sections.experience")}
              </button>
            </div>
          )}

          {/* Education Section */}
          {_visibleSections.education && (
            <div className="section education-section">
              <h2 className="section-title">{t("sections.education")}</h2>
              {educationArr.map((edu: Education) => (
                <div key={edu.id} className="experience-item education-degree">
                  <div className="experience-header">
                    <div className="experience-top">
                      <EditableText
                        value={edu.degree}
                        onChange={(val) =>
                          _updateArrayItem("education", edu.id, "degree", val)
                        }
                        tag="h3"
                        style={{ color: _settings.accentColor }}
                        placeholder={t("placeholders.degree")}
                      />
                      <EditableText
                        value={edu.period}
                        onChange={(val) =>
                          _updateArrayItem("education", edu.id, "period", val)
                        }
                        tag="span"
                        className="text-muted-inline"
                        placeholder={t("placeholders.period")}
                      />
                    </div>
                    <div className="experience-bottom">
                      <EditableText
                        value={edu.school}
                        onChange={(val) =>
                          _updateArrayItem("education", edu.id, "school", val)
                        }
                        tag="p"
                        className="experience-subtitle"
                        style={{ color: _settings.accentColor }}
                        placeholder={t("placeholders.school")}
                      />
                      <EditableText
                        value={edu.location || ""}
                        onChange={(val) =>
                          _updateArrayItem("education", edu.id, "location", val)
                        }
                        tag="span"
                        className="text-muted-inline"
                        placeholder={t("placeholders.location")}
                      />
                    </div>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={() => _deleteArrayItem("education", edu.id)}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M1 1L9 9M9 1L1 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                className="add-btn"
                onClick={() =>
                  _addArrayItem("education", {
                    type: "education",
                    degree: "",
                    school: "",
                    period: "",
                    location: "",
                    description: "",
                  })
                }
              >
                <i className="fas fa-plus"></i> {t("education.addEducation")}
              </button>
            </div>
          )}

          {/* Custom Sections (main position) */}
          {(_data.customSections || [])
            .filter((s: CustomSection) => s.position === "main")
            .map(
              (section: CustomSection) =>
                _visibleSections[section.id] !== false && (
                  <div className="section" key={section.id}>
                    <div className="section-title-row">
                      {isCoursesSection(section) ? (
                        <h2 className="section-title">
                          {getCustomSectionTitle(section)}
                        </h2>
                      ) : (
                        <EditableText
                          value={getCustomSectionTitle(section)}
                          onChange={(val) => {
                            const updated = (_data.customSections || []).map(
                              (s: CustomSection) =>
                                s.id === section.id ? { ...s, title: val } : s,
                            );
                            _updateField("customSections", updated);
                          }}
                          tag="h2"
                          className="section-title"
                          placeholder={t("placeholders.sectionTitle")}
                        />
                      )}
                      <button
                        className="delete-section-btn"
                        title={t("buttons.deleteSection") || "Delete section"}
                        onClick={() =>
                          appState?.removeCustomSection &&
                          appState.removeCustomSection(section.id)
                        }
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M1 1L9 9M9 1L1 9"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                    {section.items.map((item: CustomSectionItem) => (
                      <div key={item.id} className="experience-item">
                        {(() => {
                          const coursesSection = isCoursesSection(section);
                          return (
                            <>
                              <div className="experience-header">
                                <div className="experience-top">
                                  <EditableText
                                    value={item.title || ""}
                                    onChange={(val) => {
                                      const updated = (
                                        _data.customSections || []
                                      ).map((s) =>
                                        s.id === section.id
                                          ? {
                                              ...s,
                                              items: s.items.map((i) =>
                                                i.id === item.id
                                                  ? { ...i, title: val }
                                                  : i,
                                              ),
                                            }
                                          : s,
                                      );
                                      _updateField("customSections", updated);
                                    }}
                                    tag="h3"
                                    style={{ color: _settings.accentColor }}
                                    placeholder={
                                      coursesSection
                                        ? t("placeholders.itemTitle")
                                        : t("placeholders.itemTitle")
                                    }
                                  />
                                  {item.period && (
                                    <EditableText
                                      value={item.period}
                                      onChange={(val) => {
                                        const updated = (
                                          _data.customSections || []
                                        ).map((s) =>
                                          s.id === section.id
                                            ? {
                                                ...s,
                                                items: s.items.map((i) =>
                                                  i.id === item.id
                                                    ? { ...i, period: val }
                                                    : i,
                                                ),
                                              }
                                            : s,
                                        );
                                        _updateField("customSections", updated);
                                      }}
                                      tag="span"
                                      className="text-muted-inline"
                                      placeholder={t("placeholders.period")}
                                    />
                                  )}
                                </div>

                                {item.subtitle !== undefined && (
                                  <div className="experience-bottom">
                                    <EditableText
                                      value={item.subtitle}
                                      onChange={(val) => {
                                        const updated = (
                                          _data.customSections || []
                                        ).map((s) =>
                                          s.id === section.id
                                            ? {
                                                ...s,
                                                items: s.items.map((i) =>
                                                  i.id === item.id
                                                    ? { ...i, subtitle: val }
                                                    : i,
                                                ),
                                              }
                                            : s,
                                        );
                                        _updateField("customSections", updated);
                                      }}
                                      tag="p"
                                      className="experience-subtitle"
                                      style={{ color: _settings.accentColor }}
                                      placeholder={
                                        coursesSection
                                          ? t("placeholders.institution")
                                          : t("placeholders.itemDescription")
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                              {item.description && (
                                <div className="experience-description">
                                  <EditableText
                                    value={item.description}
                                    onChange={(val) => {
                                      const updated = (
                                        _data.customSections || []
                                      ).map((s) =>
                                        s.id === section.id
                                          ? {
                                              ...s,
                                              items: s.items.map((i) =>
                                                i.id === item.id
                                                  ? { ...i, description: val }
                                                  : i,
                                              ),
                                            }
                                          : s,
                                      );
                                      _updateField("customSections", updated);
                                    }}
                                    tag="p"
                                    placeholder={t("placeholders.description")}
                                  />
                                </div>
                              )}
                            </>
                          );
                        })()}
                        <button
                          className="delete-btn"
                          onClick={() => {
                            const updated = (_data.customSections || []).map(
                              (s) =>
                                s.id === section.id
                                  ? {
                                      ...s,
                                      items: s.items.filter(
                                        (i) => i.id !== item.id,
                                      ),
                                    }
                                  : s,
                            );
                            _updateField("customSections", updated);
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M1 1L9 9M9 1L1 9"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      className="add-btn"
                      onClick={() => {
                        const updated = (_data.customSections || []).map((s) =>
                          s.id === section.id
                            ? {
                                ...s,
                                items: [
                                  ...s.items,
                                  {
                                    id: Date.now(),
                                    title: "",
                                    subtitle: "",
                                    period: "",
                                    description: "",
                                  },
                                ],
                              }
                            : s,
                        );
                        _updateField("customSections", updated);
                      }}
                    >
                      <i className="fas fa-plus"></i> {t("buttons.addItem")}
                    </button>
                  </div>
                ),
            )}
        </>
      )}
    </div>
  );
};

export default MainContent;
