import { Image } from './Image.js';
import { Menu } from './Menu.js';

// Menu <-> Image (선택적 FK)
Menu.belongsTo(Image, { foreignKey: 'image_id', as: 'image', onDelete: 'SET NULL' });

export { Image, Menu };
