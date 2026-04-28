import type { BikeDefinition } from './types';

const TOP_SPEED_TIERS = [
  { cost: 800,  bonus: 200 },
  { cost: 1500, bonus: 200 },
  { cost: 3000, bonus: 300 },
];

const HANDLING_TIERS = [
  { cost: 600,  bonus: 0.05 },
  { cost: 1200, bonus: 0.05 },
  { cost: 2000, bonus: 0.10 },
];

export const BIKE_DEFS: BikeDefinition[] = [
  {
    id: 'stock_250',
    name: 'Zero 250',
    topSpeed: 4500,
    handling: 1.0,
    color: '#ff4444',
    motoColor: '#aa2222',
    width: 40,
    height: 60,
    purchasePrice: 0,
    upgradeTiers: { topSpeed: TOP_SPEED_TIERS, handling: HANDLING_TIERS },
  },
  {
    id: 'sport_600',
    name: 'Viper 600',
    topSpeed: 4800,
    handling: 0.9,
    color: '#4488ff',
    motoColor: '#2255aa',
    width: 38,
    height: 65,
    purchasePrice: 5000,
    upgradeTiers: { topSpeed: TOP_SPEED_TIERS, handling: HANDLING_TIERS },
  },
  {
    id: 'beast_1000',
    name: 'T-Rex 1000',
    topSpeed: 5500,
    handling: 0.8,
    color: '#ff8800',
    motoColor: '#aa5500',
    width: 44,
    height: 70,
    purchasePrice: 15000,
    upgradeTiers: { topSpeed: TOP_SPEED_TIERS, handling: HANDLING_TIERS },
  },
];

export const BIKE_MAP = new Map(BIKE_DEFS.map(b => [b.id, b]));
