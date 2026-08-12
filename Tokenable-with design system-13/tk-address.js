/* tk-address.js — Google Places address search for every screen that collects
   an address (PSA return address, Redeem delivery, Partner shipping origin,
   P2P seller origin, Settings address book).

   Pattern: one search line. Picking a suggestion reveals the detail fields,
   already filled, plus a map preview to confirm against.

   Live wiring: drop in the Places JS API and replace `predict()` /`details()`
   with AutocompleteSuggestion + Place.fetchFields. Everything else — markup,
   states, validation — stays as-is.
     <script src="https://maps.googleapis.com/maps/api/js?key=KEY&libraries=places&v=weekly">

   Mount:
     TKAddress.mount('#host', {
       tone: 'dark' | 'light',
       label: 'Delivery address',
       fields: { line1:'#ad-street', line2:'#ad-apt', city:'#ad-city',
                 state:'#ad-state', zip:'#ad-zip', country:'#wd-country' },
       details: '#address-details',        // revealed once a place is picked
       saved: [{id,tag,name,line}],        // address book, optional
       defaultCheckbox: true
     });
*/
(function(){
if(window.TKAddress) return;

/* ---------- Mock index (Places Autocomplete stand-in) ---------- */
var PLACES = [
  { id:'p1', main:'1600 Pennsylvania Avenue NW', sec:'Washington, DC 20500, USA',
    line1:'1600 Pennsylvania Avenue NW', city:'Washington', state:'DC', zip:'20500', country:'us', cc:'US' },
  { id:'p2', main:'350 Fifth Avenue', sec:'New York, NY 10118, USA',
    line1:'350 Fifth Avenue', city:'New York', state:'NY', zip:'10118', country:'us', cc:'US' },
  { id:'p3', main:'1 Apple Park Way', sec:'Cupertino, CA 95014, USA',
    line1:'1 Apple Park Way', city:'Cupertino', state:'CA', zip:'95014', country:'us', cc:'US' },
  { id:'p4', main:'221B Baker Street', sec:'London NW1 6XE, United Kingdom',
    line1:'221B Baker Street', city:'London', state:'Greater London', zip:'NW1 6XE', country:'gb', cc:'GB' },
  { id:'p5', main:'1 Chome-1-2 Oshiage', sec:'Sumida City, Tokyo 131-0045, Japan',
    line1:'1 Chome-1-2 Oshiage', city:'Sumida City', state:'Tokyo', zip:'131-0045', country:'jp', cc:'JP' },
  { id:'p6', main:'29 Seolleung-ro 152-gil', sec:'Gangnam-gu, Seoul 06021, South Korea',
    line1:'29 Seolleung-ro 152-gil', city:'Gangnam-gu', state:'Seoul', zip:'06021', country:'kr', cc:'KR' },
  { id:'p7', main:'Friedrichstraße 43', sec:'10117 Berlin, Germany',
    line1:'Friedrichstraße 43', city:'Berlin', state:'Berlin', zip:'10117', country:'de', cc:'DE' },
  { id:'p8', main:'Sukhumvit Road 199', sec:'Khlong Toei, Bangkok 10110, Thailand',
    line1:'Sukhumvit Road 199', city:'Bangkok', state:'Krung Thep', zip:'10110', country:'th', cc:'TH', blocked:true }
];
/* Vaulted goods can't be insured into these — Places returns them, we refuse them. */
var UNDELIVERABLE = { TH:'Thailand', RU:'Russia', BY:'Belarus' };

/* ---------- Country rules ----------
   One table for every screen that takes an address, so a postal code is
   judged the same way in Redeem, PSA intake, the partner modal and Settings. */
var RULES = {
  us:   { name:'United States', postal:/^\d{5}(-\d{4})?$/, postalEg:'94103', region:'State', phone:[10], dial:'1', trunk:false },
  ca:   { name:'Canada', postal:/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, postalEg:'M5V 2T6', region:'Province', phone:[10], dial:'1', trunk:false },
  gb:   { name:'United Kingdom', postal:/^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/, postalEg:'NW1 6XE', region:'County', phone:[10,11], dial:'44', trunk:true },
  de:   { name:'Germany', postal:/^\d{5}$/, postalEg:'10117', region:'State', phone:[10,11], dial:'49', trunk:true },
  fr:   { name:'France', postal:/^\d{5}$/, postalEg:'75008', region:'Region', phone:[9], dial:'33', trunk:true },
  nl:   { name:'Netherlands', postal:/^\d{4} ?[A-Za-z]{2}$/, postalEg:'1012 AB', region:'Province', phone:[9], dial:'31', trunk:true },
  jp:   { name:'Japan', postal:/^\d{3}-?\d{4}$/, postalEg:'131-0045', region:'Prefecture', phone:[10,11], dial:'81', trunk:true },
  kr:   { name:'South Korea', postal:/^\d{5}$/, postalEg:'06021', region:'Province or city', phone:[9,10], dial:'82', trunk:true },
  au:   { name:'Australia', postal:/^\d{4}$/, postalEg:'2000', region:'State', phone:[9], dial:'61', trunk:true },
  sg:   { name:'Singapore', postal:/^\d{6}$/, postalEg:'238859', region:'Region', phone:[8], dial:'65', trunk:false },
  intl: { name:'International', postal:/^[A-Za-z0-9][A-Za-z0-9 -]{2,11}$/, postalEg:'', region:'State or region', phone:[6,7,8,9,10,11,12,13,14,15] }
};
function rule(cc){ return RULES[String(cc || '').toLowerCase()] || RULES.intl; }

/* People paste phone numbers however they hold them — +82 10…, 0082…, 010…,
   or the bare national number. Judge the national digits, not the keystrokes. */
function phoneOk(raw, R){
  var d = String(raw).replace(/[^\d]/g, '');
  if(!d) return false;
  var cands = [d];
  var push = function(v){ if(v && cands.indexOf(v) < 0) cands.push(v); };
  if(d.indexOf('00') === 0) push(d.slice(2));
  cands.slice().forEach(function(v){
    if(R.dial && v.indexOf(R.dial) === 0) push(v.slice(R.dial.length));
  });
  // North American numbers have no trunk prefix, so a leading 0 is not slack —
  // stripping it let foreign national numbers pass as US ones.
  if(R.trunk) cands.slice().forEach(function(v){ if(v.charAt(0) === '0') push(v.slice(1)); });
  for(var i = 0; i < cands.length; i++){
    if(R.phone.indexOf(cands[i].length) >= 0) return true;
  }
  return false;
}

/* Validate a bound field set. Only fields that exist are judged.
   Returns { ok, errors:[{sel,msg}], rule }. */
function validate(fields, opts){
  opts = opts || {};
  fields = fields || {};
  var errors = [];
  var get = function(sel){ var e = sel && document.querySelector(sel); return e ? String(e.value || '').trim() : null; };
  var cc = opts.country || get(fields.country) || 'intl';
  var R = rule(cc);

  var line1 = get(fields.line1);
  if(line1 !== null && line1.length < 4) errors.push({ sel:fields.line1, msg:'Enter a street address' });

  var city = get(fields.city);
  if(city !== null && city.length < 2) errors.push({ sel:fields.city, msg:'Enter a city' });

  var region = get(fields.state);
  if(region !== null && !region) errors.push({ sel:fields.state, msg:'Enter a ' + R.region.toLowerCase() });

  var zip = get(fields.zip);
  if(zip !== null && !R.postal.test(zip)){
    errors.push({ sel:fields.zip, msg: R.postalEg
      ? 'Enter a valid ' + R.name + ' postal code (e.g. ' + R.postalEg + ')'
      : 'Enter a valid postal code' });
  }

  var phone = get(fields.phone);
  if(phone !== null){
    if(!phoneOk(phone, R)){
      errors.push({ sel:fields.phone, msg:'Enter a valid ' +
        (R.phone.length === 1 ? R.phone[0] + '-digit ' : '') + 'phone number for ' + R.name });
    }
  }

  var nm = get(fields.name);
  if(nm !== null && nm.length < 2) errors.push({ sel:fields.name, msg:'Enter a name' });

  var blocked = UNDELIVERABLE[String(cc).toUpperCase()];
  if(blocked) errors.push({ sel:fields.country, msg:'We can\u2019t ship an insured vault package to ' + blocked });

  return { ok: errors.length === 0, errors: errors, rule: R };
}

/* Paint or clear the inline message next to each bound field. */
function paint(fields, result){
  Object.keys(fields || {}).forEach(function(k){
    var sel = fields[k];
    var el = sel && document.querySelector(sel);
    if(!el || !el.parentElement) return;
    var hit = result.errors.filter(function(e){ return e.sel === sel; })[0];
    el.classList.toggle('tka-bad', !!hit);
    // Reuse the message slot a page already owns, otherwise mint one.
    var key = el.id || sel;
    var page = el.id && document.querySelector('.fld-err[data-for="' + el.id + '"], .po-err[data-for="' + el.id + '"]');
    if(page){
      page.classList.toggle('on', !!hit);
      if(hit) page.textContent = hit.msg;
      return;
    }
    // Scope the slot to this field — a container-level input (a hidden country
    // field, say) must not claim a sibling's message.
    var own = el.parentElement.querySelector('.tka-err[data-tka-for="' + key + '"]');
    if(hit && !own){
      own = document.createElement('span');
      own.className = 'tka-err';
      own.setAttribute('data-tka-for', key);
      el.parentElement.appendChild(own);
    }
    if(own){ own.textContent = hit ? hit.msg : ''; own.style.display = hit ? 'block' : 'none'; }
  });
}

function predict(q){
  var s = q.trim().toLowerCase();
  if(!s) return [];
  return PLACES.filter(function(p){
    return (p.main+' '+p.sec).toLowerCase().indexOf(s) >= 0;
  }).slice(0, 5);
}
function esc(v){ return String(v == null ? '' : v).replace(/[&<>"]/g, function(c){
  return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function mark(text, q){
  var i = text.toLowerCase().indexOf(q.trim().toLowerCase());
  if(q.trim() === '' || i < 0) return esc(text);
  return esc(text.slice(0,i)) + '<b>' + esc(text.slice(i, i+q.trim().length)) + '</b>' + esc(text.slice(i+q.trim().length));
}

/* ---------- Styles ---------- */
var CSS = [
'.tka{position:relative;display:block;}',
'.tka{--tka-surface:#141414;--tka-surface-2:#191919;--tka-line:rgba(255,255,255,0.08);--tka-line-2:rgba(255,255,255,0.14);--tka-text:#fff;--tka-t2:rgba(255,255,255,0.6);--tka-t3:rgba(255,255,255,0.38);--tka-hover:rgba(255,255,255,0.05);}',
'.tka[data-tone="light"]{--tka-surface:#fff;--tka-surface-2:#F5F5F7;--tka-line:rgba(17,17,17,0.1);--tka-line-2:rgba(17,17,17,0.18);--tka-text:#18181B;--tka-t2:rgba(17,17,17,0.6);--tka-t3:rgba(17,17,17,0.42);--tka-hover:rgba(17,17,17,0.04);}',
'.tka__label{font-family:var(--font-mono);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--tka-t2);font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:8px;}',
'.tka__label .tka__link{margin-left:auto;}',
'.tka__field{position:relative;display:flex;align-items:center;}',
'.tka__ic{position:absolute;left:16px;display:flex;color:var(--tka-t3);pointer-events:none;}',
'.tka__input{width:100%;height:50px;padding:0 44px 0 44px;background:var(--tka-surface);border:1px solid var(--tka-line);border-radius:12px;color:var(--tka-text);font-family:var(--font-sans);font-size:15px;outline:none;transition:border-color 120ms steps(2),box-shadow 120ms steps(2);box-sizing:border-box;}',
'.tka__input::placeholder{color:var(--tka-t3);}',
'.tka__input:focus{border-color:var(--azure);box-shadow:0 0 0 3px rgba(26,111,255,0.15);}',
'.tka__clear{position:absolute;right:10px;width:28px;height:28px;display:none;align-items:center;justify-content:center;border:0;background:transparent;color:var(--tka-t3);cursor:pointer;border-radius:8px;}',
'.tka__clear:hover{background:var(--tka-hover);color:var(--tka-text);}',
'.tka.is-typing .tka__clear{display:flex;}',
'.tka__panel{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:40;background:var(--tka-surface-2);border:1px solid var(--tka-line);border-radius:12px;overflow:hidden;display:none;box-shadow:0 18px 44px rgba(0,0,0,0.45);}',
'.tka.is-open .tka__panel{display:block;}',
'.tka__row{display:flex;align-items:flex-start;gap:12px;width:100%;padding:12px 16px;background:transparent;border:0;text-align:left;cursor:pointer;color:var(--tka-text);font-family:var(--font-sans);}',
'.tka__row + .tka__row{border-top:1px solid var(--tka-line);}',
'.tka__row:hover,.tka__row.is-active{background:var(--tka-hover);}',
'.tka__pin{flex:0 0 auto;margin-top:2px;color:var(--tka-t3);display:flex;}',
'.tka__main{font-size:14.5px;font-weight:500;line-height:1.35;}',
'.tka__main b{font-weight:700;color:var(--azure);}',
'.tka__sec{font-size:12.5px;color:var(--tka-t2);line-height:1.4;margin-top:2px;}',
'.tka__none{padding:18px 16px;font-size:13.5px;color:var(--tka-t2);line-height:1.55;}',
'.tka__attr{display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:8px 14px;border-top:1px solid var(--tka-line);font-family:var(--font-mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--tka-t3);}',
'.tka__link{background:transparent;border:0;padding:0;cursor:pointer;color:var(--azure);font-family:var(--font-mono);font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;}',
'.tka__link:hover{text-decoration:underline;}',
'.tka__saved{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}',
'.tka__chip{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;background:var(--tka-surface);border:1px solid var(--tka-line);border-radius:10px;cursor:pointer;color:var(--tka-text);font-family:var(--font-sans);font-size:13px;transition:border-color 120ms steps(2),transform 120ms steps(2);}',
'.tka__chip:hover{border-color:var(--tka-line-2);transform:translate(-1px,-1px);}',
'.tka__chip i{font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--azure);font-style:normal;}',
'.tka__chip span{color:var(--tka-t2);}',
'.tka__picked{display:none;gap:14px;margin-top:12px;padding:14px;background:var(--tka-surface-2);border:1px solid var(--tka-line);border-radius:14px;}',
'.tka.is-picked .tka__picked{display:flex;}',
'.tka.is-picked .tka__field,.tka.is-picked .tka__saved{display:none;}',
'.tka__map{flex:0 0 108px;height:108px;border-radius:10px;overflow:hidden;position:relative;background:var(--tka-surface);}',
'.tka__mapimg{width:100%;height:100%;object-fit:cover;display:block;}',
'.tka__mapfb{position:absolute;inset:0;background-color:#12141c;background-image:linear-gradient(rgba(255,255,255,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.055) 1px,transparent 1px),linear-gradient(115deg,transparent 46%,rgba(255,255,255,0.10) 46%,rgba(255,255,255,0.10) 52%,transparent 52%);background-size:18px 18px,18px 18px,100% 100%;}',
'.tka[data-tone="light"] .tka__mapfb{background-color:#E8EAF0;background-image:linear-gradient(rgba(17,17,17,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(17,17,17,0.07) 1px,transparent 1px),linear-gradient(115deg,transparent 46%,rgba(17,17,17,0.12) 46%,rgba(17,17,17,0.12) 52%,transparent 52%);}',
'.tka__dot{position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--azure);box-shadow:0 0 0 4px rgba(26,111,255,0.28);}',
'.tka__pickedbody{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}',
'.tka__pickedtitle{font-size:15px;font-weight:600;color:var(--tka-text);line-height:1.35;}',
'.tka__pickedsub{font-size:13px;color:var(--tka-t2);line-height:1.5;}',
'.tka__pickedact{display:flex;gap:14px;margin-top:6px;}',
'.tka__verified{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--pos,rgb(0,200,100));}',
'.tka__warn{display:none;gap:11px;margin-top:12px;padding:13px 15px;border-radius:12px;background:rgba(228,55,74,0.10);border:1px solid rgba(228,55,74,0.28);}',
'.tka.is-blocked .tka__warn{display:flex;}',
'.tka.is-blocked .tka__verified{display:none;}',
'.tka__warnt{font-size:13px;line-height:1.5;color:#FF6B7A;}',
'.tka__warnt b{color:#FF8A96;}',
'.tka__unit{display:none;margin-top:14px;}',
'.tka.is-picked .tka__unit{display:block;}',
'.tka__save{display:none;align-items:flex-start;gap:10px;margin-top:14px;cursor:pointer;}',
'.tka.is-picked .tka__save{display:flex;}',
'.tka__box{flex:0 0 auto;width:18px;height:18px;margin-top:1px;border-radius:5px;border:1px solid var(--tka-line-2);background:var(--tka-surface);display:flex;align-items:center;justify-content:center;color:transparent;}',
'.tka__save.on .tka__box{background:var(--azure);border-color:var(--azure);color:#fff;}',
'.tka__savet{font-size:13.5px;color:var(--tka-t2);line-height:1.45;}',
'.tka-bad{border-color:rgba(228,55,74,0.75)!important;box-shadow:0 0 0 3px rgba(228,55,74,0.14)!important;}',
'.tka-err{display:block;font-size:12.5px;color:#FF6B7A;margin-top:7px;line-height:1.45;}'
].join('\n');

function injectCSS(){
  if(document.getElementById('tka-css')) return;
  var s = document.createElement('style');
  s.id = 'tka-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

var IC = {
  search:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>',
  pin:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  x:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  check:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2"><polyline points="20 6 9 17 4 12"/></svg>',
  alert:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FF6B7A" stroke-width="2.2" style="flex:0 0 auto;margin-top:1px;"><circle cx="12" cy="12" r="9"/><line x1="12" y1="7.5" x2="12" y2="13"/><circle cx="12" cy="16.5" r="0.9" fill="#FF6B7A"/></svg>',
  google:'<svg width="12" height="12" viewBox="0 0 48 48"><path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-3.9H24v7.1h12c-.2 1.9-1.5 4.7-4.4 6.6l6.7 5.2C42.3 35.3 45 30.1 45 24z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 40.5 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 9.9l7.1-5.5z"/><path fill="#EA4335" d="M24 10.7c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.5 29.9 2 24 2 15.4 2 8 7.5 4.4 14.1l7.1 5.5C13.3 14.5 18.2 10.7 24 10.7z"/></svg>'
};

function mount(host, opt){
  injectCSS();
  // Hosts inside a Design Component are painted by the runtime and can be
  // replaced while the template streams, so a selector is re-checked on a
  // timer and the block is rebuilt whenever its host comes back empty.
  if(typeof host === 'string'){
    var sel = host, handle = {};
    var sync = function(){
      var e = document.querySelector(sel);
      if(!e || e.querySelector('.tka')) return;
      var a = build(e, opt);
      if(a){ handle.root = a.root; handle.reset = a.reset; handle.pick = a.pick; handle.validate = a.validate; handle.rule = a.rule; }
    };
    sync();
    setInterval(sync, 250);
    return handle;
  }
  return build(host, opt);
}

function build(host, opt){
  injectCSS();
  if(!host || host.querySelector('.tka')) return null;
  opt = opt || {};
  var fields = opt.fields || {};
  var saved = opt.saved || [];
  var details = opt.details ? document.querySelector(opt.details) : null;
  if(details) details.style.display = 'none';
  // The block owns the unit line, so the duplicate row inside the detail
  // fields is folded away rather than asked twice.
  (opt.hideFields || []).forEach(function(sel){
    var el = document.querySelector(sel);
    if(el && el.parentElement) el.parentElement.style.display = 'none';
  });

  var root = document.createElement('div');
  root.className = 'tka';
  root.setAttribute('data-tone', opt.tone || 'dark');
  root.innerHTML =
    '<div class="tka__label">' + esc(opt.label || 'Address') +
      '<button type="button" class="tka__link" data-tka="manual">Enter manually</button></div>' +
    '<div class="tka__field">' +
      '<span class="tka__ic">' + IC.search + '</span>' +
      '<input class="tka__input" type="text" autocomplete="off" spellcheck="false" placeholder="' +
        esc(opt.placeholder || 'Start typing an address\u2026') + '">' +
      '<button type="button" class="tka__clear" aria-label="Clear">' + IC.x + '</button>' +
    '</div>' +
    (saved.length
      ? '<div class="tka__saved">' + saved.map(function(s){
          return '<button type="button" class="tka__chip" data-tka-saved="' + esc(s.id) + '">' +
            '<i>' + esc(s.tag) + '</i>' + esc(s.name) + ' <span>' + esc(s.line) + '</span></button>';
        }).join('') + '</div>'
      : '') +
    '<div class="tka__panel"></div>' +
    '<div class="tka__picked">' +
      '<div class="tka__map"><div class="tka__mapfb"></div><div class="tka__dot"></div></div>' +
      '<div class="tka__pickedbody">' +
        '<span class="tka__verified">' + IC.check + ' Verified by Google</span>' +
        '<div class="tka__pickedtitle"></div>' +
        '<div class="tka__pickedsub"></div>' +
        '<div class="tka__pickedact">' +
          '<button type="button" class="tka__link" data-tka="change">Use a different address</button>' +
          '<button type="button" class="tka__link" data-tka="manual">Edit fields</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="tka__warn">' + IC.alert +
      '<div class="tka__warnt"></div></div>' +
    '<div class="tka__unit">' +
      '<div class="tka__label" style="margin-bottom:8px;">Apt, suite, unit</div>' +
      '<input class="tka__input" type="text" style="padding-left:16px;" placeholder="Apt 4B \u00b7 Unit 210 \u00b7 c/o" data-tka="unit">' +
    '</div>' +
    (opt.defaultCheckbox === false ? '' :
      '<label class="tka__save"><span class="tka__box">' + IC.check + '</span>' +
      '<span class="tka__savet">' + esc(opt.saveLabel || 'Save as my default address') + '</span></label>');
  host.appendChild(root);

  var input = root.querySelector('.tka__input');
  var panel = root.querySelector('.tka__panel');
  var q = '';

  function renderPanel(){
    var rows = predict(q);
    if(!q.trim()){ root.classList.remove('is-open'); return; }
    panel.innerHTML = (rows.length
      ? rows.map(function(p){
          return '<button type="button" class="tka__row" data-tka-place="' + p.id + '">' +
            '<span class="tka__pin">' + IC.pin + '</span><span>' +
            '<span class="tka__main">' + mark(p.main, q) + '</span>' +
            '<span class="tka__sec" style="display:block;">' + esc(p.sec) + '</span></span></button>';
        }).join('')
      : '<div class="tka__none">No address matches \u201c' + esc(q) + '\u201d.<br>' +
        'Check the spelling, or <button type="button" class="tka__link" data-tka="manual">enter it manually</button>.</div>')
      + '<div class="tka__attr">' + IC.google + ' Powered by Google</div>';
    root.classList.add('is-open');
  }

  function fill(sel, v){
    var el = sel && document.querySelector(sel);
    if(!el) return;
    if(el.tagName === 'SELECT'){
      // Country selects are often short lists — fall back to the catch-all option.
      var opts = [].slice.call(el.options).map(function(o){ return o.value; });
      if(opts.indexOf(v) < 0){
        var alt = ['intl','international','other','row'].filter(function(x){ return opts.indexOf(x) >= 0; })[0];
        v = alt || el.value;
      }
    }
    el.value = v == null ? '' : v;
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function pick(p){
    root.classList.remove('is-open');
    root.classList.add('is-picked');
    root.classList.toggle('is-blocked', !!UNDELIVERABLE[p.cc]);
    root.querySelector('.tka__pickedtitle').textContent = p.main;
    root.querySelector('.tka__pickedsub').textContent = p.sec;
    if(UNDELIVERABLE[p.cc]){
      root.querySelector('.tka__warnt').innerHTML =
        'We can\u2019t ship an insured vault package to <b>' + esc(UNDELIVERABLE[p.cc]) +
        '</b>. Pick another destination, or contact support about a forwarding agent.';
    }
    fill(fields.line1, p.line1); fill(fields.city, p.city);
    fill(fields.state, p.state); fill(fields.zip, p.zip); fill(fields.country, p.country);
    if(details) details.style.display = '';
    if(typeof opt.onSelect === 'function') opt.onSelect(p, root);
  }

  function reset(){
    root.classList.remove('is-picked','is-blocked','is-typing','is-open');
    input.value = ''; q = '';
    if(details) details.style.display = 'none';
    input.focus();
  }

  input.addEventListener('input', function(){
    q = input.value;
    root.classList.toggle('is-typing', !!q);
    renderPanel();
  });
  input.addEventListener('focus', function(){ if(q) renderPanel(); });

  root.addEventListener('click', function(e){
    var t = e.target;
    if(t.closest('.tka__clear')){ reset(); return; }
    var row = t.closest('[data-tka-place]');
    if(row){ pick(PLACES.filter(function(p){ return p.id === row.getAttribute('data-tka-place'); })[0]); return; }
    var chip = t.closest('[data-tka-saved]');
    if(chip){
      var s = saved.filter(function(x){ return x.id === chip.getAttribute('data-tka-saved'); })[0];
      if(s) pick({ main:s.name, sec:s.line, line1:s.line1, city:s.city, state:s.state, zip:s.zip, country:s.country, cc:s.cc });
      return;
    }
    var act = t.closest('[data-tka]') && t.closest('[data-tka]').getAttribute('data-tka');
    if(act === 'change'){ reset(); return; }
    if(act === 'manual'){
      root.classList.remove('is-open');
      if(details){ details.style.display = ''; var f = details.querySelector('input,select'); if(f) f.focus(); }
      return;
    }
    var box = t.closest('.tka__save');
    if(box){ box.classList.toggle('on'); return; }
  });

  root.querySelector('[data-tka="unit"]').addEventListener('input', function(){
    fill(fields.line2, this.value);
  });

  /* ---- Validation on the revealed detail fields ---- */
  function check(){
    var r = validate(fields, {});
    paint(fields, r);
    return r.ok;
  }
  function checkOne(el){
    // Judge the whole set on blur; typing is handled by the input handler below,
    // which clears a field's message rather than scolding mid-keystroke.
    var r = validate(fields, {});
    paint(fields, r);
    return r.ok;
  }
  var bound = Object.keys(fields).map(function(k){ return fields[k]; }).filter(Boolean);
  document.addEventListener('focusout', function(e){
    if(!e.target.matches) return;
    if(bound.some(function(s){ return e.target.matches(s); })) checkOne(e.target);
  });
  document.addEventListener('input', function(e){
    if(!e.target.matches || !bound.some(function(s){ return e.target.matches(s); })) return;
    e.target.classList.remove('tka-bad');
    var slot = e.target.parentElement &&
      e.target.parentElement.querySelector('.tka-err[data-tka-for="' + (e.target.id || '') + '"]');
    if(slot) slot.style.display = 'none';
  });
  document.addEventListener('change', function(e){
    if(fields.country && e.target.matches && e.target.matches(fields.country)) check();
  });

  document.addEventListener('click', function(e){
    if(!root.contains(e.target)) root.classList.remove('is-open');
  });

  var api = { root:root, reset:reset, pick:pick, validate:check, rule:function(){
    var el = fields.country && document.querySelector(fields.country);
    return rule(el ? el.value : 'intl');
  } };
  INSTANCES.push(api);
  return api;
}

var INSTANCES = [];
function validateAll(){
  return INSTANCES.reduce(function(ok, a){ return (a.validate ? a.validate() : true) && ok; }, true);
}

window.TKAddress = { mount:mount, PLACES:PLACES, UNDELIVERABLE:UNDELIVERABLE,
  RULES:RULES, rule:rule, validate:validate, paint:paint, validateAll:validateAll,
  instances:INSTANCES };
})();
