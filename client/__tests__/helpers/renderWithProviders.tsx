import React, { type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../../src/i18n";
import { ThemeProvider } from "../../src/contexts/ThemeContext";

interface WrapperProps {
  children: ReactNode;
}

const AllProviders = ({ children }: WrapperProps) => (
  <MemoryRouter>
    <ThemeProvider>
      <I18nProvider defaultLang="en">{children}</I18nProvider>
    </ThemeProvider>
  </MemoryRouter>
);

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}
