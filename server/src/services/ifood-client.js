import { config } from '../config.js';

const BASE_URL = 'https://merchant-api.ifood.com.br';
let tokenCache = null;

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const body = new URLSearchParams({ grantType: 'client_credentials', clientId: config.IFOOD_CLIENT_ID, clientSecret: config.IFOOD_CLIENT_SECRET });
  const response = await fetch(`${BASE_URL}/authentication/v1.0/oauth/token`, { method:'POST', headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'}, body });
  if (!response.ok) throw new Error(`ifood_auth_${response.status}`);
  const data = await response.json();
  const value = data.accessToken || data.access_token;
  if (!value) throw new Error('ifood_auth_missing_token');
  tokenCache = { value, expiresAt: Date.now() + Number(data.expiresIn || data.expires_in || 300) * 1000 };
  return value;
}

async function request(path, options = {}) {
  const token = await accessToken();
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...options.headers} });
  if (!response.ok) throw new Error(`ifood_api_${response.status}`);
  if (response.status === 204) return null;
  return response.json();
}

export const IfoodClient = {
  async pollEvents() {
    const data = await request('/order/v1.0/orders:polling');
    return Array.isArray(data) ? data : data?.events || [];
  },
  getOrder(orderId) { return request(`/order/v1.0/orders/${encodeURIComponent(orderId)}`); },
  acknowledge(eventIds) { return request('/order/v1.0/orders:acknowledgment', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({acknowledgedEventIds:eventIds}) }); },
};
