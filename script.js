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
  city: store.get('city', null), lang: store.get('lang', 'en'),
  theme: store.get('theme', 'light'), method: store.get('method', 1),
  school: store.get('school', 1), notify: store.get('notify', false),
  rem10: store.get('rem10', false), rem3: store.get('rem3', false), alarm: store.get('alarm', false),
  sound: store.get('sound', 'chime'),
  adj: Object.assign({}, store.get('adj', null) || {}),
  juma: Object.assign({}, store.get('juma', null) || {}),
  jam: Object.assign({}, store.get('jam', null) || {})
};
/* Daily jamaat (congregation) times. Each mosque sets its own, usually a fixed
   number of minutes after the azan. A fixed clock time can be entered instead. */
const JAM_DEFAULT = { Fajr:30, Dhuhr:30, Asr:20, Maghrib:5, Isha:30 };
Object.keys(JAM_DEFAULT).forEach(k => {
  const v = S.jam[k] || {};
  S.jam[k] = { after: Number.isFinite(v.after) ? v.after : JAM_DEFAULT[k], fixed: /^\d{2}:\d{2}$/.test(v.fixed || '') ? v.fixed : '' };
});
/* Jumu'ah (Friday) is set by each mosque, not by astronomy. Common Pakistani
   timings: khutbah 1:00 PM, jamaat 1:30 PM. Users can match their own mosque. */
