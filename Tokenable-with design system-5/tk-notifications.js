/* tk-notifications.js — Notification drawer for all pages */
(function(){

var IS_PARTNER = (function(){ try{ return localStorage.getItem('tk_partner_status')==='approved'; }catch(_){ return false; } })();

var PARTNER_NOTIFS = [
  { type:'vault', icon:'box', color:'#EA8200', title:'New redeem request', desc:'Daniel Reyes redeemed 1999 Charizard Holo \u00b7 PSA 10. Ship it and add tracking within 5 days.', time:'Just now', img:'images/card-charizard.png', href:'Partner-Shipments.html', cta:{label:'Manage shipment', href:'Partner-Shipments.html'} },
  { type:'vault', icon:'box', color:'#EA8200', title:'New redeem request', desc:'Mina Park redeemed 3 cards. One shipment, one tracking number.', time:'12 min ago', img:'images/card-pikachu-ex.png', href:'Partner-Shipments.html', cta:{label:'Manage shipment', href:'Partner-Shipments.html'} },
  { type:'vault', icon:'shield', color:'#EA8200', title:'Shipment due within 24h', desc:'Mina Park\u2019s shipment is due soon \u2014 ship now to avoid auto-cancellation.', time:'1 hour ago', href:'Partner-Shipments.html', cta:{label:'Open redeem requests', href:'Partner-Shipments.html'} }
];

var NOTIFS = [
  { type:'bid', icon:'layer', color:'#1A6FFF', title:'Top bid updated', desc:'The highest bid on your 1999 Charizard Holo \u00b7 PSA 10 is now $399,000.', time:'Just now', img:'images/card-charizard.png', cta:{ label:'Edit price', href:'Portfolio.html?setprice='+encodeURIComponent('1999 Pok\u00e9mon Base Set #4 Charizard Holo \u00b7 PSA 10')+'&val=420000&bid=399000' } },
  { type:'vault', icon:'shield', color:'#1A6FFF', title:'Redemption confirmed', desc:'Payment received \u2014 your cards are being prepared for shipping.', time:'5 min ago', img:'images/card-pikachu.png', cta:{ label:'Confirm & pay', href:'Redeem.html?state=pay' } },
  { type:'trade', icon:'check', color:'#00C350', title:'Trade Confirmed', desc:'Your purchase of Charizard 1st Ed Base Set PSA 10 has been confirmed.', time:'2 min ago', img:'images/card-charizard.png' },
  { type:'bid', icon:'layer', color:'#1A6FFF', title:'Bid Accepted', desc:'Your bid of $58,000 on LeBron James Rookie Chrome BGS 9.5 was accepted.', time:'1 hour ago', img:'images/card-lebron.png' },
  { type:'price', icon:'trend', color:'#EA8200', title:'Price Alert', desc:'Pikachu ex Surging Sparks PSA 10 is up +12% in the last 24 hours.', time:'3 hours ago', img:'images/card-pikachu.png' },
  { type:'vault', icon:'shield', color:'#1A6FFF', title:'Card Vaulted', desc:'Your Luka Dončić Blue Ice Prizm BGS 9.5 has been received and vaulted.', time:'Yesterday' },
  { type:'trade', icon:'check', color:'#00C350', title:'Sale Complete', desc:'Nidoking ex PSA 10 sold for $58,000. Funds deposited to your wallet.', time:'2 days ago', img:'images/card-nidoking.jpg' },
  { type:'bid', icon:'layer', color:'#1A6FFF', title:'New Bid Received', desc:'You received a bid of $400,000 on Charizard 1st Ed Base Set PSA 10.', time:'3 days ago' },
  { type:'vault', icon:'shield', color:'#1A6FFF', title:'Insurance Renewed', desc:'Vault insurance for all 23 assets has been renewed for another year.', time:'1 week ago' },
  { type:'price', icon:'trend', color:'#EA8200', title:'Market Update', desc:'The PSA 10 Charizard index is up +5.2% this week. View market trends.', time:'1 week ago' },
  { type:'trade', icon:'check', color:'#00C350', title:'Trade Settled', desc:'Your purchase of Pikachu VMAX Rainbow PSA 10 has settled on-chain.', time:'2 weeks ago', img:'images/card-pikachu-ex.png' },
];

var FILTERS = [
  { key:'all', label:'All' },
  { key:'trade', label:'Trade' },
  { key:'bid', label:'Bid' },
  { key:'vault', label:'Vault' },
  { key:'price', label:'Price Alert' },
];

var ICONS = {
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
  layer: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  trend: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  box: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/></svg>',
};

function activeNotifs(){ return IS_PARTNER ? PARTNER_NOTIFS.concat(NOTIFS) : NOTIFS; }

function buildDrawer(){
  var overlay = document.createElement('div');
  overlay.id = 'tk-notif-overlay';
  
  var panel = document.createElement('div');
  panel.id = 'tk-notif-panel';
  
  // Header
  var header = '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;">' +
    '<span style="font-family:var(--font-sans);font-size:20px;font-weight:700;color:#fff;">Notifications</span>' +
    '<button id="tk-notif-close" style="width:36px;height:36px;border:0;background:rgba(255,255,255,0.06);border-radius:8px;cursor:pointer;color:rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';

  // Filters
  var filters = '<div style="display:flex;gap:6px;padding:0 24px 16px;overflow-x:auto;-webkit-overflow-scrolling:touch;">';
  FILTERS.forEach(function(f){
    var active = f.key === 'all';
    filters += '<button class="tk-notif-filter" data-filter="'+f.key+'" style="flex-shrink:0;height:32px;padding:0 14px;border:0;border-radius:8px;font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;' +
      (active ? 'background:#1A6FFF;color:#fff;' : 'background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);') +
      'transition:all 0.15s;">'+f.label+'</button>';
  });
  filters += '</div>';

  // Divider
  var divider = '<div style="height:1px;background:rgba(255,255,255,0.06);margin:0 24px;"></div>';

  // Section label
  var sectionLabel = '<div style="padding:16px 24px 8px;font-family:var(--font-mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-weight:600;">Recent</div>';

  // Notification items
  var items = '<div id="tk-notif-list" style="flex:1;overflow-y:auto;padding:0 24px 24px;">';
  activeNotifs().forEach(function(n){
    items += '<div class="tk-notif-item" data-type="'+n.type+'"'+(n.href?' data-href="'+n.href+'"':'')+' style="display:flex;gap:14px;padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;transition:background 0.1s;">' +
      '<div style="width:40px;height:40px;flex-shrink:0;border-radius:10px;background:rgba('+hexToRgb(n.color)+',0.12);display:flex;align-items:center;justify-content:center;color:'+n.color+';">'+ICONS[n.icon]+'</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">' +
          '<span style="font-family:var(--font-sans);font-size:14px;font-weight:600;color:#fff;">'+n.title+'</span>' +
          (n.img ? '<img src="'+n.img+'" style="width:44px;height:60px;object-fit:contain;flex-shrink:0;border-radius:4px;background:#101018;padding:2px;">' : '') +
        '</div>' +
        '<p style="margin:4px 0 0;font-family:var(--font-sans);font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+n.desc+'</p>' +
        '<span style="font-family:var(--font-mono);font-size:11px;color:rgba(255,255,255,0.25);margin-top:6px;display:block;">'+n.time+'</span>' +
        (n.cta ? '<a href="'+n.cta.href+'" style="display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 18px;margin-top:12px;background:#1A6FFF;color:#fff;font-family:var(--font-sans);font-size:13px;font-weight:600;border-radius:8px;text-decoration:none;box-shadow:inset 0 0 0 1px rgba(80,160,255,0.5);">'+n.cta.label+'</a>' : '') +
      '</div></div>';
  });
  items += '</div>';

  panel.innerHTML = header + filters + divider + sectionLabel + items;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Event: close
  document.getElementById('tk-notif-close').addEventListener('click', closeNotif);
  overlay.addEventListener('click', function(e){ if(e.target === overlay) closeNotif(); });

  // Event: deep link — a redeem request opens its management page
  overlay.addEventListener('click', function(e){
    if(e.target.closest('a')) return;
    var item = e.target.closest('.tk-notif-item');
    if(!item || !item.dataset.href) return;
    window.location.href = item.dataset.href;
  });

  // Event: filter
  overlay.addEventListener('click', function(e){
    var btn = e.target.closest('.tk-notif-filter');
    if(!btn) return;
    var key = btn.dataset.filter;
    overlay.querySelectorAll('.tk-notif-filter').forEach(function(b){
      b.style.background = b.dataset.filter === key ? '#1A6FFF' : 'rgba(255,255,255,0.06)';
      b.style.color = b.dataset.filter === key ? '#fff' : 'rgba(255,255,255,0.5)';
    });
    overlay.querySelectorAll('.tk-notif-item').forEach(function(item){
      item.style.display = (key === 'all' || item.dataset.type === key) ? 'flex' : 'none';
    });
  });
}

function hexToRgb(hex){
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return r+','+g+','+b;
}

function openNotif(){
  if(!document.getElementById('tk-notif-overlay')) buildDrawer();
  var ov = document.getElementById('tk-notif-overlay');
  ov.style.display = 'flex';
  requestAnimationFrame(function(){ ov.dataset.open = '1'; });
  // Close wallet dropdown
  document.querySelectorAll('.tk-wallet-dropdown').forEach(function(d){ delete d.dataset.open; });
}

function closeNotif(){
  /* leaves the mobile drawer (if open) visible behind — feels like going back a level */
  var ov = document.getElementById('tk-notif-overlay');
  if(!ov) return;
  delete ov.dataset.open;
  setTimeout(function(){ ov.style.display = 'none'; }, 300);
}

window.tkOpenNotifications = openNotif;

// Click handler for notification links in wallet dropdown & mobile menu
document.addEventListener('click', function(e){
  var t = e.target;
  if(!t.closest) return;
  var link = t.closest('a.tk-wd-item, a.tk-mw-link');
  if(link && link.textContent.trim() === 'Notifications'){
    e.preventDefault();
    openNotif();
  }
});

// Inject styles
var s = document.createElement('style');
s.textContent = [
  '#tk-notif-overlay{position:fixed;inset:0;z-index:300;display:none;justify-content:flex-end;background:rgba(0,0,0,0);transition:background 0.3s;}',
  '#tk-notif-overlay[data-open]{background:rgba(0,0,0,0.5);}',
  '#tk-notif-panel{width:400px;max-width:100%;height:100%;background:#141420;display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);box-shadow:-8px 0 32px rgba(0,0,0,0.5);}',
  '#tk-notif-overlay[data-open] #tk-notif-panel{transform:translateX(0);}',
  '.tk-notif-item:hover{background:rgba(255,255,255,0.03)!important;margin:0 -24px;padding-left:24px!important;padding-right:24px!important;}',
  '@media(max-width:768px){',
  /* sits one level above the mobile drawer and slides in from the same edge,
     so tapping Notifications reads as drilling deeper rather than a mode switch */
  '  #tk-notif-overlay{z-index:8100;align-items:stretch;justify-content:flex-end;}',
  '  #tk-notif-panel{width:100%;height:100vh;max-height:100vh;border-radius:0;transform:translateX(100%);box-shadow:-8px 0 32px rgba(0,0,0,0.5);}',
  '  #tk-notif-overlay[data-open] #tk-notif-panel{transform:translateX(0);}',
  '}',
].join('\n');
document.head.appendChild(s);

})();
