/* Per-device display preferences (stored in this browser only). Loaded in <head> so the
 * chosen font applies before the page is drawn. */
(function () {
  var KEY = 'unity.font';
  var FONTS = { 'default': '', courier: 'font-courier' };
  function get() { try { return localStorage.getItem(KEY) || 'default'; } catch (e) { return 'default'; } }
  function apply(v) {
    var el = document.documentElement;
    Object.keys(FONTS).forEach(function (k) { if (FONTS[k]) el.classList.remove(FONTS[k]); });
    if (FONTS[v]) el.classList.add(FONTS[v]);
  }
  function set(v) { if (!(v in FONTS)) v = 'default'; try { localStorage.setItem(KEY, v); } catch (e) {} apply(v); }
  apply(get());
  window.UnityPrefs = { getFont: get, setFont: set };
})();
