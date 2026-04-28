import { buildTrackData } from '@/road/testTrack';
import type { TrackDescription } from '@/road/types';
import type { LevelConfig } from './types';

const AI_COLORS: [string, string][] = [
  ['#44ff44', '#228B22'],
  ['#4444ff', '#1a1a8a'],
  ['#ffff44', '#b8a000'],
  ['#ff44ff', '#8a1a8a'],
  ['#44ffff', '#1a8a8a'],
  ['#ff8844', '#8a4400'],
  ['#88ff44', '#448a00'],
];

const TRAFFIC_COLORS: [string, string][] = [
  ['#ff8844', '#aa4400'],
  ['#8844ff', '#4a00aa'],
  ['#ff4488', '#aa0044'],
  ['#88ff44', '#44aa00'],
  ['#ff8888', '#aa4444'],
];

const LEVEL1_TRACK: TrackDescription[] = [
  { length: 12000, curve: 0,  hill: 0 },
  { length: 5000,  curve: 1,  hill: 0 },
  { length: 10000, curve: 0,  hill: 0 },
  { length: 4000,  curve: -1, hill: 0 },
  { length: 8000,  curve: 0,  hill: 0 },
  { length: 6000,  curve: 1,  hill: 0 },
  { length: 15000, curve: 0,  hill: 0 },
];

const LEVEL2_TRACK: TrackDescription[] = [
  { length: 8000,  curve: 0,  hill: 0 },
  { length: 4000,  curve: 2,  hill: 0 },
  { length: 6000,  curve: 0,  hill: 0 },
  { length: 5000,  curve: -2, hill: 0 },
  { length: 8000,  curve: 0,  hill: 1 },
  { length: 6000,  curve: 2,  hill: 0 },
  { length: 4000,  curve: 0,  hill: -1 },
  { length: 5000,  curve: -1, hill: 0 },
  { length: 8000,  curve: 0,  hill: 0 },
  { length: 5000,  curve: 2,  hill: 0 },
];

const LEVEL3_TRACK: TrackDescription[] = [
  { length: 10000, curve: 0,  hill: 0 },
  { length: 5000,  curve: 3,  hill: 0 },
  { length: 8000,  curve: 0,  hill: 0 },
  { length: 6000,  curve: -3, hill: 0 },
  { length: 4000,  curve: 0,  hill: 0 },
  { length: 4000,  curve: 4,  hill: 0 },
  { length: 10000, curve: 0,  hill: 0 },
  { length: 5000,  curve: 0,  hill: 2 },
  { length: 3000,  curve: -2, hill: 0 },
  { length: 5000,  curve: 0,  hill: -2 },
  { length: 6000,  curve: 2,  hill: 0 },
  { length: 5000,  curve: 3,  hill: 2 },
  { length: 10000, curve: 0,  hill: 0 },
];

const LEVEL4_TRACK: TrackDescription[] = [
  { length: 6000,  curve: 3,  hill: 0 },
  { length: 4000,  curve: 0,  hill: 2 },
  { length: 5000,  curve: -4, hill: 0 },
  { length: 3000,  curve: 0,  hill: -2 },
  { length: 6000,  curve: 5,  hill: 0 },
  { length: 4000,  curve: 0,  hill: 3 },
  { length: 5000,  curve: -3, hill: 0 },
  { length: 6000,  curve: 0,  hill: -3 },
  { length: 4000,  curve: 4,  hill: 0 },
  { length: 5000,  curve: 0,  hill: 2 },
  { length: 5000,  curve: -5, hill: 0 },
  { length: 4000,  curve: 0,  hill: -1 },
  { length: 6000,  curve: 3,  hill: 0 },
  { length: 5000,  curve: 0,  hill: 0 },
];

const LEVEL5_TRACK: TrackDescription[] = [
  { length: 4000,  curve: 5,  hill: 2 },
  { length: 3000,  curve: -4, hill: 0 },
  { length: 5000,  curve: 0,  hill: -3 },
  { length: 4000,  curve: 6,  hill: 0 },
  { length: 3000,  curve: 0,  hill: 3 },
  { length: 5000,  curve: -5, hill: -2 },
  { length: 4000,  curve: 0,  hill: 0 },
  { length: 3000,  curve: 4,  hill: 2 },
  { length: 5000,  curve: -6, hill: 0 },
  { length: 4000,  curve: 0,  hill: -3 },
  { length: 3000,  curve: 5,  hill: 0 },
  { length: 5000,  curve: 0,  hill: 2 },
  { length: 4000,  curve: -4, hill: -2 },
  { length: 3000,  curve: 0,  hill: 0 },
  { length: 5000,  curve: 6,  hill: 3 },
  { length: 4000,  curve: -3, hill: 0 },
  { length: 3000,  curve: 5,  hill: -3 },
];

