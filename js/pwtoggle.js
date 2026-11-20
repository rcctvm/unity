/* Show/hide ("eye") button for every password field in UNITY, including fields added later
 * (Settings and dialogs are drawn dynamically). Call UnityPw.hideAll() to re-mask everything. */
(function () {
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function setShown(input, btn, shown) {
    input.type = shown ? 'text' : 'password';
    btn.innerHTML = shown ? EYE_OFF : EYE;
    btn.setAttribute('aria-pressed', shown ? 'true' : 'false');
    btn.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
    btn.title = shown ? 'Hide password' : 'Show password';
  }

  function enhance(input) {
    if (input.dataset.pwEye) return;
    input.dataset.pwEye = '1';
    var wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-eye';
    wrap.appendChild(btn);
    setShown(input, btn, false);
    // mousedown: keep focus (and the caret) in the field while toggling
    btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    btn.addEventListener('click', function () {
      var pos = input.selectionStart;
      setShown(input, btn, input.type === 'password');
      if (document.activeElement === input && pos != null) { try { input.setSelectionRange(pos, pos); } catch (e) {} }
    });
    var form = input.form;
    if (form && !form.dataset.pwHideOnSubmit) {
      form.dataset.pwHideOnSubmit = '1';
      form.addEventListener('submit', function () { hideAll(form); });
      form.addEventListener('reset', function () { hideAll(form); });
    }
  }

  function hideAll(root) {
    (root || document).querySelectorAll('.pw-wrap').forEach(function (w) {
      var input = w.querySelector('input'), btn = w.querySelector('.pw-eye');
      if (input && btn) setShown(input, btn, false);
    });
  }

  function scan(root) {
    (root || document).querySelectorAll('input[type=password]:not([data-pw-eye])').forEach(enhance);
  }

  scan(document);
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) if (muts[i].addedNodes.length) { scan(document); return; }
  }).observe(document.body, { childList: true, subtree: true });

  window.UnityPw = { hideAll: hideAll, scan: scan };
})();
