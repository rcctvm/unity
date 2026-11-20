/* Minimal client for the UNITY server API.
 * text/plain POST avoids a CORS pre-flight request, which the server does not answer. */
(function () {
  const TOKEN_STORE = 'unity.token';
  try { localStorage.removeItem('unity.key'); sessionStorage.removeItem('unity.key'); } catch (e) {} // old shared keys

  function readToken() {
    try { return localStorage.getItem(TOKEN_STORE) || sessionStorage.getItem(TOKEN_STORE) || ''; } catch (e) { return ''; }
  }
  function remembered() {
    try { return !!localStorage.getItem(TOKEN_STORE); } catch (e) { return false; }
  }
  /** remember = keep across browser restarts (localStorage) vs this browser session only. */
  function setToken(token, remember) {
    try {
      localStorage.removeItem(TOKEN_STORE); sessionStorage.removeItem(TOKEN_STORE);
      if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_STORE, token);
    } catch (e) { /* storage blocked: token lives in memory only */ }
    memToken = token;
  }
  let memToken = readToken();
  // Server data version: every response carries it; when it changes, cached pages are stale.
  let dataVersion = null;
  const versionListeners = [];

  async function call(action, params = {}) {
    const url = window.UNITY_CONFIG.API_URL;
    if (!url || url.includes('REPLACE_WITH')) throw new Error('API URL not configured (js/config.js).');
    const body = JSON.stringify({ action, token: memToken, ...params });
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow' });
    } catch (e) {
      throw new Error('Cannot reach the UNITY server. Check your connection.');
    }
    let json;
    try { json = await res.json(); } catch (e) { throw new Error('Unexpected server response.'); }
    if (json.v && json.v !== dataVersion) {
      const prev = dataVersion; dataVersion = json.v;
      if (prev !== null) versionListeners.forEach((fn) => { try { fn(json.v); } catch (e) {} });
    }
    if (json.token) setToken(json.token, remembered());   // sliding session renewal
    if (!json.ok) {
      const err = new Error(String(json.error || 'Request failed').replace(/^AUTH:\s*/, ''));
      err.auth = /^AUTH:/.test(json.error || '');
      throw err;
    }
    return json.data;
  }

  window.UnityAPI = { call, getToken: () => memToken, setToken, remembered, onVersionChange: (fn) => versionListeners.push(fn) };
})();
