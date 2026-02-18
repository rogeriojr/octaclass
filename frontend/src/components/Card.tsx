import React, { ReactNode } from 'react';
import { theme } from '../styles/theme';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  actions,
  className = '',
  onClick,
  hoverable = false,
  style
}) => {
  const cardStyles: React.CSSProperties = {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[6],
    border: `1px solid ${theme.colors.border.default}`,
    transition: theme.transitions.base,
    cursor: onClick ? 'pointer' : 'default',
    boxShadow: hoverable ? theme.shadows.base : 'none'
  };

  const hoverStyles: React.CSSProperties = hoverable ? {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows.lg
  } : {};

  const [isHovered, setIsHovered] = React.useState(false);

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: title || subtitle ? theme.spacing[4] : '0'
  };

  const titleStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    margin: 0,
    marginBottom: subtitle ? theme.spacing[1] : '0'
  };

  const subtitleStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    margin: 0
  };

  return (
    <div
      style={{
        ...cardStyles,
        ...(isHovered ? hoverStyles : {}),
        ...style
      }}
      className={className}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {(title || subtitle || actions) && (
        <div style={headerStyles}>
          <div>
            {title && <h3 style={titleStyles}>{title}</h3>}
            {subtitle && <p style={subtitleStyles}>{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
