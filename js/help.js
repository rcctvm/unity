/* UNITY help & user manual — shared by the in-app Help page (#/help) and help.html.
 * Edit the HTML below; both places update together. */
window.UnityHelp = {
  css: `
    .help-layout > * { min-width: 0; }
    .help-layout { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 24px; max-width: 1150px; margin: 0 auto; padding: 18px 16px 40px; }
    .toc { position: sticky; top: 80px; align-self: start; background: var(--teal-2); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px; font-size: 14px; }
    .toc b { color: var(--cyan); display: block; margin-bottom: 6px; }
    .toc a { display: block; padding: 4px 0; color: var(--text); text-decoration: none; }
    .toc a:hover { color: var(--cyan); }
    .toc a.sub { padding-left: 12px; color: var(--muted); font-size: 13px; }
    article section { background: var(--teal-2); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px 20px; margin-bottom: 16px; scroll-margin-top: 80px; }
    article h2 { font-size: 20px; }
    article h3 { margin-top: 18px; }
    article p, article li { line-height: 1.6; max-width: 75ch; }
    article ol, article ul { padding-left: 22px; }
    article li { margin: 4px 0; }
    .tip { border-left: 4px solid var(--cyan); background: #031317; padding: 10px 14px; border-radius: 6px; margin: 12px 0; }
    .warn { border-left: 4px solid var(--warn); background: rgba(255,176,32,.08); padding: 10px 14px; border-radius: 6px; margin: 12px 0; }
    kbd { background: #031317; border: 1px solid var(--line); border-radius: 4px; padding: 1px 6px; font-size: 13px; }
    .hero { display: flex; gap: 16px; align-items: center; }
    .hero img { width: 72px; height: 72px; border-radius: 50%; background: #fff; flex: none; }
    .hero h1 { font-size: 30px; letter-spacing: 6px; margin: 0; }
    @media (max-width: 820px) { .help-layout { grid-template-columns: 1fr; } .toc { position: static; } }
    @media print { .toc { display: none; } .help-layout { display: block; } article section { border: none; padding: 0; } }
  `,
  toc: `<nav class="toc" aria-label="Contents">
      <b>Contents</b>
      <a href="#about" data-sec="about">About UNITY</a>
      <a href="#start" data-sec="start">Getting started</a>
      <a href="#staff" data-sec="staff">Staff guide</a>
      <a class="sub" href="#entry" data-sec="entry">New entry</a>
      <a class="sub" href="#status" data-sec="status">Submission status</a>
      <a class="sub" href="#entries" data-sec="entries">Entries &amp; corrections</a>
      <a class="sub" href="#reports" data-sec="reports">Reports &amp; printing</a>
      <a class="sub" href="#dashboard" data-sec="dashboard">Dashboard</a>
      <a href="#settings" data-sec="settings">Settings</a>
      <a class="sub" href="#display" data-sec="display">Display &amp; font</a>
      <a class="sub" href="#features" data-sec="features">Show/hide New entry</a>
      <a class="sub" href="#sources" data-sec="sources">Data sources &amp; import</a>
      <a class="sub" href="#sync" data-sec="sync">Hourly sync</a>
      <a class="sub" href="#storage" data-sec="storage">Storage</a>
      <a class="sub" href="#master" data-sec="master">Machines, staff, workload</a>
      <a class="sub" href="#keys" data-sec="keys">Users &amp; passwords</a>
      <a href="#rules" data-sec="rules">Data rules</a>
      <a href="#codes" data-sec="codes">Technique codes</a>
      <a href="#faq" data-sec="faq">FAQ &amp; troubleshooting</a>
      <a href="#tech" data-sec="tech">Technical notes</a>
    </nav>`,
  html: `
      <section id="about">
        <div class="hero">
          <img src="assets/logo.jpg" alt="Regional Cancer Centre, Thiruvananthapuram logo">
          <div><h1>UNITY</h1><div class="sub" style="margin:4px 0 0">Monthly RT Treatment Tracker</div></div>
        </div>
        <p>UNITY records the number of patients treated with each radiotherapy technique, the total sittings and machine down time
          for every machine and shift, month by month. It produces the monthly and annual RT treatment reports for the
          <b>Division of Radiation Physics, Regional Cancer Centre, Thiruvananthapuram</b>.</p>
        <p>It replaces the “Monthly RT Tx Report” Google Sheets used since 2022. All their data, from 2022 onwards, has been brought into UNITY,
          and the reports produce the same totals.</p>
        <table class="info" style="width:auto"><tbody>
          <tr><td class="tech">Version</td><td id="about-version">—</td></tr>
          <tr><td class="tech">Released</td><td id="about-date">—</td></tr>
          <tr><td class="tech">Department</td><td>Division of Radiation Physics, RCC Thiruvananthapuram</td></tr>
        </tbody></table>
      </section>

      <section id="start">
        <h2>Getting started</h2>
        <ol>
          <li>Open UNITY at <a href="./#/dashboard">rcctvm.github.io/unity</a>. It works on desktop computers and phones.</li>
          <li>Enter your <b>user name</b> and <b>password</b> and click <b>Sign in</b>. An administrator creates your account.
            <ul>
              <li><b>Staff</b>: view and print reports, correct entries (and enter monthly figures when New entry is switched on).</li>
              <li><b>Admin</b>: everything above, plus deleting entries, managing users and all Settings.</li>
            </ul></li>
          <li>Change your own password any time: <b>Settings → My account</b>.</li>
          <li>Tick <b>Remember on this device</b> only on your own computer or phone. On shared computers, leave it unticked and click <b>Sign out</b> when you finish.</li>
        </ol>
        <div class="tip">The menu at the top takes you to every page, including this Help page. The footer shows the UNITY version and release date. Pages you have already opened appear instantly and refresh themselves in the background.</div>
      </section>

      <section id="staff">
        <h2>Staff guide</h2>

        <h3 id="entry">New entry: monthly figures for one machine and shift</h3>
        <ol>
          <li>Click <b>New entry</b>.</li>
          <li>Choose the <b>Year</b> and <b>Month</b>. The previous month is pre-selected, because reports are usually filed after the month ends.</li>
          <li>Choose the <b>Machine</b>, then the <b>Shift</b> (only that machine’s shifts are listed), then the <b>Shift in charge</b>.</li>
          <li>Enter the number of patients for each technique. Leave a box empty for zero. <b>Total patients</b> is added up for you as you type.</li>
          <li>Enter the <b>Total no. of sittings</b> and the <b>Down time</b> in hours and minutes. Add a remark if needed.</li>
          <li>Click <b>Submit entry</b>. You are taken to the Submission status page for that month.</li>
        </ol>
        <div class="warn">There is one entry per <b>machine × shift × month</b>. If that slot has already been submitted, UNITY shows who submitted it and asks whether to <b>Replace</b> it. Choose Cancel if you are not sure.</div>
        <p>The <b>Workload/day</b> number under the form is a reference figure only. It is not saved with the entry.</p>

        <h3 id="status">Submission status</h3>
        <p>Shows every machine and shift for a month, marked <span class="pill ok">Received</span> or <span class="pill miss">Pending</span>, with a progress bar.
          Click <b>Pending</b> to open a new entry already filled in with that machine and shift.</p>

        <h3 id="entries">Entries and corrections</h3>
        <ul>
          <li><b>Entries</b> lists all entries for a year. Filter by month or machine.</li>
          <li>To <b>correct</b> an entry, click its row, change the figures and click <b>Save changes</b>.</li>
          <li><b>Export CSV</b> downloads the list for Excel.</li>
          <li>Only admins can <b>Delete</b> an entry.</li>
        </ul>

        <h3 id="reports">Reports and printing</h3>
        <ul>
          <li><b>Monthly report</b>: patients by technique for every machine and shift (I, II, III), with totals, sittings, workload per day, down time and shift in charge, the same layout as the old monthly sheet. A yellow note warns if some shifts have not submitted yet.</li>
          <li><b>Annual report</b>: choose <b>Calendar year</b> (January–December) or <b>Financial year</b> (April–March). It shows technique × month, patients and sittings by machine × month, and the technique × machine/shift summary.</li>
          <li>Click <b>Print / PDF</b>. In the print window choose your printer, or <b>Save as PDF</b>. Reports print on A4 landscape in black on white, and each table is kept whole on one page.</li>
          <li>A machine appears in reports only for the periods when it was in use. For example, Halcyon appears from April 2023, and the decommissioned Clinac 600 C appears only in 2022.</li>
        </ul>

        <h3 id="dashboard">Dashboard</h3>
        <p>Totals for the selected year (patients, sittings, down time, busiest month), with charts of patients per month by machine, sittings per month and patients by technique.</p>
      </section>

      <section id="settings">
        <h2>Settings</h2>
        <p>Settings is divided into sections. Click a section title to expand or collapse it; UNITY remembers which sections you keep open. Everyone can change the <b>Display</b> options. The other sections are visible only with the admin key.</p>

        <h3 id="features">Features: showing or hiding “New entry”</h3>
        <p>While staff still use the Google Form, the <b>New entry</b> tab can be hidden for everyone: <b>Settings → Features</b>, untick <b>Show the “New entry” tab</b>.
          Tick it again when you are ready to enter figures in UNITY. Correcting existing entries from the <b>Entries</b> page works either way.</p>

        <h3 id="display">Display and font</h3>
        <p>Choose <b>Default</b> or <b>Courier New</b>. The choice is saved on this device and browser only, so each person can pick their own. It also applies to this help page.</p>

        <h3 id="sources">Data sources and import</h3>
        <p>These are the old Google Sheets UNITY copies data from: the yearly sheets 2022–2025 and the live <b>Monthly RT Tx Report</b> sheet that the Google Form still writes to.</p>
        <ul>
          <li>UNITY <b>only reads</b> these sheets and never changes them.</li>
          <li><b>Year</b>: for a yearly sheet, its year. Leave it empty for the live sheet, and the year is taken from each submission’s date.</li>
          <li><b>Import</b> (one sheet) or <b>Import all active sources</b>. The result shows how many entries were added, updated and unchanged. Importing again is always safe and never creates duplicates.</li>
          <li>To add a sheet, click <b>+ Add source</b>, paste the sheet’s address (URL), enter its year, then click <b>Save sources</b> before importing.</li>
        </ul>

        <h3 id="sync">Hourly sync from the Google Form</h3>
        <p>While staff still use the Google Form, turn <b>hourly sync</b> on. Every hour, UNITY re-reads the sources ticked <b>Hourly sync</b> (normally the live sheet). Turn it off when the Google Form is retired.</p>

        <h3 id="storage">Storage (Google Sheets cell limit)</h3>
        <p>A Google Sheet can hold at most <b>10,000,000 cells</b> across all its tabs, and empty cells in each tab’s grid count too.
          The Storage panel shows the <b>% space available</b>, cells used, a per-tab breakdown and an estimate of how many more years of data fit.</p>
        <ul>
          <li>Green/cyan bar: plenty of space. Amber at 50% used: keep an eye on it. Red at 80% used: plan a new database sheet.</li>
          <li><b>Optimise</b> removes unused empty rows and columns at the end of each tab. Your data is not changed.</li>
          <li>For scale: one year of UNITY data is about 180 rows (15 machine-shifts × 12 months), roughly 5,000 cells. The limit is far away.</li>
        </ul>

        <h3 id="master">Machines, staff and workload</h3>
        <ul>
          <li><b>Machines</b>: one per line as <code>Name | Shifts | active</code>, or <code>| decommissioned</code> for a machine no longer in use. A decommissioned machine keeps its history in reports but no longer appears in New entry or Submission status. The line order is the display order.</li>
          <li><b>Shift in charge list</b>: one name per line, written as <code>(ABBR) Name</code>.</li>
          <li><b>Workload per day</b>: <code>Machine | Shift | number</code>, shown as reference figures in reports.</li>
        </ul>

        <h3 id="keys">Users and passwords</h3>
        <ul>
          <li><b>Settings → My account</b> (everyone): change your own user name and/or password. Your current password is required.</li>
          <li><b>Settings → Users</b> (admins): <b>+ Add user</b> with a user name, role and password; <b>Edit</b> to rename a user, change their role,
            disable them or set a new password; <b>Delete</b> to remove them. User names are lower-case (letters, numbers, dot, dash, underscore).</li>
          <li>Passwords must be at least 8 characters. They are stored only in hashed form, so nobody can look them up — if someone forgets theirs, an admin sets a new one.</li>
          <li>Changing a password, renaming or disabling a user signs that user out on every device.</li>
          <li>There must always be at least one active admin; UNITY will not let you delete, disable or demote the last one.</li>
          <li>After 5 wrong passwords a user name is locked for 15 minutes.</li>
          <li><b>All admins locked out?</b> In <b>script.google.com → UNITY → Project Settings → Script Properties</b>, add
            <code>UNITY_RESET_ADMIN_PASSWORD</code> with a new password and save. On the next visit, user <code>admin</code> gets that password
            (and admin rights) and the property is removed automatically.</li>
        </ul>
      </section>

      <section id="rules">
        <h2>Data rules</h2>
        <ul>
          <li><b>One entry per machine × shift × month.</b></li>
          <li><b>Total patients</b> = the sum of the technique counts. <b>Total sittings</b> and <b>down time</b> are entered separately.</li>
          <li><b>Imported data</b>: when the old Google Form was submitted more than once for the same slot, the <b>first</b> submission is used, the same as the old sheets’ reports. Later re-submissions are ignored.</li>
          <li><b>Corrections made in UNITY win.</b> An entry created or edited in UNITY is never overwritten by an import or the hourly sync.</li>
          <li>In the 2024 sheet, TBI and TSET shared one column (“TBI/TSET”); those numbers are counted under <b>TSET</b>.</li>
          <li>Every create, update, delete, import and settings change is recorded in the <b>AuditLog</b> tab of the UNITY sheet.</li>
        </ul>
      </section>

      <section id="codes">
        <h2>Technique codes</h2>
        <div class="table-wrap" style="max-width:520px"><table>
          <thead><tr><th>Technique</th><th>Code</th></tr></thead>
          <tbody>
            <tr><td class="tech">3DCRT</td><td>RT025</td></tr>
            <tr><td class="tech">IMRT</td><td>RT042</td></tr>
            <tr><td class="tech">IGRT</td><td>RT039</td></tr>
            <tr><td class="tech">SRS</td><td>RT048</td></tr>
            <tr><td class="tech">SRT</td><td>RT069</td></tr>
            <tr><td class="tech">ECRT</td><td>RT055</td></tr>
            <tr><td class="tech">Single RT</td><td>RT066</td></tr>
            <tr><td class="tech">2D Radical RT</td><td>RT067</td></tr>
            <tr><td class="tech">2D Palliative RT</td><td>RT068</td></tr>
            <tr><td class="tech">TBI</td><td>RT054</td></tr>
            <tr><td class="tech">TSET</td><td>RT054</td></tr>
          </tbody></table></div>
      </section>

      <section id="faq">
        <h2>FAQ and troubleshooting</h2>
        <h3>“Invalid user name or password”</h3>
        <p>Passwords are case-sensitive. If you have forgotten yours, ask an admin to set a new one (Settings → Users → Edit).</p>
        <h3>“Please sign in again”</h3>
        <p>Your session ended: it expired, or your password or user name was changed. Sign in again.</p>
        <h3>“Cannot reach the UNITY server”</h3>
        <p>Check your internet connection and try again. On hospital networks that block Google services, ask IT to allow <code>script.google.com</code> and <code>script.googleusercontent.com</code>.</p>
        <h3>I submitted the wrong numbers</h3>
        <p>Open <b>Entries</b>, click the row, correct it and click <b>Save changes</b>. Submitting the Google Form again does <b>not</b> change UNITY, because the first form submission is used.</p>
        <h3>A report total differs from the old sheet</h3>
        <p>Check whether someone corrected that entry in UNITY: the <b>Source</b> column in Entries shows <code>unity</code> for entries made or edited in UNITY and <code>legacy</code> for imported ones.</p>
        <h3>The page looks out of date after an update</h3>
        <p>Press <kbd>Ctrl</kbd>+<kbd>F5</kbd> (Mac: <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>) to reload.</p>
      </section>

      <section id="tech">
        <h2>Technical notes (for administrators)</h2>
        <ul>
          <li><b>Website</b>: GitHub repository <code>rcctvm/unity</code> (public), published with GitHub Pages. It holds no data and no keys.</li>
          <li><b>Server</b>: Google Apps Script project <b>UNITY</b>, with its code in the private repository <code>rcctvm/unity-code</code>.</li>
          <li><b>Database</b>: Google Sheet <b>Drive › UNITY › UNITY</b> (tabs Entries, Machines, Staff, Workload, Techniques, Sources, Settings, Tariffs, AuditLog).</li>
          <li><b>Automatic sync</b>: every code change pushed to GitHub is deployed to Apps Script automatically, and a health check runs afterwards. Edits made directly in the Apps Script editor are copied back to GitHub every 10 minutes, so the two always match.</li>
        </ul>
      </section>
      `,
  /** Render into `root`; section links scroll instead of changing the URL hash. */
  render: function (root) {
    root.innerHTML = '<div class="help-layout">' + this.toc + '<article>' + this.html + '</article></div>';
    root.querySelectorAll('a[data-sec]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var t = root.querySelector('#' + a.getAttribute('data-sec'));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    });
  }
};
(function () {
  if (document.getElementById('unity-help-css')) return;
  var st = document.createElement('style'); st.id = 'unity-help-css'; st.textContent = window.UnityHelp.css;
  document.head.appendChild(st);
})();
