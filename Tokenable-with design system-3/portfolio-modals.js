/* Portfolio Action Modals */
(function(){

/* ---- Modal shell ---- */
var overlay = document.createElement('div');
overlay.id = 'pf-modal-overlay';
overlay.style.cssText = 'position:fixed;inset:0;z-index:200;display:none;background:rgba(6,6,14,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);transition:opacity 0.25s ease;';
document.body.appendChild(overlay);

var modal = document.createElement('div');
modal.id = 'pf-modal';
modal.style.cssText = 'position:absolute;right:0;top:0;bottom:0;width:420px;max-width:92vw;background:#1a1a2a;overflow-y:auto;box-shadow:-8px 0 40px rgba(0,0,0,0.5);transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;';
overlay.appendChild(modal);

var mobileSheet = document.createElement('style');
mobileSheet.textContent = '@media(max-width:768px){' +
  '#pf-modal-overlay{align-items:flex-end!important;}' +
  '#pf-modal{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;width:100%!important;max-width:100vw!important;max-height:85vh!important;border-radius:20px 20px 0 0!important;box-shadow:0 -8px 40px rgba(0,0,0,0.5)!important;padding:0!important;}' +
  '#pf-modal:not([data-open]){transform:translateY(100%)!important;}' +
  '#pf-modal[data-open]{transform:translateY(0)!important;}' +
  '#pf-modal .pf-modal-handle{display:block;}' +
  '#pf-modal .pf-modal-content{padding:0 20px!important;overflow-y:auto!important;max-height:calc(85vh - 140px)!important;-webkit-overflow-scrolling:touch;}' +
  '#pf-modal .pf-modal-actions{position:sticky!important;bottom:0!important;padding:16px 20px!important;padding-bottom:max(16px,env(safe-area-inset-bottom))!important;background:#1a1a2a!important;box-shadow:0 -1px 0 rgba(255,255,255,0.06)!important;}' +
'}' +
'@media(min-width:769px){' +
  '#pf-modal:not([data-open]){transform:translateX(100%)!important;}' +
  '#pf-modal[data-open]{transform:translateX(0)!important;}' +
  '#pf-modal .pf-modal-content{padding:32px 28px 0!important;overflow-y:auto!important;flex:1!important;}' +
  '#pf-modal .pf-modal-actions{padding:16px 28px 28px!important;}' +
  '#pf-modal .pf-modal-handle{display:none!important;}' +
'}';
document.head.appendChild(mobileSheet);

function openModal(contentHTML, actionsHTML){
  var handle = '<div class="pf-modal-handle" style="width:36px;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin:12px auto 4px;"></div>';
  var closeX = '<button onclick="closeModal()" style="position:absolute;top:14px;right:14px;width:32px;height:32px;border:0;background:rgba(255,255,255,0.06);border-radius:8px;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;">&#10005;</button>';
  modal.innerHTML = handle + '<div class="pf-modal-content" style="position:relative;">' + closeX + contentHTML + '</div>' + '<div class="pf-modal-actions">' + (actionsHTML||'') + '</div>';
  overlay.style.display='block';
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    modal.setAttribute('data-open','');
  }); });
}
function closeModal(){
  modal.removeAttribute('data-open');
  setTimeout(function(){ overlay.style.display='none'; modal.innerHTML=''; }, 300);
}
window.closeModal = closeModal;
overlay.addEventListener('click', function(e){ if(e.target===overlay) closeModal(); });

function fmtPrice(n){ return n.toLocaleString('en-US'); }
window.fmtPrice = fmtPrice;

var inputStyle = 'width:100%;height:48px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#fff;font-family:var(--font-mono);font-size:16px;padding:0 14px;outline:none;box-sizing:border-box;';
var primaryBtnStyle = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 24px;font-family:var(--font-sans);font-size:15px;font-weight:600;cursor:pointer;border:0;border-radius:0;clip-path:var(--pixel-notch-lg);color:#fff;background:#1A6FFF;box-shadow:inset 0 0 0 3px rgba(0,0,20,0.5), inset 0 0 0 1px rgba(80,160,255,0.6), inset 0 3px 0 0 rgba(80,170,255,0.7), inset 0 -3px 0 0 rgba(0,0,50,0.4);filter:drop-shadow(4px 4px 0 rgba(26,111,255,0.55));white-space:nowrap;';
var ghostBtnStyle = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 24px;font-family:var(--font-sans);font-size:15px;font-weight:600;cursor:pointer;border:0;border-radius:0;clip-path:var(--pixel-notch-lg);color:#fff;background:#191919;box-shadow:none;filter:drop-shadow(4px 4px 0 rgba(5,10,30,0.7));white-space:nowrap;';
var dangerBtnStyle = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 24px;font-family:var(--font-sans);font-size:15px;font-weight:600;cursor:pointer;border:0;border-radius:0;clip-path:var(--pixel-notch-lg);color:#fff;background:#E4374A;box-shadow:inset 0 0 0 3px rgba(0,0,20,0.5), inset 0 0 0 1px rgba(255,150,160,0.5), inset 0 3px 0 0 rgba(255,150,160,0.6), inset 0 -3px 0 0 rgba(80,0,0,0.4);filter:drop-shadow(4px 4px 0 rgba(228,55,74,0.5));white-space:nowrap;';
var labelStyle = 'font-family:var(--font-mono);font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.38);font-weight:600;margin-bottom:6px;';
var valStyle = 'font-family:var(--font-sans);font-weight:700;font-size:22px;color:#fff;';
var closeBtn = '<button onclick="document.getElementById(\'pf-modal-overlay\').style.display=\'none\'" style="position:absolute;top:14px;right:14px;width:32px;height:32px;border:0;background:rgba(255,255,255,0.06);border-radius:8px;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&#10005;</button>';