const JUMA_DEFAULT = { khutbah:'13:00', jamaat:'13:30' };
['khutbah','jamaat'].forEach(k => { if (!/^\d{2}:\d{2}$/.test(S.juma[k] || '')) S.juma[k] = JUMA_DEFAULT[k]; });
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
    chooseCity:'Choose city', pickCity:'Select city', welcomeTitle:'Select your city', welcomeText:'Choose your city or use your location to see prayer times.', search:'Search city in English or اردو', useLocation:'Use my location', settings:'Settings', adjTitle:'Adjust times (minutes)', adjNote:'Includes the usual Pakistani precautionary minutes (ihtiyat). Change any value to match your local mosque.', min:'min', reset:'Reset to Pakistan default',
    method:'Calculation method', asr:'Asr calculation', hanafi:'Hanafi', shafi:'Shafi', notify:'Show phone / computer notifications',
    alertsTitle:'Reminders & azan alarm', rem10:'Reminder 10 minutes before each prayer', rem3:'Reminder 3 minutes before Jumu\'ah',
    alarmOpt:'Ring azan alarm at prayer time (keeps ringing until you stop it)', sound:'Alarm sound', soundChime:'Built-in chime',
    soundFile:'My azan audio file', pickFile:'Choose an azan audio file (mp3, m4a…)', testAlarm:'▶ Test alarm', stop:'Stop alarm',
    alertsNote:'Keep the app open (it can stay in the background) so reminders and the alarm can ring. Phones may pause apps when the screen is locked, so keep sound on and the app open near prayer time.',
    alertAsk:'Turn on prayer reminders (10 min before, 3 min before Jumu\'ah) and the azan alarm?', turnOn:'Turn on', later:'Later',
    install:'Install app', installTitle:'Install on your device', installed:'The app is installed on this device. ✓',
    installReady:'Tap “Install app” to add it to your home screen or desktop. It opens like a normal app and works offline.',
    installIOS:'On iPhone / iPad: open this page in Safari, tap the Share button (⬆), then “Add to Home Screen”.',
    installOther:'Open your browser menu (⋮ or ⋯) and choose “Install app” or “Add to Home screen”.',
    alarmNow:'It is time for prayer', remIn:(p, n) => `${p} in ${n} minute${n === 1 ? '' : 's'}`, jumaRem:n => `Jumu'ah jamaat in ${n} minute${n === 1 ? '' : 's'}`,
    testLabel:'Test alarm', noFile:'No audio file chosen yet, so the built-in chime is used.', fileSaved:'Saved:',
    settingsNote:'Karachi (University of Islamic Sciences) with Hanafi Asr is the usual choice in Pakistan.',
    next:'Next prayer', nextTomorrow:'Next prayer (tomorrow)', sunrise:'Sunrise', loading:'Loading prayer times…', retry:'Retry',
    err:'Could not load prayer times. Check your internet connection.', cachedMsg:'You are offline: showing saved (cached) timings, which may be out of date.',
    selDate:'Selected date', isToday:'Today', viewing:'Viewing another date', backToday:'Back to today',
    pastDate:'Past date', futureDate:'Upcoming date', firstPrayer:'First prayer of this day', pastNote:'These prayer times have passed.',
    daysLeft:n => `${n} day${n === 1 ? '' : 's'}`,
    none:'No city found. Try another spelling or province.', all:'All', date:'Date',
    cached:'cached', locFail:'Could not get your location. Please choose a city manually.', prayers:{Fajr:'Fajr',Dhuhr:'Dhuhr',Asr:'Asr',Maghrib:'Maghrib',Isha:'Isha'},
    juma:'Jumu\'ah', jumaTitle:'Jumu\'ah (Friday prayer)', jumaToday:'Today is Friday', jumaNext:'Next Friday', azan:'Azan / Dhuhr starts', khutbah:'Khutbah', jamaat:'Jamaat',
    jumaSet:'Jumu\'ah timings (your mosque)', jumaNote:'Enter your mosque\'s Friday times.', jumaReset:'Reset to 1:00 / 1:30 PM',
    jumaEarly:'The jamaat time you set is before Dhuhr starts, so the Dhuhr start time is used.', jumaIn:n => `in ${n} day${n === 1 ? '' : 's'}`,
    azanShort:'Azan', ends:'Ends', jamSet:'Jamaat timings (your mosque)', jamAfter:'min after azan', jamFixed:'or fixed time',
    jamNote:'Set minutes after azan, or a fixed time.',
    jamReset:'Reset jamaat defaults', jamCol:'J' },
  ur: { app:'پاکستان نماز اوقات', yesterday:'کل (گزشتہ)', today:'آج', tomorrow:'کل (آئندہ)', weekly:'ہفتہ وار', monthly:'ماہانہ',
    chooseCity:'شہر منتخب کریں', pickCity:'شہر منتخب کریں', welcomeTitle:'اپنا شہر منتخب کریں', welcomeText:'نماز کے اوقات دیکھنے کے لیے اپنا شہر منتخب کریں یا لوکیشن استعمال کریں۔', search:'شہر تلاش کریں', useLocation:'میری لوکیشن استعمال کریں', settings:'ترتیبات', adjTitle:'اوقات میں تبدیلی (منٹ)', adjNote:'اس میں پاکستان میں رائج احتیاطی منٹ شامل ہیں۔ اپنی مقامی مسجد کے مطابق کوئی بھی قدر تبدیل کریں۔', min:'منٹ', reset:'پاکستانی ڈیفالٹ بحال کریں',
    method:'حساب کا طریقہ', asr:'عصر کا حساب', hanafi:'حنفی', shafi:'شافعی', notify:'فون / کمپیوٹر پر نوٹیفکیشن دکھائیں',
    alertsTitle:'یاد دہانی اور اذان الارم', rem10:'ہر نماز سے 10 منٹ پہلے یاد دہانی', rem3:'جمعہ سے 3 منٹ پہلے یاد دہانی',
    alarmOpt:'نماز کے وقت اذان کا الارم بجائیں (بند کرنے تک بجتا رہے گا)', sound:'الارم کی آواز', soundChime:'بلٹ اِن گھنٹی',
    soundFile:'میری اذان کی آڈیو فائل', pickFile:'اذان کی آڈیو فائل منتخب کریں (mp3، m4a…)', testAlarm:'▶ الارم آزمائیں', stop:'الارم بند کریں',
    alertsNote:'یاد دہانی اور الارم کے لیے ایپ کھلی رکھیں (پس منظر میں بھی چل سکتی ہے)۔ فون اسکرین لاک ہونے پر ایپ روک سکتا ہے، اس لیے نماز کے وقت آواز آن اور ایپ کھلی رکھیں۔',
    alertAsk:'نماز کی یاد دہانی (10 منٹ پہلے، جمعہ سے 3 منٹ پہلے) اور اذان الارم آن کریں؟', turnOn:'آن کریں', later:'بعد میں',
    install:'ایپ انسٹال کریں', installTitle:'اپنے آلے پر انسٹال کریں', installed:'ایپ اس آلے پر انسٹال ہے۔ ✓',
    installReady:'”ایپ انسٹال کریں“ دبائیں تاکہ یہ ہوم اسکرین یا ڈیسک ٹاپ پر آ جائے۔ یہ عام ایپ کی طرح کھلتی ہے اور آف لائن بھی چلتی ہے۔',
    installIOS:'آئی فون / آئی پیڈ: یہ صفحہ Safari میں کھولیں، شیئر بٹن (⬆) دبائیں، پھر ”Add to Home Screen“ منتخب کریں۔',
    installOther:'براؤزر کا مینو (⋮ یا ⋯) کھولیں اور ”Install app“ یا ”Add to Home screen“ منتخب کریں۔',
    alarmNow:'نماز کا وقت ہو گیا ہے', remIn:(p, n) => `${p} میں ${n} منٹ باقی`, jumaRem:n => `جمعہ کی جماعت میں ${n} منٹ باقی`,
    testLabel:'الارم کی آزمائش', noFile:'ابھی کوئی آڈیو فائل منتخب نہیں کی گئی، اس لیے بلٹ اِن گھنٹی استعمال ہو گی۔', fileSaved:'محفوظ:',
    settingsNote:'پاکستان میں عموماً جامعہ علوم اسلامیہ کراچی اور حنفی عصر استعمال ہوتا ہے۔',
    next:'اگلی نماز', nextTomorrow:'اگلی نماز (کل)', sunrise:'طلوع آفتاب', loading:'نماز کے اوقات لوڈ ہو رہے ہیں…', retry:'دوبارہ کوشش کریں',
    err:'نماز کے اوقات لوڈ نہیں ہو سکے۔ انٹرنیٹ چیک کریں۔', cachedMsg:'آپ آف لائن ہیں: محفوظ شدہ (کیشڈ) اوقات دکھائے جا رہے ہیں جو پرانے ہو سکتے ہیں۔',
    selDate:'منتخب تاریخ', isToday:'آج', viewing:'دوسری تاریخ دیکھی جا رہی ہے', backToday:'آج پر واپس جائیں',
    pastDate:'گزشتہ تاریخ', futureDate:'آنے والی تاریخ', firstPrayer:'اس دن کی پہلی نماز', pastNote:'ان نمازوں کا وقت گزر چکا ہے۔',
    daysLeft:n => `${n} دن`,
    none:'کوئی شہر نہیں ملا۔ کوئی اور املا یا صوبہ آزمائیں۔', all:'سب', date:'تاریخ',
    cached:'کیشڈ', locFail:'لوکیشن نہیں مل سکی۔ براہِ کرم شہر خود منتخب کریں۔', prayers:{Fajr:'فجر',Dhuhr:'ظہر',Asr:'عصر',Maghrib:'مغرب',Isha:'عشاء'},
    juma:'جمعہ', jumaTitle:'نمازِ جمعہ', jumaToday:'آج جمعہ ہے', jumaNext:'اگلا جمعہ', azan:'اذان / ظہر کا آغاز', khutbah:'خطبہ', jamaat:'جماعت',
    jumaSet:'جمعہ کے اوقات (آپ کی مسجد)', jumaNote:'اپنی مسجد کے جمعہ کے اوقات درج کریں۔', jumaReset:'1:00 / 1:30 بجے پر بحال کریں',
    jumaEarly:'آپ کا مقرر کردہ جماعت کا وقت ظہر کے آغاز سے پہلے ہے، اس لیے ظہر کے آغاز کا وقت استعمال کیا گیا ہے۔', jumaIn:n => `${n} دن میں`,
    azanShort:'اذان', ends:'وقت ختم', jamSet:'جماعت کے اوقات (آپ کی مسجد)', jamAfter:'منٹ اذان کے بعد', jamFixed:'یا مقررہ وقت',
    jamNote:'اذان کے بعد منٹ درج کریں یا مقررہ وقت۔',
    jamReset:'جماعت کے ڈیفالٹ بحال کریں', jamCol:'ج' }
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

