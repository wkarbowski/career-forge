import { useMemo } from "react";
import type { CVData } from "../../../types";

export function useResumeText(data: CVData): string {
  return useMemo(() => {
    const parts = [];
    if (data?.name) parts.push(data.name);
    if (data?.position) parts.push(data.position);
    if (data.summary) parts.push(data.summary);
    (data.experience || []).forEach((e) => {
      if (e.title) parts.push(e.title);
      if (e.company) parts.push(e.company);
      if (e.description) parts.push(e.description);
    });
    (data.education || []).forEach((e) => {
      if (e.degree) parts.push(e.degree);
      if (e.school) parts.push(e.school);
      if (e.description) parts.push(e.description);
    });
    (data.skills || []).forEach((s) => {
      if (s.name) parts.push(s.name);
    });
    (data.languages || []).forEach((l) => {
      if (l.name) parts.push(l.name);
    });
    (data.coreCompetencies || []).forEach((c) => {
      if (c.name) parts.push(c.name);
    });
    (data.achievements || []).forEach((a) => {
      if (a.title) parts.push(a.title);
      if (a.description) parts.push(a.description);
    });
    return parts.join(" ");
  }, [data]);
}