/* ---- Unified SELL NOW Modal (Accept Bid / Set Price toggle) ---- */
window.pfSellNowModal = function(name, mktVal, hasBids, highestBid, isListed, listPrice){
  highestBid = highestBid || Math.round(mktVal * 0.95);
  listPrice = listPrice || mktVal;
  var asks = isListed ? [] : [{price:fmtPrice(Math.round(mktVal*1.05)), size:1}];
  var bids = hasBids ? [
    {price:fmtPrice(highestBid), size:1},
    {price:fmtPrice(Math.round(highestBid*0.97)), size:1},
    {price:fmtPrice(Math.round(highestBid*0.93)), size:1}
  ] : [];

  var thStyle = 'font-family:var(--font-mono);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-weight:600;padding:6px 10px;';
  var tdStyle = 'font-family:var(--font-mono);font-size:13px;font-weight:600;padding:8px 10px;';

  var obHTML = '<div style="margin-bottom:20px;border-radius:10px;overflow:hidden;background:rgba(0,0,0,0.2);">' +
    '<table style="width:100%;border-collapse:collapse;">' +
    '<thead><tr><th style="'+thStyle+'text-align:left;">Price</th><th style="'+thStyle+'text-align:center;">Size</th><th style="'+thStyle+'text-align:right;">Total</th></tr></thead>' +
    '<tbody>';
  if(asks.length){
    asks.forEach(function(a){
      obHTML += '<tr style="background:rgba(228,55,74,0.12);"><td style="'+tdStyle+'color:#E4374A;text-align:left;">'+a.price+'</td><td style="'+tdStyle+'color:rgba(255,255,255,0.6);text-align:center;">'+a.size+'</td><td style="'+tdStyle+'color:#E4374A;text-align:right;">'+a.price+'</td></tr>';
    });
  } else {
    obHTML += '<tr><td colspan="3" style="'+tdStyle+'text-align:center;color:rgba(255,255,255,0.3);font-size:11px;padding:6px 10px;">N/A</td></tr>';
  }
  bids.forEach(function(b){
    obHTML += '<tr style="background:rgba(0,200,100,0.08);"><td style="'+tdStyle+'color:var(--pos);text-align:left;">'+b.price+'</td><td style="'+tdStyle+'color:rgba(255,255,255,0.6);text-align:center;">'+b.size+'</td><td style="'+tdStyle+'color:var(--pos);text-align:right;">'+b.price+'</td></tr>';
  });
  obHTML += '</tbody></table>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 10px;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--pos);">BIDS '+bids.length+'</span>' +
      '<span style="font-family:var(--font-mono);font-size:10px;font-weight:600;color:#E4374A;">ASKS '+asks.length+'</span>' +
    '</div>' +
  '</div>';

  var fee = Math.round(highestBid * 0.05);
  var net = highestBid - fee;
  var listFee = Math.round(listPrice * 0.05);
  var listNet = listPrice - listFee;

  var acceptBar = (hasBids && !isListed) ?
    '<div style="padding:14px 16px;background:rgba(0,200,100,0.08);border-radius:10px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
      '<div><div style="'+labelStyle+'margin-bottom:2px;">Highest offer</div><span style="font-family:var(--font-mono);font-weight:700;font-size:18px;color:var(--pos);">$' + fmtPrice(highestBid) + '</span></div>' +
      '<button id="pfsn-accept-bid" style="'+primaryBtnStyle+'height:40px;padding:0 20px;font-size:13px;white-space:nowrap;">Accept &rarr;</button>' +
    '</div>' : '';

  var listedHeader = isListed ?
    '<div id="pfsn-listed-view" style="padding:14px 16px;background:rgba(26,111,255,0.06);border-radius:10px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;">' +
      '<div><div style="'+labelStyle+'margin-bottom:2px;">Currently listed at</div><span style="font-family:var(--font-mono);font-weight:700;font-size:18px;color:#fff;">$' + fmtPrice(listPrice) + '</span></div>' +
      '<button id="pfsn-edit-listed" style="background:none;border:0;color:var(--azure);font-family:var(--font-sans);font-size:13px;font-weight:600;cursor:pointer;">Edit Price ✏️</button>' +
    '</div>' : '';

  var tabsHTML = '<div style="display:flex;gap:0;margin-bottom:18px;border-bottom:1px solid rgba(255,255,255,0.08);">' +
    '<button id="pfsn-tab-price" class="pfsn-tab" style="flex:1;padding:10px 0;background:none;border:0;border-bottom:2px solid transparent;font-family:var(--font-sans);font-size:13px;font-weight:600;cursor:pointer;color:rgba(255,255,255,0.4);">Set Listing Price</button>' +
    '<button id="pfsn-tab-bid" class="pfsn-tab" style="flex:1;padding:10px 0;background:none;border:0;border-bottom:2px solid transparent;font-family:var(--font-sans);font-size:13px;font-weight:600;cursor:pointer;color:rgba(255,255,255,0.4);">Accept Offers</button>' +
  '</div>';

  var modeA = '<div id="pfsn-mode-a" style="display:none;">' +
    '<div style="'+labelStyle+'">Minimum offer (optional)</div>' +
    '<div style="position:relative;margin-bottom:10px;">' +
      '<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);font-family:var(--font-mono);font-size:16px;color:rgba(255,255,255,0.4);">$</span>' +
      '<input id="pfsn-minoffer-input" type="text" inputmode="decimal" placeholder="Leave blank to accept any offer" style="'+inputStyle+'padding-left:28px;">' +
    '</div>' +
    '<div style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:12px;">Market price: $'+fmtPrice(mktVal)+(hasBids?' &middot; Highest offer: $'+fmtPrice(highestBid):'')+'</div>' +
    '<p style="font-size:12.5px;color:rgba(255,255,255,0.55);margin:0;line-height:1.5;padding:12px 14px;background:rgba(255,255,255,0.03);border-radius:10px;">Platform fee: 5% will be deducted when the card sells.</p>' +
  '</div>';

  var modeB = '<div id="pfsn-mode-b" style="display:none;">' +
    '<div style="'+labelStyle+'">Listing price</div>' +
    '<div style="position:relative;margin-bottom:10px;">' +
      '<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);font-family:var(--font-mono);font-size:16px;color:rgba(255,255,255,0.4);">$</span>' +
      '<input id="pfsn-price-input" type="text" inputmode="decimal" style="'+inputStyle+'padding-left:28px;" value="' + fmtPrice(listPrice) + '">' +
    '</div>' +
    '<div style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:12px;">Market price: $'+fmtPrice(mktVal)+(hasBids?' &middot; Highest bid: $'+fmtPrice(highestBid):'')+'</div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="'+labelStyle+'margin:0;">Platform fee (5%)</span>' +
      '<span id="pfsn-fee" style="font-family:var(--font-mono);font-size:13px;color:rgba(255,255,255,0.5);">-$' + fmtPrice(listFee) + '</span>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0 6px;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="'+labelStyle+'margin:0;font-weight:700;">You receive</span>' +
      '<span id="pfsn-net" style="font-family:var(--font-mono);font-weight:700;font-size:20px;color:var(--pos);">$' + fmtPrice(listNet) + '</span>' +
    '</div>' +
    '<p style="font-size:12.5px;color:rgba(255,255,255,0.4);margin:6px 0 0;line-height:1.5;">List at your price. Sells when someone accepts your ask.</p>' +
  '</div>';

  openModal(
    '<div style="'+labelStyle+'">Sell card</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 6px;">' + name + '</div>' +
    '<div style="'+labelStyle+'margin:0 0 16px;">Current market value: $' + fmtPrice(mktVal) + '</div>' +
    listedHeader +
    acceptBar +
    obHTML +
    tabsHTML +
    modeA + modeB,
    '<button id="pfsn-cta" style="'+primaryBtnStyle+'width:100%;"></button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;width:100%;" onclick="closeModal()">Cancel</button>'
  );

  var curMode = 'b';
  function paintTabs(){
    var tb = document.getElementById('pfsn-tab-bid'), tp = document.getElementById('pfsn-tab-price');
    var ma = document.getElementById('pfsn-mode-a'), mb = document.getElementById('pfsn-mode-b');
    var cta = document.getElementById('pfsn-cta');
    if(curMode === 'a'){
      tb.style.color = '#fff'; tb.style.borderBottomColor = 'var(--azure)';
      tp.style.color = 'rgba(255,255,255,0.4)'; tp.style.borderBottomColor = 'transparent';
      ma.style.display = 'block'; mb.style.display = 'none';
      cta.textContent = isListed ? 'Update Listing →' : 'Set Listing Price →';
      cta.onclick = function(){ pfConfirmAction(isListed ? 'listing updated' : 'listed'); };
    } else {
      tp.style.color = '#fff'; tp.style.borderBottomColor = 'var(--azure)';
      tb.style.color = 'rgba(255,255,255,0.4)'; tb.style.borderBottomColor = 'transparent';
      mb.style.display = 'block'; ma.style.display = 'none';
      cta.textContent = isListed ? 'Update Price →' : 'List for Sale →';
      cta.onclick = function(){ pfConfirmAction(isListed ? 'listing updated' : 'listed'); };
    }
  }
  paintTabs();
  var tabBid = document.getElementById('pfsn-tab-bid');
  var tabPrice = document.getElementById('pfsn-tab-price');
  if(tabBid) tabBid.addEventListener('click', function(){ curMode='a'; paintTabs(); });
  if(tabPrice) tabPrice.addEventListener('click', function(){ curMode='b'; paintTabs(); });
  var acceptBidBtn = document.getElementById('pfsn-accept-bid');
  if(acceptBidBtn) acceptBidBtn.addEventListener('click', function(){ pfConfirmAction('sold'); });

  var priceInput = document.getElementById('pfsn-price-input');
  if(priceInput) priceInput.addEventListener('input', function(){
    var v = parseInt(this.value.replace(/[^0-9]/g,''))||0;
    this.value = fmtPrice(v);
    var f = Math.round(v*0.05);
    var feeEl = document.getElementById('pfsn-fee');
    var netEl = document.getElementById('pfsn-net');
    if(feeEl) feeEl.textContent = '-$'+fmtPrice(f);
    if(netEl) netEl.textContent = '$'+fmtPrice(v-f);
  });

  var editBtn = document.getElementById('pfsn-edit-listed');
  if(editBtn) editBtn.addEventListener('click', function(){
    curMode = 'b'; paintTabs();
    var pi = document.getElementById('pfsn-price-input');
    if(pi) pi.focus();
  });
};

