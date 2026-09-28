import React, { useState } from 'react';
import type { ConnectionProfile, VhostItem } from '../types/rabbitmq';
import { Settings, ChevronDown, Check, RefreshCw, Palette } from 'lucide-react';

interface NavbarProps {
  activeProfile: ConnectionProfile | null;
  profiles: ConnectionProfile[];
  onSelectProfile: (id: string) => void;
  onOpenConnectionModal: () => void;
  isConnected: boolean;
  isConnecting: boolean;
  vhosts: VhostItem[];
  currentVhost: string;
  onChangeVhost: (vhost: string) => void;
  accentColor: string;
  onChangeAccentColor: (color: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeProfile,
  profiles,
  onSelectProfile,
  onOpenConnectionModal,
  isConnected,
  isConnecting,
  vhosts,
  currentVhost,
  onChangeVhost,
  accentColor,
  onChangeAccentColor,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const ACCENT_OPTIONS = [
    { name: 'Solar Amber', hex: '#ff5500' },
    { name: 'Acid Emerald', hex: '#00e575' },
    { name: 'Cyber Cyan', hex: '#00bfff' },
    { name: 'Electric Violet', hex: '#8a2be2' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#232838] bg-[#090b10]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-sm tracking-tight font-black uppercase text-white flex items-center gap-1.5">
              <span
                className="size-5 flex items-center justify-center font-mono text-[11px] font-bold text-black"
                style={{ backgroundColor: accentColor }}
              >
                RV
              </span>
              <span>Rabbit<span style={{ color: accentColor }}>//</span>Viewer</span>
            </span>
            <span className="hw-tag hidden sm:inline-block border-zinc-800 text-zinc-500 bg-zinc-900/60">
              v1.0
            </span>
          </div>

          {/* Vhost Selector (if connected) */}
          {isConnected && vhosts.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 font-mono text-xs text-zinc-400 pl-4 border-l border-zinc-800">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Vhost:</span>
              <select
                value={currentVhost}
                onChange={(e) => onChangeVhost(e.target.value)}
                className="bg-[#0e1017] border border-zinc-700 hover:border-zinc-500 text-zinc-200 px-2 py-1 text-xs font-mono focus:outline-none focus:border-brand-500 cursor-pointer"
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
              className="flex items-center gap-2 px-3 py-1.5 bg-[#0e1017] border border-[#232838] hover:border-zinc-600 transition-all font-mono text-xs text-zinc-200"
            >
              {/* Status Dot */}
              <span className="relative flex size-2">
                {isConnecting ? (
                  <RefreshCw className="size-2 text-amber-400 animate-spin" />
                ) : isConnected ? (
                  <>
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: accentColor }}
                    ></span>
                    <span
                      className="relative inline-flex rounded-full size-2"
                      style={{ backgroundColor: accentColor }}
                    ></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full size-2 bg-rose-500"></span>
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
                className="absolute right-0 mt-1 w-72 bg-[#0e1017] border border-[#232838] shadow-2xl py-1 z-50 animate-fade-in font-mono text-xs"
                onMouseLeave={() => setProfileDropdownOpen(false)}
              >
                <div className="px-3 py-1.5 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                  <span>Switch Instance ({profiles.length})</span>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onOpenConnectionModal();
                    }}
                    className="text-brand-400 hover:underline uppercase text-[9px]"
                  >
                    Manage
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto py-1">
                  {profiles.map((p) => {
                    const isSelected = p.id === activeProfile?.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectProfile(p.id);
                          setProfileDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-zinc-800/60 transition-colors ${
                          isSelected ? 'bg-zinc-800/40 text-brand-400 font-semibold' : 'text-zinc-300'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="truncate">{p.name}</div>
                          <div className="text-[10px] text-zinc-500 truncate">
                            {p.protocol}://{p.host}:{p.port} ({p.vhost})
                          </div>
                        </div>
                        {isSelected && <Check className="size-3.5 shrink-0 text-brand-400" />}
                      </button>
                    );
                  })}
                </div>

                <div className="p-2 border-t border-zinc-800">
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onOpenConnectionModal();
                    }}
                    className="w-full hw-btn-secondary !text-[10px] !py-1"
                  >
                    <Settings className="size-3" />
                    Configure Brokers...
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Accent Palette Selector */}
          <div className="relative">
            <button
              onClick={() => setPaletteOpen(!paletteOpen)}
              className="p-1.5 bg-[#0e1017] border border-[#232838] hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Theme Accent Color"
            >
              <Palette className="size-3.5" />
            </button>
            {paletteOpen && (
              <div
                className="absolute right-0 mt-1 w-44 bg-[#0e1017] border border-[#232838] shadow-2xl p-2 z-50 animate-fade-in"
                onMouseLeave={() => setPaletteOpen(false)}
              >
                <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-500 mb-2">
                  Accent Color
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {ACCENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.hex}
                      onClick={() => {
                        onChangeAccentColor(opt.hex);
                        setPaletteOpen(false);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-[10px] font-mono text-zinc-300"
                    >
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: opt.hex }}></span>
                      <span>{opt.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Connections Settings Button */}
          <button
            onClick={onOpenConnectionModal}
            className="hw-btn-secondary !py-1.5 !px-2.5"
            title="Manage RabbitMQ Connections"
          >
            <Settings className="size-3.5" />
            <span className="hidden sm:inline">Brokers</span>
          </button>
        </div>
      </div>
    </header>
  );
};
