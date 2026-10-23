/* Partner › Add your cards — CSV bulk mint (up to 100 per upload).
   Lookup is mocked: catalog certs resolve to their card, other 8-digit certs
   resolve to a placeholder card. Minting is simulated sequentially. */
(function(){
  var MAX=100, ACCEPTED={9:1,10:1}, ALREADY={'77700001':1};
  var $=function(id){ return document.getElementById(id); };
  var rows=[], fname='', minting=false, minted={}, timer=null, view='all';
  var POOL=[
    ['1999 POKEMON BASE SET 1ST EDITION #4 CHARIZARD HOLO','images/card-charizard.png'],
    ['2025 POKEMON JAPANESE M2A #234 PIKACHU EX SPECIAL ART RARE','images/card-pikachu-ex.png'],
    ['2018 PANINI PRIZM #280 LUKA DONCIC BLUE ICE ROOKIE','images/card-luka.png'],
    ['2024 POKEMON JAPANESE SV7A #101 NIDOKING EX STELLAR RARE','images/card-nidoking.jpg'],
    ['2003 TOPPS CHROME #111 LEBRON JAMES ROOKIE REFRACTOR','images/card-lebron.png'],
    ['2016 POKEMON XY EVOLUTIONS #11 CHARIZARD HOLO','images/card-pikachu.png']
  ];
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function title(raw, grade){
    var m=raw.match(/#(\S+)\s+(.*)$/); var num=m?m[1]:'', nm=m?m[2]:raw;
    nm=nm.toLowerCase().replace(/\b[a-z]/g,function(c){ return c.toUpperCase(); }).replace(/\bEx\b/g,'ex');
    return nm+(num?' \u00b7 #'+num:'')+' \u00b7 PSA '+grade;
  }
  function lookup(cert){
    if(!/^\d{8}$/.test(cert)) return null;
    var cat=(window.__TK_CATALOG||[]).find(function(c){ return c.cert===cert; });
    if(cat) return {name:cat.name, grade:cat.grade, img:cat.img};
    var n=parseInt(cert,10), p=POOL[n%POOL.length];
    return {name:p[0], grade:(cert.slice(-1)==='7')?8:(n%5===0?9:10), img:p[1]};
  }
  function validate(){
    var seen={};
    rows.forEach(function(r){
      if(minted[r.cert]&&r.status==='minted') return;
      var c=lookup(r.cert); r.card=c;
      if(!c) r.status='notfound';
      else if(seen[r.cert]) r.status='dup';
      else if(ALREADY[r.cert]||minted[r.cert]) r.status='already';
      else if(!ACCEPTED[c.grade]) r.status='grade';
      else r.status='ok';
      if(c && r.status!=='notfound') seen[r.cert]=1;
    });
  }
  var REASON={notfound:['Not found','bad'],dup:['Duplicate','warn'],already:['Already minted','warn'],grade:['Grade not accepted','warn']};
  function counts(){ var ok=0,bad=0,done=0; rows.forEach(function(r){ if(r.status==='ok') ok++; else if(r.status==='minted') done++; else bad++; }); return {ok:ok,bad:bad,done:done}; }

  function render(){
    var list=$('csv-list'), c=counts(), has=rows.length>0;
    $('csv-empty').style.display=has?'none':'block';
    $('csv-count').innerHTML='(<span class="mono">'+(c.ok+c.done)+'</span> of <span class="mono">'+MAX+'</span>)';
    if(view==='fix'&&!c.bad) view='all';
    function tab(k,cls,label,n){ return '<button type="button" role="tab" aria-selected="'+(view===k?'true':'false')+'" class="csv-badge '+cls+(view===k?' on':'')+'" data-csv-view="'+k+'">'+label+' <span class="mono">'+n+'</span></button>'; }
    $('csv-badges').innerHTML=has?(tab('all','all','All',rows.length)+tab('ready','ok','\u2713 Ready',c.ok+c.done)+(c.bad?tab('fix','warn','! To fix',c.bad):'')):'';
    list.innerHTML=rows.map(function(r,i){
      var good=r.status==='ok'||r.status==='minted';
      if((view==='ready'&&!good)||(view==='fix'&&good)) return '';
      var ic, tag, nm, acts='';
      if(r.status==='ok'||r.status==='minted'){ ic='<span class="csv-ic ok" aria-label="Valid">\u2713</span>'; tag=(r.status==='minted'?'<span class="csv-tag vault">Minted</span>':'<span></span>'); nm=title(r.card.name,r.card.grade); }
      else { var rs=REASON[r.status]; ic='<span class="csv-ic '+(rs[1]==='bad'?'bad':'warn')+'" aria-label="'+rs[0]+'">'+(rs[1]==='bad'?'\u2715':'!')+'</span>'; tag='<span class="csv-tag '+rs[1]+'">'+rs[0]+'</span>';
        nm=r.card?title(r.card.name,r.card.grade):'No card found for this cert';
        acts='<div class="csv-acts"><button type="button" class="csv-act rm" data-csv-rm="'+i+'">Remove</button></div>'; }
      return '<div class="csv-row'+(r.status==='ok'||r.status==='minted'?'':' is-bad')+'">'+ic+'<span class="csv-cert">'+esc(r.cert)+'</span><span class="csv-nm">'+esc(nm)+'</span>'+tag+(acts||'<span></span>')+'</div>';
    }).join('');
    var strip=$('csv-strip');
    if(c.bad && has){ strip.style.display='flex'; strip.innerHTML='<span><span class="mono">'+c.bad+'</span> card'+(c.bad===1?'':'s')+' won\u2019t mint. Fix them in your CSV or remove them.</span><button type="button" class="csv-link" id="csv-dl-bad">Download unresolved (<span class="mono">'+c.bad+'</span>)</button>'; }
    else strip.style.display='none';
    var b=$('csv-mint'); b.disabled=minting||!c.ok; b.innerHTML=minting?'<span>Minting&hellip;</span>':(c.ok?'<span>Mint <span class="mono">'+c.ok+'</span> to collection &rarr;</span>':'<span>Mint to collection &rarr;</span>');
    $('csv-draft').disabled=minting||!has;
    if(fname){ var total=rows.length; $('csv-fname').textContent=fname; $('csv-fstat').innerHTML='<span class="mono">'+total+'</span> rows \u00b7 <span class="mono">'+c.ok+'</span> valid \u00b7 <span class="mono">'+c.bad+'</span> need attention'; }
  }

  function loadText(text, name){
    var err=$('csv-error'); err.style.display='none';
    var lines=text.split(/\r?\n/).map(function(l){ return l.split(',')[0].replace(/["\s]/g,''); }).filter(Boolean);
    if(lines.length && /cert/i.test(lines[0])) lines.shift();
    if(!lines.length){ err.textContent='That file has no cert numbers. Use one cert number per row.'; err.style.display='block'; return; }
    if(lines.length>MAX){ err.textContent='That file has '+lines.length+' rows. Upload up to '+MAX+' cards at a time.'; err.style.display='block'; return; }
    $('csv-drop').style.display='none'; $('csv-chip').style.display='none';
    var ld=$('csv-loading'), n=lines.length, i=0; ld.style.display='flex';
    $('csv-ltext').textContent='Looking up cert numbers'; $('csv-lfill').style.width='0%';
    (function step(){
      i=Math.min(n, i+Math.max(1,Math.ceil(n/24)));
      $('csv-lfrac').innerHTML='<span class="mono">'+i+'</span> / <span class="mono">'+n+'</span>';
      $('csv-lfill').style.width=(i/n*100)+'%';
      if(i<n){ setTimeout(step,55); return; }
      setTimeout(function(){
        fname=name; rows=lines.map(function(c){ return {cert:c}; }); view='all'; validate();
        ld.style.display='none'; $('csv-chip').style.display='flex';
        render();
      },180);
    })();
  }
  function sample(){
    var a=[], base=31004000;
    for(var i=0;i<98;i++){ var c=String(base+i*13); if(c.slice(-1)==='7') c=String(base+i*13+1); a.push(c); }
    a.splice(40,0,'3100452X'); a.splice(71,0,a[12]);
    return 'cert_number\n'+a.join('\n');
  }
  function download(name, text){ var u=URL.createObjectURL(new Blob([text],{type:'text/csv'})); var l=document.createElement('a'); l.href=u; l.download=name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function(){ URL.revokeObjectURL(u); },500); }
  function fmt(ms){ var s=Math.max(0,Math.round(ms/1000)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }

  function openModal(){ $('csv-progress').style.display='flex'; $('csv-bg').style.display='none'; }
  function startMint(queue, opts){
    opts=opts||{};
    minting=true; render();
    $('csv-done').style.display='none'; $('csv-mbtns').style.display='flex';
    $('csv-pill').className='csv-pill'; $('csv-pill').textContent='Minting'; $('csv-pnote').style.display='block';
    openModal();
    var mp=$('csv-mprog'); mp.disabled=true; mp.setAttribute('aria-disabled','true');
    var total=queue.length, done=0, failed=[], t0=Date.now(), failOnce=opts.noFail?null:(queue.length>20?queue[Math.floor(queue.length*0.4)]:null), failSet={};
    if(opts.failN){ for(var fi=0;fi<opts.failN&&fi<queue.length;fi++) failSet[queue[Math.floor((fi+1)*queue.length/(opts.failN+1))].cert]=1; }
    function tick(){
      var frac='<span class="mono">'+done+'</span> / <span class="mono">'+total+'</span>';
      $('csv-frac').innerHTML=frac;
      $('csv-barfill').style.width=(total?done/total*100:0)+'%';
      $('csv-mprog').innerHTML='<span>Minting '+frac+'</span>';
      var bg=$('csv-bg'); if($('csv-progress').style.display==='none'&&minting){ bg.style.display='block'; bg.innerHTML='Minting in the background \u00b7 '+frac+' \u00b7 <button type="button" class="csv-link" id="csv-show">Show</button>'; }
    }
    function next(){
      if(done>=total){ finish(); return; }
      var r=queue[done];
      timer=setTimeout(function(){
        if(r===failOnce||failSet[r.cert]){ if(r===failOnce) failOnce=null; delete failSet[r.cert]; failed.push(r); }
        else { r.status='minted'; minted[r.cert]=1; }
        done++; tick(); render(); next();
      }, opts.delay!=null?opts.delay:(350+Math.random()*300));
    }
    function finish(){
      minting=false; timer=null; tick();
      /* timing is internal only (not shown to partners) */
      try{ console.info('[csv-mint] '+total+' cards in '+((Date.now()-t0)/1000).toFixed(1)+'s'); }catch(_){}
      var okN=total-failed.length;
      $('csv-pill').className='csv-pill done'; $('csv-pill').textContent='Done'; $('csv-pnote').style.display='none'; $('csv-mbtns').style.display='none';
      $('csv-bg').style.display='none';
      var html='<div style="font-size:15px;font-weight:700;color:#18181B;"><span><span class="mono">'+okN+'</span> card'+(okN===1?'':'s')+' minted to your collection</span></div>';
      if(failed.length) html+='<div style="font-size:13px;color:var(--neg);margin-top:8px;"><span class="mono">'+failed.length+'</span> failed: '+failed.map(function(f){ return '<span class="mono">'+esc(f.cert)+'</span>'; }).join(', ')+'</div>';
      html+='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;"><a href="Partner-Portfolio.html" class="btn btn--primary" style="height:48px;flex:1;padding:0 20px;font-size:14px;">View in collection</a>'
        +(failed.length?'<button type="button" class="btn btn--ghost" id="csv-retry" style="height:48px;padding:0 18px;font-size:14px;">Retry failed</button>':'<button type="button" class="btn btn--ghost" id="csv-close" style="height:48px;padding:0 18px;font-size:14px;">Close</button>')+'</div>';
      $('csv-done').innerHTML=html; $('csv-done').style.display='block';
      openModal();
      window.__csvFailed=failed; render();
    }
    tick(); next();
  }

  window.csvDemo=function(st){
    if(minting){ clearTimeout(timer); minting=false; }
    setMode('csv'); $('csv-progress').style.display='none'; $('csv-bg').style.display='none'; $('csv-error').style.display='none';
    rows=[]; fname=''; view='all'; minted={}; $('csv-file').value='';
    $('csv-loading').style.display='none';
    if(st==='empty'){ $('csv-chip').style.display='none'; $('csv-drop').style.display='flex'; render(); return; }
    var lines=sample().split('\n'); lines.shift();
    fname='tokenable-cards.csv'; rows=lines.map(function(c){ return {cert:c}; }); validate();
    $('csv-drop').style.display='none'; $('csv-chip').style.display='flex'; render();
    if(st==='complete'||st==='failed'){ var q=rows.filter(function(r){ return r.status==='ok'; }); startMint(q,{delay:0,noFail:true,failN:st==='failed'?3:0}); }
  };
  function setMode(m){
    document.querySelectorAll('.mseg__b').forEach(function(b){ var on=b.getAttribute('data-mode')===m; b.classList.toggle('on',on); b.setAttribute('aria-selected',on?'true':'false'); });
    var csv=m==='csv';
    $('mode-single').style.display=csv?'none':''; $('mode-csv').style.display=csv?'':'none';
    $('single-list').style.display=csv?'none':''; $('single-foot').style.display=csv?'none':'';
    $('csv-section').style.display=csv?'':'none';
    if(csv) render();
  }

  document.addEventListener('click', function(e){
    var t=e.target; if(!t.closest) return;
    var mb=t.closest('.mseg__b'); if(mb){ setMode(mb.getAttribute('data-mode')); return; }
    if(t.closest('#csv-template')){ e.preventDefault(); download('tokenable-cards-template.csv','cert_number\n'); return; }
    if(t.closest('#csv-sample')){ loadText(sample(),'tokenable-cards.csv'); return; }
    if(t.closest('#csv-clear')){ if(minting) return; rows=[]; fname=''; view='all'; try{ localStorage.removeItem('tk_csv_draft'); }catch(_){} $('csv-file').value=''; $('csv-chip').style.display='none'; $('csv-drop').style.display='flex'; $('csv-error').style.display='none'; render(); return; }
    if(t.closest('#csv-replace')){ if(minting) return; $('csv-file').value=''; $('csv-file').click(); return; }
    var vt=t.closest('[data-csv-view]'); if(vt){ view=vt.getAttribute('data-csv-view'); render(); return; }
    var rm=t.closest('[data-csv-rm]'); if(rm){ rows.splice(+rm.getAttribute('data-csv-rm'),1); validate(); render(); return; }
    if(t.closest('#csv-dl-bad')){ download('unresolved-certs.csv','cert_number\n'+rows.filter(function(r){ return r.status!=='ok'&&r.status!=='minted'; }).map(function(r){ return r.cert; }).join('\n')); return; }
    if(t.closest('#csv-mint')){ var q=rows.filter(function(r){ return r.status==='ok'; }); if(q.length) startMint(q); return; }
    if(t.closest('#csv-hide')){ $('csv-progress').style.display='none'; var bg=$('csv-bg'); bg.style.display='block'; bg.innerHTML='Minting in the background \u00b7 '+$('csv-frac').innerHTML+' \u00b7 <button type="button" class="csv-link" id="csv-show">Show</button>'; return; }
    if(t.closest('#csv-show')){ openModal(); return; }
    if(t.closest('#csv-close')){ $('csv-progress').style.display='none'; return; }
    if(t.closest('#csv-retry')){ var f=window.__csvFailed||[]; if(f.length) startMint(f); return; }
    if(t.closest('#csv-draft')){ try{ localStorage.setItem('tk_csv_draft', JSON.stringify({file:fname, certs:rows.map(function(r){ return r.cert; })})); }catch(_){}
      var ts=$('csv-toast'); ts.textContent='Draft saved. '+rows.length+' cert numbers kept.'; ts.style.display='block'; setTimeout(function(){ ts.style.display='none'; },2600); return; }
  });
  document.addEventListener('change', function(e){
    if(e.target&&e.target.id==='csv-file'&&e.target.files&&e.target.files[0]){ var f=e.target.files[0], rd=new FileReader(); rd.onload=function(){ loadText(String(rd.result||''), f.name); }; rd.readAsText(f); }
  });
  var dz=$('csv-drop');
  if(dz){
    dz.addEventListener('dragover',function(e){ e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave',function(){ dz.classList.remove('drag'); });
    dz.addEventListener('drop',function(e){ e.preventDefault(); dz.classList.remove('drag'); var f=e.dataTransfer.files&&e.dataTransfer.files[0]; if(!f) return; var rd=new FileReader(); rd.onload=function(){ loadText(String(rd.result||''), f.name); }; rd.readAsText(f); });
  }
  /* Drafts are saved (Save as draft) but not auto-restored, so the page always opens on the upload step. */
})();