/* ---- Set Price drawer (fixed-price listing only) ---- */
/* ---- Bid scenario (demo) helpers ---- */
window.__bidScenario = window.__bidScenario || 'same';
function bidTop(base){ var s=window.__bidScenario; if(s==='up') return Math.round(base*1.04/1000)*1000; if(s==='down') return Math.round(base*0.965/500)*500; return base; }
function bidHasBids(){ return window.__bidScenario !== 'none'; }
function bidFail(){ return window.__bidScenario === 'fail'; }

window.pfSetPriceModal = function(name, mktVal, isListed, listPrice, hasBids, highestBid){
  listPrice = listPrice || mktVal;
  highestBid = highestBid || 0;
  window.__lastBidArgs = { name:name, mktVal:mktVal, isListed:isListed, listPrice:listPrice, highestBid:highestBid };
  var lastSold = highestBid > 0 ? highestBid : 0;
  var showRef = lastSold > 0;
  var listFee = Math.round(listPrice*0.05);
  var listNet = listPrice - listFee;

  var refBlock = showRef ?
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:16px;">' +
      '<div><div style="'+labelStyle+'margin-bottom:3px;">Last sold</div><span style="font-family:var(--font-mono);font-weight:700;font-size:18px;color:#fff;">$'+fmtPrice(lastSold)+'</span></div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">' +
        '<span style="font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">LAST MARKET SALE</span>' +
        '<button id="pfsn-match" style="background:rgba(26,111,255,0.16);border:0;color:var(--azure);font-family:var(--font-sans);font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;">Match last sale</button>' +
      '</div>' +
    '</div>' : '';

  var listedHeader = isListed ?
    '<div style="padding:14px 16px;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:16px;"><div style="'+labelStyle+'margin-bottom:2px;">Currently listed at</div><span style="font-family:var(--font-mono);font-weight:700;font-size:18px;color:#fff;">$'+fmtPrice(listPrice)+'</span></div>' : '';

  openModal(
    '<div style="'+labelStyle+'">Edit price</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 6px;">' + name + '</div>' +
    '<div style="'+labelStyle+'margin:0 0 16px;">Current market value: $' + fmtPrice(mktVal) + '</div>' +
    refBlock + listedHeader +
    '<div style="'+labelStyle+'">Your price</div>' +
    '<div style="position:relative;margin-bottom:10px;">' +
      '<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);font-family:var(--font-mono);font-size:16px;color:rgba(255,255,255,0.4);">$</span>' +
      '<input id="pfsn-price-input" type="text" inputmode="decimal" style="'+inputStyle+'padding-left:28px;" value="' + fmtPrice(listPrice) + '">' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="'+labelStyle+'margin:0;">Platform fee (5%)</span>' +
      '<span id="pfsn-fee" style="font-family:var(--font-mono);font-size:13px;color:rgba(255,255,255,0.5);">-$' + fmtPrice(listFee) + '</span>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0 6px;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="'+labelStyle+'margin:0;font-weight:700;">You receive</span>' +
      '<span id="pfsn-net" style="font-family:var(--font-mono);font-weight:700;font-size:20px;color:var(--pos);">$' + fmtPrice(listNet) + '</span>' +
    '</div>' +
    (showRef ? '<p style="font-size:12px;color:rgba(255,255,255,0.4);margin:12px 0 0;line-height:1.5;">Last market sale shown for reference. Your card goes live at the price you set.</p>' : ''),
    '<button id="pfsn-cta" style="'+primaryBtnStyle+'width:100%;">Update price \u2192</button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;width:100%;" onclick="closeModal()">Cancel</button>'
  );

  var pi = document.getElementById('pfsn-price-input');
  function recalc(){
    var v = parseInt(pi.value.replace(/[^0-9]/g,''))||0; pi.value = fmtPrice(v);
    var f = Math.round(v*0.05);
    var fe=document.getElementById('pfsn-fee'), ne=document.getElementById('pfsn-net');
    if(fe) fe.textContent='-$'+fmtPrice(f); if(ne) ne.textContent='$'+fmtPrice(v-f);
  }
  if(pi) pi.addEventListener('input', recalc);
  var mb = document.getElementById('pfsn-match');
  if(mb) mb.onclick = function(){ pi.value = fmtPrice(lastSold); recalc(); pi.focus(); };
  var cta = document.getElementById('pfsn-cta');
  if(cta) cta.onclick = function(){
    var v = parseInt(pi.value.replace(/[^0-9]/g,''))||0;
    pfSaleResult('updated', v);
  };
};

