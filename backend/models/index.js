import { Image } from './Image.js';
import { Menu } from './Menu.js';
import { BossCrystalBoss } from './boss-crystal/Boss.js';
import { BossCrystalBossDifficulty } from './boss-crystal/BossDifficulty.js';

// Menu <-> Image
Menu.belongsTo(Image, { foreignKey: 'image_id', as: 'image', onDelete: 'SET NULL' });

// BossCrystal Boss <-> Difficulty
BossCrystalBoss.hasMany(BossCrystalBossDifficulty, {
  foreignKey: 'boss_id',
  as: 'difficulties',
  onDelete: 'CASCADE',
});
BossCrystalBossDifficulty.belongsTo(BossCrystalBoss, { foreignKey: 'boss_id', as: 'boss' });

export { Image, Menu, BossCrystalBoss, BossCrystalBossDifficulty };
