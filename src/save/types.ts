export interface BikeUpgradeTier {
  cost: number;
  bonus: number;
}

export interface BikeUpgradeTiers {
  topSpeed: BikeUpgradeTier[];
  handling: BikeUpgradeTier[];
}

export interface BikeDefinition {
  id: string;
  name: string;
  topSpeed: number;
  handling: number;
  color: string;
  motoColor: string;
  width: number;
  height: number;
  purchasePrice: number;
  upgradeTiers: BikeUpgradeTiers;
}

export interface BikeUpgradeState {
  topSpeedLevel: number;
  handlingLevel: number;
}

export interface EffectiveBikeStats {
  topSpeed: number;
  handling: number;
  color: string;
  motoColor: string;
  width: number;
  height: number;
}

export interface SaveData {
  version: number;
  money: number;
  currentBike: string;
  ownedBikes: string[];
  unlockedLevels: number[];
  bestTimes: Record<number, number>;
  bikeUpgrades: Record<string, BikeUpgradeState>;
}