/* ---- Sale / update / fail result overlay ---- */
window.pfSaleResult = function(kind, price){
  closeModal(); if(window._closeDlg) _closeDlg();
  var fee = Math.round(price*0.05), net = price - fee;
  var cfg;
  if(kind==='sold') cfg={color:'#00C864',bg:'rgba(0,200,100,0.12)',rad:'50%',icon:'<polyline points="20 6 9 17 4 12"/>',title:'Sold at $'+fmtPrice(price),sub:'$'+fmtPrice(net)+' is on its way to your account.'};
  else if(kind==='updated') cfg={color:'#1A6FFF',bg:'rgba(26,111,255,0.14)',rad:'50%',icon:'<polyline points="20 6 9 17 4 12"/>',title:'Price updated',sub:'Listed at $'+fmtPrice(price)+'. We\u2019ll let you know when a bid meets it.'};
  else cfg={color:'#E4374A',bg:'rgba(228,55,74,0.12)',rad:'16px',icon:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',title:'That bid could no longer be filled',sub:'The offer was removed. Your price is unchanged.'};
  var sov=document.createElement('div');
  sov.setAttribute('data-sov','');
  sov.style.cssText='position:fixed;inset:0;z-index:230;display:flex;align-items:center;justify-content:center;background:rgba(6,6,14,0.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity 0.3s ease;';
  sov.innerHTML='<div style="text-align:center;max-width:340px;padding:0 24px;animation:pfSuccessPop 0.5s ease forwards;">' +
    '<div style="width:68px;height:68px;border-radius:'+cfg.rad+';background:'+cfg.bg+';display:flex;align-items:center;justify-content:center;margin:0 auto 18px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="'+cfg.color+'" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">'+cfg.icon+'</svg></div>' +
    '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.02em;line-height:1.25;">'+cfg.title+'</div>' +
    '<div style="font-size:14px;color:rgba(255,255,255,0.55);margin-top:8px;line-height:1.5;">'+cfg.sub+'</div>' +
    '<button style="'+primaryBtnStyle+'width:100%;margin-top:22px;" onclick="this.closest(\'[data-sov]\').remove()">Done</button>' +
  '</div>';
  document.body.appendChild(sov);
  if(!document.getElementById('pf-success-kf')){ var kf=document.createElement('style'); kf.id='pf-success-kf'; kf.textContent='@keyframes pfSuccessPop{0%{transform:scale(0.7);opacity:0}50%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}@keyframes pfCheckDraw{0%{opacity:0;stroke-dasharray:30;stroke-dashoffset:30}100%{opacity:1;stroke-dashoffset:0}}@keyframes pfFadeIn{to{opacity:1}}'; document.head.appendChild(kf); }
  requestAnimationFrame(function(){ sov.style.opacity='1'; });
};

/* ---- Demo bar (edge cases for the bid-aware edit-price flow) ---- */
function ensureBidDemoBar(){
  if(document.getElementById('pf-bid-demo')) return;
  var bar=document.createElement('div');
  bar.id='pf-bid-demo';
  bar.style.cssText='position:fixed;left:16px;bottom:16px;z-index:240;display:flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:calc(100vw - 32px);background:rgba(10,10,16,0.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08);border-radius:12px;padding:8px 10px;';
  var pills=[['same','As alerted'],['up','Bid rose'],['down','Bid dropped'],['none','No bids'],['fail','Fill fails']];
  var html='<span style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.12em;color:rgba(255,255,255,0.35);padding:0 4px;">DEMO · TOP BID</span>';
  pills.forEach(function(p){ var on=window.__bidScenario===p[0]; html+='<button data-bidscn="'+p[0]+'" style="border:0;background:'+(on?'#1A6FFF':'rgba(255,255,255,0.06)')+';color:'+(on?'#fff':'rgba(255,255,255,0.55)')+';font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:0.04em;padding:7px 11px;border-radius:8px;cursor:pointer;">'+p[1]+'</button>'; });
  bar.innerHTML=html;
  document.body.appendChild(bar);
  bar.addEventListener('click',function(e){
    var b=e.target.closest('[data-bidscn]'); if(!b) return;
    window.__bidScenario=b.dataset.bidscn;
    bar.querySelectorAll('[data-bidscn]').forEach(function(x){ var on=x.dataset.bidscn===window.__bidScenario; x.style.background=on?'#1A6FFF':'rgba(255,255,255,0.06)'; x.style.color=on?'#fff':'rgba(255,255,255,0.55)'; });
    var a=window.__lastBidArgs; if(a) pfSetPriceModal(a.name, a.mktVal, a.isListed, a.listPrice, true, a.highestBid);
  });
}

/* ---- Accept Highest Bid drawer (order book, instant settle) ---- */
window.pfAcceptOffersModal = function(name, mktVal, hasBids, highestBid){
  highestBid = highestBid || Math.round(mktVal*0.95);
  var thStyle = 'font-family:var(--font-mono);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-weight:600;padding:6px 10px;';
  var tdStyle = 'font-family:var(--font-mono);font-size:13px;font-weight:600;padding:8px 10px;';
  var bids = hasBids ? [
    {price:fmtPrice(highestBid)},{price:fmtPrice(Math.round(highestBid*0.97))},{price:fmtPrice(Math.round(highestBid*0.93))}
  ] : [];
  var ask = fmtPrice(Math.round(mktVal*1.05));
  var ob = '<div style="margin-bottom:18px;border-radius:10px;overflow:hidden;background:rgba(0,0,0,0.2);"><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="'+thStyle+'text-align:left;">Price</th><th style="'+thStyle+'text-align:center;">Size</th><th style="'+thStyle+'text-align:right;">Total</th></tr></thead><tbody>' +
    '<tr style="background:rgba(228,55,74,0.12);"><td style="'+tdStyle+'color:#E4374A;text-align:left;">'+ask+'</td><td style="'+tdStyle+'color:rgba(255,255,255,0.6);text-align:center;">1</td><td style="'+tdStyle+'color:#E4374A;text-align:right;">'+ask+'</td></tr>';
  bids.forEach(function(b){ ob += '<tr style="background:rgba(0,200,100,0.08);"><td style="'+tdStyle+'color:var(--pos);text-align:left;">'+b.price+'</td><td style="'+tdStyle+'color:rgba(255,255,255,0.6);text-align:center;">1</td><td style="'+tdStyle+'color:var(--pos);text-align:right;">'+b.price+'</td></tr>'; });
  ob += '</tbody></table><div style="display:flex;justify-content:space-between;padding:8px 10px;border-top:1px solid rgba(255,255,255,0.06);"><span style="font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--pos);">BIDS '+bids.length+'</span><span style="font-family:var(--font-mono);font-size:10px;font-weight:600;color:#E4374A;">ASKS 1</span></div></div>';
  var fee = Math.round(highestBid*0.05), net = highestBid - fee;
  openModal(
    '<div style="'+labelStyle+'">Accept highest bid</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 6px;">' + name + '</div>' +
    '<div style="'+labelStyle+'margin:0 0 16px;">Current market value: $' + fmtPrice(mktVal) + '</div>' +
    ob +
    '<div style="display:flex;justify-content:space-between;padding:10px 0;"><span style="'+labelStyle+'margin:0;">Highest bid</span><span style="font-family:var(--font-mono);font-weight:700;color:#fff;">$'+fmtPrice(highestBid)+'</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(255,255,255,0.06);"><span style="'+labelStyle+'margin:0;">Platform fee (5%)</span><span style="font-family:var(--font-mono);color:rgba(255,255,255,0.5);">-$'+fmtPrice(fee)+'</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:10px 0 6px;border-top:1px solid rgba(255,255,255,0.06);"><span style="'+labelStyle+'margin:0;font-weight:700;">You receive</span><span style="font-family:var(--font-mono);font-weight:700;font-size:20px;color:var(--pos);">$'+fmtPrice(net)+'</span></div>' +
    '<p style="font-size:12.5px;color:rgba(255,255,255,0.4);margin:6px 0 0;line-height:1.5;">Sell immediately at the highest current bid price.</p>',
    '<button style="'+primaryBtnStyle+'width:100%;" onclick="pfConfirmAction(\'sold\')">Confirm Sell \u2192</button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;width:100%;" onclick="closeModal()">Cancel</button>'
  );
};

/* ---- 1. SELL Modal ---- */
window.pfSellModal = function(name, highestBid, fee){
  fee = fee || Math.round(highestBid * 0.05);
  var net = highestBid - fee;
  openModal(
    '<div style="'+labelStyle+'">Sell card</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 20px;">' + name + '</div>' +
    '<div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="'+labelStyle+'margin:0;">Highest bid</span>' +
      '<span style="font-family:var(--font-mono);font-weight:700;color:#fff;">$' + fmtPrice(highestBid) + '</span>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="'+labelStyle+'margin:0;">Platform fee (5%)</span>' +
      '<span style="font-family:var(--font-mono);color:rgba(255,255,255,0.5);">-$' + fmtPrice(fee) + '</span>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;padding:12px 0 20px;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="'+labelStyle+'margin:0;">You receive</span>' +
      '<span style="font-family:var(--font-mono);font-weight:700;color:var(--pos);">$' + fmtPrice(net) + '</span>' +
    '</div>' +
    '',
    '<button style="'+primaryBtnStyle+'" onclick="pfConfirmAction(\'sold\')">Confirm Sell</button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;" onclick="closeModal()">Cancel</button>'
  );
};

/* ---- 2. LIST Modal ---- */
window.pfListModal = function(name, currentVal){
  var asks = [
    {price:fmtPrice(Math.round(currentVal*1.05)), size:1, total:fmtPrice(Math.round(currentVal*1.05))},
  ];
  var bids = [
    {price:fmtPrice(Math.round(currentVal*0.95)), size:1, total:fmtPrice(Math.round(currentVal*0.95))},
    {price:fmtPrice(Math.round(currentVal*0.92)), size:1, total:fmtPrice(Math.round(currentVal*0.92))},
    {price:fmtPrice(Math.round(currentVal*0.88)), size:1, total:fmtPrice(Math.round(currentVal*0.88))},
  ];

  var thStyle = 'font-family:var(--font-mono);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-weight:600;padding:6px 10px;';
  var tdStyle = 'font-family:var(--font-mono);font-size:13px;font-weight:600;padding:8px 10px;';

  var obHTML = '<div style="margin-bottom:20px;border-radius:10px;overflow:hidden;background:rgba(0,0,0,0.2);">' +
    '<table style="width:100%;border-collapse:collapse;">' +
    '<thead><tr><th style="'+thStyle+'text-align:left;">Price</th><th style="'+thStyle+'text-align:center;">Size</th><th style="'+thStyle+'text-align:right;">Total</th></tr></thead>' +
    '<tbody>';

  // Asks (red bg, top)
  asks.forEach(function(a){
    obHTML += '<tr style="background:rgba(228,55,74,0.12);"><td style="'+tdStyle+'color:#E4374A;text-align:left;">'+a.price+'</td><td style="'+tdStyle+'color:rgba(255,255,255,0.6);text-align:center;">'+a.size+'</td><td style="'+tdStyle+'color:#E4374A;text-align:right;">'+a.total+'</td></tr>';
  });

  // Spread
  obHTML += '<tr><td colspan="3" style="'+tdStyle+'text-align:center;color:rgba(255,255,255,0.3);font-size:11px;padding:6px 10px;">N/A</td></tr>';

  // Bids (green bg, bottom)
  bids.forEach(function(b){
    obHTML += '<tr style="background:rgba(0,200,100,0.08);"><td style="'+tdStyle+'color:var(--pos);text-align:left;">'+b.price+'</td><td style="'+tdStyle+'color:rgba(255,255,255,0.6);text-align:center;">'+b.size+'</td><td style="'+tdStyle+'color:var(--pos);text-align:right;">'+b.total+'</td></tr>';
  });

  obHTML += '</tbody></table>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 10px;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--pos);">BIDS '+bids.length+'</span>' +
      '<span style="font-family:var(--font-mono);font-size:10px;font-weight:600;color:#E4374A;">ASKS '+asks.length+'</span>' +
    '</div>' +
  '</div>';

  openModal(
    '<div style="'+labelStyle+'">List card for sale</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 6px;">' + name + '</div>' +
    '<div style="'+labelStyle+'margin:0 0 16px;">Current value: $' + fmtPrice(currentVal) + '</div>' +
    obHTML +
    '<div style="'+labelStyle+'">Listing price</div>' +
    '<div style="position:relative;margin-bottom:16px;">' +
      '<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);font-family:var(--font-mono);font-size:16px;color:rgba(255,255,255,0.4);">$</span>' +
      '<input id="pf-list-price" type="text" inputmode="decimal" placeholder="0" style="'+inputStyle+'padding-left:28px;" value="' + fmtPrice(currentVal) + '">' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0 16px;">' +
      '<span style="'+labelStyle+'margin:0;">Platform fee (5%)</span>' +
      '<span id="pf-list-fee" style="font-family:var(--font-mono);font-size:13px;color:rgba(255,255,255,0.5);">-$' + fmtPrice(Math.round(currentVal*0.05)) + '</span>' +
    '</div>' +
    '',
    '<button style="'+primaryBtnStyle+'" onclick="pfConfirmAction(\'listed\')">List for Sale</button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;" onclick="closeModal()">Cancel</button>'
  );
  var inp = document.getElementById('pf-list-price');
  if(inp) inp.addEventListener('input', function(){
    var v = parseInt(this.value.replace(/[^0-9]/g,''))||0;
    this.value = fmtPrice(v);
    var feeEl = document.getElementById('pf-list-fee');
    if(feeEl) feeEl.textContent = '-$'+fmtPrice(Math.round(v*0.05));
  });
};

/* ---- 3. CANCEL LISTING Modal ---- */
window.pfCancelListingModal = function(name, listPrice){
  openModal(
    '<div style="'+labelStyle+'">Cancel listing</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 16px;">' + name + '</div>' +
    '<div style="padding:16px;background:rgba(228,55,74,0.06);border-radius:10px;margin-bottom:20px;">' +
      '<div style="font-size:14px;color:rgba(255,255,255,0.7);line-height:1.5;">Your listing at <strong style="color:#fff;">$' + fmtPrice(listPrice) + '</strong> will be removed. The card will remain in your vault.</div>' +
    '</div>' +
    '',
    '<button style="'+dangerBtnStyle+'" onclick="pfConfirmAction(\'cancelled\')">Cancel Listing</button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;" onclick="closeModal()">Keep Listed</button>'
  );
};

/* ---- 4. CANCEL BID Modal ---- */
window.pfCancelBidModal = function(name, bidAmt){
  openModal(
    '<div style="'+labelStyle+'">Cancel bid</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 16px;">' + name + '</div>' +
    '<div style="padding:16px;background:rgba(228,55,74,0.06);border-radius:10px;margin-bottom:20px;">' +
      '<div style="font-size:14px;color:rgba(255,255,255,0.7);line-height:1.5;">Your bid of <strong style="color:#fff;">$' + fmtPrice(bidAmt) + '</strong> will be withdrawn. Funds will be released back to your wallet.</div>' +
    '</div>' +
    '',
    '<button style="'+dangerBtnStyle+'" onclick="pfConfirmAction(\'bid cancelled\')">Cancel Bid</button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;" onclick="closeModal()">Keep Bid</button>'
  );
};

/* ---- 5. RAISE BID Modal ---- */
window.pfRaiseBidModal = function(name, currentBid, askPrice){
  openModal(
    '<div style="'+labelStyle+'">Raise bid</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 6px;">' + name + '</div>' +
    '<div style="display:flex;gap:16px;margin-bottom:16px;">' +
      '<div><div style="'+labelStyle+'">Your bid</div><div style="font-family:var(--font-mono);font-weight:700;color:var(--warn);">$' + fmtPrice(currentBid) + '</div></div>' +
      '<div><div style="'+labelStyle+'">Ask price</div><div style="font-family:var(--font-mono);font-weight:700;color:#fff;">$' + fmtPrice(askPrice) + '</div></div>' +
    '</div>' +
    '<div style="'+labelStyle+'">New bid amount</div>' +
    '<div style="position:relative;margin-bottom:20px;">' +
      '<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);font-family:var(--font-mono);font-size:16px;color:rgba(255,255,255,0.4);">$</span>' +
      '<input id="pf-raise-amt" type="text" inputmode="decimal" placeholder="0" style="'+inputStyle+'padding-left:28px;" value="' + fmtPrice(Math.round(currentBid*1.05)) + '">' +
    '</div>' +
    '',
    '<button style="'+primaryBtnStyle+'" onclick="pfConfirmAction(\'bid raised\')">Place Bid</button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;" onclick="closeModal()">Cancel</button>'
  );
  var inp = document.getElementById('pf-raise-amt');
  if(inp) inp.addEventListener('input', function(){
    var v = parseInt(this.value.replace(/[^0-9]/g,''))||0;
    this.value = fmtPrice(v);
  });
};

/* ---- 6. TARGET PRICE SETTING Modal (Watchlist) ---- */
window.pfTargetPriceModal = function(name, currentPrice){
  openModal(
    '<div style="'+labelStyle+'">Set price alert</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 6px;">' + name + '</div>' +
    '<div style="'+labelStyle+'margin:0 0 16px;">Current price: $' + fmtPrice(currentPrice) + '</div>' +
    '<div style="'+labelStyle+'">Target price</div>' +
    '<div style="position:relative;margin-bottom:16px;">' +
      '<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);font-family:var(--font-mono);font-size:16px;color:rgba(255,255,255,0.4);">$</span>' +
      '<input id="pf-target-price" type="text" inputmode="decimal" placeholder="0" style="'+inputStyle+'padding-left:28px;">' +
    '</div>' +
    '<div style="'+labelStyle+'">Notify me when</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">' +
      '<label style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;cursor:pointer;">' +
        '<input type="checkbox" checked style="accent-color:#4A90FF;width:18px;height:18px;">' +
        '<span style="font-size:14px;color:#fff;">Target price is reached</span>' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;cursor:pointer;">' +
        '<input type="checkbox" checked style="accent-color:#4A90FF;width:18px;height:18px;">' +
        '<span style="font-size:14px;color:#fff;">Card is sold</span>' +
      '</label>' +
    '</div>' +
    '<div style="'+labelStyle+'">Notification method</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:20px;">' +
      '<button id="pf-notif-email" class="pf-notif-method sel" style="flex:1;height:40px;border:0;border-radius:8px;background:#4A90FF;color:#fff;font-family:var(--font-sans);font-size:13px;font-weight:600;cursor:pointer;">Email</button>' +
      '<button id="pf-notif-app" class="pf-notif-method" style="flex:1;height:40px;border:0;border-radius:8px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);font-family:var(--font-sans);font-size:13px;font-weight:600;cursor:pointer;">App notification</button>' +
    '</div>' +
    '',
    '<button style="'+primaryBtnStyle+'" onclick="pfConfirmAction(\'alert set\')">Set Alert</button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;" onclick="closeModal()">Cancel</button>'
  );
  var inp = document.getElementById('pf-target-price');
  if(inp) inp.addEventListener('input', function(){
    var v = parseInt(this.value.replace(/[^0-9]/g,''))||0;
    this.value = fmtPrice(v);
  });
  // Toggle notification method
  document.querySelectorAll('.pf-notif-method').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.pf-notif-method').forEach(function(x){
        x.style.background='rgba(255,255,255,0.06)'; x.style.color='rgba(255,255,255,0.6)';
      });
      this.style.background='#4A90FF'; this.style.color='#fff';
    });
  });
};