const isFri = d => d.getDay() === 5;
const mins = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
/* Jamaat time for a Friday; never earlier than the day's Dhuhr start. */
const jumaJamaat = e => { const z = clean(e.timings.Dhuhr); return mins(S.juma.jamaat) >= mins(z) ? S.juma.jamaat : z; };
/* The time shown/used for a prayer on a given day (Dhuhr becomes Jumu'ah on Fridays). */
const pTime = (d, e, k) => (k === 'Dhuhr' && isFri(d)) ? jumaJamaat(e) : clean(e.timings[k]);
const hm = n => { n = ((n % 1440) + 1440) % 1440; return `${String(Math.floor(n / 60)).padStart(2,'0')}:${String(n % 60).padStart(2,'0')}`; };
/* Jamaat time for any prayer on a given day (Jumu'ah jamaat on Fridays). */
const jamTime = (d, e, k) => {
  if (k === 'Dhuhr' && isFri(d)) return jumaJamaat(e);
  const az = clean(e.timings[k]), j = S.jam[k];
  if (j.fixed && mins(j.fixed) >= mins(az)) return j.fixed;
  return hm(mins(az) + j.after);
};
/* When each prayer's time ends: Fajr→sunrise, Dhuhr→Asr, Asr→sunset, Maghrib→Isha, Isha→next Fajr. */
const ENDS = { Fajr:'Sunrise', Dhuhr:'Asr', Asr:'Sunset', Maghrib:'Isha' };
const endTime = (e, k, nextFajr) => k === 'Isha' ? nextFajr : clean(e.timings[ENDS[k]]);
const pName = (d, k) => (k === 'Dhuhr' && isFri(d)) ? t('juma') : t('prayers')[k];
const pAlt = (d, p) => (p.k === 'Dhuhr' && isFri(d)) ? (S.lang === 'ur' ? "Jumu'ah" : 'جمعہ') : (S.lang === 'ur' ? p.k : p.ur);

let selected = dayStart(pkNow());
let today0 = dayStart(pkNow());                          // used to follow midnight rollover
const dayDiff = d => Math.round((dayStart(d) - dayStart(pkNow())) / 864e5);   // -1 yesterday, 0 today, 1 tomorrow
let loadId = 0;
let current = null, tomorrowFajr = null, nextFajr = null;

/* ---------- Fetching prayer times (AlAdhan monthly calendar) ----------
   One request returns a whole month, so day changes inside a month need no new request. */
