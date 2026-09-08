document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('login-form');
  const errorElement = document.getElementById('login-error');
  const submit = document.getElementById('login-submit');
  const nextValue = new URLSearchParams(window.location.search).get('next') || 'dashboard.html';
  const next = /^[a-z0-9-]+\.html$/i.test(nextValue) && nextValue !== 'login.html' ? nextValue : 'dashboard.html';

  if (!API.isServerMode()) {
    window.location.replace(next);
    return;
  }
  try {
    await API._request('/auth/me', { redirectOnUnauthorized: false });
    window.location.replace(next);
    return;
  } catch (error) {
    if (error.status !== 401) errorElement.textContent = 'O servidor está indisponível no momento.';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorElement.textContent = '';
    submit.disabled = true;
    submit.textContent = 'Entrando…';
    try {
      await API.login(form.email.value.trim(), form.password.value);
      window.location.replace(next);
    } catch (error) {
      errorElement.textContent = error.status === 401
        ? 'E-mail ou senha incorretos.'
        : 'Não foi possível entrar. Tente novamente.';
      form.password.value = '';
      form.password.focus();
    } finally {
      submit.disabled = false;
      submit.textContent = 'Entrar';
    }
  });
});
