const MAX_CRYSTALS_PER_CHARACTER = 12;
const MAX_CRYSTALS_PER_ACCOUNT = 90;

/**
 * 주간 보스 수익 계산
 * @param {Array} characterSelections - 캐릭터별 보스 선택 데이터
 * @returns {Object} 계산 결과
 */
export function calculateRevenue(characterSelections) {
  const characterResults = [];
  const allCrystals = [];

  for (const char of characterSelections) {
    const crystals = char.selections
      .map((s) => ({
        characterId: char.id,
        characterName: char.character_name,
        bossName: s.difficulty.Boss?.name || '',
        difficulty: s.difficulty.difficulty,
        crystalPrice: Number(s.difficulty.crystal_price),
        partySize: s.party_size,
        revenue: Math.floor(Number(s.difficulty.crystal_price) / s.party_size),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, MAX_CRYSTALS_PER_CHARACTER);

    characterResults.push({
      id: char.id,
      characterName: char.character_name,
      crystalCount: crystals.length,
      maxCrystals: MAX_CRYSTALS_PER_CHARACTER,
      crystals,
    });

    allCrystals.push(...crystals);
  }

  // 계정 한도 적용: 전체에서 수익 높은 순으로 90개
  allCrystals.sort((a, b) => b.revenue - a.revenue);
  const activeCrystals = allCrystals.slice(0, MAX_CRYSTALS_PER_ACCOUNT);
  const excludedCrystals = allCrystals.slice(MAX_CRYSTALS_PER_ACCOUNT);

  const totalRevenue = activeCrystals.reduce((sum, c) => sum + c.revenue, 0);

  // 캐릭터별 소계 재계산 (계정 한도 반영)
  const activeSet = new Set(activeCrystals);
  for (const charResult of characterResults) {
    const active = charResult.crystals.filter((c) => activeSet.has(c));
    charResult.activeCount = active.length;
    charResult.revenue = active.reduce((sum, c) => sum + c.revenue, 0);
  }

  return {
    characters: characterResults,
    totalCrystals: activeCrystals.length,
    maxCrystals: MAX_CRYSTALS_PER_ACCOUNT,
    totalRevenue,
    excludedCrystals,
  };
}