/* ---- 7. REMOVE FROM WATCHLIST Modal ---- */
window.pfRemoveWatchModal = function(name){
  openModal(
    '<div style="'+labelStyle+'">Remove from watchlist</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 16px;">' + name + '</div>' +
    '<div style="padding:16px;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:20px;">' +
      '<div style="font-size:14px;color:rgba(255,255,255,0.7);line-height:1.5;">This card will be removed from your watchlist and price alerts will be turned off.</div>' +
    '</div>' +
    '',
    '<button style="'+dangerBtnStyle+'" onclick="pfConfirmAction(\'removed\')">Remove</button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;" onclick="closeModal()">Keep Watching</button>'
  );
};

/* ---- 8. BUY NOW Modal (Watchlist) ---- */
window.pfBuyNowModal = function(name, price){
  var fee = Math.round(price * 0.05);
  var total = price + fee;
  openModal(
    '<div style="'+labelStyle+'">Buy now</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 20px;">' + name + '</div>' +
    '<div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="'+labelStyle+'margin:0;">Item price</span>' +
      '<span style="font-family:var(--font-mono);font-weight:700;color:#fff;">$' + fmtPrice(price) + '</span>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="'+labelStyle+'margin:0;">Platform fee (5%)</span>' +
      '<span style="font-family:var(--font-mono);color:rgba(255,255,255,0.5);">$' + fmtPrice(fee) + '</span>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;padding:12px 0 20px;border-top:1px solid rgba(255,255,255,0.06);">' +
      '<span style="'+labelStyle+'margin:0;">Total</span>' +
      '<span style="font-family:var(--font-mono);font-weight:700;font-size:18px;color:#fff;">$' + fmtPrice(total) + '</span>' +
    '</div>' +
    '',
    '<button style="'+primaryBtnStyle+'" onclick="pfConfirmAction(\'purchased\')">Confirm Purchase</button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;" onclick="closeModal()">Cancel</button>'
  );
};

