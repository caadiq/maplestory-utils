/**
 * 헥사매트릭스 응답 → 코어 목록(이름·타입·레벨·아이콘).
 *
 * 아이콘은 hexamatrix 응답에 없어서 6차 스킬 목록(skill_icon 포함)과 스킬명으로 매칭한다.
 * 코어에 따라 이름 규칙이 제각각이다 — 렌의 "창룡파천검 : 일매낙화 천비인적"은
 * linked_skill이 "…-낙화/-진천/-천강"으로 갈라져 있는데 6차 스킬 목록에는 코어명
 * 그대로만 있다. 그래서 후보를 넓게 시도한다.
 */
export function parseCores(hexa, skill6) {
  const iconBySkill = new Map(
    (skill6.character_skill || []).map((s) => [s.skill_name, s.skill_icon]),
  );

  const findIcon = (c) => {
    const candidates = [c.hexa_core_name];
    for (const l of c.linked_skill || []) {
      const id = l.hexa_skill_id || '';
      candidates.push(id, `${id} VI`, id.replace(/-[^-]*$/, ''));
    }
    for (const name of candidates) {
      const icon = iconBySkill.get(name);
      if (icon) return icon;
    }
    return null;
  };

  return (hexa.character_hexa_core_equipment || []).map((c) => ({
    name: c.hexa_core_name,
    type: c.hexa_core_type,             // 스킬 코어 | 마스터리 코어 | 강화 코어 | 공용 코어
    level: c.hexa_core_level,
    icon: findIcon(c),
  }));
}
