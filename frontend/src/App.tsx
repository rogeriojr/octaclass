import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { DeviceListView } from './pages/DeviceListView';
import { NotificationCenter, useNotifications } from './components/NotificationCenter';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { DeviceDetailView } from './pages/DeviceDetailView';
import { PoliciesView } from './pages/PoliciesView';
import { AnalyticsView } from './pages/AnalyticsView';
import { theme } from './styles/theme';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { socketService } from './services/socket.service';
import { Button } from './components/Button';
import { Shield, BarChart3, LogOut, Smartphone, Sun, Moon } from 'lucide-react';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background.primary,
        color: theme.colors.text.secondary
      }}>
        Carregando...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const SidebarItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  path: string;
  active?: boolean
}> = ({ icon, label, path, active }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(path)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing[3],
        padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
        borderRadius: theme.borderRadius.base,
        cursor: 'pointer',
        backgroundColor: active ? theme.colors.background.elevated : 'transparent',
        color: active ? theme.colors.primary[400] : theme.colors.text.secondary,
        transition: theme.transitions.fast,
        fontWeight: active ? theme.typography.fontWeight.medium : theme.typography.fontWeight.normal
      }}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
};

const ThemeToggle: React.FC = () => {
  const { theme: currentTheme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      style={{
        background: theme.colors.background.tertiary,
        border: `1px solid ${theme.colors.border.default}`,
        cursor: 'pointer',
        color: theme.colors.text.primary,
        display: 'flex',
        alignItems: 'center',
        padding: theme.spacing[2],
        borderRadius: theme.borderRadius.full,
        transition: theme.transitions.fast,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
      title={`Mudar para tema ${currentTheme === 'dark' ? 'claro' : 'escuro'}`}
    >
      {currentTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
};

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { signOut, user } = useAuth();
  const { notifications, addNotification, markAsRead, clearAll } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    return () => {};
  }, []);

  React.useEffect(() => {
    const socket = socketService.getSocket();
    const onBlockedAttempt = (data: { deviceId: string; deviceName?: string; url?: string }) => {
      addNotification({
        type: 'warning',
        title: 'Site bloqueado',
        message: `${data.deviceName || data.deviceId} tentou acessar um site bloqueado.`,
        deviceId: data.deviceId
      });
      navigate(`/devices/${data.deviceId}`);
    };
    socket.on('BLOCKED_SITE_ATTEMPT', onBlockedAttempt);
    return () => { socket.off('BLOCKED_SITE_ATTEMPT', onBlockedAttempt); };
  }, [addNotification, navigate]);

  React.useEffect(() => {
    const unsub = socketService.onDeviceActivity((payload) => {
      const name = payload.deviceName || payload.deviceId;
      let title = name;
      let message = '';
      try {
        const details = payload.details ? (typeof payload.details === 'string' ? JSON.parse(payload.details) : payload.details) : {};
        switch (payload.action) {
          case 'BLOCKED_SITE':
            title = `Site bloqueado — ${name}`;
            message = details.url ? `Tentativa de acesso: ${details.url}` : 'Acesso a site bloqueado.';
            break;
          case 'SCREENSHOT_CAPTURED':
            title = `Captura — ${name}`;
            message = details.url ? `URL: ${details.url}` : 'Captura de tela enviada.';
            break;
          case 'SCREEN_LOCKED':
            title = `Tela bloqueada — ${name}`;
            message = 'Dispositivo bloqueado pelo painel.';
            break;
          case 'SCREEN_UNLOCKED':
            title = `Tela desbloqueada — ${name}`;
            message = 'Dispositivo desbloqueado.';
            break;
          case 'URL_OPENED':
            title = `URL aberta — ${name}`;
            message = details.url ? details.url : 'Nova aba aberta.';
            break;
          case 'BRIGHTNESS_SET':
          case 'VOLUME_SET':
          case 'APP_LAUNCHED':
          case 'CAMERA_LAUNCHED':
          case 'CALCULATOR_LAUNCHED':
            const labels: Record<string, string> = {
              BRIGHTNESS_SET: 'Brilho alterado',
              VOLUME_SET: 'Volume alterado',
              APP_LAUNCHED: details.packageName ? `App: ${details.packageName}` : 'App aberto',
              CAMERA_LAUNCHED: 'Câmera aberta',
              CALCULATOR_LAUNCHED: 'Calculadora aberta'
            };
            title = `${labels[payload.action] || payload.action} — ${name}`;
            message = '';
            break;
          default:
            title = `${payload.action} — ${name}`;
            message = payload.details ? String(payload.details).slice(0, 80) : '';
        }
      } catch {
        title = `${payload.action} — ${name}`;
        message = '';
      }
      addNotification({
        type: payload.action === 'BLOCKED_SITE' ? 'warning' : 'info',
        title,
        message: message || 'Evento em tempo real.',
        deviceId: payload.deviceId
      });
    });
    return () => { unsub(); };
  }, [addNotification]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: theme.colors.background.primary,
      backgroundImage: `
        radial-gradient(at 0% 0%, var(--color-primary-900) 0px, transparent 50%),
        radial-gradient(at 100% 0%, var(--color-secondary-900) 0px, transparent 50%),
        radial-gradient(at 100% 100%, var(--color-primary-900) 0px, transparent 50%),
        radial-gradient(at 0% 100%, var(--color-secondary-900) 0px, transparent 50%)
      `,
      backgroundAttachment: 'fixed',
      opacity: 0.95
    }}>
      <aside style={{
        width: '260px',
        backgroundColor: theme.colors.background.secondary,
        borderRight: `1px solid ${theme.colors.border.default}`,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: theme.spacing[6],
          borderBottom: `1px solid ${theme.colors.border.subtle}`
        }}>
          <div style={{
            fontSize: theme.typography.fontSize.xl,
            fontWeight: 'bold',
            background: `linear-gradient(to right, ${theme.colors.primary[400]}, ${theme.colors.secondary[400]})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px'
          }}>
            Octoclass
          </div>
          <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.tertiary, marginTop: theme.spacing[1] }}>
            Enterprise MDM
          </div>
        </div>

        <nav style={{ flex: 1, padding: theme.spacing[4], display: 'flex', flexDirection: 'column', gap: theme.spacing[1] }}>
          <SidebarItem
            icon={<Smartphone size={20} />}
            label="Dispositivos"
            path="/devices"
            active={location.pathname.startsWith('/devices')}
          />
          <SidebarItem
            icon={<Shield size={20} />}
            label="Políticas"
            path="/policies"
            active={location.pathname.startsWith('/policies')}
          />
          <SidebarItem
            icon={<BarChart3 size={20} />}
            label="Analíticos"
            path="/analytics"
            active={location.pathname.startsWith('/analytics')}
          />
        </nav>

        <div style={{ padding: theme.spacing[4], borderTop: `1px solid ${theme.colors.border.subtle}` }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
            padding: theme.spacing[3],
            backgroundColor: theme.colors.background.tertiary,
            borderRadius: theme.borderRadius.base,
            marginBottom: theme.spacing[4]
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: theme.colors.primary[900],
              color: theme.colors.primary[400],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: theme.typography.fontSize.xs
            }}>
              {user?.email?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Admin
              </div>
              <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.tertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            fullWidth
            onClick={handleSignOut}
            style={{ justifyContent: 'flex-start', color: theme.colors.danger[400] }}
          >
            <LogOut size={16} style={{ marginRight: theme.spacing[2] }} />
            Sair do Sistema
          </Button>
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          height: '72px',
          borderBottom: `1px solid ${theme.colors.border.default}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${theme.spacing[8]}`,
          backgroundColor: theme.colors.background.primary
        }}>
          <h2 style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.medium }}>
            {location.pathname === '/devices' ? 'Gerenciamento de Dispositivos' :
              location.pathname.startsWith('/devices/') ? 'Detalhes do Dispositivo' :
                location.pathname === '/policies' ? 'Políticas de Segurança' : 'Painel Administrativo'}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[4] }}>
            <ThemeToggle />
            <NotificationCenter
              notifications={notifications}
              onMarkAsRead={markAsRead}
              onClearAll={clearAll}
            />
            <button
              onClick={async () => {
                if (confirm('Resetar e popular banco de dados com dados de demonstração?')) {
                  const { seedDatabase } = await import('./services/seeder');
                  await seedDatabase();
                  window.location.reload();
                }
              }}
              title="Popular Dados (Dev)"
              style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.3 }}
            >
              ⚡
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: theme.spacing[8] }}>
          {children}
        </div>
      </main>
    </div>
  );
};

function App() {
  const appStyles: React.CSSProperties = {
    backgroundColor: theme.colors.background.primary,
    minHeight: '100vh',
    fontFamily: theme.typography.fontFamily.sans,
    color: theme.colors.text.primary
  };

  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <div style={appStyles}>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/*" element={
                <PrivateRoute>
                  <DashboardLayout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/devices" replace />} />
                      <Route path="/devices" element={<DeviceListView />} />
                      <Route path="/devices/:id" element={<DeviceDetailView />} />
                      <Route path="/policies" element={<PoliciesView />} />
                      <Route path="/analytics" element={<AnalyticsView />} />
                    </Routes>
                  </DashboardLayout>
                </PrivateRoute>
              } />
            </Routes>
          </div>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
