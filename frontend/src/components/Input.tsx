import React, { InputHTMLAttributes } from 'react';
import { theme } from '../styles/theme';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  icon,
  className = '',
  ...props
}) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[2],
    width: fullWidth ? '100%' : 'auto'
  };

  const labelStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.sans
  };

  const inputWrapperStyles: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  };

  const inputStyles: React.CSSProperties = {
    width: '100%',
    padding: `${theme.spacing[3]} ${icon ? theme.spacing[10] : theme.spacing[4]}`,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.sans,
    backgroundColor: theme.colors.background.tertiary,
    color: theme.colors.text.primary,
    border: `1px solid ${error ? theme.colors.danger[500] : theme.colors.border.default}`,
    borderRadius: theme.borderRadius.base,
    outline: 'none',
    transition: theme.transitions.base
  };

  const iconStyles: React.CSSProperties = {
    position: 'absolute',
    left: theme.spacing[3],
    color: theme.colors.text.tertiary,
    pointerEvents: 'none'
  };

  const helperStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize.xs,
    color: error ? theme.colors.danger[500] : theme.colors.text.tertiary,
    fontFamily: theme.typography.fontFamily.sans
  };

  return (
    <div style={containerStyles} className={className}>
      {label && <label style={labelStyles}>{label}</label>}
      <div style={inputWrapperStyles}>
        {icon && <div style={iconStyles}>{icon}</div>}
        <input
          style={inputStyles}
          {...props}
        />
      </div>
      {(error || helperText) && (
        <span style={helperStyles}>{error || helperText}</span>
      )}
    </div>
  );
};
