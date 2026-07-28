/* Material-style Date Range Picker for Portfolio */
(function(){
var _mode='from',_yr,_mo,_from=null,_to=null,_view='days'; // 'days','months','years'
var MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var MNF=['January','February','March','April','May','June','July','August','September','October','November','December'];
var DOW=['Su','Mo','Tu','We','Th','Fr','Sa'];

function el(id){ return document.getElementById(id); }
function fmt(d){ return (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear(); }
function sameDay(a,b){ return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }

function render(){
  var title=el('pf-cal-title'), grid=el('pf-cal-days');
  if(!title||!grid) return;

  // From/To labels
  var fl=el('pf-cal-from-label'), tl=el('pf-cal-to-label');
  if(fl) fl.textContent = _from ? fmt(_from) : 'Select';
  if(tl) tl.textContent = _to ? fmt(_to) : 'Select';

  // Box highlight
  var fb=el('pf-cal-from-box'),tb=el('pf-cal-to-box');
  if(fb){fb.style.background=_mode==='from'?'rgba(26,111,255,0.15)':'rgba(255,255,255,0.03)';fb.style.boxShadow=_mode==='from'?'inset 0 -2px 0 0 var(--azure)':'none';}
  if(tb){tb.style.background=_mode==='to'?'rgba(26,111,255,0.15)':'rgba(255,255,255,0.03)';tb.style.boxShadow=_mode==='to'?'inset 0 -2px 0 0 var(--azure)':'none';}

  // Apply button
  var ab=el('pf-cal-apply');
  if(ab){
    var ok=_from&&_to&&_from<_to;
    ab.style.opacity=ok?'1':'0.4';ab.style.pointerEvents=ok?'auto':'none';
  }

  if(_view==='years'){
    title.textContent = (_yr-4)+' – '+(_yr+7);
    grid.innerHTML='';
    grid.style.gridTemplateColumns='repeat(4,1fr)';
    for(var y=_yr-4;y<=_yr+7;y++){
      var b=document.createElement('button');
      b.textContent=y; b.setAttribute('data-year',y);
      b.style.cssText='height:40px;border:0;border-radius:8px;background:transparent;color:#fff;font-family:var(--font-mono);font-size:13px;cursor:pointer;';
      if(y===_yr){b.style.background='var(--azure)';b.style.fontWeight='700';}
      grid.appendChild(b);
    }
    return;
  }

  if(_view==='months'){
    title.textContent = _yr.toString();
    grid.innerHTML='';
    grid.style.gridTemplateColumns='repeat(4,1fr)';
    for(var m=0;m<12;m++){
      var b=document.createElement('button');
      b.textContent=MN[m]; b.setAttribute('data-month',m);
      b.style.cssText='height:40px;border:0;border-radius:8px;background:transparent;color:#fff;font-family:var(--font-sans);font-size:13px;cursor:pointer;';
      if(m===_mo){b.style.background='var(--azure)';b.style.fontWeight='700';}
      grid.appendChild(b);
    }
    return;
  }

  // Days view
  title.textContent = MNF[_mo]+' '+_yr;
  grid.innerHTML='';
  grid.style.gridTemplateColumns='repeat(7,1fr)';

  // Day headers
  DOW.forEach(function(d){
    var s=document.createElement('span');
    s.textContent=d;s.style.cssText='font-family:var(--font-mono);font-size:10px;color:var(--t3);padding:6px 0;text-align:center;';
    grid.appendChild(s);
  });

  var first=new Date(_yr,_mo,1).getDay();
  var dim=new Date(_yr,_mo+1,0).getDate();
  var today=new Date();

  for(var i=0;i<first;i++){grid.appendChild(document.createElement('span'));}

  for(var d=1;d<=dim;d++){
    var b=document.createElement('button');
    b.textContent=d; b.setAttribute('data-day',d);
    var dt=new Date(_yr,_mo,d);
    var isFrom=sameDay(_from,dt), isTo=sameDay(_to,dt);
    var inRange=_from&&_to&&dt>_from&&dt<_to;
    var isToday=sameDay(today,dt);

    var bg='transparent',clr='#fff',fw='400',rad='50%',outline='none';
    if(isFrom||isTo){bg='var(--azure)';clr='#fff';fw='700';}
    else if(inRange){bg='rgba(26,111,255,0.12)';rad='4px';}
    else if(isToday){outline='1px solid var(--azure)';}

    b.style.cssText='width:36px;height:36px;border:0;border-radius:'+rad+';background:'+bg+';color:'+clr+';font-family:var(--font-mono);font-size:13px;font-weight:'+fw+';cursor:pointer;outline:'+outline+';margin:1px auto;display:flex;align-items:center;justify-content:center;transition:background 0.1s;';
    grid.appendChild(b);
  }
}

// Open
window._pfCalOpen = function(){
  _mode='from';_from=null;_to=null;_view='days';
  var now=new Date();_yr=now.getFullYear();_mo=now.getMonth();
  render();
  el('pf-cal-overlay').style.display='flex';
  // Set input values
  var fi=el('pf-cal-from-input'),ti=el('pf-cal-to-input');
  if(fi)fi.value='';if(ti)ti.value='';
};

// Navigation
function nav(dir){
  if(_view==='years'){_yr+=dir*12;}
  else if(_view==='months'){_yr+=dir;}
  else{_mo+=dir;if(_mo<0){_mo=11;_yr--;}if(_mo>11){_mo=0;_yr++;}}
  render();
}

// Parse date from input
function parseInput(val){
  if(!val)return null;
  var parts=val.replace(/[^0-9\/\-]/g,'').split(/[\/\-]/);
  if(parts.length===3){
    var m=parseInt(parts[0])-1,d=parseInt(parts[1]),y=parseInt(parts[2]);
    if(y<100)y+=2000;
    if(!isNaN(m)&&!isNaN(d)&&!isNaN(y)&&m>=0&&m<12&&d>=1&&d<=31)return new Date(y,m,d);
  }
  return null;
}

// Event delegation
document.addEventListener('click',function(e){
  var ov=el('pf-cal-overlay');
  if(!ov)return;

  // Open
  if(e.target.id==='pf-custom-btn'||e.target.closest('#pf-custom-btn')){
    window._pfCalOpen();return;
  }
  // Close
  if(e.target.id==='pf-cal-close'||e.target.closest('#pf-cal-close')){ov.style.display='none';return;}
  if(e.target===ov){ov.style.display='none';return;}

  // From/To box switch
  if(e.target.closest('#pf-cal-from-box')){_mode='from';render();return;}
  if(e.target.closest('#pf-cal-to-box')){_mode='to';render();return;}

  // Title click → toggle view
  if(e.target.id==='pf-cal-title'){
    if(_view==='days')_view='months';
    else if(_view==='months')_view='years';
    else _view='days';
    render();return;
  }

  // Nav
  if(e.target.closest('[data-cal-prev]')){nav(-1);return;}
  if(e.target.closest('[data-cal-next]')){nav(1);return;}

  // Year pick
  var yrBtn=e.target.closest('#pf-cal-days [data-year]');
  if(yrBtn){_yr=parseInt(yrBtn.getAttribute('data-year'));_view='months';render();return;}

  // Month pick
  var moBtn=e.target.closest('#pf-cal-days [data-month]');
  if(moBtn){_mo=parseInt(moBtn.getAttribute('data-month'));_view='days';render();return;}

  // Day pick
  var dayBtn=e.target.closest('#pf-cal-days [data-day]');
  if(dayBtn){
    var day=parseInt(dayBtn.getAttribute('data-day'));
    var sel=new Date(_yr,_mo,day);
    if(_mode==='from'){
      _from=sel;_mode='to';
      var fi=el('pf-cal-from-input');if(fi)fi.value=fmt(sel);
    }else{
      _to=sel;
      var ti=el('pf-cal-to-input');if(ti)ti.value=fmt(sel);
    }
    render();return;
  }

  // Apply
  if(e.target.id==='pf-cal-apply'){
    if(!_from||!_to||_from>=_to)return;
    ov.style.display='none';
    // Fire custom event
    if(window._pfCalApply) window._pfCalApply(_from,_to);
    return;
  }
});

// Input change
document.addEventListener('input',function(e){
  if(e.target.id==='pf-cal-from-input'){
    var d=parseInput(e.target.value);
    if(d){_from=d;_yr=d.getFullYear();_mo=d.getMonth();render();}
  }
  if(e.target.id==='pf-cal-to-input'){
    var d=parseInput(e.target.value);
    if(d){_to=d;render();}
  }
});

// Apply callback
window._pfCalApply = function(from,to){
  var days=Math.round((to-from)/(1e3*60*60*24));
  var n=Math.min(days,30),vals=[],labels=[];
  var base=240000+Math.random()*40000;
  for(var i=0;i<=n;i++){
    var dd=new Date(from.getTime()+(to-from)*i/n);
    labels.push((dd.getMonth()+1)+'/'+dd.getDate());
    base+=(Math.random()-0.45)*3000;vals.push(Math.round(base));
  }
  var mn=Math.min.apply(null,vals)-5000,mx=Math.max.apply(null,vals)+5000;
  document.querySelectorAll('.pf-period').forEach(function(b){
    b.style.background='rgba(255,255,255,0.04)';b.style.color='var(--t2)';b.classList.remove('sel');
  });
  var cb=document.getElementById('pf-custom-btn');
  if(cb){cb.style.background='var(--azure)';cb.style.color='#fff';cb.classList.add('sel');
    // Show selected range on button
    cb.textContent = (from.getMonth()+1)+'/'+from.getDate()+' – '+(to.getMonth()+1)+'/'+to.getDate()+'/'+to.getFullYear();
  }
  var W=800,H=200,rng=mx-mn;
  var pts=vals.map(function(v,i){return{x:i/(vals.length-1)*W,y:H-(v-mn)/rng*H};});
  var fmtK=function(v){return v>=1e6?'$'+(v/1e6).toFixed(1)+'M':'$'+(v/1e3).toFixed(0)+'k';};
  document.getElementById('pf-line').setAttribute('d','M'+pts.map(function(p){return p.x+','+p.y;}).join(' L'));
  document.getElementById('pf-area').setAttribute('d','M'+pts.map(function(p){return p.x+','+p.y;}).join(' L')+' L'+W+','+H+' L0,'+H+' Z');
  document.getElementById('pf-y3').textContent=fmtK(mx);
  document.getElementById('pf-y2').textContent=fmtK(mn+(mx-mn)*0.66);
  document.getElementById('pf-y1').textContent=fmtK(mn+(mx-mn)*0.33);
  document.getElementById('pf-y0').textContent=fmtK(mn);
  var xl=document.getElementById('pf-xlabels');xl.innerHTML='';
  var step=Math.max(1,Math.floor(vals.length/5));
  for(var j=0;j<vals.length;j+=step){var s=document.createElement('span');s.className='mono';s.style.cssText='font-size:10px;color:var(--t3);';s.textContent=labels[j];xl.appendChild(s);}
  window._pfPts=pts;window._pfVals=vals;window._pfLabels=labels;
};
})();
