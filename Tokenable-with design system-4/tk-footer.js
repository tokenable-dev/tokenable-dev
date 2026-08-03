/* Tokenable — shared footer component.
   Insert <div id="tk-footer"></div> where the footer should appear.
   This script renders it automatically. */
(function(){
  var footerHTML = '' +
    '<div style="margin-top:auto;background:var(--ink-2);border-top:1px solid rgba(255,255,255,0.06);">' +
      '<div style="padding:48px clamp(16px,4vw,40px);display:flex;flex-wrap:wrap;gap:32px;align-items:center;justify-content:space-between;">' +
        '<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start;">' +
          '<img src="images/logo-tokenable.svg" alt="Tokenable" style="height:22px;">' +
          '<span class="mono" style="font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.04em;text-align:left;">Tokenized collectibles markets &copy; 2026</span>' +
        '</div>' +
        '<nav style="display:flex;gap:28px;flex-wrap:wrap;">' +
          '<a class="navlink" href="Markets.html" style="font-size:13px;">Markets</a>' +
          '<a class="navlink" href="Vault-Dashboard-Active.html" style="font-size:13px;">Sell</a>' +
          '<span class="navlink" style="font-size:13px;">Fees</span>' +
          '<span class="navlink" style="font-size:13px;">Docs</span>' +
          '<span class="navlink" style="font-size:13px;">Terms</span>' +
        '</nav>' +
      '</div>' +
    '</div>';

  function render(){
    var el = document.getElementById('tk-footer');
    if(el && !el.hasChildNodes()){
      el.innerHTML = footerHTML;
      el.style.marginTop = 'auto';
    }
  }

  // Try immediately
  render();

  // Poll every 200ms for 10s to catch DC host re-renders
  var attempts = 0;
  var interval = setInterval(function(){
    render();
    attempts++;
    if(attempts > 50) clearInterval(interval);
  }, 200);

  // Also observe for DOM changes
  if(typeof MutationObserver !== 'undefined'){
    var observer = new MutationObserver(function(){ render(); });
    var target = document.getElementById('tk-footer');
    if(target){
      observer.observe(target, {childList:true});
    } else {
      // Wait for element to appear
      var bodyObs = new MutationObserver(function(){
        var el = document.getElementById('tk-footer');
        if(el){
          bodyObs.disconnect();
          render();
          observer.observe(el, {childList:true});
        }
      });
      if(document.body) bodyObs.observe(document.body, {childList:true, subtree:true});
    }
  }
})();
