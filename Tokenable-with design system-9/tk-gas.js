/* tk-gas.js — Listing network fee: ETH top-up intercept
   Trigger: a listing is submitted while the wallet's ETH can't cover the network fee.
   Deliberate crypto exception — ETH / gas / network fee surface here, in plain language. */
(function(){
  if(window.tkGas) return;

  var FEE_PER_LISTING = 0.48;   // est. USD per listing at current gas
  var BUFFER = 1.25;            // headroom for gas fluctuation
  var KEY = 'tk_eth_usd';

  function balance(){ var v=parseFloat(localStorage.getItem(KEY)||'0'); return isNaN(v)?0:v; }
  function setBalance(v){ try{ localStorage.setItem(KEY, String(Math.max(0,v))); }catch(_){} }
  function feeFor(n){ return Math.max(1, n) * FEE_PER_LISTING * BUFFER; }
  function usd(v){ return '$' + (v<10 ? v.toFixed(2) : Math.round(v).toLocaleString('en-US')); }
  function listingsFor(v){ return Math.floor(v / (FEE_PER_LISTING*BUFFER)); }

  var css = document.createElement('style');
  css.textContent = [
    '.tkg-scrim{position:fixed;inset:0;z-index:900;background:rgba(0,0,0,0.62);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:24px;}',
    '.tkg-scrim.open{display:flex;}',
    '.tkg-sheet{width:100%;max-width:440px;max-height:88vh;overflow-y:auto;background:#141414;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.07);padding:26px 26px 24px;}',
    '.tkg-eyebrow{font-family:var(--font-mono,"JetBrains Mono",monospace);font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);}',
    '.tkg-h{font-family:var(--font-sans,Inter,sans-serif);font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#fff;margin:8px 0 10px;line-height:1.25;}',
    '.tkg-p{font-size:14px;line-height:1.65;color:rgba(255,255,255,0.62);margin:0;text-wrap:pretty;}',
    '.tkg-stat{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;background:#0e0e0e;border-radius:10px;}',
    '.tkg-stat + .tkg-stat{margin-top:8px;}',
    '.tkg-stat__k{font-size:13px;color:rgba(255,255,255,0.55);}',
    '.tkg-stat__v{font-family:var(--font-mono,"JetBrains Mono",monospace);font-size:15px;font-weight:700;color:#fff;}',
    '.tkg-link{background:none;border:0;padding:0;font-family:inherit;font-size:13px;font-weight:600;color:var(--azure,#1A6FFF);cursor:pointer;text-align:left;}',
    '.tkg-edu{display:none;margin-top:12px;padding:14px 16px;background:#0e0e0e;border-radius:10px;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.6);}',
    '.tkg-edu.open{display:block;}',
    '.tkg-edu p{margin:0;} .tkg-edu p + p{margin-top:10px;}',
    '.tkg-preset{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:#0e0e0e;border:0;border-radius:10px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.08);color:#fff;font-family:inherit;cursor:pointer;text-align:left;}',
    '.tkg-preset + .tkg-preset{margin-top:8px;}',
    '.tkg-preset:hover{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.2);}',
    '.tkg-preset.sel{box-shadow:inset 0 0 0 1.5px var(--azure,#1A6FFF);background:rgba(26,111,255,0.08);}',
    '.tkg-preset__a{font-family:var(--font-mono,"JetBrains Mono",monospace);font-size:16px;font-weight:700;}',
    '.tkg-preset__b{font-size:12px;color:rgba(255,255,255,0.45);}',
    '.tkg-pay{width:100%;display:flex;align-items:center;gap:12px;padding:14px 16px;background:#0e0e0e;border:0;border-radius:10px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.08);color:#fff;font-family:inherit;cursor:pointer;text-align:left;}',
    '.tkg-pay + .tkg-pay{margin-top:8px;}',
    '.tkg-pay:hover{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.2);}',
    '.tkg-pay__t{font-size:14px;font-weight:600;}',
    '.tkg-pay__d{font-size:12px;color:rgba(255,255,255,0.45);margin-top:2px;}',
    '.tkg-input{width:100%;height:48px;padding:0 14px;background:#fff;border:0;border-radius:10px;box-shadow:inset 0 0 0 2px rgba(0,0,0,0.12);color:#111;font-family:var(--font-mono,"JetBrains Mono",monospace);font-size:15px;font-weight:600;}',
    '.tkg-x{position:absolute;top:14px;right:14px;width:34px;height:34px;border:0;background:rgba(255,255,255,0.07);border-radius:9px;color:rgba(255,255,255,0.55);font-size:17px;cursor:pointer;}',
    '.tkg-x:hover{background:rgba(255,255,255,0.14);color:#fff;}',
    '.tkg-warn{margin-top:14px;padding:12px 14px;background:rgba(234,130,0,0.1);border-radius:10px;font-size:13px;line-height:1.6;color:#EABF7A;}',
    '.tkg-addr{font-family:var(--font-mono,"JetBrains Mono",monospace);font-size:12.5px;line-height:1.7;color:#fff;word-break:break-all;}',
    '@media(max-width:560px){.tkg-scrim{align-items:flex-end;padding:0;}.tkg-sheet{max-width:none;border-radius:16px 16px 0 0;max-height:92vh;padding-bottom:calc(24px + env(safe-area-inset-bottom));}}'
  ].join('\n');
  document.head.appendChild(css);

  var scrim = document.createElement('div');
  scrim.className = 'tkg-scrim';
  scrim.innerHTML = '<div class="tkg-sheet" style="position:relative;"><button class="tkg-x" data-tkg="close" aria-label="Close">&times;</button><div id="tkg-body"></div></div>';
  document.body.appendChild(scrim);
  var body = scrim.querySelector('#tkg-body');

  var ctx = { count:1, onProceed:null, amount:0 };

  function open(){ scrim.classList.add('open'); }
  function close(){ scrim.classList.remove('open'); ctx.onProceed=null; }

  /* ① Intercept — why ETH is needed at all */
  function screenIntercept(){
    var need = feeFor(ctx.count), bal = balance();
    var affordable = listingsFor(bal);
    body.innerHTML = [
      '<div class="tkg-eyebrow">Network fee</div>',
      '<h2 class="tkg-h">Add ETH to list your cards</h2>',
      '<p class="tkg-p">Listing runs on the Ethereum network, which charges a small fee (gas) to record each listing &mdash; usually under $1. This isn&rsquo;t a Tokenable fee; it goes to the network.</p>',
      '<div style="margin-top:18px;">',
      '  <div class="tkg-stat"><span class="tkg-stat__k">Your balance</span><span class="tkg-stat__v" style="color:' + (bal<=0?'#E4374A':'#fff') + ';">' + usd(bal) + '</span></div>',
      '  <div class="tkg-stat"><span class="tkg-stat__k">Est. fee &middot; ' + ctx.count + ' listing' + (ctx.count===1?'':'s') + '</span><span class="tkg-stat__v">~' + usd(need) + '</span></div>',
      '</div>',
      (bal>0 && affordable>0
        ? '<div class="tkg-warn">You can list ' + affordable + ' of ' + ctx.count + ' now. Add about ' + usd(need-bal) + ' more to cover the rest.</div>'
        : ''),
      '<p class="tkg-p" style="margin-top:14px;color:rgba(255,255,255,0.5);">Top up once &mdash; it covers many listings.</p>',
      '<button class="tk-btn tk-btn--primary" data-tkg="add" style="height:52px;width:100%;font-size:15px;margin-top:20px;">Add ETH</button>',
      '<div style="margin-top:14px;"><button class="tkg-link" data-tkg="edu">What&rsquo;s a network fee?</button></div>',
      '<div class="tkg-edu" id="tkg-edu">',
      '  <p>The Ethereum network charges a tiny fee to record your listing on-chain. It&rsquo;s not charged by Tokenable &mdash; it goes to the network that keeps ownership secure and verifiable.</p>',
      '  <p>It&rsquo;s usually a few cents to under a dollar per listing, and you only pay it when you list.</p>',
      '  <p>You hold the ETH in your own account. Anything left over stays there for your next listings.</p>',
      '</div>'
    ].join('');
    open();
  }

  /* ② Add ETH — presets framed by how many listings they cover */
  function screenAdd(){
    var presets = [20,40,100];
    ctx.amount = ctx.amount || presets[0];
    body.innerHTML = [
      '<div class="tkg-eyebrow">Step 2 of 2</div>',
      '<h2 class="tkg-h">Add ETH</h2>',
      '<p class="tkg-p">Fund once, then list as many cards as you like.</p>',
      '<div style="margin-top:18px;">',
      presets.map(function(a){
        return '<button class="tkg-preset' + (ctx.amount===a?' sel':'') + '" data-tkg="amount" data-a="' + a + '">'
          + '<span class="tkg-preset__a">$' + a + '</span>'
          + '<span class="tkg-preset__b">~' + listingsFor(a) + ' listings</span></button>';
      }).join(''),
      '</div>',
      '<div style="margin-top:14px;">',
      '  <label class="tkg-eyebrow" style="display:block;margin-bottom:8px;">Custom amount (USD)</label>',
      '  <input class="tkg-input" id="tkg-custom" inputmode="decimal" placeholder="e.g. 60">',
      '</div>',
      '<div class="tkg-eyebrow" style="margin:22px 0 10px;">How to pay</div>',
      '<button class="tkg-pay" data-tkg="card"><span style="width:34px;height:34px;flex:none;border-radius:9px;background:rgba(26,111,255,0.14);display:flex;align-items:center;justify-content:center;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5B9AFF" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></span><span style="flex:1;"><span class="tkg-pay__t" style="display:block;">Buy with card</span><span class="tkg-pay__d">Instant &middot; via MoonPay</span></span></button>',
      '<button class="tkg-pay" data-tkg="transfer"><span style="width:34px;height:34px;flex:none;border-radius:9px;background:rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></span><span style="flex:1;"><span class="tkg-pay__t" style="display:block;">Transfer ETH</span><span class="tkg-pay__d">From another account</span></span></button>',
      '<p class="tkg-p" style="margin-top:14px;font-size:12.5px;color:rgba(255,255,255,0.4);">Leftover ETH stays in your account for future listings.</p>'
    ].join('');
    open();
  }

  /* Card on-ramp — $ leads, ETH secondary */
  function screenCard(){
    var amt = ctx.amount;
    body.innerHTML = [
      '<div class="tkg-eyebrow">MoonPay</div>',
      '<h2 class="tkg-h">Buying ' + usd(amt) + ' of ETH</h2>',
      '<p class="tkg-p">Confirming your payment with MoonPay. This usually takes a few seconds.</p>',
      '<div style="margin-top:20px;height:6px;border-radius:3px;background:rgba(255,255,255,0.09);overflow:hidden;"><div id="tkg-bar" style="height:100%;width:6%;background:var(--azure,#1A6FFF);transition:width 260ms linear;"></div></div>',
      '<div class="tkg-eyebrow" id="tkg-bar-label" style="margin-top:10px;">Contacting MoonPay&hellip;</div>'
    ].join('');
    open();
    var p=6, stages=[[35,'Contacting MoonPay&hellip;'],[72,'Confirming your card&hellip;'],[96,'Delivering ETH to your account&hellip;']];
    var bar=document.getElementById('tkg-bar'), lab=document.getElementById('tkg-bar-label');
    var t=setInterval(function(){
      var st=stages[0];
      for(var i=0;i<stages.length;i++){ if(p<stages[i][0]){ st=stages[i]; break; } }
      p += Math.max(1.2,(st[0]-p)*0.18);
      if(p>=99){ clearInterval(t); bar.style.width='100%'; setBalance(balance()+amt); setTimeout(screenDone,320); return; }
      bar.style.width=p.toFixed(1)+'%';
      if(lab.innerHTML!==st[1]) lab.innerHTML=st[1];
    }, 110);
  }

  /* Transfer — deposit address, auto-detect arrival */
  function screenTransfer(){
    var ADDR='0xF4b93C1a7e2D5f08A3c6E19b4D7a02c58Ce29aE2';
    body.innerHTML = [
      '<div class="tkg-eyebrow">Transfer ETH</div>',
      '<h2 class="tkg-h">Send ETH to your account</h2>',
      '<p class="tkg-p">Send any amount of ETH (Ethereum mainnet) to the address below. We&rsquo;ll continue automatically once it arrives.</p>',
      '<div style="margin-top:18px;padding:16px;background:#0e0e0e;border-radius:10px;display:flex;align-items:flex-start;gap:12px;">',
      '  <span class="tkg-addr" style="flex:1;">' + ADDR + '</span>',
      '  <button class="tk-copy-addr" type="button" aria-label="Copy address" title="Copy address" data-addr="' + ADDR + '" style="width:30px;height:30px;flex:none;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.07);border:0;border-radius:8px;color:rgba(255,255,255,0.6);cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>',
      '</div>',
      '<div class="tkg-stat" style="margin-top:14px;"><span class="tkg-stat__k">Waiting for your transfer to arrive</span><span class="tkg-stat__v" style="color:#EA8200;">&hellip;</span></div>',
      '<button class="tk-btn tk-btn--subtle" data-tkg="add" style="height:46px;width:100%;font-size:14px;margin-top:16px;">Pay with card instead</button>'
    ].join('');
    open();
    // demo arrival
    ctx._wait = setTimeout(function(){ setBalance(balance() + (ctx.amount||20)); screenDone(); }, 3200);
  }

  function screenDone(){
    var bal = balance();
    body.innerHTML = [
      '<div style="width:46px;height:46px;border-radius:12px;background:rgba(0,200,100,0.14);display:flex;align-items:center;justify-content:center;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--pos,#00C350)" stroke-width="2.6"><polyline points="20 6 9 17 4 12"/></svg></div>',
      '<h2 class="tkg-h">You&rsquo;re funded</h2>',
      '<p class="tkg-p">Your balance is ' + usd(bal) + ' &mdash; enough for about ' + listingsFor(bal) + ' listings. We&rsquo;ll finish listing your cards now.</p>',
      '<button class="tk-btn tk-btn--primary" data-tkg="resume" style="height:52px;width:100%;font-size:15px;margin-top:20px;">Continue listing</button>'
    ].join('');
    open();
  }

  /* Slim nudge when gas moved between estimate and submit */
  function screenNudge(){
    var need=feeFor(ctx.count)-balance();
    body.innerHTML = [
      '<div class="tkg-eyebrow">Network fee changed</div>',
      '<h2 class="tkg-h">A little more ETH needed</h2>',
      '<p class="tkg-p">The network fee rose while you were listing. Add about ' + usd(need) + ' to finish.</p>',
      '<button class="tk-btn tk-btn--primary" data-tkg="add" style="height:52px;width:100%;font-size:15px;margin-top:20px;">Add ETH</button>'
    ].join('');
    open();
  }

  scrim.addEventListener('click', function(e){
    if(e.target===scrim){ close(); return; }
    var b=e.target.closest && e.target.closest('[data-tkg]');
    if(!b) return;
    var a=b.getAttribute('data-tkg');
    if(a==='close'){ if(ctx._wait) clearTimeout(ctx._wait); close(); return; }
    if(a==='edu'){ var ed=document.getElementById('tkg-edu'); if(ed) ed.classList.toggle('open'); return; }
    if(a==='add'){ if(ctx._wait) clearTimeout(ctx._wait); screenAdd(); return; }
    if(a==='amount'){
      ctx.amount=parseFloat(b.getAttribute('data-a'));
      body.querySelectorAll('[data-tkg="amount"]').forEach(function(x){ x.classList.toggle('sel', x===b); });
      var ci=document.getElementById('tkg-custom'); if(ci) ci.value='';
      return;
    }
    if(a==='card'){ readCustom(); screenCard(); return; }
    if(a==='transfer'){ readCustom(); screenTransfer(); return; }
    if(a==='resume'){
      var fn=ctx.onProceed; close();
      // re-check at submit: gas may have moved while funding
      if(balance() < feeFor(ctx.count)){ ctx.onProceed=fn; screenNudge(); return; }
      if(fn) fn();
      return;
    }
  });

  function readCustom(){
    var ci=document.getElementById('tkg-custom');
    var v=ci && parseFloat((ci.value||'').replace(/[^0-9.]/g,''));
    if(v && v>0) ctx.amount=v;
  }

  window.tkGas = {
    balanceUsd: balance,
    setBalanceUsd: setBalance,
    feeUsd: feeFor,
    /* Gate a listing submit. Calls onProceed() immediately when funded. */
    require: function(count, onProceed){
      ctx.count = Math.max(1, count||1);
      ctx.onProceed = onProceed;
      ctx.amount = 0;
      if(balance() >= feeFor(ctx.count)){ if(onProceed) onProceed(); return true; }
      screenIntercept();
      return false;
    }
  };
})();
