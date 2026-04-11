import axios from 'axios';

const NEXON_API_BASE = 'https://open.api.nexon.com';

export async function getCharacterOcid(characterName) {
  const { data } = await axios.get(`${NEXON_API_BASE}/maplestory/v1/id`, {
    params: { character_name: characterName },
    headers: { 'x-nxopen-api-key': process.env.NEXON_API_KEY },
  });
  return data.ocid;
}

export async function getCharacterBasic(ocid) {
  const { data } = await axios.get(`${NEXON_API_BASE}/maplestory/v1/character/basic`, {
    params: { ocid },
    headers: { 'x-nxopen-api-key': process.env.NEXON_API_KEY },
  });
  return data;
}
