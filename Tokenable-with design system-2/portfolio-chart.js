/* Portfolio chart data + interactions */
(function(){
var pfData = {
  '1d': {vals:[279200,279800,280100,279900,281200,282400,281800,283100,283800,282900,284200,284610], labels:['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','Now'], yMin:278000, yMax:286000},
  '1w': {vals:[268000,271200,274800,272100,278400,280900,276200,279800,282100,284610], labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun','Mon','Tue','Now'], yMin:265000, yMax:288000},
  '1m': {vals:[241000,248200,252800,258400,255100,261800,267400,271200,264800,272100,278400,284610], labels:['Jun 1','Jun 3','Jun 6','Jun 9','Jun 12','Jun 15','Jun 18','Jun 21','Jun 24','Jun 26','Jun 28','Jun 30'], yMin:238000, yMax:290000}
};

function fmtK(v){ return v>=1e6 ? '$'+(v/1e6).toFixed(1)+'M' : '$'+(v/1e3).toFixed(0)+'k'; }

function drawPfChart(period){
  var d = pfData[period]; if(!d) return;
  var W=800, H=200, vals=d.vals, n=vals.length;
  var mn=d.yMin, mx=d.yMax, rng=mx-mn;
  var pts = vals.map(function(v,i){ return {x: i/(n-1)*W, y: H - (v-mn)/rng*H}; });
  var line = 'M'+pts.map(function(p){return p.x+','+p.y;}).join(' L');
  var area = line + ' L'+W+','+H+' L0,'+H+' Z';
  document.getElementById('pf-line').setAttribute('d', line);
  document.getElementById('pf-area').setAttribute('d', area);
  document.getElementById('pf-y3').textContent = fmtK(mx);
  document.getElementById('pf-y2').textContent = fmtK(mn+(mx-mn)*0.66);
  document.getElementById('pf-y1').textContent = fmtK(mn+(mx-mn)*0.33);
  document.getElementById('pf-y0').textContent = fmtK(mn);
  var xl = document.getElementById('pf-xlabels');
  xl.innerHTML = '';
  var step = Math.max(1, Math.floor(n/5));
  for(var i=0;i<n;i+=step){
    var s = document.createElement('span');
    s.className='mono'; s.style.cssText='font-size:10px;color:var(--t3);';
    s.textContent = d.labels[i]; xl.appendChild(s);
  }
  if((n-1)%step!==0){
    var s2=document.createElement('span'); s2.className='mono'; s2.style.cssText='font-size:10px;color:var(--t3);';
    s2.textContent=d.labels[n-1]; xl.appendChild(s2);
  }
  window._pfPts=pts; window._pfVals=vals; window._pfLabels=d.labels;
}
/* Wait for SVG elements to exist before drawing */
(function pollDraw(){
  if(document.getElementById('pf-line') && document.getElementById('pf-area')){
    drawPfChart('1d');
  } else {
    setTimeout(pollDraw, 100);
  }
})();

/* Period buttons */
document.addEventListener('click', function(e){
  var btn = e.target.closest('.pf-period');
  if(btn){
    document.querySelectorAll('.pf-period').forEach(function(b){
      b.style.background='rgba(255,255,255,0.04)'; b.style.boxShadow='inset 0 0 0 2px var(--line)'; b.style.color='var(--t2)'; b.classList.remove('sel');
    });
    btn.style.background='var(--azure)'; btn.style.boxShadow='none'; btn.style.color='#fff'; btn.classList.add('sel');
    drawPfChart(btn.getAttribute('data-period'));
  }
});

/* Hover interaction */
var chartEl = document.getElementById('pf-chart');
if(chartEl){
  chartEl.addEventListener('mousemove', function(e){
    var rect = chartEl.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var pct = x / rect.width;
    var pts = window._pfPts; if(!pts||!pts.length) return;
    var idx = Math.round(pct*(pts.length-1));
    idx = Math.max(0, Math.min(pts.length-1, idx));
    var cx = pts[idx].x, cy = pts[idx].y;
    var ch = document.getElementById('pf-crosshair');
    var dot = document.getElementById('pf-dot');
    var tt = document.getElementById('pf-tooltip');
    ch.setAttribute('x1',cx); ch.setAttribute('x2',cx); ch.style.display='';
    dot.setAttribute('cx',cx); dot.setAttribute('cy',cy); dot.style.display='';
    document.getElementById('pf-tt-time').textContent = window._pfLabels[idx];
    document.getElementById('pf-tt-val').textContent = '$'+window._pfVals[idx].toLocaleString();
    // Show live market price label
    var lmpEl = document.getElementById('pf-tt-lmp');
    if(lmpEl) lmpEl.style.display = '';
    tt.style.display='block';
    var ttLeft = (cx/800*100)+'%';
    tt.style.left = ttLeft; tt.style.top = (cy/200*100 - 22)+'%';
    tt.style.transform = 'translateX(-50%)';
  });
  chartEl.addEventListener('mouseleave', function(){
    document.getElementById('pf-crosshair').style.display='none';
    document.getElementById('pf-dot').style.display='none';
    document.getElementById('pf-tooltip').style.display='none';
  });
}

/* Custom date range - calendar modal */
var _calMode = 'from'; // 'from' or 'to'
var _calYear, _calMonth;
var _calFrom = null, _calTo = null;
var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function _renderCal(){
  var title = document.getElementById('pf-cal-title');
  var grid = document.getElementById('pf-cal-days');
  if(!title||!grid) return;
  title.textContent = months[_calMonth] + ' ' + _calYear;
  grid.innerHTML = '';
  var first = new Date(_calYear, _calMonth, 1).getDay();
  var daysInMonth = new Date(_calYear, _calMonth+1, 0).getDate();
  for(var i=0;i<first;i++){
    var sp = document.createElement('span'); sp.textContent=''; grid.appendChild(sp);
  }
  for(var d=1;d<=daysInMonth;d++){
    var btn = document.createElement('button');
    btn.textContent = d;
    btn.style.cssText = 'width:100%;height:32px;border:0;border-radius:6px;background:transparent;color:#fff;font-family:var(--font-mono);font-size:12px;cursor:pointer;';
    btn.setAttribute('data-day', d);
    // Highlight selected
    var thisDate = new Date(_calYear, _calMonth, d);
    if(_calFrom && thisDate.getTime() === _calFrom.getTime()){
      btn.style.background = 'var(--azure)'; btn.style.color = '#fff'; btn.style.fontWeight = '700';
    }
    if(_calTo && thisDate.getTime() === _calTo.getTime()){
      btn.style.background = 'var(--azure)'; btn.style.color = '#fff'; btn.style.fontWeight = '700';
    }
    if(_calFrom && _calTo && thisDate > _calFrom && thisDate < _calTo){
      btn.style.background = 'rgba(26,111,255,0.15)';
    }
    btn.addEventListener('mouseover', function(){ if(this.style.background!=='var(--azure)') this.style.background='rgba(255,255,255,0.08)'; });
    btn.addEventListener('mouseout', function(){ 
      var dd = parseInt(this.getAttribute('data-day'));
      var dt = new Date(_calYear, _calMonth, dd);
      if(_calFrom && dt.getTime()===_calFrom.getTime()) return;
      if(_calTo && dt.getTime()===_calTo.getTime()) return;
      if(_calFrom && _calTo && dt>_calFrom && dt<_calTo){ this.style.background='rgba(26,111,255,0.15)'; return; }
      this.style.background='transparent';
    });
    grid.appendChild(btn);
  }
}

window._pfCalOpen = function(mode){
  _calMode = mode;
  var now = new Date();
  _calYear = now.getFullYear(); _calMonth = now.getMonth();
  _renderCal();
  document.getElementById('pf-cal-modal').style.display = 'block';
};

window._pfCalNav = function(dir){
  _calMonth += dir;
  if(_calMonth<0){ _calMonth=11; _calYear--; }
  if(_calMonth>11){ _calMonth=0; _calYear++; }
  _renderCal();
};

// Day click via delegation
document.addEventListener('click', function(e){
  var btn = e.target.closest('#pf-cal-days button');
  if(!btn) return;
  var day = parseInt(btn.getAttribute('data-day'));
  var selected = new Date(_calYear, _calMonth, day);
  if(_calMode === 'from'){
    _calFrom = selected;
    document.getElementById('pf-date-from-btn').textContent = (_calMonth+1)+'/'+day+'/'+_calYear;
    // Auto switch to 'to' mode
    _calMode = 'to';
    _renderCal();
  } else {
    _calTo = selected;
    document.getElementById('pf-date-to-btn').textContent = (_calMonth+1)+'/'+day+'/'+_calYear;
    document.getElementById('pf-cal-modal').style.display = 'none';
  }
});

// Close calendar when clicking outside
document.addEventListener('click', function(e){
  var modal = document.getElementById('pf-cal-modal');
  if(!modal || modal.style.display !== 'block') return;
  if(!e.target.closest('#pf-cal-modal') && !e.target.closest('#pf-date-from-btn') && !e.target.closest('#pf-date-to-btn')) {
    modal.style.display = 'none';
  }
});

// Custom button toggle
document.addEventListener('click', function(e){
  if(e.target.id === 'pf-custom-btn' || e.target.closest('#pf-custom-btn')){
    var r = document.getElementById('pf-custom-range');
    r.style.display = r.style.display === 'flex' ? 'none' : 'flex';
    document.getElementById('pf-cal-modal').style.display = 'none';
  }
});

// Update button labels when date changes  
document.addEventListener('change', function(e){
  if(e.target.id === 'pf-date-from'){
    var d = new Date(e.target.value);
    document.getElementById('pf-date-from-btn').textContent = (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
  }
  if(e.target.id === 'pf-date-to'){
    var d = new Date(e.target.value);
    document.getElementById('pf-date-to-btn').textContent = (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
  }
});
  
  // When to date is selected, auto-apply
  toInput.addEventListener('change', function(){
    applyBtn.click();
  });
  // Apply via event delegation
  document.addEventListener('click', function(e){
    if(e.target.id !== 'pf-custom-apply') return;
    var from = _calFrom || new Date();
    var to = _calTo || new Date();
    if(isNaN(from)||isNaN(to)||from>=to) return;
    var days = Math.round((to-from)/(1000*60*60*24));
    var n = Math.min(days, 30);
    var vals = [], labels = [];
    var base = 240000 + Math.random()*40000;
    for(var i=0;i<=n;i++){
      var d = new Date(from.getTime() + (to-from)*i/n);
      labels.push((d.getMonth()+1)+'/'+d.getDate());
      base += (Math.random()-0.45)*3000;
      vals.push(Math.round(base));
    }
    var mn = Math.min.apply(null,vals)-5000;
    var mx = Math.max.apply(null,vals)+5000;
    window._pfCustom = {vals:vals,labels:labels,yMin:mn,yMax:mx};
    // Style custom as active
    document.querySelectorAll('.pf-period').forEach(function(b){
      b.style.background='rgba(255,255,255,0.04)'; b.style.boxShadow='inset 0 0 0 2px var(--line)'; b.style.color='var(--t2)'; b.classList.remove('sel');
    });
    customBtn.style.background='var(--azure)'; customBtn.style.boxShadow='none'; customBtn.style.color='#fff'; customBtn.classList.add('sel');
    // Draw custom chart
    var W=800,H=200,rng=mx-mn;
    var pts=vals.map(function(v,i){return{x:i/(vals.length-1)*W,y:H-(v-mn)/rng*H};});
    document.getElementById('pf-line').setAttribute('d','M'+pts.map(function(p){return p.x+','+p.y;}).join(' L'));
    document.getElementById('pf-area').setAttribute('d','M'+pts.map(function(p){return p.x+','+p.y;}).join(' L')+' L'+W+','+H+' L0,'+H+' Z');
    document.getElementById('pf-y3').textContent=fmtK(mx);
    document.getElementById('pf-y2').textContent=fmtK(mn+(mx-mn)*0.66);
    document.getElementById('pf-y1').textContent=fmtK(mn+(mx-mn)*0.33);
    document.getElementById('pf-y0').textContent=fmtK(mn);
    var xl=document.getElementById('pf-xlabels'); xl.innerHTML='';
    var step=Math.max(1,Math.floor(vals.length/5));
    for(var i=0;i<vals.length;i+=step){var s=document.createElement('span');s.className='mono';s.style.cssText='font-size:10px;color:var(--t3);';s.textContent=labels[i];xl.appendChild(s);}
    window._pfPts=pts; window._pfVals=vals; window._pfLabels=labels;
  });
document.addEventListener('click', function(e){
  var tab = e.target.closest('.pf-tab');
  if(!tab) return;
  var key = tab.getAttribute('data-tab');
  document.querySelectorAll('.pf-tab').forEach(function(t){
    t.classList.remove('tk-tab--active'); t.style.fontWeight=''; t.style.color=''; t.style.boxShadow=''; t.style.background='';
  });
  tab.classList.add('tk-tab--active');
  ['assets','bids','watchlist','history'].forEach(function(k){
    var el = document.getElementById('pf-tab-'+k);
    if(el) el.style.display = k===key ? '' : 'none';
  });
});

/* Chart hover interaction — crosshair + dot + tooltip */
var pfChart = document.getElementById('pf-chart');
if(pfChart){
  pfChart.addEventListener('mousemove', function(e){
    var pts=window._pfPts, vals=window._pfVals, labels=window._pfLabels;
    if(!pts||!vals) return;
    var rect = pfChart.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var ratio = x / rect.width;
    var svgX = ratio * 800;
    var closest=0, minD=Infinity;
    for(var i=0;i<pts.length;i++){
      var d=Math.abs(pts[i].x-svgX);
      if(d<minD){minD=d;closest=i;}
    }
    var p=pts[closest];
    var ch=document.getElementById('pf-crosshair');
    var dot=document.getElementById('pf-dot');
    var tt=document.getElementById('pf-tooltip');
    if(ch){ch.setAttribute('x1',p.x);ch.setAttribute('x2',p.x);ch.style.display='';}
    if(dot){dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);dot.style.display='';}
    if(tt){
      var v=vals[closest];
      var fmtV=v>=1e6?'$'+(v/1e6).toFixed(2)+'M':'$'+(v/1e3).toFixed(1)+'k';
      document.getElementById('pf-tooltip-val').textContent=fmtV;
      document.getElementById('pf-tooltip-label').textContent=labels[closest]||'';
      tt.style.display='block';
      var tx=(p.x/800)*rect.width;
      var ty=(p.y/200)*rect.height;
      var ttW=tt.offsetWidth||80;
      tt.style.left=Math.max(0,Math.min(tx-ttW/2,rect.width-ttW))+'px';
      tt.style.top=Math.max(0,ty-50)+'px';
    }
  });
  pfChart.addEventListener('mouseleave', function(){
    var ch=document.getElementById('pf-crosshair');
    var dot=document.getElementById('pf-dot');
    var tt=document.getElementById('pf-tooltip');
    if(ch)ch.style.display='none';
    if(dot)dot.style.display='none';
    if(tt)tt.style.display='none';
  });
}

})();
