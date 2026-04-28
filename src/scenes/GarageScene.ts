import Phaser from 'phaser';
import { ctx } from '@/main';
import { SaveManager } from '@/save';
import { BIKE_DEFS } from '@/save';
import type { SaveData, EffectiveBikeStats } from '@/save';
import { fillBg, drawTitle, drawText, drawMenuItem, drawStatBar, drawMoney, centerX } from './CanvasUI';

export class GarageScene extends Phaser.Scene {
  private saveData!: SaveData;
  private bikeStats!: EffectiveBikeStats;
  private tab = 0; // 0=bikes, 1=upgrades
  private sel = 0;
  private msg = '';
  private msgTimer = 0;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private tabKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('GarageScene');
  }

  create(): void {
    this.saveData = SaveManager.load();
    this.refreshBikeStats();
    this.tab = 0;
    this.sel = 0;
    this.msg = '';
    this.msgTimer = 0;

    const kb = this.input.keyboard!;
    this.cursorKeys = kb.createCursorKeys();
    this.enterKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.tabKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const h = this.scale.height;
      const w = this.scale.width;
      if (p.y < h * 0.15) {
        // top = tab switch
        this.tab = this.tab === 0 ? 1 : 0;
        this.sel = 0;
      } else if (p.y > h * 0.75) {
        // bottom = back to level select
        this.scene.start('LevelSelectScene');
      } else if (p.x < w * 0.3) {
        this.sel = Math.max(0, this.sel - 1);
      } else if (p.x > w * 0.7) {
        this.sel = Math.min(
          this.tab === 0 ? BIKE_DEFS.length - 1 : this.getUpgradeCount() - 1,
          this.sel + 1,
        );
      } else {
        // center = enter
        if (this.tab === 0) this.handleBikeAction();
        else this.handleUpgradeAction();
      }
    });
  }

  private refreshBikeStats(): void {
    const ups = this.saveData.bikeUpgrades[this.saveData.currentBike] ?? { topSpeedLevel: 0, handlingLevel: 0 };
    this.bikeStats = SaveManager.getEffectiveBikeStats(this.saveData.currentBike, ups);
  }

  update(_time: number, delta: number): void {
    if (this.msgTimer > 0) this.msgTimer -= delta / 1000;

    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.scene.start('LevelSelectScene');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.tabKey)) {
      this.tab = this.tab === 0 ? 1 : 0;
      this.sel = 0;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.up)) {
      this.sel = Math.max(0, this.sel - 1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.down)) {
      const max = this.tab === 0 ? BIKE_DEFS.length - 1 : this.getUpgradeCount() - 1;
      this.sel = Math.min(max, this.sel + 1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      if (this.tab === 0) this.handleBikeAction();
      else this.handleUpgradeAction();
    }

    this.render();
  }

  private handleBikeAction(): void {
    const bike = BIKE_DEFS[this.sel];
    const owned = this.saveData.ownedBikes.includes(bike.id);
    if (owned) {
      this.saveData.currentBike = bike.id;
      SaveManager.save(this.saveData);
      this.refreshBikeStats();
      this.showMsg('EQUIPPED!');
    } else if (this.saveData.money >= bike.purchasePrice) {
      this.saveData.money -= bike.purchasePrice;
      this.saveData.ownedBikes.push(bike.id);
      this.saveData.currentBike = bike.id;
      SaveManager.save(this.saveData);
      this.refreshBikeStats();
      this.showMsg('PURCHASED!');
    } else {
      this.showMsg('NOT ENOUGH MONEY');
    }
  }

  private handleUpgradeAction(): void {
    const bikeId = this.saveData.currentBike;
    const def = BIKE_DEFS.find(b => b.id === bikeId);
    if (!def) return;

    const upgrades = this.saveData.bikeUpgrades[bikeId] ?? { topSpeedLevel: 0, handlingLevel: 0 };
    const isSpeed = this.sel < def.upgradeTiers.topSpeed.length;
    const levelKey = isSpeed ? 'topSpeedLevel' : 'handlingLevel';
    const tiers = isSpeed ? def.upgradeTiers.topSpeed : def.upgradeTiers.handling;
    const currentLevel = upgrades[levelKey];

    if (currentLevel >= tiers.length) {
      this.showMsg('ALREADY MAXED');
      return;
    }

    const nextTier = tiers[currentLevel];
    if (!nextTier) return;

    if (this.saveData.money >= nextTier.cost) {
      this.saveData.money -= nextTier.cost;
      upgrades[levelKey] = currentLevel + 1;
      this.saveData.bikeUpgrades[bikeId] = upgrades;
      SaveManager.save(this.saveData);
      this.refreshBikeStats();
      this.showMsg('UPGRADED!');
    } else {
      this.showMsg('NOT ENOUGH MONEY');
    }
  }

  private getUpgradeCount(): number {
    const def = BIKE_DEFS.find(b => b.id === this.saveData.currentBike);
    return def ? def.upgradeTiers.topSpeed.length + def.upgradeTiers.handling.length : 0;
  }

  private showMsg(text: string): void {
    this.msg = text;
    this.msgTimer = 1.5;
  }

  private render(): void {
    fillBg('#0a0a1e');
    drawTitle('GARAGE', 40);
    drawMoney(this.saveData.money);

    const cx = centerX();
    const leftX = cx - 240;
    const y0 = 100;

    // Tabs
    drawText('[BIKES]', cx - 80, y0, { color: this.tab === 0 ? '#ffcc00' : '#555555', size: 18, align: 'center' });
    drawText('[UPGRADES]', cx + 80, y0, { color: this.tab === 1 ? '#ffcc00' : '#555555', size: 18, align: 'center' });

    if (this.tab === 0) {
      this.renderBikeList(leftX, y0 + 50);
    } else {
      this.renderUpgrades(leftX, y0 + 50);
    }

    // Current bike stats
    const sy = ctx.canvas.height - 140;
    drawText('--- Current Bike ---', cx, sy, { color: '#888888', size: 14, align: 'center' });
    drawStatBar('TOP SPEED', this.bikeStats.topSpeed, 6500, leftX, sy + 30);
    drawStatBar('HANDLING', this.bikeStats.handling, 1.3, leftX, sy + 60);

    // Controls
    drawText('TAB: Switch  |  ENTER: Buy/Equip  |  ESC: Race', cx, ctx.canvas.height - 20, { color: '#555555', size: 13, align: 'center' });

    // Message
    if (this.msgTimer > 0) {
      drawText(this.msg, cx, ctx.canvas.height - 50, { color: '#ffcc00', size: 22, align: 'center' });
    }
  }

  private renderBikeList(x: number, y: number): void {
    for (let i = 0; i < BIKE_DEFS.length; i++) {
      const b = BIKE_DEFS[i];
      const owned = this.saveData.ownedBikes.includes(b.id);
      const equipped = this.saveData.currentBike === b.id;
      const sel = this.tab === 0 && this.sel === i;

      const label = equipped ? `${b.name}  [EQUIPPED]` : owned ? `${b.name}  [OWNED]` : `${b.name}  $${b.purchasePrice}`;
      drawMenuItem(label, y + i * 36, sel);

      if (sel) {
        drawStatBar('Speed', b.topSpeed, 6500, x + 320, y + i * 36 - 8, 100);
        drawStatBar('Handle', b.handling, 1.3, x + 320, y + i * 36 + 14, 100);
      }
    }
  }

  private renderUpgrades(_x: number, y: number): void {
    const def = BIKE_DEFS.find(b => b.id === this.saveData.currentBike);
    if (!def) return;

    const ups = this.saveData.bikeUpgrades[this.saveData.currentBike] ?? { topSpeedLevel: 0, handlingLevel: 0 };

    drawText(`Upgrades for ${def.name}`, centerX(), y - 10, { color: '#cccccc', size: 16, align: 'center' });

    let row = 0;
    for (let i = 0; i < def.upgradeTiers.topSpeed.length; i++) {
      const t = def.upgradeTiers.topSpeed[i];
      const bought = i < ups.topSpeedLevel;
      const label = `SPD Lv${i + 1}: $${t.cost} (+${t.bonus}) ${bought ? '[DONE]' : ''}`;
      drawMenuItem(label, y + 30 + row * 34, this.tab === 1 && this.sel === row);
      row++;
    }
    for (let i = 0; i < def.upgradeTiers.handling.length; i++) {
      const t = def.upgradeTiers.handling[i];
      const bought = i < ups.handlingLevel;
      const label = `HND Lv${i + 1}: $${t.cost} (+${t.bonus.toFixed(2)}) ${bought ? '[DONE]' : ''}`;
      drawMenuItem(label, y + 30 + row * 34, this.tab === 1 && this.sel === row);
      row++;
    }
  }
}
