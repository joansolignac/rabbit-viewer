import React, { useState } from 'react';
import type { ConnectionProfile, VhostItem } from '../types/rabbitmq';
import { Settings, ChevronDown, Check, RefreshCw, Trash2 } from 'lucide-react';

interface NavbarProps {
  activeProfile: ConnectionProfile | null;
  profiles: ConnectionProfile[];
  onSelectProfile: (id: string) => void;
  onOpenConnectionModal: () => void;
  onDeleteProfile?: (id: string) => void;
  isConnected: boolean;
  isConnecting: boolean;
  vhosts: VhostItem[];
  currentVhost: string;
  onChangeVhost: (vhost: string) => void;
  accentColor: string;
  onChangeAccentColor?: (color: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeProfile,
  profiles,
  onSelectProfile,
  onOpenConnectionModal,
  onDeleteProfile,
  isConnected,
  isConnecting,
  vhosts,
  currentVhost,
  onChangeVhost,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#202433] bg-[#07080a]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left: Modern Minimalist Brand */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {/* Minimalist Geometric Vector Mark */}
            <div className="size-8 bg-white text-black flex items-center justify-center font-mono font-black text-xs shadow-sm">
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                role="img"
                aria-label="RabbitMQ"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M23.035 9.601h-7.677a.956.956 0 01-.962-.962V.962a.956.956 0 00-.962-.956H10.56a.956.956 0 00-.962.956V8.64a.956.956 0 01-.962.962H5.762a.956.956 0 01-.961-.962V.962A.956.956 0 003.839 0H.959a.956.956 0 00-.956.962v22.076A.956.956 0 00.965 24h22.07a.956.956 0 00.962-.962V10.58a.956.956 0 00-.962-.98zm-3.86 8.152a1.437 1.437 0 01-1.437 1.443h-1.924a1.437 1.437 0 01-1.436-1.443v-1.917a1.437 1.437 0 011.436-1.443h1.924a1.437 1.437 0 011.437 1.443z" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm tracking-tight font-extrabold text-white flex items-center gap-1.5">
                <span>RABBIT</span>
                <span className="text-zinc-600 font-light">/</span>
                <span className="text-zinc-300">VIEWER</span>
              </span>
              <span className="hw-tag hidden sm:inline-block border-zinc-800 text-zinc-500 bg-zinc-900/40 text-[9px]">
                v1.0
              </span>
            </div>
          </div>

          {/* Vhost Selector (if connected) */}
          {isConnected && vhosts.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 font-mono text-xs text-zinc-400 pl-4 border-l border-zinc-800">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Vhost:</span>
              <select
                value={currentVhost}
                onChange={(e) => onChangeVhost(e.target.value)}
                className="bg-[#0e1017] border border-zinc-700 hover:border-zinc-500 text-zinc-200 px-2 py-1 text-xs font-mono focus:outline-none cursor-pointer"
              >
                {vhosts.map((vh) => (
                  <option key={vh.name} value={vh.name}>
                    {vh.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right: Active Profile Switcher & Actions */}
        <div className="flex items-center gap-3">
          {/* Active Broker Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#0e1017] border border-zinc-800 hover:border-zinc-600 transition-all font-mono text-xs text-zinc-200 cursor-pointer"
            >
              {/* Status Dot */}
              <span className="relative flex size-2">
                {isConnecting ? (
                  <RefreshCw className="size-2 text-zinc-400 animate-spin" />
                ) : isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full size-2 bg-emerald-400"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full size-2 bg-red-500"></span>
                )}
              </span>

              <span className="font-semibold truncate max-w-[140px] sm:max-w-[200px]">
                {activeProfile ? activeProfile.name : 'Select Broker'}
              </span>

              <ChevronDown className="size-3 text-zinc-400 ml-1" />
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div
                className="absolute right-0 mt-1 w-72 bg-[#0e1017] border border-zinc-800 shadow-2xl py-1 z-50 animate-fade-in font-mono text-xs"
                onMouseLeave={() => setProfileDropdownOpen(false)}
              >
                <div className="px-3 py-1.5 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                  <span>Switch Broker Profile</span>
                  <span className="text-zinc-600">{profiles.length} saved</span>
                </div>

                <div className="max-h-60 overflow-y-auto py-1">
                  {profiles.length === 0 ? (
                    <div className="px-3 py-4 text-center text-zinc-500 text-[11px]">
                      No broker hosts saved.
                    </div>
                  ) : (
                    profiles.map((p) => {
                      const isSelected = p.id === activeProfile?.id;
                      const isConfirming = confirmDeleteId === p.id;

                      return (
                        <div
                          key={p.id}
                          className={`w-full px-3 py-2 flex items-center justify-between transition-colors group ${
                            isSelected ? 'bg-zinc-800/80 text-white font-bold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectProfile(p.id);
                              setProfileDropdownOpen(false);
                            }}
                            className="flex-1 text-left truncate pr-2 cursor-pointer"
                          >
                            <div className="truncate text-xs flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {isSelected && <Check className="size-3 text-emerald-400 shrink-0" />}
                            </div>
                            <div className="text-[10px] text-zinc-500 truncate">
                              {p.protocol}://{p.host}:{p.port} ({p.vhost})
                            </div>
                          </button>

                          {/* Delete Host in Navbar dropdown */}
                          {onDeleteProfile && (
                            <div className="shrink-0 flex items-center">
                              {isConfirming ? (
                                <div className="flex items-center gap-1 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteProfile(p.id);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold uppercase transition-colors"
                                    title="Confirm delete host"
                                  >
                                    Del
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-1 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[9px]"
                                    title="Cancel"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(p.id);
                                  }}
                                  className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors opacity-0 group-hover:opacity-100"
                                  title="Delete this host profile"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-zinc-800 p-1.5 bg-[#090b10]">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onOpenConnectionModal();
                    }}
                    className="w-full hw-btn-secondary !text-[11px] !py-1 text-center justify-center"
                  >
                    Manage / Add Brokers...
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Manage Brokers Button */}
          <button
            onClick={onOpenConnectionModal}
            className="hw-btn-secondary !px-2.5 !py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
            title="Configure and manage broker connections"
          >
            <Settings className="size-3.5" />
            <span className="hidden sm:inline">Brokers</span>
          </button>
        </div>
      </div>
    </header>
  );
};
