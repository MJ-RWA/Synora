export interface ChatMessageTheme {
  id: string;
  name: string;
  bubbleBg: string;
  bubbleBorder: string;
  bubbleText: string;
  accentBorder: string;
  nameColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  label?: string;
  avatarBg: string;
}

export const HOST_THEME: ChatMessageTheme = {
  id: 'host',
  name: 'Host Emerald',
  bubbleBg: 'bg-emerald-950/50',
  bubbleBorder: 'border-emerald-500/40',
  bubbleText: 'text-emerald-50',
  accentBorder: 'border-l-2 border-l-emerald-400',
  nameColor: 'text-emerald-400',
  badgeBg: 'bg-emerald-500/25',
  badgeText: 'text-emerald-300',
  badgeBorder: 'border-emerald-500/40',
  label: 'Host',
  avatarBg: 'bg-emerald-500/30 text-emerald-300'
};

export const PARTICIPANT_THEMES: ChatMessageTheme[] = [
  {
    id: 'sky',
    name: 'Sky Blue',
    bubbleBg: 'bg-sky-950/45',
    bubbleBorder: 'border-sky-500/35',
    bubbleText: 'text-sky-50',
    accentBorder: 'border-l-2 border-l-sky-400',
    nameColor: 'text-sky-400',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-300',
    badgeBorder: 'border-sky-500/30',
    avatarBg: 'bg-sky-500/30 text-sky-200'
  },
  {
    id: 'violet',
    name: 'Violet Purple',
    bubbleBg: 'bg-purple-950/45',
    bubbleBorder: 'border-purple-500/35',
    bubbleText: 'text-purple-50',
    accentBorder: 'border-l-2 border-l-purple-400',
    nameColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300',
    badgeBorder: 'border-purple-500/30',
    avatarBg: 'bg-purple-500/30 text-purple-200'
  },
  {
    id: 'amber',
    name: 'Warm Amber',
    bubbleBg: 'bg-amber-950/45',
    bubbleBorder: 'border-amber-500/35',
    bubbleText: 'text-amber-50',
    accentBorder: 'border-l-2 border-l-amber-400',
    nameColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-500/30',
    avatarBg: 'bg-amber-500/30 text-amber-200'
  },
  {
    id: 'rose',
    name: 'Rose Crimson',
    bubbleBg: 'bg-rose-950/45',
    bubbleBorder: 'border-rose-500/35',
    bubbleText: 'text-rose-50',
    accentBorder: 'border-l-2 border-l-rose-400',
    nameColor: 'text-rose-400',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    badgeBorder: 'border-rose-500/30',
    avatarBg: 'bg-rose-500/30 text-rose-200'
  },
  {
    id: 'indigo',
    name: 'Deep Indigo',
    bubbleBg: 'bg-indigo-950/45',
    bubbleBorder: 'border-indigo-500/35',
    bubbleText: 'text-indigo-50',
    accentBorder: 'border-l-2 border-l-indigo-400',
    nameColor: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/20',
    badgeText: 'text-indigo-300',
    badgeBorder: 'border-indigo-500/30',
    avatarBg: 'bg-indigo-500/30 text-indigo-200'
  },
  {
    id: 'orange',
    name: 'Bright Orange',
    bubbleBg: 'bg-orange-950/45',
    bubbleBorder: 'border-orange-500/35',
    bubbleText: 'text-orange-50',
    accentBorder: 'border-l-2 border-l-orange-400',
    nameColor: 'text-orange-400',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-300',
    badgeBorder: 'border-orange-500/30',
    avatarBg: 'bg-orange-500/30 text-orange-200'
  },
  {
    id: 'teal',
    name: 'Teal Green',
    bubbleBg: 'bg-teal-950/45',
    bubbleBorder: 'border-teal-500/35',
    bubbleText: 'text-teal-50',
    accentBorder: 'border-l-2 border-l-teal-400',
    nameColor: 'text-teal-400',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-300',
    badgeBorder: 'border-teal-500/30',
    avatarBg: 'bg-teal-500/30 text-teal-200'
  },
  {
    id: 'fuchsia',
    name: 'Fuchsia Pink',
    bubbleBg: 'bg-fuchsia-950/45',
    bubbleBorder: 'border-fuchsia-500/35',
    bubbleText: 'text-fuchsia-50',
    accentBorder: 'border-l-2 border-l-fuchsia-400',
    nameColor: 'text-fuchsia-400',
    badgeBg: 'bg-fuchsia-500/20',
    badgeText: 'text-fuchsia-300',
    badgeBorder: 'border-fuchsia-500/30',
    avatarBg: 'bg-fuchsia-500/30 text-fuchsia-200'
  },
  {
    id: 'cyan',
    name: 'Electric Cyan',
    bubbleBg: 'bg-cyan-950/45',
    bubbleBorder: 'border-cyan-500/35',
    bubbleText: 'text-cyan-50',
    accentBorder: 'border-l-2 border-l-cyan-400',
    nameColor: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-300',
    badgeBorder: 'border-cyan-500/30',
    avatarBg: 'bg-cyan-500/30 text-cyan-200'
  }
];

function hashString(str: string): number {
  let hash = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Returns a distinct color theme for any chat participant.
 * If isHost is true, returns the authoritative Host theme (Emerald).
 * Otherwise deterministically hashes the user's identifier (UID or username)
 * to assign one of 9 rich participant themes.
 */
export function getChatMessageTheme(
  identifier: string,
  isHost: boolean = false
): ChatMessageTheme {
  if (isHost) {
    return HOST_THEME;
  }
  const cleanKey = (identifier || 'anonymous').trim().toLowerCase();
  const index = hashString(cleanKey) % PARTICIPANT_THEMES.length;
  return PARTICIPANT_THEMES[index];
}
