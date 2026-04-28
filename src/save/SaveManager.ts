import type { SaveData, BikeUpgradeState, EffectiveBikeStats } from './types';
import { BIKE_MAP } from './bikes';

const SAVE_KEY = 'road_rash_save';

function freshSave(): SaveData {
  return {
    version: 1,
    money: 0,
    currentBike: 'stock_250',
    ownedBikes: ['stock_250'],
    unlockedLevels: [1],
    bestTimes: {},
    bikeUpgrades: {},
  };
}

export class SaveManager {
  static load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return freshSave();
      const data = JSON.parse(raw);
      if (
        typeof data?.money !== 'number' ||
        !Array.isArray(data.ownedBikes) ||
        !Array.isArray(data.unlockedLevels)
      ) return freshSave();

      return {
        version: data.version ?? 1,
        money: data.money,
        currentBike: BIKE_MAP.has(data.currentBike) ? data.currentBike : 'stock_250',
        ownedBikes: data.ownedBikes,
        unlockedLevels: data.unlockedLevels,
        bestTimes: typeof data.bestTimes === 'object' && data.bestTimes !== null ? data.bestTimes : {},
        bikeUpgrades: typeof data.bikeUpgrades === 'object' && data.bikeUpgrades !== null ? data.bikeUpgrades : {},
      };
    } catch {
      return freshSave();
    }
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable — silently fail
    }
  }

  static reset(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  static getEffectiveBikeStats(bikeId: string, upgrades: BikeUpgradeState): EffectiveBikeStats {
    const def = BIKE_MAP.get(bikeId);
    if (!def) return SaveManager.getEffectiveBikeStats('stock_250', { topSpeedLevel: 0, handlingLevel: 0 });

    let topSpeed = def.topSpeed;
    let handling = def.handling;

    for (let i = 0; i < upgrades.topSpeedLevel && i < def.upgradeTiers.topSpeed.length; i++) {
      topSpeed += def.upgradeTiers.topSpeed[i].bonus;
    }
    for (let i = 0; i < upgrades.handlingLevel && i < def.upgradeTiers.handling.length; i++) {
      handling += def.upgradeTiers.handling[i].bonus;
    }

    return {
      topSpeed,
      handling,
      color: def.color,
      motoColor: def.motoColor,
      width: def.width,
      height: def.height,
    };
  }
}
