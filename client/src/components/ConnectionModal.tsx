import React, { useState, useEffect } from 'react';
import type { ConnectionProfile } from '../types/rabbitmq';
import { testConnection } from '../services/api';
import {
  X,
  Plus,
  Server,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit3,
  ArrowRight,
  ShieldCheck,
  Download,
  Upload,
  Zap,
} from 'lucide-react';

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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
      setDeleteConfirmId(null);
    } else if (isCreatingNew || profiles.length === 0) {
      resetForm();
    } else if (profiles.length > 0) {
      const active = profiles.find((p) => p.id === activeProfileId) || profiles[0];
      setEditingProfile(active);
    }
  }, [editingProfile?.id, isCreatingNew, profiles.length]);

  const resetForm = () => {
    setName('');
    setHost('127.0.0.1');
    setPort(15672);
    setProtocol('http');
    setUser('guest');
    setPassword('guest');
    setVhost('/');
    setTestResult({ loading: false });
    setDeleteConfirmId(null);
  };

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setIsCreatingNew(true);
    setEditingProfile(null);
    setName(`Broker #${profiles.length + 1}`);
    setHost('127.0.0.1');
    setPort(15672);
    setProtocol('http');
    setUser('guest');
    setPassword('guest');
    setVhost('/');
    setTestResult({ loading: false });
    setDeleteConfirmId(null);
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
        message: `Connected successfully! RabbitMQ v${res.rabbitmqVersion} (${res.clusterName}) as user "${res.user}"`,
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
    setEditingProfile(saved);
    // Close the modal once the host has been accepted/added so the user
    // lands directly on the freshly connected broker view.
    onClose();
  };

  const handleDelete = (id: string) => {
    onDeleteProfile(id);
    setDeleteConfirmId(null);
    const remaining = profiles.filter((p) => p.id !== id);
    if (editingProfile?.id === id) {
      if (remaining.length > 0) {
        setEditingProfile(remaining[0]);
        setIsCreatingNew(false);
      } else {
        setEditingProfile(null);
        setIsCreatingNew(true);
        resetForm();
      }
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(profiles, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `rabbitmq-connections-${new Date().toISOString().slice(0, 10)}.json`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-4xl bg-[#090a0f] border border-zinc-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0e1017]">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-white text-black flex items-center justify-center font-mono font-bold text-xs">
              <Server className="size-4" />
            </div>
            <div>
              <h2 className="font-mono text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                Broker Connections Manager
                <span className="hw-tag text-[9px] border-zinc-800 text-zinc-500 bg-zinc-900/60">
                  Local Session Only
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400 font-mono">
                Add, edit, or remove connection profiles. Credentials stay strictly in your local browser session.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        {/* Body Grid: Left list of connections, Right edit/add form */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Saved Connections List */}
          <div className="md:col-span-5 border-r border-zinc-800 bg-[#07080a] flex flex-col overflow-hidden">
            {/* List Header & Add Connection Action */}
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between font-mono">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                Connections ({profiles.length})
              </span>
              <button
                type="button"
                onClick={handleStartCreate}
                className="hw-btn-primary !px-2.5 !py-1 !text-[10px] flex items-center gap-1"
                title="Add new broker connection"
              >
                <Plus className="size-3" />
                <span>Add Broker</span>
              </button>
            </div>

            {/* Profile Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono">
              {profiles.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-800 text-zinc-500 font-mono text-xs my-4">
                  <Server className="size-8 mx-auto mb-2 text-zinc-700" />
                  <div className="text-zinc-300 font-bold uppercase tracking-wider">No Hosts Saved</div>
                  <p className="text-[10px] text-zinc-500 mt-1">All profiles removed. Use the form to configure a host.</p>
                </div>
              ) : (
                profiles.map((p) => {
                  const isActive = p.id === activeProfileId;
                  const isSelectedForEdit = editingProfile?.id === p.id && !isCreatingNew;
                  const isConfirmingDelete = deleteConfirmId === p.id;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleStartEdit(p)}
                      className={`p-3 border transition-all cursor-pointer relative group ${
                        isActive
                          ? 'border-white bg-zinc-900/80 shadow-md'
                          : isSelectedForEdit
                          ? 'border-zinc-500 bg-zinc-800/40'
                          : 'border-zinc-800/80 bg-[#0c0d12] hover:border-zinc-600 hover:bg-[#12141c]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <Server className={`size-3.5 shrink-0 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                          <span className="text-xs font-bold text-white truncate max-w-[160px]">
                            {p.name}
                          </span>
                        </div>

                        {isActive && (
                          <span className="hw-tag !border-emerald-600 !bg-emerald-950/40 !text-emerald-400 !text-[8px] font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-[10px] text-zinc-400 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Endpoint:</span>
                          <span className="text-zinc-300 font-mono">{p.protocol}://{p.host}:{p.port}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Auth:</span>
                          <span className="text-zinc-400">{p.user} @ {p.vhost}</span>
                        </div>
                      </div>

                      {/* Card Actions: Connect, Edit, Delete */}
                      <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProfile(p.id);
                            }}
                            className="text-white hover:underline flex items-center gap-1 font-bold"
                          >
                            Connect <ArrowRight className="size-3" />
                          </button>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="size-3" /> Selected
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(p);
                            }}
                            className="p-1 hover:text-white text-zinc-400"
                            title="Edit connection profile"
                          >
                            <Edit3 className="size-3" />
                          </button>

                          {/* Inline Delete Confirmation */}
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleDelete(p.id)}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold uppercase transition-colors"
                                title="Confirm delete this host"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[9px] transition-colors"
                                title="Cancel"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(p.id);
                              }}
                              className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                              title="Delete this host profile"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Actions: Export / Import JSON */}
            <div className="p-3 border-t border-zinc-800 bg-[#07080a] flex items-center justify-between text-xs font-mono">
              <button
                type="button"
                onClick={handleExportJson}
                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                title="Export connection profiles as JSON backup"
              >
                <Download className="size-3" /> Export Backup
              </button>

              <label className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer">
                <Upload className="size-3" /> Import Backup
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Right Column: Connection Form (Add or Edit) */}
          <div className="md:col-span-7 bg-[#0b0d13] flex flex-col overflow-y-auto p-6 font-mono">
            <div className="pb-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>{isCreatingNew || !editingProfile ? 'Add New Broker Profile' : `Edit Profile: ${editingProfile.name}`}</span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Configure RabbitMQ Management HTTP API credentials.
                </p>
              </div>

              {!isCreatingNew && editingProfile && (
                deleteConfirmId === editingProfile.id ? (
                  <div className="flex items-center gap-2 p-1.5 bg-red-950/40 border border-red-600/70 text-red-200 animate-fade-in">
                    <span className="text-[10px] font-bold text-red-300">Delete host?</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(editingProfile.id)}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase transition-colors"
                      title="Permanently remove this host profile"
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(editingProfile.id)}
                    className="text-red-400 hover:text-red-200 text-xs flex items-center gap-1.5 px-2.5 py-1 bg-red-950/30 hover:bg-red-950/60 border border-red-900/60 hover:border-red-600 transition-colors"
                    title="Delete this host profile"
                  >
                    <Trash2 className="size-3.5" />
                    <span className="text-[10px] uppercase font-bold">Delete Host</span>
                  </button>
                )
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSaveForm} className="mt-4 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Profile Name */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Local Staging Broker"
                    required
                    className="w-full bg-[#07080a] border border-zinc-800 focus:border-white text-zinc-200 px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>

                {/* Host & Port */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Protocol
                    </label>
                    <select
                      value={protocol}
                      onChange={(e) => setProtocol(e.target.value as 'http' | 'https')}
                      className="w-full bg-[#07080a] border border-zinc-800 focus:border-white text-zinc-200 px-2 py-2 text-xs font-mono focus:outline-none cursor-pointer"
                    >
                      <option value="http">http://</option>
                      <option value="https">https://</option>
                    </select>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Host / IP
                    </label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="127.0.0.1"
                      required
                      className="w-full bg-[#07080a] border border-zinc-800 focus:border-white text-zinc-200 px-3 py-2 text-xs font-mono focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      placeholder="15672"
                      required
                      className="w-full bg-[#07080a] border border-zinc-800 focus:border-white text-zinc-200 px-3 py-2 text-xs font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* User & Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={user}
                      onChange={(e) => setUser(e.target.value)}
                      placeholder="guest"
                      required
                      className="w-full bg-[#07080a] border border-zinc-800 focus:border-white text-zinc-200 px-3 py-2 text-xs font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#07080a] border border-zinc-800 focus:border-white text-zinc-200 px-3 py-2 text-xs font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* Virtual Host */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Virtual Host (vhost)
                  </label>
                  <input
                    type="text"
                    value={vhost}
                    onChange={(e) => setVhost(e.target.value)}
                    placeholder="/"
                    className="w-full bg-[#07080a] border border-zinc-800 focus:border-white text-zinc-200 px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Default is "/" (Root virtual host)
                  </span>
                </div>

                {/* Test Feedback Notice */}
                {testResult.message && (
                  <div
                    className={`p-3 border text-xs font-mono flex items-start gap-2 animate-fade-in ${
                      testResult.success
                        ? 'bg-emerald-950/30 border-emerald-600/70 text-emerald-200'
                        : 'bg-red-950/40 border-red-600 text-red-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{testResult.message}</span>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="pt-5 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestCurrentForm}
                    disabled={testResult.loading || !host}
                    className="hw-btn-secondary !text-xs !py-2"
                  >
                    <Zap className={`size-3.5 ${testResult.loading ? 'animate-spin' : ''}`} />
                    <span>{testResult.loading ? 'Testing...' : 'Test Connection'}</span>
                  </button>

                  {!isCreatingNew && editingProfile && (
                    deleteConfirmId === editingProfile.id ? (
                      <div className="flex items-center gap-1.5 animate-fade-in">
                        <button
                          type="button"
                          onClick={() => handleDelete(editingProfile.id)}
                          className="px-2.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase transition-colors"
                          title="Confirm delete this host profile"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(editingProfile.id)}
                        className="hw-btn-danger !text-xs !py-2 flex items-center gap-1.5"
                        title="Delete this host connection"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Delete Host</span>
                      </button>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="hw-btn-secondary !text-xs !py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="hw-btn-primary !text-xs !py-2"
                  >
                    <ShieldCheck className="size-3.5" />
                    <span>Save & Connect</span>
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
