/* Event Media OS v9 — sign-in and team.
 *
 *   Sign-in   friendly errors, Caps Lock warning, busy state, "Forgot
 *             password" email and the "choose a new password" page the
 *             email link opens, first-admin setup only for new workspaces.
 *   Account   change your own password, sign out of every device.
 *   Team      member list with role (Admin / Manager / Staff), status and
 *             last activity; add members; send password resets.
 *
 * Database side: supabase/migrations/202610300001_v9_team_roles.sql. The
 * page works without it (Admin/Staff only) and offers the SQL when needed.
 */
(function () {
  'use strict';

  var MIGRATION_PATH = 'supabase/migrations/202610300001_v9_team_roles.sql';
  function $(id) { return document.getElementById(id); }
  function has(fn) { return typeof window[fn] === 'function'; }
  function escH(v) { return has('esc') ? window.esc(v) : String(v == null ? '' : v); }
  function toast(m, t) { if (has('showToast')) window.showToast(m, t); }
  function base() { return has('sbBase') ? window.sbBase() : ''; }
  function anonKey() { return window.gv ? window.gv('sbKey').trim() : ''; }
  function ws() { return window.gv ? window.gv('sbWorkspace').trim() : ''; }
  function token() { return (typeof PROFILE_SESSION !== 'undefined' && PROFILE_SESSION && PROFILE_SESSION.access_token) || ''; }
  function me() { return (typeof PROFILE_CURRENT !== 'undefined' && PROFILE_CURRENT) || null; }
  function isOwner() { return has('isTeamOwner') && window.isTeamOwner(); }
  async function readJson(r) { var t = await r.text(); try { return t ? JSON.parse(t) : {}; } catch (e) { return { message: t }; } }
  function errText(d, r) { return (d && (d.msg || d.error_description || d.message || d.error)) || ('HTTP ' + (r ? r.status : '')); }

  async function rpc(name, body, opts) {
    opts = opts || {};
    var h = opts.anon ? { apikey: anonKey(), 'Content-Type': 'application/json' } : window.sbHeaders(anonKey());
    var r = await fetch(base() + '/rest/v1/rpc/' + name, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
    var d = await readJson(r);
    if (!r.ok) { var e = new Error(errText(d, r)); e.status = r.status; e.code = d && d.code; throw e; }
    return d;
  }
  function missingFn(e) { return e && (e.status === 404 || e.code === 'PGRST202' || /could not find the function/i.test(e.message || '')); }

  // ───────────────────────────────────────────────────────────────
  // SIGN-IN
  // ───────────────────────────────────────────────────────────────
  var PANES = { login: 'authPaneLogin', admin: 'authPaneAdmin', forgot: 'authPaneForgot', reset: 'authPaneReset' };
  window.showAuthMode = function (mode) {
    Object.keys(PANES).forEach(function (k) { var p = $(PANES[k]); if (p) p.style.display = k === mode ? '' : 'none'; });
    var tabL = $('authTabLogin'), tabA = $('authTabAdmin');
    if (tabL) tabL.classList.toggle('active', mode === 'login');
    if (tabA) tabA.classList.toggle('active', mode === 'admin');
    setStatus('');
    if (mode === 'forgot' && $('authForgotEmail') && !$('authForgotEmail').value) $('authForgotEmail').value = (window.gv && window.gv('authEmail')) || '';
    var pane = $(PANES[mode]); var f = pane && pane.querySelector('input:not([type=checkbox])');
    if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 30);
  };

  var FRIENDLY = [
    [/invalid login credentials/i, "That email and password don't match. Check them, or use \"Forgot password?\"."],
    [/email not confirmed/i, 'This email address has not been confirmed yet. Open the confirmation email, or ask your admin.'],
    [/rate limit|too many|429/i, 'Too many attempts. Wait a minute, then try again.'],
    [/failed to fetch|networkerror|load failed/i, "Can't reach the server. Check your internet connection and try again."],
    [/not active/i, 'Your account is switched off. Ask your admin to enable it on the Team page.'],
    [/different workspace/i, 'This account belongs to a different workspace.'],
    [/user already registered/i, 'An account with this email already exists. Sign in instead.'],
    [/password should be at least/i, 'Choose a longer password (at least 8 characters).']
  ];
  function friendly(msg) {
    var m = String(msg || '');
    for (var i = 0; i < FRIENDLY.length; i++) if (FRIENDLY[i][0].test(m)) return FRIENDLY[i][1];
    return m;
  }
  function setStatus(msg, kind) {
    var st = $('authStatus');
    if (!st) return;
    st.textContent = msg ? friendly(msg) : '';
    st.className = 'auth-status' + (msg ? ' v9-status-' + (kind || 'error') : '');
  }
  // The legacy code reports progress and errors through authStatus(msg, ok).
  window.authStatus = function (msg, ok) {
    if (msg && /^(signing in|creating)/i.test(msg)) { setStatus(''); return; }
    setStatus(msg, ok ? 'ok' : 'error');
  };

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 v9-spin"></i> ' + label; }
    else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
  }
  if (has('profileSignIn')) {
    var signIn0 = window.profileSignIn;
    window.profileSignIn = async function () {
      var email = (window.gv('authEmail') || '').trim(), pw = window.gv('authPassword') || '';
      if (!email || !pw) { setStatus(!email ? 'Enter your email address.' : 'Enter your password.'); ($(!email ? 'authEmail' : 'authPassword') || {}).focus && $(!email ? 'authEmail' : 'authPassword').focus(); return; }
      busy($('authSignInBtn'), true, 'Signing in…');
      try { await signIn0.apply(this, arguments); } finally { busy($('authSignInBtn'), false); }
      if (me() && me().active && $('authGate').style.display === 'none') { $('authPassword').value = ''; afterSignIn(); }
    };
  }
  if (has('profileCreateAdmin')) {
    var admin0 = window.profileCreateAdmin;
    window.profileCreateAdmin = function () {
      if ((window.gv('authAdminPassword') || '').length < 8) { setStatus('Choose a password of at least 8 characters.'); return; }
      return admin0.apply(this, arguments);
    };
  }

  function capsWatch(e) {
    if (!e.getModifierState) return;
    var c = $('authCaps'); if (c) c.hidden = !e.getModifierState('CapsLock');
  }

  // First-admin setup is only offered for a brand-new workspace.
  async function checkSetupLink() {
    var link = $('authSetupLink');
    if (!link || !base()) return;
    try {
      var hasAdmin = await rpc('workspace_has_admin', { ws: ws() }, { anon: true });
      link.hidden = hasAdmin === true;
    } catch (e) {
      link.hidden = false; // database update not run yet: keep the old behaviour
    }
  }

  // Forgot password ------------------------------------------------------
  window.sendPasswordReset = async function () {
    var email = (window.gv('authForgotEmail') || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('Enter the email address you sign in with.'); return; }
    busy($('authForgotBtn'), true, 'Sending…');
    try {
      var redirect = location.origin + location.pathname;
      var r = await fetch(base() + '/auth/v1/recover?redirect_to=' + encodeURIComponent(redirect), {
        method: 'POST', headers: { apikey: anonKey(), 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email })
      });
      if (!r.ok && r.status !== 404) { var d = await readJson(r); if (r.status === 429) throw new Error('rate limit'); throw new Error(errText(d, r)); }
      // Same message whether or not the account exists, so the form cannot be used to discover accounts.
      setStatus('If ' + email + ' has an account, a reset link is on its way. Check your inbox and spam folder; the link works once.', 'ok');
    } catch (e) { setStatus(e.message); }
    finally { busy($('authForgotBtn'), false); }
  };

  // Reset link landing ---------------------------------------------------
  var recovery = null, linkError = '';
  (function readHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    var p = {};
    h.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    if (p.type === 'recovery' && p.access_token) {
      recovery = { access_token: p.access_token, refresh_token: p.refresh_token, token_type: p.token_type || 'bearer',
        expires_in: Number(p.expires_in || 3600), expires_at: Number(p.expires_at || 0) || Math.floor(Date.now() / 1000) + Number(p.expires_in || 3600) };
    } else if (p.error || p.error_description) {
      linkError = /expired|invalid/i.test(p.error_description || p.error_code || '') ? 'That link has expired or was already used. Request a new one below.' : (p.error_description || p.error);
    } else return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  })();

  if (has('initProfileAuth')) {
    var init0 = window.initProfileAuth;
    window.initProfileAuth = async function () {
      if (!recovery) {
        var r = await init0.apply(this, arguments);
        if (linkError) { window.showAuthMode('forgot'); setStatus(linkError); }
        checkSetupLink();
        if (me() && me().active) afterSignIn();
        return r;
      }
      // Arrived from a password-reset email: ask for the new password first.
      if (has('ensureEventMediaPublicConfig')) window.ensureEventMediaPublicConfig();
      if (has('loadSupabaseCreds')) window.loadSupabaseCreds();
      if (has('ensureEventMediaPublicConfig')) window.ensureEventMediaPublicConfig();
      $('authGate').style.display = 'flex';
      window.showAuthMode('reset');
      try {
        var r2 = await fetch(base() + '/auth/v1/user', { headers: { apikey: anonKey(), Authorization: 'Bearer ' + recovery.access_token } });
        var u = await readJson(r2);
        if (!r2.ok) throw new Error(errText(u, r2));
        recovery.user = u;
        $('authResetFor').textContent = 'For ' + (u.email || 'your account') + '. Use at least 8 characters.';
      } catch (e) {
        recovery = null;
        window.showAuthMode('forgot');
        setStatus('That link has expired or was already used. Request a new one below.');
      }
    };
  }

  function strength(pw) {
    var s = 0;
    if (pw.length >= 8) s++; if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
    if (/^(.)\1+$/.test(pw) || /password|123456|qwerty|eventmedia/i.test(pw)) s = Math.min(s, 1);
    return Math.min(4, s);
  }
  function meter(input, bar, text) {
    var s = strength(input.value), labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
    if (bar) { bar.style.width = (input.value ? (s + 1) * 20 : 0) + '%'; bar.dataset.level = String(s); }
    if (text) text.textContent = input.value ? labels[input.value.length < 8 ? 0 : s] : '';
  }
  function validNew(p1, p2) {
    if (p1.length < 8) return 'Use at least 8 characters.';
    if (strength(p1) < 2) return 'That password is easy to guess. Add more words, numbers or symbols.';
    if (p1 !== p2) return "The two passwords don't match.";
    return '';
  }
  async function putPassword(accessToken, pw) {
    var r = await fetch(base() + '/auth/v1/user', {
      method: 'PUT', headers: { apikey: anonKey(), Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    var d = await readJson(r);
    if (!r.ok) throw new Error(/same/i.test(errText(d, r)) ? 'Choose a password different from your current one.' : errText(d, r));
    return d;
  }
  window.completePasswordReset = async function () {
    if (!recovery) { window.showAuthMode('forgot'); return; }
    var p1 = window.gv('authNewPassword'), p2 = window.gv('authNewPassword2');
    var bad = validNew(p1, p2); if (bad) { setStatus(bad); return; }
    busy($('authResetBtn'), true, 'Saving…');
    try {
      await putPassword(recovery.access_token, p1);
      var session = Object.assign({}, recovery, { user: recovery.user });
      recovery = null;
      window.saveProfileSession(session);
      await window.loadCurrentProfile();
      if (!me() || !me().active) throw new Error('not active');
      window.applyProfileAccess();
      $('authNewPassword').value = ''; $('authNewPassword2').value = '';
      toast('Password updated. You are signed in.', 'success');
      afterSignIn();
    } catch (e) { setStatus(e.message); }
    finally { busy($('authResetBtn'), false); }
  };

  // ───────────────────────────────────────────────────────────────
  // ACCOUNT (side-menu footer)
  // ───────────────────────────────────────────────────────────────
  var seenTimer = null;
  function afterSignIn() {
    touchSeen();
    clearInterval(seenTimer);
    seenTimer = setInterval(function () { if (document.visibilityState === 'visible') touchSeen(); }, 10 * 60 * 1000);
    addAccountButton();
  }
  function touchSeen() { if (token()) rpc('touch_last_seen', {}).catch(function () {}); }

  function addAccountButton() {
    var foot = document.querySelector('.v8-foot-actions');
    if (!foot || $('v9AccountBtn')) return;
    var b = document.createElement('button');
    b.className = 'btn btn-sm'; b.id = 'v9AccountBtn'; b.type = 'button'; b.title = 'Your account';
    b.innerHTML = '<i class="ti ti-user-cog"></i> Account';
    b.onclick = openAccount;
    foot.insertBefore(b, foot.firstChild);
  }

  function dialog(id, html) {
    var old = $(id); if (old) old.remove();
    var ov = document.createElement('div');
    ov.className = 'v7-overlay'; ov.id = id;
    ov.innerHTML = '<div class="v7-dialog v9-dialog" role="dialog" aria-modal="true" aria-labelledby="' + id + 'T">' + html + '</div>';
    var prev = document.activeElement;
    var close = function () { ov.remove(); if (prev && prev.focus) try { prev.focus(); } catch (e) {} };
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    document.body.appendChild(ov);
    ov.querySelectorAll('[data-close]').forEach(function (x) { x.onclick = close; });
    return { el: ov, close: close };
  }

  function openAccount() {
    var p = me() || {};
    var d = dialog('v9Account',
      '<div class="v7-dialog-head"><h2 id="v9AccountT">Your account</h2><button type="button" class="v7-x" aria-label="Close" data-close>&times;</button></div>' +
      '<div class="v9-acc-id"><span class="v9-avatar v9-avatar-lg">' + escH(initials(p.full_name || p.email)) + '</span><div><strong>' + escH(p.full_name || 'Your name') + '</strong><span>' + escH(p.email || '') + '</span><span class="v9-role v9-role-' + escH(p.role || '') + '">' + escH(window.roleLabel ? window.roleLabel(p.role) : p.role) + '</span></div></div>' +
      '<form id="v9PwForm" class="v9-form" novalidate><h3>Change password</h3>' +
      '<label class="v7-field">Current password<input type="password" id="v9PwOld" autocomplete="current-password"></label>' +
      '<label class="v7-field">New password<input type="password" id="v9PwNew" autocomplete="new-password"></label>' +
      '<div class="v9-meter v9-meter-in" aria-hidden="true"><span id="v9PwBar"></span></div><div class="v9-meter-text v9-meter-in" id="v9PwText"></div>' +
      '<label class="v7-field">Repeat new password<input type="password" id="v9PwNew2" autocomplete="new-password"></label>' +
      '<div class="v9-form-msg" id="v9PwMsg" role="alert"></div>' +
      '<div class="v7-dialog-foot"><button type="button" class="btn btn-sm" id="v9SignOutAll"><i class="ti ti-devices-off"></i> Sign out on all devices</button><button type="submit" class="btn btn-sm v8-primary-btn" id="v9PwSave"><i class="ti ti-lock-check"></i> Update password</button></div></form>');
    $('v9PwNew').addEventListener('input', function () { meter($('v9PwNew'), $('v9PwBar'), $('v9PwText')); });
    $('v9PwForm').onsubmit = async function (e) {
      e.preventDefault();
      var msg = $('v9PwMsg'), old = $('v9PwOld').value, p1 = $('v9PwNew').value, p2 = $('v9PwNew2').value;
      msg.className = 'v9-form-msg';
      if (!old) { msg.textContent = 'Enter your current password.'; return; }
      var bad = validNew(p1, p2); if (bad) { msg.textContent = bad; return; }
      busy($('v9PwSave'), true, 'Updating…');
      try {
        // Re-check the current password before changing it.
        var r = await fetch(base() + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: anonKey(), 'Content-Type': 'application/json' }, body: JSON.stringify({ email: p.email, password: old }) });
        var sess = await readJson(r);
        if (!r.ok) throw new Error(/invalid login/i.test(errText(sess, r)) ? 'Your current password is not correct.' : errText(sess, r));
        window.saveProfileSession(sess);
        await putPassword(sess.access_token, p1);
        d.close();
        toast('Password updated', 'success');
      } catch (err) { msg.textContent = friendly(err.message); }
      finally { busy($('v9PwSave'), false); }
    };
    $('v9SignOutAll').onclick = async function () {
      if (!window.confirm('Sign out of every device, including this one?')) return;
      try { await fetch(base() + '/auth/v1/logout?scope=global', { method: 'POST', headers: { apikey: anonKey(), Authorization: 'Bearer ' + token() } }); } catch (e) {}
      d.close();
      window.profileLogout();
      toast('Signed out on all devices', 'success');
    };
    $('v9PwOld').focus();
  }
  window.openAccount = openAccount;

  // ───────────────────────────────────────────────────────────────
  // TEAM
  // ───────────────────────────────────────────────────────────────
  var ROLES = [
    { id: 'admin', label: 'Admin', desc: 'Everything, including the team, activity log and database tools.' },
    { id: 'manager', label: 'Manager', desc: 'Quotations, invoices, payments, rentals, finance, clients and events. Cannot manage the team.' },
    { id: 'employee', label: 'Staff', desc: 'Supplier rentals and equipment hire only.' }
  ];
  var team = { rows: [], extended: null, q: '' };

  function initials(s) {
    var parts = String(s || '?').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
    return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  function ago(ts) {
    if (!ts) return 'Never';
    var s = (Date.now() - new Date(ts).getTime()) / 1000;
    if (s < 90) return 'Just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    if (s < 86400 * 30) { var dd = Math.round(s / 86400); return dd + (dd === 1 ? ' day ago' : ' days ago'); }
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function fetchTeam() {
    try {
      var rows = await rpc('team_members', {});
      team.extended = true;
      return rows || [];
    } catch (e) {
      if (!missingFn(e)) throw e;
      team.extended = false;
      var r = await fetch(base() + '/rest/v1/app_profiles?workspace_id=eq.' + encodeURIComponent(ws()) + '&select=user_id,email,full_name,role,active,created_at&order=created_at.asc', { headers: window.sbHeaders(anonKey()) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }
  }

  function teamShell() {
    var pane = $('managerPane-profiles');
    if (!pane) return null;
    if (!pane.dataset.v9) {
      pane.dataset.v9 = '1';
      pane.innerHTML =
        '<div id="v9TeamUpgrade"></div>' +
        '<div class="v9-team-head"><div><p class="v9-sub v9-sub-lead" id="v9TeamSummary">Loading team…</p></div>' +
        '<div class="v9-team-tools"><input type="search" id="v9TeamSearch" placeholder="Search name or email" aria-label="Search team"><button type="button" class="btn btn-sm" id="v9TeamRefresh"><i class="ti ti-refresh"></i> Refresh</button>' +
        '<button type="button" class="btn btn-sm v8-primary-btn" id="v9AddMember"><i class="ti ti-user-plus"></i> Add member</button></div></div>' +
        '<div class="v9-team-list" id="v9TeamList" role="list"></div>' +
        '<div class="v9-roles">' + ROLES.map(function (r) { return '<div class="v9-role-card"><span class="v9-role v9-role-' + r.id + '">' + r.label + '</span><p>' + r.desc + '</p></div>'; }).join('') + '</div>' +
        '<p class="v9-fine">Access is enforced by the database, not just hidden in the app. Switching someone off blocks their data access straight away.</p>';
      $('v9TeamSearch').addEventListener('input', function () { team.q = this.value.trim().toLowerCase(); drawTeam(); });
      $('v9TeamRefresh').onclick = loadTeam;
      $('v9AddMember').onclick = openAddMember;
      $('v9TeamList').addEventListener('change', onRoleChange);
      $('v9TeamList').addEventListener('click', onTeamClick);
    }
    return pane;
  }

  async function loadTeam() {
    if (!isOwner() || !teamShell()) return;
    var list = $('v9TeamList');
    if (!team.rows.length) list.innerHTML = '<div class="v7-empty">Loading team…</div>';
    try {
      team.rows = await fetchTeam();
      drawUpgrade();
      drawTeam();
    } catch (e) {
      list.innerHTML = '<div class="v7-empty">Could not load the team: ' + escH(e.message) + '</div>';
    }
  }
  window.loadTeam = loadTeam;
  // The legacy Profiles loader is replaced by this page.
  window.loadProfiles = function () { return loadTeam(); };

  function drawUpgrade() {
    var box = $('v9TeamUpgrade');
    if (!box) return;
    if (team.extended !== false) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="v9-upgrade"><i class="ti ti-database-cog" aria-hidden="true"></i><div><strong>One-time database update needed</strong>' +
      '<p>Run it once in the Supabase SQL Editor to enable the Manager role, last-active times and the safety rules (the last admin can no longer be removed by mistake).</p></div>' +
      '<div class="v9-upgrade-actions"><button type="button" class="btn btn-sm" id="v9CopySql"><i class="ti ti-copy"></i> Copy SQL</button><button type="button" class="btn btn-sm v8-primary-btn" id="v9OpenSql"><i class="ti ti-external-link"></i> Open SQL Editor</button></div></div>';
    var copy = async function () {
      try {
        var r = await fetch(MIGRATION_PATH); if (!r.ok) throw new Error();
        await navigator.clipboard.writeText(await r.text());
        toast('SQL copied. Paste it into the SQL Editor and press Run.', 'success');
        return true;
      } catch (e) { toast('Could not copy automatically. Open ' + MIGRATION_PATH + ' from the project folder and paste it into the SQL Editor.', 'error'); return false; }
    };
    $('v9CopySql').onclick = copy;
    $('v9OpenSql').onclick = async function () {
      await copy();
      var ref = has('sbProjectRef') ? window.sbProjectRef() : '';
      if (ref) window.open('https://supabase.com/dashboard/project/' + ref + '/sql/new', '_blank', 'noopener');
    };
  }

  function drawTeam() {
    var list = $('v9TeamList'); if (!list) return;
    var rows = team.rows, self = me() && me().user_id;
    var counts = { admin: 0, manager: 0, employee: 0, off: 0 };
    rows.forEach(function (p) { if (!p.active) counts.off++; else counts[p.role] = (counts[p.role] || 0) + 1; });
    $('v9TeamSummary').textContent = rows.length + ' member' + (rows.length === 1 ? '' : 's') + ': ' +
      [counts.admin + ' admin' + (counts.admin === 1 ? '' : 's'), counts.manager ? counts.manager + ' manager' + (counts.manager === 1 ? '' : 's') : '', counts.employee + ' staff', counts.off ? counts.off + ' switched off' : ''].filter(Boolean).join(', ');
    var shown = rows.filter(function (p) { return !team.q || (String(p.full_name) + ' ' + String(p.email)).toLowerCase().indexOf(team.q) >= 0; });
    if (!shown.length) { list.innerHTML = '<div class="v7-empty">' + (team.q ? 'No one matches "' + escH(team.q) + '".' : 'No team members yet. Add your first member.') + '</div>'; return; }
    var activeAdmins = rows.filter(function (p) { return p.role === 'admin' && p.active; }).length;
    list.innerHTML = shown.map(function (p) {
      var isSelf = p.user_id === self;
      var lastAdmin = p.role === 'admin' && p.active && activeAdmins <= 1;
      var roleOpts = ROLES.filter(function (r) { return team.extended !== false || r.id !== 'manager' || p.role === 'manager'; })
        .map(function (r) { return '<option value="' + r.id + '"' + (p.role === r.id ? ' selected' : '') + '>' + r.label + '</option>'; }).join('');
      var lock = isSelf ? 'You can\'t change your own role' : (lastAdmin ? 'The only admin must stay an admin' : '');
      return '<div class="v9-member' + (p.active ? '' : ' is-off') + '" role="listitem" data-uid="' + escH(p.user_id) + '">' +
        '<span class="v9-avatar">' + escH(initials(p.full_name || p.email)) + '</span>' +
        '<div class="v9-member-id"><strong>' + escH(p.full_name || p.email || 'Unnamed') + (isSelf ? ' <span class="v9-you">You</span>' : '') + '</strong><span>' + escH(p.email || '') + '</span></div>' +
        '<div class="v9-member-seen" title="' + (team.extended ? 'Last active in the app' : 'Available after the database update') + '">' + (team.extended ? escH(ago(p.last_seen_at || p.last_sign_in_at)) : '—') + '</div>' +
        '<label class="v9-member-role"><span class="sr-only">Role for ' + escH(p.full_name || p.email) + '</span><select data-role ' + (lock ? 'disabled title="' + lock + '"' : '') + '>' + roleOpts + '</select></label>' +
        '<div class="v9-member-status"><span class="v9-dot ' + (p.active ? 'on' : 'off') + '"></span>' + (p.active ? 'Active' : 'Switched off') + '</div>' +
        '<div class="v9-member-actions">' +
          '<button type="button" class="btn btn-sm" data-act="reset" title="Email a password reset link"><i class="ti ti-key"></i><span>Reset password</span></button>' +
          (isSelf ? '' : '<button type="button" class="btn btn-sm' + (p.active ? '' : ' v8-primary-btn') + '" data-act="toggle"' + (lastAdmin ? ' disabled title="The only admin can\'t be switched off"' : '') + '><i class="ti ti-' + (p.active ? 'user-off' : 'user-check') + '"></i><span>' + (p.active ? 'Switch off' : 'Switch on') + '</span></button>') +
        '</div></div>';
    }).join('');
  }

  async function patchProfile(uid, body) {
    var r = await fetch(base() + '/rest/v1/app_profiles?user_id=eq.' + encodeURIComponent(uid), {
      method: 'PATCH', headers: window.sbHeaders(anonKey(), { Prefer: 'return=representation' }), body: JSON.stringify(body)
    });
    var d = await readJson(r);
    if (!r.ok) {
      var m = errText(d, r);
      if (d && d.code === '23514') m = 'The Manager role needs the one-time database update first (see the box at the top of this page).';
      throw new Error(m);
    }
    if (Array.isArray(d) && d.length) return d[0];
    // No row changed: older databases route changes through the manage-profile function.
    if (body.role !== undefined) await window.secureProfileAction({ action: 'set_role', user_id: uid, role: body.role });
    else if (body.active !== undefined) await window.secureProfileAction({ action: 'set_active', user_id: uid, active: !!body.active });
    return null;
  }

  async function onRoleChange(e) {
    var sel = e.target.closest('select[data-role]'); if (!sel) return;
    var row = sel.closest('.v9-member'), uid = row.dataset.uid;
    var p = team.rows.filter(function (x) { return x.user_id === uid; })[0]; if (!p) return;
    var label = ROLES.filter(function (r) { return r.id === sel.value; })[0].label;
    if (!window.confirm('Make ' + (p.full_name || p.email) + ' ' + (label === 'Admin' ? 'an' : 'a') + ' ' + label + '?\n\n' + ROLES.filter(function (r) { return r.id === sel.value; })[0].desc)) { sel.value = p.role; return; }
    sel.disabled = true;
    try { await patchProfile(uid, { role: sel.value }); toast((p.full_name || p.email) + ' is now ' + label, 'success'); }
    catch (err) { toast(err.message, 'error'); }
    await loadTeam();
  }

  async function onTeamClick(e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var uid = b.closest('.v9-member').dataset.uid;
    var p = team.rows.filter(function (x) { return x.user_id === uid; })[0]; if (!p) return;
    if (b.dataset.act === 'toggle') {
      var on = !p.active;
      if (!window.confirm((on ? 'Switch on ' : 'Switch off ') + (p.full_name || p.email) + '?' + (on ? '' : '\n\nThey will lose access immediately. Their records stay.'))) return;
      b.disabled = true;
      try { await patchProfile(uid, { active: on }); toast((p.full_name || p.email) + (on ? ' can sign in again' : ' has been switched off'), 'success'); }
      catch (err) { toast(err.message, 'error'); }
      await loadTeam();
    } else if (b.dataset.act === 'reset') {
      if (!p.email || !window.confirm('Email a password reset link to ' + p.email + '?')) return;
      b.disabled = true;
      try {
        var r = await fetch(base() + '/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), {
          method: 'POST', headers: { apikey: anonKey(), 'Content-Type': 'application/json' }, body: JSON.stringify({ email: p.email })
        });
        if (!r.ok) { var d = await readJson(r); throw new Error(r.status === 429 ? 'Too many reset emails. Try again in a minute.' : errText(d, r)); }
        toast('Reset link sent to ' + p.email, 'success');
      } catch (err) { toast(friendly(err.message), 'error'); }
      b.disabled = false;
    }
  }

  function genPassword() {
    var words = ['Stage', 'Light', 'Sound', 'Camera', 'Truss', 'Mixer', 'Laser', 'Drone', 'Lens', 'Cable'];
    var pick = function (n) { var b = new Uint32Array(1); (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(b) : (b[0] = Math.random() * 4294967296); return b[0] % n; };
    return words[pick(10)] + '-' + words[pick(10)] + '-' + (1000 + pick(9000)) + (has('secureRandomString') ? window.secureRandomString(2, 'ABCDEFGHJKMNPQRSTUVWXYZ') : 'X');
  }

  function openAddMember() {
    var d = dialog('v9AddMemberDlg',
      '<div class="v7-dialog-head"><h2 id="v9AddMemberDlgT">Add a team member</h2><button type="button" class="v7-x" aria-label="Close" data-close>&times;</button></div>' +
      '<p class="v7-dialog-sub">They sign in with this email and the temporary password, then change it under Account.</p>' +
      '<form id="v9AddForm" class="v9-form" novalidate>' +
      '<label class="v7-field">Full name<input id="v9NewName" autocomplete="off" placeholder="e.g. Nimal Perera"></label>' +
      '<label class="v7-field">Email<input id="v9NewEmail" type="email" autocomplete="off" placeholder="nimal@example.com"></label>' +
      '<fieldset class="v9-role-pick"><legend>Role</legend>' + ROLES.map(function (r) {
        var disabled = r.id === 'manager' && team.extended === false;
        return '<label class="v9-role-opt' + (disabled ? ' is-disabled' : '') + '"><input type="radio" name="v9NewRole" value="' + r.id + '"' + (r.id === 'employee' ? ' checked' : '') + (disabled ? ' disabled' : '') + '><span><strong>' + r.label + '</strong><small>' + r.desc + (disabled ? ' Needs the database update.' : '') + '</small></span></label>';
      }).join('') + '</fieldset>' +
      '<label class="v7-field">Temporary password<span class="v9-pw-row"><input id="v9NewPw" autocomplete="off"><button type="button" class="btn btn-sm" id="v9NewPwGen" title="Generate another"><i class="ti ti-refresh"></i></button></span></label>' +
      '<div class="v9-form-msg" id="v9AddMsg" role="alert"></div>' +
      '<div class="v7-dialog-foot"><button type="button" class="btn btn-sm" data-close>Cancel</button><button type="submit" class="btn btn-sm v8-primary-btn" id="v9AddSave"><i class="ti ti-user-plus"></i> Create account</button></div></form>');
    $('v9NewPw').value = genPassword();
    $('v9NewPwGen').onclick = function () { $('v9NewPw').value = genPassword(); };
    $('v9AddForm').onsubmit = async function (e) {
      e.preventDefault();
      var name = $('v9NewName').value.trim(), email = $('v9NewEmail').value.trim(), pw = $('v9NewPw').value;
      var role = (d.el.querySelector('input[name=v9NewRole]:checked') || {}).value || 'employee';
      var msg = $('v9AddMsg');
      if (!name) { msg.textContent = 'Enter their name.'; $('v9NewName').focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Enter a valid email address.'; $('v9NewEmail').focus(); return; }
      if (pw.length < 8) { msg.textContent = 'The temporary password needs at least 8 characters.'; return; }
      if (team.rows.some(function (p) { return String(p.email || '').toLowerCase() === email.toLowerCase(); })) { msg.textContent = 'Someone with this email is already on the team.'; return; }
      busy($('v9AddSave'), true, 'Creating…'); msg.textContent = '';
      try {
        var r = await fetch(base() + '/functions/v1/create-employee', {
          method: 'POST', headers: { apikey: anonKey(), Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: ws(), full_name: name, email: email, password: pw })
        });
        var data = await readJson(r);
        if (!r.ok) throw new Error(errText(data, r) + (data.request_id ? ' (request ' + data.request_id + ')' : ''));
        var warn = '';
        if (role !== 'employee') {
          team.rows = await fetchTeam();
          var created = team.rows.filter(function (p) { return String(p.email || '').toLowerCase() === email.toLowerCase(); })[0];
          if (created) { try { await patchProfile(created.user_id, { role: role }); } catch (err) { warn = 'The account was created as Staff: ' + err.message; } }
          else warn = 'The account was created as Staff. Change the role in the list once it appears.';
        }
        showCredentials(d, name, email, pw, role, warn);
        loadTeam();
      } catch (err) {
        msg.textContent = /already|registered|exists/i.test(err.message) ? 'An account with this email already exists.' : ('Could not create the account: ' + err.message);
      } finally { busy($('v9AddSave'), false); }
    };
    $('v9NewName').focus();
  }

  function showCredentials(d, name, email, pw, role, warn) {
    var label = ROLES.filter(function (r) { return r.id === role; })[0].label;
    var text = 'Hi ' + name.split(' ')[0] + ', your Event Media Business OS account is ready.\n\nSign in: ' + location.origin + location.pathname +
      '\nEmail: ' + email + '\nTemporary password: ' + pw + '\n\nPlease change your password after signing in (Account → Change password).';
    var box = d.el.querySelector('.v7-dialog');
    box.innerHTML = '<div class="v7-dialog-head"><h2>' + escH(name) + ' has been added</h2><button type="button" class="v7-x" aria-label="Close" data-close>&times;</button></div>' +
      '<p class="v7-dialog-sub">Role: ' + label + '. Send these sign-in details privately; the password is not shown again.</p>' +
      (warn ? '<div class="v9-upgrade v9-warn"><i class="ti ti-alert-triangle"></i><div><p>' + escH(warn) + '</p></div></div>' : '') +
      '<label class="v7-field">Sign-in details<textarea id="v9CredText" rows="8" readonly></textarea></label>' +
      '<div class="v7-dialog-foot"><button type="button" class="btn btn-sm" id="v9CredCopy"><i class="ti ti-copy"></i> Copy</button>' +
      '<button type="button" class="btn btn-sm v7-primary" id="v9CredWa"><i class="ti ti-brand-whatsapp"></i> Send on WhatsApp</button><button type="button" class="btn btn-sm v8-primary-btn" data-close>Done</button></div>';
    $('v9CredText').value = text;
    box.querySelectorAll('[data-close]').forEach(function (x) { x.onclick = d.close; });
    $('v9CredCopy').onclick = function () { navigator.clipboard.writeText(text).then(function () { toast('Copied', 'success'); }, function () { $('v9CredText').select(); }); };
    $('v9CredWa').onclick = function () { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener'); };
  }

  // ───────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    ['authPassword', 'authNewPassword', 'authAdminPassword'].forEach(function (id) {
      var el = $(id); if (!el) return;
      el.addEventListener('keydown', capsWatch); el.addEventListener('keyup', capsWatch);
    });
    var np = $('authNewPassword'); if (np) np.addEventListener('input', function () { meter(np, $('authMeterBar'), $('authMeterText')); });
    addAccountButton();
  });
})();
