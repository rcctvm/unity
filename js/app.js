/* UNITY — single-page front end (no build step). */
(function () {
  'use strict';

  const API = window.UnityAPI;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MACHINE_COLORS = ['#00ffff', '#ffff00', '#e5173f', '#3ddc84', '#ff9f40', '#b48cff', '#ff6fd8'];

  const state = { role: null, cfg: null, charts: [], editing: null, seq: 0 };

  // ---------- page cache (stale-while-revalidate) ----------
  // Pages you have seen open instantly from memory; a background request refreshes them and
  // the page redraws only if the data changed. Any write on the server changes the data
  // version, which clears this cache.
  const cache = new Map();
  const FRESH_MS = 30000;
  const strip = (k, v) => (k === 'generatedAt' || k === 'checkedAt' ? undefined : v);
  API.onVersionChange(() => cache.clear());
  async function cachedLoad(action, params, rerender) {
    const key = action + JSON.stringify(params);
    const hit = cache.get(key);
    const seq = state.seq;
    if (hit) {
      if (Date.now() - hit.at > FRESH_MS) {
        API.call(action, params).then((data) => {
          const changed = JSON.stringify(data, strip) !== JSON.stringify(hit.data, strip);
          cache.set(key, { data, at: Date.now() });
          if (changed && seq === state.seq) rerender();
        }).catch(() => { /* keep showing cached data */ });
      }
      return hit.data;
    }
    loading();
    const data = await guarded(() => API.call(action, params));
    if (data !== undefined) cache.set(key, { data, at: Date.now() });
    return seq === state.seq ? data : undefined;   // user moved on: don't draw
  }
  function prefetch(action, params) {
    const key = action + JSON.stringify(params);
    if (cache.has(key)) return Promise.resolve();
    return API.call(action, params).then((data) => cache.set(key, { data, at: Date.now() })).catch(() => {});
  }
  function saveCfg() {
    try { localStorage.setItem('unity.cfg', JSON.stringify({ role: state.role, username: state.username, cfg: state.cfg })); } catch (e) {}
  }

  // ---------- helpers ----------
  function toast(msg, isError) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = 'toast'; }, isError ? 6000 : 3000);
  }
  function confirmBox(title, text, okLabel = 'OK') {
    const d = $('#confirm-dialog');
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-ok').textContent = okLabel;
    return new Promise((resolve) => {
      const done = (v) => { d.close(); resolve(v); };
      $('#confirm-ok').onclick = () => done(true);
      $('#confirm-cancel').onclick = () => done(false);
      d.oncancel = () => resolve(false);
      d.showModal();
    });
  }
  const minToHM = (m) => { m = Math.round(Number(m) || 0); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  const now = new Date();
  const thisYear = now.getFullYear();
  // Reports are usually filed for the previous month.
  const defaultPeriod = () => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { year: d.getFullYear(), month: MONTHS[d.getMonth()] };
  };
  const yearOptions = (sel) => {
    const years = new Set([...(state.cfg.years || []), thisYear, thisYear - 1]);
    return [...years].sort((a, b) => b - a).map((y) => `<option ${y == sel ? 'selected' : ''}>${y}</option>`).join('');
  };
  const monthOptions = (sel, withAll) =>
    (withAll ? `<option value="">All months</option>` : '') +
    MONTHS.map((m) => `<option ${m === sel ? 'selected' : ''}>${m}</option>`).join('');
  const machineOptions = (sel, withAll) =>
    (withAll ? `<option value="">All machines</option>` : '<option value="">Select…</option>') +
    state.cfg.machines.map((m) => `<option ${m.name === sel ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  function destroyCharts() { state.charts.forEach((c) => c.destroy()); state.charts = []; }
  const valueLabelsPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(c, args, opts) {
      if (!opts || !opts.mode) return;
      const g = c.ctx, font = `10px ${getComputedStyle(document.body).fontFamily}`;
      const fmtN = (v) => (Number(v) || 0).toLocaleString('en-IN');
      // Dark or light text, whichever reads better on the segment colour.
      const inkOn = (hex) => {
        const h = String(hex).replace('#', ''); if (h.length < 6) return '#000';
        const [r, gg, b] = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
        return 0.2126 * r + 0.7152 * gg + 0.0722 * b > 0.25 ? '#00262c' : '#ffffff';
      };
      g.save(); g.font = font; g.textAlign = 'center';
      // Text with a thin dark outline so it stays readable where it crosses a line or gridline.
      const halo = (t, x, y) => { g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = 'rgba(8,42,49,.9)'; g.strokeText(t, x, y); g.fillText(t, x, y); };
      if (opts.mode === 'stack') {
        const n = c.data.labels.length, totals = new Array(n).fill(null), tops = new Array(n).fill(Infinity);
        c.data.datasets.forEach((ds, di) => {
          if (!c.isDatasetVisible(di)) return;
          c.getDatasetMeta(di).data.forEach((el, i) => {
            const v = ds.data[i]; if (v == null) return;
            totals[i] = (totals[i] || 0) + v;
            const { x, y, base } = el.getProps(['x', 'y', 'base'], true);
            tops[i] = Math.min(tops[i], y);
            if (v && Math.abs(base - y) >= 13) {          // only where the number fits inside the segment
              g.fillStyle = inkOn(ds.backgroundColor); g.textBaseline = 'middle'; g.fillText(fmtN(v), x, (y + base) / 2);
            }
          });
        });
        g.fillStyle = '#ffffff'; g.textBaseline = 'bottom';
        const meta0 = c.getDatasetMeta(c.data.datasets.findIndex((_, di) => c.isDatasetVisible(di)));
        totals.forEach((t, i) => { if (t != null && meta0 && meta0.data[i]) halo(fmtN(t), meta0.data[i].x, tops[i] - 3); });
      } else if (opts.mode === 'point') {
        g.fillStyle = '#ffffff'; g.textBaseline = 'bottom';
        c.data.datasets.forEach((ds, di) => c.getDatasetMeta(di).data.forEach((el, i) => {
          if (ds.data[i] != null) halo(fmtN(ds.data[i]), el.x, el.y - 6);
        }));
      } else if (opts.mode === 'end') {
        g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'middle';
        c.data.datasets.forEach((ds, di) => c.getDatasetMeta(di).data.forEach((el, i) => {
          if (ds.data[i] != null) halo(fmtN(ds.data[i]), el.x + 5, el.y);
        }));
      }
      g.restore();
    }
  };
  function chart(canvas, config) {
    if (!window.Chart) return;
    Chart.defaults.color = '#a9c7cd';
    Chart.defaults.borderColor = 'rgba(31,107,122,.5)';
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    config.plugins = (config.plugins || []).concat(valueLabelsPlugin);
    state.charts.push(new Chart(canvas, config));
  }
  function setMain(html) { destroyCharts(); $('#main').innerHTML = html; }
  function loading() { setMain('<div class="loading">Loading…</div>'); }
  async function guarded(fn) {
    try { return await fn(); } catch (e) {
      if (e.auth) { logout(); toast(e.message, true); return; }
      toast(e.message, true);
      throw e;
    }
  }

  // ---------- auth ----------
  async function login(username, password, remember) {
    const data = await API.call('login', { username, password, remember });
    API.setToken(data.token, remember);
    state.role = data.role;
    state.username = data.username;
    state.cfg = data.config;
    saveCfg();
    startApp();
    warmUp();
  }
  function logout() {
    API.setToken('', false);
    cache.clear();
    try { localStorage.removeItem('unity.cfg'); } catch (e) {}
    state.role = null; state.username = '';
    $('#login-key').value = '';
    history.replaceState(null, '', '#/dashboard');   // next person starts on the Dashboard
    showLogin();
  }
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#login-btn'), err = $('#login-error');
    btn.disabled = true; btn.textContent = 'Signing in…'; err.hidden = true;
    try { await login($('#login-user').value.trim(), $('#login-key').value, $('#login-remember').checked); $('#login-key').value = ''; }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
    finally { btn.disabled = false; btn.textContent = 'Sign in'; }
  });
  $('#logout-btn').addEventListener('click', logout);

  function startApp() {
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    document.body.classList.toggle('is-admin', state.role === 'admin');
    renderBadge();
    if (state.cfg.settings.department) $('#dept-line').textContent = state.cfg.settings.department;
    renderFooter();
    applyFeatures();
    route();
  }

  // ---------- router ----------
  const VIEWS = { dashboard: viewDashboard, entry: viewEntry, status: viewStatus, entries: viewEntries, monthly: viewMonthly, annual: viewAnnual, settings: viewSettings, admin: viewSettings, help: viewHelp };
  function route() {
    if (!state.role) return;
    const [, name = 'dashboard', ...args] = (location.hash || '#/dashboard').split('/');
    if (name === 'entry' && !newEntryOn() && !(state.editing && state.editing.id)) {
      state.editing = null;
      location.replace('#/status'); return;
    }
    const view = VIEWS[name] || viewDashboard;
    state.seq++;
    $$('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
    view(...args);
  }
  window.addEventListener('hashchange', route);

  // ---------- Dashboard ----------
  async function viewDashboard(year) {
    year = Number(year) || thisYear;
    const d = await cachedLoad('dashboard', { year }, () => viewDashboard(year));
    if (!d) return;
    const s = state.cfg.settings;
    const busiest = d.months.reduce((b, m, i) => (m.patients > (b.v || 0) ? { v: m.patients, i } : b), {});
    const machineNames = Object.keys(d.machines);
    setMain(`
      <div class="toolbar">
        <div><h1>Dashboard</h1><div class="sub">${esc(s.welcome || '')}</div></div>
        <div class="spacer" style="flex:1"></div>
        <div class="field"><label for="dash-year">Year</label><select id="dash-year">${yearOptions(year)}</select></div>
      </div>
      <div class="grid kpis">
        <div class="kpi"><div class="label">Total patients ${year}</div><div class="value">${fmt(d.totals.patients)}</div></div>
        <div class="kpi"><div class="label">Total sittings ${year}</div><div class="value">${fmt(d.totals.sittings)}</div></div>
        <div class="kpi"><div class="label">Total down time</div><div class="value">${minToHM(d.totals.downTimeMin)}</div><div class="hint">hours:minutes</div></div>
        <div class="kpi"><div class="label">Busiest month</div><div class="value">${busiest.v ? MONTHS[busiest.i].slice(0, 3) : '—'}</div><div class="hint">${busiest.v ? fmt(busiest.v) + ' patients' : 'No data yet'}</div></div>
        <div class="kpi"><div class="label">Entries recorded</div><div class="value">${fmt(d.totals.entries)}</div><div class="hint">machine × shift × month</div></div>
      </div>
      <div class="grid two" style="margin-top:16px">
        <div class="panel"><h2>Patients per month by machine</h2><div class="chart-box"><canvas id="c-patients"></canvas></div></div>
        <div class="panel"><h2>Sittings per month</h2><div class="chart-box"><canvas id="c-sittings"></canvas></div></div>
        <div class="panel"><h2>Patients by technique</h2><div class="chart-box"><canvas id="c-tech"></canvas></div></div>
        <div class="panel"><h2>Machine totals</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Machine</th><th class="num">Patients</th><th class="num">Sittings</th></tr></thead>
            <tbody>${machineNames.map((m) => `<tr><td class="tech">${esc(m)}</td><td class="num">${fmt(d.machines[m].patients.reduce((a, b) => a + b, 0))}</td><td class="num">${fmt(d.machines[m].sittings.reduce((a, b) => a + b, 0))}</td></tr>`).join('')}
              <tr class="total"><td>Total</td><td class="num">${fmt(d.totals.patients)}</td><td class="num">${fmt(d.totals.sittings)}</td></tr></tbody>
          </table></div>
        </div>
      </div>
    `);
    $('#dash-year').onchange = (e) => { location.hash = '#/dashboard/' + e.target.value; };
    const labels = MONTHS.map((m) => m.slice(0, 3));
    // Months with no data at all (e.g. Nov–Dec of the current year) are left out, not drawn as 0.
    const has = d.months.map((m) => m.patients > 0 || m.sittings > 0);
    const gap = (arr) => arr.map((v, i) => (has[i] ? v : null));
    chart($('#c-patients'), {
      type: 'bar',
      data: { labels, datasets: machineNames.map((m, i) => ({ label: m, data: gap(d.machines[m].patients), backgroundColor: MACHINE_COLORS[i % MACHINE_COLORS.length], borderRadius: 3 })) },
      options: { maintainAspectRatio: false, layout: { padding: { top: 16 } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
        plugins: { legend: { position: 'bottom' }, valueLabels: { mode: 'stack' } } }
    });
    chart($('#c-sittings'), {
      type: 'line',
      data: { labels, datasets: [{ label: 'Sittings', data: gap(d.months.map((m) => m.sittings)), borderColor: '#ffff00', backgroundColor: 'rgba(255,255,0,.12)', fill: true, tension: .3, pointRadius: 3, spanGaps: false }] },
      options: { maintainAspectRatio: false, layout: { padding: { top: 16 } }, scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false }, valueLabels: { mode: 'point' } } }
    });
    const techs = state.cfg.techniques;
    chart($('#c-tech'), {
      type: 'bar',
      data: { labels: techs.map((t) => t.label), datasets: [{ label: 'Patients', data: techs.map((t) => d.techniques[t.key] || 0), backgroundColor: '#00ffff', borderRadius: 3 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, layout: { padding: { right: 36 } }, scales: { x: { beginAtZero: true } },
        plugins: { legend: { display: false }, valueLabels: { mode: 'end' } } }
    });
  }

  // ---------- New / edit entry ----------
  function viewEntry() {
    const cfg = state.cfg;
    const e = state.editing;
    state.editing = null;
    const isEdit = !!(e && e.id);
    const p = e ? { year: e.year, month: e.month } : defaultPeriod();
    const shiftsFor = (machine) => (cfg.machines.find((m) => m.name === machine) || { shifts: ['I', 'II', 'III'] }).shifts;
    setMain(`
      <h1>${isEdit ? 'Edit entry' : 'New monthly entry'}</h1>
      <div class="sub">One entry per machine, per shift, per month. Counts are patients treated by each technique.</div>
      <form id="entry-form" class="panel" novalidate>
        <input type="hidden" name="id" value="${esc(e ? e.id : '')}">
        <div class="form-grid">
          <div class="field"><label for="f-year">Year</label><select id="f-year" name="year">${yearOptions(p.year)}</select></div>
          <div class="field"><label for="f-month">Month</label><select id="f-month" name="month">${monthOptions(p.month)}</select></div>
          <div class="field"><label for="f-machine">Machine</label><select id="f-machine" name="machine" required>${machineOptions(e ? e.machine : '')}</select></div>
          <div class="field"><label for="f-shift">Shift</label><select id="f-shift" name="shift" required></select></div>
          <div class="field" style="grid-column:span 2"><label for="f-incharge">Shift in charge</label>
            <select id="f-incharge" name="shiftInCharge" required><option value="">Select…</option>${cfg.staff.map((s) => `<option ${e && e.shiftInCharge === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            ${e && e.shiftInCharge && !cfg.staff.includes(e.shiftInCharge) ? `<option selected>${esc(e.shiftInCharge)}</option>` : ''}</select></div>
        </div>
        <h2 style="margin-top:18px">Patients by technique</h2>
        <div class="tech-grid">
          ${cfg.techniques.map((t) => `<div class="field"><label for="t-${t.key}"><b>${esc(t.label)}</b> <span>${esc(t.code)}</span></label>
            <input id="t-${t.key}" name="${t.key}" type="number" min="0" step="1" inputmode="numeric" value="${e && e.counts[t.key] ? e.counts[t.key] : ''}" placeholder="0"></div>`).join('')}
        </div>
        <h2 style="margin-top:18px">Sittings &amp; down time</h2>
        <div class="form-grid">
          <div class="field"><label for="f-sittings">Total no. of sittings</label><input id="f-sittings" name="totalSittings" type="number" min="0" step="1" inputmode="numeric" value="${isEdit ? e.totalSittings : ''}" required></div>
          <div class="field"><label for="f-dh">Down time — hours</label><input id="f-dh" name="downH" type="number" min="0" step="1" inputmode="numeric" value="${isEdit ? Math.floor(e.downTimeMin / 60) : ''}" placeholder="0"></div>
          <div class="field"><label for="f-dm">Down time — minutes</label><input id="f-dm" name="downM" type="number" min="0" max="59" step="1" inputmode="numeric" value="${isEdit ? e.downTimeMin % 60 : ''}" placeholder="0"></div>
          <div class="field" style="grid-column:span 2"><label for="f-remarks">Remarks (optional)</label><input id="f-remarks" name="remarks" maxlength="500" value="${esc(e ? e.remarks : '')}"></div>
        </div>
        <div class="total-strip">
          <span>Total patients: <b id="sum-patients">0</b></span>
          <span>Workload/day (reference): <b id="ref-workload">—</b></span>
        </div>
        <div id="dup-warning"></div>
        <div class="actions">
          <button class="btn primary" type="submit" id="save-btn">${isEdit ? 'Save changes' : 'Submit entry'}</button>
          <button class="btn" type="reset" id="reset-btn">Clear</button>
          ${isEdit ? '<a class="btn" href="#/entries">Cancel</a>' : ''}
        </div>
      </form>`);

    const form = $('#entry-form');
    const fillShifts = () => {
      const cur = e ? e.shift : form.shift.value;
      form.shift.innerHTML = '<option value="">Select…</option>' + shiftsFor(form.machine.value).map((s) => `<option ${s === cur ? 'selected' : ''}>${esc(s)}</option>`).join('');
      updateTotals();
    };
    const updateTotals = () => {
      const sum = cfg.techniques.reduce((a, t) => a + (Number(form[t.key].value) || 0), 0);
      $('#sum-patients').textContent = fmt(sum);
      const w = cfg.workload[form.machine.value + '|' + form.shift.value];
      $('#ref-workload').textContent = w ? w : '—';
    };
    form.machine.onchange = fillShifts;
    form.shift.onchange = updateTotals;
    form.addEventListener('input', updateTotals);
    form.addEventListener('reset', () => setTimeout(() => { fillShifts(); $('#dup-warning').innerHTML = ''; }));
    fillShifts();

    const collect = () => {
      const counts = {};
      cfg.techniques.forEach((t) => { counts[t.key] = Number(form[t.key].value) || 0; });
      return {
        id: form.id.value || undefined, year: Number(form.year.value), month: form.month.value,
        machine: form.machine.value, shift: form.shift.value, shiftInCharge: form.shiftInCharge.value,
        counts, totalSittings: Number(form.totalSittings.value) || 0,
        downTimeMin: (Number(form.downH.value) || 0) * 60 + (Number(form.downM.value) || 0),
        remarks: form.remarks.value.trim()
      };
    };

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const entry = collect();
      const missing = [['machine', 'Machine'], ['shift', 'Shift'], ['shiftInCharge', 'Shift in charge']].filter(([k]) => !entry[k]).map(([, l]) => l);
      if (missing.length) return toast('Please fill: ' + missing.join(', '), true);
      if (form.totalSittings.value === '') return toast('Please enter the total number of sittings.', true);
      if (Number(form.downM.value) > 59) return toast('Down-time minutes must be 0–59.', true);
      const btn = $('#save-btn');
      btn.disabled = true;
      try {
        let res = await guarded(() => API.call('saveEntry', { entry }));
        if (res && res.conflict) {
          const c = res.conflict;
          const ok = await confirmBox('Entry already exists',
            `${c.machine} shift ${c.shift}, ${c.month} ${c.year} was already submitted by ${c.shiftInCharge} (${c.totalPatients} patients, ${c.totalSittings} sittings). Replace it with these figures?`, 'Replace');
          if (!ok) return;
          res = await guarded(() => API.call('saveEntry', { entry, overwrite: true }));
        }
        if (res && res.saved) {
          toast(`Saved: ${res.saved.machine} · shift ${res.saved.shift} · ${res.saved.month} ${res.saved.year}`);
          if (!state.cfg.years.includes(res.saved.year)) state.cfg.years.push(res.saved.year);
          location.hash = entry.id ? '#/entries' : '#/status/' + res.saved.year + '/' + res.saved.month;
        }
      } finally { btn.disabled = false; }
    });
  }

  // ---------- Submission status ----------
  async function viewStatus(year, month) {
    const p = defaultPeriod();
    year = Number(year) || p.year; month = month ? decodeURIComponent(month) : p.month;
    const d = await cachedLoad('status', { year, month }, () => viewStatus(year, month));
    if (!d) return;
    const done = d.slots.filter((s) => s.submitted).length;
    const byMachine = {};
    d.slots.forEach((s) => { (byMachine[s.machine] = byMachine[s.machine] || []).push(s); });
    setMain(`
      <div class="toolbar">
        <div><h1>Submission status</h1><div class="sub">${month} ${year}: ${done} of ${d.slots.length} shift reports received</div></div>
        <div style="flex:1"></div>
        <div class="field"><label for="s-year">Year</label><select id="s-year">${yearOptions(year)}</select></div>
        <div class="field"><label for="s-month">Month</label><select id="s-month">${monthOptions(month)}</select></div>
      </div>
      <div class="progress"><div style="width:${d.slots.length ? (100 * done / d.slots.length) : 0}%"></div></div>
      <div class="status-grid">
        ${Object.keys(byMachine).map((m) => `<div class="machine-card"><h3>${esc(m)}</h3>
          ${byMachine[m].map((s) => `<div class="slot"><span>Shift ${esc(s.shift)}${s.submitted ? `<br><small class="note">${esc(s.shiftInCharge)} · ${fmt(s.patients)} pts · ${fmt(s.sittings)} sittings</small>` : ''}</span>
            ${s.submitted ? '<span class="pill ok">Received</span>' : (newEntryOn() ? `<a class="pill miss" href="#/entry" data-prefill="${esc(m)}|${esc(s.shift)}">Pending</a>` : '<span class="pill miss">Pending</span>')}</div>`).join('')}
        </div>`).join('')}
      </div>`);
    const go = () => { location.hash = `#/status/${$('#s-year').value}/${$('#s-month').value}`; };
    $('#s-year').onchange = go; $('#s-month').onchange = go;
    $$('[data-prefill]').forEach((a) => a.addEventListener('click', () => {
      const [machine, shift] = a.dataset.prefill.split('|');
      state.editing = { id: '', year, month, machine, shift, shiftInCharge: '', counts: {}, totalSittings: '', downTimeMin: 0, remarks: '' };
    }));
  }

  // ---------- Entries list ----------
  async function viewEntries(year, month, machine) {
    year = Number(year) || thisYear; month = month ? decodeURIComponent(month) : ''; machine = machine ? decodeURIComponent(machine) : '';
    const rows = await cachedLoad('listEntries', { year, month, machine }, () => viewEntries(year, month, machine));
    if (!rows) return;
    const techs = state.cfg.techniques;
    setMain(`
      <div class="toolbar">
        <div><h1>Entries</h1><div class="sub">${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}. Click a row to edit.</div></div>
        <div style="flex:1"></div>
        <div class="field"><label for="e-year">Year</label><select id="e-year">${yearOptions(year)}</select></div>
        <div class="field"><label for="e-month">Month</label><select id="e-month">${monthOptions(month, true)}</select></div>
        <div class="field"><label for="e-machine">Machine</label><select id="e-machine">${machineOptions(machine, true)}</select></div>
        <button class="btn" id="csv-btn" type="button">Export CSV</button>
      </div>
      ${rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Month</th><th>Machine</th><th>Shift</th><th>In charge</th>
          ${techs.map((t) => `<th class="num" title="${esc(t.code)}">${esc(t.label)}</th>`).join('')}
          <th class="num">Patients</th><th class="num">Sittings</th><th class="num">Down time</th><th>Source</th>${state.role === 'admin' ? '<th></th>' : ''}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr class="clickable" data-i="${i}">
          <td>${esc(r.month.slice(0, 3))} ${r.year}</td><td class="tech">${esc(r.machine)}</td><td>${esc(r.shift)}</td><td title="${esc(r.shiftInCharge)}">${esc((r.shiftInCharge.match(/^\(\w+\)/) || [r.shiftInCharge])[0])}</td>
          ${techs.map((t) => `<td class="num ${r.counts[t.key] ? '' : 'zero'}">${r.counts[t.key] || 0}</td>`).join('')}
          <td class="num grand">${fmt(r.totalPatients)}</td><td class="num">${fmt(r.totalSittings)}</td><td class="num">${minToHM(r.downTimeMin)}</td>
          <td class="note">${esc(r.source)}</td>
          ${state.role === 'admin' ? `<td><button class="btn danger small" data-del="${i}" type="button" title="Delete entry" aria-label="Delete entry">✕</button></td>` : ''}</tr>`).join('')}
        <tr class="total"><td colspan="4">Total</td>${techs.map((t) => `<td class="num">${fmt(rows.reduce((a, r) => a + (r.counts[t.key] || 0), 0))}</td>`).join('')}
          <td class="num">${fmt(rows.reduce((a, r) => a + r.totalPatients, 0))}</td><td class="num">${fmt(rows.reduce((a, r) => a + r.totalSittings, 0))}</td>
          <td class="num">${minToHM(rows.reduce((a, r) => a + r.downTimeMin, 0))}</td><td></td>${state.role === 'admin' ? '<td></td>' : ''}</tr>
        </tbody></table></div>` : '<div class="panel empty">No entries for this selection.</div>'}`);
    const go = () => { location.hash = `#/entries/${$('#e-year').value}/${encodeURIComponent($('#e-month').value)}/${encodeURIComponent($('#e-machine').value)}`; };
    ['#e-year', '#e-month', '#e-machine'].forEach((s) => { $(s).onchange = go; });
    $$('tr.clickable').forEach((tr) => tr.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-del]')) return;
      state.editing = rows[Number(tr.dataset.i)];
      location.hash = '#/entry';
    }));
    $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const r = rows[Number(b.dataset.del)];
      if (!(await confirmBox('Delete entry', `Delete ${r.machine} shift ${r.shift}, ${r.month} ${r.year}? This cannot be undone.`, 'Delete'))) return;
      await guarded(() => API.call('deleteEntry', { id: r.id }));
      toast('Entry deleted.');
      route();
    }));
    $('#csv-btn').onclick = () => downloadCsv(rows, `UNITY_entries_${year}${month ? '_' + month : ''}.csv`);
  }

  function downloadCsv(rows, name) {
    const techs = state.cfg.techniques;
    const head = ['Year', 'Month', 'Machine', 'Shift', 'Shift in charge', ...techs.map((t) => `${t.label} (${t.code})`), 'Total patients', 'Total sittings', 'Down time (min)', 'Remarks', 'Source'];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.map(q).join(',')].concat(rows.map((r) => [r.year, r.month, r.machine, r.shift, r.shiftInCharge, ...techs.map((t) => r.counts[t.key] || 0), r.totalPatients, r.totalSittings, r.downTimeMin, r.remarks, r.source].map(q).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Report grid (monthly & annual share it) ----------
  function reportGrid(r, opts = {}) {
    // Alternate machines get a different shade (black / dark teal, as in the old Google Sheet).
    const machines = [];
    r.columns.forEach((c) => { const last = machines[machines.length - 1]; if (last && last.name === c.machine) last.span++; else machines.push({ name: c.machine, span: 1 }); });
    const mIdx = r.columns.map((c) => machines.findIndex((m) => m.name === c.machine));
    const cls = (i) => (mIdx[i] % 2 ? ' m-alt' : '') + (i === 0 || mIdx[i] !== mIdx[i - 1] ? ' m-start' : '');
    const cell = (v, i) => `<td class="num${v ? '' : ' zero'}${cls(i)}">${fmt(v)}</td>`;
    const t = r.totals;
    return `<div class="table-wrap"><table class="report-grid">
      <thead>
        <tr><th rowspan="2">Technique</th><th rowspan="2">Code</th>${machines.map((m, j) => `<th class="machine m-start${j % 2 ? ' m-alt' : ''}" colspan="${m.span}">${esc(m.name)}</th>`).join('')}<th rowspan="2" class="num m-start">Total</th></tr>
        <tr>${r.columns.map((c, i) => `<th class="num${cls(i)}">${esc(c.shift)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${r.rows.map((row) => `<tr><td class="tech">${esc(row.label)}</td><td class="code">${esc(row.code)}</td>${row.cells.map(cell).join('')}<td class="num grand m-start">${fmt(row.total)}</td></tr>`).join('')}
        <tr class="total"><td colspan="2">Total patients</td>${t.patients.map((v, i) => `<td class="num${cls(i)}">${fmt(v)}</td>`).join('')}<td class="num m-start">${fmt(t.grandPatients)}</td></tr>
        <tr class="total"><td colspan="2">Total no. of sittings</td>${t.sittings.map((v, i) => `<td class="num${cls(i)}">${fmt(v)}</td>`).join('')}<td class="num m-start">${fmt(t.grandSittings)}</td></tr>
        ${t.workload ? `<tr class="meta"><td colspan="2">Workload per day</td>${t.workload.map((v, i) => `<td class="num${cls(i)}">${v || ''}</td>`).join('')}<td class="m-start"></td></tr>` : ''}
        <tr class="meta"><td colspan="2">Total down time (h:mm)</td>${t.downTimeMin.map((v, i) => `<td class="num${cls(i)}">${minToHM(v)}</td>`).join('')}<td class="num m-start">${minToHM(t.grandDownTimeMin)}</td></tr>
        ${t.shiftInCharge ? `<tr class="meta"><td colspan="2">Shift in charge</td>${t.shiftInCharge.map((v, i) => `<td class="${cls(i)}" title="${esc(v)}">${v ? esc((v.match(/^\(\w+\)/) || [v])[0]) : (t.submitted[i] ? '' : '<span style="color:#ff8aa0">pending</span>')}</td>`).join('')}<td class="m-start"></td></tr>` : ''}
      </tbody></table></div>`;
  }

  function machineSummary(r) {
    return `<div class="table-wrap"><table>
      <thead><tr><th>Machine</th><th class="num">Patients</th><th class="num">Sittings</th></tr></thead>
      <tbody>${r.machineTotals.map((m) => `<tr><td class="tech">${esc(m.machine)}</td><td class="num">${fmt(m.patients)}</td><td class="num">${fmt(m.sittings)}</td></tr>`).join('')}
      <tr class="total"><td>Total</td><td class="num">${fmt(r.totals.grandPatients)}</td><td class="num">${fmt(r.totals.grandSittings)}</td></tr></tbody></table></div>`;
  }

  function reportHead(r) {
    return `<div class="report-head"><div class="dept">${esc(r.department)}</div><h2>${esc(r.title)}</h2>
      <div class="note">Generated by UNITY on ${new Date(r.generatedAt).toLocaleString('en-IN')}</div></div>`;
  }

  // ---------- Monthly report ----------
  async function viewMonthly(year, month) {
    const p = defaultPeriod();
    year = Number(year) || p.year; month = month ? decodeURIComponent(month) : p.month;
    const r = await cachedLoad('monthlyReport', { year, month }, () => viewMonthly(year, month));
    if (!r) return;
    const pending = r.totals.submitted.filter((s) => !s).length;
    setMain(`
      <div class="toolbar">
        <h1 style="margin-right:auto">Monthly report</h1>
        <div class="field"><label for="m-year">Year</label><select id="m-year">${yearOptions(year)}</select></div>
        <div class="field"><label for="m-month">Month</label><select id="m-month">${monthOptions(month)}</select></div>
        <button class="btn primary" type="button" onclick="window.print()">Print / PDF</button>
      </div>
      <div class="panel">
        ${reportHead(r)}
        ${pending ? `<div class="warn-box no-print">${pending} of ${r.columns.length} shift reports are still pending for this month. <a href="#/status/${year}/${month}">See status</a></div>` : ''}
        <div class="print-block">${reportGrid(r)}</div>
        <div class="print-block"><h3 style="margin-top:18px">Summary by machine</h3>
        <div style="max-width:520px">${machineSummary(r)}</div></div>
      </div>`);
    const go = () => { location.hash = `#/monthly/${$('#m-year').value}/${$('#m-month').value}`; };
    $('#m-year').onchange = go; $('#m-month').onchange = go;
  }

  // ---------- Annual report ----------
  async function viewAnnual(mode, year) {
    mode = mode === 'financial' ? 'financial' : 'calendar';
    year = Number(year) || (mode === 'financial' ? (now.getMonth() >= 3 ? thisYear : thisYear - 1) : thisYear);
    const r = await cachedLoad('annualReport', { mode, year }, () => viewAnnual(mode, year));
    if (!r) return;
    const labels = r.periods.map((p) => p.label);
    const monthTable = (title, rows, totalRow) => `<div class="print-block">
      <h3 style="margin-top:18px">${title}</h3>
      <div class="table-wrap"><table class="fit">
        <thead><tr><th></th>${labels.map((l) => `<th class="num">${esc(l)}</th>`).join('')}<th class="num">Total</th></tr></thead>
        <tbody>${rows.map((row) => `<tr><td class="tech">${esc(row.label)}${row.code ? ` <span class="note">${esc(row.code)}</span>` : ''}</td>${row.cells.map((v) => `<td class="num ${v ? '' : 'zero'}">${fmt(v)}</td>`).join('')}<td class="num grand">${fmt(row.total)}</td></tr>`).join('')}
        ${totalRow ? `<tr class="total"><td>Total</td>${totalRow.map((v) => `<td class="num">${fmt(v)}</td>`).join('')}<td class="num">${fmt(totalRow.reduce((a, b) => a + b, 0))}</td></tr>` : ''}</tbody>
      </table></div></div>`;
    setMain(`
      <div class="toolbar">
        <h1 style="margin-right:auto">Annual report</h1>
        <div class="field"><label for="a-mode">Period</label><select id="a-mode">
          <option value="calendar" ${mode === 'calendar' ? 'selected' : ''}>Calendar year (Jan–Dec)</option>
          <option value="financial" ${mode === 'financial' ? 'selected' : ''}>Financial year (Apr–Mar)</option></select></div>
        <div class="field"><label for="a-year">${mode === 'financial' ? 'Starting year' : 'Year'}</label><select id="a-year">${yearOptions(year)}</select></div>
        <button class="btn primary" type="button" onclick="window.print()">Print / PDF</button>
      </div>
      <div class="panel">
        ${reportHead(r)}
        <div class="grid kpis" style="margin-bottom:16px">
          <div class="kpi"><div class="label">Total patients</div><div class="value">${fmt(r.totals.grandPatients)}</div></div>
          <div class="kpi"><div class="label">Total sittings</div><div class="value">${fmt(r.totals.grandSittings)}</div></div>
          <div class="kpi"><div class="label">Months with data</div><div class="value">${r.monthsWithData.filter(Boolean).length} / 12</div></div>
        </div>
        ${monthTable('Patients by technique and month', r.byMonth.techniques, r.byMonth.patients)}
        ${monthTable('Patients by machine and month', r.byMonth.machinePatients, r.byMonth.patients)}
        ${monthTable('Sittings by machine and month', r.byMonth.machineSittings, r.byMonth.sittings)}
        <div class="print-block"><h3 style="margin-top:18px">Technique × machine &amp; shift</h3>
        ${reportGrid(r)}</div>
      </div>`);
    const go = () => { location.hash = `#/annual/${$('#a-mode').value}/${$('#a-year').value}`; };
    $('#a-mode').onchange = go; $('#a-year').onchange = go;
  }

  // ---------- Help (inside the app) ----------
  function viewHelp(section) {
    setMain('<div id="help-in"></div>');
    window.UnityHelp.render($('#help-in'));
    const rel = state.cfg.release || {};
    if ($('#about-version')) $('#about-version').textContent = 'v' + (rel.version || '?');
    if ($('#about-date')) $('#about-date').textContent = fmtDate(rel.date);
    if (section && $('#' + section)) $('#' + section).scrollIntoView();
    else window.scrollTo(0, 0);
  }

  // ---------- Settings ----------
  async function viewSettings() {
    const isAdmin = state.role === 'admin';
    const font = window.UnityPrefs.getFont();
    const rel = state.cfg.release || {};
    // Collapsible sections; each remembers whether it is open (Display opens by default).
    const sect = (id, title, body, hint = '') => {
      let open = id === 'display';
      try { const v = localStorage.getItem('unity.sect.' + id); if (v !== null) open = v === '1'; } catch (e) {}
      return `<details class="sect" data-sect="${id}" ${open ? 'open' : ''}>
        <summary><span class="sect-title">${title}</span><span class="sect-hint" id="hint-${id}">${hint}</span></summary>
        <div class="sect-body">${body}</div></details>`;
    };
    setMain(`
      <div class="toolbar"><div><h1>Settings</h1>
        <div class="sub">${isAdmin ? 'Click a section to expand or collapse it.' : 'Display preferences for this device.'}</div></div>
        <div style="flex:1"></div>
        <button class="btn small" id="sect-all" type="button">Expand all</button></div>
      ${sect('display', 'Display', `
          <div class="field" style="max-width:360px"><label for="set-font">Font</label>
            <select id="set-font">
              <option value="default" ${font === 'default' ? 'selected' : ''}>Default (system sans-serif)</option>
              <option value="courier" ${font === 'courier' ? 'selected' : ''}>Courier New</option>
            </select></div>
          <p class="note" style="margin-top:8px">Saved on this device and browser only, so each person can choose their own.</p>`,
        font === 'courier' ? 'Courier New' : 'Default font')}
      ${sect('account', 'My account', `
          <form id="me-form" class="form-grid" style="max-width:760px" autocomplete="off">
            <div class="field"><label for="me-name">User name</label><input id="me-name" value="${esc(state.username || '')}" autocomplete="username" autocapitalize="none" spellcheck="false"></div>
            <div class="field"><label for="me-pw">New password <span class="note">(leave empty to keep)</span></label><input id="me-pw" type="password" autocomplete="new-password"></div>
            <div class="field"><label for="me-pw2">Confirm new password</label><input id="me-pw2" type="password" autocomplete="new-password"></div>
            <div class="field"><label for="me-cur">Current password <span class="note">(required)</span></label><input id="me-cur" type="password" autocomplete="current-password"></div>
          </form>
          <div class="actions"><button class="btn primary" id="me-save" type="button">Save my account</button></div>`,
        `${esc(state.username || '')} · ${state.role === 'admin' ? 'Admin' : 'Staff'}`)}
      ${sect('about', 'About this app', `
          <table class="info" style="max-width:640px"><tbody>
            <tr><td class="tech">Application</td><td>UNITY: Monthly RT Treatment Tracker</td></tr>
            <tr><td class="tech">Version</td><td>v${esc(rel.version || '?')}</td></tr>
            <tr><td class="tech">Released</td><td>${esc(fmtDate(rel.date))}</td></tr>
            <tr><td class="tech">Department</td><td>${esc(state.cfg.settings.department || '')}</td></tr>
            <tr><td class="tech">Signed in as</td><td>${isAdmin ? 'Admin' : 'Staff'}</td></tr>
          </tbody></table>
          <div class="actions"><a class="btn" href="#/help">Help, about &amp; user manual</a></div>`,
        `v${esc(rel.version || '?')} · ${esc(fmtDate(rel.date))}`)}
      ${isAdmin ? `
      ${sect('features', 'Features', `
          <label class="switch-row"><input type="checkbox" id="feat-newentry" ${newEntryOn() ? 'checked' : ''}>
            <span><b>Show the “New entry” tab</b><br><span class="note">Turn on when staff start entering monthly figures in UNITY instead of the Google Form.
            While it is off, the tab is hidden for everyone and “Pending” on the Submission status page is not a link.
            Correcting existing entries from the Entries page still works.</span></span></label>`,
        newEntryOn() ? 'New entry: shown' : 'New entry: hidden')}
      ${sect('users', 'Users', `
          <p class="note">Everyone signs in with their own user name and password. <b>Admin</b> can do everything, including Settings;
            <b>Staff</b> can view reports and correct entries. Passwords are stored only in encrypted (hashed) form, so nobody can read them,
            not even admins. To help someone who forgot their password, set a new one for them here.</p>
          <div class="table-wrap"><table id="users-table" class="fit">
            <thead><tr><th>User name</th><th style="width:12%">Role</th><th style="width:12%">Status</th><th style="width:22%">Last sign-in</th><th style="width:150px"></th></tr></thead>
            <tbody><tr><td colspan="5" class="loading">Loading…</td></tr></tbody></table></div>
          <div class="actions"><button class="btn primary" id="user-add" type="button">+ Add user</button></div>
          <dialog id="user-dialog">
            <form method="dialog" id="user-form" autocomplete="off">
              <h3 id="user-dialog-title">Add user</h3>
              <input type="hidden" id="u-original">
              <div class="field"><label for="u-name">User name</label><input id="u-name" required autocapitalize="none" spellcheck="false" placeholder="e.g. salini.gs"></div>
              <div class="form-grid" style="margin-top:10px">
                <div class="field"><label for="u-role">Role</label><select id="u-role"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
                <div class="field"><label for="u-active">Status</label><select id="u-active"><option value="1">Active</option><option value="0">Disabled (cannot sign in)</option></select></div>
              </div>
              <div class="form-grid" style="margin-top:10px">
                <div class="field"><label for="u-pw" id="u-pw-label">Password</label><input id="u-pw" type="password" autocomplete="new-password"></div>
                <div class="field"><label for="u-pw2">Confirm password</label><input id="u-pw2" type="password" autocomplete="new-password"></div>
              </div>
              <p class="note" id="u-pw-note">At least 8 characters.</p>
              <p id="u-error" style="color:#ff8aa0" hidden></p>
              <div class="actions"><button class="btn" type="button" id="u-cancel">Cancel</button><button class="btn primary" type="submit" id="u-save">Save</button></div>
            </form>
          </dialog>`, 'Loading…')}
      ${sect('sources', 'Data sources &amp; import', `
        <p class="note">The old “Monthly RT Tx Report” Google Sheets that UNITY copies data from. UNITY <b>only reads</b> them.
          For a yearly sheet enter its <b>Year</b>; leave Year empty for the live sheet (the year is then taken from each submission’s date).
          The first submission per machine/shift/month is used (same as the old sheets). Entries created or edited in UNITY are never overwritten. Importing again never creates duplicates.</p>
        <div class="table-wrap"><table id="src-table" class="fit">
          <thead><tr><th style="width:20%">Label</th><th style="width:26%">Spreadsheet ID or URL</th><th style="width:8%">Year</th><th style="width:7%">Hourly sync</th><th style="width:6%">Active</th><th>Last import</th><th style="width:72px"></th><th style="width:44px"></th></tr></thead>
          <tbody><tr><td colspan="8" class="loading">Loading…</td></tr></tbody></table></div>
        <div class="actions">
          <button class="btn" id="src-add" type="button">+ Add source</button>
          <button class="btn" id="src-save" type="button">Save sources</button>
          <button class="btn primary" id="src-import-all" type="button">Import all active sources</button>
        </div>
        <pre id="src-out" class="note" style="white-space:pre-wrap;margin:10px 0 0"></pre>`, 'Loading…')}
      ${sect('sync', 'Hourly sync from Google Form', `
          <p class="note">Every hour, re-reads the sources marked <b>Hourly sync</b> (normally the live sheet) so Google Form submissions appear in UNITY.</p>
          <p>Status: <b id="adm-sync-status">checking…</b></p>
          <div class="actions"><button class="btn primary" id="adm-sync-on" type="button" hidden>Turn on hourly sync</button>
            <button class="btn danger" id="adm-sync-off" type="button" hidden>Turn off hourly sync</button></div>`, 'Loading…')}
      ${sect('storage', 'Storage (Google Sheets cell limit)', `<div id="storage-box" class="loading">Checking…</div>`, 'Loading…')}
      ${sect('machines', 'Machines', `<p class="note">One per line: <code>Machine | Shifts | active</code> or <code>| decommissioned</code>. For example <code>Halcyon | I,II,III | active</code>.
          Decommissioned machines keep their history in reports but are hidden from new entries.</p>
          <textarea id="adm-machines" rows="8">Loading…</textarea>
          <div class="actions"><button class="btn primary" data-save="Machines" type="button">Save machines</button></div>`, `${state.cfg.machines.length} in use`)}
      ${sect('staff', 'Shift in charge list', `<p class="note">One name per line, e.g. <code>(SGS) Salini G.S.</code></p>
          <textarea id="adm-staff" rows="10">${esc(state.cfg.staff.join('\n'))}</textarea>
          <div class="actions"><button class="btn primary" data-save="Staff" type="button">Save staff</button></div>`, `${state.cfg.staff.length} names`)}
      ${sect('workload', 'Workload per day', `<p class="note"><code>Machine | Shift | Patients per day</code></p>
          <textarea id="adm-workload" rows="10">${esc(state.cfg.machines.flatMap((m) => m.shifts.map((s) => `${m.name} | ${s} | ${state.cfg.workload[m.name + '|' + s] || 0}`)).join('\n'))}</textarea>
          <div class="actions"><button class="btn primary" data-save="Workload" type="button">Save workload</button></div>`, 'Reference figures')}
      ` : ''}
    `);
    const syncAllBtn = () => { $('#sect-all').textContent = $$('details.sect').every((d) => d.open) ? 'Collapse all' : 'Expand all'; };
    $$('details.sect').forEach((d) => d.addEventListener('toggle', () => {
      try { localStorage.setItem('unity.sect.' + d.dataset.sect, d.open ? '1' : '0'); } catch (e) {}
      syncAllBtn();
    $('#me-save').onclick = async (e) => {
      const name = $('#me-name').value.trim().toLowerCase(), pw = $('#me-pw').value, pw2 = $('#me-pw2').value, cur = $('#me-cur').value;
      if (!cur) return toast('Enter your current password to confirm the change.', true);
      if (pw !== pw2) return toast('The new passwords do not match.', true);
      if (pw && pw.length < 8) return toast('The new password must be at least 8 characters.', true);
      if (name === state.username && !pw) return toast('Nothing to change.', true);
      const btn = e.currentTarget; btn.disabled = true;
      try {
        const r = await guarded(() => API.call('updateMe', { currentPassword: cur, newUsername: name, newPassword: pw || undefined }));
        API.setToken(r.token, API.remembered());
        state.username = r.username; state.role = r.role; saveCfg(); renderBadge();
        ['#me-pw', '#me-pw2', '#me-cur'].forEach((id) => { $(id).value = ''; });
        if (window.UnityPw) UnityPw.hideAll($('#me-form'));
        $('#hint-account').textContent = `${r.username} · ${r.role === 'admin' ? 'Admin' : 'Staff'}`;
        if (state.refreshUsers) state.refreshUsers();
        toast('Your account was updated.');
      } catch (err) { /* toast shown */ } finally { btn.disabled = false; }
    };
    if ($('#feat-newentry')) $('#feat-newentry').onchange = async (e) => {
      const box = e.currentTarget, on = box.checked;
      box.disabled = true;
      try {
        state.cfg = await guarded(() => API.call('setAppSetting', { settingKey: 'ShowNewEntry', value: on })); saveCfg();
        applyFeatures();
        $('#hint-features').textContent = newEntryOn() ? 'New entry: shown' : 'New entry: hidden';
        toast(newEntryOn() ? 'The New entry tab is now shown.' : 'The New entry tab is now hidden.');
      } catch (err) { box.checked = !on; }
      finally { box.disabled = false; }
    };
    }));
    $('#sect-all').onclick = () => { const open = !$$('details.sect').every((d) => d.open); $$('details.sect').forEach((d) => { d.open = open; }); };
    syncAllBtn();
    $('#set-font').onchange = (e) => { window.UnityPrefs.setFont(e.target.value); toast('Font updated.'); };
    if (!isAdmin) return;

    // --- data sources ---
    let sources = [];
    const srcRow = (s, i) => `<tr data-i="${i}">
      <td><input data-k="label" value="${esc(s.label)}"></td>
      <td><input data-k="id" value="${esc(s.id)}" placeholder="Paste sheet URL or ID"></td>
      <td><input data-k="year" type="number" min="2000" max="2100" value="${s.year || ''}" placeholder="auto"></td>
      <td style="text-align:center"><input data-k="hourly" type="checkbox" ${s.hourly ? 'checked' : ''} style="width:auto;min-height:0"></td>
      <td style="text-align:center"><input data-k="active" type="checkbox" ${s.active !== false ? 'checked' : ''} style="width:auto;min-height:0"></td>
      <td class="note wrap">${s.lastImport ? esc(fmtDateTime(s.lastImport)) + '<br>' + esc(s.lastResult) : 'never'}</td>
      <td>${s.id && s.saved ? `<button class="btn small" data-import="${i}" type="button">Import</button>` : ''}</td>
      <td><button class="btn danger small" data-remove="${i}" type="button" title="Remove">✕</button></td></tr>`;
    const readSources = () => $$('#src-table tbody tr[data-i]').map((tr) => {
      const g = (k) => tr.querySelector(`[data-k="${k}"]`);
      return { label: g('label').value.trim(), id: g('id').value.trim(), year: g('year').value, hourly: g('hourly').checked, active: g('active').checked };
    });
    const drawSources = () => {
      $('#src-table tbody').innerHTML = sources.length ? sources.map(srcRow).join('') : '<tr><td colspan="8" class="empty">No sources.</td></tr>';
      $$('[data-remove]').forEach((b) => b.onclick = () => { sources = readSources().map((s, i) => ({ ...sources[i], ...s })); sources.splice(Number(b.dataset.remove), 1); drawSources(); });
      $$('[data-import]').forEach((b) => b.onclick = () => runImport(sources[Number(b.dataset.import)].id, b));
    };
    const setSources = (list) => {
      sources = list.map((s) => ({ ...s, saved: true })); drawSources();
      $('#hint-sources').textContent = `${list.filter((x) => x.active).length} active sheet(s)`;
    };
    const loadSources = async () => setSources(await guarded(() => API.call('sources')));
    const runImport = async (sourceId, btn) => {
      btn.disabled = true; const label = btn.textContent; btn.textContent = 'Importing…';
      $('#src-out').textContent = 'Importing… this can take up to a minute per sheet.';
      try {
        const res = await guarded(() => API.call('importLegacy', sourceId ? { sourceId } : {}));
        $('#src-out').textContent = res.map((r) => r.error ? `${r.source}: ERROR ${r.error}` : `${r.source}: ${r.added} added, ${r.updated} updated, ${r.unchanged} unchanged (${r.legacyRows} rows read)`).join('\n');
        state.cfg = await API.call('bootstrap'); saveCfg();
        await loadSources(); loadStorage(); loadMachines();
        toast('Import finished.');
      } catch (e) { $('#src-out').textContent = 'Import failed: ' + e.message; }
      finally { btn.disabled = false; btn.textContent = label; }
    };
    $('#src-add').onclick = () => { sources = readSources().map((s, i) => ({ ...sources[i], ...s })); sources.push({ label: '', id: '', year: '', hourly: false, active: true }); drawSources(); };
    $('#src-save').onclick = async (e) => {
      e.currentTarget.disabled = true;
      try { sources = (await guarded(() => API.call('saveSources', { rows: readSources() }))).map((s) => ({ ...s, saved: true })); drawSources(); toast('Sources saved.'); }
      finally { e.currentTarget.disabled = false; }
    };
    $('#src-import-all').onclick = (e) => runImport(null, e.currentTarget);

    // --- hourly sync ---
    const showSync = (on) => {
      $('#adm-sync-status').textContent = on ? 'ON: runs every hour' : 'OFF';
      $('#adm-sync-status').style.color = on ? 'var(--ok)' : '#ff8aa0';
      $('#adm-sync-on').hidden = on; $('#adm-sync-off').hidden = !on;
      $('#hint-sync').textContent = on ? 'ON' : 'OFF';
    };
    const setSync = async (enabled, btn) => {
      btn.disabled = true;
      try { const r = await guarded(() => API.call('legacySync', { enabled })); showSync(r.enabled); toast(r.enabled ? 'Hourly sync is on.' : 'Hourly sync is off.'); }
      finally { btn.disabled = false; }
    };
    $('#adm-sync-on').onclick = (e) => setSync(true, e.currentTarget);
    $('#adm-sync-off').onclick = (e) => setSync(false, e.currentTarget);

    // --- storage ---
    const drawStorage = (st) => {
      const pct = st.percentUsed;
      const color = pct >= 80 ? 'var(--red)' : pct >= 50 ? 'var(--warn)' : 'var(--cyan)';
      const verdict = pct >= 80 ? 'Plan a new database sheet soon.' : pct >= 50 ? 'Fine for now; keep an eye on it.' : 'Plenty of space. No new sheet needed.';
      $('#storage-box').className = '';
      $('#hint-storage').textContent = `${st.percentFree}% free`;
      $('#storage-box').innerHTML = `
        <div class="kpi" style="margin-bottom:10px"><div class="label">Space available</div>
          <div class="value">${st.percentFree.toLocaleString('en-IN')}%</div>
          <div class="hint">${fmt(st.cells)} of ${fmt(st.limit)} cells allocated (${pct}% used). ${verdict}</div></div>
        <div class="progress" title="${pct}% used"><div style="width:${Math.max(pct, 0.5)}%;background:${color}"></div></div>
        <p class="note">${fmt(st.entries)} entries over ${st.yearsOfData} year(s) ≈ ${fmt(st.cellsPerYear)} cells per year of data${st.yearsLeft != null ? `, so roughly <b>${fmt(st.yearsLeft)} more years</b> fit at this rate` : ''}.
          Google counts every cell in each tab's grid, including empty ones, so <b>Optimise</b> trims unused empty rows and columns. No data is changed.</p>
        <details><summary class="note" style="cursor:pointer">Per-tab breakdown</summary>
          <div class="table-wrap" style="margin-top:8px"><table>
            <thead><tr><th>Tab</th><th class="num">Data rows</th><th class="num">Grid (rows × cols)</th><th class="num">Cells</th></tr></thead>
            <tbody>${st.tabs.map((t) => `<tr><td class="tech">${esc(t.name)}</td><td class="num">${fmt(t.dataRows)}</td><td class="num">${fmt(t.rows)} × ${t.cols}</td><td class="num">${fmt(t.cells)}</td></tr>`).join('')}</tbody>
          </table></div></details>
        <div class="actions"><button class="btn" id="st-refresh" type="button">Refresh</button><button class="btn" id="st-opt" type="button">Optimise (free empty cells)</button></div>
        <p class="note">Checked ${esc(fmtDateTime(st.checkedAt))}${st.freedCells != null ? ` · freed ${fmt(st.freedCells)} cells` : ''}</p>`;
      $('#st-refresh').onclick = loadStorage;
      $('#st-opt').onclick = async (e) => {
        if (!(await confirmBox('Optimise storage', 'Remove empty rows and columns beyond the data in every tab of the UNITY sheet? Your data is not changed.', 'Optimise'))) return;
        e.currentTarget.disabled = true;
        try { drawStorage(await guarded(() => API.call('optimiseStorage'))); toast('Storage optimised.'); } catch (_) { /* toast shown */ }
      };
    };
    async function loadStorage() {
      try { drawStorage(await API.call('storage')); } catch (e) { $('#storage-box').textContent = 'Could not check storage: ' + e.message; }
    }

    // --- master data ---
    const setMachines = (all) => {
      $('#adm-machines').value = all.map((m) => `${m.name} | ${m.shifts} | ${m.active ? 'active' : 'decommissioned'}`).join('\n');
      const off = all.filter((m) => !m.active).length;
      $('#hint-machines').textContent = `${all.length - off} in use${off ? `, ${off} decommissioned` : ''}`;
    };
    async function loadMachines() {
      try { setMachines(await API.call('allMachines')); } catch (e) { $('#adm-machines').value = ''; toast(e.message, true); }
    }
    // --- users ---
    let users = [];
    const setUsers = (list) => {
      users = list;
      const admins = list.filter((u) => u.role === 'admin' && u.active).length;
      $('#hint-users').textContent = `${list.length} user(s), ${admins} admin`;
      $('#users-table tbody').innerHTML = list.map((u, i) => `<tr>
        <td class="tech">${esc(u.username)}${u.username === state.username ? ' <span class="note">(you)</span>' : ''}</td>
        <td>${u.role === 'admin' ? 'Admin' : 'Staff'}</td>
        <td>${u.active ? '<span class="pill ok">Active</span>' : '<span class="pill miss">Disabled</span>'}</td>
        <td class="note">${u.lastLogin ? esc(fmtDateTime(u.lastLogin)) : 'never'}</td>
        <td><button class="btn small" data-uedit="${i}" type="button">Edit</button>
          ${u.username === state.username ? '' : `<button class="btn danger small" data-udel="${i}" type="button">Delete</button>`}</td></tr>`).join('')
        || '<tr><td colspan="5" class="empty">No users.</td></tr>';
      $$('[data-uedit]').forEach((b) => b.onclick = () => openUser(users[Number(b.dataset.uedit)]));
      $$('[data-udel]').forEach((b) => b.onclick = async () => {
        const u = users[Number(b.dataset.udel)];
        if (!(await confirmBox('Delete user', `Delete the user “${u.username}”? They will no longer be able to sign in.`, 'Delete'))) return;
        try { setUsers((await guarded(() => API.call('deleteUser', { username: u.username }))).users); toast('User deleted.'); } catch (e) { /* toast shown */ }
      });
    };
    const openUser = (u) => {
      $('#user-dialog-title').textContent = u ? `Edit user “${u.username}”` : 'Add user';
      $('#u-original').value = u ? u.username : '';
      $('#u-name').value = u ? u.username : '';
      $('#u-role').value = u ? u.role : 'staff';
      $('#u-active').value = !u || u.active ? '1' : '0';
      $('#u-pw').value = ''; $('#u-pw2').value = '';
      $('#u-pw-label').textContent = u ? 'New password (leave empty to keep)' : 'Password';
      $('#u-pw-note').textContent = u ? 'Only fill this in to reset the password. At least 8 characters.' : 'At least 8 characters. Tell the user their password in person.';
      $('#u-error').hidden = true;
      if (window.UnityPw) UnityPw.hideAll($('#user-dialog'));
      $('#user-dialog').showModal();
      $('#u-name').focus();
    };
    $('#user-add').onclick = () => openUser(null);
    state.refreshUsers = () => API.call('users').then(setUsers).catch(() => {});
    $('#u-cancel').onclick = () => $('#user-dialog').close();
    $('#user-form').onsubmit = async (e) => {
      e.preventDefault();
      const err = (m) => { $('#u-error').textContent = m; $('#u-error').hidden = false; };
      const original = $('#u-original').value, pw = $('#u-pw').value;
      const user = { original: original || undefined, username: $('#u-name').value.trim().toLowerCase(), role: $('#u-role').value, active: $('#u-active').value === '1' };
      if (!user.username) return err('Enter a user name.');
      if (!original && !pw) return err('Enter a password for the new user.');
      if (pw && pw.length < 8) return err('The password must be at least 8 characters.');
      if (pw !== $('#u-pw2').value) return err('The passwords do not match.');
      if (pw) user.password = pw;
      $('#u-save').disabled = true;
      try {
        const r = await API.call('saveUser', { user });
        $('#user-dialog').close();
        if (original && original === state.username) {
          if (!r.me) { toast('Your account was disabled.', true); logout(); return; }
          API.setToken(r.me.token, API.remembered()); state.username = r.me.username; state.role = r.me.role; saveCfg(); renderBadge();
          if (r.me.role !== 'admin') { toast('You are no longer an admin.'); location.hash = '#/dashboard'; startApp(); return; }
        }
        setUsers(r.users);
        toast(original ? 'User updated.' : 'User added.');
      } catch (ex) {
        if (ex.auth) { $('#user-dialog').close(); guarded(() => Promise.reject(ex)).catch(() => {}); return; }
        err(ex.message);
      } finally { $('#u-save').disabled = false; }
    };

    // One request fills every admin section.
    guarded(() => API.call('settingsData')).then((d) => {
      if (!d || !$('#src-table')) return;
      setSources(d.sources); showSync(d.syncOn); drawStorage(d.storage); setMachines(d.machines); setUsers(d.users || []);
    }).catch(() => {});
    const lines = (id) => $(id).value.split('\n').map((l) => l.trim()).filter(Boolean);
    const builders = {
      Machines: () => lines('#adm-machines').map((l, i) => { const [n, s, a] = l.split('|').map((x) => (x || '').trim()); return { Name: n, Shifts: s || 'I,II,III', Order: i + 1, Active: !/^(decommissioned|inactive|no|false)$/i.test(a || '') }; }),
      Staff: () => lines('#adm-staff').map((n) => ({ Abbr: (n.match(/^\((\w+)\)/) || [, ''])[1], Name: n, Active: true })),
      Workload: () => lines('#adm-workload').map((l) => { const [m, s, w] = l.split('|').map((x) => (x || '').trim()); return { Machine: m, Shift: s, PerDay: Number(w) || 0 }; })
    };
    $$('[data-save]').forEach((b) => b.addEventListener('click', async () => {
      const table = b.dataset.save;
      b.disabled = true;
      try {
        state.cfg = await guarded(() => API.call('saveConfig', { table, rows: builders[table]() })); saveCfg();
        toast(table + ' saved.');
      } finally { b.disabled = false; }
    }));
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + (String(iso).length === 10 ? 'T00:00:00' : ''));
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDateTime(iso) {
    const d = new Date(iso);
    return isNaN(d) ? String(iso || '') : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function newEntryOn() { return !state.cfg || !state.cfg.settings || state.cfg.settings.showNewEntry !== false; }
  function applyFeatures() {
    const link = $('#tabs a[data-view="entry"]');
    if (link) link.hidden = !newEntryOn();
  }
  function renderBadge() {
    $('#role-badge').textContent = (state.username ? state.username + ' · ' : '') + (state.role === 'admin' ? 'Admin' : 'Staff');
  }
  function renderFooter() {
    const rel = (state.cfg && state.cfg.release) || {};
    $('#app-footer').innerHTML = `UNITY v${esc(rel.version || '')} · Released ${esc(fmtDate(rel.date))} · Division of Radiation Physics, RCC Thiruvananthapuram`;
  }

  // ---------- boot ----------
  // Version on the login screen (public ping, no key needed) — only when the login screen shows.
  async function loginVersion() {
    try {
      const url = window.UNITY_CONFIG.API_URL;
      if (!url || url.includes('REPLACE_WITH')) return;
      const r = await (await fetch(url + (url.includes('?') ? '&' : '?') + 'action=ping')).json();
      if (r && r.version) $('#login-version').textContent = `UNITY v${r.version} · Released ${fmtDate(r.releaseDate)}`;
    } catch (e) { /* offline: keep plain label */ }
  }
  function showLogin() {
    if (window.UnityPw) UnityPw.hideAll($('#login-form'));
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    loginVersion();
  }
  // Warm the cache for the pages people open most, one request at a time, when idle.
  function warmUp() {
    const p = defaultPeriod();
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(async () => {
      await prefetch('dashboard', { year: thisYear });
      await prefetch('status', { year: p.year, month: p.month });
      await prefetch('monthlyReport', { year: p.year, month: p.month });
    });
  }
  (async function boot() {
    if (!API.getToken()) { showLogin(); return; }
    // Instant start from the configuration saved at the last visit; verify in the background.
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('unity.cfg') || 'null'); } catch (e) {}
    if (saved && saved.cfg && saved.role) {
      state.role = saved.role; state.username = saved.username || ''; state.cfg = saved.cfg;
      startApp();
    }
    try {
      const data = await API.call('session');
      const changed = !saved || saved.role !== data.role || saved.username !== data.username || JSON.stringify(saved.cfg) !== JSON.stringify(data.config);
      state.role = data.role; state.username = data.username; state.cfg = data.config;
      saveCfg();
      if (!saved) startApp();
      else if (changed) { document.body.classList.toggle('is-admin', state.role === 'admin'); renderBadge(); renderFooter(); applyFeatures(); }
      warmUp();
    } catch (e) {
      if (e.auth) { logout(); showLogin(); $('#login-error').textContent = e.message; $('#login-error').hidden = false; return; }
      if (!saved) { showLogin(); $('#login-error').textContent = e.message; $('#login-error').hidden = false; }
    }
  })();
})();
