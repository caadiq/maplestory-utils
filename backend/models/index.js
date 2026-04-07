import { User } from './User.js';
import { UserCharacter } from './UserCharacter.js';
import { Boss } from './boss/Boss.js';
import { BossDifficulty } from './boss/BossDifficulty.js';
import { UserBossSelection } from './boss/UserBossSelection.js';

// User <-> UserCharacter
User.hasMany(UserCharacter, { foreignKey: 'user_id', as: 'characters' });
UserCharacter.belongsTo(User, { foreignKey: 'user_id' });

// Boss <-> BossDifficulty
Boss.hasMany(BossDifficulty, { foreignKey: 'boss_id', as: 'difficulties' });
BossDifficulty.belongsTo(Boss, { foreignKey: 'boss_id' });

// UserBossSelection 관계
UserBossSelection.belongsTo(User, { foreignKey: 'user_id' });
UserBossSelection.belongsTo(UserCharacter, { foreignKey: 'user_character_id', as: 'character' });
UserBossSelection.belongsTo(BossDifficulty, { foreignKey: 'boss_difficulty_id', as: 'difficulty' });
UserCharacter.hasMany(UserBossSelection, { foreignKey: 'user_character_id', as: 'selections' });

export { User, UserCharacter, Boss, BossDifficulty, UserBossSelection };
