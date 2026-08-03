/* tk-mobile-nav.js — Unified mobile navigation drawer */
(function(){
  if(window.__tkMobileDrawerV2) return;
  window.__tkMobileDrawerV2 = true;

  var path = window.location.pathname.split('/').pop() || 'index.html';
  var activeNav = '';
  if(path.indexOf('Market') !== -1 || path.indexOf('Card') !== -1) activeNav = 'Markets';
  else if(path.indexOf('Portfolio') !== -1) activeNav = 'Portfolio';
  else if(path.indexOf('Vault') !== -1 || path.indexOf('KYC') !== -1) activeNav = 'Vault';

  /* SVG icons (tabler outline style, 20x20) */
  var icons = {
    markets: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    portfolio: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    vault: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    bids: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    history: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    watchlist: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    notifications: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    signout: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
  };

  var css = document.createElement('style');
  css.textContent = [
    '.tkm-overlay{display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,0.4);}',
    '.tkm-overlay.open{display:block;}',
    '.tkm-drawer{position:fixed;top:0;right:0;bottom:0;width:100vw;z-index:8001;background:#111;display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);overflow-y:auto;-webkit-overflow-scrolling:touch;}',
    '.tkm-drawer.open{transform:translateX(0);}',
    '.tkm-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;flex-shrink:0;}',
    '.tkm-close{width:40px;height:40px;border:0;background:rgba(255,255,255,0.06);border-radius:10px;color:rgba(255,255,255,0.6);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:background 0.15s;}',
    '.tkm-close:hover{background:rgba(255,255,255,0.12);color:#fff;}',
    '.tkm-profile{margin:0 16px 4px;padding:14px 16px;background:#1A2332;border-radius:14px;display:flex;align-items:center;}',
    '.tkm-profile__top{display:flex;align-items:center;gap:12px;}',
    '.tkm-profile__avatar{width:36px;height:36px;flex-shrink:0;background:var(--azure,#1A6FFF);border-radius:8px;display:flex;align-items:center;justify-content:center;}',
    '.tkm-profile__info{flex:1;min-width:0;}',
    '.tkm-profile__addr{font-family:var(--font-mono,"JetBrains Mono",monospace);font-size:14px;font-weight:600;color:#fff;display:block;}',
    '.tkm-profile__kyc{font-size:11px;color:rgba(255,255,255,0.35);display:flex;align-items:center;gap:4px;margin-top:2px;}',
    '.tkm-profile__kyc svg{color:var(--azure,#1A6FFF);}',
    '.tkm-profile__bal{font-family:var(--font-mono,"JetBrains Mono",monospace);font-size:13px;font-weight:700;color:var(--pos,#00C350);flex-shrink:0;}',
    '.tkm-connect{margin:0 16px 4px;}',
    '.tkm-nav{padding:0 8px;}',
    '.tkm-item{display:flex;align-items:center;gap:16px;height:56px;padding:0 16px;font-family:var(--font-sans,"Inter",sans-serif);font-size:16px;font-weight:500;color:rgba(255,255,255,0.55);text-decoration:none;border-radius:0;transition:all 0.12s;border-left:3px solid transparent;cursor:pointer;}',
    '.tkm-item:hover{background:rgba(255,255,255,0.04);color:#fff;}',
    '.tkm-item.active{color:#fff;font-weight:600;border-left-color:var(--azure,#1A6FFF);background:rgba(26,111,255,0.06);}',
    '.tkm-item svg{flex-shrink:0;opacity:0.5;}',
    '.tkm-item.active svg{opacity:0.8;}',
    '.tkm-item--sub{height:48px;padding-left:52px;font-size:14px;color:rgba(255,255,255,0.35);}',
    '.tkm-item--sub:hover{color:rgba(255,255,255,0.6);}',
    '.tkm-divider{height:1px;background:rgba(255,255,255,0.06);margin:8px 16px;}',
    '.tkm-signout{display:flex;align-items:center;gap:16px;height:56px;padding:0 24px;font-size:15px;font-weight:500;color:var(--neg,#E4374A);cursor:pointer;border:0;background:none;width:100%;text-align:left;font-family:var(--font-sans,"Inter",sans-serif);}',
    '.tkm-signout:hover{background:rgba(228,55,74,0.06);}',
    '.tkm-signout svg{opacity:0.7;flex-shrink:0;}',
    '@media(min-width:881px){.tkm-overlay,.tkm-drawer{display:none!important;}}'
  ].join('\n');
  document.head.appendChild(css);

  var overlay = document.createElement('div');
  overlay.className = 'tkm-overlay';
  overlay.id = 'tkm-overlay';
  document.body.appendChild(overlay);

  var drawer = document.createElement('div');
  drawer.className = 'tkm-drawer';
  drawer.id = 'tkm-drawer';
  drawer.innerHTML = [
    '<div class="tkm-header">',
    '  <a href="index.html" id="tkm-logo" style="display:flex;"><img src="images/symbol-white.svg" alt="T" style="height:28px;"></a>',
    '  <button class="tkm-close" id="tkm-close">&times;</button>',
    '</div>',
    '<div class="tkm-profile" id="tkm-profile">',
    '  <div class="tkm-profile__top" style="width:100%;">',
    '    <div class="tkm-profile__avatar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg></div>',
    '    <div class="tkm-profile__info" style="flex:1;"><span class="tkm-profile__addr">0xF4\u20269aE2</span><span class="tkm-profile__kyc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Verified</span></div>',
    '    <span class="tkm-profile__bal">2.41 ETH</span>',
    '  </div>',
    '</div>',
    '<div class="tkm-connect" id="tkm-connect" style="display:none;"><button class="tk-btn tk-btn--primary tk-connect" style="height:48px;width:100%;font-size:15px;">Connect Wallet</button></div>',
    '<div class="tkm-divider"></div>',
    '<nav class="tkm-nav">',
    '  <a class="tkm-item' + (activeNav==='Markets'?' active':'') + '" href="Markets.html">' + icons.markets + 'Markets</a>',
    '  <a class="tkm-item' + (activeNav==='Portfolio'?' active':'') + '" href="Portfolio.html">' + icons.portfolio + 'Portfolio</a>',
    '  <a class="tkm-item' + (activeNav==='Vault'?' active':'') + '" href="Vault-Dashboard-Active.html">' + icons.vault + 'Vault</a>',
    '</nav>',
    '<div class="tkm-divider"></div>',
    '<nav class="tkm-nav">',
    '  <a class="tkm-item" href="Watchlist.html">' + icons.watchlist + 'Watchlist</a>',
    '  <a class="tkm-item" href="#" id="tkm-notifications">' + icons.notifications + 'Notifications</a>',
    '  <a class="tkm-item" href="#">' + icons.settings + 'Settings</a>',
    '</nav>',
    '<div class="tkm-divider"></div>',
    '<button class="tkm-signout" id="tkm-signout">' + icons.signout + 'Sign Out</button>'
  ].join('\n');
  document.body.appendChild(drawer);

  function openDrawer(){
    overlay.classList.add('open');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
    var wc = document.querySelector('.tk-wallet-chip');
    var connected = false;
    if(wc){
      // Check inline style or localStorage for wallet state
      var inlineDisplay = wc.style.display;
      connected = inlineDisplay === 'flex' || localStorage.getItem('tk-wallet-connected') === '1';
    }
    document.getElementById('tkm-profile').style.display = connected ? 'block' : 'none';
    document.getElementById('tkm-connect').style.display = connected ? 'none' : 'block';
    if(connected && wc){
      var spans = wc.querySelectorAll('.mono');
      if(spans[0]) document.querySelector('.tkm-profile__addr').textContent = spans[0].textContent;
      if(spans[1]) document.querySelector('.tkm-profile__bal').textContent = spans[1].textContent;
    }
  }
  function closeDrawer(){
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }
  window.openMobileDrawer = openDrawer;
  window.closeMobileDrawer = closeDrawer;

  document.addEventListener('click', function(e){
    if(e.target.closest('#tkm-close') || e.target === overlay) closeDrawer();
    if(e.target.closest('.gnb-burger')){ e.preventDefault(); e.stopPropagation(); var old=document.querySelector('.gnb-drawer'); if(old) old.classList.remove('open'); openDrawer(); }
    if(e.target.closest('#tkm-logo')) closeDrawer();
    if(e.target.closest('#tkm-notifications')){ e.preventDefault(); closeDrawer(); if(window.tkOpenNotifications) tkOpenNotifications(); }
    if(e.target.closest('#tkm-signout')){ closeDrawer(); if(window.tkDisconnectWallet) tkDisconnectWallet(); }
  }, true);
})();