const live = new Map();                                   // this-session results = live data
const city = () => CITIES.find(c => c[0] === S.city) || null;

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
  const has = !!city();
  document.body.classList.toggle('no-city', !has);
  $('#welcome').hidden = has;
  if (!has) { current = null; status(''); return; }
  alertDay = null;                                        // re-read today's times for reminders
  const id = ++loadId, day = selected;                    // ignore results of older, slower requests
  markQuick();
  status(t('loading'), 'info');
  try {
    const { entry, cached } = await getDay(day);
    // next day's Fajr: end of Isha time, and the countdown target after Isha
    let nf = null;
    try { nf = clean((await getDay(addDays(day, 1))).entry.timings.Fajr); } catch {}
    if (id !== loadId) return;
    current = entry; nextFajr = nf;
    tomorrowFajr = sameDay(day, dayStart(pkNow())) ? nf : null;
    status(cached ? t('cachedMsg') : '', 'info');
    render(); tick(); buildTable(); buildJuma();
  } catch (e) {
    if (id !== loadId) return;
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
  const tag = $('#dayTag'), dd = dayDiff(selected);
  tag.textContent = today ? t('isToday') : dd === -1 ? t('yesterday') : dd === 1 ? t('tomorrow') : dd < 0 ? t('pastDate') : t('futureDate');
  tag.className = 'tag' + (today ? '' : ' other');
  $('#sun').textContent = `🌅 ${t('sunrise')} (طلوع آفتاب): ${to12(clean(tm.Sunrise))}`;
  const fri = isFri(selected);
  $('#cards').innerHTML = PRAYERS.map(p => {
    const juma = fri && p.k === 'Dhuhr', end = endTime(current, p.k, nextFajr);
    return `
    <article class="card${juma ? ' juma' : ''}" data-p="${p.k}"><div class="ic">${juma ? '🕌' : p.ic}</div>
      <h3>${pName(selected, p.k)}</h3><small>${pAlt(selected, p)}</small>
      <div class="trow"><span>${t('azanShort')}</span><b>${to12(clean(tm[p.k]))}</b></div>
      ${juma ? `<div class="trow"><span>${t('khutbah')}</span><b>${to12(S.juma.khutbah)}</b></div>` : ''}
      <div class="trow jam"><span>${t('jamaat')}</span><b class="t">${to12(jamTime(selected, current, p.k))}</b></div>
      ${end ? `<small class="ends">${t('ends')} ${to12(end)}</small>` : ''}</article>`;
  }).join('');
  $('#datePick').value = iso(selected);
}

/* ---------- Countdown (runs every second) ---------- */
function tick() {
  if (!current) return;
  const now = pkNow();
  // Midnight passed while the app was open on "today": move on to the new day automatically
  if (!sameDay(today0, dayStart(now))) {
    const wasToday = sameDay(selected, today0);
    today0 = dayStart(now);
    if (wasToday) { selected = today0; load(); return; }
    markQuick(); render(); buildJuma();
  }
  const f = n => String(n).padStart(2, '0');
  const hms = s => `${f(Math.floor(s / 3600))}:${f(Math.floor(s % 3600 / 60))}:${f(s % 60)}`;
  $('#backToday').hidden = sameDay(selected, dayStart(now));
  if (!sameDay(selected, dayStart(now))) {
    // Another date: show that day's first prayer (future) or a summary (past)
    document.querySelectorAll('.card').forEach(c => c.classList.remove('next'));
    const dd = dayDiff(selected), dayLbl = dd === -1 ? t('yesterday') : dd === 1 ? t('tomorrow') : (dd < 0 ? t('pastDate') : t('futureDate'));
    const fajr = PRAYERS[0];
    $('#heroLabel').textContent = `${dayLbl} · ${t('firstPrayer')}`;
    $('#heroName').textContent = `${pName(selected, fajr.k)} · ${pAlt(selected, fajr)}`;
    $('#heroSub').textContent = `${t('azanShort')} ${to12(clean(current.timings.Fajr))} · ${t('jamaat')} ${to12(jamTime(selected, current, fajr.k))}`;
    if (dd > 0) {
      const sec = Math.max(0, Math.floor((atTime(selected, clean(current.timings.Fajr)) - now) / 1000));
      const d = Math.floor(sec / 86400);
      $('#count').textContent = (d >= 1 ? `${t('daysLeft')(d)} ` : '') + hms(sec % 86400);
    } else {
      $('#count').textContent = '✓';
      $('#heroSub').textContent += ` — ${t('pastNote')}`;
    }
    return;
  }
  let next = PRAYERS.find(p => atTime(selected, pTime(selected, current, p.k)) > now), when, tomorrow = false;
  if (next) when = atTime(selected, pTime(selected, current, next.k));
  else if (tomorrowFajr) { next = PRAYERS[0]; when = atTime(addDays(selected, 1), tomorrowFajr); tomorrow = true; }
  else return;
  const sec = Math.max(0, Math.floor((when - now) / 1000));
  $('#heroLabel').textContent = tomorrow ? t('nextTomorrow') : t('next');
  const nd = tomorrow ? addDays(selected, 1) : selected;
  $('#heroName').textContent = `${pName(nd, next.k)} · ${pAlt(nd, next)}`;
  if (!tomorrow) $('#heroSub').textContent = `${t('azanShort')} ${to12(clean(current.timings[next.k]))} · ${t('jamaat')} ${to12(jamTime(nd, current, next.k))}`;
  else $('#heroSub').textContent = `${t('azanShort')} ${to12(tomorrowFajr)}`;
  $('#count').textContent = hms(sec);
  document.querySelectorAll('.card').forEach(c => c.classList.toggle('next', !tomorrow && c.dataset.p === next.k));
}
setInterval(tick, 1000);