/* ---- 9. BID Modal (Watchlist) ---- */
window.pfBidModal = function(name, askPrice){
  openModal(
    '<div style="'+labelStyle+'">Place a bid</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 6px;">' + name + '</div>' +
    '<div style="'+labelStyle+'margin:0 0 16px;">Ask price: $' + fmtPrice(askPrice) + '</div>' +
    '<div style="'+labelStyle+'">Your bid</div>' +
    '<div style="position:relative;margin-bottom:20px;">' +
      '<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);font-family:var(--font-mono);font-size:16px;color:rgba(255,255,255,0.4);">$</span>' +
      '<input id="pf-bid-amt" type="text" inputmode="decimal" placeholder="0" style="'+inputStyle+'padding-left:28px;">' +
    '</div>' +
    '',
    '<button style="'+primaryBtnStyle+'" onclick="pfConfirmAction(\'bid placed\')">Place Bid</button>' +
    '<button style="'+ghostBtnStyle+'margin-top:8px;" onclick="closeModal()">Cancel</button>'
  );
  var inp = document.getElementById('pf-bid-amt');
  if(inp) inp.addEventListener('input', function(){
    var v = parseInt(this.value.replace(/[^0-9]/g,''))||0;
    this.value = fmtPrice(v);
  });
};

/* ---- Success state ---- */
window.pfConfirmAction = function(action){
  // Show success in a center overlay with animation, auto-dismiss
  var sov = document.createElement('div');
  sov.style.cssText = 'position:fixed;inset:0;z-index:220;display:flex;align-items:center;justify-content:center;background:rgba(6,6,14,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;transition:opacity 0.3s ease;';
  sov.innerHTML = '<div style="text-align:center;animation:pfSuccessPop 0.5s ease forwards;">' +
    '<div style="width:64px;height:64px;border-radius:50%;background:rgba(0,200,100,0.12);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">' +
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00C864" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0;animation:pfCheckDraw 0.4s ease 0.2s forwards;"><polyline points="20 6 9 17 4 12"/></svg>' +
    '</div>' +
    '<div style="font-size:18px;font-weight:700;color:#fff;opacity:0;animation:pfFadeIn 0.3s ease 0.3s forwards;">Success</div>' +
  '</div>';
  document.body.appendChild(sov);
  
  // Add keyframes if not yet
  if(!document.getElementById('pf-success-kf')){
    var kf = document.createElement('style');
    kf.id = 'pf-success-kf';
    kf.textContent = '@keyframes pfSuccessPop{0%{transform:scale(0.7);opacity:0}50%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}@keyframes pfCheckDraw{0%{opacity:0;stroke-dasharray:30;stroke-dashoffset:30}100%{opacity:1;stroke-dasharray:30;stroke-dashoffset:0}}@keyframes pfFadeIn{to{opacity:1}}';
    document.head.appendChild(kf);
  }
  
  // Close any open drawer/dialog first
  closeModal();
  if(window._closeDlg) _closeDlg();
  
  // Fade in
  requestAnimationFrame(function(){ sov.style.opacity='1'; });
  
  // Auto dismiss after 1.5s
  setTimeout(function(){
    sov.style.opacity='0';
    setTimeout(function(){ sov.remove(); }, 300);
  }, 1500);
};

