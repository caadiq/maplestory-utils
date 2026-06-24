import { Image } from './Image.js';
import { Menu } from './Menu.js';
import { SundayMaple } from './SundayMaple.js';
import { BossCrystalBoss } from './boss-crystal/Boss.js';
import { BossCrystalBossDifficulty } from './boss-crystal/BossDifficulty.js';
import { Symbol } from './symbol/Symbol.js';
import { SymbolLevel } from './symbol/SymbolLevel.js';
import { GenesisPass } from './genesis-pass/GenesisPass.js';
import { User } from './user/User.js';
import { Session } from './user/Session.js';

// User <-> Session
User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions', onDelete: 'CASCADE' });
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Menu <-> Image
Menu.belongsTo(Image, { foreignKey: 'image_id', as: 'image', onDelete: 'SET NULL' });

// GenesisPass <-> Image
GenesisPass.belongsTo(Image, { foreignKey: 'image_id', as: 'image', onDelete: 'SET NULL' });

// BossCrystal Boss <-> Difficulty
BossCrystalBoss.hasMany(BossCrystalBossDifficulty, {
  foreignKey: 'boss_id',
  as: 'difficulties',
  onDelete: 'CASCADE',
});
BossCrystalBossDifficulty.belongsTo(BossCrystalBoss, { foreignKey: 'boss_id', as: 'boss' });

// Symbol <-> SymbolLevel
Symbol.hasMany(SymbolLevel, {
  foreignKey: 'symbol_id',
  as: 'levels',
  onDelete: 'CASCADE',
});
SymbolLevel.belongsTo(Symbol, { foreignKey: 'symbol_id', as: 'symbol' });

export { Image, Menu, SundayMaple, BossCrystalBoss, BossCrystalBossDifficulty, Symbol, SymbolLevel, GenesisPass, User, Session };
