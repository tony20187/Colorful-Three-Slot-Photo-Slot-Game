(() => {
  const PASSWORD = "316502";
  const LS_SYMBOL_LIMITS = "slot_symbol_limits_no_payout_v1"; // {file:{maxWins:number,wins:number}}

  /* 7 張照片（使用你提供的新檔名） */
const DEFAULT_SYMBOLS = [
  { file: "芷榆-1.jpg", label: "芷榆-1", weight: 10 },
  { file: "芷榆-2.jpg", label: "芷榆-2", weight: 10 },
  { file: "芷榆-3.jpg", label: "芷榆-3", weight: 10 },
  { file: "芷榆-4.jpg", label: "芷榆-4", weight: 10 },
  { file: "芷榆-5.jpg", label: "芷榆-5", weight: 10 },
  { file: "芷榆-6.jpg", label: "芷榆-6", weight: 10 },
  { file: "芷榆-7.jpg", label: "芷榆-7", weight: 10 }
];


  /* DOM */
  const img1 = document.getElementById("r1");
  const img2 = document.getElementById("r2");
  const img3 = document.getElementById("r3");
  const msg  = document.getElementById("msg");
  const startBtn = document.getElementById("startBtn");
  const muteBtn  = document.getElementById("muteBtn");
  const vol = document.getElementById("vol");
  const totalStat = document.getElementById("totalStat");
  const root = document.body;

  /* 狀態 */
  let spinning=false, spinIntervals=[], isMuted=false;
  let symbols=[...DEFAULT_SYMBOLS];
  let bag=[];

  /* 權重夾住：1～10 */
  const clampWeight = (v)=> {
    v = Math.round(Number(v)||1);
    if(v<1) v=1;
    if(v>10) v=10;
    return v;
  };

  /* ===== 個別上限/計數 ===== */
  function loadLimits(){
    let data = {};
    try{ data = JSON.parse(localStorage.getItem(LS_SYMBOL_LIMITS)||"{}"); }catch(e){ data={}; }
    symbols.forEach(s=>{ if(!data[s.file]) data[s.file]={maxWins:0,wins:0}; });
    localStorage.setItem(LS_SYMBOL_LIMITS, JSON.stringify(data));
    return data;
  }
  let symbolLimits = loadLimits();
  function saveLimits(){ localStorage.setItem(LS_SYMBOL_LIMITS, JSON.stringify(symbolLimits)); }
  const isBlocked = (file)=> {
    const lim = symbolLimits[file]; return lim && lim.maxWins>0 && lim.wins>=lim.maxWins;
  };
  const totalWins = ()=> Object.values(symbolLimits).reduce((a,b)=>a+(b.wins||0),0);
  const updateTotalStat = ()=> totalStat.textContent = `總連線中獎次數：${totalWins()}`;
  updateTotalStat();

  /* ===== 權重抽樣袋（排除達上限者） ===== */
  function rebuildBag(){
    bag=[];
    symbols.forEach(s=>{
      if(isBlocked(s.file)) return; // 達上限者直接排除
      const w = clampWeight(s.weight);
      for(let i=0;i<w;i++) bag.push(s);
    });
    if(bag.length===0){
      bag = [{file:"",label:"",weight:1,__dummy:true}]; // 保底
    }
  }
  rebuildBag();
  const pick = () => bag[Math.floor(Math.random()*bag.length)];

  /* 圖片預載 */
  function preload(list){
    return Promise.all(list.map(s => new Promise(res=>{
      const im = new Image(); im.onload=()=>res(); im.onerror=()=>res(); im.src=s.file;
    })));
  }

  /* ===== 聲音 ===== */
  let ctx=null, masterGain=null, spinNodes=null;
  function ensureAudio(){
    if(!ctx){
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = (Number(vol.value)/100)*0.8;
      masterGain.connect(ctx.destination);
    }
    if(ctx.state==="suspended") ctx.resume();
  }
  function startSpinSFX(){
    if(isMuted) return;
    ensureAudio();
    const g = ctx.createGain(); g.gain.value=0.0001;
    const lp = ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=900;
    const o1 = ctx.createOscillator(); o1.type="sawtooth"; o1.frequency.value=160;
    const o2 = ctx.createOscillator(); o2.type="sawtooth"; o2.frequency.value=164; o2.detune.value=+6;
    o1.connect(g); o2.connect(g); g.connect(lp).connect(masterGain);
    const now = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime((Number(vol.value)/100)*0.08, now+0.12);
    o1.frequency.linearRampToValueAtTime(260, now+1.5);
    o2.frequency.linearRampToValueAtTime(266, now+1.5);
    o1.start(); o2.start();
    spinNodes = {o1,o2,g};
  }
  function stopSpinSFX(){
    if(!spinNodes||!ctx) return;
    const {o1,o2,g} = spinNodes; const t=ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.12);
    try{ o1.stop(t+0.15); o2.stop(t+0.15); }catch(e){}
    spinNodes=null;
  }
  function playApplause(){
    if(isMuted) return; ensureAudio();
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type="triangle"; o.frequency.value=600; g.gain.value=0.0001;
    o.connect(g).connect(masterGain);
    const t=ctx.currentTime;
    o.start(t);
    g.gain.exponentialRampToValueAtTime((Number(vol.value)/100)*0.3, t+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.4);
    o.stop(t+0.45);
  }
  function playLose(){
    if(isMuted) return; ensureAudio();
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type="sine"; o.frequency.value=300; g.gain.value=0.0001;
    o.connect(g).connect(masterGain);
    const t=ctx.currentTime;
    o.start(t);
    g.gain.exponentialRampToValueAtTime((Number(vol.value)/100)*0.25, t+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.35);
    o.stop(t+0.4);
  }
  window.addEventListener("pointerdown", ()=>{ try{ ensureAudio(); }catch(e){} }, { once:true });
  vol.addEventListener("input", ()=>{ if(masterGain) masterGain.gain.value=(Number(vol.value)/100)*0.8; });

  /* ===== 視覺旋轉 ===== */
  const reels=[img1,img2,img3];
  function startReel(i,period){
    const el = reels[i];
    const t = setInterval(()=>{ el.src = pick().file; }, period);
    spinIntervals[i]=t; el.classList.add("blur"); el.parentElement.classList.add("spin");
  }
  function stopReel(i,finalSymbol){
    clearInterval(spinIntervals[i]);
    reels[i].classList.remove("blur");
    reels[i].src = finalSymbol.file;
    reels[i].parentElement.classList.remove("spin");
  }
  function markWinSlots(on=true){
    const els = Array.from(document.querySelectorAll(".slot"));
    els.forEach(s=>s.classList.toggle("win", on));
    if(on && navigator.vibrate) try{ navigator.vibrate([60,60,60]); }catch(e){}
    setTimeout(()=>els.forEach(s=>s.classList.remove("win")),700);
  }

  /* ===== 遊戲流程 ===== */
  function startSpin(){
    if(spinning) return;
    spinning=true; msg.className="message"; msg.textContent="轉動中...";
    startSpinSFX();
    startReel(0,55); startReel(1,65); startReel(2,75);
    const f1=pick(), f2=pick(), f3=pick();
    setTimeout(()=>stopReel(0,f1),700);
    setTimeout(()=>stopReel(1,f2),1200);
    setTimeout(()=>{ stopReel(2,f3); finish([f1,f2,f3]); },1700);
  }
  function finish(arr){
    stopSpinSFX(); spinning=false;
    const [a,b,c]=arr;
    if(a.file && a.file===b.file && b.file===c.file){
      const sym = symbols.find(s=>s.file===a.file) || a;
      const lim = symbolLimits[sym.file] || {maxWins:0,wins:0};
      lim.wins = (lim.wins||0) + 1;
      symbolLimits[sym.file] = lim; saveLimits();
      updateTotalStat();
      msg.className="message ok";
      msg.textContent=`🎉 三連線！「${sym.label}」 （該人物第 ${lim.wins} 次）`;
      if(lim.maxWins>0 && lim.wins>=lim.maxWins){ rebuildBag(); }
      const winsSpan = document.querySelector(`[data-file="${CSS.escape(sym.file)}"].wins`);
      if(winsSpan) winsSpan.textContent = String(lim.wins);
      root.classList.add("win-flash"); markWinSlots(true);
      setTimeout(()=>root.classList.remove("win-flash"),900);
      playApplause();
    }else{
      msg.className="message bad"; msg.textContent="未中獎，再試一次！（Space）";
      playLose();
    }
  }
  function stopSpinManual(){
    if(!spinning) return;
    const finals=reels.map(()=>pick());
    [0,1,2].forEach(i=>{ if(spinIntervals[i]) stopReel(i, finals[i]); });
    finish(finals);
  }
  document.addEventListener("keydown", e=>{
    if(e.code==="Space"){
      e.preventDefault(); ensureAudio();
      if(!spinning) startSpin(); else stopSpinManual();
    }
  });
  startBtn.addEventListener("click", ()=>{ ensureAudio(); !spinning ? startSpin() : stopSpinManual(); });
  muteBtn.addEventListener("click", ()=>{
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? "🔇 聲音：關" : "🔊 聲音：開";
  });
  // 🎀 新增拉霸按鈕事件（與 Space / StartBtn 同功能）
document.getElementById('spinBtn')?.addEventListener('click', () => {
  ensureAudio();
  !spinning ? startSpin() : stopSpinManual();
});


  /* ===== 面板（密碼＋表單） ===== */
  const passInput=document.getElementById("passInput");
  const passBtn  =document.getElementById("passBtn");
  const passMsg  =document.getElementById("passMsg");
  const cfgHost  =document.getElementById("cfg");
  const cfgArea  =document.getElementById("cfgContainer");
  const passwordArea=document.getElementById("passwordArea");
  const resetWinsAllBtn=document.getElementById("resetWinsAllBtn");

  /* 尺寸滑桿 */
  const sizeSlider = document.getElementById("sizeSlider");
  const sizeVal = document.getElementById("sizeVal");
  sizeSlider.addEventListener("input", ()=>{
    document.documentElement.style.setProperty("--slot-max", sizeSlider.value + "px");
    sizeVal.textContent = sizeSlider.value;
  });

  function renderConfig(){
    cfgHost.innerHTML="";
    const heads=["人物","權重(1~10)","預覽","已中","上限","重置"];
    heads.forEach((h,idx)=>{
      const d=document.createElement("div");
      d.className="hdr";
      d.textContent=h;
      if(idx===1){
        const tip=document.createElement("span");
        tip.className="hint"; tip.setAttribute("tabindex","0");
        tip.setAttribute("aria-label","權重說明");
        tip.setAttribute("data-tip","權重越高，中獎機率越高。\n1 = 最低，10 = 最高。\n達上限後：該人物會被移出轉盤，直到按「重置」或「重置遊戲」。");
        tip.textContent="?"; d.append(" ", tip);
      }
      cfgHost.appendChild(d);
    });

    symbols.forEach((s,i)=>{
      const lim = symbolLimits[s.file] || {maxWins:0,wins:0};

      const n=document.createElement("div"); n.textContent=s.label;

      const w=document.createElement("input");
      w.type="number"; w.min="1"; w.max="10"; w.step="1";
      w.value = clampWeight(s.weight);
      w.oninput=()=>{ symbols[i].weight = clampWeight(w.value); w.value = symbols[i].weight; rebuildBag(); };

      const prev=document.createElement("div");
      prev.className="prevBox"; prev.title = s.file;
      prev.innerHTML=`<img src="${s.file}" alt="${s.label}">`;

      const wins=document.createElement("div");
      wins.textContent=lim.wins||0; wins.className="wins"; wins.setAttribute("data-file", s.file);

      const maxIn=document.createElement("input");
      maxIn.type="number"; maxIn.min="0"; maxIn.step="1"; maxIn.placeholder="0=不限";
      maxIn.value = lim.maxWins>0 ? lim.maxWins : "";
      maxIn.oninput=()=>{
        const v = Number(maxIn.value||0);
        if(!symbolLimits[s.file]) symbolLimits[s.file]={maxWins:0,wins:0};
        symbolLimits[s.file].maxWins = v>0 ? Math.floor(v) : 0;
        saveLimits(); rebuildBag();
      };

      const resetBtn=document.createElement("button");
      resetBtn.className="btn mini"; resetBtn.textContent="重置";
      resetBtn.onclick=()=>{
        symbolLimits[s.file]={maxWins: (Number(maxIn.value)||0), wins:0};
        wins.textContent="0"; saveLimits(); rebuildBag(); updateTotalStat();
        msg.textContent=`🧹 已重置「${s.label}」已中獎次數`;
      };

      cfgHost.append(n,w,prev,wins,maxIn,resetBtn);
    });
  }

  document.getElementById("passBtn").addEventListener("click", ()=>{
    if(passInput.value===PASSWORD){
      passMsg.textContent="✅ 密碼正確";
      passwordArea.style.display="none";
      cfgArea.style.display="block";
      renderConfig();
    }else{
      passMsg.textContent="❌ 密碼錯誤";
    }
  });

  document.getElementById("applyBtn").addEventListener("click", ()=>{
    saveLimits(); rebuildBag();
    msg.textContent="✅ 已套用設定（權重/個別上限）";
  });

  document.getElementById("resetBtn").addEventListener("click", ()=>{
    symbols=[...DEFAULT_SYMBOLS];
    renderConfig(); rebuildBag();
    msg.textContent="↩ 已重置為預設權重";
  });

  resetWinsAllBtn.addEventListener("click", ()=>{
    Object.keys(symbolLimits).forEach(k=> symbolLimits[k].wins=0 );
    saveLimits(); rebuildBag(); updateTotalStat();
    document.querySelectorAll(".wins").forEach(el=>el.textContent="0");
    msg.textContent="🧹 已重置遊戲（所有已中歸零，皆可再出現）";
  });

  /* 初始化 */
  preload(symbols).then(()=>{
    const f = symbols;
    document.getElementById("r1").src = f[0].file;
    document.getElementById("r2").src = f[1].file;
    document.getElementById("r3").src = f[2].file;
    msg.textContent = "照片已就緒：按空白鍵開始！";
  });
})();
