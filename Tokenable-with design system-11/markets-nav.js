/* markets-nav.js — Markets scalable navigation & filters.
   Tier 1 universal search · Tier 2 category tree · Tier 3 scoped facet panel.
   URL-driven; index-backed pickers are mocked with local pools. */
(function(){

/* ---------- Tier 2 — category hierarchy ---------- */
var TAX = [
  { id:'tcg', label:'Trading Card Games', count:412880, kids:[
    { id:'tcg/pokemon', label:'Pok\u00e9mon', count:268430, kids:[
      { id:'tcg/pokemon/en', label:'English', count:171200 },
      { id:'tcg/pokemon/jp', label:'Japanese', count:82410 },
      { id:'tcg/pokemon/wotc', label:'Vintage WOTC', count:14820 }
    ]},
    { id:'tcg/magic', label:'Magic: The Gathering', count:78210 },
    { id:'tcg/yugioh', label:'Yu-Gi-Oh!', count:41120 },
    { id:'tcg/onepiece', label:'One Piece', count:25120 }
  ]},
  { id:'sports', label:'Sports Cards', count:386540, kids:[
    { id:'sports/basketball', label:'Basketball', count:128900 },
    { id:'sports/baseball', label:'Baseball', count:112300 },
    { id:'sports/football', label:'Football', count:86440 },
    { id:'sports/soccer', label:'Soccer', count:58900 }
  ]},
  { id:'nonsport', label:'Non-Sport', count:44210, kids:[
    { id:'nonsport/starwars', label:'Star Wars', count:18400 },
    { id:'nonsport/marvel', label:'Marvel', count:16210 },
    { id:'nonsport/gpk', label:'Garbage Pail Kids', count:9600 }
  ]},
  { id:'comics', label:'Comics', count:28600 },
  { id:'coins', label:'Coins & Currency', count:19340 },
  { id:'tickets', label:'Tickets', count:6120 }
];

var LABEL = {};
(function walk(nodes, trail){
  nodes.forEach(function(n){
    LABEL[n.id] = { label:n.label, trail:trail.concat([n.label]), count:n.count };
    if(n.kids) walk(n.kids, trail.concat([n.label]));
  });
})(TAX, []);

/* ---------- High-cardinality pools (index-backed in production) ---------- */
var POOLS = {
  'tcg/pokemon': {
    set: { total:1240, popular:[
      ['151 EN', 8420], ['SV Destined Rivals', 5210], ['Surging Sparks', 12880],
      ['M2A Japanese', 3140], ['Base Set (WOTC)', 2610], ['Evolving Skies', 9450],
      ['Lost Origin', 4120], ['Crown Zenith', 6380], ['Hidden Fates', 3890]
    ]},
    character: { total:1025, popular:[
      ['Charizard', 14200], ['Pikachu', 11860], ['Umbreon', 4310], ['Giratina', 2280],
      ['Nidoking', 640], ['Rayquaza', 3910], ['Mew', 2740], ['Eevee', 5120]
    ]},
    rarity: { chips:['Special Illustration Rare','Illustration Rare','Secret Rare','Full Art','Holo Rare'] }
  },
  'tcg/magic': {
    set: { total:742, popular:[['Alpha',180],['Beta',260],['Unlimited',940],['Modern Horizons 3',3120],['The Lost Caverns',1880]] },
    rarity: { chips:['Mythic','Rare','Uncommon','Common'] }
  },
  'sports/basketball': {
    player: { total:4680, popular:[
      ['LeBron James', 9240], ['Michael Jordan', 7810], ['Luka Don\u010di\u0107', 4130],
      ['Victor Wembanyama', 3620], ['Stephen Curry', 5240], ['Kobe Bryant', 6180]
    ]},
    team: { total:30, popular:[['Lakers',11200],['Mavericks',4380],['Bulls',7920],['Spurs',3610],['Warriors',5880]] },
    set: { total:318, popular:[['2018 Prizm',6210],['2003 Topps Chrome',2140],['2003 Ultimate Collection',680],['1986 Fleer',1240]] }
  },
  'sports/baseball': {
    player: { total:5120, popular:[['Shohei Ohtani',6210],['Mike Trout',4880],['Mickey Mantle',1920],['Ronald Acu\u00f1a Jr.',3140]] },
    team: { total:30, popular:[['Dodgers',8210],['Yankees',9440],['Angels',3120],['Braves',4010]] },
    set: { total:412, popular:[['2018 Bowman Chrome',3820],['1952 Topps',740],['2023 Topps Chrome',5120]] }
  }
};

/* Which facets a category shows, in order. */
function facetsFor(cat){
  if(!cat) return ['grade','year','price','vault'];
  if(cat.indexOf('tcg/pokemon')===0) return ['set','character','rarity','grade','year','price','vault'];
  if(cat.indexOf('tcg/magic')===0) return ['set','rarity','grade','year','price','vault'];
  if(cat.indexOf('sports')===0) return ['player','team','set','grade','year','price','vault'];
  if(cat.indexOf('tcg')===0) return ['set','grade','year','price','vault'];
  return ['grade','year','price','vault'];
}
var GROUP_FALLBACK = { 'sports':'sports/basketball', 'tcg':'tcg/pokemon' };
function poolFor(cat, key){
  if(!cat) return null;
  if(GROUP_FALLBACK[cat] && !POOLS[cat]) cat = GROUP_FALLBACK[cat];
  var parts = cat.split('/');
  for(var i=parts.length;i>0;i--){
    var p = POOLS[parts.slice(0,i).join('/')];
    if(p && p[key]) return p[key];
  }
  return null;
}

var FACET_META = {
  set:       { label:'Set',       kind:'picker', ph:'Search sets\u2026' },
  character: { label:'Character', kind:'picker', ph:'Search characters\u2026' },
  player:    { label:'Player',    kind:'picker', ph:'Search players\u2026' },
  team:      { label:'Team',      kind:'picker', ph:'Search teams\u2026' },
  rarity:    { label:'Rarity',    kind:'chips' },
  grade:     { label:'Grade',     kind:'chips', values:['PSA 10','PSA 9','PSA 8','BGS 9.5','BGS 9','CGC 10'] },
  vault:     { label:'Vault',     kind:'chips', values:['PSA VAULT','SELF VAULT'] },
  year:      { label:'Year',      kind:'range', min:1950, max:2026, step:1 },
  price:     { label:'Price',     kind:'range', min:0, max:500000, step:100, money:true }
};

/* ---------- State ---------- */
var S = { cat:'', q:'', sort:'gainers', set:[], character:[], player:[], team:[], rarity:[], grade:[], vault:[], yearMin:'', yearMax:'', priceMin:'', priceMax:'' };
var LIST_KEYS = ['set','character','player','team','rarity','grade','vault'];
var expanded = {};

function readURL(){
  var p = new URLSearchParams(location.search);
  S.cat = p.get('cat') || '';
  S.q = p.get('q') || '';
  S.sort = p.get('sort') || 'gainers';
  LIST_KEYS.forEach(function(k){ S[k] = (p.get(k)||'').split('|').filter(Boolean); });
  S.yearMin = p.get('year_min')||''; S.yearMax = p.get('year_max')||'';
  S.priceMin = p.get('price_min')||''; S.priceMax = p.get('price_max')||'';
  if(S.cat) S.cat.split('/').reduce(function(a,seg){ a.push(seg); expanded[a.join('/')] = true; return a; }, []);
}
function writeURL(){
  var p = new URLSearchParams();
  if(S.cat) p.set('cat', S.cat);
  if(S.q) p.set('q', S.q);
  if(S.sort && S.sort!=='gainers') p.set('sort', S.sort);
  LIST_KEYS.forEach(function(k){ if(S[k].length) p.set(k, S[k].join('|')); });
  if(S.yearMin) p.set('year_min', S.yearMin);
  if(S.yearMax) p.set('year_max', S.yearMax);
  if(S.priceMin) p.set('price_min', S.priceMin);
  if(S.priceMax) p.set('price_max', S.priceMax);
  var qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?'+qs : ''));
}

/* ---------- Rendering: category tree ---------- */
var treeQuery = '';
function nodeMatches(n, q){
  if(!q) return true;
  if(n.label.toLowerCase().indexOf(q)>=0) return true;
  return (n.kids||[]).some(function(k){ return nodeMatches(k, q); });
}
function fmt(n){ return n.toLocaleString('en-US'); }

function treeHTML(nodes, depth){
  var q = treeQuery.toLowerCase();
  return nodes.filter(function(n){ return nodeMatches(n, q); }).map(function(n){
    var isOpen = expanded[n.id] || (q && (n.kids||[]).some(function(k){ return nodeMatches(k,q); }));
    var on = S.cat === n.id;
    var kids = n.kids && isOpen ? '<div class="mk-tree-kids">'+treeHTML(n.kids, depth+1)+'</div>' : '';
    return '<div class="mk-tree-node">'+
      '<div class="mk-tree-row'+(on?' on':'')+'" data-cat="'+n.id+'" style="padding-left:'+(8+depth*14)+'px;">'+
        (n.kids ? '<button class="mk-tree-tog'+(isOpen?' open':'')+'" data-tog="'+n.id+'" aria-label="Expand"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 6 15 12 9 18"></polyline></svg></button>' : '<span class="mk-tree-tog mk-tree-tog--leaf"></span>')+
        '<span class="mk-tree-label">'+n.label+'</span>'+
        '<span class="mk-tree-count">'+fmt(n.count)+'</span>'+
      '</div>'+ kids +
    '</div>';
  }).join('');
}

/* ---------- Rendering: facets ---------- */
var pickerQ = {};
function chipsHTML(key, values, counts){
  return '<div class="mk-fchips">'+values.map(function(v){
    var sel = S[key].indexOf(v)>=0;
    var c = counts && counts[v];
    return '<button class="mk-fchip'+(sel?' on':'')+'" data-fchip="'+key+'" data-val="'+v+'">'+v+(c?' <i>'+fmt(c)+'</i>':'')+'</button>';
  }).join('')+'</div>';
}
function pickerHTML(key, pool){
  var m = FACET_META[key];
  var q = (pickerQ[key]||'').toLowerCase();
  var rows = pool.popular.filter(function(r){ return !q || r[0].toLowerCase().indexOf(q)>=0; }).slice(0,8);
  var sel = S[key].map(function(v){
    return '<button class="mk-selchip" data-fchip="'+key+'" data-val="'+v+'">'+v+' <span>&times;</span></button>';
  }).join('');
  return ''+
    '<div class="mk-fnote">'+fmt(pool.total)+' \u2014 type to search</div>'+
    (sel ? '<div class="mk-selchips">'+sel+'</div>' : '')+
    '<div class="mk-fsearch"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>'+
      '<input type="text" data-pickq="'+key+'" value="'+(pickerQ[key]||'').replace(/"/g,'&quot;')+'" placeholder="'+m.ph+'"></div>'+
    '<div class="mk-fresults">'+
      (q ? '' : '<div class="mk-fgrouplabel">Popular</div>')+
      (rows.length ? rows.map(function(r){
        var on = S[key].indexOf(r[0])>=0;
        return '<button class="mk-frow'+(on?' on':'')+'" data-fchip="'+key+'" data-val="'+r[0]+'"><span class="mk-fbox"></span><span class="mk-fname">'+r[0]+'</span><span class="mk-fcount">'+fmt(r[1])+'</span></button>';
      }).join('') : '<div class="mk-fnone">No matches</div>')+
    '</div>';
}
function rangeHTML(key){
  var m = FACET_META[key];
  var lo = key==='year' ? S.yearMin : S.priceMin;
  var hi = key==='year' ? S.yearMax : S.priceMax;
  var presets = key==='price'
    ? [['Under $1k','','1000'],['$1k\u2013$10k','1000','10000'],['$10k\u2013$50k','10000','50000'],['$50k+','50000','']]
    : [['2020\u2013now','2020',''],['2010s','2010','2019'],['2000s','2000','2009'],['Vintage','1950','1999']];
  return '<div class="mk-frange">'+
      '<input type="number" data-rmin="'+key+'" value="'+lo+'" placeholder="'+(m.money?'Min $':m.min)+'">'+
      '<span>\u2013</span>'+
      '<input type="number" data-rmax="'+key+'" value="'+hi+'" placeholder="'+(m.money?'Max $':m.max)+'">'+
    '</div>'+
    '<div class="mk-fchips">'+presets.map(function(p){
      var on = String(lo)===p[1] && String(hi)===p[2];
      return '<button class="mk-fchip'+(on?' on':'')+'" data-rpreset="'+key+'" data-lo="'+p[1]+'" data-hi="'+p[2]+'">'+p[0]+'</button>';
    }).join('')+'</div>';
}

function facetsHTML(){
  var keys = facetsFor(S.cat);
  var scopeNote = S.cat
    ? '<div class="mk-side-note">Filters scoped to <b>'+LABEL[S.cat].label+'</b></div>'
    : '<div class="mk-side-note">Pick a category for set, player and character filters.</div>';
  return scopeNote + keys.map(function(key){
    var m = FACET_META[key];
    var pool = (m.kind==='picker' || key==='rarity') ? poolFor(S.cat, key) : null;
    if(m.kind==='picker' && !pool) return '';
    var body;
    if(m.kind==='picker') body = pickerHTML(key, pool);
    else if(m.kind==='range') body = rangeHTML(key);
    else if(key==='rarity') body = pool ? chipsHTML(key, pool.chips) : '';
    else body = chipsHTML(key, m.values);
    if(!body) return '';
    return '<section class="mk-facet"><h4>'+m.label+'</h4>'+body+'</section>';
  }).join('');
}

/* ---------- Breadcrumb + applied chips ---------- */
function crumbHTML(){
  var parts = [];
  if(S.cat){
    S.cat.split('/').reduce(function(a,seg){
      a.push(seg); var id=a.join('/');
      parts.push('<a href="#" data-cat="'+id+'">'+LABEL[id].label+'</a>');
      return a;
    }, []);
  }
  var vals = [];
  LIST_KEYS.forEach(function(k){ S[k].forEach(function(v){ vals.push(v); }); });
  if(S.q) vals.unshift('\u201c'+S.q+'\u201d');
  var all = parts.concat(vals.length ? ['<span class="mk-crumb-vals">'+vals.join(' \u00b7 ')+'</span>'] : []);
  return all.length ? all.join('<span class="mk-crumb-sep">\u203a</span>') : '<span class="mk-crumb-all">All categories</span>';
}
function chipsBarHTML(){
  var out = [];
  if(S.q) out.push('<button class="mk-achip" data-clear="q">\u201c'+S.q+'\u201d <span>&times;</span></button>');
  if(S.cat) out.push('<button class="mk-achip" data-clear="cat">'+LABEL[S.cat].label+' <span>&times;</span></button>');
  LIST_KEYS.forEach(function(k){
    S[k].forEach(function(v){ out.push('<button class="mk-achip" data-fchip="'+k+'" data-val="'+v+'">'+v+' <span>&times;</span></button>'); });
  });
  if(S.yearMin||S.yearMax) out.push('<button class="mk-achip" data-clear="year">'+(S.yearMin||FACET_META.year.min)+'\u2013'+(S.yearMax||FACET_META.year.max)+' <span>&times;</span></button>');
  if(S.priceMin||S.priceMax) out.push('<button class="mk-achip" data-clear="price">$'+(S.priceMin||'0')+'\u2013'+(S.priceMax?'$'+S.priceMax:'any')+' <span>&times;</span></button>');
  if(out.length) out.push('<button class="mk-achip mk-achip--clear" data-clear="all">Clear all</button>');
  return out.join('');
}

/* ---------- Filtering the result grid ---------- */
function cardData(c){
  if(c.__d) return c.__d;
  c.__d = {
    cat: c.getAttribute('data-cat')||'',
    set: c.getAttribute('data-set')||'',
    character: c.getAttribute('data-character')||'',
    player: c.getAttribute('data-player')||'',
    team: c.getAttribute('data-team')||'',
    rarity: c.getAttribute('data-rarity')||'',
    grade: c.getAttribute('data-grade')||'',
    vault: c.getAttribute('data-vault')||'',
    year: parseInt(c.getAttribute('data-year')||'0',10),
    price: parseFloat(c.getAttribute('data-price')||'0'),
    chg: parseFloat(c.getAttribute('data-chg')||'0'),
    pop: parseFloat(c.getAttribute('data-pop')||'0'),
    text: (c.textContent||'').toLowerCase()
  };
  return c.__d;
}
function ok(d){
  if(S.cat && d.cat.indexOf(S.cat)!==0) return false;
  for(var i=0;i<LIST_KEYS.length;i++){
    var k = LIST_KEYS[i];
    if(S[k].length && S[k].indexOf(d[k])<0) return false;
  }
  if(S.yearMin && d.year < +S.yearMin) return false;
  if(S.yearMax && d.year > +S.yearMax) return false;
  if(S.priceMin && d.price < +S.priceMin) return false;
  if(S.priceMax && d.price > +S.priceMax) return false;
  if(S.q && d.text.indexOf(S.q.toLowerCase())<0) return false;
  return true;
}
var SORTS = {
  gainers:{ label:'Top gainers', fn:function(a,b){ return b.chg-a.chg; } },
  asc:{ label:'Price: low \u2192 high', fn:function(a,b){ return a.price-b.price; } },
  desc:{ label:'Price: high \u2192 low', fn:function(a,b){ return b.price-a.price; } },
  newest:{ label:'Newest listings', fn:function(a,b){ return b.year-a.year; } },
  pop:{ label:'Population: low \u2192 high', fn:function(a,b){ return a.pop-b.pop; } }
};

/* Mock index count so "Show N results" scales past the rendered page. */
function indexCount(visible){
  var base = S.cat ? LABEL[S.cat].count : 1284000;
  var narrow = 1;
  LIST_KEYS.forEach(function(k){ if(S[k].length) narrow *= 0.18 * S[k].length; });
  if(S.yearMin||S.yearMax) narrow *= 0.45;
  if(S.priceMin||S.priceMax) narrow *= 0.4;
  if(S.q) narrow *= 0.06;
  var n = Math.round(base * Math.min(1, narrow));
  return visible === 0 ? 0 : Math.max(visible, n);
}

/* ---------- Apply ---------- */
function $(id){ return document.getElementById(id); }

function apply(persist){
  var side = $('mkSide'); if(!side) return;

  var tree = $('mkTree'); if(tree) tree.innerHTML = treeHTML(TAX, 0);
  var facets = $('mkFacets'); if(facets) facets.innerHTML = facetsHTML();
  var crumb = $('mkCrumb'); if(crumb) crumb.innerHTML = crumbHTML();
  var chips = $('mkChips');
  if(chips){ chips.innerHTML = chipsBarHTML(); chips.style.display = chips.innerHTML ? 'flex' : 'none'; }

  var grid = document.querySelector('#mk-results-populated .grid4');
  var shown = [];
  if(grid){
    var cards = [].slice.call(grid.querySelectorAll('.card'));
    cards.forEach(function(c){
      var pass = ok(cardData(c));
      c.style.display = pass ? '' : 'none';
      if(pass) shown.push(c);
    });
    if(getComputedStyle(grid).display.indexOf('flex') < 0) grid.style.display = 'grid';
    shown.slice().sort(function(a,b){ return SORTS[S.sort].fn(a.__d,b.__d); })
      .forEach(function(c, i){ c.style.order = i; });
  }

  var n = indexCount(shown.length);
  var rc = $('mkResultCount'); if(rc) rc.textContent = fmt(n);
  var rcm = $('mkResultCountMobile'); if(rcm) rcm.textContent = fmt(n)+' results';
  var sb = $('mkShowBtn'); if(sb) sb.textContent = n ? 'Show '+fmt(n)+' results' : 'No results';
  var sortLbl = $('mkSortLabel'); if(sortLbl) sortLbl.textContent = SORTS[S.sort].label;
  document.querySelectorAll('[data-sort]').forEach(function(el){ el.classList.toggle('sel', el.getAttribute('data-sort')===S.sort); });

  var fe = $('mk-empty-filter'), rp = $('mk-results-populated');
  var demoEmpty = $('mk-empty-market') && $('mk-empty-market').classList.contains('on');
  if(fe && !demoEmpty) fe.classList.toggle('on', shown.length===0);
  if(rp && !demoEmpty) rp.classList.toggle('off', shown.length===0);

  if(persist !== false) writeURL();
}

/* ---------- Tier 1 — universal search typeahead ---------- */
function typeaheadHTML(q){
  var ql = q.toLowerCase();
  var groups = [];
  var cats = Object.keys(LABEL).filter(function(id){ return LABEL[id].label.toLowerCase().indexOf(ql)>=0; }).slice(0,4);
  if(cats.length) groups.push(['Categories', cats.length, cats.map(function(id){
    return { label:LABEL[id].trail.join(' \u203a '), count:LABEL[id].count, cat:id };
  })]);
  ['set','character','player','team'].forEach(function(key){
    var seen = [], names = {};
    Object.keys(POOLS).forEach(function(catId){
      var p = POOLS[catId][key]; if(!p || !p.popular) return;
      p.popular.forEach(function(r){
        if(r[0].toLowerCase().indexOf(ql)>=0 && !names[r[0]]){ names[r[0]]=1; seen.push({ label:r[0], count:r[1], cat:catId, key:key }); }
      });
    });
    if(seen.length) groups.push([{set:'Sets',character:'Characters',player:'Players',team:'Teams'}[key], seen.length, seen.slice(0,3)]);
  });
  var cards = [].slice.call(document.querySelectorAll('#mk-results-populated .grid4 .card')).filter(function(c){
    return (c.querySelector('.card__title')||{}).textContent.toLowerCase().indexOf(ql)>=0;
  });
  var uniq = [], titles = {};
  cards.forEach(function(c){
    var t = c.querySelector('.card__title').textContent.trim();
    if(!titles[t]){ titles[t]=1; uniq.push({ label:t, count:null, href:'Card.html' }); }
  });
  if(uniq.length) groups.push(['Cards', uniq.length, uniq.slice(0,3)]);

  if(!groups.length) return '<div class="mk-ta-none">No matches for \u201c'+q+'\u201d</div>';
  return groups.map(function(g){
    return '<div class="mk-ta-group"><div class="mk-ta-head">'+g[0]+' <span>'+fmt(g[1])+'</span></div>'+
      g[2].map(function(r){
        var attrs = r.href ? 'data-ta-href="'+r.href+'"' : 'data-ta-cat="'+r.cat+'"'+(r.key?' data-ta-key="'+r.key+'" data-ta-val="'+r.label.replace(/"/g,'&quot;')+'"':'');
        return '<button class="mk-ta-row" '+attrs+'><span class="mk-ta-label">'+r.label+'</span>'+(r.count?'<span class="mk-ta-count">'+fmt(r.count)+'</span>':'')+'</button>';
      }).join('')+
      '<button class="mk-ta-all" '+(g[2][0].cat?'data-ta-cat="'+g[2][0].cat+'"':'data-ta-seeall="1"')+'>See all '+g[0].toLowerCase()+'</button>'+
    '</div>';
  }).join('');
}
function closeTA(){ var p=$('mkTypeahead'); if(p) p.classList.remove('open'); }

/* ---------- Events ---------- */
document.addEventListener('click', function(e){
  var t = e.target;

  var tog = t.closest && t.closest('[data-tog]');
  if(tog){ var id = tog.getAttribute('data-tog'); expanded[id] = !expanded[id]; apply(); e.preventDefault(); return; }

  var row = t.closest && t.closest('.mk-tree-row[data-cat], .mk-crumb [data-cat]');
  if(row){
    var id2 = row.getAttribute('data-cat');
    S.cat = (S.cat === id2) ? '' : id2;
    LIST_KEYS.forEach(function(k){ S[k] = []; });
    pickerQ = {};
    if(S.cat) S.cat.split('/').reduce(function(a,seg){ a.push(seg); expanded[a.join('/')] = true; return a; }, []);
    closeTA(); apply(); e.preventDefault(); return;
  }

  var fc = t.closest && t.closest('[data-fchip]');
  if(fc){
    var k = fc.getAttribute('data-fchip'), v = fc.getAttribute('data-val');
    var i = S[k].indexOf(v);
    if(i>=0) S[k].splice(i,1); else S[k].push(v);
    apply(); e.preventDefault(); return;
  }

  var rp2 = t.closest && t.closest('[data-rpreset]');
  if(rp2){
    var rk = rp2.getAttribute('data-rpreset'), lo = rp2.getAttribute('data-lo'), hi = rp2.getAttribute('data-hi');
    var same = (rk==='year' ? S.yearMin===lo && S.yearMax===hi : S.priceMin===lo && S.priceMax===hi);
    if(rk==='year'){ S.yearMin = same?'':lo; S.yearMax = same?'':hi; }
    else { S.priceMin = same?'':lo; S.priceMax = same?'':hi; }
    apply(); e.preventDefault(); return;
  }

  var cl = t.closest && t.closest('[data-clear]');
  if(cl){
    var w = cl.getAttribute('data-clear');
    if(w==='cat'){ S.cat=''; LIST_KEYS.forEach(function(k){ S[k]=[]; }); }
    if(w==='q'){ S.q=''; var si=$('mkSearchInput'); if(si) si.value=''; }
    if(w==='year'){ S.yearMin=''; S.yearMax=''; }
    if(w==='price'){ S.priceMin=''; S.priceMax=''; }
    if(w==='all'){ S.cat=''; S.q=''; LIST_KEYS.forEach(function(k){ S[k]=[]; }); S.yearMin=S.yearMax=S.priceMin=S.priceMax=''; pickerQ={};
      var si2=$('mkSearchInput'); if(si2) si2.value=''; }
    apply(); e.preventDefault(); return;
  }

  var so = t.closest && t.closest('[data-sort]');
  if(so){ S.sort = so.getAttribute('data-sort'); apply(); return; }

  var taRow = t.closest && t.closest('.mk-ta-row, .mk-ta-all');
  if(taRow){
    var href = taRow.getAttribute('data-ta-href');
    if(href){ location.href = href; return; }
    var tc = taRow.getAttribute('data-ta-cat');
    if(tc){
      S.cat = tc; LIST_KEYS.forEach(function(k){ S[k]=[]; });
      var tk = taRow.getAttribute('data-ta-key'), tv = taRow.getAttribute('data-ta-val');
      if(tk && tv) S[tk] = [tv];
      S.cat.split('/').reduce(function(a,seg){ a.push(seg); expanded[a.join('/')] = true; return a; }, []);
    }
    closeTA(); apply(); e.preventDefault(); return;
  }

  if(t.closest && t.closest('.mk-side-open-btn')){ document.body.classList.add('mk-side-on'); return; }
  if(t.closest && (t.closest('.mk-side-close') || t.closest('#mkShowBtn'))){ document.body.classList.remove('mk-side-on'); return; }
  if(t.id === 'mkSideScrim'){ document.body.classList.remove('mk-side-on'); return; }

  if(!t.closest || !t.closest('.mk-usearch')) closeTA();
}, false);

document.addEventListener('input', function(e){
  var t = e.target;
  if(t.id === 'mkTreeSearch'){ treeQuery = t.value; var tr=$('mkTree'); if(tr) tr.innerHTML = treeHTML(TAX,0); return; }
  if(t.hasAttribute && t.hasAttribute('data-pickq')){
    var k = t.getAttribute('data-pickq'); pickerQ[k] = t.value;
    var host = t.closest('.mk-facet');
    var pool = poolFor(S.cat, k);
    if(host && pool){ host.innerHTML = '<h4>'+FACET_META[k].label+'</h4>'+pickerHTML(k, pool);
      var ni = host.querySelector('[data-pickq="'+k+'"]'); if(ni){ ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); } }
    return;
  }
  if(t.hasAttribute && (t.hasAttribute('data-rmin') || t.hasAttribute('data-rmax'))){
    var rk = t.getAttribute('data-rmin') || t.getAttribute('data-rmax');
    var isMin = t.hasAttribute('data-rmin');
    if(rk==='year'){ if(isMin) S.yearMin=t.value; else S.yearMax=t.value; }
    else { if(isMin) S.priceMin=t.value; else S.priceMax=t.value; }
    clearTimeout(window.__mkRangeT);
    window.__mkRangeT = setTimeout(function(){ apply(); }, 350);
    return;
  }
  if(t.id === 'mkSearchInput'){
    S.q = t.value.trim();
    var panel = $('mkTypeahead');
    if(panel){
      if(S.q.length >= 1){ panel.innerHTML = typeaheadHTML(S.q); panel.classList.add('open'); }
      else panel.classList.remove('open');
    }
    clearTimeout(window.__mkSearchT);
    window.__mkSearchT = setTimeout(function(){ apply(); }, 300);
  }
}, false);

document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){ closeTA(); document.body.classList.remove('mk-side-on'); }
  if(e.key === 'Enter' && e.target.id === 'mkSearchInput'){ closeTA(); apply(); }
}, false);

document.addEventListener('focusin', function(e){
  if(e.target.id === 'mkSearchInput' && S.q){
    var panel = $('mkTypeahead');
    if(panel){ panel.innerHTML = typeaheadHTML(S.q); panel.classList.add('open'); }
  }
}, false);

/* ---------- Boot (DC host renders late) ---------- */
var booted = false;
function boot(){
  if(booted || !document.getElementById('mkSide')) return;
  booted = true;
  readURL();
  var si = document.getElementById('mkSearchInput'); if(si) si.value = S.q;
  apply(false);
}
function hydrateImgs(){
  document.querySelectorAll('#mk-results-populated .grid4 img[data-src]').forEach(function(im){
    var v = im.getAttribute('data-src');
    if(!v || v.indexOf('{{') >= 0) return;
    im.removeAttribute('data-src');
    im.src = v;
  });
}
function panelStale(){
  var tr = $('mkTree');
  return !tr || !tr.querySelector('.mk-tree-row');
}
function sync(){
  if(!document.getElementById('mkSide')) return;
  if(!booted){ booted = true; readURL(); var si = $('mkSearchInput'); if(si) si.value = S.q; }
  hydrateImgs();
  if(panelStale()) apply(false);
}
sync();
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
setInterval(sync, 60);
if(window.MutationObserver){
  new MutationObserver(function(){ sync(); }).observe(document.documentElement, { childList:true, subtree:true });
}
setInterval(function(){
  if(!booted) return;
  var grid = document.querySelector('#mk-results-populated .grid4'); if(!grid) return;
  var cards = [].slice.call(grid.querySelectorAll('.card'));
  var vis = cards.filter(function(c){ return c.style.display !== 'none'; }).length;
  var exp = cards.filter(function(c){ return ok(cardData(c)); }).length;
  if(vis !== exp) apply(false);
}, 900);

})();
