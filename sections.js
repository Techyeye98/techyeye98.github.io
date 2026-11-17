// Interaction and state-change motion for the sections below the hero.
// Uses the free Motion package (vendor/motion.js, window.Motion). Content is fully visible without JS.
(() => {
  const M = window.Motion;
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceQuery.matches || !M;
  const ease = [0.23, 1, 0.32, 1];
  const run = (el, keyframes, opts) => (reduced() ? null : M.animate(el, keyframes, { ease, ...opts }));

  /* ---------- Theme dot after BUILDER: cycles the accent colour ---------- */
  const dot = document.querySelector('#accent-dot');
  if (dot) {
    const themes = [['crimson', 'Crimson'], ['ember', 'Ember'], ['cobalt', 'Cobalt'], ['violet', 'Violet'], ['jade', 'Jade']];
    const root = document.documentElement;
    const status = document.querySelector('#accent-status');
    const current = () => Math.max(0, themes.findIndex(t => t[0] === (root.dataset.accent || 'crimson')));
    const label = i => dot.setAttribute('aria-label', `Change colour theme. Current: ${themes[i][1]}. Next: ${themes[(i + 1) % themes.length][1]}`);
    label(current());
    dot.addEventListener('click', () => {
      const next = (current() + 1) % themes.length;
      const [key, name] = themes[next];
      if (key === 'crimson') delete root.dataset.accent; else root.dataset.accent = key;
      try { key === 'crimson' ? localStorage.removeItem('nm-accent') : localStorage.setItem('nm-accent', key); } catch {}
      label(next);
      dot.dataset.tip = name;
      status.textContent = `${name} theme`;
      window.dispatchEvent(new CustomEvent('accentchange', { detail: key }));
      run(dot, { scale: [0.7, 1.15, 1] }, { duration: 0.42 });
    });
    dot.addEventListener('blur', () => (dot.dataset.tip = 'Change colour'));
    // One gentle glow after the intro so touch visitors notice the dot is alive.
    if (!reduced()) setTimeout(() => dot.classList.add('is-hinting'), 3200);
  }

  /* ---------- 01 Pocket Ledger: receipt prints from the slot once ---------- */
  const receipt = document.querySelector('.receipt-flip');
  if (receipt && !reduced() && 'IntersectionObserver' in window) {
    const clip = document.createElement('div');
    clip.className = 'receipt-clip';
    clip.style.cssText = 'overflow:hidden;padding:0 0 40px;margin-bottom:-40px';
    receipt.before(clip); clip.append(receipt);
    const below = receipt.getBoundingClientRect().top > innerHeight;
    if (below) {
      receipt.style.transform = 'translateY(-101%)';
      M.inView(clip, () => {
        M.animate(receipt, { y: ['-101%', '0%'] }, { duration: 1.1, ease: [0.32, 0.72, 0, 1] })
          .then(() => (receipt.style.transform = ''));
      }, { amount: 0.25 });
    }
  }

  /* ---------- 01 Pocket Ledger: spent-or-moved phone ---------- */
  const inr = n => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const inr2 = n => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function count(el, from, to, fmt) {
    if (reduced() || from === to) { el.textContent = fmt(to); return; }
    M.animate(from, to, { duration: 0.5, ease, onUpdate: v => (el.textContent = fmt(Math.round(v * 100) / 100)) });
  }
  function flash(el) { if (!el || reduced()) return; el.classList.remove('pl-flash'); void el.offsetWidth; el.classList.add('pl-flash'); }
  const phone = document.querySelector('.pl-screen');
  if (phone) {
    const q = id => document.getElementById(id);
    const start = { bank: 8400, cash: 1600, spent: 1013.75, owe: 800 };
    let s = { ...start };
    const listEl = q('pl-list'), baseList = listEl.innerHTML;
    const expenses = [['Groceries', 150, 'c2'], ['Petrol', 250, 'c1'], ['Education', 120, 'c3']];
    let e = 0;
    const toast = q('pl-toast'), explain = q('pl-explain');
    function paint(prev) {
      count(q('pl-bank'), prev.bank, s.bank, inr); count(q('pl-cash'), prev.cash, s.cash, inr);
      count(q('pl-total'), prev.bank + prev.cash, s.bank + s.cash, inr);
      count(q('pl-spent'), prev.spent, s.spent, inr2); count(q('pl-owe'), prev.owe, s.owe, inr);
      const tot = s.bank + s.cash;
      q('pl-bar-bank').style.width = (s.bank / tot * 100).toFixed(1) + '%';
      q('pl-bar-cash').style.width = (s.cash / tot * 100).toFixed(1) + '%';
    }
    function say(msg, t) {
      explain.innerHTML = msg; toast.textContent = t;
      run(toast, { opacity: [0, 1, 1, 0], y: [4, 0, 0, -2] }, { duration: 2.2, times: [0, 0.12, 0.8, 1] });
      if (reduced()) toast.style.opacity = '1';
    }
    const card = n => phone.querySelector(`[data-card="${n}"]`), row = n => phone.querySelector(`[data-row="${n}"]`);
    document.querySelectorAll('.pl-act').forEach(btn => btn.addEventListener('click', () => {
      const prev = { ...s };
      document.querySelectorAll('.pl-act').forEach(b => b.classList.toggle('on', b === btn));
      run(btn, { scale: [0.94, 1] }, { type: 'spring', duration: 0.3, bounce: 0.3 });
      const act = btn.dataset.act;
      if (act === 'expense') {
        const [name, amt, c] = expenses[e++ % expenses.length];
        s.bank -= amt; s.spent += amt;
        const li = document.createElement('li');
        li.innerHTML = `<span><b class="d ${c}"></b>${name}</span><b>${inr2(amt)}</b>`;
        listEl.prepend(li); while (listEl.children.length > 5) listEl.lastElementChild.remove();
        run(li, { opacity: [0, 1], x: [-10, 0] }, { duration: 0.3 });
        btn.querySelector('small').textContent = inr(expenses[e % expenses.length][1]);
        flash(card('spent')); flash(row('bank'));
        say(`<b>Expense</b> · spending +${inr(amt)}, bank −${inr(amt)}.`, `+ ${name} ${inr(amt)}`);
      } else if (act === 'transfer') {
        const amt = Math.min(500, s.bank); s.bank -= amt; s.cash += amt;
        flash(row('bank')); flash(row('cash'));
        say(`<b>Transfer</b> · ${inr(amt)} bank → cash. Total and spending unchanged.`, `${inr(amt)} bank → cash`);
      } else {
        const amt = Math.min(200, s.owe);
        if (!amt) { say('<b>All settled</b> · nobody owes you now.', 'All settled'); return; }
        s.owe -= amt; s.bank += amt;
        flash(card('owe')); flash(row('bank'));
        say(`<b>Repayment</b> · owed −${inr(amt)}, bank +${inr(amt)}. Not spending.`, `${inr(amt)} repaid`);
      }
      paint(prev);
    }));
    q('pl-reset').addEventListener('click', () => {
      const prev = { ...s }; s = { ...start }; e = 0; listEl.innerHTML = baseList;
      document.querySelectorAll('.pl-act').forEach(b => b.classList.remove('on'));
      document.querySelector('.pl-act[data-act="expense"] small').textContent = '₹150';
      paint(prev); explain.innerHTML = 'Back to the sample. Tap <b>+</b> to try again.'; toast.textContent = '';
    });

    // Add-entry sheet opened by the phone's own + button
    const add = q('pl-add'), sheet = q('pl-sheet');
    let open = false;
    function setSheet(v) {
      open = v;
      add.setAttribute('aria-expanded', String(v));
      add.textContent = v ? '×' : '+';
      add.setAttribute('aria-label', v ? 'Close add entry' : 'Add an entry');
      add.classList.remove('hint');
      if (v) { sheet.hidden = false; run(sheet, { y: [40, 0], opacity: [0, 1] }, { duration: 0.28 }); }
      else if (reduced()) sheet.hidden = true;
      else M.animate(sheet, { y: [0, 30], opacity: [1, 0] }, { duration: 0.2, ease }).then(() => { if (!open) sheet.hidden = true; });
    }
    add.addEventListener('click', ev => { setSheet(!open); if (open && ev.detail === 0) sheet.querySelector('.pl-act').focus(); });
    const closeSoon = () => setTimeout(() => {
      const inside = sheet.contains(document.activeElement);
      setSheet(false); if (inside) add.focus({ preventScroll: true });
    }, 260);
    sheet.querySelectorAll('.pl-act').forEach(b => b.addEventListener('click', closeSoon));
    q('pl-reset').addEventListener('click', closeSoon);
    sheet.addEventListener('keydown', ev => { if (ev.key === 'Escape') { setSheet(false); add.focus(); } });
  }


  /* ---------- 01b Pocket Ledger: flip receipt with live splitter ---------- */
  const flip = document.querySelector('.receipt-flip');
  if (flip) {
    const front = flip.querySelector('.r-front'), back = flip.querySelector('.r-back');
    const flips = [...flip.querySelectorAll('.r-flip')];
    flips.forEach(b => (b.hidden = false));
    const set = on => {
      flip.classList.toggle('is-flipped', on);
      front.inert = on; back.inert = !on;
      front.setAttribute('aria-hidden', String(on)); back.setAttribute('aria-hidden', String(!on));
    };
    set(false);
    let turning = false;
    flips.forEach(b => b.addEventListener('click', async () => {
      if (turning) return; turning = true;
      const on = !flip.classList.contains('is-flipped');
      if (!reduced()) await M.animate(flip, { scaleX: [1, 0] }, { duration: 0.18, ease: [0.4, 0, 1, 1] });
      set(on);
      (on ? back : front).querySelector('.r-flip').focus({ preventScroll: true });
      if (!reduced()) await M.animate(flip, { scaleX: [0, 1] }, { duration: 0.26, ease: [0, 0, 0.2, 1] });
      flip.style.transform = ''; turning = false;
    }));
  }
  const sp = document.getElementById('sp-amount');
  if (sp) {
    const q = id => document.getElementById(id);
    let people = 3, payer = 'me', last = { mine: 300, other: 600 };
    function calc() {
      let bill = parseFloat(sp.value); if (!isFinite(bill) || bill < 0) bill = 0; bill = Math.min(bill, 100000);
      const share = Math.round(bill / people * 100) / 100;
      const other = payer === 'me' ? Math.round((bill - share) * 100) / 100 : share;
      count(q('sp-mine'), last.mine, share, inr2); count(q('sp-other'), last.other, other, inr2);
      last = { mine: share, other };
      q('sp-people').textContent = people;
      q('sp-minus').disabled = people <= 2; q('sp-plus').disabled = people >= 8;
      q('sp-other-label').textContent = payer === 'me' ? 'To receive' : 'You owe';
      q('sp-note').textContent = payer === 'me'
        ? `You paid ${inr(bill)}, but only your ${inr2(share)} share counts as spending.`
        : `A friend paid. Your ${inr2(share)} share is your spending, and you owe it back.`;
    }
    sp.addEventListener('input', calc);
    q('sp-minus').addEventListener('click', () => { if (people > 2) { people--; calc(); run(q('sp-people'), { scale: [0.8, 1] }, { duration: 0.2 }); } });
    q('sp-plus').addEventListener('click', () => { if (people < 8) { people++; calc(); run(q('sp-people'), { scale: [1.2, 1] }, { duration: 0.2 }); } });
    const seg = [...document.querySelectorAll('.sp-seg [role=radio]')];
    const pick = b => { seg.forEach(x => { const on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; }); payer = b.dataset.payer; calc(); };
    seg.forEach((b, k) => {
      b.addEventListener('click', () => pick(b));
      b.addEventListener('keydown', ev => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) { ev.preventDefault(); const n = seg[(k + 1) % 2]; pick(n); n.focus(); } });
    });
    calc();
  }

  /* ---------- Phones stand up while their section is on screen, tilt again when you leave ---------- */
  const tilters = document.querySelectorAll('.ledger-phone, .tv-phone');
  if (tilters.length && 'IntersectionObserver' in window) {
    const tio = new IntersectionObserver(es => es.forEach(en => en.target.classList.toggle('is-straight', en.isIntersecting)), { rootMargin: '-35% 0px -35% 0px' });
    tilters.forEach(t => tio.observe(t));
  }

  /* ---------- 02 TVora: remote control tabs ---------- */
  const tabs = [...document.querySelectorAll('.remote [role=tab]')];
  const noise = document.querySelector('.tv-noise');
  const chNum = document.querySelector('#tv-ch');
  function select(tab, focus = true) {
    const current = tabs.find(t => t.getAttribute('aria-selected') === 'true');
    if (tab === current) { if (focus) tab.focus(); return; }
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    chNum.textContent = String(tabs.indexOf(tab) + 1).padStart(2, '0');
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    run(noise, { opacity: [0, 0.9, 0] }, { duration: 0.22, ease: 'linear' });
    run(panel, { opacity: [0, 1], y: [10, 0], filter: ['blur(3px)', 'blur(0px)'] }, { duration: 0.32, delay: 0.06 });
    run(tab, { scale: [0.94, 1] }, { type: 'spring', duration: 0.3, bounce: 0.25 });
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', e => {
      const n = tabs.length;
      const map = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: n - 1 };
      if (e.key in map) { e.preventDefault(); select(tabs[(map[e.key] + n) % n]); }
      else if (/^[1-4]$/.test(e.key)) { e.preventDefault(); select(tabs[Number(e.key) - 1]); }
    });
  });

  /* ---------- 03 Zed Flash: workflow diagram + simulated job ---------- */
  const flow = document.querySelector('.flow');
  if (flow) {
    const $ = s => flow.querySelector(s);
    const nodes = [...flow.querySelectorAll('.node')].sort((a, b) => a.dataset.step - b.dataset.step);
    const wire = $('.flow-wire'), pulse = $('.pulse'), detail = $('#flow-detail');
    const runBtn = $('#zf-run'), runLabel = runBtn.querySelector('.run-label');
    const pauseBtn = $('#zf-pause'), stopBtn = $('#zf-stop'), offBtn = $('#zf-offline');
    const stateEl = $('#zf-state'), countsEl = $('#zf-counts'), badge = $('.sheet-badge');
    const rowEls = [...flow.querySelectorAll('.job-rows li')];
    const N = rowEls.length, FAIL_ROW = 4;
    const info = [
      '<b>Telegram.</b> Jobs are started, paused, stopped and resumed from chat.',
      '<b>Browser worker.</b> Works through the job one row at a time and saves its place after every row.',
      '<b>Sheets sync.</b> A separate service. If the sheet is unreachable, writes wait in a queue and retry.',
      '<b>Google Sheets.</b> Mirrors results when reachable. The local copy stays the source of truth.'
    ];
    let state = 'idle', rows = Array(N).fill('pending'), cur = -1, queued = 0, synced = 0, offline = false, token = 0, wantPause = false;
    const wait = ms => new Promise(r => setTimeout(r, reduced() ? Math.min(ms, 60) : ms));
    const done = () => rows.filter(r => r === 'ok' || r === 'fail').length;
    function pulseTo(i) {
      if (reduced() || getComputedStyle(wire).display === 'none') return Promise.resolve();
      const w = wire.getBoundingClientRect(), r = nodes[i].querySelector('button').getBoundingClientRect();
      const vertical = w.width < 10;
      const t = vertical ? { x: 0, y: r.top + r.height / 2 - w.top - 6 } : { x: r.left + r.width / 2 - w.left - 6, y: 0 };
      return M.animate(pulse, { ...t, opacity: 1 }, { duration: 0.32, ease }).finished;
    }
    function busy(i) { nodes.forEach((n, k) => n.classList.toggle('is-busy', k === i)); }
    function render() {
      rowEls.forEach((el, k) => { el.className = rows[k] === 'ok' ? 'ok' : rows[k] === 'fail' ? 'fail' : (k === cur && state === 'running') || (k === cur && state === 'pausing') ? 'cur' : ''; });
      const labels = { idle: 'Idle', running: 'Running', pausing: 'Pausing…', paused: 'Paused', stopped: 'Stopped', done: 'Done' };
      stateEl.textContent = labels[state]; stateEl.dataset.s = state;
      const failed = rows.filter(r => r === 'fail').length;
      countsEl.textContent = `Done ${done()}/${N} · Failed ${failed} · Waiting for Sheets ${queued}`;
      badge.textContent = offline ? `${queued} queued` : `${synced} synced`;
      badge.classList.toggle('on', queued > 0 || synced > 0);
      nodes[3].classList.toggle('is-offline', offline);
      runBtn.disabled = state === 'running' || state === 'pausing';
      runLabel.textContent = state === 'stopped' ? 'Resume job' : state === 'done' ? 'Run again' : 'Run a test job';
      pauseBtn.disabled = !(state === 'running' || state === 'paused');
      pauseBtn.textContent = state === 'paused' ? 'Resume' : 'Pause';
      stopBtn.disabled = !(state === 'running' || state === 'paused' || state === 'pausing');
      runBtn.setAttribute('aria-busy', String(state === 'running'));
    }
    const say = html => { detail.innerHTML = html; };
    async function write(k) {
      if (offline) { queued++; render(); say(`Row ${k + 1} saved locally. <b>Sheets is offline</b>, so the write waits in the queue.`); return; }
      busy(2); await pulseTo(2); busy(3); await pulseTo(3); synced++; render();
    }
    async function loop(my) {
      while (my === token) {
        const k = rows.indexOf('pending');
        if (k < 0) { state = 'done'; cur = -1; busy(-1); render(); const f = rows.filter(r => r === 'fail').length;
          say(`<b>Done.</b> ${N - f} rows succeeded and ${f} failed. The failure stays visible instead of being hidden.${queued ? ` ${queued} writes still wait for Sheets.` : ''}`); return; }
        cur = k; busy(1); render();
        say(`Working on row ${k + 1} of ${N}…`);
        await pulseTo(1); await wait(850);
        if (my !== token) return;            // stopped mid-row: row stays pending
        rows[k] = k === FAIL_ROW ? 'fail' : 'ok'; render();
        if (k === FAIL_ROW) say(`Row ${k + 1} <b>failed</b>. It’s recorded as failed and the job keeps going.`);
        await write(k);
        if (my !== token) return;
        if (wantPause) { wantPause = false; state = 'paused'; busy(-1); render(); say(`<b>Paused</b> after finishing row ${k + 1}. Progress is saved; resume any time.`); return; }
      }
    }
    function start() { token++; state = 'running'; render(); busy(0); pulseTo(0).then(() => loop(token)); }
    runBtn.addEventListener('click', () => {
      if (state === 'done' || state === 'idle') { rows = Array(N).fill('pending'); queued = offline ? queued : 0; synced = 0; cur = -1; if (!reduced()) M.animate(pulse, { x: 0, y: 0, opacity: 0 }, { duration: 0 }); say('Job received from Telegram. Starting…'); }
      else if (state === 'stopped') say(`Resuming from row ${rows.indexOf('pending') + 1}. The interrupted row runs again.`);
      start();
    });
    pauseBtn.addEventListener('click', () => {
      if (state === 'running') { wantPause = true; state = 'pausing'; render(); say('Pausing: the current row will finish first.'); }
      else if (state === 'paused') { say('Resuming…'); start(); }
    });
    stopBtn.addEventListener('click', () => {
      token++; wantPause = false; state = 'stopped'; busy(-1); render();
      const k = rows.indexOf('pending');
      say(`<b>Stopped</b> immediately. ${done()} rows are kept${k >= 0 ? `; row ${k + 1} was interrupted and will run again on resume` : ''}.`);
    });
    offBtn.addEventListener('click', async () => {
      offline = !offline; offBtn.setAttribute('aria-checked', String(offline)); render();
      run(offBtn.querySelector('.sw i'), { scale: [0.8, 1] }, { type: 'spring', duration: 0.3, bounce: 0.3 });
      if (offline) { say('<b>Sheets is offline.</b> Results keep saving locally; sheet writes will queue.'); return; }
      if (queued) {
        const n = queued; say(`<b>Sheets is back.</b> Retrying ${n} queued write${n > 1 ? 's' : ''}…`);
        while (queued > 0 && !offline) { busy(2); await pulseTo(2); busy(3); await pulseTo(3); queued--; synced++; render(); await wait(120); }
        if (state !== 'running') busy(-1);
        say(`<b>Synced.</b> ${n} queued write${n > 1 ? 's' : ''} reached the sheet. Nothing was lost.`);
      } else say('Sheets is reachable again.');
    });
    nodes.forEach((n, i) => n.querySelector('button').addEventListener('click', () => {
      say(info[i]); run(n.querySelector('button'), { scale: [0.97, 1] }, { type: 'spring', duration: 0.35, bounce: 0.3 });
      if (state !== 'running' && state !== 'pausing') { busy(i); pulseTo(i); }
    }));
    render();
  }

  /* ---------- 04 Evaluator: expandable calculators ---------- */
  document.querySelectorAll('.calc-btn').forEach(btn => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      if (open) run(panel, { opacity: [0, 1], y: [-6, 0] }, { duration: 0.24 });
      const meter = btn.querySelector('.meter i');
      if (open) run(meter, { scaleX: [0, 1] }, { duration: 0.5, ease: [0.23, 1, 0.32, 1] });
    });
  });

  /* ---------- Contact: copy handles ---------- */
  const status = document.querySelector('#copy-status');
  document.querySelectorAll('.copy').forEach(btn => {
    const label = btn.querySelector('.copy-label');
    let timer;
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch {} ta.remove();
      }
      label.textContent = ok ? 'Copied' : 'Press ⌘C';
      btn.classList.toggle('is-copied', ok);
      status.textContent = ok ? `Copied ${text}` : 'Copy failed';
      run(label, { y: [8, 0], opacity: [0, 1] }, { duration: 0.2 });
      clearTimeout(timer);
      timer = setTimeout(() => { label.textContent = 'Copy'; btn.classList.remove('is-copied'); }, 1600);
    });
  });
  /* ---------- Scroll reveal: content rises into place as it enters the screen ---------- */
  if (!reduced() && 'IntersectionObserver' in window) {
    const sel = ['.skills > .kicker', '.sk-h', '.skv-map', '.sm-proof', '.sk-also', '.work-head > *', '.project > .case-label', '.project h3', '.project .deck', '.ledger-phone', '.pl-under',
      '.tv-stage > *', '.flow', '.eval-grid > *', '.also', '.about-side > *', '.about-lead', '.rules > li', '.toolbox > div',
      '.contact > :not(.sr-only)', '.site-footer'];
    const els = [...document.querySelectorAll(sel.join(','))].filter(el => el.getBoundingClientRect().top > innerHeight * 0.92);
    els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(36px)'; });
    const rio = new IntersectionObserver(entries => {
      entries.filter(en => en.isIntersecting).map(en => en.target)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left)
        .forEach((el, i) => {
          rio.unobserve(el);
          M.animate(el, { opacity: [0, 1], y: [36, 0] }, { duration: 0.8, delay: i * 0.08, ease })
            .then(() => { el.style.transform = ''; el.style.opacity = ''; });
        });
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach(el => rio.observe(el));
  }
  /* ---------- Footer NAMYA: live dots that twinkle, sweep and move away from the cursor ---------- */
  const mark = document.querySelector('.dotmark');
  if (mark && !reduced()) {
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    let dots = [], W = 0, H = 0, dpr = 1, on = false, raf = 0, t0 = performance.now();
    const ptr = { x: -9999, y: -9999 };
    let col = '', colHi = '';
    const readColours = () => { const cs = getComputedStyle(mark); col = cs.getPropertyValue('--accent').trim() || '#e5394b'; colHi = cs.getPropertyValue('--accent-hi').trim() || '#ff6b78'; };
    function build() {
      const r = mark.getBoundingClientRect(); W = r.width; H = r.height; if (!W || !H) return;
      dpr = Math.min(devicePixelRatio || 1, 2); cv.width = W * dpr; cv.height = H * dpr;
      const size = parseFloat(getComputedStyle(mark).fontSize);
      const off = document.createElement('canvas'); off.width = Math.ceil(W); off.height = Math.ceil(H);
      const o = off.getContext('2d'); o.fillStyle = '#000'; o.font = `400 ${size}px Anton, sans-serif`; o.textAlign = 'center'; o.textBaseline = 'alphabetic';
      const m = o.measureText('NAMYA'); const th = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      o.fillText('NAMYA', W / 2, (H - th) / 2 + m.actualBoundingBoxAscent);
      const px = o.getImageData(0, 0, off.width, off.height).data, gap = W < 600 ? 5 : 7;
      dots = [];
      for (let y = gap / 2; y < H; y += gap) for (let x = gap / 2; x < W; x += gap) {
        if (px[((y | 0) * off.width + (x | 0)) * 4 + 3] > 128) dots.push({ x, y, ox: 0, oy: 0, vx: 0, vy: 0, p: Math.random() * 6.28 });
      }
      mark._r = gap < 7 ? 1.1 : 1.5;
    }
    function frame(now) {
      const t = (now - t0) / 1000, r = mark._r;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const sweep = ((t * 0.18) % 1.4 - 0.2) * W, R = Math.max(70, W * 0.07);
      const bins = [[], [], [], []];
      for (const d of dots) {
        const dx = d.x + d.ox - ptr.x, dy = d.y + d.oy - ptr.y, dist2 = dx * dx + dy * dy;
        if (dist2 < R * R) { const dist = Math.sqrt(dist2) || 1, f = (1 - dist / R) * 2.2; d.vx += dx / dist * f; d.vy += dy / dist * f; }
        d.vx += -d.ox * 0.06; d.vy += -d.oy * 0.06; d.vx *= 0.84; d.vy *= 0.84; d.ox += d.vx; d.oy += d.vy;
        const tw = 0.5 + 0.5 * Math.sin(t * 1.7 + d.p), sw = Math.max(0, 1 - Math.abs(d.x - sweep) / (W * 0.08));
        const moved = Math.min(1, Math.hypot(d.ox, d.oy) / 14);
        const lvl = Math.max(sw, moved) > 0.35 ? 3 : tw > 0.75 ? 2 : tw > 0.35 ? 1 : 0;
        bins[lvl].push(d);
      }
      const styles = [[col, 0.45], [col, 0.7], [col, 0.95], [colHi, 1]];
      bins.forEach((b, i) => {
        ctx.globalAlpha = styles[i][1]; ctx.fillStyle = styles[i][0]; ctx.beginPath();
        const rr = i === 3 ? r * 1.35 : r;
        for (const d of b) { ctx.moveTo(d.x + d.ox + rr, d.y + d.oy); ctx.arc(d.x + d.ox, d.y + d.oy, rr, 0, 6.2832); }
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (on) raf = requestAnimationFrame(frame);
    }
    const start = () => { if (!on && dots.length) { on = true; raf = requestAnimationFrame(frame); } };
    const stop = () => { on = false; cancelAnimationFrame(raf); };
    const move = e => { const r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; ptr.x = p.clientX - r.left; ptr.y = p.clientY - r.top; };
    const leave = () => { ptr.x = ptr.y = -9999; };
    (document.fonts ? document.fonts.load('400 100px Anton') : Promise.resolve()).then(() => {
      readColours(); build(); if (!dots.length) return;
      mark.append(cv); mark.classList.add('is-live');
      new IntersectionObserver(es => (es[0].isIntersecting ? start() : stop())).observe(mark);
      mark.addEventListener('pointermove', move); mark.addEventListener('pointerleave', leave);
      mark.addEventListener('touchmove', move, { passive: true }); mark.addEventListener('touchend', leave);
      let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 150); });
      addEventListener('accentchange', () => requestAnimationFrame(readColours));
    });
  }
  /* ---------- Contact background: a faint HELLO the cursor lights up in dots ---------- */
  const csec = document.querySelector('.contact');
  if (csec) {
    const cv = document.createElement('canvas'); cv.className = 'contact-bg'; cv.setAttribute('aria-hidden', 'true'); csec.prepend(cv);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, on = false, raf = 0, hello = [], hFont = '', hx = 0, hy = 0, hi = '#ff8a95';
    const target = { x: 0, y: 0, active: false }, cur = { x: 0, y: 0 }, t0 = performance.now();
    const readHi = () => { hi = getComputedStyle(csec).getPropertyValue('--accent-hi').trim() || '#ff8a95'; };
    function build() {
      const r = csec.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = W * dpr; cv.height = H * dpr;
      // HELLO dots, sized to fit the section
      const off = document.createElement('canvas'); off.width = Math.ceil(W); off.height = Math.ceil(H); const o = off.getContext('2d');
      let size = H * 0.55; o.font = `400 ${size}px Anton, sans-serif`;
      const w = o.measureText('HELLO').width; if (w > W * 0.94) size *= W * 0.94 / w;
      hFont = `400 ${size}px Anton, sans-serif`; o.font = hFont; o.textAlign = 'right'; o.textBaseline = 'middle';
      hx = W * 0.97; hy = W < 860 ? H * 0.3 : H * 0.5; o.fillText('HELLO', hx, hy);
      const d = o.getImageData(0, 0, off.width, off.height).data, s = W < 600 ? 6 : 8; hello = [];
      for (let y = s / 2; y < H; y += s) for (let x = s / 2; x < W; x += s) if (d[((y | 0) * off.width + (x | 0)) * 4 + 3] > 128) hello.push({ x, y });
      if (!target.active) { cur.x = target.x = W * 0.66; cur.y = target.y = H * 0.45; }
    }
    function draw(t) {
      // idle drift when nobody is pointing, so the field never looks dead
      if (!target.active) { target.x = W * (0.6 + 0.25 * Math.sin(t * 0.35)); target.y = H * (0.45 + 0.25 * Math.sin(t * 0.5 + 1)); }
      const ease = reduced() ? 1 : 0.12; cur.x += (target.x - cur.x) * ease; cur.y += (target.y - cur.y) * ease;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      {
        const px = (cur.x - W / 2) * -0.03, py = (cur.y - H / 2) * -0.03, R = W < 600 ? 150 : 260;
        ctx.font = hFont; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.13; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeText('HELLO', hx + px, hy + py);
        ctx.fillStyle = hi; ctx.beginPath();
        const lit = [];
        for (const d of hello) { const k = 1 - Math.hypot(cur.x - d.x - px, cur.y - d.y - py) / R; if (k > 0) lit.push([d, k]); }
        for (let band = 0; band < 4; band++) {
          ctx.globalAlpha = 0.25 + band * 0.25; ctx.beginPath();
          for (const [d, k] of lit) if (Math.min(3, (k * 4) | 0) === band) { const rr = 1.1 + k * 1.7; ctx.moveTo(d.x + px + rr, d.y + py); ctx.arc(d.x + px, d.y + py, rr, 0, 6.2832); }
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    const loop = now => { draw((now - t0) / 1000); if (on) raf = requestAnimationFrame(loop); };
    const start = () => { if (reduced()) { draw(0); return; } if (!on) { on = true; raf = requestAnimationFrame(loop); } };
    const stop = () => { on = false; cancelAnimationFrame(raf); };
    const point = e => { const r = csec.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; target.x = p.clientX - r.left; target.y = p.clientY - r.top; target.active = true; if (reduced()) draw(0); };
    csec.addEventListener('pointermove', point); csec.addEventListener('touchmove', point, { passive: true }); csec.addEventListener('touchstart', point, { passive: true });
    csec.addEventListener('pointerleave', () => (target.active = false));
    (document.fonts ? document.fonts.load('400 100px Anton') : Promise.resolve()).then(() => {
      readHi(); build();
      new IntersectionObserver(es => (es[0].isIntersecting ? start() : stop())).observe(csec);
      let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduced()) draw(0); }, 150); });
      addEventListener('accentchange', () => requestAnimationFrame(() => { readHi(); if (reduced()) draw(0); }));
    });
  }
  /* ---------- Right-side section rail: shows where you are, like a channel number ---------- */
  const rail = document.querySelector('.rail');
  if (rail && 'IntersectionObserver' in window) {
    const links = [...rail.querySelectorAll('a')];
    const secs = links.map(a => document.getElementById(a.getAttribute('href').slice(1)));
    const num = rail.querySelector('#rail-num'), name = rail.querySelector('#rail-name');
    let cur = -1;
    const setActive = i => {
      if (i === cur || i < 0) return; cur = i;
      links.forEach((a, j) => (j === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      num.textContent = String(i).padStart(2, '0'); name.textContent = links[i].dataset.label;
      run(num, { y: [10, 0], opacity: [0, 1] }, { duration: 0.3 });
      run(name, { opacity: [0, 1], x: [6, 0] }, { duration: 0.3 });
    };
    const pick = () => {
      // the section crossing the middle of the screen wins; fall back to the last one above it
      let best = -1;
      secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= innerHeight * 0.5) best = i; });
      setActive(Math.max(0, best));
      rail.classList.toggle('is-on', scrollY > innerHeight * 0.55);
    };
    const io = new IntersectionObserver(() => pick(), { rootMargin: '-50% 0px -50% 0px' });
    secs.forEach(s => s && io.observe(s));
    let ticking = false;
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; pick(); }); } }, { passive: true });
    pick();
  }

  /* ---------- Skills map: hover or tap a skill, see which projects use it ---------- */
  const skSec = document.getElementById('skills');
  if (skSec && document.getElementById('sk-map')) {
    const P = {
      tvora: { name: 'TVora', href: '#tvora' }, zed: { name: 'Zed Flash', href: '#zed' }, ledger: { name: 'Pocket Ledger', href: '#ledger' },
      evaluator: { name: 'Evaluator', href: '#evaluator' }, northline: { name: 'Northline Roofing', href: '#northline' }, site: { name: 'This site', href: '#home' }
    };
    const S = [
      ['Python', 'lang', ['zed'], 'Zed Flash is written in Python: the Telegram bot, the browser worker and the sheet sync.'],
      ['Kotlin', 'lang', ['tvora'], 'TVora is written in Kotlin.'],
      ['Java', 'lang', ['ledger', 'evaluator'], 'Pocket Ledger and Evaluator are native Android apps written in Java.'],
      ['TypeScript', 'lang', ['northline'], 'The Northline Roofing demo site is written in TypeScript.'],
      ['JavaScript', 'lang', ['site'], 'Every interaction on this site, plus the TVora and Pocket Ledger websites.'],
      ['Docker', 'auto', ['zed'], 'Zed Flash ships as one Docker deployment.'],
      ['Playwright', 'auto', ['zed'], 'Zed Flash’s browser worker uses Playwright to work through jobs row by row.'],
      ['SQLite', 'auto', ['zed'], 'Zed Flash keeps job state and every result locally in SQLite.'],
      ['Telegram Bot API', 'auto', ['zed'], 'Zed Flash is controlled from Telegram: start, pause, stop or resume a job.'],
      ['Git & GitHub', 'auto', ['tvora', 'ledger'], 'Public releases on GitHub: TVora 0.1.2 and Pocket Ledger 1.0.0.'],
      ['Jetpack Compose', 'android', ['tvora'], 'TVora’s interface is built with Jetpack Compose.'],
      ['Room', 'android', ['ledger'], 'Room is Pocket Ledger’s local database, so it works fully offline.'],
      ['ML Kit', 'android', ['ledger'], 'Pocket Ledger reads receipt text on the device with ML Kit.'],
      ['ADB', 'android', ['tvora'], 'TVora talks to the TV over ADB to clean it up and restore it.'],
      ['Gradle', 'android', ['ledger', 'evaluator'], 'Pocket Ledger and Evaluator are built with Gradle.'],
      ['React', 'web', ['northline'], 'The Northline Roofing demo site is built with React.'],
      ['Three.js', 'web', ['site'], 'The dot portrait at the top of this site is Three.js.'],
      ['HTML & CSS', 'web', ['site'], 'This site and the TVora and Pocket Ledger websites.']
    ].map(([n, g, p, w]) => ({ n, g, p, w, key: n.toLowerCase().replace(/[^a-z0-9]/g, '') }));
    const G = [['lang', 'Languages'], ['auto', 'Automation & backend'], ['android', 'Android'], ['web', 'Web']];
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const projLink = id => `<a href="${P[id].href}">${P[id].name}</a>`;
    const map = document.getElementById('sk-map'), svg = document.getElementById('sm-lines'), proof = document.getElementById('sm-proof');
    const skillsCol = document.getElementById('sm-skills');
    skillsCol.innerHTML = G.map(([g, label]) =>
      `<div class="sm-group"><p>${label}</p><div>${S.filter(s => s.g === g).map(s => `<button type="button" class="sm-skill" data-k="${s.key}">${esc(s.n)}</button>`).join('')}</div></div>`).join('');
    document.getElementById('sm-projects').innerHTML = Object.entries(P).map(([id, p]) =>
      `<div class="sm-proj" data-p="${id}"><button type="button"><b>${p.name}</b><small>${esc(S.filter(s => s.p.includes(id)).map(s => s.n).join(' · '))}</small></button><a href="${p.href}" aria-label="Go to ${p.name}">→</a></div>`).join('');
    const skBtns = [...map.querySelectorAll('.sm-skill')], projEls = [...map.querySelectorAll('.sm-proj')];
    // Route: drop out of the tag, run along the gap under its row (never across other tags), then curve to the project.
    const route = (a, b) => {
      const r = map.getBoundingClientRect(), A = a.getBoundingClientRect(), B = b.getBoundingClientRect(), C = skillsCol.getBoundingClientRect();
      const sx = A.left + A.width / 2 - r.left, sy = A.bottom - r.top, gy = sy + 4, rad = 4;
      const ex = C.right - r.left + 16, x2 = B.left - r.left, y2 = B.top + B.height / 2 - r.top, dx = Math.max(60, (x2 - ex) * 0.5);
      return `M${sx} ${sy} L${sx} ${gy - rad} Q${sx} ${gy} ${sx + rad} ${gy} L${ex} ${gy} C${ex + dx} ${gy} ${x2 - dx} ${y2} ${x2} ${y2}`;
    };
    let lastKey = '';
    function light(skills, projs, text) {
      const key = skills.join() + '|' + projs.join();
      skBtns.forEach(b => b.classList.toggle('on', skills.includes(b.dataset.k)));
      projEls.forEach(p => p.classList.toggle('on', projs.includes(p.dataset.p)));
      map.classList.toggle('has-active', skills.length > 0);
      if (key !== lastKey) {
        lastKey = key;
        const still = reduced();
        svg.innerHTML = matchMedia('(max-width:860px)').matches ? '' : skills.flatMap(k => {
          const s = S.find(x => x.key === k), btn = skBtns.find(x => x.dataset.k === k);
          return s.p.filter(p => projs.includes(p)).map((p, i) => {
            const d = route(btn, projEls.find(e => e.dataset.p === p)), end = d.split(' ').slice(-2);
            const cells = still ? '' : [0, 0.5, 1].map(o => `<circle class="sm-cell" r="2.2"><animateMotion dur="1.5s" begin="${-(o * 1.5 + i * 0.25).toFixed(2)}s" repeatCount="indefinite" path="${d}"/></circle>`).join('');
            return `<path class="sm-base" pathLength="1" d="${d}"/><path class="sm-flow" pathLength="1" d="${d}"/>${cells}<circle class="sm-end" cx="${end[0]}" cy="${end[1]}" r="3.2"/>`;
          });
        }).join('');
      }
      if (text != null) proof.innerHTML = text;
    }
    const showSkill = k => { const s = S.find(x => x.key === k); light([k], s.p, `<b>${esc(s.n)}</b> → ${s.p.map(projLink).join(' · ')}. ${esc(s.w)}`); };
    const showProj = id => { const ks = S.filter(s => s.p.includes(id)); light(ks.map(s => s.key), [id], `<b>${P[id].name}</b> uses ${esc(ks.map(s => s.n).join(', '))}.`); };
    // A gentle tour through the projects until someone interacts, so the section is never static.
    const tour = ['zed', 'tvora', 'ledger', 'site', 'evaluator', 'northline'];
    let ti = 0, tourTimer = 0, userTimer = 0, touched = false, seen = false;
    const startTour = () => { if (reduced()) return; clearInterval(tourTimer); showProj(tour[ti++ % tour.length]); tourTimer = setInterval(() => showProj(tour[ti++ % tour.length]), 2800); };
    const pauseTour = () => { clearInterval(tourTimer); clearTimeout(userTimer); touched = true; };
    skBtns.forEach(b => { const go = () => { pauseTour(); showSkill(b.dataset.k); }; ['pointerenter', 'focus', 'click'].forEach(ev => b.addEventListener(ev, go)); });
    projEls.forEach(e => { const go = () => { pauseTour(); showProj(e.dataset.p); }; e.addEventListener('pointerenter', go); ['focus', 'click'].forEach(ev => e.querySelector('button').addEventListener(ev, go)); });
    map.addEventListener('pointerleave', () => { clearTimeout(userTimer); userTimer = setTimeout(() => { touched = false; startTour(); }, 4000); });
    new IntersectionObserver(es => {
      if (es[0].isIntersecting) { if (!seen || !touched) { seen = true; startTour(); } }
      else clearInterval(tourTimer);
    }, { threshold: 0.3 }).observe(map);
    let rt2; addEventListener('resize', () => { clearTimeout(rt2); rt2 = setTimeout(() => { lastKey = ''; const on = skBtns.filter(b => b.classList.contains('on')).map(b => b.dataset.k), pj = projEls.filter(p => p.classList.contains('on')).map(p => p.dataset.p); if (on.length) light(on, pj); }, 150); });
  }

})();
