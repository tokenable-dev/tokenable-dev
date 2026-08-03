/* Hero 3D Card Carousel — direct port from original Tokenable Landing */
(function(){
var T,_cardsInit,_cards,_cardsDrag,_threeDone;

function _rr(g,x,y,w,h,r){
  g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
  g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();
}

function makeEnv(renderer){
  var c=document.createElement('canvas');c.width=512;c.height=256;
  var g=c.getContext('2d');
  var grad=g.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,'#3a3a42');grad.addColorStop(0.45,'#0e0e10');
  grad.addColorStop(0.5,'#1a1a1e');grad.addColorStop(1,'#050506');
  g.fillStyle=grad;g.fillRect(0,0,512,256);
  g.fillStyle='rgba(47,107,255,0.5)';g.fillRect(0,96,512,26);
  g.fillStyle='rgba(255,255,255,0.9)';g.fillRect(120,30,90,12);g.fillRect(330,50,60,8);
  var tex=new T.CanvasTexture(c);
  tex.mapping=T.EquirectangularReflectionMapping;
  var pmrem=new T.PMREMGenerator(renderer);
  var env=pmrem.fromEquirectangular(tex).texture;
  tex.dispose();pmrem.dispose();
  return env;
}

function makeCardTexture(i){
  var data=[
    {t:'JORDAN LOGOMAN',s:'#b5341f',n:'PSA 10'},
    {t:'CHARIZARD 1ST ED',s:'#e0631f',n:'PSA 10'},
    {t:'LEBRON CHROME RC',s:'#3a6ea5',n:'BGS 9.5'},
    {t:'PIKACHU VMAX',s:'#f5c518',n:'CGC 9'},
    {t:'LUKA PRIZM RC',s:'#6b2fa0',n:'SGC 10'},
    {t:'NIDOKING 1ST ED',s:'#1f6b57',n:'PSA 9'},
    {t:'PIKACHU EX FA',s:'#2F6BFF',n:'BGS 10'},
    {t:'CHARIZARD BASE',s:'#e0631f',n:'PSA 10'},
    {t:'LEBRON CHROME',s:'#3a6ea5',n:'SGC 9.5'},
    {t:'LUKA BASE RC',s:'#6b2fa0',n:'CGC 9.5'}
  ][i%10];
  var c=document.createElement('canvas');c.width=360;c.height=540;
  var g=c.getContext('2d');
  g.fillStyle='#0e0e10';g.fillRect(0,0,360,540);
  g.fillStyle='#f3f1ea';g.fillRect(14,14,332,512);
  g.fillStyle='#0a0a0b';g.fillRect(22,22,316,60);
  g.fillStyle='#2F6BFF';g.font='700 26px monospace';g.fillText('TOKENABLE',34,60);
  var ig=g.createLinearGradient(22,90,338,430);
  ig.addColorStop(0,data.s);ig.addColorStop(1,'#101012');
  g.fillStyle=ig;g.fillRect(22,90,316,348);
  g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=1;
  for(var k=0;k<6;k++){g.beginPath();g.arc(180,264,30+k*22,0,Math.PI*2);g.stroke();}
  g.fillStyle='#0a0a0b';g.font='700 30px serif';g.textAlign='center';
  g.fillText(data.t,180,478);g.textAlign='left';
  g.fillStyle='#2F6BFF';g.fillRect(22,494,70,24);
  g.fillStyle='#ffffff';g.font='700 14px monospace';g.fillText(data.n,30,511);
  for(var x=110;x<338;x+=5){g.fillStyle=Math.random()>0.5?'#0a0a0b':'#f3f1ea';g.fillRect(x,496,3,20);}
  var tex=new T.CanvasTexture(c);
  tex.anisotropy=4;tex.colorSpace=T.SRGBColorSpace;
  return tex;
}

function makeCardBack(){
  var W2=620,H2=1040;
  var c=document.createElement('canvas');c.width=W2;c.height=H2;
  var g=c.getContext('2d');
  var grad=g.createLinearGradient(0,0,W2,H2);
  grad.addColorStop(0,'#18181d');grad.addColorStop(0.5,'#101015');grad.addColorStop(1,'#0a0a0d');
  g.fillStyle=grad;g.fillRect(0,0,W2,H2);
  g.save();
  g.strokeStyle='rgba(255,255,255,0.022)';g.lineWidth=54;
  for(var x=-H2;x<W2+H2;x+=130){g.beginPath();g.moveTo(x,0);g.lineTo(x+H2,H2);g.stroke();}
  g.restore();
  g.strokeStyle='rgba(255,255,255,0.08)';g.lineWidth=2;
  _rr(g,28,28,W2-56,H2-56,30);g.stroke();
  g.textAlign='center';g.textBaseline='middle';
  g.fillStyle='#eef1f5';g.font='bold 28px monospace';g.fillText('TOKENABLE',W2/2,H2/2-16);
  g.fillStyle='#2F6BFF';g.font='600 14px monospace';g.fillText('VAULTED \u2022 ON-CHAIN',W2/2,H2/2+18);
  var tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  return tex;
}

function slabShape(w,h,r){
  var s=new T.Shape();
  var x=-w/2,y=-h/2;
  s.moveTo(x+r,y);
  s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  return s;
}

function camZForAspect(a){
  if(a>=1.4)return 9.2;
  if(a>=1.05)return 10.0;
  if(a>=0.8)return 11.4;
  return 9.5;
}

function initCards(){
  if(_cardsInit)return;
  var host=document.getElementById('heroSlabCanvas');
  if(!host||!host.clientWidth)return;
  _cardsInit=true;
  T=window.THREE;
  var W=host.clientWidth,H=host.clientHeight;
  var renderer=new T.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(W,H);
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.1;
  host.insertBefore(renderer.domElement,host.firstChild);

  var scene=new T.Scene();
  var env=makeEnv(renderer);scene.environment=env;
  var cam=new T.PerspectiveCamera(42,W/H,0.1,100);
  cam.position.set(0,0,camZForAspect(W/H));

  function calcGroupX(){
    var wrap=document.querySelector('.wrap');
    if(!wrap||W<768)return 0;
    var rect=wrap.getBoundingClientRect();
    var offsetPx=rect.right-W/2;
    var visW=2*Math.tan(21*Math.PI/180)*camZForAspect(W/H);
    return(offsetPx/W)*visW;
  }

  scene.add(new T.AmbientLight(0xffffff,0.4));
  var d1=new T.DirectionalLight(0xffffff,1.1);d1.position.set(3,5,6);scene.add(d1);
  var p1=new T.PointLight(0x2F6BFF,0.8,40);p1.position.set(-5,2,4);scene.add(p1);

  var group=new T.Group();
  group.position.x=calcGroupX();
  scene.add(group);

  /* --- Card image sources --- */
  var _r=window.__resources||{};
  var SRCS=[
    _r.heroSlab||'images/hero-slab.jpg',
    _r.cardCharizard||'images/card-charizard.png',
    _r.cardLebron||'images/card-lebron.png',
    _r.cardPikachu||'images/card-pikachu.png',
    _r.cardLuka||'images/card-luka.png',
    _r.cardNidoking||'images/card-nidoking.jpg',
    _r.cardPikachuEx||'images/card-pikachu-ex.png',
    _r.cardCharizard||'images/card-charizard.png',
    _r.cardLebron||'images/card-lebron.png',
    _r.cardLuka||'images/card-luka.png'
  ];

  var N=10,R=4.1;
  var CW=1.5,CH=2.5,CD=0.028,FT=0.03;
  var cardGeo=new T.BoxGeometry(CW,CH,CD);

  // razor-thin slab case with a slim edge lip
  var RIMD=0.03;
  var frame=slabShape(CW+2*FT,CH+2*FT,0.085);
  frame.holes.push(slabShape(CW,CH,0.07));
  var rimGeo=new T.ExtrudeGeometry(frame,{depth:RIMD,bevelEnabled:true,bevelThickness:0.005,bevelSize:0.007,bevelSegments:1,curveSegments:10});
  rimGeo.translate(0,0,-(RIMD+0.01)/2);

  var loader=new T.TextureLoader();
  var maxAniso=renderer.capabilities.getMaxAnisotropy?renderer.capabilities.getMaxAnisotropy():8;
  var backTex=makeCardBack();
  var darkSide=new T.MeshStandardMaterial({color:0x0d0d10,roughness:0.5,metalness:0.2});

  for(var i=0;i<N;i++){
    var a=(i/N)*Math.PI*2;

    /* Load real image; on error fall back to generated texture */
    var tex=(function(idx){
      var t=loader.load(SRCS[idx],undefined,undefined,function(){
        /* on error — swap to generated slab texture */
        var fallback=makeCardTexture(idx);
        face.map=fallback;face.needsUpdate=true;
      });
      t.colorSpace=T.SRGBColorSpace;
      t.anisotropy=maxAniso;
      return t;
    })(i);

    var face=new T.MeshPhysicalMaterial({map:tex,metalness:0.0,roughness:0.34,clearcoat:1.0,clearcoatRoughness:0.05,envMapIntensity:0.85,transparent:true});
    var back=new T.MeshPhysicalMaterial({map:backTex,color:0xffffff,metalness:0.1,roughness:0.42,clearcoat:0.7,clearcoatRoughness:0.18,envMapIntensity:0.85,transparent:true});
    var side=new T.MeshStandardMaterial({color:0x0d0d10,roughness:0.5,metalness:0.2,transparent:true});
    var cardMesh=new T.Mesh(cardGeo,[side,side,side,side,face,back]);

    var rimMat=new T.MeshPhysicalMaterial({
      color:0xe6e9ee,metalness:0.0,roughness:0.09,clearcoat:1.0,clearcoatRoughness:0.03,
      transparent:true,opacity:0.4,envMapIntensity:1.6,transmission:0.35,ior:1.46,side:T.DoubleSide
    });
    var rim=new T.Mesh(rimGeo,rimMat);

    var card=new T.Group();
    card.add(cardMesh);card.add(rim);
    card.position.set(Math.sin(a)*R,0,Math.cos(a)*R);
    card.rotation.y=a;
    card.userData.baseAngle=a;
    card.userData.fade=[[face,1],[back,1],[side,1],[rimMat,0.4]];
    group.add(card);
  }

  _cards={renderer:renderer,scene:scene,cam:cam,group:group,host:host};

  /* --- mouse / touch drag to spin (with momentum) --- */
  var drag={active:false,lastX:0,vel:0,angle:0};
  _cardsDrag=drag;
  var AUTO=0.16;
  var px=function(e){return e.touches?e.touches[0].clientX:e.clientX;};
  var down=function(e){drag.active=true;drag.lastX=px(e);drag.vel=0;host.style.cursor='grabbing';};
  var move=function(e){
    if(!drag.active)return;
    var x=px(e),dx=x-drag.lastX;drag.lastX=x;
    drag.angle+=dx*0.006;drag.vel=dx*0.006;
    if(e.cancelable)e.preventDefault();
  };
  var up=function(){drag.active=false;host.style.cursor='grab';};
  host.style.cursor='grab';host.style.touchAction='pan-y';
  host.addEventListener('mousedown',down);
  window.addEventListener('mousemove',move);
  window.addEventListener('mouseup',up);
  host.addEventListener('touchstart',down,{passive:true});
  host.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('touchend',up);

  var clock=new T.Clock();
  var loop=function(){
    requestAnimationFrame(loop);
    var dt=Math.min(clock.getDelta(),0.05);
    if(!drag.active){
      drag.angle+=drag.vel;
      drag.vel*=0.94;
      if(Math.abs(drag.vel)<0.0008)drag.vel=0;
      drag.angle+=AUTO*dt;
    }
    group.rotation.y=drag.angle;
    group.children.forEach(function(card){
      var c=Math.cos(card.userData.baseAngle+group.rotation.y);
      var f=(c+0.15)/0.6;f=f<0?0:f>1?1:f;
      card.visible=f>0.01;
      var fa=card.userData.fade;
      for(var k=0;k<fa.length;k++)fa[k][0].opacity=fa[k][1]*f;
    });
    renderer.render(scene,cam);
  };
  loop();
  _threeDone=true;

  window.addEventListener('resize',function(){
    W=host.clientWidth;H=host.clientHeight;if(W<10||H<10)return;
    renderer.setSize(W,H);cam.aspect=W/H;cam.updateProjectionMatrix();
    cam.position.z=camZForAspect(W/H);
    group.position.x=calcGroupX();
  },{passive:true});

  /* Mobile reparent */
  var heroSection=document.querySelector('.hero-section');
  var mobileSlot=document.querySelector('.hero-carousel-mobile-slot');
  var wasMobile=null;
  function reparentCarousel(){
    var mobile=window.innerWidth<768;
    if(mobile===wasMobile)return;wasMobile=mobile;
    if(mobile&&mobileSlot){mobileSlot.appendChild(host);host.style.position='relative';host.style.inset='auto';host.style.width='100%';host.style.height='100%';}
    else if(heroSection){heroSection.insertBefore(host,heroSection.firstChild);host.style.position='absolute';host.style.inset='0';host.style.width='';host.style.height='';}
    setTimeout(function(){W=host.clientWidth;H=host.clientHeight;if(W<10||H<10)return;renderer.setSize(W,H);cam.aspect=W/H;cam.updateProjectionMatrix();cam.position.z=camZForAspect(W/H);group.position.x=calcGroupX();},100);
  }
  reparentCarousel();
  window.addEventListener('resize',reparentCarousel,{passive:true});
}

/* Poll for THREE.js */
var attempts=0;
var check=setInterval(function(){
  attempts++;
  if(window.THREE&&document.getElementById('heroSlabCanvas')){clearInterval(check);initCards();}
  if(attempts>80)clearInterval(check);
},150);
})();
