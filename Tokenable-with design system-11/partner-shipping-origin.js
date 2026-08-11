/* Partner shipping-origin onboarding — one-time blocking modal + persistent gate banner.
   Shown to approved partner accounts that have no shipping origin on file. */
(function(){
  var KEY_ORIGIN = 'tk_partner_origin';
  var KEY_DEFER  = 'tk_partner_origin_deferred';

  function isPartner(){ try{ return localStorage.getItem('tk_partner_status')==='approved'; }catch(_){ return false; } }
  function hasOrigin(){ try{ return !!localStorage.getItem(KEY_ORIGIN); }catch(_){ return false; } }
  function vaultName(){ try{ return localStorage.getItem('tk_partner_vault') || 'KDH VAULT'; }catch(_){ return 'KDH VAULT'; } }

  var COUNTRIES = ['United States','Korea, Republic of','Japan','Singapore','Hong Kong','United Kingdom','Germany','France','Canada','Australia'];

  var CSS = ''
    + '.po-scrim{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto;}'
    + '.po-modal{width:100%;max-width:640px;background:#141414;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,0.6);padding:32px;color:rgba(255,255,255,0.95);font-family:var(--font-sans,Inter,sans-serif);}'
    + '.po-eyebrow{font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:var(--azure,#1A6FFF);}'
    + '.po-title{font-size:26px;font-weight:700;letter-spacing:-0.02em;margin:12px 0 0;line-height:1.2;}'
    + '.po-sub{font-size:14.5px;line-height:1.6;color:rgba(255,255,255,0.6);margin:10px 0 0;text-wrap:pretty;}'
    + '.po-chip{display:inline-flex;align-items:center;gap:9px;margin-top:18px;height:34px;padding:0 14px;border-radius:8px;background:rgba(26,111,255,0.12);font-family:var(--font-mono);font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5B9AFF;}'
    + '.po-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:24px;}'
    + '.po-field{display:flex;flex-direction:column;gap:7px;min-width:0;}'
    + '.po-field--full{grid-column:1 / -1;}'
    + '.po-label{font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.45);}'
    + '.po-in{height:44px;width:100%;padding:0 14px;border:0;border-radius:8px;background:#fff;color:#111;font-family:var(--font-sans,Inter,sans-serif);font-size:14.5px;outline:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.12);}'
    + '.po-in:focus{box-shadow:inset 0 0 0 2px var(--azure,#1A6FFF);}'
    + '.po-in.err{box-shadow:inset 0 0 0 2px #E4374A;}'
    + '.po-err{font-size:12px;color:#FF6B7A;display:none;}'
    + '.po-err.on{display:block;}'
    + '.po-acc{margin-top:18px;}'
    + '.po-acc summary{cursor:pointer;font-size:13.5px;color:rgba(255,255,255,0.55);list-style:none;}'
    + '.po-acc summary::-webkit-details-marker{display:none;}'
    + '.po-acc summary:hover{color:#fff;}'
    + '.po-why{margin-top:14px;font-size:13px;line-height:1.65;color:rgba(255,255,255,0.55);background:#191919;border-radius:10px;padding:14px 16px;display:none;}'
    + '.po-why.on{display:block;}'
    + '.po-help{font-size:12.5px;color:rgba(255,255,255,0.38);margin-top:18px;line-height:1.6;}'
    + '.po-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:22px;}'
    + '.po-link{font-size:13px;color:#5B9AFF;cursor:pointer;background:none;border:0;padding:0;font-family:inherit;}'
    + '.po-link:hover{color:#fff;}'
    + '.po-banner{position:sticky;top:64px;z-index:44;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:rgba(234,130,0,0.1);box-shadow:inset 0 0 0 1px rgba(234,130,0,0.3);border-radius:12px;padding:14px 18px;margin:16px auto 0;max-width:1240px;}'
    + '.po-banner__t{font-size:14px;font-weight:600;color:#fff;}'
    + '.po-banner__d{font-size:13px;color:rgba(255,255,255,0.6);}'
    + '@media(max-width:640px){.po-grid{grid-template-columns:1fr;}.po-modal{padding:24px 20px;}}';

  function field(id, label, opts){
    opts = opts || {};
    return '<div class="po-field' + (opts.full ? ' po-field--full' : '') + '">'
      + '<label class="po-label" for="' + id + '">' + label + '</label>'
      + (opts.select
          ? '<select class="po-in" id="' + id + '">' + COUNTRIES.map(function(c){ return '<option>' + c + '</option>'; }).join('') + '</select>'
          : '<input class="po-in" id="' + id + '" type="' + (opts.type || 'text') + '" placeholder="' + (opts.ph || '') + '"' + (opts.value ? ' value="' + opts.value + '"' : '') + '>')
      + '<span class="po-err" data-for="' + id + '">' + (opts.err || 'This field is required') + '</span>'
      + '</div>';
  }

  function build(){
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var scrim = document.createElement('div');
    scrim.className = 'po-scrim';
    scrim.setAttribute('role','dialog');
    scrim.setAttribute('aria-modal','true');
    scrim.innerHTML = ''
      + '<div class="po-modal">'
      +   '<div class="po-eyebrow">Vault partner setup</div>'
      +   '<h2 class="po-title">Add your shipping origin</h2>'
      +   '<p class="po-sub">As a vault partner, you ship cards to buyers when they redeem. Add the address you&rsquo;ll ship from &mdash; we use it to calculate shipping and to fulfill redemptions.</p>'
      +   '<div class="po-chip"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/></svg>' + vaultName() + '</div>'
      +   '<div id="po-addr-search" style="margin-bottom:18px;"></div>'
      +   '<div class="po-grid" id="po-grid">'
      +     field('po-name','Sender / company name',{full:true, ph:'KDH Collectibles Ltd.', value:'KDH Collectibles Ltd.'})
      +     field('po-a1','Address line 1',{full:true, ph:'Street address'})
      +     field('po-a2','Address line 2 (optional)',{full:true, ph:'Suite, unit, floor'})
      +     field('po-city','City',{ph:'City'})
      +     field('po-state','State / Region',{ph:'State or region'})
      +     field('po-zip','Postal code',{ph:'Postal code'})
      +     field('po-country','Country',{select:true})
      +     field('po-phone','Contact phone',{type:'tel', ph:'+82 10 0000 0000'})
      +     field('po-email','Contact email',{type:'email', ph:'ops@yourvault.com', err:'Enter a valid email address'})
      +   '</div>'
      +   '<details class="po-acc"><summary>Carrier account / preference (optional)</summary>'
      +     '<div class="po-grid" style="margin-top:14px;">'
      +       field('po-carrier','Preferred carrier',{ph:'DHL, UPS, FedEx…'})
      +       field('po-acct','Carrier account number',{ph:'Optional'})
      +     '</div>'
      +   '</details>'
      +   '<div class="po-help">Required before your cards can be listed. Editable later by our team.</div>'
      +   '<button class="po-link" id="po-why-btn" style="margin-top:10px;">Why do we need this?</button>'
      +   '<div class="po-why" id="po-why">We quote buyers a shipping price from your origin address at checkout, and we hand the same address to the carrier when a buyer redeems a card you hold. Without it we can&rsquo;t price shipping, so your cards can&rsquo;t go live.</div>'
      +   '<div class="po-foot">'
      +     '<button class="tk-btn tk-btn--primary" id="po-save" style="height:50px;padding:0 26px;font-size:15px;">Save shipping origin</button>'
      +     '<button class="tk-btn tk-btn--subtle" id="po-later" style="height:50px;padding:0 22px;font-size:15px;">Remind me later</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(scrim);

    scrim.querySelector('#po-why-btn').addEventListener('click', function(){
      scrim.querySelector('#po-why').classList.toggle('on');
    });
    scrim.querySelector('#po-later').addEventListener('click', function(){
      try{ localStorage.setItem(KEY_DEFER,'1'); }catch(_){}
      scrim.remove();
      showBanner();
    });
    scrim.querySelector('#po-save').addEventListener('click', function(){
      var required = ['po-name','po-a1','po-city','po-state','po-zip','po-phone','po-email'];
      var ok = true;
      required.forEach(function(id){
        var el = scrim.querySelector('#'+id);
        var msg = scrim.querySelector('[data-for="'+id+'"]');
        var bad = !el.value.trim() || (id==='po-email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim()));
        el.classList.toggle('err', bad);
        msg.classList.toggle('on', bad);
        if(bad && ok){ el.focus(); ok = false; }
      });
      if(!ok) return;
      /* Shared country rules: postal shape and phone length. */
      if(window.TKAddress){
        var r = window.TKAddress.validate({
          name:'#po-name', line1:'#po-a1', city:'#po-city', state:'#po-state',
          zip:'#po-zip', phone:'#po-phone'
        }, { country: countryCode() });
        window.TKAddress.paint({
          name:'#po-name', line1:'#po-a1', city:'#po-city', state:'#po-state',
          zip:'#po-zip', phone:'#po-phone'
        }, r);
        if(!r.ok){
          var bad = scrim.querySelector('.tka-bad, .po-in.err');
          if(bad) bad.focus();
          return;
        }
      }
      var data = {};
      ['po-name','po-a1','po-a2','po-city','po-state','po-zip','po-country','po-phone','po-email','po-carrier','po-acct'].forEach(function(id){
        var el = scrim.querySelector('#'+id); if(el) data[id.slice(3)] = el.value.trim();
      });
      try{ localStorage.setItem(KEY_ORIGIN, JSON.stringify(data)); localStorage.removeItem(KEY_DEFER); }catch(_){}
      scrim.remove();
      var b = document.querySelector('.po-banner'); if(b) b.remove();
    });

    if(window.TKAddress){
      window.TKAddress.mount(scrim.querySelector('#po-addr-search'), {
        tone: 'dark',
        label: 'Shipping origin',
        placeholder: 'Search where your shipments leave from\u2026',
        details: '#po-grid',
        defaultCheckbox: false,
        hideFields: ['#po-a2'],
        fields: { name:'#po-name', line1:'#po-a1', line2:'#po-a2', city:'#po-city',
                  state:'#po-state', zip:'#po-zip', phone:'#po-phone' }
      });
    }

    scrim.addEventListener('input', function(e){
      if(!e.target.classList.contains('po-in')) return;
      e.target.classList.remove('err');
      var m = scrim.querySelector('[data-for="'+e.target.id+'"]'); if(m) m.classList.remove('on');
    });
  }

  /* The modal's country control is a name list, not an ISO code. */
  function countryCode(){
    var el = document.getElementById('po-country');
    var map = { 'United States':'us','Canada':'ca','United Kingdom':'gb','Germany':'de',
                'France':'fr','Netherlands':'nl','Japan':'jp','South Korea':'kr',
                'Australia':'au','Singapore':'sg' };
    return (el && map[el.value]) || 'intl';
  }

  function showBanner(){
    if(document.querySelector('.po-banner')) return;
    var b = document.createElement('div');
    b.className = 'po-banner';
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EA8200" stroke-width="2.2" style="flex:none;"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>'
      + '<span style="flex:1;min-width:200px;"><span class="po-banner__t">Add your shipping origin to start listing</span><br><span class="po-banner__d">Your cards stay unlisted until we have an address to ship from.</span></span>'
      + '<button class="tk-btn tk-btn--primary" id="po-reopen" style="height:40px;padding:0 18px;font-size:14px;">Add address</button>';
    var header = document.querySelector('header');
    if(header && header.parentNode) header.parentNode.insertBefore(b, header.nextSibling);
    else document.body.insertBefore(b, document.body.firstChild);
    b.querySelector('#po-reopen').addEventListener('click', function(){ b.remove(); build(); });
  }

  function init(){
    if(!isPartner() || hasOrigin()) return;
    var deferred = false;
    try{ deferred = localStorage.getItem(KEY_DEFER)==='1'; }catch(_){}
    if(deferred) showBanner(); else build();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(init,300); });
  else setTimeout(init, 300);
})();
