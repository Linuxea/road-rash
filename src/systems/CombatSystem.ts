import type { Entity, AttackType, WeaponType, AttackResult } from '@/entities/types';
import { WEAPON_CONFIGS, FIST_CONFIG, AI_MAX_HEALTH } from '@/entities/types';
import type { ZMapper } from '@/road/ZMapper';
import type { EntityManager } from '@/entities/EntityManager';

const PUNCH_DAMAGE = 10;
const KICK_DAMAGE = 18;
const PUNCH_COOLDOWN = 0.35;
const KICK_COOLDOWN = 0.55;
const PUNCH_HIT_CHANCE = 0.80;
const KICK_HIT_CHANCE = 0.65;
const HIT_FLASH_FRAMES = 3;
const FLOAT_TEXT_FRAMES = 45;
const MELEE_DEPTH = 800;
const DISARM_CHANCE = 0.30;

interface HitFlash {
  screenX: number;
  screenY: number;
  pw: number;
  ph: number;
  remainingFrames: number;
}

interface FloatingText {
  screenX: number;
  screenY: number;
  text: string;
  color: string;
  remainingFrames: number;
  totalFrames: number;
}

export class CombatSystem {
  private cooldowns: Map<AttackType, number>;
  private hitFlashes: HitFlash[];
  private floatingTexts: FloatingText[];

  constructor() {
    this.cooldowns = new Map();
    this.hitFlashes = [];
    this.floatingTexts = [];
  }

  update(dt: number): void {
    for (const [key, remaining] of this.cooldowns) {
      const updated = remaining - dt;
      if (updated <= 0) {
        this.cooldowns.delete(key);
      } else {
        this.cooldowns.set(key, updated);
      }
    }
  }

  tryAttack(
    type: AttackType,
    target: Entity | null,
    cameraZ: number,
    playerX: number,
    zMapper: ZMapper,
    entityManager: EntityManager,
    playerWeapon: WeaponType,
  ): AttackResult {
    const isPunch = type === 'punch_left' || type === 'punch_right';
    const cooldownKey: AttackType = isPunch ? 'punch_left' : 'kick';

    if ((this.cooldowns.get(cooldownKey) ?? 0) > 0) {
      return { hit: false, damage: 0, disarmedWeapon: null };
    }

    const cooldown = isPunch ? PUNCH_COOLDOWN : KICK_COOLDOWN;
    this.cooldowns.set(cooldownKey, cooldown);

    if (!target) {
      return { hit: false, damage: 0, disarmedWeapon: null };
    }

    const coords = entityManager.getEntityScreenCoords(target, cameraZ, playerX, zMapper);
    if (!coords) {
      return { hit: false, damage: 0, disarmedWeapon: null };
    }

    const baseChance = isPunch ? PUNCH_HIT_CHANCE : KICK_HIT_CHANCE;
    const dz = Math.abs(target.worldZ - cameraZ);
    const hitChance = baseChance * (1 - dz / MELEE_DEPTH);
    const hit = Math.random() < hitChance;

    if (!hit) {
      this.floatingTexts.push({
        screenX: coords.screenX,
        screenY: coords.screenY - coords.ph - 20,
        text: 'MISS',
        color: '#ff4444',
        remainingFrames: FLOAT_TEXT_FRAMES,
        totalFrames: FLOAT_TEXT_FRAMES,
      });
      return { hit: false, damage: 0, disarmedWeapon: null };
    }

    const cfg = playerWeapon === 'fist' ? FIST_CONFIG : WEAPON_CONFIGS[playerWeapon];
    const baseDamage = isPunch ? PUNCH_DAMAGE : KICK_DAMAGE;
    const damage = Math.round(baseDamage * cfg.damageMultiplier);
    target.health = (target.health ?? AI_MAX_HEALTH) - damage;
    entityManager.hitAIRider(target);

    this.hitFlashes.push({
      screenX: coords.screenX - coords.pw / 2,
      screenY: coords.screenY - coords.ph,
      pw: coords.pw,
      ph: coords.ph,
      remainingFrames: HIT_FLASH_FRAMES,
    });

    this.floatingTexts.push({
      screenX: coords.screenX,
      screenY: coords.screenY - coords.ph - 20,
      text: `-${damage}`,
      color: '#ffff00',
      remainingFrames: FLOAT_TEXT_FRAMES,
      totalFrames: FLOAT_TEXT_FRAMES,
    });

    let disarmedWeapon: WeaponType | null = null;
    if (target.weapon && target.weapon !== 'fist' && Math.random() < DISARM_CHANCE) {
      disarmedWeapon = target.weapon;
      target.weapon = undefined;
      this.floatingTexts.push({
        screenX: coords.screenX,
        screenY: coords.screenY - coords.ph - 40,
        text: 'DISARMED!',
        color: '#00ffff',
        remainingFrames: FLOAT_TEXT_FRAMES,
        totalFrames: FLOAT_TEXT_FRAMES,
      });
    }

    return { hit: true, damage, disarmedWeapon };
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (let i = this.hitFlashes.length - 1; i >= 0; i--) {
      const flash = this.hitFlashes[i];
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(flash.screenX - 4, flash.screenY - 4, flash.pw + 8, flash.ph + 8);
      flash.remainingFrames--;
      if (flash.remainingFrames <= 0) this.hitFlashes.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      const alpha = ft.remainingFrames / ft.totalFrames;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.screenX, ft.screenY);
      ctx.restore();
      ft.screenY -= 1;
      ft.remainingFrames--;
      if (ft.remainingFrames <= 0) this.floatingTexts.splice(i, 1);
    }
  }
}
