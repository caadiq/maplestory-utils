import { Boss } from './boss/Boss.js';
import { BossDifficulty } from './boss/BossDifficulty.js';

// Boss <-> BossDifficulty
Boss.hasMany(BossDifficulty, { foreignKey: 'boss_id', as: 'difficulties' });
BossDifficulty.belongsTo(Boss, { foreignKey: 'boss_id' });

export { Boss, BossDifficulty };