/* ---- Wire buttons via delegation ---- */
document.addEventListener('click', function(e){
  var btn = e.target.closest('[data-pf-action]');
  if(!btn) return;
  e.preventDefault(); e.stopPropagation();
  var action = btn.getAttribute('data-pf-action');
  var name = btn.getAttribute('data-name') || 'Card';
  var val = parseInt(btn.getAttribute('data-val')) || 0;
  var val2 = parseInt(btn.getAttribute('data-val2')) || 0;
  switch(action){
    case 'sell-now':
      var hasBids = btn.getAttribute('data-hasbids') === '1';
      var bidAmt = parseInt(btn.getAttribute('data-bid')) || 0;
      var isListed = btn.getAttribute('data-listed') === '1';
      var listPrice = parseInt(btn.getAttribute('data-listprice')) || 0;
      pfSellNowModal(name, val, hasBids, bidAmt, isListed, listPrice);
      break;
    case 'edit-listing':
      pfSetPriceModal(name, val, true, parseInt(btn.getAttribute('data-listprice'))||val, btn.getAttribute('data-hasbids')==='1', parseInt(btn.getAttribute('data-bid'))||0);
      break;
    case 'sell': pfSellModal(name, val); break;
    case 'set-price':
      pfSetPriceModal(name, val, btn.getAttribute('data-listed')==='1', parseInt(btn.getAttribute('data-listprice'))||val, btn.getAttribute('data-hasbids')==='1', parseInt(btn.getAttribute('data-bid'))||0);
      break;
    case 'list': pfListModal(name, val); break;
    case 'cancel-listing': pfCancelListingModal(name, val, el.dataset.grade); break;
    case 'cancel-bid': pfCancelBidModal(name, val); break;
    case 'raise-bid': pfRaiseBidModal(name, val, val2); break;
    case 'target-price': pfTargetPriceModal(name, val); break;
    case 'remove-watch': pfRemoveWatchModal(name); break;
    case 'buy-now': pfBuyNowModal(name, val); break;
    case 'bid': pfBidModal(name, val); break;
    case 'withdraw': window.location.href = 'Withdraw.html'; break;
    case 'remove-asset': pfRemoveAssetModal(name); break;
  }
});

