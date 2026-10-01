import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { AuthProvider } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';
import { setupPwa } from './lib/pwa';
import App from './App';
import { antTheme } from './theme/antTheme';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={viVN} theme={antTheme} componentSize="middle">
      <AntApp>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <BrandingProvider>
                <SocketProvider>
                  <ToastProvider>
                    <App />
                  </ToastProvider>
                </SocketProvider>
              </BrandingProvider>
            </AuthProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);

setupPwa();