/* ---------- Weekly / monthly table ---------- */
let tab = 'week';
let tableId = 0;
async function buildTable() {
  const id = ++tableId, days = [];
  try {
    if (tab === 'week') {
      for (let i = 0; i < 7; i++) { const d = addDays(selected, i); days.push({ d, e: (await getDay(d)).entry }); }
    } else {
      const m = (await getMonth(selected.getFullYear(), selected.getMonth() + 1)).data;
      m.forEach((e, i) => days.push({ d: new Date(selected.getFullYear(), selected.getMonth(), i + 1), e }));
    }
  } catch { if (id === tableId) $('#table').innerHTML = ''; return; }
  if (id !== tableId) return;
  const head = `<tr><th>${t('date')}</th>${PRAYERS.map(p => `<th>${t('prayers')[p.k]}<small class="tj">${t('azanShort')} / ${t('jamaat')}</small></th>`).join('')}</tr>`;
  $('#table').innerHTML = head + days.map(({ d, e }) => `
    <tr class="${sameDay(d, selected) ? 'sel' : ''}${isFri(d) ? ' fri' : ''}"><td>${d.toLocaleDateString(locale(), { weekday:'short', day:'numeric', month:'short' })}</td>
    ${PRAYERS.map(p => `<td>${to12(clean(e.timings[p.k]))}<small class="tj" title="${(p.k === 'Dhuhr' && isFri(d)) ? t('juma') + ' – ' : ''}${t('jamaat')}">${(p.k === 'Dhuhr' && isFri(d)) ? '🕌' : t('jamCol')} ${to12(jamTime(d, e, p.k))}</small></td>`).join('')}</tr>`).join('');
}

/* ---------- Jumu'ah panel: this or the next Friday ---------- */
let jumaId = 0;
async function buildJuma() {
  const el = $('#juma'), id = ++jumaId;
  const base = sameDay(selected, dayStart(pkNow())) ? dayStart(pkNow()) : selected;
  const fri = addDays(base, (5 - base.getDay() + 7) % 7);
  let e;
  try { e = (await getDay(fri)).entry; } catch { if (id === jumaId) el.hidden = true; return; }
  if (id !== jumaId) return;
  const zuhr = clean(e.timings.Dhuhr), jam = jumaJamaat(e);
  const gap = Math.round((fri - base) / 864e5);
  const label = gap === 0 ? t('jumaToday') : `${t('jumaNext')} · ${t('jumaIn')(gap)}`;
  el.hidden = false;
  el.innerHTML = `
    <div class="jhead"><span class="jic">🕌</span><div><h3>${t('jumaTitle')}</h3>
      <p>${fri.toLocaleDateString(locale(), { weekday:'long', day:'numeric', month:'long' })} · ${e.date.hijri.day} ${S.lang === 'ur' ? e.date.hijri.month.ar : e.date.hijri.month.en}</p></div>
      <span class="tag${gap === 0 ? '' : ' other'}">${label}</span></div>
    <div class="jrow">
      <div><small>${t('azan')}</small><b>${to12(zuhr)}</b></div>
      <div><small>${t('khutbah')}</small><b>${to12(S.juma.khutbah)}</b></div>
      <div class="main"><small>${t('jamaat')}</small><b>${to12(jam)}</b></div>
    </div>
    ${jam !== S.juma.jamaat ? `<p class="note">${t('jumaEarly')}</p>` : ''}`;
}

/* ---------- City picker ---------- */
let provFilter = 'all';
function cityName(c) { return c ? (S.lang === 'ur' ? c[1] : c[0]) : t('pickCity'); }
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
  $('#cityDlg').close(); load(); syncAlertUI();
}
$('#chips').onclick = e => { if (e.target.dataset.prov) { provFilter = e.target.dataset.prov; renderCities(); } };
$('#cityList').onclick = e => { const b = e.target.closest('[data-city]'); if (b) pickCity(b.dataset.city); };
$('#q').oninput = renderCities;
$('#clearQ').onclick = () => { $('#q').value = ''; renderCities(); $('#q').focus(); };
const openCities = () => { renderCities(); $('#cityDlg').showModal(); };
$('#cityBtn').onclick = openCities;
$('#wPick').onclick = openCities;
// Optional geolocation: suggests the nearest city (nothing is stored or sent anywhere)
$('#wLoc').onclick = $('#locBtn').onclick = () => {
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
$('#backToday').onclick = () => go(pkNow());
/* Highlight Yesterday / Today / Tomorrow when that day is shown */
function markQuick() {
  const dd = dayDiff(selected);
  document.querySelectorAll('.quick [data-d]').forEach(b => b.classList.toggle('on', +b.dataset.d === dd));
}
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
  render(); tick(); buildTable(); buildJuma(); renderCities(); renderAdj(); renderJam(); installUI(); fileUI();
}
$('#langSel').onchange = e => { S.lang = e.target.value; store.set('lang', S.lang); applyLang(); };

