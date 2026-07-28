/* tk-role-nav.js — retitles the GNB for partner accounts, in place.
   Collector accounts keep Markets / Portfolio / Sell.
   Partner accounts (tk_role === 'partner') see Markets / Inventory / Add cards / Withdrawals
   + a PARTNER badge. Mutates existing anchors only (no node replacement) to stay
   compatible with the DC host's rendering. */
(function(){
  function role(){ try{ return localStorage.getItem('tk_role')||'user'; }catch(e){ return 'user'; } }
  function approved(){ try{ return localStorage.getItem('tk_partner_status')==='approved'; }catch(e){ return false; } }
  // Partner nav only for a signed-in AND approved partner. Everyone else keeps
  // the collector nav (Markets / Portfolio / Sell).
  if(role()!=='partner' || !approved()) return;

  var here=(location.pathname.split('/').pop()||'').toLowerCase();
  // maps the app's default 3 nav links to partner equivalents (by current href)
  var MAP={
    'markets.html':               { label:'Markets',     href:'Markets.html' },
    'portfolio.html':             { label:'Inventory',   href:'Portfolio.html' },
    'sell.html':                  { label:'Add cards',   href:'Partner-Add-Cards.html' },
    'vault-dashboard-active.html':{ label:'Add cards',   href:'Partner-Add-Cards.html' }
  };

  function retitle(scope){
    var done=false;
    var anchors=scope.querySelectorAll('a.navlink');
    if(!anchors.length) return false;
    anchors.forEach(function(a){
      var h=(a.getAttribute('href')||'').toLowerCase();
      var m=MAP[h];
      if(m){
        // Write only on change — unconditional writes would re-trigger the observer.
        if(a.textContent!==m.label) a.textContent=m.label;
        if(a.getAttribute('href')!==m.href) a.setAttribute('href',m.href);
        done=true;
      }
      var nowH=(a.getAttribute('href')||'').toLowerCase();
      var shouldBeOn=(nowH===here);
      if(a.classList.contains('on')!==shouldBeOn) a.classList.toggle('on', shouldBeOn);
    });
    return done;
  }

  function addBadge(){
    if(document.getElementById('tk-role-badge')) return;
    var logo=document.querySelector('header a[href="index.html"]');
    if(!logo || !logo.parentNode) return;
    var b=document.createElement('span');
    b.id='tk-role-badge'; b.textContent='PARTNER';
    b.style.cssText='margin-left:12px;padding:4px 9px;border-radius:6px;background:rgba(26,111,255,0.14);color:#5B9AFF;font-size:10px;font-weight:700;letter-spacing:0.08em;font-family:"JetBrains Mono",monospace;';
    logo.parentNode.insertBefore(b, logo.nextSibling);
  }

  var applying=false;
  function applyAll(){
    if(applying) return false;
    applying=true;
    var ok=false;
    try{
      var nav=document.querySelector('.gnb-nav');
      if(nav) ok=retitle(nav);
      var drawer=document.querySelector('.gnb-drawer');
      if(drawer) retitle(drawer);
      addBadge();
    }catch(e){}
    applying=false;
    return ok;
  }
  // Idempotent re-apply: writes happen only when a value actually differs, so a
  // slow poll costs nothing while surviving header re-renders (live ticker, host).
  applyAll();
  setInterval(applyAll, 1000);
})();
