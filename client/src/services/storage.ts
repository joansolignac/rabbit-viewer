import type { ConnectionProfile } from '../types/rabbitmq';

const STORAGE_KEY = 'rabbit_viewer_profiles';
const ACTIVE_KEY = 'rabbit_viewer_active_profile_id';

const DEFAULT_PROFILE: ConnectionProfile = {
  id: 'default-local',
  name: 'Local RabbitMQ (Docker / Standalone)',
  host: '127.0.0.1',
  port: 15672,
  protocol: 'http',
  user: 'guest',
  password: 'guest',
  vhost: '/',
  createdAt: Date.now(),
  lastUsedAt: Date.now(),
};

export function getProfiles(): ConnectionProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed with default local instance
      localStorage.setItem(STORAGE_KEY, JSON.stringify([DEFAULT_PROFILE]));
      localStorage.setItem(ACTIVE_KEY, DEFAULT_PROFILE.id);
      return [DEFAULT_PROFILE];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [DEFAULT_PROFILE];
  } catch (err) {
    console.error('Failed to read profiles from localStorage', err);
    return [DEFAULT_PROFILE];
  }
}

export function saveProfiles(profiles: ConnectionProfile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function getActiveProfileId(): string | null {
  const activeId = localStorage.getItem(ACTIVE_KEY);
  if (activeId) return activeId;
  const profiles = getProfiles();
  return profiles.length > 0 ? profiles[0].id : null;
}

export function setActiveProfileId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
  // Update lastUsedAt
  const profiles = getProfiles().map(p => p.id === id ? { ...p, lastUsedAt: Date.now() } : p);
  saveProfiles(profiles);
}

export function getActiveProfile(): ConnectionProfile | null {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  return profiles.find(p => p.id === activeId) || profiles[0] || null;
}

export function upsertProfile(profile: ConnectionProfile): void {
  const profiles = getProfiles();
  const index = profiles.findIndex(p => p.id === profile.id);
  if (index >= 0) {
    profiles[index] = profile;
  } else {
    profiles.push(profile);
  }
  saveProfiles(profiles);
}

export function deleteProfile(id: string): void {
  let profiles = getProfiles().filter(p => p.id !== id);
  if (profiles.length === 0) {
    // Keep at least default if all deleted
    profiles = [DEFAULT_PROFILE];
  }
  saveProfiles(profiles);
  const activeId = getActiveProfileId();
  if (activeId === id) {
    setActiveProfileId(profiles[0].id);
  }
}
