/* tk-links.js — resolves account-dependent destinations.

   Partner status is an account flag set in Admin-Partners.html
   (localStorage tk_partner_status), not a separate login. Two destinations
   depend on it, so pages mark the anchor instead of hard-coding a page:

     <a data-tk-link="sell-start"  href="Choose-Vault-Individual.html">
     <a data-tk-link="portfolio"   href="Portfolio.html">

   The href in the markup is the individual-account default, so the link
   still works with JS off. */
(function(){
  function isPartner(){
    try{ return localStorage.getItem('tk_partner_status') === 'approved'; }
    catch(_){ return false; }
  }
  var MAP = {
    // Partners register on Sell-Flow (identity + seller consents), then reach the
    // partner vault chooser. Choose-Vault-Individual carries its own register step.
    'sell-start': function(){ return isPartner() ? 'Sell-Flow.html' : 'Choose-Vault-Individual.html'; },
    'portfolio':  function(){ return isPartner() ? 'Partner-Portfolio.html' : 'Portfolio.html'; }
  };
  window.tkResolveLink = function(key){ var f = MAP[key]; return f ? f() : null; };

  function apply(){
    var links = document.querySelectorAll('a[data-tk-link]');
    for(var i = 0; i < links.length; i++){
      var a = links[i];
      var base = window.tkResolveLink(a.getAttribute('data-tk-link'));
      if(!base) continue;
      var want = base + (a.getAttribute('data-tk-hash') || '');
      if(a.getAttribute('href') !== want) a.setAttribute('href', want);
    }
  }
  apply();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  if(window.MutationObserver){
    new MutationObserver(apply).observe(document.documentElement, { childList:true, subtree:true });
  }
})();
