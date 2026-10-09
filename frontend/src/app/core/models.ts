/**
 * src/app/core/models.ts
 * Data types shared by the client: users, groups, channels, messages and the values used to personalize a profile.
 */
import type { PublicKeys } from './crypto/identity';

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';
export type SelfPresence = 'online' | 'idle' | 'dnd' | 'invisible';
export type AccentId =
  | 'mint'
  | 'violet'
  | 'coral'
  | 'quantum'
  | 'obsidian'
  | 'rose'
  | 'amber'
  | 'lime'
  | 'indigo'
  | 'custom';
export type NameFont = 'default' | 'display' | 'serif' | 'mono' | 'script' | 'custom';
export type AuraId =
  | 'void'
  | 'prism'
  | 'pulse'
  | 'orbit'
  | 'dashed'
  | 'double'
  | 'glow'
  | 'ticks'
  | 'glitch'
  | 'rainbow';

export interface User {
  id: string;
  username: string;
  displayName: string;
  /** Real name while a nickname is being shown instead (only on the client). */
  realName?: string;
  bio: string;
  statusText: string;
  accent: AccentId;
  aura: AuraId;
  /** The two colors of the profile effect as "#rrggbb,#rrggbb", or empty to follow the theme. */
  auraColor: string;
  pronouns: string;
  avatarImage: string | null;
  bannerImage: string | null;
  bannerColor: string;
  profileColor: string;
  nameFont: NameFont;
  avatarColor: string;
  publicKeys: PublicKeys;
  createdAt: number;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface GuildChannel {
  id: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
}

export interface GuildKeyRow {
  keyVersion: number;
  wrapperId: string;
  /** Public key of the wrapper when that person erased their account (their row is gone, the key is kept here). */
  wrapperPub?: string | null;
  iv: string;
  data: string;
}

/** A tag of a group, shown next to the name of the members who have it. */
export interface GuildTag {
  id: string;
  name: string;
  color: string;
}

export interface Guild {
  id: string;
  name: string;
  icon: string;
  iconImage: string | null;
  ownerId: string;
  keyVersion: number;
  needsRotation: boolean;
  channels: GuildChannel[];
  members: { userId: string; role: 'owner' | 'member'; tags: string[] }[];
  /** The tags of the group (only its owner creates them and gives them). */
  tags: GuildTag[];
  keys: GuildKeyRow[];
}

export interface DmSummary {
  channelId: string;
  userId: string;
  lastMessageAt: number | null;
}

export interface RawReaction {
  id: string;
  messageId: string;
  userId: string;
  iv: string;
  ciphertext: string;
  signature: string;
}

export interface RawMessage {
  id: string;
  seq: number;
  channelId: string;
  senderId: string;
  iv: string;
  ciphertext: string;
  keyVersion: number;
  signature: string;
  createdAt: number;
  editedAt: number | null;
  reactions: RawReaction[];
}

export interface CallParticipant {
  userId: string;
  muted: boolean;
  deafened: boolean;
  video: boolean;
  screen: boolean;
  joinedAt: number;
}

/** Where a channel id points: a DM with one person, or a channel of a guild. */
export type ChannelRef =
  | { kind: 'dm'; channelId: string; otherUserId: string }
  | { kind: 'guild'; channelId: string; guildId: string; name: string; type: 'text' | 'voice' };
