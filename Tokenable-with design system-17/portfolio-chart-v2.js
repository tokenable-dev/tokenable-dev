/* Portfolio v2 — Dynamic chart driven by checked assets */
(function(){

/* Asset data: each has daily value history (mock) */
var ASSETS = [
  { id:'charizard', name:'Charizard 1st Ed Base Set', cost:180000, vals:{
    '1d':[418000,419200,420000,419500,420800,421000,420000],
    '1w':[400000,405000,410000,412000,415000,418000,420000],
    '1m':[350000,360000,370000,385000,395000,410000,420000]
  }},
  { id:'lebron', name:'LeBron James Rookie Chrome', cost:31000, vals:{
    '1d':[57200,57500,57800,58000,57600,58200,58000],
    '1w':[52000,53500,55000,56000,57000,57500,58000],
    '1m':[42000,45000,48000,50000,53000,56000,58000]
  }},
  { id:'pikachu', name:'Pikachu ex · Surging Sparks', cost:770, vals:{
    '1d':[1100,1110,1120,1130,1125,1140,1136],
    '1w':[950,980,1020,1060,1090,1110,1136],
    '1m':[800,850,900,950,1000,1080,1136]
  }},
  { id:'luka', name:'Luka Dončić Blue Ice Prizm', cost:16100, vals:{
    '1d':[18900,19000,19050,19100,19080,19200,19154],
    '1w':[17000,17500,18000,18300,18700,19000,19154],
    '1m':[15000,15800,16500,17200,18000,18800,19154]
  }},
  { id:'nidoking', name:'Nidoking ex · Destined Rivals', cost:45000, vals:{
    '1d':[57000,57200,57500,57800,58000,57600,58000],
    '1w':[50000,51500,53000,54500,56000,57000,58000],
    '1m':[40000,43000,46000,49000,52000,55000,58000]
  }}
];

var LABELS = {
  '1d':['12AM','4AM','8AM','12PM','4PM','8PM','Now'],
  '1w':['Jun 26','Jun 27','Jun 28','Jun 29','Jun 30','Jul 1','Jul 2'],
  '1m':['Jun 2','Jun 7','Jun 12','Jun 17','Jun 22','Jun 27','Jul 2']
};

var currentPeriod = '1d';
var checked = {};
ASSETS.forEach(function(a){ checked[a.id] = true; });

window._pfAssets = ASSETS;
window._pfChecked = checked;

function getCheckedTotal(period){
  var len = ASSETS[0].vals[period].length;
  var totals = [];
  for(var i=0;i<len;i++){
    var sum = 0;
    ASSETS.forEach(function(a){
      if(checked[a.id]) sum += a.vals[period][i];
    });
    totals.push(sum);
  }
  return totals;
}

function getCurrentTotal(){
  var sum = 0;
  ASSETS.forEach(function(a){
    if(checked[a.id]){
      var v = a.vals[currentPeriod];
      sum += v[v.length-1];
    }
  });
  return sum;
}

function getAllTotal(){
  var sum = 0;
  ASSETS.forEach(function(a){
    var v = a.vals[currentPeriod];
    sum += v[v.length-1];
  });
  return sum;
}

function getPrevTotal(){
  var sum = 0;
  ASSETS.forEach(function(a){
    if(checked[a.id]) sum += a.vals[currentPeriod][0];
  });
  return sum;
}

function fmtK(v){ return v>=1e6?'$'+(v/1e6).toFixed(1)+'M':'$'+(v/1e3).toFixed(0)+'k'; }
function fmtPrice(v){ return '$'+v.toLocaleString(); }
window._pfFmtPrice = fmtPrice;

function drawChart(){
  var svg = document.getElementById('pf-chart-svg');
  var line = document.getElementById('pf-chart-line');
  var area = document.getElementById('pf-chart-area');
  if(!svg||!line) return;

  var vals = getCheckedTotal(currentPeriod);
  if(vals.length===0 || vals.every(function(v){return v===0;})){
    line.setAttribute('d','');
    if(area) area.setAttribute('d','');
    return;
  }

  var W=760, H=220, PL=56, PR=16, PT=16, PB=30;
  var plotW=W-PL-PR, plotH=H-PT-PB;
  var mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals);
  if(mn===mx){ mn-=1000; mx+=1000; }
  var range=mx-mn;

  function X(i){ return PL + (i/(vals.length-1))*plotW; }
  function Y(v){ return PT + plotH - ((v-mn)/range)*plotH; }

  var pts = vals.map(function(v,i){ return X(i).toFixed(1)+','+Y(v).toFixed(1); });
  line.setAttribute('d','M'+pts.join('L'));
  if(area){
    area.setAttribute('d','M'+PL+','+(PT+plotH)+'L'+pts.join('L')+'L'+(PL+plotW)+','+(PT+plotH)+'Z');
  }

  // Y axis labels
  var yLabels = document.querySelectorAll('.pf-y-label');
  if(yLabels.length>=3){
    yLabels[0].textContent = fmtK(mx);
    yLabels[1].textContent = fmtK((mx+mn)/2);
    yLabels[2].textContent = fmtK(mn);
  }

  // X axis labels
  var xLabels = document.querySelectorAll('.pf-x-label');
  var lbls = LABELS[currentPeriod]||[];
  xLabels.forEach(function(el,i){ el.textContent = lbls[i]||''; });

  // Update header values
  var total = getCurrentTotal();
  var prev = getPrevTotal();
  var chg = total - prev;
  var chgPct = prev>0 ? ((chg/prev)*100).toFixed(1) : '0.0';
  var elTotal = document.getElementById('pf-chart-total');
  if(elTotal) elTotal.textContent = fmtPrice(total);
  // Headline #pf-chart-change stays fixed on TODAY's figure (set in HTML).
  // The selected period's own delta is shown separately so switching range
  // never redefines the headline number.
  var elPeriod = document.getElementById('pf-period-delta');
  if(elPeriod){
    var sign = chg>=0?'+':'';
    var pName = (currentPeriod||'').toUpperCase();
    elPeriod.textContent = pName+' '+sign+fmtPrice(Math.abs(chg))+' ('+sign+chgPct+'%)';
    elPeriod.style.color = chg>=0?'#00C350':'#E4374A';
  }

  // Store for hover
  window._pfChartPts = vals.map(function(v,i){ return {x:X(i),y:Y(v),v:v}; });
  window._pfChartBounds = {PL:PL,PR:PR,PT:PT,PB:PB,W:W,H:H,plotW:plotW,plotH:plotH};
}

// Hover interaction
function initHover(){
  var wrap = document.getElementById('pf-chartwrap-v2');
  var crosshair = document.getElementById('pf-v2-crosshair');
  var dot = document.getElementById('pf-v2-dot');
  var tooltip = document.getElementById('pf-v2-tooltip');
  if(!wrap) return;

  wrap.addEventListener('mousemove', function(e){
    var pts = window._pfChartPts;
    if(!pts||!pts.length) return;
    var rect = wrap.getBoundingClientRect();
    var scaleX = 760/rect.width;
    var mx = (e.clientX - rect.left)*scaleX;
    // Find closest point
    var closest=pts[0], ci=0;
    for(var i=1;i<pts.length;i++){
      if(Math.abs(pts[i].x-mx)<Math.abs(closest.x-mx)){ closest=pts[i]; ci=i; }
    }
    if(crosshair){
      crosshair.setAttribute('x1',closest.x);
      crosshair.setAttribute('x2',closest.x);
      crosshair.style.display='';
    }
    if(dot){
      dot.setAttribute('cx',closest.x);
      dot.setAttribute('cy',closest.y);
      dot.style.display='';
    }
    if(tooltip){
      tooltip.style.display='block';
      var lbls=LABELS[currentPeriod]||[];
      tooltip.querySelector('.pf-tip-date').textContent=lbls[ci]||'';
      tooltip.querySelector('.pf-tip-val').textContent=fmtPrice(closest.v);
      var tipLeft=(closest.x/760)*100;
      tooltip.style.left=tipLeft+'%';
      tooltip.style.transform='translateX(-50%)';
    }
  });

  wrap.addEventListener('mouseleave', function(){
    if(crosshair) crosshair.style.display='none';
    if(dot) dot.style.display='none';
    if(tooltip) tooltip.style.display='none';
  });
}

// Period buttons
document.addEventListener('click', function(e){
  var btn = e.target.closest('.pf-period');
  if(!btn || btn.id==='pf-custom-btn') return;
  var p = btn.dataset.period;
  if(!p) return;
  currentPeriod = p;
  document.querySelectorAll('.pf-period').forEach(function(b){
    b.style.background='transparent'; b.style.color='rgba(255,255,255,0.5)';
  });
  btn.style.background='var(--azure)'; btn.style.color='#fff';
  drawChart();
});

// Checkbox toggle via event delegation (no inline onchange)
document.addEventListener('change', function(e){
  if(e.target.classList.contains('pf-asset-check')){
    var id = e.target.dataset.asset;
    if(id) checked[id] = e.target.checked;
    drawChart();
  }
  if(e.target.id === 'pf-check-all'){
    var on = e.target.checked;
    document.querySelectorAll('.pf-asset-check').forEach(function(cb){
      cb.checked = on;
      var id = cb.dataset.asset;
      if(id) checked[id] = on;
    });
    drawChart();
  }
});

window.pfToggleAsset = function(id){
  checked[id] = !checked[id];
  drawChart();
};

// Init
function init(){
  if(!document.getElementById('pf-chart-svg')) return;
  // Force all checkboxes checked on init
  document.querySelectorAll('.pf-asset-check').forEach(function(cb){
    cb.checked = true;
    var id = cb.dataset.asset;
    if(id) checked[id] = true;
  });
  var allCb = document.getElementById('pf-check-all');
  if(allCb) allCb.checked = true;
  drawChart();
  initHover();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
// Also poll + force check
var tries=0;
var pollId=setInterval(function(){
  var svg = document.getElementById('pf-chart-svg');
  var line = document.getElementById('pf-chart-line');
  // Force checkboxes every poll until chart renders
  document.querySelectorAll('.pf-asset-check').forEach(function(cb){
    if(!cb.checked){ cb.checked = true; var id=cb.dataset.asset; if(id) checked[id]=true; }
  });
  var allCb = document.getElementById('pf-check-all');
  if(allCb && !allCb.checked) allCb.checked = true;
  if(svg && line) init();
  // The host paints the chart shell and its path on separate frames, so keep
  // polling until the line actually carries geometry — not just until the SVG exists.
  var drawn = line && line.getAttribute('d');
  if(drawn || tries++>60){ clearInterval(pollId); }
},300);

})();
