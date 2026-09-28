import React, { useState, useEffect, useCallback } from 'react';
import type { ConnectionProfile, QueueItem, VhostItem } from './types/rabbitmq';
import {
  getProfiles,
  getActiveProfile,
  setActiveProfileId,
  upsertProfile,
  deleteProfile,
} from './services/storage';
import { testConnection, getQueues, getVhosts } from './services/api';
import { Navbar } from './components/Navbar';
import { QueuesList } from './components/QueuesList';
import { QueueDetail } from './components/QueueDetail';
import { ConnectionModal } from './components/ConnectionModal';
import {
  Server,
  AlertCircle,
  RefreshCw,
  Zap,
} from 'lucide-react';

export const App: React.FC = () => {
  // Profiles state
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<ConnectionProfile | null>(null);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

  // Connection & Broker state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [brokerInfo, setBrokerInfo] = useState<{
    version?: string;
    cluster?: string;
    user?: string;
  } | null>(null);

  // Vhosts & Queues
  const [vhosts, setVhosts] = useState<VhostItem[]>([]);
  const [currentVhost, setCurrentVhost] = useState('/');
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [loadingQueues, setLoadingQueues] = useState(false);

  // Navigation
  const [selectedQueueName, setSelectedQueueName] = useState<string | null>(null);

  // Auto-refresh interval (seconds)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5);

  // Theme Accent Color (Hermes-inspired, custom high-contrast orange default)
  const [accentColor, setAccentColor] = useState<string>('#ff5500');

  // Load profiles on mount
  useEffect(() => {
    const loadedProfiles = getProfiles();
    setProfiles(loadedProfiles);
    const active = getActiveProfile();
    setActiveProfile(active);
    if (active) {
      setCurrentVhost(active.vhost || '/');
    }
  }, []);

  // Connect & Verify active profile
  const verifyAndConnect = useCallback(async (profile: ConnectionProfile) => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const res = await testConnection(profile);
      setIsConnected(true);
      setBrokerInfo({
        version: res.rabbitmqVersion,
        cluster: res.clusterName,
        user: res.user,
      });

      // Load vhosts
      try {
        const vhList = await getVhosts(profile);
        setVhosts(vhList);
      } catch (err) {
        console.warn('Could not fetch vhosts, using fallback', err);
        setVhosts([{ name: profile.vhost || '/' }]);
      }

      // Load queues
      await loadQueues(profile, profile.vhost || '/');
    } catch (err: any) {
      setIsConnected(false);
      setConnectionError(err.message || 'Unable to connect to RabbitMQ broker.');
      setQueues([]);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Load Queues
  const loadQueues = async (profile: ConnectionProfile, vhost: string) => {
    setLoadingQueues(true);
    try {
      const qList = await getQueues(profile, vhost);
      setQueues(qList);
      setConnectionError(null);
    } catch (err: any) {
      console.error('Failed to load queues', err);
      setConnectionError(err.message || 'Failed to fetch queues.');
    } finally {
      setLoadingQueues(false);
    }
  };

  // Re-verify when active profile changes
  useEffect(() => {
    if (activeProfile) {
      setCurrentVhost(activeProfile.vhost || '/');
      verifyAndConnect(activeProfile);
    }
  }, [activeProfile?.id]);

  // Handle switching active profile
  const handleSelectProfile = (id: string) => {
    setActiveProfileId(id);
    const updated = getProfiles();
    setProfiles(updated);
    const active = updated.find((p) => p.id === id) || null;
    setActiveProfile(active);
    setSelectedQueueName(null);
  };

  const handleSaveProfile = (profile: ConnectionProfile) => {
    upsertProfile(profile);
    const updated = getProfiles();
    setProfiles(updated);
    setActiveProfile(profile);
    setActiveProfileId(profile.id);
  };

  const handleDeleteProfile = (id: string) => {
    deleteProfile(id);
    const updated = getProfiles();
    setProfiles(updated);
    const active = getActiveProfile();
    setActiveProfile(active);
  };

  const handleChangeVhost = (vh: string) => {
    setCurrentVhost(vh);
    setSelectedQueueName(null);
    if (activeProfile) {
      loadQueues(activeProfile, vh);
    }
  };

  // Auto-refresh timer for queue list
  useEffect(() => {
    if (autoRefreshInterval <= 0 || !isConnected || !activeProfile || selectedQueueName) return;

    const timer = setInterval(() => {
      loadQueues(activeProfile, currentVhost);
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, isConnected, activeProfile, currentVhost, selectedQueueName]);

  return (
    <div className="min-h-screen bg-[#08090d] text-zinc-100 flex flex-col font-sans selection:bg-[#ff5500] selection:text-black">
      {/* Top Navbar */}
      <Navbar
        activeProfile={activeProfile}
        profiles={profiles}
        onSelectProfile={handleSelectProfile}
        onOpenConnectionModal={() => setIsConnectionModalOpen(true)}
        isConnected={isConnected}
        isConnecting={isConnecting}
        vhosts={vhosts}
        currentVhost={currentVhost}
        onChangeVhost={handleChangeVhost}
        accentColor={accentColor}
        onChangeAccentColor={setAccentColor}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!isConnected && !isConnecting ? (
          /* Disconnected State / Welcome Connect Screen */
          <div className="max-w-2xl mx-auto py-10 animate-fade-in">
            <div className="p-8 bg-[#0e1017] border border-[#232838] shadow-2xl relative">
              {/* Top Accent Line */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: accentColor }}
              ></div>

              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-rose-500"></span>
                    <span>Broker Disconnected</span>
                  </div>
                  <h1 className="mt-2 text-2xl font-mono font-bold tracking-tight text-white uppercase">
                    Connect to RabbitMQ
                  </h1>
                </div>
                <div className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400">
                  <Server className="size-6" />
                </div>
              </div>

              <p className="mt-3 text-xs text-zinc-400 font-mono leading-relaxed">
                Rabbit Viewer communicates with the RabbitMQ Management HTTP API. No credentials are stored on the server—everything is preserved securely in your local browser session.
              </p>

              {/* Error Notice if any */}
              {connectionError && (
                <div className="mt-5 p-4 bg-rose-950/40 border border-rose-600 font-mono text-xs text-rose-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-400 uppercase tracking-wider">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>Connection Failed</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-200">
                    {connectionError}
                  </p>
                </div>
              )}

              {/* Quick Profile Summary */}
              {activeProfile && (
                <div className="mt-6 p-4 bg-[#07080c] border border-zinc-800 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="uppercase text-[10px]">Active Profile:</span>
                    <span className="font-bold text-white">{activeProfile.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="uppercase text-[10px]">Target Broker:</span>
                    <span className="text-zinc-200">{activeProfile.protocol}://{activeProfile.host}:{activeProfile.port}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="uppercase text-[10px]">Username:</span>
                    <span className="text-zinc-200">{activeProfile.user}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="uppercase text-[10px]">Virtual Host:</span>
                    <span className="text-zinc-200">{activeProfile.vhost}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 pt-5 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsConnectionModalOpen(true)}
                  className="w-full sm:w-auto hw-btn-secondary"
                >
                  Edit / Switch Brokers
                </button>

                <button
                  type="button"
                  onClick={() => activeProfile && verifyAndConnect(activeProfile)}
                  disabled={isConnecting}
                  className="w-full sm:w-auto hw-btn-primary"
                >
                  <Zap className="size-4" />
                  <span>Retry Connection</span>
                </button>
              </div>
            </div>
          </div>
        ) : isConnecting ? (
          /* Connecting Loading Screen */
          <div className="py-24 text-center font-mono">
            <RefreshCw className="size-8 mx-auto text-brand-500 animate-spin mb-4" />
            <h3 className="text-zinc-200 text-sm font-semibold uppercase tracking-wider">
              Connecting to RabbitMQ Broker...
            </h3>
            <p className="text-zinc-500 text-xs mt-1">
              Verifying Management API credentials at {activeProfile?.host}:{activeProfile?.port}
            </p>
          </div>
        ) : selectedQueueName ? (
          /* Queue Detail / Messages View */
          <QueueDetail
            queueName={selectedQueueName}
            vhost={currentVhost}
            activeProfile={activeProfile!}
            onBack={() => setSelectedQueueName(null)}
            accentColor={accentColor}
          />
        ) : (
          /* Queues List View */
          <QueuesList
            queues={queues}
            isLoading={loadingQueues}
            onRefresh={() => activeProfile && loadQueues(activeProfile, currentVhost)}
            onSelectQueue={(qName) => setSelectedQueueName(qName)}
            autoRefreshInterval={autoRefreshInterval}
            onChangeAutoRefresh={setAutoRefreshInterval}
            activeProfile={activeProfile}
            accentColor={accentColor}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1d28] bg-[#07080c] py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[10px] text-zinc-500">
          <div className="flex items-center gap-2">
            <span>RABBIT-VIEWER</span>
            <span>•</span>
            <span>Hermes Edition</span>
            <span>•</span>
            <span className="text-emerald-500">Management Proxy Connected</span>
          </div>

          {brokerInfo && (
            <div className="flex items-center gap-3 text-zinc-400">
              <span>Cluster: {brokerInfo.cluster}</span>
              <span>•</span>
              <span>RabbitMQ v{brokerInfo.version}</span>
            </div>
          )}
        </div>
      </footer>

      {/* Multi-instance Connection Manager Modal */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        profiles={profiles}
        activeProfileId={activeProfile?.id || null}
        onSelectProfile={handleSelectProfile}
        onSaveProfile={handleSaveProfile}
        onDeleteProfile={handleDeleteProfile}
      />
    </div>
  );
};

export default App;
