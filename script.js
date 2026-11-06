/* Pakistan Namaz Timing – vanilla JS. Times come live from the AlAdhan API. */
const $ = s => document.querySelector(s);
const API = 'https://api.aladhan.com/v1/calendar';
const TZ = 'Asia/Karachi';

/* ---------- Saved settings (LocalStorage) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const S = {
  city: store.get('city', 'Lahore'), lang: store.get('lang', 'en'),
  theme: store.get('theme', 'light'), method: store.get('method', 1),
  school: store.get('school', 1), notify: store.get('notify', false),
  adj: Object.assign({}, store.get('adj', null) || {})
};
/* Precautionary minutes (ihtiyat) used by Pakistani mosque timetables.
   Raw astronomy gives Dhuhr exactly at zawal and Maghrib exactly at sunset,
   which is why plain calculated times look a few minutes early in Pakistan. */
const IHTIYAT = { Fajr:2, Sunrise:-2, Dhuhr:5, Asr:2, Maghrib:3, Isha:2 };
const ADJ_KEYS = Object.keys(IHTIYAT);
ADJ_KEYS.forEach(k => { if (typeof S.adj[k] !== 'number') S.adj[k] = IHTIYAT[k]; });
// AlAdhan "tune" order: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight
const tune = () => [S.adj.Fajr, S.adj.Fajr, S.adj.Sunrise, S.adj.Dhuhr, S.adj.Asr, S.adj.Maghrib, S.adj.Maghrib, S.adj.Isha, 0].join(',');

/* ---------- City database: [English, Urdu, province, lat, lng] ----------
   To add a city, just add one more line to this array. */
const CITIES = [
  ['Lahore','لاہور','Punjab',31.5497,74.3436],['Faisalabad','فیصل آباد','Punjab',31.4504,73.135],
  ['Rawalpindi','راولپنڈی','Punjab',33.5651,73.0169],['Multan','ملتان','Punjab',30.1575,71.5249],
  ['Gujranwala','گوجرانوالہ','Punjab',32.1877,74.1945],['Sialkot','سیالکوٹ','Punjab',32.4945,74.5229],
  ['Bahawalpur','بہاولپور','Punjab',29.3956,71.6836],['Sargodha','سرگودھا','Punjab',32.0836,72.6711],
  ['Sheikhupura','شیخوپورہ','Punjab',31.7167,73.985],['Jhelum','جہلم','Punjab',32.9425,73.7257],
  ['Gujrat','گجرات','Punjab',32.5731,74.0789],['Rahim Yar Khan','رحیم یار خان','Punjab',28.4202,70.2952],
  ['Dera Ghazi Khan','ڈیرہ غازی خان','Punjab',30.0489,70.6402],['Kasur','قصور','Punjab',31.1187,74.45],
  ['Okara','اوکاڑہ','Punjab',30.8138,73.4534],['Sahiwal','ساہیوال','Punjab',30.6682,73.1114],
  ['Mianwali','میانوالی','Punjab',32.5839,71.537],
  ['Karachi','کراچی','Sindh',24.8607,67.0011],['Hyderabad','حیدرآباد','Sindh',25.396,68.3578],
  ['Sukkur','سکھر','Sindh',27.7052,68.8574],['Larkana','لاڑکانہ','Sindh',27.557,68.2141],
  ['Mirpur Khas','میرپور خاص','Sindh',25.5276,69.0159],['Nawabshah','نواب شاہ','Sindh',26.2442,68.41],
  ['Thatta','ٹھٹھہ','Sindh',24.7461,67.9236],['Jacobabad','جیکب آباد','Sindh',28.2769,68.4514],
  ['Khairpur','خیرپور','Sindh',27.5295,68.7592],
  ['Peshawar','پشاور','KP',34.0151,71.5249],['Abbottabad','ایبٹ آباد','KP',34.1688,73.2215],
  ['Mardan','مردان','KP',34.1989,72.0231],['Swat (Mingora)','سوات','KP',34.7717,72.36],
  ['Kohat','کوہاٹ','KP',33.5869,71.4414],['Bannu','بنوں','KP',32.9889,70.6056],
  ['Dera Ismail Khan','ڈیرہ اسماعیل خان','KP',31.8313,70.9017],['Mansehra','مانسہرہ','KP',34.3333,73.2],
  ['Nowshera','نوشہرہ','KP',34.0153,71.9747],['Charsadda','چارسدہ','KP',34.1453,71.7308],
  ['Quetta','کوئٹہ','Balochistan',30.1798,66.975],['Gwadar','گوادر','Balochistan',25.1216,62.3254],
  ['Turbat','تربت','Balochistan',26.0012,63.0544],['Khuzdar','خضدار','Balochistan',27.8,66.6167],
  ['Sibi','سبی','Balochistan',29.543,67.8773],['Zhob','ژوب','Balochistan',31.3411,69.4481],
  ['Chaman','چمن','Balochistan',30.921,66.4597],
  ['Islamabad','اسلام آباد','ICT',33.6844,73.0479],
  ['Muzaffarabad','مظفرآباد','AJK',34.37,73.4711],['Mirpur','میرپور','AJK',33.1478,73.7519],
  ['Rawalakot','راولاکوٹ','AJK',33.8578,73.7604],['Kotli','کوٹلی','AJK',33.5186,73.9022],
  ['Gilgit','گلگت','GB',35.9208,74.308],['Skardu','سکردو','GB',35.2971,75.6333],
  ['Hunza (Karimabad)','ہنزہ','GB',36.3167,74.65],['Chilas','چلاس','GB',35.4128,74.0954]
];
const PROV = {
  Punjab:['Punjab','پنجاب'], Sindh:['Sindh','سندھ'], KP:['Khyber Pakhtunkhwa','خیبر پختونخوا'],
  Balochistan:['Balochistan','بلوچستان'], ICT:['Islamabad Capital Territory','وفاقی دارالحکومت'],
  AJK:['Azad Jammu & Kashmir','آزاد جموں و کشمیر'], GB:['Gilgit-Baltistan','گلگت بلتستان']
};