$('#method').value = S.method; $('#school').value = S.school;
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
function syncJuma() { $('#jKhutbah').value = S.juma.khutbah; $('#jJamaat').value = S.juma.jamaat; }
function saveJuma() { store.set('juma', S.juma); syncJuma(); render(); tick(); buildTable(); buildJuma(); }
['khutbah','jamaat'].forEach(k => {
  const id = k === 'khutbah' ? '#jKhutbah' : '#jJamaat';
  $(id).onchange = e => { if (/^\d{2}:\d{2}$/.test(e.target.value)) { S.juma[k] = e.target.value; saveJuma(); } else syncJuma(); };
});
function renderJam() {
  $('#jamSet').innerHTML = Object.keys(JAM_DEFAULT).map(k => `<div class="jamrow"><span>${t('prayers')[k]}</span>
    <label><input type="number" min="0" max="120" step="1" data-jam="${k}" data-f="after" value="${S.jam[k].after}"><small>${t('jamAfter')}</small></label>
    <label><input type="time" data-jam="${k}" data-f="fixed" value="${S.jam[k].fixed}"><small>${t('jamFixed')}</small></label></div>`).join('');
}
function saveJam() { store.set('jam', S.jam); renderJam(); render(); tick(); buildTable(); }
$('#jamSet').onchange = e => {
  const k = e.target.dataset.jam; if (!k) return;
  if (e.target.dataset.f === 'after') S.jam[k].after = Math.max(0, Math.min(120, Math.round(+e.target.value || 0)));
  else S.jam[k].fixed = /^\d{2}:\d{2}$/.test(e.target.value) ? e.target.value : '';
  saveJam();
};
$('#jamReset').onclick = () => { S.jam = {}; Object.keys(JAM_DEFAULT).forEach(k => S.jam[k] = { after: JAM_DEFAULT[k], fixed:'' }); saveJam(); };
$('#jumaReset').onclick = () => { S.juma = { ...JUMA_DEFAULT }; saveJuma(); };
syncJuma();
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

$('#refBtn').onclick = () => { live.clear(); load(); };
if (!city()) openCities();   // first visit: ask the user to pick a city

/* =====================================================================
   INSTALL AS AN APP (phone, tablet, computer)
   ===================================================================== */
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvt = null;
function installUI() {
  const can = !!installEvt, done = isStandalone();
  $('#installBtn').hidden = done || !(can || isIOS());
  $('#installBtn2').hidden = done || !can;
  $('#installHelp').textContent = done ? t('installed') : can ? t('installReady') : isIOS() ? t('installIOS') : t('installOther');
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; installUI(); });
window.addEventListener('appinstalled', () => { installEvt = null; installUI(); });
async function doInstall() {
  if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch {} installEvt = null; installUI(); }
  else { $('#setDlg').showModal(); $('#installHelp').scrollIntoView({ block:'center' }); }
}
$('#installBtn').onclick = doInstall;
$('#installBtn2').onclick = doInstall;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'stop-alarm') stopAlarm(); });
}

/* =====================================================================
   SOUND: built-in chime (generated) or the user's own azan audio file
   ===================================================================== */
let ac = null, chimeBuf = null, src = null, audioEl = null, fileURL = null;
const AC = window.AudioContext || window.webkitAudioContext;
// Browsers only allow sound after the user has touched the page once: unlock on first tap/click/key.
function unlockAudio() {
  if (!AC) return;
  if (!ac) ac = new AC();
  if (ac.state === 'suspended') ac.resume().catch(() => {});
}
['pointerdown','keydown','touchend'].forEach(ev => document.addEventListener(ev, unlockAudio, { passive:true }));

/* A soft, bell-like chime pattern, rendered once into a buffer and looped. */
function makeChime() {
  const rate = ac.sampleRate, len = Math.floor(rate * 4.5), buf = ac.createBuffer(1, len, rate), d = buf.getChannelData(0);
  const notes = [[0, 587.33], [0.55, 880], [1.1, 783.99], [1.65, 587.33], [2.4, 880]];   // D5 A5 G5 D5 A5
  notes.forEach(([at, f]) => {
    const s0 = Math.floor(at * rate);
    for (let i = 0; s0 + i < len; i++) {
      const tt = i / rate, env = Math.exp(-tt * 2.6) * Math.min(1, tt * 200);
      d[s0 + i] += env * 0.32 * (Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(4 * Math.PI * f * tt) + 0.12 * Math.sin(6 * Math.PI * f * tt));
    }
  });
  return buf;
}
function playChime(loop) {
  unlockAudio(); if (!ac) return;
  chimeBuf = chimeBuf || makeChime();
  const n = ac.createBufferSource(); n.buffer = chimeBuf; n.loop = loop; n.connect(ac.destination); n.start();
  if (loop) src = n;
}

