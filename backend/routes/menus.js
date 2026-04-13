import { Router } from 'express';
import { Menu, Image } from '../models/index.js';
import { getPublicUrl } from '../lib/s3.js';

const router = Router();

function serialize(menu) {
  const json = menu.toJSON();
  return {
    id: json.id,
    title: json.title,
    description: json.description,
    url: json.url,
    sort_order: json.sort_order,
    image_id: json.image_id,
    image: json.image ? { id: json.image.id, name: json.image.name, url: getPublicUrl(json.image.path) } : null,
  };
}

// 공개 메뉴 목록 (홈 화면용)
router.get('/', async (_req, res) => {
  try {
    const menus = await Menu.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      include: [{ model: Image, as: 'image' }],
    });
    res.json(menus.map(serialize));
  } catch (err) {
    console.error('메뉴 목록 조회 오류:', err.message);
    res.status(500).json({ error: '메뉴 목록 조회 실패' });
  }
});

export default router;