/* ---------- Prayers & translations ---------- */
const PRAYERS = [
  { k:'Fajr', ur:'فجر', ic:'🌌' }, { k:'Dhuhr', ur:'ظہر', ic:'☀️' },
  { k:'Asr', ur:'عصر', ic:'🌤️' }, { k:'Maghrib', ur:'مغرب', ic:'🌇' }, { k:'Isha', ur:'عشاء', ic:'🌙' }
];
const T = {
  en: { app:'Pakistan Namaz Timing', yesterday:'Yesterday', today:'Today', tomorrow:'Tomorrow', weekly:'Weekly', monthly:'Monthly',
    chooseCity:'Choose city', search:'Search city in English or اردو', useLocation:'Use my location', settings:'Settings', adjTitle:'Adjust times (minutes)', adjNote:'Includes the usual Pakistani precautionary minutes (ihtiyat). Change any value to match your local mosque.', min:'min', reset:'Reset to Pakistan default',
    method:'Calculation method', asr:'Asr calculation', hanafi:'Hanafi', shafi:'Shafi', notify:'Notify me 10 minutes before each prayer',
    settingsNote:'Karachi (University of Islamic Sciences) with Hanafi Asr is the usual choice in Pakistan.',
    disclaimer:'Hijri dates may differ by a day depending on local moon sighting. Calculated times can differ slightly from your local mosque timetable.',
    next:'Next prayer', nextTomorrow:'Next prayer (tomorrow)', sunrise:'Sunrise', loading:'Loading prayer times…', retry:'Retry',
    err:'Could not load prayer times. Check your internet connection.', cachedMsg:'You are offline: showing saved (cached) timings, which may be out of date.',
    selDate:'Selected date', isToday:'Today', viewing:'Viewing another date', backToday:'Go to today for the live countdown.',
    none:'No city found. Try another spelling or province.', all:'All', date:'Date', source:'Data: AlAdhan Prayer Times API', live:'live',
    cached:'cached', locFail:'Could not get your location. Please choose a city manually.', prayers:{Fajr:'Fajr',Dhuhr:'Dhuhr',Asr:'Asr',Maghrib:'Maghrib',Isha:'Isha'} },
  ur: { app:'پاکستان نماز اوقات', yesterday:'کل (گزشتہ)', today:'آج', tomorrow:'کل (آئندہ)', weekly:'ہفتہ وار', monthly:'ماہانہ',
    chooseCity:'شہر منتخب کریں', search:'شہر تلاش کریں', useLocation:'میری لوکیشن استعمال کریں', settings:'ترتیبات', adjTitle:'اوقات میں تبدیلی (منٹ)', adjNote:'اس میں پاکستان میں رائج احتیاطی منٹ شامل ہیں۔ اپنی مقامی مسجد کے مطابق کوئی بھی قدر تبدیل کریں۔', min:'منٹ', reset:'پاکستانی ڈیفالٹ بحال کریں',
    method:'حساب کا طریقہ', asr:'عصر کا حساب', hanafi:'حنفی', shafi:'شافعی', notify:'ہر نماز سے 10 منٹ پہلے یاد دہانی',
    settingsNote:'پاکستان میں عموماً جامعہ علوم اسلامیہ کراچی اور حنفی عصر استعمال ہوتا ہے۔',
    disclaimer:'ہجری تاریخ مقامی چاند نظر آنے کے مطابق ایک دن مختلف ہو سکتی ہے۔ حساب شدہ اوقات آپ کی مقامی مسجد کے نقشے سے قدرے مختلف ہو سکتے ہیں۔',
    next:'اگلی نماز', nextTomorrow:'اگلی نماز (کل)', sunrise:'طلوع آفتاب', loading:'نماز کے اوقات لوڈ ہو رہے ہیں…', retry:'دوبارہ کوشش کریں',
    err:'نماز کے اوقات لوڈ نہیں ہو سکے۔ انٹرنیٹ چیک کریں۔', cachedMsg:'آپ آف لائن ہیں: محفوظ شدہ (کیشڈ) اوقات دکھائے جا رہے ہیں جو پرانے ہو سکتے ہیں۔',
    selDate:'منتخب تاریخ', isToday:'آج', viewing:'دوسری تاریخ دیکھی جا رہی ہے', backToday:'براہِ راست کاؤنٹ ڈاؤن کے لیے آج پر جائیں۔',
    none:'کوئی شہر نہیں ملا۔ کوئی اور املا یا صوبہ آزمائیں۔', all:'سب', date:'تاریخ', source:'ماخذ: AlAdhan پرئیر ٹائمز API', live:'براہِ راست',
    cached:'کیشڈ', locFail:'لوکیشن نہیں مل سکی۔ براہِ کرم شہر خود منتخب کریں۔', prayers:{Fajr:'فجر',Dhuhr:'ظہر',Asr:'عصر',Maghrib:'مغرب',Isha:'عشاء'} }
};
const t = k => T[S.lang][k];

