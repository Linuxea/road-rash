export type AIStateType = 'normal' | 'avoid' | 'attacked' | 'attacking';

export type AttackType = 'punch_left' | 'punch_right' | 'kick';

export type CollisionType = 'traffic_crash' | 'ai_push';

export type WeaponType = 'fist' | 'club' | 'chain';

export interface WeaponConfig {
  damageMultiplier: number;
  rangeMultiplier: number;
  maxDurability: number;
  label: string;
  color: string;
}

export const WEAPON_CONFIGS: Record<Exclude<WeaponType, 'fist'>, WeaponConfig> = {
  club:  { damageMultiplier: 1.5, rangeMultiplier: 1.0, maxDurability: 5, label: 'CLUB',  color: '#c86428' },
  chain: { damageMultiplier: 1.0, rangeMultiplier: 1.3, maxDurability: 4, label: 'CHAIN', color: '#aaaaaa' },
};

export const FIST_CONFIG: WeaponConfig = {
  damageMultiplier: 1.0,
  rangeMultiplier: 1.0,
  maxDurability: Infinity,
  label: 'FIST',
  color: '#ffcc88',
};

export const POLICE_RIDER_COLOR = '#4488ff';
export const POLICE_MOTO_COLOR = '#ffffff';

export const AI_MAX_HEALTH = 100;

export interface WeaponPickup {
  worldZ: number;
  laneX: number;
  weaponType: Exclude<WeaponType, 'fist'>;
  flashTimer: number;
}

export interface AttackResult {
  hit: boolean;
  damage: number;
  disarmedWeapon: WeaponType | null;
}

export interface CollisionResult {
  entity: Entity;
  type: CollisionType;
}

export interface Entity {
  type: 'ai_rider' | 'traffic' | 'police';
  worldZ: number;
  laneX: number;
  speed: number;
  width: number;
  height: number;
  color: string;
  motoColor?: string;
  aiState?: AIStateType;
  targetSpeed?: number;
  health?: number;
  knockedOut?: boolean;
  knockbackTimer?: number;
  weapon?: WeaponType;
}
