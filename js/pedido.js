const api = (path) => `${location.origin}${location.pathname.includes('/pages/') ? '/api/v1' : './api/v1'}${path}`;
const form = document.querySelector('#track-form');
const tokenInput = document.querySelector('#track-token');
const result = document.querySelector('#track-result');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const render = data => { result.classList.remove('hidden'); result.innerHTML = `<h2>Pedido #${esc(data.order_number)}</h2><p><strong>Status:</strong> ${esc(data.status)}</p><p><strong>Total:</strong> R$ ${Number(data.total).toFixed(2).replace('.', ',')}</p><h3>Itens</h3><ul>${data.items.map(item => `<li>${esc(item.quantity)} × ${esc(item.name)}</li>`).join('')}</ul><h3>Histórico</h3><ol>${data.history.map(item => `<li>${esc(item.status)} — ${new Date(item.created_at).toLocaleString('pt-BR')}</li>`).join('')}</ol>`; };
const consult = async () => { result.classList.add('hidden'); try { const response = await fetch(api(`/public/orders/track/${encodeURIComponent(tokenInput.value.trim())}`), { headers: { Accept: 'application/json' }, cache: 'no-store' }); const body = await response.json(); if (!response.ok) throw new Error(body.error); render(body.data); } catch { result.classList.remove('hidden'); result.textContent = 'Não foi possível localizar este pedido. Confira o código e tente novamente.'; } };
const stored = localStorage.getItem('petisbar.lastTrackingToken'); if (stored) { tokenInput.value = stored; consult(); }
form.addEventListener('submit', event => { event.preventDefault(); consult(); });
