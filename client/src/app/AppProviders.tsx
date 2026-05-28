import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { AppStateProvider } from "../contexts/AppStateContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { AuthProvider } from "../contexts/AuthContext";
import { PageProvider } from "../contexts/PageContext";
import { UndoProvider } from "../contexts/UndoContext";

interface AppProvidersProps {
  children: ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <PageProvider>
              <AuthProvider>
                <UndoProvider>{children}</UndoProvider>
              </AuthProvider>
            </PageProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