/* The user's own azan file is kept in the browser (IndexedDB) – never uploaded. */
const idb = () => new Promise((ok, no) => { const r = indexedDB.open('namaz', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
async function fileGet() { try { const db = await idb(); return await new Promise(ok => { const q = db.transaction('files').objectStore('files').get('azan'); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); } catch { return null; } }
async function fileSet(f) { const db = await idb(); return new Promise((ok, no) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(f, 'azan'); tx.oncomplete = ok; tx.onerror = () => no(tx.error); }); }
async function prepareFile() {
  if (audioEl) return audioEl;
  const f = await fileGet(); if (!f) return null;
  if (fileURL) URL.revokeObjectURL(fileURL);
  fileURL = URL.createObjectURL(f);
  audioEl = new Audio(fileURL); audioEl.loop = true; audioEl.preload = 'auto';
  return audioEl;
}
async function fileUI() {
  $('#fileRow').hidden = S.sound !== 'file';
  const f = S.sound === 'file' ? await fileGet() : null;
  $('#fileName').textContent = S.sound !== 'file' ? '' : f ? `${t('fileSaved')} ${f.name || 'azan'}` : t('noFile');
}

/* =====================================================================
   AZAN ALARM: full-screen, keeps ringing until the user stops it
   ===================================================================== */
const AZAN = [
  { ar:'اللّٰهُ أَكْبَرُ، اللّٰهُ أَكْبَرُ', tr:'Allāhu akbar, Allāhu akbar', en:'Allah is the Greatest', ur:'اللہ سب سے بڑا ہے', x:2 },
  { ar:'أَشْهَدُ أَنْ لَا إِلٰهَ إِلَّا اللّٰهُ', tr:'Ash-hadu an lā ilāha illallāh', en:'I bear witness that there is no god but Allah', ur:'میں گواہی دیتا ہوں کہ اللہ کے سوا کوئی معبود نہیں', x:2 },
  { ar:'أَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ اللّٰهِ', tr:'Ash-hadu anna Muḥammadar-rasūlullāh', en:'I bear witness that Muhammad ﷺ is the Messenger of Allah', ur:'میں گواہی دیتا ہوں کہ محمد ﷺ اللہ کے رسول ہیں', x:2 },
  { ar:'حَيَّ عَلَى الصَّلَاةِ', tr:'Ḥayya ʿalaṣ-ṣalāh', en:'Come to prayer', ur:'آؤ نماز کی طرف', x:2 },
  { ar:'حَيَّ عَلَى الْفَلَاحِ', tr:'Ḥayya ʿalal-falāḥ', en:'Come to success', ur:'آؤ کامیابی کی طرف', x:2 },
  { ar:'الصَّلَاةُ خَيْرٌ مِنَ النَّوْمِ', tr:'Aṣ-ṣalātu khayrum minan-nawm', en:'Prayer is better than sleep', ur:'نماز نیند سے بہتر ہے', x:2, fajr:true },
  { ar:'اللّٰهُ أَكْبَرُ، اللّٰهُ أَكْبَرُ', tr:'Allāhu akbar, Allāhu akbar', en:'Allah is the Greatest', ur:'اللہ سب سے بڑا ہے', x:1 },
  { ar:'لَا إِلٰهَ إِلَّا اللّٰهُ', tr:'Lā ilāha illallāh', en:'There is no god but Allah', ur:'اللہ کے سوا کوئی معبود نہیں', x:1 }
];
let ringing = false, lineTimer = null, buzzTimer = null, oldTitle = '';
async function startAlarm(title, label, timeText, isFajr) {
  stopAlarm();
  ringing = true;
  const lines = AZAN.filter(l => !l.fajr || isFajr);
  $('#alarmLabel').textContent = label;
  $('#alarmName').textContent = title;
  $('#alarmTime').textContent = timeText;
  $('#azanLines').innerHTML = lines.map(l => `<li><p class="ar" lang="ar" dir="rtl">${l.ar}${l.x > 1 ? ` <small>×${l.x}</small>` : ''}</p>
    <p class="tr" dir="ltr">${l.tr}</p><p class="mean">${S.lang === 'ur' ? l.ur : l.en}</p></li>`).join('');
  $('#alarmView').hidden = false;
  document.body.classList.add('ringing');
  // Highlight the azan lines one after another, again and again, while ringing
  const items = [...document.querySelectorAll('#azanLines li')]; let i = 0;
  const step = () => { items.forEach((li, j) => li.classList.toggle('on', j === i)); items[i].scrollIntoView({ block:'nearest', behavior:'smooth' }); i = (i + 1) % items.length; };
  step(); lineTimer = setInterval(step, 4000);
  // Sound (loops until stopped)
  let played = false;
  if (S.sound === 'file') {
    const a = await prepareFile();
    if (a && ringing) { try { a.currentTime = 0; await a.play(); played = true; } catch {} }
  }
  if (!played && ringing) playChime(true);
  // Vibrate on phones that support it
  if (navigator.vibrate) { const v = () => navigator.vibrate([700, 300, 700, 300, 700]); v(); buzzTimer = setInterval(v, 3500); }
  oldTitle = document.title; document.title = `🔔 ${title}`;
  $('#stopAlarm').focus();
}
function stopAlarm() {
  if (!ringing) return;
  ringing = false;
  if (src) { try { src.stop(); } catch {} src = null; }
  if (audioEl) { audioEl.pause(); }
  clearInterval(lineTimer); clearInterval(buzzTimer);
  if (navigator.vibrate) navigator.vibrate(0);
  $('#alarmView').hidden = true;
  document.body.classList.remove('ringing');
  if (oldTitle) document.title = oldTitle;
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistration)
    navigator.serviceWorker.getRegistration().then(r => r && r.getNotifications({ tag:'azan' }).then(ns => ns.forEach(n => n.close()))).catch(() => {});
}
$('#stopAlarm').onclick = stopAlarm;
document.addEventListener('keydown', e => { if (ringing && e.key === 'Escape') stopAlarm(); });

/* =====================================================================
   MESSAGES: in-app banner + system notification
   ===================================================================== */
function toast(title, body) {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `<span class="ti">🔔</span><div><b></b><p></p></div><button class="icon" aria-label="Close">✕</button>`;
  el.querySelector('b').textContent = title; el.querySelector('p').textContent = body;
  el.querySelector('button').onclick = () => el.remove();
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 120000);
}
async function sysNotify(title, body, alarm) {
  if (!S.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  const opt = { body, icon:'/icons/icon-192.png', badge:'/icons/icon-192.png', tag: alarm ? 'azan' : 'reminder', renotify:true,
    requireInteraction: !!alarm, vibrate: alarm ? [700, 300, 700, 300, 700] : [300, 150, 300], silent:false };
  if (alarm) opt.actions = [{ action:'stop', title: t('stop') }];
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) return reg.showNotification(title, opt);            // works on Android and installed apps
    delete opt.actions; new Notification(title, opt);
  } catch {}
}