/* ---------- Date helpers (everything in Pakistan time) ---------- */
const pkNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const locale = () => S.lang === 'ur' ? 'ur-PK' : 'en-GB';
const clean = s => s.slice(0, 5);                        // "05:12 (PKT)" -> "05:12"
const to12 = s => { const [h, m] = s.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`; };
const atTime = (day, s) => { const [h, m] = s.split(':').map(Number); return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m); };

let selected = dayStart(pkNow());
let current = null, tomorrowFajr = null, notified = '';

/* ---------- Fetching prayer times (AlAdhan monthly calendar) ----------
   One request returns a whole month, so day changes inside a month need no new request. */
const live = new Map();                                   // this-session results = live data
const city = () => CITIES.find(c => c[0] === S.city) || CITIES[0];

async function getMonth(y, m) {
  const c = city();
  const key = `nt2:${c[0]}:${S.method}:${S.school}:${tune()}:${y}-${m}`;
  if (live.has(key)) return { data: live.get(key), cached: false };
  try {
    const url = `${API}/${y}/${m}?latitude=${c[3]}&longitude=${c[4]}&method=${S.method}&school=${S.school}&tune=${tune()}&timezonestring=${TZ}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const json = await res.json();
    if (!json.data || !json.data.length) throw new Error('bad data');
    live.set(key, json.data);
    store.set(key, json.data);                            // keep a fallback copy
    return { data: json.data, cached: false };
  } catch (e) {
    const old = store.get(key, null);
    if (old) return { data: old, cached: true };          // clearly flagged as cached
    throw e;
  }
}
async function getDay(d) {
  const r = await getMonth(d.getFullYear(), d.getMonth() + 1);
  return { entry: r.data[d.getDate() - 1], cached: r.cached };
}

