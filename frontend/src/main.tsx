import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import '@fontsource/be-vietnam-pro/900.css';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { AuthProvider } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { PublicBusinessLocationProvider } from './context/PublicBusinessLocationContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';
import { setupPwa } from './lib/pwa';
import App from './App';
import { ThemeModeProvider, useThemeMode } from './context/ThemeModeContext';
import { createAntTheme } from './theme/antTheme';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ApplicationProviders() {
  const { mode } = useThemeMode();

  return (
    <ConfigProvider locale={viVN} theme={createAntTheme(mode)} componentSize="middle">
      <AntApp>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <PublicBusinessLocationProvider>
                <BrandingProvider>
                  <SocketProvider>
                    <ToastProvider>
                      <App />
                    </ToastProvider>
                  </SocketProvider>
                </BrandingProvider>
              </PublicBusinessLocationProvider>
            </AuthProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <ApplicationProviders />
    </ThemeModeProvider>
  </React.StrictMode>
);

setupPwa();
