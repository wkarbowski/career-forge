import React from "react";
import { useTranslation } from "../../i18n";
import EditableText from "../EditableText";
import LanguageLevel from "../LanguageLevel";
import { useAppState } from "../../contexts/AppStateContext";
import { initialData } from "../../data/initialData";
import type {
  CVData,
  VisibleSections,
  CoreCompetency,
  Language,
  Skill,
  Achievement,
  Project,
  CustomSection,
  CustomSectionItem,
} from "../../types";

interface SidebarProps {
  data?: CVData;
  updateField?: (field: string, value: unknown) => void;
  updateArrayItem?: (
    arrayName: string,
    id: number | string,
    key: string,
    value: unknown,
  ) => void;
  deleteArrayItem?: (arrayName: string, id: number | string) => void;
  addArrayItem?: (arrayName: string, item: Record<string, unknown>) => void;
  visibleSections?: VisibleSections;
  profileImage?: string | null;
  onImageUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove?: () => void;
  sidebarOrder?: string[];
  onMoveSectionUp?: (name: string) => void;
  onMoveSectionDown?: (name: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  data,
  updateField,
  updateArrayItem,
  deleteArrayItem,
  addArrayItem,
  visibleSections,
  profileImage,
  onImageUpload,
  onImageRemove,
  sidebarOrder,
  onMoveSectionUp,
  onMoveSectionDown,
}) => {
  const { t } = useTranslation();
  const appState = useAppState();

  const fallbackSettings = {
    sidebarColor1: "#312e81",
    sidebarColor2: "#4f46e5",
    accentColor: "#6366f1",
  };

  const fallbackVisible = {
    summary: true,
    coreCompetencies: true,
    languages: true,
    skills: true,
    achievements: true,
    experience: true,
    education: true,
  };

  const fallbackOrder = [
    "summary",
    "skills",
    "languages",
    "coreCompetencies",
    "achievements",
  ];

  const safeApp = appState ?? {
    data: initialData,
    settings: fallbackSettings,
    visibleSections: fallbackVisible,
    sidebarOrder: fallbackOrder,
    setData: () => {},
    setSidebarOrder: () => {},
    setProfileImage: () => {},
  };

  const _data = data ?? safeApp.data;
  const _visibleSections = visibleSections ?? safeApp.visibleSections;
  const _sidebarOrder = sidebarOrder ?? safeApp.sidebarOrder;
  const sidebarSectionOrder = _sidebarOrder.includes("projects")
    ? _sidebarOrder
    : [..._sidebarOrder, "projects"];

  const _updateField =
    updateField ??
    ((field: string, value: unknown) =>
      safeApp.setData((prev) => ({ ...prev, [field]: value })));
  const _updateArrayItem =
    updateArrayItem ??
    ((arrayName: string, id: number | string, key: string, value: unknown) =>
      safeApp.setData((prev) => {
        const arr =
          (prev as unknown as Record<string, unknown[]>)[arrayName] || [];
        return {
          ...prev,
          [arrayName]: arr.map((item: unknown) =>
            (item as Record<string, unknown>).id === id
              ? { ...(item as Record<string, unknown>), [key]: value }
              : item,
          ),
        };
      }));
  const _deleteArrayItem =
    deleteArrayItem ??
    ((arrayName: string, id: number | string) =>
      safeApp.setData((prev) => {
        const arr =
          (prev as unknown as Record<string, unknown[]>)[arrayName] || [];
        return {
          ...prev,
          [arrayName]: arr.filter(
            (item: unknown) => (item as Record<string, unknown>).id !== id,
          ),
        };
      }));
  const _addArrayItem =
    addArrayItem ??
    ((arrayName: string, item: Record<string, unknown>) =>
      safeApp.setData((prev) => {
        const arr =
          (prev as unknown as Record<string, unknown[]>)[arrayName] || [];
        return { ...prev, [arrayName]: [...arr, { ...item, id: Date.now() }] };
      }));
  const _onMoveSectionUp =
    onMoveSectionUp ??
    ((name: string) => {
      const idx = sidebarSectionOrder.indexOf(name);
      if (idx > 0) {
        const arr = [...sidebarSectionOrder];
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        safeApp.setSidebarOrder(arr);
      }
    });
  const _onMoveSectionDown =
    onMoveSectionDown ??
    ((name: string) => {
      const idx = sidebarSectionOrder.indexOf(name);
      if (idx >= 0 && idx < sidebarSectionOrder.length - 1) {
        const arr = [...sidebarSectionOrder];
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        safeApp.setSidebarOrder(arr);
      }
    });

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

  const sections: Record<string, React.ReactElement> = {
    summary: (
      <div className="sidebar-section" key="summary">
        <div className="section-header-with-controls">
          <h2>{t("sections.summary")}</h2>
          <div className="section-controls">
            <button
              onClick={() => _onMoveSectionUp("summary")}
              className="move-btn"
              title={t("buttons.moveUp")}
            >
              <i className="fas fa-arrow-up"></i>
            </button>
            <button
              onClick={() => _onMoveSectionDown("summary")}
              className="move-btn"
              title={t("buttons.moveDown")}
            >
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
        <EditableText
          value={_data.summary}
          onChange={(val) => _updateField("summary", val)}
          tag="p"
          style={{ lineHeight: "1.6", opacity: 0.95 }}
          placeholder={t("placeholders.summary")}
        />
      </div>
    ),
    coreCompetencies: (
      <div className="sidebar-section" key="coreCompetencies">
        <div className="section-header-with-controls">
          <h2>{t("sections.coreCompetencies")}</h2>
          <div className="section-controls">
            <button
              onClick={() => _onMoveSectionUp("coreCompetencies")}
              className="move-btn"
              title={t("buttons.moveUp")}
            >
              <i className="fas fa-arrow-up"></i>
            </button>
            <button
              onClick={() => _onMoveSectionDown("coreCompetencies")}
              className="move-btn"
              title={t("buttons.moveDown")}
            >
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
        <div className="competency-chips">
          {(_data.coreCompetencies || []).map((comp: CoreCompetency) => (
            <span key={comp.id} className="competency-chip">
              <EditableText
                value={comp.name}
                onChange={(val) =>
                  _updateArrayItem("coreCompetencies", comp.id, "name", val)
                }
                tag="span"
                placeholder={t("placeholders.competencyName")}
              />
              <button
                className="delete-btn chip-delete-btn"
                onClick={() => _deleteArrayItem("coreCompetencies", comp.id)}
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
            </span>
          ))}
        </div>
        <button
          className="add-btn"
          onClick={() =>
            _addArrayItem("coreCompetencies", {
              name: t("placeholders.competencyName"),
            })
          }
        >
          <i className="fas fa-plus"></i> {t("buttons.add")}{" "}
          {t("sections.coreCompetencies")}
        </button>
      </div>
    ),
    languages: (
      <div className="sidebar-section" key="languages">
        <div className="section-header-with-controls">
          <h2>{t("sections.languages")}</h2>
          <div className="section-controls">
            <button
              onClick={() => _onMoveSectionUp("languages")}
              className="move-btn"
              title={t("buttons.moveUp")}
            >
              <i className="fas fa-arrow-up"></i>
            </button>
            <button
              onClick={() => _onMoveSectionDown("languages")}
              className="move-btn"
              title={t("buttons.moveDown")}
            >
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
        {_data.languages.map((language: Language) => (
          <div key={language.id} className="sidebar-item language-item">
            <div className="sidebar-item-content" style={{ flex: 1 }}>
              <EditableText
                value={language.name}
                onChange={(val) =>
                  _updateArrayItem("languages", language.id, "name", val)
                }
                tag="h3"
                placeholder={t("placeholders.languageName")}
              />
            </div>
            <LanguageLevel
              level={language.level}
              onChange={(val) =>
                _updateArrayItem("languages", language.id, "level", val)
              }
            />
            <button
              className="delete-btn"
              onClick={() => _deleteArrayItem("languages", language.id)}
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
            _addArrayItem("languages", {
              name: t("placeholders.languageName"),
              level: null,
              proficiency: t("placeholders.proficiency"),
            })
          }
        >
          <i className="fas fa-plus"></i> {t("buttons.add")}{" "}
          {t("sections.languages")}
        </button>
      </div>
    ),
    skills: (
      <div className="sidebar-section" key="skills">
        <div className="section-header-with-controls">
          <h2>{t("sections.skills")}</h2>
          <div className="section-controls">
            <button
              onClick={() => _onMoveSectionUp("skills")}
              className="move-btn"
              title={t("buttons.moveUp")}
            >
              <i className="fas fa-arrow-up"></i>
            </button>
            <button
              onClick={() => _onMoveSectionDown("skills")}
              className="move-btn"
              title={t("buttons.moveDown")}
            >
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
        {_data.skills.map((skill: Skill) => (
          <div key={skill.id} className="sidebar-item">
            <div className="sidebar-item-content" style={{ flex: 1 }}>
              <EditableText
                value={skill.name}
                onChange={(val) =>
                  _updateArrayItem("skills", skill.id, "name", val)
                }
                tag="h3"
                placeholder={t("placeholders.skillName")}
              />
            </div>
            <button
              className="delete-btn"
              onClick={() => _deleteArrayItem("skills", skill.id)}
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
            _addArrayItem("skills", {
              name: t("placeholders.skillName"),
            })
          }
        >
          <i className="fas fa-plus"></i> {t("buttons.add")}{" "}
          {t("sections.skills")}
        </button>
      </div>
    ),
    achievements: (
      <div className="sidebar-section" key="achievements">
        <div className="section-header-with-controls">
          <h2>{t("sections.achievements")}</h2>
          <div className="section-controls">
            <button
              onClick={() => _onMoveSectionUp("achievements")}
              className="move-btn"
              title={t("buttons.moveUp")}
            >
              <i className="fas fa-arrow-up"></i>
            </button>
            <button
              onClick={() => _onMoveSectionDown("achievements")}
              className="move-btn"
              title={t("buttons.moveDown")}
            >
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
        {_data.achievements.map((achievement: Achievement) => (
          <div key={achievement.id} className="sidebar-item">
            <div className="sidebar-item-content" style={{ flex: 1 }}>
              <EditableText
                value={achievement.title}
                onChange={(val) =>
                  _updateArrayItem("achievements", achievement.id, "title", val)
                }
                tag="h3"
                placeholder={t("placeholders.achievementTitle")}
              />
              <EditableText
                value={achievement.description}
                onChange={(val) =>
                  _updateArrayItem(
                    "achievements",
                    achievement.id,
                    "description",
                    val,
                  )
                }
                tag="p"
                placeholder={t("placeholders.achievementDescription")}
              />
            </div>
            <button
              className="delete-btn"
              onClick={() => _deleteArrayItem("achievements", achievement.id)}
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
            _addArrayItem("achievements", {
              title: t("placeholders.achievementTitle"),
              description: t("placeholders.achievementDescription"),
            })
          }
        >
          <i className="fas fa-plus"></i> {t("buttons.add")}{" "}
          {t("sections.achievements")}
        </button>
      </div>
    ),
    projects: (
      <div className="sidebar-section" key="projects">
        <div className="section-header-with-controls">
          <h2>{t("sections.projects")}</h2>
          <div className="section-controls">
            <button
              onClick={() => _onMoveSectionUp("projects")}
              className="move-btn"
              title={t("buttons.moveUp")}
            >
              <i className="fas fa-arrow-up"></i>
            </button>
            <button
              onClick={() => _onMoveSectionDown("projects")}
              className="move-btn"
              title={t("buttons.moveDown")}
            >
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
        {(_data.projects || []).map((project: Project) => (
          <div key={project.id} className="sidebar-item">
            <div className="sidebar-item-content" style={{ flex: 1 }}>
              <EditableText
                value={project.name}
                onChange={(val) =>
                  _updateArrayItem("projects", project.id, "name", val)
                }
                tag="h3"
                placeholder={t("placeholders.projectName")}
              />
              <EditableText
                value={project.description}
                onChange={(val) =>
                  _updateArrayItem(
                    "projects",
                    project.id,
                    "description",
                    val,
                  )
                }
                tag="p"
                placeholder={t("placeholders.projectDescription")}
              />
            </div>
            <button
              className="delete-btn"
              onClick={() => _deleteArrayItem("projects", project.id)}
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
            _addArrayItem("projects", {
              name: "",
              description: "",
            })
          }
        >
          <i className="fas fa-plus"></i> {t("projects.addProject")}
        </button>
      </div>
    ),
  };

  // Add custom sections that belong in the sidebar
  const customSections = _data.customSections || [];
  customSections.forEach((section: CustomSection) => {
    if (section.position === "sidebar") {
      sections[section.id] = (
        <div className="sidebar-section" key={section.id}>
          <div className="section-header-with-controls">
            {isCoursesSection(section) ? (
              <h2>{getCustomSectionTitle(section)}</h2>
            ) : (
              <EditableText
                value={getCustomSectionTitle(section)}
                onChange={(val) => {
                  const updated = customSections.map((s: CustomSection) =>
                    s.id === section.id ? { ...s, title: val } : s,
                  );
                  _updateField("customSections", updated);
                }}
                tag="h2"
                placeholder={t("placeholders.sectionTitle")}
              />
            )}
            <div className="section-controls">
              <button
                onClick={() => _onMoveSectionUp(section.id)}
                className="move-btn"
                title={t("buttons.moveUp")}
              >
                <i className="fas fa-arrow-up"></i>
              </button>
              <button
                onClick={() => _onMoveSectionDown(section.id)}
                className="move-btn"
                title={t("buttons.moveDown")}
              >
                <i className="fas fa-arrow-down"></i>
              </button>
              <button
                className="delete-btn"
                title={t("buttons.deleteSection") || "Delete section"}
                onClick={() =>
                  safeApp.removeCustomSection &&
                  safeApp.removeCustomSection(section.id)
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
          </div>
          {section.items.map((item: CustomSectionItem) => (
            <div key={item.id} className="sidebar-item">
              <div className="sidebar-item-content" style={{ flex: 1 }}>
                {(() => {
                  const coursesSection = isCoursesSection(section);
                  return (
                    <>
                      <EditableText
                        value={item.title || ""}
                        onChange={(val) => {
                          const updated = customSections.map(
                            (s: CustomSection) =>
                              s.id === section.id
                                ? {
                                    ...s,
                                    items: s.items.map(
                                      (i: CustomSectionItem) =>
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
                        placeholder={
                          coursesSection
                            ? t("placeholders.itemTitle")
                            : t("placeholders.itemTitle")
                        }
                      />
                      <EditableText
                        value={item.description || ""}
                        onChange={(val) => {
                          const updated = customSections.map(
                            (s: CustomSection) =>
                              s.id === section.id
                                ? {
                                    ...s,
                                    items: s.items.map(
                                      (i: CustomSectionItem) =>
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
                        placeholder={
                          coursesSection
                            ? t("placeholders.institution")
                            : t("placeholders.itemDescription")
                        }
                      />
                    </>
                  );
                })()}
              </div>
              <button
                className="delete-btn"
                onClick={() => {
                  const updated = customSections.map((s: CustomSection) =>
                    s.id === section.id
                      ? {
                          ...s,
                          items: s.items.filter(
                            (i: CustomSectionItem) => i.id !== item.id,
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
              const updated = customSections.map((s: CustomSection) =>
                s.id === section.id
                  ? {
                      ...s,
                      items: [
                        ...s.items,
                        { id: Date.now(), title: "", description: "" },
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
      );
    }
  });

  return (
    <div className="sidebar">
      <div className="profile-image-container" style={{ position: "relative" }}>
        <label
          htmlFor="profile-upload"
          style={{ display: "block", cursor: "pointer", margin: 0 }}
        >
          <div
            className="profile-image"
            style={
              typeof profileImage === "string" && profileImage
                ? {
                    backgroundImage: `url(${profileImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {}
            }
          />
          <input
            id="profile-upload"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={onImageUpload}
            style={{ display: "none" }}
          />
        </label>
        {typeof profileImage === "string" && profileImage && (
          <button
            className="profile-image-remove-btn"
            onClick={onImageRemove}
            title={t("profile.remove")}
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
        )}
      </div>

      {sidebarSectionOrder
        .map(
          (sectionName: string) =>
            _visibleSections[sectionName] && sections[sectionName],
        )
        .filter(Boolean)}
    </div>
  );
};

export default Sidebar;
