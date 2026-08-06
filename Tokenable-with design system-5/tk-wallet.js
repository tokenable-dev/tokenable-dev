/* Partner accounts have their own portfolio page — resolve nav hrefs once */
(function(){
  if(window.tkPortfolioHref) return;
  var partner=false;
  try{ partner = localStorage.getItem('tk_partner_status')==='approved'; }catch(_){}
  window.tkIsPartner = partner;
  window.tkPortfolioHref = function(hash){
    return (partner ? 'Partner-Portfolio.html' : 'Portfolio.html') + (hash||'');
  };
})();
/* tk-wallet.js — Shared wallet connect + dropdown menu */
(function(){

/* ---- State ---- */
function isConnected(){ return localStorage.getItem('tk-wallet')==='1'; }
function isReturning(){ return localStorage.getItem('tk-wallet-ever')==='1'; }

/* ---- Inject dropdown HTML into each .tk-wallet-wrap ---- */
function injectDropdown(wrap){
  if(wrap.querySelector('.tk-wallet-dropdown')) return;
  var dd = document.createElement('div');
  dd.className = 'tk-wallet-dropdown';
  dd.innerHTML = [
    '<!-- User info -->',
    '<div style="padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.06);">',
    '  <div style="display:flex;align-items:center;gap:10px;">',
    '    <span style="width:32px;height:32px;flex:none;background:linear-gradient(135deg,var(--azure),var(--brand-400));border-radius:8px;display:flex;align-items:center;justify-content:center;">',
    '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    '    </span>',
    '    <div style="flex:1;min-width:0;">',
    '      <div style="display:flex;align-items:center;gap:6px;">',
    '        <span style="font-family:var(--font-sans);font-size:14px;font-weight:600;color:#fff;">0xF4\u20269aE2</span>',
    '      </div>',
    '      <div style="font-family:var(--font-mono);font-size:11px;color:var(--pos);margin-top:2px;">KYC: \u2713 Verified</div>',
    '    </div>',
'      <button class="tk-copy-addr" type="button" aria-label="Copy address" title="Copy address" data-addr="0xF4b93C1a7e2D5f08A3c6E19b4D7a02c58Ce29aE2" style="width:26px;height:26px;flex:none;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.07);border:0;border-radius:7px;color:rgba(255,255,255,0.6);cursor:pointer;">',
    '        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    '      </button>',
    '  </div>',
    '</div>',
    '<!-- Menu items -->',
    '<a href="' + window.tkPortfolioHref() + '" class="tk-wd-item">',
    '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg>',
    '  My Portfolio',
    '</a>',
    '<a href="' + window.tkPortfolioHref('?tab=bids') + '" class="tk-wd-item tk-wd-sub">',
    '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
    '  Active Bids',
    '</a>',
    '<a href="' + window.tkPortfolioHref('?tab=history') + '" class="tk-wd-item tk-wd-sub">',
    '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    '  Transaction History',
    '</a>',
    '<a href="Watchlist.html" class="tk-wd-item">',
    '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
    '  Watchlist',
    '</a>',
    '<a href="#" class="tk-wd-item" onclick="return false;">',
    '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    '  Notifications',
    '</a>',
    '<a href="#" class="tk-wd-item" onclick="return false;">',
    '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    '  Settings',
    '</a>',
    '<div class="tk-wd-divider"></div>',
    '<div class="tk-wd-item tk-wallet-disconnect" style="color:#E4374A;">',
    '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
    '  Sign Out',
    '</div>'
  ].join('\n');
  wrap.appendChild(dd);
}

/* ---- Inject mobile wallet section into drawer ---- */
function injectMobileWallet(){
  var drawer = document.querySelector('.gnb-drawer');
  if(!drawer || drawer.querySelector('.tk-mobile-wallet-section')) return;

  var section = document.createElement('div');
  section.className = 'tk-mobile-wallet-section';
  section.style.cssText = 'display:none;padding:0 16px 16px;';
  section.innerHTML = [
    '<div style="display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:8px;">',
    '  <span style="width:32px;height:32px;flex:none;background:linear-gradient(135deg,var(--azure),var(--brand-400));border-radius:8px;display:flex;align-items:center;justify-content:center;">',
    '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    '  </span>',
    '  <div style="flex:1;min-width:0;">',
    '    <div style="font-family:var(--font-sans);font-size:14px;font-weight:600;color:#fff;">0xF4\u20269aE2</div>',
    '    <div style="font-family:var(--font-mono);font-size:11px;color:var(--pos);margin-top:2px;">KYC: \u2713 Verified</div>',
    '  </div>',
'      <button class="tk-copy-addr" type="button" aria-label="Copy address" title="Copy address" data-addr="0xF4b93C1a7e2D5f08A3c6E19b4D7a02c58Ce29aE2" style="width:26px;height:26px;flex:none;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.07);border:0;border-radius:7px;color:rgba(255,255,255,0.6);cursor:pointer;">',
    '        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    '      </button>',
    '  <div class="mono" style="font-size:13px;font-weight:700;color:var(--pos);">2.41 ETH</div>',
    '</div>',
    '<a href="' + window.tkPortfolioHref() + '" class="tk-mw-link">',
    '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg>',
    '  My Portfolio',
    '</a>',
    '<a href="' + window.tkPortfolioHref('#bids') + '" class="tk-mw-link" style="padding-left:16px;font-size:14px;color:rgba(255,255,255,0.6);">',
    '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
    '  Active Bids',
    '</a>',
    '<a href="' + window.tkPortfolioHref('#history') + '" class="tk-mw-link" style="padding-left:16px;font-size:14px;color:rgba(255,255,255,0.6);">',
    '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    '  Transaction History',
    '</a>',
    '<a href="Watchlist.html" class="tk-mw-link">',
    '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
    '  Watchlist',
    '</a>',
    '<a href="#" class="tk-mw-link" onclick="return false;">',
    '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    '  Notifications',
    '</a>',
    '<a href="#" class="tk-mw-link" onclick="return false;">',
    '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    '  Settings',
    '</a>',
    '<div style="height:1px;background:rgba(255,255,255,0.06);margin:8px 0;"></div>',
    '<div class="tk-mw-link tk-mobile-disconnect" style="color:#E4374A;">',
    '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
    '  Sign Out',
    '</div>'
  ].join('\n');

  // Insert before the bottom connect button area
  var bottomArea = drawer.querySelector('[style*="border-top"]');
  if(bottomArea) drawer.insertBefore(section, bottomArea);
  else drawer.appendChild(section);
}

/* ---- Apply state ---- */
function apply(){
  var on = isConnected();
  var ever = isReturning();
  var label = ever ? 'Sign in' : 'Sign up';

  document.querySelectorAll('.tk-connect').forEach(function(b){
    b.style.display = on ? 'none' : 'inline-flex';
    b.textContent = label;
  });
  document.querySelectorAll('.tk-wallet-chip').forEach(function(c){
    c.style.display = on ? 'inline-flex' : 'none';
  });
  localStorage.setItem('tk-wallet-connected', on ? '1' : '0');
  // Update mobile drawer profile
  var tkmProfile = document.getElementById('tkm-profile');
  var tkmConnect = document.getElementById('tkm-connect');
  if(tkmProfile) tkmProfile.style.display = on ? 'block' : 'none';
  if(tkmConnect) tkmConnect.style.display = on ? 'none' : 'block';
  // Mobile wallet section
  document.querySelectorAll('.tk-mobile-wallet-section').forEach(function(s){
    s.style.display = on ? 'block' : 'none';
  });
}

window.tkWallet = function(v){
  try {
    localStorage.setItem('tk-wallet', v ? '1' : '0');
    if(v) localStorage.setItem('tk-wallet-ever', '1');
  } catch(e){}
  apply();
  // Close dropdown
  document.querySelectorAll('.tk-wallet-dropdown').forEach(function(d){ delete d.dataset.open; });
};

/* ---- Click handler ---- */
document.addEventListener('click', function(e){
  var t = e.target;

  // Sign in / Sign up → go to the login screen (Login.html handles the account
  // type choice and sets tk_role). Skip on Login.html itself.
  if(t.closest && t.closest('.tk-connect')){
    var here = (location.pathname.split('/').pop()||'').toLowerCase();
    if(here !== 'login.html'){ window.location.href = 'Login.html'; return; }
    tkWallet(true);
    return;
  }

  // Desktop disconnect
  if(t.closest && t.closest('.tk-wallet-disconnect')){
    tkWallet(false);
    return;
  }

  // Mobile disconnect
  if(t.closest && t.closest('.tk-mobile-disconnect')){
    tkWallet(false);
    return;
  }

  // Wallet chip → toggle dropdown
  if(t.closest && t.closest('.tk-wallet-chip')){
    var wrap = t.closest('.tk-wallet-wrap');
    var dd = wrap && wrap.querySelector('.tk-wallet-dropdown');
    if(dd){
      var wasOpen = dd.dataset.open;
      document.querySelectorAll('.tk-wallet-dropdown').forEach(function(d){ delete d.dataset.open; });
      if(!wasOpen) dd.dataset.open = '1';
    }
    return;
  }

  // Outside click → close dropdown
  if(!t.closest || !t.closest('.tk-wallet-wrap')){
    document.querySelectorAll('.tk-wallet-dropdown').forEach(function(d){ delete d.dataset.open; });
  }
}, false);

/* ---- Init ---- */
function init(){
  document.querySelectorAll('.tk-wallet-wrap').forEach(injectDropdown);
  injectMobileWallet();
  apply();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
/* Poll to catch late-rendered DOM (DC host) */
var initTries = 0;
var initPoll = setInterval(function(){
  document.querySelectorAll('.tk-wallet-wrap').forEach(injectDropdown);
  injectMobileWallet();
  apply();
  initTries++;
  if(initTries > 20) clearInterval(initPoll);
}, 500);
setInterval(apply, 400);

/* ---- Inject CSS ---- */
var style = document.createElement('style');
style.textContent = [
  '.tk-wallet-dropdown{display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:220px;background:#191919;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);padding:8px 0;z-index:100;}',
  '.tk-wallet-dropdown[data-open]{display:block!important;}',
  '.tk-wd-item{display:flex;align-items:center;gap:12px;padding:12px 16px;color:#fff;text-decoration:none;font-family:var(--font-sans);font-size:14px;transition:background 0.1s;cursor:pointer;}',
  '.tk-wd-item:hover{background:rgba(255,255,255,0.06);}',
  '.tk-wd-sub{padding-left:32px;font-size:13px;color:rgba(255,255,255,0.6);}',
  '.tk-wd-sub:hover{color:#fff;}',
  '.tk-wd-divider{height:1px;background:rgba(255,255,255,0.08);margin:4px 0;}',
  '.tk-mw-link{display:flex;align-items:center;gap:12px;padding:14px 0;color:#fff;text-decoration:none;font-family:var(--font-sans);font-size:15px;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;}',
  '.tk-mw-link:last-child{border-bottom:none;}',
  '.tk-mw-link:active{opacity:0.7;}'
].join('\n');
document.head.appendChild(style);

})();