/* ---------- UI: status messages ---------- */
function status(msg, type, retry) {
  const el = $('#status');
  el.hidden = !msg; el.className = 'status ' + (type || '');
  el.innerHTML = '';
  if (!msg) return;
  el.append(msg);
  if (retry) { const b = document.createElement('button'); b.textContent = t('retry'); b.onclick = load; el.append(b); }
}

/* ---------- Main load + render ---------- */
async function load() {
  status(t('loading'), 'info');
  try {
    const { entry, cached } = await getDay(selected);
    current = entry;
    tomorrowFajr = null;
    if (sameDay(selected, dayStart(pkNow()))) {           // need tomorrow's Fajr after Isha
      try { tomorrowFajr = clean((await getDay(addDays(selected, 1))).entry.timings.Fajr); } catch {}
    }
    status(cached ? t('cachedMsg') : '', 'info');
    $('#source').textContent = `${t('source')} · ${S.city} · ${cached ? t('cached') : t('live')}`;
    render(); tick(); buildTable();
  } catch (e) {
    current = null; $('#cards').innerHTML = '';
    status(t('err'), '', true);
  }
}

function render() {
  if (!current) return;
  const tm = current.timings, h = current.date.hijri;
  const today = sameDay(selected, dayStart(pkNow()));
  $('#greg').textContent = selected.toLocaleDateString(locale(), { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  $('#hijri').textContent = S.lang === 'ur'
    ? `${h.weekday.ar} ${h.day} ${h.month.ar} ${h.year} ھ` : `${h.day} ${h.month.en} ${h.year} AH`;
  const tag = $('#dayTag');
  tag.textContent = today ? t('isToday') : t('selDate');
  tag.className = 'tag' + (today ? '' : ' other');
  $('#sun').textContent = `🌅 ${t('sunrise')} (طلوع آفتاب): ${to12(clean(tm.Sunrise))}`;
  $('#cards').innerHTML = PRAYERS.map(p => `
    <article class="card" data-p="${p.k}"><div class="ic">${p.ic}</div>
      <h3>${t('prayers')[p.k]}</h3><small>${S.lang === 'ur' ? p.k : p.ur}</small>
      <div class="t">${to12(clean(tm[p.k]))}</div></article>`).join('');
  $('#datePick').value = iso(selected);
}

/* ---------- Countdown (runs every second) ---------- */
function tick() {
  if (!current) return;
  const now = pkNow();
  if (!sameDay(selected, dayStart(now))) {
    $('#heroLabel').textContent = t('viewing');
    $('#heroName').textContent = '—'; $('#count').textContent = '--:--:--';
    $('#sun').dataset.hint = t('backToday');
    document.querySelectorAll('.card').forEach(c => c.classList.remove('next'));
    return;
  }
  let next = PRAYERS.find(p => atTime(selected, clean(current.timings[p.k])) > now), when, tomorrow = false;
  if (next) when = atTime(selected, clean(current.timings[next.k]));
  else if (tomorrowFajr) { next = PRAYERS[0]; when = atTime(addDays(selected, 1), tomorrowFajr); tomorrow = true; }
  else return;
  const sec = Math.max(0, Math.floor((when - now) / 1000));
  const f = n => String(n).padStart(2, '0');
  $('#heroLabel').textContent = tomorrow ? t('nextTomorrow') : t('next');
  $('#heroName').textContent = `${t('prayers')[next.k]} · ${S.lang === 'ur' ? next.k : next.ur}`;
  $('#count').textContent = `${f(Math.floor(sec / 3600))}:${f(Math.floor(sec % 3600 / 60))}:${f(sec % 60)}`;
  document.querySelectorAll('.card').forEach(c => c.classList.toggle('next', !tomorrow && c.dataset.p === next.k));
  // Optional notification, only if the user enabled it and allowed permission
  if (S.notify && 'Notification' in window && Notification.permission === 'granted' && sec <= 600 && notified !== next.k + iso(when)) {
    notified = next.k + iso(when);
    new Notification(`${t('prayers')[next.k]} – ${to12(when.toTimeString().slice(0,5))}`, { body: S.city });
  }
}
setInterval(tick, 1000);

/* ---------- Weekly / monthly table ---------- */
let tab = 'week';
async function buildTable() {
  const days = [];
  try {
    if (tab === 'week') {
      for (let i = 0; i < 7; i++) { const d = addDays(selected, i); days.push({ d, e: (await getDay(d)).entry }); }
    } else {
      const m = (await getMonth(selected.getFullYear(), selected.getMonth() + 1)).data;
      m.forEach((e, i) => days.push({ d: new Date(selected.getFullYear(), selected.getMonth(), i + 1), e }));
    }
  } catch { $('#table').innerHTML = ''; return; }
  const head = `<tr><th>${t('date')}</th>${PRAYERS.map(p => `<th>${t('prayers')[p.k]}</th>`).join('')}</tr>`;
  $('#table').innerHTML = head + days.map(({ d, e }) => `
    <tr class="${sameDay(d, selected) ? 'sel' : ''}"><td>${d.toLocaleDateString(locale(), { weekday:'short', day:'numeric', month:'short' })}</td>
    ${PRAYERS.map(p => `<td>${to12(clean(e.timings[p.k]))}</td>`).join('')}</tr>`).join('');
}

/* ---------- City picker ---------- */
let provFilter = 'all';
function cityName(c) { return S.lang === 'ur' ? c[1] : c[0]; }
function provName(k) { return PROV[k][S.lang === 'ur' ? 1 : 0]; }
function renderCities() {
  const q = $('#q').value.trim().toLowerCase();
  $('#chips').innerHTML = [['all', t('all')], ...Object.keys(PROV).map(k => [k, provName(k)])]
    .map(([k, n]) => `<button class="${k === provFilter ? 'on' : ''}" data-prov="${k}">${n}</button>`).join('');
  const list = CITIES.filter(c => (provFilter === 'all' || c[2] === provFilter) && (!q || c[0].toLowerCase().includes(q) || c[1].includes(q)));
  $('#cityList').innerHTML = list.length
    ? list.map(c => `<li><button class="${c[0] === S.city ? 'cur' : ''}" data-city="${c[0]}"><span>${cityName(c)}</span><small>${provName(c[2])}</small></button></li>`).join('')
    : `<li class="empty">${t('none')}</li>`;
}
function pickCity(name) {
  S.city = name; store.set('city', name);
  $('#cityName').textContent = cityName(city());
  $('#cityDlg').close(); load();
}
$('#chips').onclick = e => { if (e.target.dataset.prov) { provFilter = e.target.dataset.prov; renderCities(); } };
$('#cityList').onclick = e => { const b = e.target.closest('[data-city]'); if (b) pickCity(b.dataset.city); };
$('#q').oninput = renderCities;
$('#clearQ').onclick = () => { $('#q').value = ''; renderCities(); $('#q').focus(); };
$('#cityBtn').onclick = () => { renderCities(); $('#cityDlg').showModal(); };
// Optional geolocation: suggests the nearest city (nothing is stored or sent anywhere)
$('#locBtn').onclick = () => {
  if (!navigator.geolocation) return alert(t('locFail'));
  navigator.geolocation.getCurrentPosition(p => {
    const dist = c => (c[3] - p.coords.latitude) ** 2 + ((c[4] - p.coords.longitude) * Math.cos(c[3] * Math.PI / 180)) ** 2;
    pickCity(CITIES.reduce((a, b) => dist(b) < dist(a) ? b : a)[0]);
  }, () => alert(t('locFail')));
};

/* ---------- Date controls ---------- */
const go = d => { selected = dayStart(d); load(); };
$('#prev').onclick = () => go(addDays(selected, -1));
$('#next').onclick = () => go(addDays(selected, 1));
document.querySelectorAll('.quick [data-d]').forEach(b => b.onclick = () => go(addDays(pkNow(), +b.dataset.d)));
$('#datePick').onchange = e => { if (e.target.value) { const [y, m, d] = e.target.value.split('-').map(Number); go(new Date(y, m - 1, d)); } };
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
  buildTable();
});

