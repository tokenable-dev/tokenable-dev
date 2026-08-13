/* tk-price-input.js — the shared price input used by "Set price" (sell flow)
   and "Edit price" (listing modal). Same references, same quick adjust, same
   fee math; only the CTA and surrounding context differ.

   Usage:
     el.innerHTML = TKPrice.html({ ns:'p1', tone:'light',
       market: 58000, lowestAsk: 56200, lastSold: 54500, value: 0 });
     TKPrice.mount('p1', { onChange: function(v){ … } });

   Read the current value any time with TKPrice.value('p1').
   Push a new lowest ask (it is a live number) with TKPrice.setLowest('p1', v).
*/
(function(){
if(window.TKPrice) return;

var FEE_PCT = 5;
var STATE = {};

function money(n){ return '$' + Math.round(n || 0).toLocaleString('en-US'); }
function num(v){ return parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10) || 0; }
function group(n){ return (n || 0).toLocaleString('en-US'); }

function tones(tone){
  return tone === 'light' ? {
    text:'#18181B', t2:'rgba(17,17,17,0.6)', t3:'rgba(17,17,17,0.4)',
    surface:'#F5F5F7', line:'rgba(17,17,17,0.08)', field:'#FFFFFF',
    fieldEdge:'inset 0 0 0 1.5px rgba(17,17,17,0.14)', chip:'rgba(17,17,17,0.05)',
    chipHover:'rgba(17,17,17,0.09)'
  } : {
    text:'#FFFFFF', t2:'rgba(255,255,255,0.6)', t3:'rgba(255,255,255,0.4)',
    surface:'rgba(255,255,255,0.04)', line:'rgba(255,255,255,0.08)', field:'rgba(255,255,255,0.06)',
    fieldEdge:'inset 0 0 0 1.5px rgba(255,255,255,0.12)', chip:'rgba(255,255,255,0.07)',
    chipHover:'rgba(255,255,255,0.13)'
  };
}

var MONO = 'font-family:var(--font-mono),ui-monospace,Menlo,monospace;';
var LABEL = 'font-family:var(--font-mono),ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;';

function refRow(ns, C, key, label, value, extra){
  if(!value) return '';
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;">'
    + '<span style="display:flex;align-items:center;gap:7px;' + LABEL + 'color:' + C.t2 + ';">' + label + (extra || '') + '</span>'
    + '<span style="display:flex;align-items:center;gap:10px;">'
    +   '<span data-ref="' + key + '" style="' + MONO + 'font-size:15px;font-weight:700;color:' + C.text + ';">' + money(value) + '</span>'
    +   '<button type="button" data-use="' + key + '" style="border:0;background:' + C.chip + ';color:var(--azure,#1A6FFF);'
    +     'font-family:var(--font-sans),Inter,sans-serif;font-size:12px;font-weight:700;height:28px;padding:0 12px;border-radius:7px;cursor:pointer;">Use</button>'
    + '</span></div>';
}

var LIVE_DOT = '<span style="display:inline-flex;align-items:center;gap:5px;">'
  + '<span style="width:6px;height:6px;border-radius:50%;background:var(--pos,#00C864);"></span>live</span>';

function html(o){
  o = o || {};
  var ns = o.ns || 'p';
  var C = tones(o.tone);
  var market = o.market || 0, lowest = o.lowestAsk || 0, last = o.lastSold || 0;
  STATE[ns] = {
    ns:ns, tone:o.tone, market:market, lowest:lowest, last:last,
    fee:(o.feePct == null ? FEE_PCT : o.feePct), min:o.min || 0,
    base:'market', pick:null, onChange:null
  };
  var v = o.value || 0;

  var refs = refRow(ns, C, 'market', 'Market value', market)
    + refRow(ns, C, 'lowest', 'Lowest ask', lowest, ' &middot; ' + LIVE_DOT)
    + refRow(ns, C, 'last', 'Last sold', last);

  var chips = ['-20', '-10', '0', '10', '20'].map(function(p){
    var lbl = p === '0' ? 'Market' : (p > 0 ? '+' + p + '%' : p + '%');
    return '<button type="button" data-adj="' + p + '" style="flex:1;min-width:58px;border:0;background:' + C.chip + ';color:' + C.text + ';'
      + 'font-family:var(--font-sans),Inter,sans-serif;font-size:13px;font-weight:600;height:36px;border-radius:8px;cursor:pointer;">' + lbl + '</button>';
  }).join('');

  return '<div data-tkprice="' + ns + '">'
    + (refs ? '<div style="background:' + C.surface + ';border-radius:12px;padding:4px 14px;margin-bottom:16px;">' + refs + '</div>' : '')

    + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px;">'
    +   '<span style="' + LABEL + 'color:' + C.t2 + ';">Your price</span>'
    +   (lowest ? '<button type="button" data-base-toggle="1" style="border:0;background:transparent;color:var(--azure,#1A6FFF);'
    +     'font-family:var(--font-sans),Inter,sans-serif;font-size:12px;font-weight:600;cursor:pointer;padding:0;">Base: <span data-base-label>Market value</span></button>' : '')
    + '</div>'

    + '<div style="position:relative;margin-bottom:10px;">'
    +   '<span style="position:absolute;left:16px;top:50%;transform:translateY(-50%);' + MONO + 'font-size:17px;color:' + C.t3 + ';">$</span>'
    +   '<input data-price type="text" inputmode="numeric" autocomplete="off" placeholder="0" value="' + (v ? group(v) : '') + '" '
    +     'style="width:100%;height:56px;padding:0 16px 0 32px;background:' + C.field + ';border:0;border-radius:12px;box-shadow:' + C.fieldEdge + ';'
    +     'color:' + C.text + ';' + MONO + 'font-size:20px;font-weight:700;outline:none;">'
    + '</div>'

    + '<div style="display:flex;gap:6px;margin-bottom:8px;">' + chips + '</div>'
    + (lowest ? '<button type="button" data-undercut style="width:100%;border:0;background:' + C.chip + ';color:' + C.text + ';'
      + 'font-family:var(--font-sans),Inter,sans-serif;font-size:13px;font-weight:600;height:36px;border-radius:8px;cursor:pointer;margin-bottom:8px;">'
      + 'Undercut lowest ask &mdash; <span data-undercut-val style="' + MONO + 'font-weight:700;">' + money(Math.max(1, lowest - 1)) + '</span></button>' : '')
    + '<div data-basenote style="font-size:11.5px;color:' + C.t3 + ';line-height:1.5;margin-bottom:14px;"></div>'

    + '<div data-hint style="display:none;font-size:12.5px;line-height:1.5;margin-bottom:14px;padding:10px 12px;border-radius:9px;"></div>'

    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid ' + C.line + ';">'
    +   '<span style="' + LABEL + 'color:' + C.t2 + ';">Platform fee (' + STATE[ns].fee + '%)</span>'
    +   '<span data-fee style="' + MONO + 'font-size:13px;color:' + C.t2 + ';">&minus;$0</span>'
    + '</div>'
    + '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:10px 0 0;border-top:1px solid ' + C.line + ';">'
    +   '<span style="' + LABEL + 'color:' + C.text + ';">You receive</span>'
    +   '<span data-net style="' + MONO + 'font-size:22px;font-weight:700;color:var(--pos,#00C864);">$0</span>'
    + '</div>'
  + '</div>';
}

function root(ns){ return document.querySelector('[data-tkprice="' + ns + '"]'); }

function paint(ns){
  var S = STATE[ns], el = root(ns);
  if(!S || !el) return;
  var C = tones(S.tone);
  var input = el.querySelector('[data-price]');
  var v = num(input && input.value);

  var fee = Math.round(v * S.fee / 100);
  var f = el.querySelector('[data-fee]'), n = el.querySelector('[data-net]');
  if(f) f.textContent = '\u2212' + money(fee);
  if(n) n.textContent = money(v - fee);

  var baseVal = S.base === 'lowest' ? S.lowest : S.market;
  var baseName = S.base === 'lowest' ? 'lowest ask' : 'market value';
  var lbl = el.querySelector('[data-base-label]');
  if(lbl) lbl.textContent = S.base === 'lowest' ? 'Lowest ask' : 'Market value';
  var note = el.querySelector('[data-basenote]');
  if(note) note.textContent = baseVal ? '\u00b1 relative to ' + baseName + ' (' + money(baseVal) + ')' : '';

  el.querySelectorAll('[data-adj]').forEach(function(b){
    var on = S.pick === b.getAttribute('data-adj');
    b.style.background = on ? 'var(--azure,#1A6FFF)' : C.chip;
    b.style.color = on ? '#fff' : C.text;
  });

  // Non-blocking read on where the price sits — sellers mis-price by a lot far
  // more often than by a little.
  var hint = el.querySelector('[data-hint]');
  if(hint){
    var msg = '', good = false;
    if(v > 0 && S.market && v > S.market * 1.25){ msg = 'Well above market value \u2014 this may sit unsold.'; }
    else if(v > 0 && S.market && v < S.market * 0.7){ msg = 'Well below market value \u2014 you\u2019d be leaving money on the table.'; }
    else if(v > 0 && S.lowest && v < S.lowest){ msg = 'You\u2019d be the lowest ask.'; good = true; }
    if(msg){
      hint.style.display = 'block';
      hint.textContent = msg;
      hint.style.background = good ? 'rgba(0,200,100,0.10)' : 'rgba(234,130,0,0.10)';
      hint.style.color = good ? 'var(--pos,#00C864)' : '#EA8200';
    } else hint.style.display = 'none';
  }

  if(typeof S.onChange === 'function') S.onChange(v);
}

function setValue(ns, v, keepPick){
  var el = root(ns); if(!el) return;
  var input = el.querySelector('[data-price]');
  if(input) input.value = v ? group(v) : '';
  if(!keepPick) STATE[ns].pick = null;
  paint(ns);
}

function mount(ns, opts){
  opts = opts || {};
  var S = STATE[ns], el = root(ns);
  if(!S || !el) return null;
  S.onChange = opts.onChange || null;
  if(opts.min != null) S.min = opts.min;

  var input = el.querySelector('[data-price]');
  input.addEventListener('input', function(){
    var v = num(input.value);
    input.value = v ? group(v) : '';
    S.pick = null;
    paint(ns);
  });

  el.addEventListener('click', function(e){
    var t = e.target;
    var use = t.closest('[data-use]');
    if(use){
      var k = use.getAttribute('data-use');
      setValue(ns, k === 'market' ? S.market : k === 'lowest' ? S.lowest : S.last);
      input.focus(); e.preventDefault(); return;
    }
    var adj = t.closest('[data-adj]');
    if(adj){
      var p = +adj.getAttribute('data-adj');
      var base = S.base === 'lowest' ? S.lowest : S.market;
      if(!base) return;
      S.pick = adj.getAttribute('data-adj');
      setValue(ns, Math.round(base * (1 + p / 100)), true);
      e.preventDefault(); return;
    }
    if(t.closest('[data-base-toggle]')){
      S.base = S.base === 'lowest' ? 'market' : 'lowest';
      S.pick = null;
      paint(ns); e.preventDefault(); return;
    }
    if(t.closest('[data-undercut]')){
      setValue(ns, Math.max(1, S.lowest - 1));
      input.focus(); e.preventDefault(); return;
    }
  });

  if(opts.autofocus !== false) setTimeout(function(){ input.focus(); input.select(); }, 40);
  paint(ns);
  return { value:function(){ return num(input.value); } };
}

window.TKPrice = {
  html: html,
  mount: mount,
  value: function(ns){ var el = root(ns); var i = el && el.querySelector('[data-price]'); return num(i && i.value); },
  set: setValue,
  setLowest: function(ns, v){
    var S = STATE[ns], el = root(ns);
    if(!S || !el) return;
    S.lowest = v;
    var r = el.querySelector('[data-ref="lowest"]'); if(r) r.textContent = money(v);
    var u = el.querySelector('[data-undercut-val]'); if(u) u.textContent = money(Math.max(1, v - 1));
    paint(ns);
  }
};
})();
