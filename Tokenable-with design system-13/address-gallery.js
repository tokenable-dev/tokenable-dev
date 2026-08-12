/* address-gallery.js — drives the state gallery in Address-Search.dc.html.
   Mounts one TKAddress per host, then forces the state each card documents. */
(function(){
var SAVED = [
  { id:'s1', tag:'Home', name:'Alex Rivera', line:'350 Fifth Avenue, New York',
    line1:'350 Fifth Avenue', city:'New York', state:'NY', zip:'10118', country:'us', cc:'US' },
  { id:'s2', tag:'Vault', name:'Courtyard Collectibles', line:'1 Apple Park Way, Cupertino',
    line1:'1 Apple Park Way', city:'Cupertino', state:'CA', zip:'95014', country:'us', cc:'US' }
];
var SPECS = [
  { host:'#g-empty',   tone:'dark',  saved:SAVED },
  { host:'#g-typing',  tone:'dark',  after:function(a){ type(a, 'penn'); } },
  { host:'#g-none',    tone:'dark',  after:function(a){ type(a, 'zzq platz'); } },
  { host:'#g-picked',  tone:'dark',  after:function(a){ a.pick(place('p2')); } },
  { host:'#g-blocked', tone:'dark',  after:function(a){ a.pick(place('p8')); } },
  { host:'#g-invalid', tone:'dark',
    fields:{ line1:'#v-a1', city:'#v-city', state:'#v-state', zip:'#v-zip', country:'#v-country', phone:'#v-phone' },
    details:'#g-invalid-fields',
    after:function(a){
      a.pick(place('p2'));
      setVal('#v-zip', '9410');
      setVal('#v-phone', '555 12');
      setVal('#v-state', '');
      a.validate();
    } },
  { host:'#g-light',   tone:'light', saved:SAVED },
  { host:'#g-lightpicked', tone:'light', after:function(a){ a.pick(place('p4')); } }
];
function setVal(sel, v){
  var el = document.querySelector(sel);
  if(el) el.value = v;
}
function place(id){ return window.TKAddress.PLACES.filter(function(p){ return p.id===id; })[0]; }
function type(a, q){
  var i = a.root.querySelector('.tka__input');
  i.value = q;
  i.dispatchEvent(new Event('input', { bubbles:true }));
}
function boot(){
  if(!window.TKAddress) return false;
  var any = false;
  SPECS.forEach(function(s){
    var el = document.querySelector(s.host);
    if(!el || el.__tka) return;
    var a = window.TKAddress.mount(el, {
      tone: s.tone, saved: s.saved || [], label: 'Address', defaultCheckbox: true,
      fields: s.fields, details: s.details
    });
    if(a && s.after) s.after(a);
    any = true;
  });
  return any;
}
var n = 0;
(function w(){ if(!boot() && n++ < 400) setTimeout(w, 30); })();
setInterval(boot, 500);
})();