/* ---------- Theme, language, settings ---------- */
function applyTheme() { document.documentElement.dataset.theme = S.theme; $('#themeBtn').textContent = S.theme === 'dark' ? '☀️' : '🌙'; }
$('#themeBtn').onclick = () => { S.theme = S.theme === 'dark' ? 'light' : 'dark'; store.set('theme', S.theme); applyTheme(); };

function applyLang() {
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ur' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll('[data-ph]').forEach(el => el.placeholder = t(el.dataset.ph));
  $('#langSel').value = S.lang;
  $('#cityName').textContent = cityName(city());
  document.title = t('app');
  render(); tick(); buildTable(); renderCities(); renderAdj();
}
$('#langSel').onchange = e => { S.lang = e.target.value; store.set('lang', S.lang); applyLang(); };

$('#method').value = S.method; $('#school').value = S.school; $('#notify').checked = S.notify;
$('#setBtn').onclick = () => $('#setDlg').showModal();
$('#method').onchange = e => { S.method = +e.target.value; store.set('method', S.method); load(); };
$('#school').onchange = e => { S.school = +e.target.value; store.set('school', S.school); load(); };
function renderAdj() {
  $('#adj').innerHTML = ADJ_KEYS.map(k => `<label class="adj"><span>${k === 'Sunrise' ? t('sunrise') : t('prayers')[k]}</span>
    <input type="number" min="-30" max="30" step="1" data-adj="${k}" value="${S.adj[k]}"> <small>${t('min')}</small></label>`).join('');
}
$('#adj').onchange = e => {
  const k = e.target.dataset.adj; if (!k) return;
  const v = Math.max(-30, Math.min(30, Math.round(+e.target.value || 0)));
  e.target.value = v; S.adj[k] = v; store.set('adj', S.adj); load();
};
$('#adjReset').onclick = () => { S.adj = { ...IHTIYAT }; store.set('adj', S.adj); renderAdj(); load(); };
$('#notify').onchange = async e => {
  let on = e.target.checked;
  if (on && 'Notification' in window) on = (await Notification.requestPermission()) === 'granted';
  else if (on) on = false;
  S.notify = on; e.target.checked = on; store.set('notify', on);
};
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

$('#refBtn').onclick = () => { live.clear(); load(); };

/* ---------- Start ---------- */
applyTheme(); applyLang(); load();
