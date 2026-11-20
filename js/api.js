/* Minimal client for the UNITY Apps Script API.
 * text/plain POST avoids a CORS pre-flight, which Apps Script cannot answer. */
(function () {
  const KEY_STORE = 'unity.key';

  function getKey() {
    try { return localStorage.getItem(KEY_STORE) || sessionStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }
  function setKey(key, remember) {
    try {
      localStorage.removeItem(KEY_STORE); sessionStorage.removeItem(KEY_STORE);
      if (key) (remember ? localStorage : sessionStorage).setItem(KEY_STORE, key);
    } catch (e) { /* storage blocked: key lives in memory only */ }
    memKey = key;
  }
  let memKey = getKey();

  async function call(action, params = {}, keyOverride) {
    const url = window.UNITY_CONFIG.API_URL;
    if (!url || url.includes('REPLACE_WITH')) throw new Error('API URL not configured (js/config.js).');
    const body = JSON.stringify({ action, key: keyOverride || memKey, ...params });
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow' });
    } catch (e) {
      throw new Error('Cannot reach the UNITY server. Check your connection.');
    }
    let json;
    try { json = await res.json(); } catch (e) { throw new Error('Unexpected server response.'); }
    if (!json.ok) {
      const err = new Error(String(json.error || 'Request failed').replace(/^AUTH:\s*/, ''));
      err.auth = /^AUTH:/.test(json.error || '');
      throw err;
    }
    return json.data;
  }

  window.UnityAPI = { call, getKey: () => memKey, setKey };
})();
