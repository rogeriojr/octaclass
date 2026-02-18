import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

const DEFAULT_EMAIL = 'professor@escola.com';
const DEFAULT_PASSWORD = '123456';

export const Login: React.FC = () => {
  const [name, setName] = useState('Professor');
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      if (isRegistering) {
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
      }
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      if (msg.includes('Muitas tentativas') || msg.includes('Aguarde')) {
        setError('Muitas tentativas de login. Aguarde alguns minutos e tente novamente.');
      } else if (msg.includes('já cadastrado')) {
        setError('Email já cadastrado. Faça login.');
      } else if (msg.includes('Credenciais') || msg.includes('inválidas')) {
        setError('Credenciais inválidas. Verifique email e senha.');
      } else {
        setError(msg || 'Falha na autenticação. Verifique os dados.');
      }
    } finally {
      setLoading(false);
    }
  };

  const pageStyles: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.primary,
    backgroundImage: `
      radial-gradient(at 0% 0%, ${theme.colors.primary[900]} 0px, transparent 50%),
      radial-gradient(at 100% 0%, ${theme.colors.secondary[900]} 0px, transparent 50%),
      radial-gradient(at 100% 100%, ${theme.colors.primary[900]} 0px, transparent 50%),
      radial-gradient(at 0% 100%, ${theme.colors.secondary[900]} 0px, transparent 50%)
    `,
    position: 'relative',
    overflow: 'hidden'
  };

  const glassCardStyles: React.CSSProperties = {
    backgroundColor: 'rgba(28, 33, 40, 0.6)',
    backdropFilter: 'blur(12px)',
    border: `1px solid ${theme.colors.border.subtle}`,
    padding: theme.spacing[10],
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
  };

  const titleStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: theme.spacing[2],
    background: `linear-gradient(135deg, ${theme.colors.primary[400]}, ${theme.colors.secondary[400]})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontFamily: theme.typography.fontFamily.sans
  };

  const subtitleStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing[8],
    fontFamily: theme.typography.fontFamily.sans
  };

  const formStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[6]
  };

  return (
    <div style={pageStyles}>
      <div style={glassCardStyles} className="animate-fade-in">
        <h1 style={titleStyles}>Octoclass MDM</h1>
        <p style={subtitleStyles}>Gerenciamento Enterprise para Tablets</p>

        {error && (
          <div style={{
            backgroundColor: 'rgba(255, 77, 77, 0.1)',
            color: theme.colors.danger[400],
            padding: theme.spacing[3],
            borderRadius: theme.borderRadius.base,
            fontSize: theme.typography.fontSize.sm,
            marginBottom: theme.spacing[4],
            border: `1px solid ${theme.colors.danger[900]}`,
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={formStyles}>
          {isRegistering && (
            <Input
              label="Nome"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              required
              fullWidth
            />
          )}
          <Input
            label="Email Institucional"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@escola.com"
            required
            fullWidth
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            fullWidth
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            loading={loading}
            style={{ marginTop: theme.spacing[2] }}
          >
            {isRegistering ? 'Criar Conta e Acessar' : 'Acessar Painel'}
          </Button>

          <div style={{ textAlign: 'center', marginTop: theme.spacing[4] }}>
            <button
              type="button"
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              style={{
                background: 'none',
                border: 'none',
                color: theme.colors.primary[400],
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: theme.typography.fontSize.sm
              }}
            >
              {isRegistering ? 'Já tem conta? Fazer Login' : 'Não tem conta? Criar Conta'}
            </button>
          </div>
        </form>

        <div style={{
          marginTop: theme.spacing[6],
          textAlign: 'center',
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.text.tertiary
        }}>
          Protegido por Octoclass Enterprise Security
        </div>
      </div>
    </div>
  );
};
