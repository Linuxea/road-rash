import type { TrackData } from '@/road/types';
import type { WeaponType } from '@/entities/types';

export interface AIRiderSpawnConfig {
  count: number;
  speedRange: [number, number];
  weaponChance: number;
  weaponPool: Exclude<WeaponType, 'fist'>[];
  colors: [string, string][];
}

export interface TrafficSpawnConfig {
  count: number;
  speedRange: [number, number];
  colors: [string, string][];
}

export interface PoliceConfig {
  heatThreshold: number;
  maxCount: number;
  speedMultiplierRange: [number, number];
  maxHealth: number;
  acceleration: number;
  lateralSpeed: number;
  pushStrength: number;
  knockbackDuration: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  trackData: TrackData;
  timeLimit: number;
  completionPrize: number;
  topSpeed: number;
  aiRiders: AIRiderSpawnConfig;
  traffic: TrafficSpawnConfig;
  police: PoliceConfig;
}
