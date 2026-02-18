import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const STORAGE_TOKEN = 'token';
const STORAGE_USER = 'user';

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_USER);
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (stored && token) {
      try {
        setUser(JSON.parse(stored) as AuthUser);
      } catch {
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_TOKEN);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const raw = await res.text();
    const data = raw ? (() => { try { return JSON.parse(raw); } catch { return { error: raw }; } })() : {};
    if (!res.ok) {
      const msg = data.error || (res.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Credenciais inválidas.');
      throw new Error(msg);
    }
    if (data.token && data.user) {
      localStorage.setItem(STORAGE_TOKEN, data.token);
      localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
      setUser(data.user);
    }
  };

  const signUp = async (name: string, email: string, password: string) => {
    const registerRes = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role: 'teacher' })
    });
    const registerRaw = await registerRes.text();
    const registerData = registerRaw ? (() => { try { return JSON.parse(registerRaw); } catch { return {}; } })() : {};
    if (!registerRes.ok) {
      throw new Error(registerData.error || (registerRes.status === 409 ? 'Email já cadastrado. Faça login.' : 'Erro ao criar conta.'));
    }
    await signIn(email, password);
  };

  const signOut = async () => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
