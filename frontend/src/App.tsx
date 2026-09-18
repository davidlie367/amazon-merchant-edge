import React, { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { mockProducts } from './data';
import { API_BASE } from './config';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const UnderReviewPage = lazy(() => import('./pages/UnderReviewPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

const normalizePath = (rawPath: string) => {
  const p = rawPath.trim();
  if (p.length > 1 && p.endsWith('/')) {
    return p.slice(0, -1);
  }
  return p;
};

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'register' | 'under-review' | 'login' | 'dashboard'>(() => {
    const path = normalizePath(window.location.pathname);
    const isLoggedIn = !!localStorage.getItem('reviewer_session_username');

    if (path === '/login') return 'login';
    if (path === '/register') return 'register';
    if (path === '/under-review') return 'under-review';
    if (path === '/dashboard') {
      return isLoggedIn ? 'dashboard' : 'login';
    }

    const savedView = localStorage.getItem('reviewer_session_view');
    if (savedView === 'dashboard' && isLoggedIn) {
      return 'dashboard';
    }
    if (savedView === 'login') return 'login';
    if (savedView === 'register') return 'register';
    if (savedView === 'under-review') return 'under-review';

    return 'landing';
  });
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('reviewer_session_username') || '';
  });
  const [email, setEmail] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Warm up backend on initial load to prevent Render cold-start connection errors
  React.useEffect(() => {
    fetch(`${API_BASE}/health`).catch(() => {
      // Silent catch - warm-up ping only
    });
  }, []);

  const navigateToView = (view: 'landing' | 'register' | 'under-review' | 'login' | 'dashboard') => {
    if (view === 'landing') {
      localStorage.removeItem('reviewer_session_view');
    } else {
      localStorage.setItem('reviewer_session_view', view);
    }
    setCurrentView(view);
  };

  // Sync state to URL path
  React.useEffect(() => {
    const path = normalizePath(window.location.pathname);
    if (path.startsWith('/admin') || path.startsWith('/super-admin')) {
      return;
    }
    let targetPath = '/';
    if (currentView === 'login') targetPath = '/login';
    else if (currentView === 'register') targetPath = '/register';
    else if (currentView === 'under-review') targetPath = '/under-review';
    else if (currentView === 'dashboard') targetPath = '/dashboard';

    if (path !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }, [currentView]);

  // Handle browser back/forward buttons
  React.useEffect(() => {
    const handlePopState = () => {
      const path = normalizePath(window.location.pathname);
      const isLoggedIn = !!localStorage.getItem('reviewer_session_username');

      if (path === '/login') navigateToView('login');
      else if (path === '/register') navigateToView('register');
      else if (path === '/under-review') navigateToView('under-review');
      else if (path === '/dashboard') {
        navigateToView(isLoggedIn ? 'dashboard' : 'login');
      } else {
        const savedView = localStorage.getItem('reviewer_session_view');
        if (savedView === 'dashboard' && isLoggedIn) {
          navigateToView('dashboard');
        } else {
          navigateToView('landing');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRegisterSuccess = (registeredUser: string, registeredEmail: string) => {
    setUsername(registeredUser);
    setEmail(registeredEmail);
    localStorage.setItem('reviewer_session_username', registeredUser);
    showToast("Registration successful! Transferring profile to our compliance review queue.");
    navigateToView('under-review');
  };

  const handleLoginSuccess = (loginUser: string) => {
    const finalUser = loginUser || username;
    setUsername(finalUser);
    localStorage.setItem('reviewer_session_username', finalUser);
    showToast(`Welcome back, ${finalUser}! Your secure paid reviewer session is active.`);
    navigateToView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('reviewer_session_view');
    localStorage.removeItem('reviewer_session_username');
    localStorage.removeItem('reviewer_auth_token');
    showToast("Successfully signed out of your reviewer workspace.");
    navigateToView('landing');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between font-sans relative">
      
      {/* Universal Floating Toast Alerts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm bg-[#131921] text-white p-4 rounded-lg shadow-2xl flex items-start space-x-3 border border-amazon-gold/50 text-left"
          >
            <div className="p-1 bg-amazon-gold text-amazon-dark rounded-full flex-shrink-0 font-extrabold text-xs mt-0.5">
              ✓
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold tracking-wide">Panel Notification</p>
              <p className="text-[11px] text-gray-300 mt-0.5 leading-relaxed">{toastMessage}</p>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-white transition">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main View Router */}
      <div className="flex-1">
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] text-gray-500 font-bold text-xs tracking-wider uppercase font-mono">
            Loading secure reviewer terminal...
          </div>
        }>
          {currentView === 'landing' && (
            <LandingPage
              onNavigateToLogin={() => navigateToView('login')}
              onNavigateToRegister={() => navigateToView('register')}
              showToast={showToast}
            />
          )}

          {currentView === 'register' && (
            <RegisterPage
              onRegisterSuccess={handleRegisterSuccess}
              onNavigateToLogin={() => navigateToView('login')}
              onNavigateHome={() => navigateToView('landing')}
            />
          )}

          {currentView === 'under-review' && (
            <UnderReviewPage
              username={username}
              onNavigateHome={() => navigateToView('landing')}
              onNavigateToLogin={() => navigateToView('login')}
            />
          )}

          {currentView === 'login' && (
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              onNavigateToRegister={() => navigateToView('register')}
              onNavigateHome={() => navigateToView('landing')}
              defaultUsername={username}
            />
          )}

          {currentView === 'dashboard' && (
            <DashboardPage
              username={username}
              products={mockProducts}
              onLogout={handleLogout}
              showToast={showToast}
            />
          )}
        </Suspense>
      </div>

    </div>
  );
}