export const level1: LevelConfig = {
  id: 1,
  name: 'City Streets',
  trackData: buildTrackData(LEVEL1_TRACK),
  timeLimit: 120,
  completionPrize: 1000,
  topSpeed: 4500,
  aiRiders: {
    count: 3,
    speedRange: [0.70, 0.80],
    weaponChance: 0.2,
    weaponPool: ['club'],
    colors: AI_COLORS,
  },
  traffic: {
    count: 2,
    speedRange: [2500, 3000],
    colors: TRAFFIC_COLORS,
  },
  police: {
    heatThreshold: 3,
    maxCount: 2,
    speedMultiplierRange: [1.0, 0.03],
    maxHealth: 120,
    acceleration: 400,
    lateralSpeed: 1.0,
    pushStrength: 0.5,
    knockbackDuration: 0.75,
  },
};

export const level2: LevelConfig = {
  id: 2,
  name: 'Country Highway',
  trackData: buildTrackData(LEVEL2_TRACK),
  timeLimit: 150,
  completionPrize: 2500,
  topSpeed: 4800,
  aiRiders: {
    count: 4,
    speedRange: [0.75, 0.85],
    weaponChance: 0.3,
    weaponPool: ['club', 'chain'],
    colors: AI_COLORS,
  },
  traffic: {
    count: 3,
    speedRange: [2800, 3200],
    colors: TRAFFIC_COLORS,
  },
  police: {
    heatThreshold: 2.5,
    maxCount: 2,
    speedMultiplierRange: [1.03, 0.04],
    maxHealth: 140,
    acceleration: 500,
    lateralSpeed: 1.2,
    pushStrength: 0.6,
    knockbackDuration: 0.75,
  },
};

export const level3: LevelConfig = {
  id: 3,
  name: 'Desert Canyon',
  trackData: buildTrackData(LEVEL3_TRACK),
  timeLimit: 180,
  completionPrize: 3500,
  topSpeed: 5000,
  aiRiders: {
    count: 5,
    speedRange: [0.75, 0.85],
    weaponChance: 0.4,
    weaponPool: ['club', 'chain'],
    colors: AI_COLORS,
  },
  traffic: {
    count: 3,
    speedRange: [2800, 3300],
    colors: TRAFFIC_COLORS,
  },
  police: {
    heatThreshold: 2,
    maxCount: 3,
    speedMultiplierRange: [1.05, 0.05],
    maxHealth: 150,
    acceleration: 600,
    lateralSpeed: 1.5,
    pushStrength: 0.8,
    knockbackDuration: 0.75,
  },
};

export const level4: LevelConfig = {
  id: 4,
  name: 'Coastal Cliffs',
  trackData: buildTrackData(LEVEL4_TRACK),
  timeLimit: 210,
  completionPrize: 5000,
  topSpeed: 5200,
  aiRiders: {
    count: 6,
    speedRange: [0.85, 0.92],
    weaponChance: 0.5,
    weaponPool: ['club', 'chain'],
    colors: AI_COLORS,
  },
  traffic: {
    count: 4,
    speedRange: [3000, 3500],
    colors: TRAFFIC_COLORS,
  },
  police: {
    heatThreshold: 2,
    maxCount: 3,
    speedMultiplierRange: [1.08, 0.06],
    maxHealth: 160,
    acceleration: 700,
    lateralSpeed: 1.8,
    pushStrength: 0.9,
    knockbackDuration: 0.75,
  },
};

export const level5: LevelConfig = {
  id: 5,
  name: 'Mountain Pass',
  trackData: buildTrackData(LEVEL5_TRACK),
  timeLimit: 240,
  completionPrize: 8000,
  topSpeed: 5500,
  aiRiders: {
    count: 7,
    speedRange: [0.83, 0.92],
    weaponChance: 0.6,
    weaponPool: ['club', 'chain'],
    colors: AI_COLORS,
  },
  traffic: {
    count: 5,
    speedRange: [3200, 3800],
    colors: TRAFFIC_COLORS,
  },
  police: {
    heatThreshold: 1.5,
    maxCount: 3,
    speedMultiplierRange: [1.10, 0.07],
    maxHealth: 180,
    acceleration: 800,
    lateralSpeed: 2.0,
    pushStrength: 1.0,
    knockbackDuration: 0.75,
  },
};

export const LEVELS: LevelConfig[] = [level1, level2, level3, level4, level5];
