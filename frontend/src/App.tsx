import React, { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { mockProducts } from './data';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const UnderReviewPage = lazy(() => import('./pages/UnderReviewPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'register' | 'under-review' | 'login' | 'dashboard'>(() => {
    const path = window.location.pathname;
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
    return 'landing';
  });
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('reviewer_session_username') || '';
  });
  const [email, setEmail] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state to URL path
  React.useEffect(() => {
    const path = window.location.pathname;
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
      const path = window.location.pathname;
      const isLoggedIn = !!localStorage.getItem('reviewer_session_username');

      if (path === '/login') setCurrentView('login');
      else if (path === '/register') setCurrentView('register');
      else if (path === '/under-review') setCurrentView('under-review');
      else if (path === '/dashboard') {
        setCurrentView(isLoggedIn ? 'dashboard' : 'login');
      } else {
        setCurrentView('landing');
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
    setCurrentView('under-review');
  };

  const handleLoginSuccess = (loginUser: string) => {
    const finalUser = loginUser || username;
    setUsername(finalUser);
    localStorage.setItem('reviewer_session_view', 'dashboard');
    localStorage.setItem('reviewer_session_username', finalUser);
    showToast(`Welcome back, ${finalUser}! Your secure paid reviewer session is active.`);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('reviewer_session_view');
    localStorage.removeItem('reviewer_session_username');
    showToast("Successfully signed out of your reviewer workspace.");
    setCurrentView('landing');
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
              onNavigateToLogin={() => setCurrentView('login')}
              onNavigateToRegister={() => setCurrentView('register')}
              showToast={showToast}
            />
          )}

          {currentView === 'register' && (
            <RegisterPage
              onRegisterSuccess={handleRegisterSuccess}
              onNavigateToLogin={() => setCurrentView('login')}
              onNavigateHome={() => setCurrentView('landing')}
            />
          )}

          {currentView === 'under-review' && (
            <UnderReviewPage
              username={username}
              onNavigateHome={() => setCurrentView('landing')}
              onNavigateToLogin={() => setCurrentView('login')}
            />
          )}

          {currentView === 'login' && (
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              onNavigateToRegister={() => setCurrentView('register')}
              onNavigateHome={() => setCurrentView('landing')}
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
