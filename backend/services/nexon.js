import axios from 'axios';

const NEXON_API_BASE = 'https://open.api.nexon.com';
const NEXON_OPENID_BASE = 'https://openid.nexon.com';

export async function exchangeToken(code) {
  const { data } = await axios.post(
    `${NEXON_OPENID_BASE}/oauth2/token`,
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.NEXON_CLIENT_ID,
      client_secret: process.env.NEXON_CLIENT_SECRET,
      code,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return data;
}

export async function refreshToken(refreshToken) {
  const { data } = await axios.post(
    `${NEXON_OPENID_BASE}/oauth2/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.NEXON_CLIENT_ID,
      client_secret: process.env.NEXON_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return data;
}

export async function getUserInfo(accessToken) {
  const { data } = await axios.get(`${NEXON_OPENID_BASE}/api/v1/user/info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data.result;
}

export async function getCharacterList(accessToken) {
  const { data } = await axios.get(`${NEXON_API_BASE}/maplestory/v1/character/list`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

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
