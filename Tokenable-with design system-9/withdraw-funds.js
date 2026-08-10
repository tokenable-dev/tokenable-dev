/* withdraw-funds.js — Withdraw funds flow (delegated; survives DC re-render). */
(function(){
  var AVAILABLE = 2480, MIN = 20, LIMIT = 25000;
  var BLOCKED = '0x0000000000000000000000000000000000000bad';
  var st = { step:1, amount:0, method:'bank', bank:'saved', addr:'', net:'Polygon', kyc:true };
  var failMode = false;

  function $(id){ return document.getElementById(id); }
  function money(n){ return '$' + n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function setDisabled(el, v){ if(!el) return; el.disabled = v; if(v) el.setAttribute('disabled',''); else el.removeAttribute('disabled'); }
  function otpInputs(){ var o = $('otp'); return o ? [].slice.call(o.querySelectorAll('input')) : []; }
  function otpValue(){ return otpInputs().map(function(i){ return i.value; }).join(''); }

  function show(step){
    st.step = step;
    ['pane-kyc','pane-1','pane-2','pane-3','pane-4'].forEach(function(id){ var p = $(id); if(p) p.classList.remove('on'); });
    var target = $(step==='kyc' ? 'pane-kyc' : 'pane-'+step);
    if(target) target.classList.add('on');
    var n = step==='kyc' ? 1 : step;
    document.querySelectorAll('.step').forEach(function(el){
      var i = +el.getAttribute('data-step');
      el.classList.toggle('on', i===n);
      el.classList.toggle('done', i<n);
    });
    window.scrollTo(0,0);
  }

  function amountValid(){
    var inp = $('amtInput'); if(!inp) return false;
    var v = parseFloat(inp.value.replace(/[^0-9.]/g,'')) || 0;
    st.amount = v;
    var msg = '';
    if(v > AVAILABLE) msg = "That's more than your available balance. 640.00 USDC is reserved by open bids.";
    else if(v > LIMIT) msg = 'Above your daily limit of ' + money(LIMIT) + '.';
    else if(v > 0 && v < MIN) msg = 'Minimum withdrawal is ' + money(MIN) + '.';
    var err = $('amtErr');
    if(err){ err.textContent = msg; err.classList.toggle('on', !!msg); }
    var box = $('amtBox'); if(box) box.classList.toggle('err', !!msg);
    var ok = v > 0 && !msg;
    setDisabled($('next1'), !ok);
    return ok;
  }

  function shortAddr(a){ return a.slice(0,6) + '\u2026' + a.slice(-4); }
  function destLabel(){ return st.method==='bank' ? 'Chase \u2022\u2022\u2022\u2022 4417' : shortAddr(st.addr); }

  function fillReview(){
    var fee = st.method==='bank' ? st.amount*0.015 + 0.5 : 0.42;
    var net = Math.max(0, st.amount - fee);
    var set = function(id, txt){ var el = $(id); if(el) el.textContent = txt; };
    set('rvAmount', money(st.amount));
    set('rvMethod', st.method==='bank' ? 'To your bank' : 'To an external wallet');
    set('rvDest', destLabel());
    var nr = $('rvNetRow'); if(nr) nr.style.display = st.method==='wallet' ? '' : 'none';
    set('rvNet', st.net);
    set('rvFeeK', st.method==='bank' ? 'Payout fee (1.5% + $0.50)' : 'Network fee (' + st.net + ')');
    set('rvFee', '\u2212' + money(fee));
    set('rvEta', st.method==='bank' ? '1\u20133 business days' : 'Usually within minutes');
    set('rvNetAmt', money(net));
    var rw = $('reviewWarn'); if(rw) rw.style.display = st.method==='wallet' ? '' : 'none';
    set('okAmount', money(net));
    set('okDest', destLabel());
    set('okEta', st.method==='bank' ? 'Arriving in 1\u20133 business days' : 'Usually within minutes');
    set('okFinal', st.method==='bank' ? 'Paid to your bank' : 'Sent on-chain');
  }

  function pickGroup(attr, btn){
    document.querySelectorAll('['+attr+']').forEach(function(x){ x.classList.remove('on'); });
    btn.classList.add('on');
    return btn.getAttribute(attr);
  }

  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t.closest) return;

    if(t.closest('#maxBtn')){ var ai = $('amtInput'); if(ai){ ai.value = AVAILABLE.toFixed(2); amountValid(); } return; }

    var m = t.closest('[data-method]'); if(m){ st.method = pickGroup('data-method', m); return; }
    var bk = t.closest('[data-bank]'); if(bk){ st.bank = pickGroup('data-bank', bk); return; }
    var nt = t.closest('[data-net]'); if(nt){ st.net = pickGroup('data-net', nt); return; }

    if(t.closest('#useMine')){
      var ad = $('addrInput');
      if(ad){ ad.value = '0xF4b93C1a7e2D5f08A3c6E19b4D7a02c58Ce29aE2'; ad.classList.remove('inp--err'); }
      var ae = $('addrErr'); if(ae) ae.classList.remove('on');
      return;
    }

    if(t.closest('#next1')){
      if(!amountValid()) return;
      var needsCheck = st.method === 'bank' || st.amount >= 10000;
      if(needsCheck && !st.kyc){ show('kyc'); return; }
      var db = $('dest-bank'), dw = $('dest-wallet');
      if(db) db.style.display = st.method==='bank' ? '' : 'none';
      if(dw) dw.style.display = st.method==='wallet' ? '' : 'none';
      show(2);
      return;
    }

    if(t.closest('#next2')){
      if(st.method==='wallet'){
        var inp = $('addrInput'); if(!inp) return;
        var a = inp.value.trim(), msg = '';
        if(!/^0x[a-fA-F0-9]{40}$/.test(a)) msg = "That doesn't look like a valid wallet address.";
        else if(a.toLowerCase() === BLOCKED) msg = "We can't send to this address. It's flagged by our compliance screening.";
        var er = $('addrErr');
        if(er){ er.textContent = msg; er.classList.toggle('on', !!msg); }
        inp.classList.toggle('inp--err', !!msg);
        if(msg) return;
        st.addr = a;
      }
      fillReview();
      show(3);
      return;
    }

    var cb = t.closest('#confirmBtn');
    if(cb){
      var oe = $('otpErr');
      if(otpValue().length !== 6){ if(oe){ oe.textContent = "Enter all 6 digits to approve."; oe.classList.add('on'); } return; }
      setDisabled(cb, true);
      cb.textContent = 'Submitting\u2026';
      setTimeout(function(){
        var btn = $('confirmBtn');
        if(btn) btn.textContent = 'Confirm withdrawal';
        if(failMode){
          if(oe){ oe.textContent = "We couldn't complete this withdrawal. Nothing left your balance \u2014 try again in a few minutes."; oe.classList.add('on'); }
          setDisabled(btn, false);
          return;
        }
        var d = new Date(), ot = $('okTime');
        if(ot) ot.textContent = d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + ' \u00b7 ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
        show(4);
      }, 900);
      return;
    }

    var g = t.closest('[data-goto]');
    if(g){ show(+g.getAttribute('data-goto')); return; }

    if(t.closest('#devKyc')){
      st.kyc = !st.kyc;
      var k = $('devKyc');
      k.textContent = 'Identity: ' + (st.kyc ? 'verified' : 'not verified');
      k.classList.toggle('on', !st.kyc);
      return;
    }
    if(t.closest('#devFail')){ failMode = !failMode; $('devFail').classList.toggle('on', failMode); return; }
    if(t.closest('#devReset')){
      var a1 = $('amtInput'); if(a1) a1.value = '';
      var a2 = $('addrInput'); if(a2){ a2.value = ''; a2.classList.remove('inp--err'); }
      otpInputs().forEach(function(i){ i.value = ''; });
      setDisabled($('confirmBtn'), true);
      var e1 = $('otpErr'); if(e1) e1.classList.remove('on');
      var e2 = $('addrErr'); if(e2) e2.classList.remove('on');
      amountValid();
      show(1);
      return;
    }
  }, false);

  document.addEventListener('input', function(e){
    var t = e.target;
    if(t.id === 'amtInput'){ amountValid(); return; }
    if(t.id === 'addrInput'){
      t.classList.remove('inp--err');
      var er = $('addrErr'); if(er) er.classList.remove('on');
      return;
    }
    var o = otpInputs();
    var i = o.indexOf(t);
    if(i >= 0){
      t.value = t.value.replace(/[^0-9]/g,'');
      if(t.value && o[i+1]) o[i+1].focus();
      var oe = $('otpErr'); if(oe) oe.classList.remove('on');
      setDisabled($('confirmBtn'), otpValue().length !== 6);
    }
  }, false);

  document.addEventListener('keydown', function(e){
    var o = otpInputs(), i = o.indexOf(e.target);
    if(i >= 0 && e.key === 'Backspace' && !e.target.value && o[i-1]) o[i-1].focus();
  }, false);

  /* Re-apply JS-owned state after DC re-renders. */
  function sync(){
    if(!$('pane-1')) return;
    if(!$('amtInput')) return;
    var n1 = $('next1');
    if(n1 && !n1.hasAttribute('disabled') && !amountValidQuiet()) setDisabled(n1, true);
    var cf = $('confirmBtn');
    if(cf && !cf.hasAttribute('disabled') && otpValue().length !== 6) setDisabled(cf, true);
  }
  function amountValidQuiet(){
    var inp = $('amtInput'); if(!inp) return false;
    var v = parseFloat(inp.value.replace(/[^0-9.]/g,'')) || 0;
    return v > 0 && v >= MIN && v <= AVAILABLE && v <= LIMIT;
  }
  sync();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  setInterval(sync, 200);
  if(window.MutationObserver) new MutationObserver(sync).observe(document.documentElement, { childList:true, subtree:true });
})();
