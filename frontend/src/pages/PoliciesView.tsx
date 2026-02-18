import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, Globe, AlertTriangle, Package } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { globalPoliciesService, GlobalPolicyResponse } from '../services/api';
import { theme } from '../styles/theme';

export const PoliciesView: React.FC = () => {
  const [policy, setPolicy] = useState<GlobalPolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newPackage, setNewPackage] = useState('');
  const [screenshotInterval, setScreenshotInterval] = useState(60000);
  const [kioskMode, setKioskMode] = useState(true);

  const fetchPolicy = useCallback(async () => {
    try {
      const { data } = await globalPoliciesService.get();
      setPolicy(data);
      setScreenshotInterval(data.screenshotInterval ?? 60000);
      setKioskMode(data.kioskMode ?? true);
    } catch {
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handleAddDomain = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain || policy?.blockedDomains.includes(domain)) return;
    setSaving(true);
    try {
      await globalPoliciesService.addBlacklist(domain);
      setPolicy(prev => prev ? { ...prev, blockedDomains: [...prev.blockedDomains, domain] } : null);
      setNewDomain('');
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    setSaving(true);
    try {
      await globalPoliciesService.removeBlacklist(domain);
      setPolicy(prev => prev ? { ...prev, blockedDomains: prev.blockedDomains.filter(d => d !== domain) } : null);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleAddPackage = async () => {
    const pkg = newPackage.trim();
    if (!pkg || policy?.allowedApps.includes(pkg)) return;
    setSaving(true);
    try {
      await globalPoliciesService.addWhitelist(pkg);
      setPolicy(prev => prev ? { ...prev, allowedApps: [...prev.allowedApps, pkg] } : null);
      setNewPackage('');
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePackage = async (pkg: string) => {
    setSaving(true);
    try {
      await globalPoliciesService.removeWhitelist(pkg);
      setPolicy(prev => prev ? { ...prev, allowedApps: prev.allowedApps.filter(a => a !== pkg) } : null);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGlobalSettings = async () => {
    setSaving(true);
    try {
      const { data } = await globalPoliciesService.update({
        screenshotInterval,
        kioskMode
      });
      setPolicy(prev => prev && data ? { ...prev, ...data } : prev);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: theme.spacing[8], color: theme.colors.text.secondary }}>
        Carregando políticas...
      </div>
    );
  }

  const blockedDomains = policy?.blockedDomains ?? [];
  const allowedApps = policy?.allowedApps ?? [];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[6] }}>
      <div>
        <h1 style={{
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text.primary,
          marginBottom: theme.spacing[2]
        }}>
          Políticas globais
        </h1>
        <p style={{ color: theme.colors.text.secondary }}>
          Blacklist de sites, whitelist de apps e configurações aplicadas a todos os dispositivos via API.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[6] }}>
        <Card>
          <div style={{ marginBottom: theme.spacing[6] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[4] }}>
              <div style={{
                padding: theme.spacing[2],
                backgroundColor: `${theme.colors.danger[500]}20`,
                borderRadius: theme.borderRadius.base,
                color: theme.colors.danger[500]
              }}>
                <Globe size={24} />
              </div>
              <h2 style={{ fontSize: theme.typography.fontSize.xl, fontWeight: 'bold' }}>Blacklist de sites</h2>
            </div>
            <p style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}>
              Domínios bloqueados no navegador dos dispositivos (ex.: facebook.com, tiktok.com).
            </p>
          </div>

          <div style={{ display: 'flex', gap: theme.spacing[3], marginBottom: theme.spacing[6] }}>
            <Input
              placeholder="Ex.: tiktok.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              fullWidth
            />
            <Button onClick={handleAddDomain} disabled={saving || !newDomain.trim()}>
              <Plus size={18} style={{ marginRight: 8 }} />
              Adicionar
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
            {blockedDomains.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: theme.spacing[8],
                border: `1px dashed ${theme.colors.border.default}`,
                borderRadius: theme.borderRadius.base
              }}>
                <p style={{ color: theme.colors.text.tertiary }}>Nenhum site na blacklist.</p>
              </div>
            ) : (
              blockedDomains.map((domain) => (
                <div
                  key={domain}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: theme.spacing[3],
                    backgroundColor: theme.colors.background.tertiary,
                    borderRadius: theme.borderRadius.base,
                    border: `1px solid ${theme.colors.border.subtle}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
                    <Shield size={16} color={theme.colors.danger[500]} />
                    <span style={{ fontWeight: theme.typography.fontWeight.medium }}>{domain}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(domain)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: theme.colors.text.tertiary
                    }}
                    disabled={saving}
                    aria-label={`Remover ${domain}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div style={{ marginBottom: theme.spacing[6] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[4] }}>
              <div style={{
                padding: theme.spacing[2],
                backgroundColor: `${theme.colors.primary[500]}20`,
                borderRadius: theme.borderRadius.base,
                color: theme.colors.primary[500]
              }}>
                <Package size={24} />
              </div>
              <h2 style={{ fontSize: theme.typography.fontSize.xl, fontWeight: 'bold' }}>Whitelist de apps</h2>
            </div>
            <p style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}>
              Pacotes permitidos nos dispositivos (ex.: com.android.calculator2, com.octoclass).
            </p>
          </div>

          <div style={{ display: 'flex', gap: theme.spacing[3], marginBottom: theme.spacing[6] }}>
            <Input
              placeholder="Ex.: com.android.calculator2"
              value={newPackage}
              onChange={(e) => setNewPackage(e.target.value)}
              fullWidth
            />
            <Button onClick={handleAddPackage} disabled={saving || !newPackage.trim()}>
              <Plus size={18} style={{ marginRight: 8 }} />
              Adicionar
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
            {allowedApps.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: theme.spacing[8],
                border: `1px dashed ${theme.colors.border.default}`,
                borderRadius: theme.borderRadius.base
              }}>
                <p style={{ color: theme.colors.text.tertiary }}>Nenhum app na whitelist.</p>
              </div>
            ) : (
              allowedApps.map((pkg) => (
                <div
                  key={pkg}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: theme.spacing[3],
                    backgroundColor: theme.colors.background.tertiary,
                    borderRadius: theme.borderRadius.base,
                    border: `1px solid ${theme.colors.border.subtle}`
                  }}
                >
                  <span style={{ fontWeight: theme.typography.fontWeight.medium, fontFamily: 'monospace', fontSize: theme.typography.fontSize.sm }}>{pkg}</span>
                  <button
                    type="button"
                    onClick={() => handleRemovePackage(pkg)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: theme.colors.text.tertiary
                    }}
                    disabled={saving}
                    aria-label={`Remover ${pkg}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[4] }}>
          <div style={{
            padding: theme.spacing[2],
            backgroundColor: `${theme.colors.warning[500]}20`,
            borderRadius: theme.borderRadius.base,
            color: theme.colors.warning[500]
          }}>
            <AlertTriangle size={24} />
          </div>
          <h2 style={{ fontSize: theme.typography.fontSize.xl, fontWeight: 'bold' }}>Configurações globais</h2>
        </div>
        <p style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm, marginBottom: theme.spacing[6] }}>
          Intervalo de captura de tela e modo kiosk. Alterações são enviadas em tempo real aos dispositivos.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[4], maxWidth: 400 }}>
          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.fontWeight.medium }}>
              Intervalo de screenshots (ms)
            </label>
            <Input
              type="number"
              value={screenshotInterval}
              onChange={(e) => setScreenshotInterval(Number(e.target.value) || 60000)}
              min={10000}
              step={10000}
            />
            <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.tertiary, marginLeft: theme.spacing[2] }}>
              {Math.round(screenshotInterval / 1000)}s
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
            <input
              type="checkbox"
              id="kioskMode"
              checked={kioskMode}
              onChange={(e) => setKioskMode(e.target.checked)}
            />
            <label htmlFor="kioskMode" style={{ fontWeight: theme.typography.fontWeight.medium }}>
              Modo kiosk (restringir saída do app)
            </label>
          </div>
          <Button onClick={handleSaveGlobalSettings} disabled={saving}>
            Salvar configurações globais
          </Button>
        </div>
      </Card>
    </div>
  );
};
