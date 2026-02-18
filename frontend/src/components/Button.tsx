import React, { ButtonHTMLAttributes } from 'react';
import { theme } from '../styles/theme';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  ...props
}) => {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: theme.typography.fontFamily.sans,
    fontWeight: theme.typography.fontWeight.medium,
    borderRadius: theme.borderRadius.base,
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: theme.transitions.base,
    opacity: disabled || loading ? 0.6 : 1,
    width: fullWidth ? '100%' : 'auto'
  };

  const sizeStyles = {
    sm: {
      padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
      fontSize: theme.typography.fontSize.sm
    },
    md: {
      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
      fontSize: theme.typography.fontSize.base
    },
    lg: {
      padding: `${theme.spacing[4]} ${theme.spacing[6]}`,
      fontSize: theme.typography.fontSize.lg
    }
  };

  const variantStyles = {
    primary: {
      backgroundColor: 'var(--btn-primary-bg, var(--color-primary-500))',
      color: 'var(--btn-primary-text, var(--text-inverse))',
      boxShadow: theme.shadows.sm
    },
    secondary: {
      backgroundColor: 'var(--btn-secondary-bg, var(--color-secondary-100))',
      color: 'var(--btn-secondary-text, var(--text-primary))',
      border: `1px solid var(--border-default)`,
      boxShadow: 'none'
    },
    success: {
      backgroundColor: 'var(--btn-success-bg, var(--color-success-500))',
      color: 'var(--btn-success-text, var(--text-inverse))',
      boxShadow: theme.shadows.sm
    },
    danger: {
      backgroundColor: 'var(--btn-danger-bg, var(--color-danger-500))',
      color: 'var(--btn-danger-text, var(--text-inverse))',
      boxShadow: theme.shadows.sm
    },
    ghost: {
      backgroundColor: 'transparent',
      color: theme.colors.text.secondary,
      border: `1px solid var(--border-default)`
    }
  };

  const combinedStyles = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant]
  };

  return (
    <button
      style={combinedStyles}
      disabled={disabled || loading}
      className={className}
      {...props}
    >
      {loading ? 'Carregando...' : children}
    </button>
  );
};
