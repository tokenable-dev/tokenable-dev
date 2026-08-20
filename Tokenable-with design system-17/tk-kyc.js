/* tk-kyc.js — KYC verification modal (shared across pages) */
(function(){
  if(window.__tkKycLoaded) return;
  window.__tkKycLoaded = true;

  /* ── CSS ── */
  var style = document.createElement('style');
  style.textContent = `
    .kyc-overlay{display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);justify-content:center;align-items:center;}
    .kyc-overlay.open{display:flex;}
    .kyc-modal{width:480px;max-width:calc(100vw - 32px);max-height:calc(100vh - 48px);overflow-y:auto;background:#1a1a1e;border-radius:16px;padding:36px 32px 28px;position:relative;animation:kycIn 0.25s ease;}
    @keyframes kycIn{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
    .kyc-close{position:absolute;top:16px;right:16px;width:36px;height:36px;border:0;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:background 0.15s;}
    .kyc-close:hover{background:rgba(255,255,255,0.12);color:#fff;}
    .kyc-icon{width:56px;height:56px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;background:rgba(26,111,255,0.1);border-radius:14px;}
    .kyc-title{font-family:var(--font-sans,'Inter',sans-serif);font-size:22px;font-weight:700;color:#fff;text-align:center;margin:0 0 8px;letter-spacing:-0.02em;}
    .kyc-sub{font-size:14px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.7;margin:0 0 28px;max-width:380px;margin-left:auto;margin-right:auto;}
    .kyc-needs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px;}
    .kyc-need{background:rgba(255,255,255,0.03);border-radius:12px;padding:18px 12px;text-align:center;}
    .kyc-need__icon{width:36px;height:36px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;background:rgba(26,111,255,0.08);border-radius:10px;}
    .kyc-need__title{font-family:var(--font-sans);font-size:13px;font-weight:700;color:#fff;margin-bottom:4px;}
    .kyc-need__desc{font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;}
    .kyc-checks{margin-bottom:24px;}
    .kyc-check{display:flex;align-items:flex-start;gap:10px;padding:5px 0;font-size:13px;color:rgba(255,255,255,0.45);line-height:1.5;}
    .kyc-check svg{flex-shrink:0;margin-top:2px;}
    .kyc-trigger{background:rgba(26,111,255,0.06);border:1px solid rgba(26,111,255,0.12);border-radius:10px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;}
    .kyc-privacy{font-size:11px;color:rgba(255,255,255,0.25);line-height:1.7;text-align:center;margin-bottom:20px;}
    .kyc-privacy a{color:var(--azure,#1A6FFF);text-decoration:none;font-weight:600;}
    .kyc-cta{display:flex;flex-direction:column;gap:10px;}
    .kyc-time{font-size:11px;color:rgba(255,255,255,0.25);text-align:center;margin-top:8px;font-family:var(--font-mono,'JetBrains Mono',monospace);letter-spacing:0.04em;}
    @media(max-width:600px){
      .kyc-overlay.open{align-items:flex-end;}
      .kyc-modal{border-radius:20px 20px 0 0;max-height:92vh;animation:kycUp 0.3s ease;}
      @keyframes kycUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
      .kyc-needs{grid-template-columns:repeat(3,1fr);gap:8px;}
      .kyc-need{padding:14px 8px;}
    }
  `;
  document.head.appendChild(style);

  /* ── HTML ── */
  var overlay = document.createElement('div');
  overlay.className = 'kyc-overlay';
  overlay.id = 'kyc-overlay';
  overlay.innerHTML = `
    <div class="kyc-modal">
      <button class="kyc-close" id="kyc-close">&times;</button>

      <div class="kyc-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--azure,#1A6FFF)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9 12 11.5 14.5 16 10" stroke-width="2.5"/>
        </svg>
      </div>

      <h2 class="kyc-title">Verify Your Identity</h2>
      <p class="kyc-sub">To submit cards or sell on Tokenable, we need to verify your identity. This is a one-time process and takes about 2 minutes.</p>

      <div class="kyc-needs">
        <div class="kyc-need">
          <div class="kyc-need__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
          </div>
          <div class="kyc-need__title">Government ID</div>
          <div class="kyc-need__desc">Passport or Driver's License</div>
        </div>
        <div class="kyc-need">
          <div class="kyc-need__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
          </div>
          <div class="kyc-need__title">Selfie</div>
          <div class="kyc-need__desc">Quick liveness check</div>
        </div>
        <div class="kyc-need">
          <div class="kyc-need__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--pos,#00C350)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="kyc-need__title">One Time</div>
          <div class="kyc-need__desc">Never repeat this again</div>
        </div>
      </div>

      <div class="kyc-checks">
        <div class="kyc-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pos,#00C350)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Required for Vault submission</span></div>
        <div class="kyc-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pos,#00C350)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Required for selling cards</span></div>
        <div class="kyc-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pos,#00C350)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Keeps our platform secure</span></div>
        <div class="kyc-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pos,#00C350)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Your data is encrypted and processed by Sumsub</span></div>
      </div>

      <div class="kyc-trigger" id="kyc-trigger-msg"></div>

      <div class="kyc-privacy">Your documents are encrypted and processed by Sumsub, our trusted KYC partner. Tokenable does not store your ID documents. <a href="#">Privacy Policy →</a></div>

      <div class="kyc-cta">
        <button class="tk-btn tk-btn--primary" id="kyc-start-btn" style="height:52px;width:100%;font-size:15px;">Start Verification →</button>
        <button class="tk-btn tk-btn--subtle" id="kyc-later-btn" style="height:44px;width:100%;font-size:13px;color:rgba(255,255,255,0.4);">I'll do this later</button>
      </div>
      <div class="kyc-time">Estimated time: 1–2 minutes</div>
    </div>
  `;
  document.body.appendChild(overlay);

  /* ── Region rules ──
     What we must collect differs by country; the modal says which one applies
     so the ask doesn't look arbitrary. */
  var REGIONS = {
    KR: { name:'South Korea', needs:['Government ID', 'Selfie', 'Mobile number'],
          note:'Korea requires full identity verification before a physical card can be shipped.' },
    US: { name:'United States', needs:['Government ID', 'Shipping address'],
          note:'In the US we confirm your name, address and a government ID before shipping.' },
    DEFAULT: { name:'', needs:['Government ID', 'Selfie'],
          note:'We verify identity before shipping a physical card, so it reaches its rightful owner.' }
  };
  function region(){
    var cc = '';
    try{ cc = localStorage.getItem('tk_region') || ''; }catch(e){}
    if(!cc){
      // Fall back to the browser's locale rather than asking again.
      var loc = (navigator.language || '').toUpperCase();
      cc = loc.indexOf('KO') === 0 || loc.indexOf('-KR') > 0 ? 'KR' : loc.indexOf('-US') > 0 ? 'US' : '';
    }
    return REGIONS[cc] || REGIONS.DEFAULT;
  }

  function verified(){
    try{ return localStorage.getItem('tk_kyc') === 'verified'; }catch(e){ return false; }
  }

  /* ── API ── */
  window.tkKycVerified = verified;

  /* Gate a physical action behind one-time verification. Resolves straight
     through once the seller flow (or an earlier shipment) has verified. */
  window.tkRequireKyc = function(context, onOk){
    if(verified()){ if(typeof onOk === 'function') onOk(); return true; }
    window.__kycAfter = typeof onOk === 'function' ? onOk : null;
    openKycModal(context);
    return false;
  };

  window.openKycModal = function(context){
    var msg = document.getElementById('kyc-trigger-msg');
    var R = region();
    if(context === 'ship'){
      msg.innerHTML = "You’re about to have a physical card shipped to you. " + R.note
        + (R.name ? ' <b style="color:rgba(255,255,255,0.75);">' + R.name + '</b>' : '');
    } else if(context === 'vault'){
      msg.textContent = "You're about to submit a card to the Vault. Identity verification is required.";
    } else if(context === 'sell' || context === 'list'){
      msg.textContent = "You're about to list a card for sale. Identity verification is required.";
    } else {
      msg.textContent = "Identity verification is required to continue.";
    }
    var sub = overlay.querySelector('.kyc-sub');
    if(sub) sub.textContent = context === 'ship'
      ? 'We ship only to a verified owner. This is a one-time check and takes about 2 minutes.'
      : 'To submit cards or sell on Tokenable, we need to verify your identity. This is a one-time process and takes about 2 minutes.';
    var needs = overlay.querySelectorAll('.kyc-need__title');
    if(context === 'ship' && needs.length >= 2){
      needs[0].textContent = R.needs[0];
      needs[1].textContent = R.needs[1];
      var descs = overlay.querySelectorAll('.kyc-need__desc');
      if(descs[1]) descs[1].textContent = R.needs[1] === 'Selfie' ? 'Quick liveness check'
        : R.needs[1] === 'Mobile number' ? 'One-time code' : 'Where the card goes';
    }
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeKycModal = function(){
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  };

  /* ── Events ── */
  document.addEventListener('click', function(e){
    if(e.target.closest('#kyc-close') || e.target.closest('#kyc-later-btn')){
      closeKycModal();
    }
    if(e.target === overlay){
      closeKycModal();
    }
    if(e.target.closest('#kyc-start-btn')){
      var btn = e.target.closest('#kyc-start-btn');
      btn.textContent = 'Opening verification…';
      btn.disabled = true;
      setTimeout(function(){
        btn.textContent = 'Start Verification →';
        btn.disabled = false;
        /* In production: redirect to Sumsub or open their SDK. The result
           persists so the check is genuinely one-time. */
        try{ localStorage.setItem('tk_kyc', 'verified'); }catch(err){}
        closeKycModal();
        var after = window.__kycAfter; window.__kycAfter = null;
        if(typeof after === 'function') after();
      }, 2000);
    }
  });
})();
