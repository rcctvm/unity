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

  const state = { role: null, cfg: null, charts: [], editing: null };

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
  function chart(canvas, config) {
    if (!window.Chart) return;
    Chart.defaults.color = '#a9c7cd';
    Chart.defaults.borderColor = 'rgba(31,107,122,.5)';
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
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
  async function login(key, remember) {
    const data = await API.call('login', {}, key);
    API.setKey(key, remember);
    state.role = data.role;
    state.cfg = data.config;
    startApp();
  }
  function logout() {
    API.setKey('', false);
    state.role = null;
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    $('#login-key').value = '';
  }
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#login-btn'), err = $('#login-error');
    btn.disabled = true; btn.textContent = 'Signing in…'; err.hidden = true;
    try { await login($('#login-key').value.trim(), $('#login-remember').checked); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
    finally { btn.disabled = false; btn.textContent = 'Sign in'; }
  });
  $('#logout-btn').addEventListener('click', logout);

  function startApp() {
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    document.body.classList.toggle('is-admin', state.role === 'admin');
    $('#role-badge').textContent = state.role === 'admin' ? 'Admin' : 'Staff';
    if (state.cfg.settings.department) $('#dept-line').textContent = state.cfg.settings.department;
    route();
  }

  // ---------- router ----------
  const VIEWS = { dashboard: viewDashboard, entry: viewEntry, status: viewStatus, entries: viewEntries, monthly: viewMonthly, annual: viewAnnual, admin: viewAdmin };
  function route() {
    if (!state.role) return;
    const [, name = 'dashboard', ...args] = (location.hash || '#/dashboard').split('/');
    const view = VIEWS[name] || viewDashboard;
    $$('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
    if (name === 'admin' && state.role !== 'admin') { location.hash = '#/dashboard'; return; }
    view(...args);
  }
  window.addEventListener('hashchange', route);

  // ---------- Dashboard ----------
  async function viewDashboard(year) {
    year = Number(year) || thisYear;
    loading();
    const d = await guarded(() => API.call('dashboard', { year }));
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
      ${s.phone || s.email ? `<div class="foot">Contact: ${esc(s.phone)} ${s.email ? '· <a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a>' : ''}</div>` : ''}
    `);
    $('#dash-year').onchange = (e) => { location.hash = '#/dashboard/' + e.target.value; };
    const labels = MONTHS.map((m) => m.slice(0, 3));
    chart($('#c-patients'), {
      type: 'bar',
      data: { labels, datasets: machineNames.map((m, i) => ({ label: m, data: d.machines[m].patients, backgroundColor: MACHINE_COLORS[i % MACHINE_COLORS.length], borderRadius: 3 })) },
      options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
    });
    chart($('#c-sittings'), {
      type: 'line',
      data: { labels, datasets: [{ label: 'Sittings', data: d.months.map((m) => m.sittings), borderColor: '#ffff00', backgroundColor: 'rgba(255,255,0,.12)', fill: true, tension: .3, pointRadius: 3 }] },
      options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
    });
    const techs = state.cfg.techniques;
    chart($('#c-tech'), {
      type: 'bar',
      data: { labels: techs.map((t) => t.label), datasets: [{ label: 'Patients', data: techs.map((t) => d.techniques[t.key] || 0), backgroundColor: '#00ffff', borderRadius: 3 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { beginAtZero: true } }, plugins: { legend: { display: false } } }
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
    loading();
    const d = await guarded(() => API.call('status', { year, month }));
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
            ${s.submitted ? '<span class="pill ok">Received</span>' : `<a class="pill miss" href="#/entry" data-prefill="${esc(m)}|${esc(s.shift)}">Pending</a>`}</div>`).join('')}
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
    loading();
    const rows = await guarded(() => API.call('listEntries', { year, month, machine }));
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
        <thead><tr><th>Month</th><th>Machine</th><th>Shift</th><th>Shift in charge</th>
          ${techs.map((t) => `<th class="num" title="${esc(t.code)}">${esc(t.label)}</th>`).join('')}
          <th class="num">Patients</th><th class="num">Sittings</th><th class="num">Down time</th><th>Source</th>${state.role === 'admin' ? '<th></th>' : ''}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr class="clickable" data-i="${i}">
          <td>${esc(r.month.slice(0, 3))} ${r.year}</td><td class="tech">${esc(r.machine)}</td><td>${esc(r.shift)}</td><td>${esc(r.shiftInCharge)}</td>
          ${techs.map((t) => `<td class="num ${r.counts[t.key] ? '' : 'zero'}">${r.counts[t.key] || 0}</td>`).join('')}
          <td class="num grand">${fmt(r.totalPatients)}</td><td class="num">${fmt(r.totalSittings)}</td><td class="num">${minToHM(r.downTimeMin)}</td>
          <td class="note">${esc(r.source)}</td>
          ${state.role === 'admin' ? `<td><button class="btn danger small" data-del="${i}" type="button">Delete</button></td>` : ''}</tr>`).join('')}
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
    const machines = [];
    r.columns.forEach((c) => { const last = machines[machines.length - 1]; if (last && last.name === c.machine) last.span++; else machines.push({ name: c.machine, span: 1 }); });
    const cell = (v) => `<td class="num ${v ? '' : 'zero'}">${fmt(v)}</td>`;
    const t = r.totals;
    return `<div class="table-wrap"><table>
      <thead>
        <tr><th rowspan="2">Technique</th><th rowspan="2">Code</th>${machines.map((m) => `<th class="machine" colspan="${m.span}">${esc(m.name)}</th>`).join('')}<th rowspan="2" class="num">Total</th></tr>
        <tr>${r.columns.map((c) => `<th class="num">${esc(c.shift)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${r.rows.map((row) => `<tr><td class="tech">${esc(row.label)}</td><td class="code">${esc(row.code)}</td>${row.cells.map(cell).join('')}<td class="num grand">${fmt(row.total)}</td></tr>`).join('')}
        <tr class="total"><td colspan="2">Total patients</td>${t.patients.map((v) => `<td class="num">${fmt(v)}</td>`).join('')}<td class="num">${fmt(t.grandPatients)}</td></tr>
        <tr class="total"><td colspan="2">Total no. of sittings</td>${t.sittings.map((v) => `<td class="num">${fmt(v)}</td>`).join('')}<td class="num">${fmt(t.grandSittings)}</td></tr>
        ${t.workload ? `<tr class="meta"><td colspan="2">Workload per day</td>${t.workload.map((v) => `<td class="num">${v || ''}</td>`).join('')}<td></td></tr>` : ''}
        <tr class="meta"><td colspan="2">Total down time (h:mm)</td>${t.downTimeMin.map((v) => `<td class="num">${minToHM(v)}</td>`).join('')}<td class="num">${minToHM(t.grandDownTimeMin)}</td></tr>
        ${t.shiftInCharge ? `<tr class="meta"><td colspan="2">Shift in charge</td>${t.shiftInCharge.map((v, i) => `<td title="${esc(v)}">${v ? esc((v.match(/^\(\w+\)/) || [v])[0]) : (t.submitted[i] ? '' : '<span style="color:#ff8aa0">pending</span>')}</td>`).join('')}<td></td></tr>` : ''}
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
    loading();
    const r = await guarded(() => API.call('monthlyReport', { year, month }));
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
        ${reportGrid(r)}
        <h3 style="margin-top:18px">Summary by machine</h3>
        <div style="max-width:520px">${machineSummary(r)}</div>
      </div>`);
    const go = () => { location.hash = `#/monthly/${$('#m-year').value}/${$('#m-month').value}`; };
    $('#m-year').onchange = go; $('#m-month').onchange = go;
  }

  // ---------- Annual report ----------
  async function viewAnnual(mode, year) {
    mode = mode === 'financial' ? 'financial' : 'calendar';
    year = Number(year) || (mode === 'financial' ? (now.getMonth() >= 3 ? thisYear : thisYear - 1) : thisYear);
    loading();
    const r = await guarded(() => API.call('annualReport', { mode, year }));
    if (!r) return;
    const labels = r.periods.map((p) => p.label);
    const monthTable = (title, rows, totalRow) => `
      <h3 style="margin-top:18px">${title}</h3>
      <div class="table-wrap"><table>
        <thead><tr><th></th>${labels.map((l) => `<th class="num">${esc(l)}</th>`).join('')}<th class="num">Total</th></tr></thead>
        <tbody>${rows.map((row) => `<tr><td class="tech">${esc(row.label)}${row.code ? ` <span class="note">${esc(row.code)}</span>` : ''}</td>${row.cells.map((v) => `<td class="num ${v ? '' : 'zero'}">${fmt(v)}</td>`).join('')}<td class="num grand">${fmt(row.total)}</td></tr>`).join('')}
        ${totalRow ? `<tr class="total"><td>Total</td>${totalRow.map((v) => `<td class="num">${fmt(v)}</td>`).join('')}<td class="num">${fmt(totalRow.reduce((a, b) => a + b, 0))}</td></tr>` : ''}</tbody>
      </table></div>`;
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
        <h3 style="margin-top:18px">Technique × machine &amp; shift</h3>
        ${reportGrid(r)}
      </div>`);
    const go = () => { location.hash = `#/annual/${$('#a-mode').value}/${$('#a-year').value}`; };
    $('#a-mode').onchange = go; $('#a-year').onchange = go;
  }

  // ---------- Admin ----------
  function viewAdmin() {
    const cfg = state.cfg;
    const machinesTxt = cfg.machines.map((m) => `${m.name} | ${m.shifts.join(',')}`).join('\n');
    const staffTxt = cfg.staff.join('\n');
    const workloadTxt = cfg.machines.flatMap((m) => m.shifts.map((s) => `${m.name} | ${s} | ${cfg.workload[m.name + '|' + s] || 0}`)).join('\n');
    setMain(`
      <h1>Admin</h1>
      <div class="sub">Master data lives in the UNITY Google Sheet. Edits here replace the corresponding tab.</div>
      <div class="grid two">
        <div class="panel"><h2>Machines</h2><p class="note">One per line: <code>Machine | Shifts</code> (e.g. <code>Halcyon | I,II,III</code>). Order = display order.</p>
          <textarea id="adm-machines" rows="8">${esc(machinesTxt)}</textarea>
          <div class="actions"><button class="btn primary" data-save="Machines" type="button">Save machines</button></div></div>
        <div class="panel"><h2>Shift in charge list</h2><p class="note">One name per line, e.g. <code>(SGS) Salini G.S.</code></p>
          <textarea id="adm-staff" rows="8">${esc(staffTxt)}</textarea>
          <div class="actions"><button class="btn primary" data-save="Staff" type="button">Save staff</button></div></div>
        <div class="panel"><h2>Workload per day</h2><p class="note"><code>Machine | Shift | Patients per day</code></p>
          <textarea id="adm-workload" rows="8">${esc(workloadTxt)}</textarea>
          <div class="actions"><button class="btn primary" data-save="Workload" type="button">Save workload</button></div></div>
        <div class="panel"><h2>Import from legacy sheet</h2>
          <p class="note">Reads the <b>DATA</b> tab of “Monthly RT Tx Report” and “2025_Monthly RT Tx Report” <b>without changing them</b>.
          The latest submission per machine/shift/month is copied into UNITY. Entries created or edited in UNITY are never overwritten. Safe to run repeatedly.</p>
          <div class="actions"><button class="btn primary" id="adm-import" type="button">Run import</button></div>
          <pre id="adm-import-out" class="note" style="white-space:pre-wrap"></pre></div>
      </div>`);

    const lines = (id) => $(id).value.split('\n').map((l) => l.trim()).filter(Boolean);
    const builders = {
      Machines: () => lines('#adm-machines').map((l, i) => { const [n, s] = l.split('|').map((x) => (x || '').trim()); return { Name: n, Shifts: s || 'I,II,III', Order: i + 1, Active: true }; }),
      Staff: () => lines('#adm-staff').map((n) => ({ Abbr: (n.match(/^\((\w+)\)/) || [, ''])[1], Name: n, Active: true })),
      Workload: () => lines('#adm-workload').map((l) => { const [m, s, w] = l.split('|').map((x) => (x || '').trim()); return { Machine: m, Shift: s, PerDay: Number(w) || 0 }; })
    };
    $$('[data-save]').forEach((b) => b.addEventListener('click', async () => {
      const table = b.dataset.save;
      b.disabled = true;
      try {
        state.cfg = await guarded(() => API.call('saveConfig', { table, rows: builders[table]() }));
        toast(table + ' saved.');
      } finally { b.disabled = false; }
    }));
    $('#adm-import').onclick = async () => {
      const b = $('#adm-import'); b.disabled = true; b.textContent = 'Importing…';
      try {
        const res = await guarded(() => API.call('importLegacy'));
        $('#adm-import-out').textContent = res.map((r) => r.error ? `${r.source}: ERROR ${r.error}` : `${r.source}: ${r.added} added, ${r.updated} updated, ${r.unchanged} unchanged (${r.legacyRows} legacy rows read)`).join('\n');
        state.cfg = await API.call('bootstrap');
        toast('Import finished.');
      } finally { b.disabled = false; b.textContent = 'Run import'; }
    };
  }

  // ---------- boot ----------
  (async function boot() {
    const key = API.getKey();
    if (!key) { $('#login-view').hidden = false; return; }
    try {
      const data = await API.call('login', {}, key);
      state.role = data.role; state.cfg = data.config;
      startApp();
    } catch (e) {
      $('#login-view').hidden = false;
      if (!e.auth) { $('#login-error').textContent = e.message; $('#login-error').hidden = false; }
      else API.setKey('', false);
    }
  })();
})();