/* ---- Center dialog for cancel/remove confirmations ---- */
var _dlgOv = document.createElement('div');
_dlgOv.id = 'pf-dialog-overlay';
_dlgOv.style.cssText = 'position:fixed;inset:0;z-index:210;display:none;align-items:center;justify-content:center;background:rgba(6,6,14,0.7);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
document.body.appendChild(_dlgOv);
var _dlg = document.createElement('div');
_dlg.style.cssText = 'background:#1e1e2e;border-radius:16px;padding:28px;max-width:380px;width:90%;box-shadow:0 24px 64px rgba(0,0,0,0.6);position:relative;';
_dlgOv.appendChild(_dlg);
function _openDlg(h){ _dlg.innerHTML=h; _dlgOv.style.display='flex'; }
window._closeDlg = function(){ _dlgOv.style.display='none'; _dlg.innerHTML=''; };
_dlgOv.addEventListener('click',function(e){ if(e.target===_dlgOv) _closeDlg(); });

var _dlgClose = '<button onclick="_closeDlg()" style="position:absolute;top:14px;right:14px;width:32px;height:32px;border:0;background:rgba(255,255,255,0.06);border-radius:8px;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&#10005;</button>';
var _dlgDanger = 'width:100%;height:48px;border:0;border-radius:10px;background:rgba(228,55,74,0.15);color:#E4374A;font-family:var(--font-sans);font-size:15px;font-weight:600;cursor:pointer;';
var _dlgGhost = 'width:100%;height:48px;border:0;border-radius:10px;background:rgba(255,255,255,0.06);color:#fff;font-family:var(--font-sans);font-size:15px;font-weight:600;cursor:pointer;margin-top:8px;';
var _dlgLabel = 'font-family:var(--font-mono);font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.38);font-weight:600;margin-bottom:6px;';

window.pfCancelListingModal = function(name, listPrice, grade){
  grade = grade || 'PSA 10';
  _openDlg(_dlgClose +
    '<div style="'+_dlgLabel+'">Cancel Listing?</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 4px;">Your listing will be removed from the market.</div>' +
    '<div style="padding:16px;background:rgba(255,255,255,0.03);border-radius:10px;margin:16px 0 20px;">' +
      '<div style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">' + name + ' &middot; ' + grade + ' &middot; <strong style="color:#fff;">Listed $' + fmtPrice(listPrice) + '</strong></div>' +
    '</div>' +
    '<button style="'+_dlgDanger+'" onclick="_closeDlg();pfConfirmAction(\'cancelled\')">Cancel Listing</button>' +
    '<button style="'+_dlgGhost+'" onclick="_closeDlg()">Keep Listed</button>'
  );
};

window.pfCancelBidModal = function(name, bidAmt){
  _openDlg(_dlgClose +
    '<div style="'+_dlgLabel+'">Cancel bid</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 16px;">' + name + '</div>' +
    '<div style="padding:16px;background:rgba(228,55,74,0.06);border-radius:10px;margin-bottom:20px;">' +
      '<div style="font-size:14px;color:rgba(255,255,255,0.7);line-height:1.5;">Your bid of <strong style="color:#fff;">$' + fmtPrice(bidAmt) + '</strong> will be withdrawn. Funds will be released back to your wallet.</div>' +
    '</div>' +
    '<button style="'+_dlgDanger+'" onclick="_closeDlg();pfConfirmAction(\'bid cancelled\')">Cancel Bid</button>' +
    '<button style="'+_dlgGhost+'" onclick="_closeDlg()">Keep Bid</button>'
  );
};

window.pfRemoveWatchModal = function(name){
  _openDlg(_dlgClose +
    '<div style="'+_dlgLabel+'">Remove from watchlist</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 16px;">' + name + '</div>' +
    '<div style="padding:16px;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:20px;">' +
      '<div style="font-size:14px;color:rgba(255,255,255,0.7);line-height:1.5;">This card will be removed from your watchlist and price alerts will be turned off.</div>' +
    '</div>' +
    '<button style="'+_dlgDanger+'" onclick="_closeDlg();pfConfirmAction(\'removed\')">Remove</button>' +
    '<button style="'+_dlgGhost+'" onclick="_closeDlg()">Keep Watching</button>'
  );
};

window.pfRemoveAssetModal = function(name){
  _openDlg(_dlgClose +
    '<div style="'+_dlgLabel+'">Remove card</div>' +
    '<div style="font-size:16px;font-weight:600;color:#fff;margin:8px 0 16px;">' + name + '</div>' +
    '<div style="padding:16px;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:20px;">' +
      '<div style="font-size:14px;color:rgba(255,255,255,0.7);line-height:1.5;">Remove this card from your assets? You physically own it &mdash; this only hides it from this list.</div>' +
    '</div>' +
    '<button style="'+_dlgDanger+'" onclick="_closeDlg();pfConfirmAction(\'removed\')">Remove</button>' +
    '<button style="'+_dlgGhost+'" onclick="_closeDlg()">Keep</button>'
  );
};

/* Auto-open Set Price drawer when arriving from Sell home (?setprice=NAME&val=&bid=) */
(function(){
  function openFromQuery(){
    try{
      var p = new URLSearchParams(window.location.search);
      var name = p.get('setprice');
      if(!name) return;
      var val = parseInt(p.get('val'))||0;
      var bid = parseInt(p.get('bid'))||0;
      if(typeof pfSetPriceModal==='function') pfSetPriceModal(name, val, false, val, bid>0, bid);
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(openFromQuery, 300); });
  else setTimeout(openFromQuery, 300);
})();

})();