/* =====================================================================
   SCHEDULER: checks today's times every second
   - 10 minutes before each prayer: reminder
   - 3 minutes before Jumu'ah jamaat (Fridays): reminder
   - at azan time: alarm with azan lines, ringing until stopped
   ===================================================================== */
let alertDay = null, alertEntry = null, alertBusy = false;
const fired = new Set(store.get('fired', []));
function markFired(id) {
  fired.add(id);
  const keep = [...fired].filter(x => x.endsWith(iso(pkNow())));
  store.set('fired', keep);
}
async function checkAlerts() {
  if (!city() || !(S.rem10 || S.rem3 || S.alarm)) return;
  const now = pkNow(), d = dayStart(now), key = iso(d);
  if (alertDay !== key) {
    if (alertBusy) return;
    alertBusy = true;
    try { alertEntry = (await getDay(d)).entry; alertDay = key; } catch { alertEntry = null; }
    alertBusy = false;
    if (!alertEntry) return;
  }
  const e = alertEntry, fri = isFri(d), M = 60000;
  for (const p of PRAYERS) {
    const juma = fri && p.k === 'Dhuhr';
    const azanS = clean(e.timings[p.k]), target = atTime(d, pTime(d, e, p.k)), azan = atTime(d, azanS);
    const name = pName(d, p.k), jam = to12(jamTime(d, e, p.k));
    const left = Math.ceil((target - now) / M);
    const info = juma ? `${t('khutbah')} ${to12(S.juma.khutbah)} · ${t('jamaat')} ${jam}` : `${t('azanShort')} ${to12(azanS)} · ${t('jamaat')} ${jam}`;
    const run = (id, from, to, fn) => { const fid = `${id}:${p.k}:${key}`; if (now >= from && now < to && !fired.has(fid)) { markFired(fid); fn(); } };
    if (S.rem10) run('r10', target - 10 * M, juma && S.rem3 ? target - 3 * M : target, () => {
      const msg = juma ? t('jumaRem')(left) : t('remIn')(name, left);
      toast(msg, info); sysNotify(msg, `${info} · ${cityName(city())}`); if (!ringing) playChime(false);
    });
    if (S.rem3 && juma) run('r3', target - 3 * M, target, () => {
      const msg = t('jumaRem')(left);
      toast(msg, info); sysNotify(msg, `${info} · ${cityName(city())}`); if (!ringing) playChime(false);
    });
    if (S.alarm) run('az', azan, azan.getTime() + 5 * M, () => {
      startAlarm(`${name} · ${pAlt(d, p)}`, t('alarmNow'), `${t('azanShort')} ${to12(azanS)} · ${t('jamaat')} ${jam}`, p.k === 'Fajr');
      sysNotify(`🕌 ${t('alarmNow')}: ${name}`, `${t('azanShort')} ${to12(azanS)} · ${t('jamaat')} ${jam} · ${cityName(city())}`, true);
    });
  }
}
setInterval(checkAlerts, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkAlerts(); });

/* ---------- Alert settings ---------- */
function syncAlertUI() {
  ['notify','rem10','rem3','alarm'].forEach(k => $('#' + k).checked = !!S[k]);
  $('#sound').value = S.sound;
  $('#alertBar').hidden = !city() || S.rem10 || S.rem3 || S.alarm || store.get('alertsAsked', false);
}
async function askNotify() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}
$('#notify').onchange = async e => { S.notify = e.target.checked && await askNotify(); store.set('notify', S.notify); syncAlertUI(); };
['rem10','rem3','alarm'].forEach(k => $('#' + k).onchange = e => { S[k] = e.target.checked; store.set(k, S[k]); unlockAudio(); syncAlertUI(); });
$('#sound').onchange = e => { S.sound = e.target.value; store.set('sound', S.sound); fileUI(); };
$('#azanFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { await fileSet(f); } catch {}
  if (audioEl) { audioEl.pause(); audioEl = null; }
  await prepareFile(); fileUI();
};
$('#testAlarm').onclick = () => { unlockAudio(); $('#setDlg').close(); startAlarm(t('testLabel'), t('alarmNow'), '', true); };
$('#alertOn').onclick = async () => {
  unlockAudio();
  S.rem10 = S.rem3 = S.alarm = true; ['rem10','rem3','alarm'].forEach(k => store.set(k, true));
  S.notify = await askNotify(); store.set('notify', S.notify);
  store.set('alertsAsked', true); syncAlertUI(); checkAlerts();
};
$('#alertLater').onclick = () => { store.set('alertsAsked', true); syncAlertUI(); };
syncAlertUI();

/* ---------- Start ---------- */
applyTheme(); applyLang(); load();
