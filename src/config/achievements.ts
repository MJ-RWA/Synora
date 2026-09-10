import { AchievementBadge } from '../types';

export const SYNORA_ACHIEVEMENTS: AchievementBadge[] = [
  {
    id: 'first_party',
    name: 'Party Starter',
    description: 'Joined your first Synora synchronized watch party.',
    icon: 'Sparkles',
    tier: 'bronze',
  },
  {
    id: 'party_host',
    name: 'Host with the Most',
    description: 'Created and hosted a live watch party room.',
    icon: 'Crown',
    tier: 'gold',
  },
  {
    id: 'cinephile',
    name: 'Cinephile',
    description: 'Watched 30 minutes of video together with friends.',
    icon: 'Film',
    tier: 'bronze',
  },
  {
    id: 'movie_marathoner',
    name: 'Movie Marathoner',
    description: 'Accumulated over 2 hours of active watch party viewing.',
    icon: 'Flame',
    tier: 'silver',
  },
  {
    id: 'social_butterfly',
    name: 'Squad Goals',
    description: 'Connected with 3 or more friends on Synora.',
    icon: 'Users',
    tier: 'silver',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Enjoyed a late-night watch party past midnight.',
    icon: 'Moon',
    tier: 'diamond',
  },
];
