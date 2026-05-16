import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { AppRouter } from './routes'
import { AuthProvider } from './context/AuthContext'
import { SearchProvider } from './context/SearchContext'
import { ToastProvider } from './context/ToastContext'
import { OfflineBanner } from './components/OfflineBanner'
import { ErrorBoundary } from './components/ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <OfflineBanner />
      <AuthProvider>
        <ToastProvider>
          <SearchProvider>
            <AppRouter />
          </SearchProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
