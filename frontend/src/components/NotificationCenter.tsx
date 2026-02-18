import React, { useState } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { theme } from '../styles/theme';
import { Button } from './Button';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  deviceId?: string;
  read: boolean;
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onClearAll
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'info':
        return <Info size={20} color={theme.colors.primary[500]} />;
      case 'success':
        return <CheckCircle size={20} color={theme.colors.success[500]} />;
      case 'warning':
        return <AlertTriangle size={20} color={theme.colors.warning[500]} />;
      case 'error':
        return <XCircle size={20} color={theme.colors.danger[500]} />;
    }
  };

  const getBackgroundColor = (type: Notification['type']) => {
    switch (type) {
      case 'info':
        return `${theme.colors.primary[500]}10`;
      case 'success':
        return `${theme.colors.success[500]}10`;
      case 'warning':
        return `${theme.colors.warning[500]}10`;
      case 'error':
        return `${theme.colors.danger[500]}10`;
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const containerStyles: React.CSSProperties = {
    position: 'fixed',
    top: theme.spacing[4],
    right: theme.spacing[4],
    zIndex: 1000
  };

  const buttonStyles: React.CSSProperties = {
    position: 'relative',
    padding: theme.spacing[3],
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: theme.borderRadius.full,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: theme.transitions.base
  };

  const badgeStyles: React.CSSProperties = {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    backgroundColor: theme.colors.danger[500],
    color: theme.colors.text.primary,
    borderRadius: theme.borderRadius.full,
    padding: `2px 6px`,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    minWidth: '20px',
    textAlign: 'center'
  };

  const panelStyles: React.CSSProperties = {
    position: 'absolute',
    top: '60px',
    right: 0,
    width: '400px',
    maxHeight: '600px',
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows['2xl'],
    overflow: 'hidden',
    display: isOpen ? 'flex' : 'none',
    flexDirection: 'column'
  };

  const headerStyles: React.CSSProperties = {
    padding: theme.spacing[4],
    borderBottom: `1px solid ${theme.colors.border.default}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const titleStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    margin: 0
  };

  const listStyles: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing[2]
  };

  const notificationItemStyles = (notification: Notification): React.CSSProperties => ({
    padding: theme.spacing[4],
    marginBottom: theme.spacing[2],
    backgroundColor: notification.read ? theme.colors.background.tertiary : getBackgroundColor(notification.type),
    borderRadius: theme.borderRadius.base,
    border: `1px solid ${theme.colors.border.muted}`,
    cursor: 'pointer',
    transition: theme.transitions.base
  });

  const notificationHeaderStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing[3],
    marginBottom: theme.spacing[2]
  };

  const notificationTitleStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    margin: 0
  };

  const notificationMessageStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.secondary,
    margin: 0,
    marginBottom: theme.spacing[2]
  };

  const notificationTimeStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary
  };

  const emptyStateStyles: React.CSSProperties = {
    padding: theme.spacing[12],
    textAlign: 'center',
    color: theme.colors.text.tertiary
  };

  return (
    <div style={containerStyles}>
      <button style={buttonStyles} onClick={() => setIsOpen(!isOpen)}>
        <Bell size={20} color={theme.colors.text.primary} />
        {unreadCount > 0 && <span style={badgeStyles}>{unreadCount}</span>}
      </button>

      <div style={panelStyles}>
        <div style={headerStyles}>
          <h3 style={titleStyles}>Notificações</h3>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
            >
              Limpar Tudo
            </Button>
          )}
        </div>

        <div style={listStyles}>
          {notifications.length === 0 ? (
            <div style={emptyStateStyles}>
              <Bell size={48} style={{ marginBottom: theme.spacing[4], opacity: 0.3 }} />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                style={notificationItemStyles(notification)}
                onClick={() => onMarkAsRead(notification.id)}
              >
                <div style={notificationHeaderStyles}>
                  {getIcon(notification.type)}
                  <div style={{ flex: 1 }}>
                    <h4 style={notificationTitleStyles}>{notification.title}</h4>
                  </div>
                </div>
                <p style={notificationMessageStyles}>{notification.message}</p>
                <span style={notificationTimeStyles}>{formatTime(notification.timestamp)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: Date.now(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);

    if (notification.type !== 'error') {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
      }, 30000);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    markAsRead,
    clearAll
  };
};
