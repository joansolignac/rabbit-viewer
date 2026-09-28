import React, { useState, useEffect } from 'react';
import type { ConnectionProfile } from '../types/rabbitmq';
import { testConnection } from '../services/api';
import { X, Plus, Server, CheckCircle2, AlertCircle, Trash2, Edit3, ArrowRight, ShieldCheck, Download, Upload } from 'lucide-react';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: ConnectionProfile[];
  activeProfileId: string | null;
  onSelectProfile: (id: string) => void;
  onSaveProfile: (profile: ConnectionProfile) => void;
  onDeleteProfile: (id: string) => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  profiles,
  activeProfileId,
  onSelectProfile,
  onSaveProfile,
  onDeleteProfile,
}) => {
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [testResult, setTestResult] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
    details?: any;
  }>({ loading: false });

  // Form state
  const [name, setName] = useState('');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(15672);
  const [protocol, setProtocol] = useState<'http' | 'https'>('http');
  const [user, setUser] = useState('guest');
  const [password, setPassword] = useState('');
  const [vhost, setVhost] = useState('/');

  useEffect(() => {
    if (editingProfile) {
      setName(editingProfile.name);
      setHost(editingProfile.host);
      setPort(editingProfile.port);
      setProtocol(editingProfile.protocol);
      setUser(editingProfile.user);
      setPassword(editingProfile.password || '');
      setVhost(editingProfile.vhost);
      setTestResult({ loading: false });
    } else {
      resetForm();
    }
  }, [editingProfile]);

  const resetForm = () => {
    setName('');
    setHost('127.0.0.1');
    setPort(15672);
    setProtocol('http');
    setUser('guest');
    setPassword('guest');
    setVhost('/');
    setTestResult({ loading: false });
  };

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setIsCreatingNew(true);
    setEditingProfile(null);
    setName(`Broker Instance #${profiles.length + 1}`);
    setHost('127.0.0.1');
    setPort(15672);
    setProtocol('http');
    setUser('guest');
    setPassword('guest');
    setVhost('/');
    setTestResult({ loading: false });
  };

  const handleStartEdit = (p: ConnectionProfile) => {
    setIsCreatingNew(false);
    setEditingProfile(p);
  };

  const handleTestCurrentForm = async () => {
    const candidate: ConnectionProfile = {
      id: editingProfile?.id || 'temp-test',
      name: name.trim() || 'Test Connection',
      host: host.trim(),
      port: Number(port) || 15672,
      protocol,
      user: user.trim(),
      password,
      vhost: vhost.trim() || '/',
      createdAt: Date.now(),
    };

    setTestResult({ loading: true });
    try {
      const res = await testConnection(candidate);
      setTestResult({
        loading: false,
        success: true,
        message: `Connected! RabbitMQ v${res.rabbitmqVersion} (${res.clusterName}) as user "${res.user}"`,
        details: res,
      });
    } catch (err: any) {
      setTestResult({
        loading: false,
        success: false,
        message: err.message || 'Failed to connect to broker.',
      });
    }
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim()) return;

    const saved: ConnectionProfile = {
      id: editingProfile?.id || `profile-${Date.now()}`,
      name: name.trim() || `${host}:${port}`,
      host: host.trim(),
      port: Number(port) || 15672,
      protocol,
      user: user.trim(),
      password,
      vhost: vhost.trim() || '/',
      createdAt: editingProfile?.createdAt || Date.now(),
      lastUsedAt: Date.now(),
    };

    onSaveProfile(saved);
    onSelectProfile(saved.id);
    setIsCreatingNew(false);
    setEditingProfile(null);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(profiles, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `rabbit-viewer-profiles-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          parsed.forEach((p) => {
            if (p.host && p.port) {
              onSaveProfile({
                ...p,
                id: p.id || `profile-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              });
            }
          });
        }
      } catch (err) {
        alert('Invalid JSON file format for profiles');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-[#0b0d13] border border-[#232838] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232838] bg-[#0e1017]">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500 font-mono font-bold text-sm">
              RMQ
            </div>
            <div>
              <h2 className="font-mono text-sm uppercase tracking-wider font-semibold text-zinc-100 flex items-center gap-2">
                RabbitMQ Instances & Connections
                <span className="hw-tag border-zinc-800 text-zinc-500 bg-zinc-900/50">Local Browser Session</span>
              </h2>
              <p className="text-[11px] text-zinc-400 font-mono">
                Credentials are saved only in your browser's localStorage. Never stored in the backend.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="size-5" />
          </button>
        </div>

        {/* Body grid: left side list of profiles, right side edit/create form */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left: Saved Profiles List */}
          <div className="md:col-span-5 border-r border-[#232838] bg-[#07080c] flex flex-col overflow-hidden">
            <div className="p-3 border-b border-[#232838] flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                Saved Profiles ({profiles.length})
              </span>
              <button
                onClick={handleStartCreate}
                className="hw-btn-primary !px-2.5 !py-1 !text-[10px]"
              >
                <Plus className="size-3" />
                Add Broker
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {profiles.map((p) => {
                const isActive = p.id === activeProfileId;
                const isSelectedForEdit = editingProfile?.id === p.id && !isCreatingNew;

                return (
                  <div
                    key={p.id}
                    className={`p-3 border transition-all cursor-pointer relative group ${
                      isActive
                        ? 'border-brand-500 bg-brand-500/5'
                        : isSelectedForEdit
                        ? 'border-zinc-500 bg-zinc-800/40'
                        : 'border-[#1b1f2b] bg-[#0d0f15] hover:border-zinc-700'
                    }`}
                    onClick={() => {
                      setIsCreatingNew(false);
                      setEditingProfile(p);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Server className={`size-3.5 ${isActive ? 'text-brand-500' : 'text-zinc-400'}`} />
                        <span className="font-mono text-xs font-semibold text-zinc-100 truncate max-w-[180px]">
                          {p.name}
                        </span>
                      </div>
                      {isActive && (
                        <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-brand-500 text-black font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="mt-2 font-mono text-[10px] text-zinc-400 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Endpoint:</span>
                        <span className="text-zinc-300">{p.protocol}://{p.host}:{p.port}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">User / Vhost:</span>
                        <span className="text-zinc-300">{p.user} @ {p.vhost}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                      {!isActive ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProfile(p.id);
                          }}
                          className="font-mono text-[10px] uppercase tracking-wider text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold"
                        >
                          Connect Now <ArrowRight className="size-3" />
                        </button>
                      ) : (
                        <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Selected
                        </span>
                      )}

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(p);
                          }}
                          className="p-1 hover:text-zinc-100 text-zinc-400"
                          title="Edit Profile"
                        >
                          <Edit3 className="size-3" />
                        </button>
                        {profiles.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete connection profile "${p.name}"?`)) {
                                onDeleteProfile(p.id);
                              }
                            }}
                            className="p-1 hover:text-rose-400 text-zinc-500"
                            title="Delete Profile"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions: Export / Import */}
            <div className="p-3 border-t border-[#232838] bg-[#0c0e14] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleExportJson}
                className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
              >
                <Download className="size-3" /> Export JSON
              </button>
              <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer">
                <Upload className="size-3" /> Import JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Right: Profile Editor / Creation Form */}
          <div className="md:col-span-7 bg-[#0b0d13] flex flex-col overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#232838] mb-5">
              <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-200 font-semibold flex items-center gap-2">
                {isCreatingNew ? (
                  <>
                    <Plus className="size-3.5 text-brand-500" />
                    New Connection Profile
                  </>
                ) : (
                  <>
                    <Edit3 className="size-3.5 text-zinc-400" />
                    Edit Connection: {editingProfile?.name || 'Selected'}
                  </>
                )}
              </h3>
              <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px] uppercase tracking-wider">
                <ShieldCheck className="size-3.5" />
                <span>Stateless Proxy</span>
              </div>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                  Profile Label / Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Local Docker / Staging Cluster"
                  className="w-full px-3 py-2 bg-[#06070a] border border-zinc-700 font-mono text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Protocol
                  </label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#06070a] border border-zinc-700 font-mono text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="http">http://</option>
                    <option value="https">https://</option>
                  </select>
                </div>
                <div className="col-span-5">
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Host / IP
                  </label>
                  <input
                    type="text"
                    required
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="127.0.0.1 or rmq.domain.com"
                    className="w-full px-3 py-2 bg-[#06070a] border border-zinc-700 font-mono text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Mgmt Port
                  </label>
                  <input
                    type="number"
                    required
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    placeholder="15672"
                    className="w-full px-3 py-2 bg-[#06070a] border border-zinc-700 font-mono text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    RabbitMQ Username
                  </label>
                  <input
                    type="text"
                    required
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="guest"
                    className="w-full px-3 py-2 bg-[#06070a] border border-zinc-700 font-mono text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    RabbitMQ Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-[#06070a] border border-zinc-700 font-mono text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                  Virtual Host (vhost)
                </label>
                <input
                  type="text"
                  required
                  value={vhost}
                  onChange={(e) => setVhost(e.target.value)}
                  placeholder="/"
                  className="w-full px-3 py-2 bg-[#06070a] border border-zinc-700 font-mono text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                />
                <p className="mt-1 text-[10px] text-zinc-500 font-mono">
                  Default RabbitMQ virtual host is "/"
                </p>
              </div>

              {/* Real-time Connection Test Feedback */}
              {testResult.message && (
                <div
                  className={`p-3 border font-mono text-xs animate-fade-in ${
                    testResult.success
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">{testResult.success ? 'CONNECTION VERIFIED' : 'CONNECTION FAILED'}</div>
                      <div className="text-[11px] mt-0.5 leading-relaxed">{testResult.message}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-[#232838] flex items-center justify-between">
                <button
                  type="button"
                  disabled={testResult.loading || !host}
                  onClick={handleTestCurrentForm}
                  className="hw-btn-secondary"
                >
                  {testResult.loading ? 'Testing Broker...' : '⚡ Test Connection'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="font-mono text-xs uppercase tracking-wider px-3 py-2 text-zinc-400 hover:text-zinc-200"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="hw-btn-primary"
                  >
                    Save & Connect
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
