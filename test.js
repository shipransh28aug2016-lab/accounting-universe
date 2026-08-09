
/* ============ STATE ============ */
const S = {
  xp:0, lvl:1, combo:0, badges:new Set(), sound:true,
};
const $ = (q,el=document)=>el.querySelector(q);
const $$ = (q,el=document)=>Array.from(el.querySelectorAll(q));
const fmt = n => "₹"+Math.round(n).toLocaleString("en-IN");
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ============ SOUND ============ */
let AC=null;
function ac(){ if(!AC) AC = new (window.AudioContext||window.webkitAudioContext)(); return AC;}
function beep(freq=440,dur=.08,type="sine",vol=.07){
  if(!S.sound) return;
  try{
    const c=ac(), o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.value=vol;
    o.connect(g); g.connect(c.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+dur);
    o.stop(c.currentTime+dur+.02);
  }catch(e){}
}
const sfx = {
  tap:()=>beep(620,.05,"triangle",.05),
  pop:()=>beep(880,.08,"square",.05),
  good:()=>{beep(660,.08,"triangle",.07); setTimeout(()=>beep(990,.12,"triangle",.07),80)},
  bad:()=>{beep(220,.12,"sawtooth",.05); setTimeout(()=>beep(160,.14,"sawtooth",.05),100)},
  level:()=>{[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.12,"triangle",.07),i*90));},
};
$("#soundBtn").onclick=()=>{S.sound=!S.sound; $("#soundBtn").textContent=S.sound?"🔊":"🔇"; sfx.tap()};

$("#projBtn").onclick=()=>{
  document.body.classList.toggle("light-mode");
  const isLight = document.body.classList.contains("light-mode");
  $("#projBtn").textContent = isLight ? "🌙" : "☀️";
  sfx.pop();
};

$("#fsBtn").onclick=()=>{
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(()=>{});
    $("#fsBtn").textContent = "🗗";
  } else {
    document.exitFullscreen();
    $("#fsBtn").textContent = "⛶";
  }
  sfx.tap();
};

/* ============ XP / BADGES ============ */
function awardXP(n, reason){
  S.xp += n;
  const need = S.lvl*100;
  if(S.xp >= need){ S.xp -= need; S.lvl++; sfx.level(); toast("LEVEL UP! → LV "+S.lvl,"win"); confetti(120); }
  $("#xp").textContent=S.xp;
  $("#lvl").textContent=S.lvl;
  if(reason) toast("+"+n+" XP · "+reason);
  if(S.lvl>=5 && !S.badges.has("escape")) unlockBadge("escape", true);
}
function bumpCombo(){ S.combo++; $("#combo").textContent=S.combo;
  if(S.combo===3) unlockBadge("combo3");
  if(S.combo===7) unlockBadge("combo7"); }
function resetCombo(){ S.combo=0; $("#combo").textContent=0; }
function unlockBadge(id, finale=false){
  if(S.badges.has(id)) return;
  S.badges.add(id); $("#badges").textContent=S.badges.size;
  toast("🏅 Badge unlocked: "+id,"win"); sfx.good();
  if(finale) showCinema();
}
function toast(msg,kind=""){
  const t=document.createElement("div");
  t.className="toast "+kind; t.textContent=msg;
  if(kind==="bad") t.classList.add("shake-anim");
  $("#toasts").appendChild(t);
  setTimeout(()=>{t.style.opacity=0; t.style.transform="translateX(20px)"; setTimeout(()=>t.remove(),300)},2200);
}

/* ============ NAV ============ */
function go(id){
  $$("section.screen").forEach(s=>s.classList.remove("active"));
  const tgt = $("#"+id) || $("#home");
  tgt.classList.add("active");
  $$("#rail button").forEach(b=>b.classList.toggle("active", b.dataset.go===id));
  window.scrollTo({top:0,behavior:"smooth"});
  sfx.tap();
}
document.addEventListener("click",e=>{
  const b = e.target.closest("[data-go]");
  if(b){ go(b.dataset.go); }
});

/* ============ HOME GRID ============ */
const MODS = [
  ["m1","① Live Equation","Tanks fill and drain. Feel A = C + L breathe."],
  ["m2","② Transaction Lab","Drag accounts. See debit, credit & equation impact."],
  ["m3","③ ALERE Wheel","Spin the magic engine of debit–credit rules."],
  ["m4","④ Drag-Drop Lab","Drag accounts to Dr/Cr. Engine validates the dual aspect."],
  ["m5","⑤ Equation Game","Five missions, combo streaks, badges."],
  ["m6","⑥ Journal Builder Pro","Compose multi-line entries. Post live to the ledger."],
  ["m7","⑦ Simulator","Run a business day. Journal → Ledger → Balance Sheet."],
  ["m8","⑧ What Happens If…","Sliders that bend assets, liabilities & capital."],
  ["m9","⑨ Memory Hack","A·L·E·R·E mnemonic that sticks for life."],
  ["m10","⑩ Cheat Sheet","Bento cards · examples · mini-quizzes."],
  ["m11","⑪ Trial Balance","Drag and drop accounts to test Debit/Credit mastery."],
  ["m12","⑫ Final Accounts","Drag items into Trading, P&L and Balance Sheet."],
  ["m13","⑬ Dr/Cr Balances","Every account\'s natural side — flip cards & quiz."],
];
const mg = $("#moduleGrid");
MODS.forEach(([id,t,d],i)=>{
  const el=document.createElement("button");
  el.className="mod"; el.dataset.go=id;
  el.innerHTML=`<div class="gleam"></div><div class="num">MODULE ${String(i+1).padStart(2,"0")}</div><h3>${t}</h3><p>${d}</p>`;
  mg.appendChild(el);
});

/* ============ PARTICLES ============ */
(function(){
  const c=$("#bgfx"), x=c.getContext("2d"); let W,H,parts;
  function resize(){W=c.width=innerWidth; H=c.height=innerHeight;
    parts = Array.from({length: Math.min(90, Math.floor(W*H/22000))}, ()=>({
      x:Math.random()*W,y:Math.random()*H, r:Math.random()*1.6+.4,
      vx:(Math.random()-.5)*.25, vy:(Math.random()-.5)*.25,
      h: 180 + Math.random()*120
    }));
  }
  resize(); addEventListener("resize",resize);
  (function loop(){
    x.clearRect(0,0,W,H);
    for(const p of parts){
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x+=W; if(p.x>W)p.x-=W; if(p.y<0)p.y+=H; if(p.y>H)p.y-=H;
      x.beginPath(); x.arc(p.x,p.y,p.r,0,Math.PI*2);
      x.fillStyle=`hsla(${p.h},90%,70%,.55)`; x.fill();
    }
    // light lines
    for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
      const a=parts[i],b=parts[j], dx=a.x-b.x, dy=a.y-b.y, d=dx*dx+dy*dy;
      if(d<9000){ x.strokeStyle=`hsla(200,80%,70%,${.18*(1-d/9000)})`; x.lineWidth=.6; x.beginPath(); x.moveTo(a.x,a.y); x.lineTo(b.x,b.y); x.stroke();}
    }
    requestAnimationFrame(loop);
  })();
})();

/* ============ CONFETTI ============ */
const confettiC = $("#confetti"); let confCtx, confParts=[];
function sizeConf(){confettiC.width=innerWidth; confettiC.height=innerHeight}
sizeConf(); addEventListener("resize",sizeConf);
confCtx = confettiC.getContext("2d");
function confetti(n=120){
  for(let i=0;i<n;i++) confParts.push({
    x: innerWidth/2 + (Math.random()-.5)*200,
    y: innerHeight/2,
    vx:(Math.random()-.5)*8, vy:(Math.random()-1.2)*10,
    g:.35, r:Math.random()*4+2,
    c: `hsl(${Math.random()*360},90%,65%)`, life:120
  });
}
(function confLoop(){
  confCtx.clearRect(0,0,confettiC.width,confettiC.height);
  confParts = confParts.filter(p=>p.life>0);
  for(const p of confParts){
    p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.life--;
    confCtx.fillStyle=p.c; confCtx.fillRect(p.x,p.y,p.r,p.r);
  }
  requestAnimationFrame(confLoop);
})();

/* ============ MODULE 1: LIVE EQUATION ============ */
const M1_ACCTS = {
  // Assets
  Cash:0, Bank:0, Stock:0, Debtors:0, "Bills Receivable":0,
  Machinery:0, Furniture:0, Building:0, Vehicle:0, "Prepaid Rent":0,
  // Liabilities
  Creditors:0, "Bank Loan":0, "Outstanding Salary":0, "Bills Payable":0, "Outstanding Rent":0,
  // Capital
  Capital:0,
  // Contra (Drawings reduces Capital)
  Drawings:0,
  // Temporaries (for P&L tracking, reset each time)
  "P&L Profit":0
};

const M1_ACCT_TYPES = {
  Cash:"A", Bank:"A", Stock:"A", Debtors:"A", "Bills Receivable":"A",
  Machinery:"A", Furniture:"A", Building:"A", Vehicle:"A", "Prepaid Rent":"A",
  Creditors:"L", "Bank Loan":"L", "Outstanding Salary":"L", "Bills Payable":"L", "Outstanding Rent":"L",
  Capital:"Q", Drawings:"X", "P&L Profit":"Q"
};

const M1 = { log:[] };

function m1GetA(){
  return Object.keys(M1_ACCTS).filter(k=>M1_ACCT_TYPES[k]==="A").reduce((s,k)=>s+(M1_ACCTS[k]||0),0);
}
function m1GetL(){
  return Object.keys(M1_ACCTS).filter(k=>M1_ACCT_TYPES[k]==="L").reduce((s,k)=>s+(M1_ACCTS[k]||0),0);
}
function m1GetC(){
  const cap = M1_ACCTS.Capital||0;
  const draw = M1_ACCTS.Drawings||0;
  const pl = M1_ACCTS["P&L Profit"]||0;
  return cap - draw + pl;
}

function m1Render(){
  const A = m1GetA(), L = m1GetL(), C = m1GetC();
  const right = C + L;
  const max = Math.max(50000, A, right);
  // Assets tank
  $("#aLiq").style.height = clamp(A/max,0,1)*100+"%";
  // Right tank: Capital (bottom) + Liabilities (top)
  const cH = clamp(C/max,0,1)*100;
  const lH = clamp(L/max,0,1)*100;
  $("#cLiq").style.height = cH+"%";
  $("#lLiq").style.height = lH+"%";
  $("#lLiq").style.bottom = cH+"%";
  $("#aVal").textContent = fmt(A);
  const rValEl = $("#rVal");
  if (rValEl) rValEl.textContent = fmt(C + L);
  const cValEl = $("#cVal");
  if (cValEl) cValEl.textContent = fmt(C);
  const lValEl = $("#lVal");
  if (lValEl) lValEl.textContent = fmt(L);
  $("#aPct").textContent = Math.round(A/max*100)+"%";
  $("#rPct").textContent = Math.round(right/max*100)+"%";
  const diff = A - right;
  const bal = Math.abs(diff) < 0.5;
  $("#balBar").style.background = bal ? "var(--grad-2)" : "linear-gradient(90deg,#ff5577,#ffb547)";
  $("#balStatus").className = "balance-status"+(bal?"":" bad");

  // Dynamic Equation Construction
  const activeAssets = Object.keys(M1_ACCTS)
    .filter(k => M1_ACCT_TYPES[k] === "A" && (M1_ACCTS[k] || 0) !== 0)
    .sort()
    .map(k => {
      const val = M1_ACCTS[k] || 0;
      if (val < 0) {
        return `${k} (-${fmt(Math.abs(val))})`;
      }
      return `${k} (${fmt(val)})`;
    });

  const activeCap = [];
  const capVal = M1_ACCTS.Capital || 0;
  if (capVal !== 0) {
    if (capVal < 0) {
      activeCap.push(`Capital (-${fmt(Math.abs(capVal))})`);
    } else {
      activeCap.push(`Capital (${fmt(capVal)})`);
    }
  }

  const plVal = M1_ACCTS["P&L Profit"] || 0;
  if (plVal !== 0) {
    if (plVal < 0) {
      activeCap.push(`P&L (-${fmt(Math.abs(plVal))})`);
    } else {
      activeCap.push(`P&L (${fmt(plVal)})`);
    }
  }

  const drawVal = M1_ACCTS.Drawings || 0;
  if (drawVal !== 0) {
    if (drawVal < 0) {
      activeCap.push(`Drawings (${fmt(Math.abs(drawVal))})`);
    } else {
      activeCap.push(`- Drawings (${fmt(drawVal)})`);
    }
  }

  const activeLia = Object.keys(M1_ACCTS)
    .filter(k => M1_ACCT_TYPES[k] === "L" && (M1_ACCTS[k] || 0) !== 0)
    .sort()
    .map(k => {
      const val = M1_ACCTS[k] || 0;
      if (val < 0) {
        return `${k} (-${fmt(Math.abs(val))})`;
      }
      return `${k} (${fmt(val)})`;
    });

  const activeCapLia = [...activeCap, ...activeLia];

  let eqStr = "";
  if (activeAssets.length > 0 || activeCapLia.length > 0) {
    const assetsStr = activeAssets.join(" + ").replace(/ \+ - /g, " - ") || "Assets (₹0)";
    let capLiaStr = activeCapLia.join(" + ").replace(/ \+ - /g, " - ") || "Capital + Liabilities (₹0)";
    eqStr = `${assetsStr} = ${capLiaStr}`;
  } else {
    eqStr = "Assets (₹0) = Capital (₹0) + Liabilities (₹0)";
  }

  const statusPrefix = bal ? "BALANCED ✓  " : `UNBALANCED ✗  (Δ = ${fmt(Math.abs(diff))})  `;
  $("#balStatus").textContent = statusPrefix + eqStr;
  $("#txLog").innerHTML = M1.log.slice(-12).reverse().map(t=>`<div class="item">• <b>${t.label}</b><br/><span style="font-size:11px;opacity:0.7">${t.detail}</span></div>`).join("");

  // Detailed breakdown
  const brkA = $("#brkAssets"); brkA.innerHTML = '<div class="brk-title" style="color:var(--neon-cyan);font-weight:700;padding-bottom:6px;border-bottom:1px solid var(--stroke);margin-bottom:6px">ASSETS</div>';
  const brkL = $("#brkLiabilities"); brkL.innerHTML = '<div class="brk-title" style="color:var(--neon-amber);font-weight:700;padding-bottom:6px;border-bottom:1px solid var(--stroke);margin-bottom:6px">LIABILITIES</div>';
  const brkC = $("#brkCapital"); brkC.innerHTML = '<div class="brk-title" style="color:var(--neon-lime);font-weight:700;padding-bottom:6px;border-bottom:1px solid var(--stroke);margin-bottom:6px">CAPITAL</div>';

  const astItems = Object.keys(M1_ACCTS).filter(k=>M1_ACCT_TYPES[k]==="A").sort();
  astItems.forEach(k=>{
    const v = M1_ACCTS[k]||0;
    if(v===0) return;
    brkA.innerHTML += `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>${k}</span><span style="font-family:var(--font-mono);color:var(--neon-cyan)">${fmt(v)}</span></div>`;
  });

  const liaItems = Object.keys(M1_ACCTS).filter(k=>M1_ACCT_TYPES[k]==="L").sort();
  liaItems.forEach(k=>{
    const v = M1_ACCTS[k]||0;
    if(v===0) return;
    brkL.innerHTML += `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>${k}</span><span style="font-family:var(--font-mono);color:var(--neon-amber)">${fmt(v)}</span></div>`;
  });

  // Capital details
  const cap = M1_ACCTS.Capital||0;
  const draw = M1_ACCTS.Drawings||0;
  const pl = M1_ACCTS["P&L Profit"]||0;
  if(cap>0) brkC.innerHTML += `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>Capital (contributed)</span><span style="font-family:var(--font-mono);color:var(--neon-lime)">${fmt(cap)}</span></div>`;
  if(draw>0) brkC.innerHTML += `<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:var(--neon-red)">Less: Drawings</span><span style="font-family:var(--font-mono);color:var(--neon-red)">−${fmt(draw)}</span></div>`;
  if(pl!==0) brkC.innerHTML += `<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:${pl>=0?'var(--neon-lime)':'var(--neon-red)'}">P&L (Revenue − Expenses)</span><span style="font-family:var(--font-mono);color:${pl>=0?'var(--neon-lime)':'var(--neon-red)'}">${pl>=0?'+':''}${fmt(pl)}</span></div>`;
  brkC.innerHTML += `<div style="display:flex;justify-content:space-between;padding:4px 0;margin-top:4px;border-top:1px dashed var(--stroke);font-weight:700"><span>Total Capital</span><span style="font-family:var(--font-mono);color:var(--neon-lime)">${fmt(C)}</span></div>`;

  $("#brkATot").textContent = fmt(A);
  $("#brkLTot").textContent = fmt(L);
  $("#brkCTot").textContent = fmt(C);
  $("#brkStatus").textContent = bal ? "✓ A = C + L" : "✗ A ≠ C + L";
  $("#brkStatus").style.color = bal ? "var(--neon-lime)" : "var(--neon-red)";
}
m1Render();

const TPL = [
  {id:"capital", label:"1. Owner introduced capital (cash)", desc:"Cash ↑, Capital ↑",
   fn:(n)=>{ M1_ACCTS.Cash+=n; M1_ACCTS.Capital+=n; }},
  {id:"add-capital-cheque", label:"2. Additional capital by cheque", desc:"Bank ↑, Capital ↑",
   fn:(n)=>{ M1_ACCTS.Bank+=n; M1_ACCTS.Capital+=n; }},
  {id:"bank-loan", label:"3. Bank loan received (credited to cash)", desc:"Cash ↑, Bank Loan ↑",
   fn:(n)=>{ M1_ACCTS.Cash+=n; M1_ACCTS["Bank Loan"]+=n; }},
  {id:"bank-loan-bank", label:"4. Bank loan credited to bank account", desc:"Bank ↑, Bank Loan ↑",
   fn:(n)=>{ M1_ACCTS.Bank+=n; M1_ACCTS["Bank Loan"]+=n; }},
  {id:"cash-deposit", label:"5. Cash deposited into bank", desc:"Bank ↑, Cash ↓ (asset swap)",
   fn:(n)=>{ M1_ACCTS.Bank+=n; M1_ACCTS.Cash-=n; }},
  {id:"bank-withdraw", label:"6. Cash withdrawn from bank", desc:"Cash ↑, Bank ↓ (asset swap)",
   fn:(n)=>{ M1_ACCTS.Cash+=n; M1_ACCTS.Bank-=n; }},
  {id:"cash-sale", label:"7. Cash sale of goods", desc:"Cash ↑, P&L Profit ↑ (Revenue swells Capital)",
   fn:(n)=>{ M1_ACCTS.Cash+=n; M1_ACCTS["P&L Profit"]+=n; }},
  {id:"credit-sale", label:"8. Credit sale to Mohan", desc:"Debtors ↑, P&L Profit ↑",
   fn:(n)=>{ M1_ACCTS.Debtors+=n; M1_ACCTS["P&L Profit"]+=n; }},
  {id:"cash-purchase", label:"9. Cash purchase of goods (stock)", desc:"Stock ↑, Cash ↓ (asset swap)",
   fn:(n)=>{ M1_ACCTS.Stock+=n; M1_ACCTS.Cash-=n; }},
  {id:"credit-purchase", label:"10. Credit purchase (goods on credit)", desc:"Stock ↑, Creditors ↑",
   fn:(n)=>{ M1_ACCTS.Stock+=n; M1_ACCTS.Creditors+=n; }},
  {id:"pay-creditor", label:"11. Paid creditor in cash", desc:"Cash ↓, Creditors ↓",
   fn:(n)=>{ M1_ACCTS.Cash-=n; M1_ACCTS.Creditors-=n; }},
  {id:"receive-debtor", label:"12. Received cash from debtor", desc:"Cash ↑, Debtors ↓ (asset swap)",
   fn:(n)=>{ M1_ACCTS.Cash+=n; M1_ACCTS.Debtors-=n; }},
  {id:"buy-machinery", label:"13. Bought machinery for cash", desc:"Machinery ↑, Cash ↓ (asset swap)",
   fn:(n)=>{ M1_ACCTS.Machinery+=n; M1_ACCTS.Cash-=n; }},
  {id:"buy-furniture", label:"14. Bought furniture by cheque", desc:"Furniture ↑, Bank ↓ (asset swap)",
   fn:(n)=>{ M1_ACCTS.Furniture+=n; M1_ACCTS.Bank-=n; }},
  {id:"pay-rent", label:"15. Paid rent in cash", desc:"Cash ↓, P&L Profit ↓ (Expense reduces Capital)",
   fn:(n)=>{ M1_ACCTS.Cash-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"pay-salary", label:"16. Paid salary by cheque", desc:"Bank ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Bank-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"pay-wages", label:"17. Paid wages in cash", desc:"Cash ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Cash-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"electricity", label:"18. Paid electricity bill", desc:"Cash ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Cash-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"commission", label:"19. Commission received in cash", desc:"Cash ↑, P&L Profit ↑",
   fn:(n)=>{ M1_ACCTS.Cash+=n; M1_ACCTS["P&L Profit"]+=n; }},
  {id:"insurance", label:"20. Paid insurance premium", desc:"Cash ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Cash-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"interest-received", label:"21. Interest received by cheque", desc:"Bank ↑, P&L Profit ↑",
   fn:(n)=>{ M1_ACCTS.Bank+=n; M1_ACCTS["P&L Profit"]+=n; }},
  {id:"drawings", label:"22. Owner withdrew cash (drawings)", desc:"Cash ↓, Drawings ↑ (reduces Capital)",
   fn:(n)=>{ M1_ACCTS.Cash-=n; M1_ACCTS.Drawings+=n; }},
  {id:"buy-building", label:"23. Bought building by cheque", desc:"Building ↑, Bank ↓ (asset swap)",
   fn:(n)=>{ M1_ACCTS.Building+=n; M1_ACCTS.Bank-=n; }},
  {id:"buy-vehicle", label:"24. Bought delivery vehicle (cash+credit)", desc:"Vehicle ↑, Cash ↓, Creditors ↑",
   fn:(n)=>{ M1_ACCTS.Vehicle+=n; M1_ACCTS.Cash-=Math.round(n/2); M1_ACCTS.Creditors+=Math.round(n/2); }},
  {id:"prepaid-rent", label:"25. Rent paid in advance (prepaid)", desc:"Prepaid Rent ↑, Cash ↓ (asset swap)",
   fn:(n)=>{ M1_ACCTS["Prepaid Rent"]+=n; M1_ACCTS.Cash-=n; }},
  {id:"outstanding-salary", label:"26. Salary outstanding at year-end", desc:"Outstanding Salary ↑, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS["Outstanding Salary"]+=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"bill-payable", label:"27. Issued Bills Payable to creditor", desc:"Creditors ↓, Bills Payable ↑ (liab swap)",
   fn:(n)=>{ M1_ACCTS.Creditors-=n; M1_ACCTS["Bills Payable"]+=n; }},
  {id:"bill-receivable", label:"28. Accepted Bill Receivable from debtor", desc:"Bills Receivable ↑, Debtors ↓ (asset swap)",
   fn:(n)=>{ M1_ACCTS["Bills Receivable"]+=n; M1_ACCTS.Debtors-=n; }},
  {id:"depreciation", label:"29. Depreciation on machinery", desc:"Machinery ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Machinery-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"bad-debts", label:"30. Bad debts written off", desc:"Debtors ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Debtors-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"life-insurance", label:"31. Paid owner's life insurance", desc:"Cash ↓, Drawings ↑",
   fn:(n)=>{ M1_ACCTS.Cash-=n; M1_ACCTS.Drawings+=n; }},
  {id:"income-tax", label:"32. Paid income tax by cheque", desc:"Bank ↓, Drawings ↑",
   fn:(n)=>{ M1_ACCTS.Bank-=n; M1_ACCTS.Drawings+=n; }},
  {id:"free-samples", label:"33. Goods distributed as free samples", desc:"Stock ↓, P&L Profit ↓ (Expense)",
   fn:(n)=>{ M1_ACCTS.Stock-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"charity-goods", label:"34. Goods given as charity", desc:"Stock ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Stock-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"loss-fire", label:"35. Goods destroyed by fire", desc:"Stock ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Stock-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"installation", label:"36. Installation charges on machinery", desc:"Machinery ↑, Cash ↓ (Capitalized)",
   fn:(n)=>{ M1_ACCTS.Machinery+=n; M1_ACCTS.Cash-=n; }},
  {id:"bank-charges", label:"37. Bank charged for services", desc:"Bank ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Bank-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"bank-interest", label:"38. Interest allowed by bank", desc:"Bank ↑, P&L Profit ↑",
   fn:(n)=>{ M1_ACCTS.Bank+=n; M1_ACCTS["P&L Profit"]+=n; }},
  {id:"interest-capital", label:"39. Interest on Capital provided", desc:"Capital ↑, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Capital+=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"interest-drawings", label:"40. Interest charged on Drawings", desc:"Drawings ↑, P&L Profit ↑",
   fn:(n)=>{ M1_ACCTS.Drawings+=n; M1_ACCTS["P&L Profit"]+=n; }},
  {id:"unearned-rent", label:"41. Rent received in advance", desc:"Cash ↑, Unearned Income ↑",
   fn:(n)=>{ M1_ACCTS.Cash+=n; M1_ACCTS["Unearned Income"]+=n; }},
  {id:"accrued-comm", label:"42. Accrued Commission", desc:"Accrued Income ↑, P&L Profit ↑",
   fn:(n)=>{ M1_ACCTS["Accrued Income"]+=n; M1_ACCTS["P&L Profit"]+=n; }},
  {id:"old-newspapers", label:"43. Sold old newspapers", desc:"Cash ↑, P&L Profit ↑",
   fn:(n)=>{ M1_ACCTS.Cash+=n; M1_ACCTS["P&L Profit"]+=n; }},
  {id:"carriage", label:"44. Paid carriage inward", desc:"Cash ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Cash-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"bad-debts-rec", label:"45. Bad debts recovered", desc:"Cash ↑, P&L Profit ↑",
   fn:(n)=>{ M1_ACCTS.Cash+=n; M1_ACCTS["P&L Profit"]+=n; }},
  {id:"stationery", label:"46. Purchased office stationery", desc:"Cash ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Cash-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"repairs", label:"47. Paid machinery repairs", desc:"Cash ↓, P&L Profit ↓",
   fn:(n)=>{ M1_ACCTS.Cash-=n; M1_ACCTS["P&L Profit"]-=n; }},
  {id:"drawings-goods", label:"48. Goods withdrawn for personal use", desc:"Stock ↓, Drawings ↑",
   fn:(n)=>{ M1_ACCTS.Stock-=n; M1_ACCTS.Drawings+=n; }},
  {id:"security-dep", label:"49. Received security deposit from tenant", desc:"Cash ↑, Creditors ↑ (Liability)",
   fn:(n)=>{ M1_ACCTS.Cash+=n; M1_ACCTS.Creditors+=n; }},
  {id:"accrued-int", label:"50. Accrued interest on investments", desc:"Accrued Income ↑, P&L Profit ↑",
   fn:(n)=>{ M1_ACCTS["Accrued Income"]+=n; M1_ACCTS["P&L Profit"]+=n; }}
];
// Rebuild the select options
const sel = $("#txTemplate");
sel.innerHTML = TPL.map(t=>`<option value="${t.id}">${t.label}</option>`).join("");

$("#txApply").onclick=()=>{
  const k=$("#txTemplate").value, n=+($("#txAmt").value||0);
  if(!n||n<=0){toast("Enter an amount","bad");sfx.bad();return}
  const tpl = TPL.find(t=>t.id===k);
  if(!tpl) return;

  // 1. Pre-Transaction Validation: save current state for simulation/rollback
  const backup = {};
  for (const acct in M1_ACCTS) {
    backup[acct] = M1_ACCTS[acct];
  }

  // Simulate/Apply transaction temporarily
  tpl.fn(n);

  // 2 & 3. Validate guardrails (block negative physical assets and liabilities)
  let isInvalid = false;
  let invalidReason = "";
  for (const acct in M1_ACCTS) {
    if ((M1_ACCT_TYPES[acct] === "A" || M1_ACCT_TYPES[acct] === "L") && (M1_ACCTS[acct] || 0) < 0) {
      isInvalid = true;
      invalidReason = acct;
      break;
    }
  }

  if (isInvalid) {
    // 4. User Feedback and Rollback state
    for (const acct in backup) {
      M1_ACCTS[acct] = backup[acct];
    }
    sfx.bad();
    toast("Transaction blocked", "bad");
    alert(`⚠️ Invalid Transaction: Insufficient balance in ${invalidReason}. Account cannot be negative.`);
    return;
  }

  // Transaction is valid, proceed
  M1.log.push({label:tpl.label, detail:tpl.desc + "  Amount: " + fmt(n)});
  sfx.pop(); m1Render(); awardXP(8,"Transaction applied");
};
$("#txReset").onclick=()=>{
  Object.keys(M1_ACCTS).forEach(k=>M1_ACCTS[k]=0);
  M1.log=[]; m1Render(); sfx.tap();
};

/* ============ DRAG HELPER (pointer-based, works touch+mouse) ============ */
function makeDraggable(chip, onDrop){
  chip.addEventListener("pointerdown",ev=>{
    ev.preventDefault();
    chip.setPointerCapture(ev.pointerId);
    const r = chip.getBoundingClientRect();
    const ox = ev.clientX - r.left, oy = ev.clientY - r.top;
    const clone = chip.cloneNode(true);
    clone.style.position="fixed"; clone.style.left=r.left+"px"; clone.style.top=r.top+"px";
    clone.style.width=r.width+"px"; clone.style.zIndex=999; clone.style.pointerEvents="none";
    clone.classList.add("drag"); document.body.appendChild(clone);
    chip.style.opacity=.35;
    let lastEl=null;
    function move(e){
      clone.style.left=(e.clientX-ox)+"px"; clone.style.top=(e.clientY-oy)+"px";
      const under = document.elementFromPoint(e.clientX,e.clientY);
      const bucket = under && under.closest("[data-side],[data-drop]");
      if(lastEl && lastEl!==bucket) lastEl.classList.remove("dr");
      if(bucket){ bucket.classList.add("dr"); lastEl=bucket; }
    }
    function up(e){
      chip.releasePointerCapture(ev.pointerId);
      document.removeEventListener("pointermove",move);
      document.removeEventListener("pointerup",up);
      const under = document.elementFromPoint(e.clientX,e.clientY);
      const bucket = under && under.closest("[data-side],[data-drop]");
      if(lastEl) lastEl.classList.remove("dr");
      clone.remove(); chip.style.opacity="";
      if(bucket){ sfx.pop(); onDrop && onDrop(bucket); }
    }
    document.addEventListener("pointermove",move);
    document.addEventListener("pointerup",up);
  });
}

/* ============ MODULE 2: TRANSACTION LAB ============ */
const M2_SCENES = [
  {text:"Owner invested ₹50,000 cash into the business.", amt:50000,
   pool:[["Cash","A","dr"],["Capital","Q","cr"],["Bank Loan","L"],["Rent","E"]],
   right:{debit:["Cash"], credit:["Capital"]},
   delta:{A:+50000,L:0,C:+50000}, why:"Cash (Asset) ↑ → Debit. Capital (Equity) ↑ → Credit."},
  {text:"Took a bank loan of ₹20,000 — credited to cash.", amt:20000,
   pool:[["Cash","A","dr"],["Bank Loan","L","cr"],["Capital","Q"],["Sales","R"]],
   right:{debit:["Cash"], credit:["Bank Loan"]},
   delta:{A:+20000,L:+20000,C:0}, why:"Cash (Asset) ↑ → Debit. Loan (Liability) ↑ → Credit."},
  {text:"Bought machinery for ₹15,000 in cash.", amt:15000,
   pool:[["Machinery","A","dr"],["Cash","A","cr"],["Creditors","L"],["Capital","Q"]],
   right:{debit:["Machinery"], credit:["Cash"]},
   delta:{A:0,L:0,C:0}, why:"Machinery (Asset) ↑ → Dr. Cash (Asset) ↓ → Cr. Asset swap — total assets unchanged."},
  {text:"Paid office rent ₹2,000 in cash.", amt:2000,
   pool:[["Rent","E","dr"],["Cash","A","cr"],["Capital","Q"],["Sales","R"]],
   right:{debit:["Rent"], credit:["Cash"]},
   delta:{A:-2000,L:0,C:-2000}, why:"Rent (Expense) ↑ → Dr. Cash ↓ → Cr. Expense shrinks Capital."},
  {text:"Cash sales of goods ₹8,000.", amt:8000,
   pool:[["Cash","A","dr"],["Sales","R","cr"],["Capital","Q"],["Rent","E"]],
   right:{debit:["Cash"], credit:["Sales"]},
   delta:{A:+8000,L:0,C:+8000}, why:"Cash ↑ → Dr. Sales (Revenue) ↑ → Cr. Revenue swells Capital."},
  {text:"Purchased goods on credit from Ramesh ₹10,000.", amt:10000,
   pool:[["Purchases","E","dr"],["Creditors","L","cr"],["Cash","A"],["Sales","R"]],
   right:{debit:["Purchases"], credit:["Creditors"]},
   delta:{A:+10000,L:+10000,C:0}, why:"Stock acquired (treated via Purchases) ↑ → Dr. Creditor (Liability) ↑ → Cr."},
  {text:"Sold goods to Mohan on credit ₹7,000.", amt:7000,
   pool:[["Debtors","A","dr"],["Sales","R","cr"],["Cash","A"],["Creditors","L"]],
   right:{debit:["Debtors"], credit:["Sales"]},
   delta:{A:+7000,L:0,C:+7000}, why:"Debtor (Asset) ↑ → Dr. Sales (Revenue) ↑ → Cr."},
  {text:"Received ₹6,000 from Mohan (debtor) in cash.", amt:6000,
   pool:[["Cash","A","dr"],["Debtors","A","cr"],["Sales","R"],["Capital","Q"]],
   right:{debit:["Cash"], credit:["Debtors"]},
   delta:{A:0,L:0,C:0}, why:"Cash ↑ → Dr. Debtors ↓ → Cr. Asset swap inside Assets."},
  {text:"Paid ₹4,000 to creditor Ramesh by cash.", amt:4000,
   pool:[["Creditors","L","dr"],["Cash","A","cr"],["Sales","R"],["Capital","Q"]],
   right:{debit:["Creditors"], credit:["Cash"]},
   delta:{A:-4000,L:-4000,C:0}, why:"Liability ↓ → Dr. Cash ↓ → Cr."},
  {text:"Owner withdrew ₹3,000 cash for personal use.", amt:3000,
   pool:[["Drawings","X","dr"],["Cash","A","cr"],["Capital","Q"],["Sales","R"]],
   right:{debit:["Drawings"], credit:["Cash"]},
   delta:{A:-3000,L:0,C:-3000}, why:"Drawings ↑ (Dr.) reduces Capital. Cash ↓ → Cr."},
  {text:"Deposited ₹10,000 cash into bank.", amt:10000,
   pool:[["Bank","A","dr"],["Cash","A","cr"],["Capital","Q"],["Sales","R"]],
   right:{debit:["Bank"], credit:["Cash"]},
   delta:{A:0,L:0,C:0}, why:"Bank ↑, Cash ↓. Contra entry — assets unchanged."},
  {text:"Withdrew ₹2,000 from bank for office use.", amt:2000,
   pool:[["Cash","A","dr"],["Bank","A","cr"],["Capital","Q"],["Rent","E"]],
   right:{debit:["Cash"], credit:["Bank"]},
   delta:{A:0,L:0,C:0}, why:"Cash ↑, Bank ↓. Another asset-to-asset swap."},
  {text:"Paid salary ₹5,000 by cheque.", amt:5000,
   pool:[["Salary","E","dr"],["Bank","A","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Salary"], credit:["Bank"]},
   delta:{A:-5000,L:0,C:-5000}, why:"Salary (Expense) ↑ → Dr. Bank ↓ → Cr."},
  {text:"Received commission ₹1,500 in cash.", amt:1500,
   pool:[["Cash","A","dr"],["Commission Received","R","cr"],["Sales","R"],["Capital","Q"]],
   right:{debit:["Cash"], credit:["Commission Received"]},
   delta:{A:+1500,L:0,C:+1500}, why:"Cash ↑ → Dr. Revenue ↑ → Cr."},
  {text:"Paid electricity bill ₹800 in cash.", amt:800,
   pool:[["Electricity","E","dr"],["Cash","A","cr"],["Bank","A"],["Capital","Q"]],
   right:{debit:["Electricity"], credit:["Cash"]},
   delta:{A:-800,L:0,C:-800}, why:"Expense ↑ → Dr. Cash ↓ → Cr."},
  {text:"Purchased furniture ₹12,000 by cheque.", amt:12000,
   pool:[["Furniture","A","dr"],["Bank","A","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Furniture"], credit:["Bank"]},
   delta:{A:0,L:0,C:0}, why:"Asset ↑, Asset ↓. Total assets unchanged."},
  {text:"Returned goods to creditor (Purchase Return) ₹1,000.", amt:1000,
   pool:[["Creditors","L","dr"],["Purchase Returns","R","cr"],["Cash","A"],["Sales","R"]],
   right:{debit:["Creditors"], credit:["Purchase Returns"]},
   delta:{A:0,L:-1000,C:+1000}, why:"Liability ↓ → Dr. Purchase Returns reduces purchases → Cr (income side)."},
  {text:"Goods returned by Mohan (Sales Return) ₹500.", amt:500,
   pool:[["Sales Returns","E","dr"],["Debtors","A","cr"],["Sales","R"],["Cash","A"]],
   right:{debit:["Sales Returns"], credit:["Debtors"]},
   delta:{A:-500,L:0,C:-500}, why:"Sales Returns (contra revenue) ↑ → Dr. Debtor ↓ → Cr."},
  {text:"Paid wages ₹1,800 in cash.", amt:1800,
   pool:[["Wages","E","dr"],["Cash","A","cr"],["Capital","Q"],["Sales","R"]],
   right:{debit:["Wages"], credit:["Cash"]},
   delta:{A:-1800,L:0,C:-1800}, why:"Wages (Expense) ↑ → Dr. Cash ↓ → Cr."},
  {text:"Received interest ₹600 by cheque.", amt:600,
   pool:[["Bank","A","dr"],["Interest Received","R","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Bank"], credit:["Interest Received"]},
   delta:{A:+600,L:0,C:+600}, why:"Bank ↑ → Dr. Income ↑ → Cr."},
  {text:"Paid insurance premium ₹2,400 by cash.", amt:2400,
   pool:[["Insurance","E","dr"],["Cash","A","cr"],["Bank","A"],["Sales","R"]],
   right:{debit:["Insurance"], credit:["Cash"]},
   delta:{A:-2400,L:0,C:-2400}, why:"Insurance (Expense) ↑ → Dr. Cash ↓ → Cr."},
  {text:"Bought a delivery vehicle ₹80,000 — paid ₹30,000 cash, balance on credit.", amt:80000,
   pool:[["Vehicle","A","dr"],["Cash","A","cr"],["Creditors","L","cr"],["Capital","Q"]],
   right:{debit:["Vehicle"], credit:["Cash","Creditors"]},
   delta:{A:+50000,L:+50000,C:0}, why:"Vehicle ↑ ₹80k Dr. Cash ↓ ₹30k Cr + Creditors ↑ ₹50k Cr."},
  {text:"Issued cheque ₹5,000 to creditor (full settlement of ₹5,200; discount ₹200).", amt:5200,
   pool:[["Creditors","L","dr"],["Bank","A","cr"],["Discount Received","R","cr"],["Cash","A"]],
   right:{debit:["Creditors"], credit:["Bank","Discount Received"]},
   delta:{A:-5000,L:-5200,C:+200}, why:"Liability ↓ ₹5,200 Dr. Bank ↓ ₹5,000 Cr + Discount Received ₹200 Cr (income)."},
  {text:"Charged depreciation on machinery ₹1,500.", amt:1500,
   pool:[["Depreciation","E","dr"],["Machinery","A","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Depreciation"], credit:["Machinery"]},
   delta:{A:-1500,L:0,C:-1500}, why:"Depreciation (Expense) ↑ → Dr. Machinery (Asset) ↓ → Cr. No cash moves."},
  {text:"Bad debts written off ₹700 (Mohan insolvent).", amt:700,
   pool:[["Bad Debts","E","dr"],["Debtors","A","cr"],["Cash","A"],["Sales","R"]],
   right:{debit:["Bad Debts"], credit:["Debtors"]},
   delta:{A:-700,L:0,C:-700}, why:"Loss (Expense) ↑ → Dr. Debtor ↓ → Cr."},
  {text:"Salary ₹3,000 outstanding (unpaid) at year end.", amt:3000,
   pool:[["Salary","E","dr"],["Outstanding Salary","L","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Salary"], credit:["Outstanding Salary"]},
   delta:{A:0,L:+3000,C:-3000}, why:"Expense ↑ → Dr. Liability (Outstanding Salary) ↑ → Cr."},
  {text:"Paid rent ₹6,000 in advance for next 6 months.", amt:6000,
   pool:[["Prepaid Rent","A","dr"],["Cash","A","cr"],["Rent","E"],["Capital","Q"]],
   right:{debit:["Prepaid Rent"], credit:["Cash"]},
   delta:{A:0,L:0,C:0}, why:"Prepaid Rent (Asset) ↑ → Dr. Cash ↓ → Cr. Asset swap."},
  {text:"Issued a Bill of Exchange to creditor for ₹4,000.", amt:4000,
   pool:[["Creditors","L","dr"],["Bills Payable","L","cr"],["Cash","A"],["Sales","R"]],
   right:{debit:["Creditors"], credit:["Bills Payable"]},
   delta:{A:0,L:0,C:0}, why:"One liability ↓ (Dr.), another liability ↑ (Cr.). Liability swap."},
  {text:"Accepted Bill Receivable from Mohan ₹3,500.", amt:3500,
   pool:[["Bills Receivable","A","dr"],["Debtors","A","cr"],["Cash","A"],["Sales","R"]],
   right:{debit:["Bills Receivable"], credit:["Debtors"]},
   delta:{A:0,L:0,C:0}, why:"Asset swap inside current assets."},
  {text:"Sold old furniture for ₹2,500 cash (book value ₹2,500).", amt:2500,
   pool:[["Cash","A","dr"],["Furniture","A","cr"],["Sales","R"],["Capital","Q"]],
   right:{debit:["Cash"], credit:["Furniture"]},
   delta:{A:0,L:0,C:0}, why:"Cash ↑ → Dr. Furniture ↓ → Cr. Asset swap."},
  {text:"Owner paid Life Insurance Premium from business cash ₹2,000.", amt:2000,
   pool:[["Drawings","X","dr"],["Cash","A","cr"],["Insurance","E"],["Capital","Q"]],
   right:{debit:["Drawings"], credit:["Cash"]},
   delta:{A:-2000,L:0,C:-2000}, why:"Life insurance of owner is personal → Drawings (Dr). Cash ↓ (Cr)."},
  {text:"Paid Income Tax from business bank account ₹5,000.", amt:5000,
   pool:[["Drawings","X","dr"],["Bank","A","cr"],["Tax Expense","E"],["Capital","Q"]],
   right:{debit:["Drawings"], credit:["Bank"]},
   delta:{A:-5000,L:0,C:-5000}, why:"Proprietor's income tax is a personal expense → Drawings (Dr). Bank ↓ (Cr)."},
  {text:"Goods costing ₹1,000 distributed as free samples.", amt:1000,
   pool:[["Advertisement","E","dr"],["Purchases","E","cr"],["Sales","R"],["Cash","A"]],
   right:{debit:["Advertisement"], credit:["Purchases"]},
   delta:{A:0,L:0,C:0}, why:"Advertisement expense ↑ (Dr). Goods leave without sale → Purchases ↓ (Cr)."},
  {text:"Goods costing ₹500 given away as charity.", amt:500,
   pool:[["Charity","E","dr"],["Purchases","E","cr"],["Sales","R"],["Cash","A"]],
   right:{debit:["Charity"], credit:["Purchases"]},
   delta:{A:0,L:0,C:0}, why:"Charity expense ↑ (Dr). Goods leave without sale → Purchases ↓ (Cr)."},
  {text:"Goods worth ₹2,000 destroyed by fire (uninsured).", amt:2000,
   pool:[["Loss by Fire","E","dr"],["Purchases","E","cr"],["Sales","R"],["Cash","A"]],
   right:{debit:["Loss by Fire"], credit:["Purchases"]},
   delta:{A:0,L:0,C:0}, why:"Abnormal loss ↑ (Dr). Goods destroyed → Purchases ↓ (Cr)."},
  {text:"Paid installation charges on new machinery ₹3,000.", amt:3000,
   pool:[["Machinery","A","dr"],["Cash","A","cr"],["Wages","E"],["Repairs","E"]],
   right:{debit:["Machinery"], credit:["Cash"]},
   delta:{A:0,L:0,C:0}, why:"Expenses to bring an asset to usable condition are capitalized (added to Asset)."},
  {text:"Bank charged ₹200 for services.", amt:200,
   pool:[["Bank Charges","E","dr"],["Bank","A","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Bank Charges"], credit:["Bank"]},
   delta:{A:-200,L:0,C:-200}, why:"Expense ↑ (Dr). Bank balance ↓ (Cr)."},
  {text:"Interest allowed by bank ₹150.", amt:150,
   pool:[["Bank","A","dr"],["Interest Received","R","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Bank"], credit:["Interest Received"]},
   delta:{A:+150,L:0,C:+150}, why:"Bank balance ↑ (Dr). Income/Revenue ↑ (Cr)."},
  {text:"Interest on Capital provided at 10% on ₹50,000 (₹5,000).", amt:5000,
   pool:[["Interest on Capital","E","dr"],["Capital","Q","cr"],["Cash","A"],["Interest Received","R"]],
   right:{debit:["Interest on Capital"], credit:["Capital"]},
   delta:{A:0,L:0,C:0}, why:"Expense for business ↑ (Dr). Owner's claim (Capital) ↑ (Cr)."},
  {text:"Interest charged on Drawings ₹300.", amt:300,
   pool:[["Drawings","X","dr"],["Interest on Drawings","R","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Drawings"], credit:["Interest on Drawings"]},
   delta:{A:0,L:0,C:0}, why:"Drawings ↑ (Dr). Business income ↑ (Cr)."},
  {text:"Rent received in advance ₹4,000.", amt:4000,
   pool:[["Cash","A","dr"],["Unearned Rent","L","cr"],["Rent Received","R"],["Capital","Q"]],
   right:{debit:["Cash"], credit:["Unearned Rent"]},
   delta:{A:+4000,L:+4000,C:0}, why:"Cash ↑ (Dr). Liability for unearned income ↑ (Cr)."},
  {text:"Accrued Commission (earned but not received) ₹1,200.", amt:1200,
   pool:[["Accrued Commission","A","dr"],["Commission Received","R","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Accrued Commission"], credit:["Commission Received"]},
   delta:{A:+1200,L:0,C:+1200}, why:"Asset (Accrued Income) ↑ (Dr). Revenue ↑ (Cr)."},
  {text:"Purchased a computer for office use ₹25,000 by cheque.", amt:25000,
   pool:[["Computer","A","dr"],["Bank","A","cr"],["Purchases","E"],["Cash","A"]],
   right:{debit:["Computer"], credit:["Bank"]},
   delta:{A:0,L:0,C:0}, why:"Asset (Computer) ↑ (Dr). Asset (Bank) ↓ (Cr)."},
  {text:"Sold old newspapers for ₹100 cash.", amt:100,
   pool:[["Cash","A","dr"],["Miscellaneous Income","R","cr"],["Sales","R"],["Capital","Q"]],
   right:{debit:["Cash"], credit:["Miscellaneous Income"]},
   delta:{A:+100,L:0,C:+100}, why:"Cash ↑ (Dr). Minor Revenue ↑ (Cr)."},
  {text:"Paid carriage inward on purchase of goods ₹500.", amt:500,
   pool:[["Carriage Inwards","E","dr"],["Cash","A","cr"],["Purchases","E"],["Bank","A"]],
   right:{debit:["Carriage Inwards"], credit:["Cash"]},
   delta:{A:-500,L:0,C:-500}, why:"Direct expense ↑ (Dr). Cash ↓ (Cr)."},
  {text:"Recovered bad debts previously written off ₹800.", amt:800,
   pool:[["Cash","A","dr"],["Bad Debts Recovered","R","cr"],["Debtors","A"],["Capital","Q"]],
   right:{debit:["Cash"], credit:["Bad Debts Recovered"]},
   delta:{A:+800,L:0,C:+800}, why:"Cash ↑ (Dr). Gain/Revenue ↑ (Cr)."},
  {text:"Purchased stationery for office use ₹400 in cash.", amt:400,
   pool:[["Stationery","E","dr"],["Cash","A","cr"],["Purchases","E"],["Capital","Q"]],
   right:{debit:["Stationery"], credit:["Cash"]},
   delta:{A:-400,L:0,C:-400}, why:"Expense ↑ (Dr). Cash ↓ (Cr)."},
  {text:"Paid repairs for existing machinery ₹1,000.", amt:1000,
   pool:[["Repairs","E","dr"],["Cash","A","cr"],["Machinery","A"],["Capital","Q"]],
   right:{debit:["Repairs"], credit:["Cash"]},
   delta:{A:-1000,L:0,C:-1000}, why:"Revenue expenditure (Expense) ↑ (Dr). Cash ↓ (Cr)."},
  {text:"Owner brought additional capital ₹20,000 by cheque.", amt:20000,
   pool:[["Bank","A","dr"],["Capital","Q","cr"],["Cash","A"],["Sales","R"]],
   right:{debit:["Bank"], credit:["Capital"]},
   delta:{A:+20000,L:0,C:+20000}, why:"Bank ↑ (Dr). Capital ↑ (Cr)."},
  {text:"Withdrew goods for personal use costing ₹1,500.", amt:1500,
   pool:[["Drawings","X","dr"],["Purchases","E","cr"],["Sales","R"],["Cash","A"]],
   right:{debit:["Drawings"], credit:["Purchases"]},
   delta:{A:0,L:0,C:0}, why:"Drawings ↑ (Dr). Goods leave without sale → Purchases ↓ (Cr)."},
  {text:"Paid wages for installation of new machinery ₹1,500.", amt:1500,
   pool:[["Machinery","A","dr"],["Cash","A","cr"],["Wages","E"],["Capital","Q"]],
   right:{debit:["Machinery"], credit:["Cash"]},
   delta:{A:0,L:0,C:0}, why:"Installation wages are capitalized to Machinery (Asset ↑). Cash ↓."},
  {text:"Advance received from a customer ₹5,000.", amt:5000,
   pool:[["Cash","A","dr"],["Advance from Customer","L","cr"],["Sales","R"],["Capital","Q"]],
   right:{debit:["Cash"], credit:["Advance from Customer"]},
   delta:{A:+5000,L:+5000,C:0}, why:"Cash ↑ (Dr). Advance is a Liability ↑ (Cr)."},
  {text:"Provided Depreciation on Furniture ₹500.", amt:500,
   pool:[["Depreciation","E","dr"],["Furniture","A","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Depreciation"], credit:["Furniture"]},
   delta:{A:-500,L:0,C:-500}, why:"Expense ↑ (Dr). Value of Asset ↓ (Cr)."},
  {text:"Goods given to employees as staff welfare ₹800.", amt:800,
   pool:[["Staff Welfare Exp","E","dr"],["Purchases","E","cr"],["Cash","A"],["Sales","R"]],
   right:{debit:["Staff Welfare Exp"], credit:["Purchases"]},
   delta:{A:0,L:0,C:0}, why:"Welfare Expense ↑ (Dr). Goods leave without sale → Purchases ↓ (Cr)."},
  {text:"Owner's income tax refund deposited into business bank ₹2,000.", amt:2000,
   pool:[["Bank","A","dr"],["Capital","Q","cr"],["Tax Expense","E"],["Cash","A"]],
   right:{debit:["Bank"], credit:["Capital"]},
   delta:{A:+2000,L:0,C:+2000}, why:"Bank ↑ (Dr). Personal money into business is Additional Capital ↑ (Cr)."},
  {text:"Paid life insurance premium of the owner by cheque ₹1,200.", amt:1200,
   pool:[["Drawings","X","dr"],["Bank","A","cr"],["Insurance","E"],["Capital","Q"]],
   right:{debit:["Drawings"], credit:["Bank"]},
   delta:{A:-1200,L:0,C:-1200}, why:"Personal insurance is Drawings (Dr). Bank ↓ (Cr)."},
  {text:"Interest accrued on investments but not received ₹600.", amt:600,
   pool:[["Accrued Interest","A","dr"],["Interest Received","R","cr"],["Cash","A"],["Bank","A"]],
   right:{debit:["Accrued Interest"], credit:["Interest Received"]},
   delta:{A:+600,L:0,C:+600}, why:"Asset (Accrued Income) ↑ (Dr). Revenue ↑ (Cr)."},
  {text:"Commission received in advance ₹900.", amt:900,
   pool:[["Cash","A","dr"],["Unearned Commission","L","cr"],["Commission","R"],["Capital","Q"]],
   right:{debit:["Cash"], credit:["Unearned Commission"]},
   delta:{A:+900,L:+900,C:0}, why:"Cash ↑ (Dr). Liability (Unearned Income) ↑ (Cr)."},
  {text:"Salary paid in advance to employee ₹1,000.", amt:1000,
   pool:[["Prepaid Salary","A","dr"],["Cash","A","cr"],["Salary","E"],["Capital","Q"]],
   right:{debit:["Prepaid Salary"], credit:["Cash"]},
   delta:{A:0,L:0,C:0}, why:"Prepaid Salary is an Asset ↑ (Dr). Cash ↓ (Cr)."},
  {text:"Repayment of Bank Loan ₹10,000 by cheque.", amt:10000,
   pool:[["Bank Loan","L","dr"],["Bank","A","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Bank Loan"], credit:["Bank"]},
   delta:{A:-10000,L:-10000,C:0}, why:"Liability ↓ (Dr). Bank ↓ (Cr)."},
  {text:"Cash stolen by an employee ₹400.", amt:400,
   pool:[["Loss by Theft","E","dr"],["Cash","A","cr"],["Purchases","E"],["Capital","Q"]],
   right:{debit:["Loss by Theft"], credit:["Cash"]},
   delta:{A:-400,L:0,C:-400}, why:"Abnormal loss ↑ (Dr). Cash ↓ (Cr)."},
  {text:"Issued a cheque to a creditor for ₹4,800 in full settlement of ₹5,000.", amt:5000,
   pool:[["Creditors","L","dr"],["Bank","A","cr"],["Discount Received","R","cr"],["Cash","A"]],
   right:{debit:["Creditors"], credit:["Bank","Discount Received"]},
   delta:{A:-4800,L:-5000,C:+200}, why:"Liability ↓ (Dr). Bank ↓ (Cr) + Discount (Income) ↑ (Cr)."},
  {text:"Received a cheque from debtor ₹3,800 in full settlement of ₹4,000.", amt:4000,
   pool:[["Bank","A","dr"],["Discount Allowed","E","dr"],["Debtors","A","cr"],["Cash","A"]],
   right:{debit:["Bank","Discount Allowed"], credit:["Debtors"]},
   delta:{A:-200,L:0,C:-200}, why:"Bank ↑ and Discount Expense ↑ (Dr). Debtors ↓ (Cr)."},
  {text:"Rent paid by cheque ₹2,000.", amt:2000,
   pool:[["Rent","E","dr"],["Bank","A","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Rent"], credit:["Bank"]},
   delta:{A:-2000,L:0,C:-2000}, why:"Expense ↑ (Dr). Bank ↓ (Cr)."},
  {text:"Purchased stationery for ₹300 by cash.", amt:300,
   pool:[["Stationery","E","dr"],["Cash","A","cr"],["Purchases","E"],["Capital","Q"]],
   right:{debit:["Stationery"], credit:["Cash"]},
   delta:{A:-300,L:0,C:-300}, why:"Expense ↑ (Dr). Cash ↓ (Cr)."},
  {text:"Sold goods costing ₹1,500 at ₹2,000 for cash.", amt:2000,
   pool:[["Cash","A","dr"],["Sales","R","cr"],["Purchases","E"],["Capital","Q"]],
   right:{debit:["Cash"], credit:["Sales"]},
   delta:{A:+2000,L:0,C:+2000}, why:"Cash ↑ (Dr). Sales Revenue ↑ (Cr). Cost/profit handled implicitly."},
  {text:"Bought investments (Shares) for ₹5,000 by cheque.", amt:5000,
   pool:[["Investments","A","dr"],["Bank","A","cr"],["Cash","A"],["Purchases","E"]],
   right:{debit:["Investments"], credit:["Bank"]},
   delta:{A:0,L:0,C:0}, why:"Asset ↑ (Dr). Asset ↓ (Cr)."},
  {text:"Dividend received on investments ₹400.", amt:400,
   pool:[["Bank","A","dr"],["Dividend Received","R","cr"],["Cash","A"],["Investments","A"]],
   right:{debit:["Bank"], credit:["Dividend Received"]},
   delta:{A:+400,L:0,C:+400}, why:"Asset ↑ (Dr). Revenue ↑ (Cr)."},
  {text:"Bank reversed a charge of ₹50 wrongly debited earlier.", amt:50,
   pool:[["Bank","A","dr"],["Bank Charges","E","cr"],["Cash","A"],["Capital","Q"]],
   right:{debit:["Bank"], credit:["Bank Charges"]},
   delta:{A:+50,L:0,C:+50}, why:"Bank ↑ (Dr). Reversal of Expense ↓ (Cr)."}
];
let m2i=0;
function m2Load(i){
  const sc = M2_SCENES[i % M2_SCENES.length];
  $("#m2Scene").innerHTML = "Scenario: <b>"+sc.text+"</b>";
  const pool = $("#m2Pool"); pool.innerHTML="";
  sc.pool.forEach(([name,type])=>{
    const c = document.createElement("div");
    c.className="chip"; c.dataset.type=type; c.dataset.name=name;
    if (typeof _typeDesc === "function") c.dataset.tooltip = _typeDesc(type);
    c.textContent=name;
    makeDraggable(c, bucket=>{ bucket.querySelector(".dz-chips").appendChild(c); m2Update(); });
    pool.appendChild(c);
  });
  $$("#m2 .bucket .dz-chips").forEach(z=>z.innerHTML="");
  $("#m2A").textContent="₹0"; $("#m2L").textContent="₹0"; $("#m2C").textContent="₹0";
  $("#m2Bar").style.background="rgba(255,255,255,.1)";
  $("#m2Status").textContent="Drop accounts to see impact";
  $("#m2Status").className="balance-status";
}
function m2Update(){
  const sc = M2_SCENES[m2i % M2_SCENES.length];
  const dr = $$("[data-side='debit'] .chip", $("#m2")).map(c=>c.dataset.name);
  const cr = $$("[data-side='credit'] .chip", $("#m2")).map(c=>c.dataset.name);
  if(!dr.length && !cr.length){return;}
  const set = (k,v)=>{ const el=$("#m2"+k); el.textContent=(v>0?"+":"")+fmt(v); el.className="v "+(v>0?"up":(v<0?"down":"")); };
  // simulated delta based on whether each side matches expected
  let d = {A:0,L:0,C:0};
  const matchD = JSON.stringify(dr.sort())===JSON.stringify([...sc.right.debit].sort());
  const matchC = JSON.stringify(cr.sort())===JSON.stringify([...sc.right.credit].sort());
  if(matchD && matchC){ d=sc.delta; }
  set("A",d.A);set("L",d.L);set("C",d.C);
  const ok = matchD && matchC;
  $("#m2Bar").style.background = ok? "var(--grad-2)" : "linear-gradient(90deg,#ff5577,#ffb547)";
  $("#m2Status").textContent = ok? "PERFECT ✓  "+sc.why : "Keep adjusting… Dr and Cr must match the scenario.";
  $("#m2Status").className="balance-status"+(ok?"":" bad");
}
$("#m2Next").onclick=()=>{m2i++; m2Load(m2i); sfx.tap()};
$("#m2Check").onclick=()=>{
  const sc=M2_SCENES[m2i % M2_SCENES.length];
  const dr=$$("[data-side='debit'] .chip", $("#m2")).map(c=>c.dataset.name);
  const cr=$$("[data-side='credit'] .chip", $("#m2")).map(c=>c.dataset.name);
  const ok = JSON.stringify(dr.sort())===JSON.stringify([...sc.right.debit].sort()) &&
             JSON.stringify(cr.sort())===JSON.stringify([...sc.right.credit].sort());
  if(ok){ confetti(80); sfx.good(); bumpCombo(); awardXP(15,"Lab solved"); }
  else{ sfx.bad(); resetCombo(); toast("Not quite — read the rule again","bad"); }
};
m2Load(0);

/* ============ MODULE 3: ALERE WHEEL ============ */
const ALERE = [
  {k:"A", title:"Assets", def:"Resources <b>owned/controlled</b> by the business that bring future economic benefit.",
   inc:"DEBIT (Dr.)", dec:"CREDIT (Cr.)",
   examples:["Cash, Bank, Stock (Inventory), Debtors, Bills Receivable","Furniture, Machinery, Building, Land, Vehicles","Prepaid Rent, Accrued Income, Investments"],
   rule:"Golden Rule (Real A/c): Debit what comes IN, Credit what goes OUT.",
   meme:"“Assets coming IN? Debit. Going OUT? Credit. Cash loves the LEFT side.”"},
  {k:"L", title:"Liabilities", def:"Obligations the business <b>owes</b> to outsiders — to be settled in cash, goods or service.",
   inc:"CREDIT (Cr.)", dec:"DEBIT (Dr.)",
   examples:["Creditors, Bills Payable, Bank Overdraft","Bank Loan, Debentures, Mortgage","Outstanding Salary/Rent, Income Received in Advance"],
   rule:"Golden Rule (Personal A/c): Debit the receiver, Credit the giver.",
   meme:"“Loans live on the RIGHT — credit them when they grow, debit when you pay back.”"},
  {k:"E", title:"Expenses", def:"Costs <b>consumed</b> to earn revenue during a period — they shrink owner's capital.",
   inc:"DEBIT (Dr.)", dec:"CREDIT (Cr.)",
   examples:["Salary, Rent, Wages, Electricity, Insurance","Carriage Inwards, Discount Allowed, Depreciation","Bad Debts, Repairs, Printing & Stationery"],
   rule:"Golden Rule (Nominal A/c): Debit all expenses & losses.",
   meme:"“Expenses EAT from the LEFT. Always. (Dr. side reduces profit.)”"},
  {k:"R", title:"Revenue", def:"Income <b>earned</b> by selling goods/services or from other sources — it inflates capital.",
   inc:"CREDIT (Cr.)", dec:"DEBIT (Dr.)",
   examples:["Sales, Fees Earned, Service Revenue","Commission Received, Interest Received, Rent Received","Discount Received, Dividend Received"],
   rule:"Golden Rule (Nominal A/c): Credit all incomes & gains.",
   meme:"“Revenue RESTS on the RIGHT. Cr. side fattens capital.”"},
  {k:"E", title:"Equity (Capital)", def:"Owner's residual claim: <b>Capital = Assets − Liabilities</b>. Increased by profit & fresh capital; decreased by losses & drawings.",
   inc:"CREDIT (Cr.)", dec:"DEBIT (Dr.)",
   examples:["Capital A/c (opening + additions)","Profit for the year (adds to capital)","Drawings (reduces capital — Dr. balance)"],
   rule:"Capital A/c always has a CREDIT balance; Drawings always has a DEBIT balance.",
   meme:"“Owners cheer from the RIGHT. Drawings sneak to the LEFT.”"},
];
let wheelAngle=0, wheelIdx=0;
function setALERE(i){
  const a=ALERE[i];
  $("#aTitle").textContent=a.title;
  $("#aDef").innerHTML=a.def;
  $("#aInc").textContent=a.inc;
  $("#aDec").textContent=a.dec;
  $("#aMeme").textContent=a.meme;
  $("#aExamples").innerHTML = "<b style='color:var(--ink)'>Examples:</b><ul style='margin:4px 0 0 18px;padding:0'>"+a.examples.map(e=>"<li>"+e+"</li>").join("")+"</ul>";
  $("#aRule").textContent = "📜 "+a.rule;
  $("#hub").innerHTML = a.k + "<small>"+a.title.toUpperCase()+"</small>";
}
setALERE(0);
$("#spin").onclick=()=>{
  const turns = 3 + Math.floor(Math.random()*3);
  wheelIdx = (wheelIdx + 1 + Math.floor(Math.random()*4)) % 5;
  // pointer at top; each slice = 72deg starting at -90.
  const targetAngle = turns*360 + (360 - wheelIdx*72) - 36; // center of slice under pointer
  wheelAngle = targetAngle;
  $("#wheel").style.transform = `rotate(${wheelAngle}deg)`;
  sfx.pop();
  setTimeout(()=>{ setALERE(wheelIdx); sfx.good(); awardXP(5,"ALERE learned"); }, 1100);
};
$("#wheel").onclick=()=>$("#spin").click();

/* ============ MODULE 4: DRAG-DROP LAB ============ */
const JB = [
  {scene:"Owner started business with cash ₹1,00,000.",
   pool:["Cash","Capital","Bank Loan","Rent","Sales"],
   answer:{debit:["Cash"], credit:["Capital"], amt:100000},
   why:"Cash (Asset) increases → Debit. Capital (Equity) increases → Credit."},
  {scene:"Purchased goods worth ₹20,000 on credit from Ramesh.",
   pool:["Purchases","Creditors","Cash","Sales","Capital"],
   answer:{debit:["Purchases"], credit:["Creditors"], amt:20000},
   why:"Purchases (Expense) up → Debit. Creditors (Liability) up → Credit."},
  {scene:"Sold goods for cash ₹12,000.",
   pool:["Cash","Sales","Purchases","Rent","Capital"],
   answer:{debit:["Cash"], credit:["Sales"], amt:12000},
   why:"Cash up → Debit. Revenue up → Credit."},
  {scene:"Paid salary ₹5,000 in cash.",
   pool:["Salary","Cash","Capital","Sales","Bank Loan"],
   answer:{debit:["Salary"], credit:["Cash"], amt:5000},
   why:"Salary (Expense) up → Debit. Cash down → Credit."},
  {scene:"Withdrew ₹3,000 for personal use (Drawings).",
   pool:["Drawings","Cash","Sales","Capital","Rent"],
   answer:{debit:["Drawings"], credit:["Cash"], amt:3000},
   why:"Drawings reduce Capital → Debit. Cash down → Credit."},
  {scene:"Received ₹6,000 from Mohan (debtor) by cheque deposited into bank.",
   pool:["Bank","Mohan (Debtor)","Cash","Sales","Capital"],
   answer:{debit:["Bank"], credit:["Mohan (Debtor)"], amt:6000},
   why:"Bank (Asset) ↑ → Debit. Debtor (Asset) ↓ → Credit."},
  {scene:"Took loan ₹50,000 from State Bank — credited to bank account.",
   pool:["Bank","Bank Loan","Cash","Capital","Sales"],
   answer:{debit:["Bank"], credit:["Bank Loan"], amt:50000},
   why:"Bank (Asset) ↑ → Debit. Loan (Liability) ↑ → Credit."},
  {scene:"Paid ₹4,000 to creditor Ramesh in cash.",
   pool:["Creditors","Cash","Bank","Sales","Capital"],
   answer:{debit:["Creditors"], credit:["Cash"], amt:4000},
   why:"Creditors (Liability) ↓ → Debit. Cash ↓ → Credit."},
  {scene:"Sold goods on credit to Mohan ₹9,000.",
   pool:["Debtors","Sales","Cash","Capital","Bank"],
   answer:{debit:["Debtors"], credit:["Sales"], amt:9000},
   why:"Debtors (Asset) ↑ → Debit. Sales (Revenue) ↑ → Credit."},
  {scene:"Deposited ₹15,000 cash into bank.",
   pool:["Bank","Cash","Capital","Sales","Creditors"],
   answer:{debit:["Bank"], credit:["Cash"], amt:15000},
   why:"Contra entry: Bank ↑ → Debit. Cash ↓ → Credit."},
  {scene:"Withdrew ₹3,000 from bank for office use.",
   pool:["Cash","Bank","Capital","Drawings","Sales"],
   answer:{debit:["Cash"], credit:["Bank"], amt:3000},
   why:"Cash ↑ → Debit. Bank ↓ → Credit."},
  {scene:"Paid electricity bill ₹800 in cash.",
   pool:["Electricity","Cash","Bank","Sales","Capital"],
   answer:{debit:["Electricity"], credit:["Cash"], amt:800},
   why:"Electricity (Expense) ↑ → Debit. Cash ↓ → Credit."},
  {scene:"Received commission ₹1,200 in cash.",
   pool:["Cash","Commission Received","Sales","Capital","Bank"],
   answer:{debit:["Cash"], credit:["Commission Received"], amt:1200},
   why:"Cash ↑ → Debit. Income ↑ → Credit."},
  {scene:"Bought furniture ₹10,000 by cheque.",
   pool:["Furniture","Bank","Cash","Capital","Sales"],
   answer:{debit:["Furniture"], credit:["Bank"], amt:10000},
   why:"Furniture (Asset) ↑ → Debit. Bank (Asset) ↓ → Credit."},
  {scene:"Goods returned to creditor (Purchase Return) ₹1,500.",
   pool:["Creditors","Purchase Returns","Cash","Sales","Purchases"],
   answer:{debit:["Creditors"], credit:["Purchase Returns"], amt:1500},
   why:"Liability ↓ → Debit. Purchase Returns reduce cost → Credit."},
  {scene:"Mohan returned goods to us (Sales Return) ₹600.",
   pool:["Sales Returns","Debtors","Cash","Capital","Sales"],
   answer:{debit:["Sales Returns"], credit:["Debtors"], amt:600},
   why:"Sales Returns (contra revenue) ↑ → Debit. Debtors ↓ → Credit."},
  {scene:"Paid wages ₹2,200 in cash.",
   pool:["Wages","Cash","Bank","Capital","Sales"],
   answer:{debit:["Wages"], credit:["Cash"], amt:2200},
   why:"Wages (Expense) ↑ → Debit. Cash ↓ → Credit."},
  {scene:"Charged depreciation on machinery ₹1,500.",
   pool:["Depreciation","Machinery","Cash","Capital","Sales"],
   answer:{debit:["Depreciation"], credit:["Machinery"], amt:1500},
   why:"Depreciation (Expense) ↑ → Debit. Machinery (Asset) ↓ → Credit. No cash."},
  {scene:"Bad debts written off ₹500 (Mohan insolvent).",
   pool:["Bad Debts","Debtors","Cash","Sales","Capital"],
   answer:{debit:["Bad Debts"], credit:["Debtors"], amt:500},
   why:"Loss (Expense) ↑ → Debit. Debtor ↓ → Credit."},
  {scene:"Paid insurance premium ₹2,400 by cash.",
   pool:["Insurance","Cash","Bank","Sales","Capital"],
   answer:{debit:["Insurance"], credit:["Cash"], amt:2400},
   why:"Insurance (Expense) ↑ → Debit. Cash ↓ → Credit."},
  {scene:"Salary ₹3,000 unpaid at year end (outstanding).",
   pool:["Salary","Outstanding Salary","Cash","Capital","Bank"],
   answer:{debit:["Salary"], credit:["Outstanding Salary"], amt:3000},
   why:"Expense ↑ → Debit. Liability (Outstanding Salary) ↑ → Credit."},
  {scene:"Paid rent ₹6,000 in advance for next 6 months.",
   pool:["Prepaid Rent","Cash","Rent","Capital","Bank"],
   answer:{debit:["Prepaid Rent"], credit:["Cash"], amt:6000},
   why:"Prepaid Rent (Asset) ↑ → Debit. Cash ↓ → Credit."},
  {scene:"Issued Bill Payable to creditor for ₹4,000.",
   pool:["Creditors","Bills Payable","Cash","Sales","Bank"],
   answer:{debit:["Creditors"], credit:["Bills Payable"], amt:4000},
   why:"Liability ↓ → Debit. New Liability (Bills Payable) ↑ → Credit."},
  {scene:"Received Bill Receivable from Mohan ₹3,500.",
   pool:["Bills Receivable","Debtors","Cash","Sales","Capital"],
   answer:{debit:["Bills Receivable"], credit:["Debtors"], amt:3500},
   why:"Asset ↑ → Debit. Debtors (Asset) ↓ → Credit. Asset swap."},
  {scene:"Carriage paid on goods purchased ₹400 in cash.",
   pool:["Carriage Inwards","Cash","Bank","Sales","Capital"],
   answer:{debit:["Carriage Inwards"], credit:["Cash"], amt:400},
   why:"Carriage Inwards (direct Expense) ↑ → Debit. Cash ↓ → Credit."},
  {scene:"Received interest ₹700 by cheque.",
   pool:["Bank","Interest Received","Cash","Capital","Sales"],
   answer:{debit:["Bank"], credit:["Interest Received"], amt:700},
   why:"Bank ↑ → Debit. Income ↑ → Credit."},
  {scene:"Received discount ₹200 from creditor on payment.",
   pool:["Creditors","Discount Received","Cash","Bank","Sales"],
   answer:{debit:["Creditors"], credit:["Discount Received"], amt:200},
   why:"Liability ↓ → Debit. Discount Received (Income) ↑ → Credit."},
  {scene:"Sold old furniture for ₹2,500 cash (book value ₹2,500).",
   pool:["Cash","Furniture","Sales","Capital","Bank"],
   answer:{debit:["Cash"], credit:["Furniture"], amt:2500},
   why:"Cash ↑ → Debit. Furniture (Asset) ↓ → Credit."},
  {scene:"Owner brought additional capital of ₹25,000 by cheque.",
   pool:["Bank","Capital","Cash","Drawings","Sales"],
   answer:{debit:["Bank"], credit:["Capital"], amt:25000},
   why:"Bank (Asset) ↑ → Debit. Capital (Equity) ↑ → Credit."},
  {scene:"Owner paid Life Insurance Premium from business cash ₹2,000.",
   pool:["Drawings","Cash","Insurance","Capital","Bank"],
   answer:{debit:["Drawings"], credit:["Cash"], amt:2000},
   why:"Personal expense is treated as Drawings (Dr). Cash decreases (Cr)."},
  {scene:"Paid Income Tax from business bank account ₹5,000.",
   pool:["Drawings","Bank","Tax Expense","Capital","Cash"],
   answer:{debit:["Drawings"], credit:["Bank"], amt:5000},
   why:"Proprietor's income tax is a personal expense (Drawings Dr). Bank decreases (Cr)."},
  {scene:"Goods costing ₹1,000 distributed as free samples.",
   pool:["Advertisement","Purchases","Sales","Cash","Capital"],
   answer:{debit:["Advertisement"], credit:["Purchases"], amt:1000},
   why:"Advertisement expense ↑ (Dr). Goods leave without sale → Purchases ↓ (Cr)."},
  {scene:"Goods costing ₹500 given away as charity.",
   pool:["Charity","Purchases","Sales","Cash","Bank"],
   answer:{debit:["Charity"], credit:["Purchases"], amt:500},
   why:"Charity expense ↑ (Dr). Stock reduced at cost price → Purchases ↓ (Cr)."},
  {scene:"Goods worth ₹2,000 destroyed by fire (uninsured).",
   pool:["Loss by Fire","Purchases","Sales","Cash","Capital"],
   answer:{debit:["Loss by Fire"], credit:["Purchases"], amt:2000},
   why:"Abnormal loss ↑ (Dr). Stock reduced → Purchases ↓ (Cr)."},
  {scene:"Paid installation charges on new machinery ₹3,000.",
   pool:["Machinery","Cash","Wages","Repairs","Bank"],
   answer:{debit:["Machinery"], credit:["Cash"], amt:3000},
   why:"Capital expenditure: added to Asset value (Dr). Cash ↓ (Cr)."},
  {scene:"Bank charged ₹200 for services.",
   pool:["Bank Charges","Bank","Cash","Capital","Interest"],
   answer:{debit:["Bank Charges"], credit:["Bank"], amt:200},
   why:"Expense ↑ (Dr). Bank balance ↓ (Cr)."},
  {scene:"Interest allowed by bank ₹150.",
   pool:["Bank","Interest Received","Cash","Capital","Sales"],
   answer:{debit:["Bank"], credit:["Interest Received"], amt:150},
   why:"Bank balance ↑ (Dr). Income/Revenue ↑ (Cr)."},
  {scene:"Interest on Capital provided at 10% on ₹50,000 (₹5,000).",
   pool:["Interest on Capital","Capital","Cash","Interest Received","Bank"],
   answer:{debit:["Interest on Capital"], credit:["Capital"], amt:5000},
   why:"Business expense ↑ (Dr). Owner's Capital ↑ (Cr)."},
  {scene:"Interest charged on Drawings ₹300.",
   pool:["Drawings","Interest on Drawings","Cash","Capital","Sales"],
   answer:{debit:["Drawings"], credit:["Interest on Drawings"], amt:300},
   why:"Drawings ↑ (Dr). Business income ↑ (Cr)."},
  {scene:"Rent received in advance ₹4,000.",
   pool:["Cash","Unearned Rent","Rent Received","Capital","Bank"],
   answer:{debit:["Cash"], credit:["Unearned Rent"], amt:4000},
   why:"Cash ↑ (Dr). Liability for unearned income ↑ (Cr)."},
  {scene:"Accrued Commission (earned but not received) ₹1,200.",
   pool:["Accrued Commission","Commission Received","Cash","Capital","Bank"],
   answer:{debit:["Accrued Commission"], credit:["Commission Received"], amt:1200},
   why:"Asset (Accrued Income) ↑ (Dr). Revenue ↑ (Cr)."},
  {scene:"Purchased a computer for office use ₹25,000 by cheque.",
   pool:["Computer","Bank","Purchases","Cash","Capital"],
   answer:{debit:["Computer"], credit:["Bank"], amt:25000},
   why:"Asset (Computer) ↑ (Dr). Asset (Bank) ↓ (Cr)."},
  {scene:"Sold old newspapers for ₹100 cash.",
   pool:["Cash","Miscellaneous Income","Sales","Capital","Bank"],
   answer:{debit:["Cash"], credit:["Miscellaneous Income"], amt:100},
   why:"Cash ↑ (Dr). Minor Revenue ↑ (Cr)."},
  {scene:"Paid carriage inward on purchase of goods ₹500.",
   pool:["Carriage Inwards","Cash","Purchases","Bank","Capital"],
   answer:{debit:["Carriage Inwards"], credit:["Cash"], amt:500},
   why:"Direct expense ↑ (Dr). Cash ↓ (Cr)."},
  {scene:"Recovered bad debts previously written off ₹800.",
   pool:["Cash","Bad Debts Recovered","Debtors","Capital","Sales"],
   answer:{debit:["Cash"], credit:["Bad Debts Recovered"], amt:800},
   why:"Cash ↑ (Dr). Gain/Revenue ↑ (Cr)."},
  {scene:"Purchased stationery for office use ₹400 in cash.",
   pool:["Stationery","Cash","Purchases","Capital","Bank"],
   answer:{debit:["Stationery"], credit:["Cash"], amt:400},
   why:"Expense ↑ (Dr). Cash ↓ (Cr)."},
  {scene:"Paid repairs for existing machinery ₹1,000.",
   pool:["Repairs","Cash","Machinery","Capital","Bank"],
   answer:{debit:["Repairs"], credit:["Cash"], amt:1000},
   why:"Revenue expenditure (Expense) ↑ (Dr). Cash ↓ (Cr)."},
  {scene:"Owner brought additional capital ₹20,000 by cheque.",
   pool:["Bank","Capital","Cash","Sales","Drawings"],
   answer:{debit:["Bank"], credit:["Capital"], amt:20000},
   why:"Bank ↑ (Dr). Capital ↑ (Cr)."},
  {scene:"Withdrew goods for personal use costing ₹1,500.",
   pool:["Drawings","Purchases","Sales","Cash","Capital"],
   answer:{debit:["Drawings"], credit:["Purchases"], amt:1500},
   why:"Drawings ↑ (Dr). Goods leave without sale → Purchases ↓ (Cr)."}
];
let jbi=0;
function _eng(){ return window.AcctEngine; }
function _typeOf(name){
  const e=_eng(); if(e) return e.classify(name);
  // fallback simple map
  return ({Cash:"A",Bank:"A",Capital:"Q",Sales:"R",Purchases:"E",Rent:"E",Salary:"E",Drawings:"X","Bank Loan":"L",Creditors:"L"}[name])||"A";
}
function _typeTag(t){ return {A:"ASSET",L:"LIAB",Q:"CAP",E:"EXP",R:"REV",X:"DRAW"}[t]||"?"; }
function _typeDesc(t){ return {
  A:"Asset: Resources owned/controlled.\nDr to increase, Cr to decrease.",
  L:"Liability: Obligations owed.\nCr to increase, Dr to decrease.",
  Q:"Equity/Capital: Owner's claim.\nCr to increase, Dr to decrease.",
  E:"Expense: Costs consumed.\nDr to increase, Cr to decrease.",
  R:"Revenue: Income earned.\nCr to increase, Dr to decrease.",
  X:"Contra-Equity (Drawings).\nDr to increase (reduces Capital)."
}[t]||""; }
function jbLoad(i){
  const q=JB[i%JB.length];
  $("#jbScene").innerHTML="<b>Q.</b> "+q.scene;
  const pool=$("#jbPool"); pool.innerHTML="";
  q.pool.forEach(name=>{
    const t=_typeOf(name);
    const c=document.createElement("div");
    c.className="chip"; c.dataset.name=name; c.dataset.type=t;
    c.dataset.tooltip = _typeDesc(t);
    c.innerHTML=`${name}<span class="tbadge">${_typeTag(t)}</span>`;
    makeDraggable(c,bucket=>{ bucket.querySelector(".dz-chips").appendChild(c); jbImpact(); });
    pool.appendChild(c);
  });
  $$("#m4 .dz .dz-chips").forEach(z=>z.innerHTML="");
  $("#jbDr").value=""; $("#jbCr").value="";
  $("#jbExplain").innerHTML="Drag the right accounts into Debit / Credit. Each chip shows its account family.";
  jbImpact();
}
function jbImpact(){
  const e=_eng();
  const dr=$$("#m4 [data-side='debit'] .chip").map(c=>c.dataset.name);
  const cr=$$("#m4 [data-side='credit'] .chip").map(c=>c.dataset.name);
  const dAmt=+($("#jbDr").value||0), cAmt=+($("#jbCr").value||0);
  let dA=0,dL=0,dQ=0;
  if(e){
    dr.forEach(n=>{ const d=e.eqDelta(e.classify(n),"dr",dAmt); dA+=d.dA; dL+=d.dL; dQ+=d.dQ; });
    cr.forEach(n=>{ const d=e.eqDelta(e.classify(n),"cr",cAmt); dA+=d.dA; dL+=d.dL; dQ+=d.dQ; });
  }
  const fmtΔ=v=>(v>0?"+":"")+"₹"+fmt(Math.abs(v)).replace(/^/,v<0?"-":"");
  $("#jbDA").textContent=fmtΔ(dA); $("#jbDA").className="v "+(dA>0?"up":dA<0?"down":"");
  $("#jbDL").textContent=fmtΔ(dL); $("#jbDL").className="v "+(dL>0?"up":dL<0?"down":"");
  $("#jbDQ").textContent=fmtΔ(dQ); $("#jbDQ").className="v "+(dQ>0?"up":dQ<0?"down":"");
}
["jbDr","jbCr"].forEach(id=>document.addEventListener("input",ev=>{ if(ev.target.id===id) jbImpact(); }));
requestAnimationFrame(()=>jbLoad(0));
$("#jbNext").onclick=()=>{jbi++; jbLoad(jbi); sfx.tap()};
$("#jbHint").onclick=()=>{
  const q=JB[jbi%JB.length];
  const e=_eng();
  const tip = e ? q.answer.debit.map(n=>e.explain(n,"dr")).concat(q.answer.credit.map(n=>e.explain(n,"cr"))).join("  •  ") : q.why;
  $("#jbExplain").innerHTML="💡 "+tip;
  sfx.pop();
};
$("#jbCheck").onclick=()=>{
  const q=JB[jbi%JB.length];
  const dr=$$("#m4 [data-side='debit'] .chip").map(c=>c.dataset.name);
  const cr=$$("#m4 [data-side='credit'] .chip").map(c=>c.dataset.name);
  const dAmt=+($("#jbDr").value||0), cAmt=+($("#jbCr").value||0);
  const e=_eng();
  // engine validation (dual aspect + equation)
  const entry={label:q.scene, dr:dr.map(a=>({a,amt:dAmt})), cr:cr.map(a=>({a,amt:cAmt}))};
  const v = e ? e.validate(entry) : {ok:true,errors:[],delta:{dA:0,dL:0,dQ:0}};
  const matchAns =
    JSON.stringify(dr.sort())===JSON.stringify([...q.answer.debit].sort()) &&
    JSON.stringify(cr.sort())===JSON.stringify([...q.answer.credit].sort()) &&
    dAmt===q.answer.amt && cAmt===q.answer.amt;
  $$("#m4 .dz").forEach(d=>d.classList.remove("ok","bad"));
  if(!v.ok){
    sfx.bad(); resetCombo();
    $$("#m4 .dz").forEach(d=>d.classList.add("bad"));
    $("#jbExplain").innerHTML="⚠ <b>Engine rejected:</b> "+v.errors.join(" • ");
    return;
  }
  if(matchAns){
    confetti(140); sfx.good(); bumpCombo(); awardXP(20,"Journal entry correct");
    $$("#m4 .dz").forEach(d=>d.classList.add("ok"));
    $("#jbExplain").innerHTML="✅ <b>Correct & balanced!</b> "+q.why+
      `<br/><span style="color:var(--ink-dim)">Equation impact: ΔA ${v.delta.dA>=0?"+":""}${fmt(v.delta.dA)} = ΔL ${v.delta.dL>=0?"+":""}${fmt(v.delta.dL)} + ΔC ${v.delta.dQ>=0?"+":""}${fmt(v.delta.dQ)}</span>`;
  } else {
    sfx.bad(); resetCombo();
    $("#jbExplain").innerHTML="❌ Dual aspect holds but the accounts don't match the scenario. "+q.why+
      "<br/>Expected Dr: <b>"+q.answer.debit.join(", ")+"</b> · Cr: <b>"+q.answer.credit.join(", ")+"</b> · Amount: <b>"+fmt(q.answer.amt)+"</b>";
  }
};

/* ============ MODULE 5: GAME ============ */
const GAME = [
  {q:"Owner brings ₹10,000 cash as capital. Impact?",
   o:["Assets ↑, Capital ↑","Assets ↑, Liabilities ↑","Assets ↑, Capital ↓","No change"], a:0,
   why:"Cash (Asset) rises and Capital rises by the same amount."},
  {q:"Bought goods on credit ₹5,000. Impact?",
   o:["Assets ↑, Liabilities ↑","Assets ↑, Capital ↑","Assets ↓, Liabilities ↓","Capital ↓, Liabilities ↑"], a:0,
   why:"Stock (Asset) rises and Creditors (Liability) rises."},
  {q:"Paid creditors ₹2,000. Impact?",
   o:["Assets ↓, Liabilities ↓","Assets ↑, Liabilities ↑","Capital ↓ only","No change"], a:0,
   why:"Cash (Asset) falls and Creditors (Liability) falls."},
  {q:"Cash sales ₹4,000. Impact?",
   o:["Assets ↑, Capital ↑","Assets ↑, Liabilities ↑","Liabilities ↑, Capital ↓","Assets ↓, Capital ↓"], a:0,
   why:"Revenue raises Capital; Cash (Asset) rises."},
  {q:"Owner withdraws ₹1,000 (drawings). Impact?",
   o:["Assets ↓, Capital ↓","Assets ↑, Capital ↑","Liabilities ↑, Capital ↓","No change"], a:0,
   why:"Drawings reduce both Cash (Asset) and Capital."},
  {q:"Bought machinery for cash ₹10,000. Impact?",
   o:["Assets ↑ and ↓ (No net change)","Assets ↑, Capital ↑","Assets ↑, Liabilities ↑","Assets ↓, Liabilities ↓"], a:0,
   why:"Machinery (Asset) increases, Cash (Asset) decreases. Total Assets remain unchanged."},
  {q:"Deposited cash into bank ₹5,000. Impact?",
   o:["Assets ↑ and ↓ (No net change)","Assets ↑, Liabilities ↑","Capital ↑, Assets ↓","Liabilities ↑, Capital ↓"], a:0,
   why:"Bank (Asset) rises, Cash (Asset) falls. Net Assets unchanged."},
  {q:"Paid rent in cash ₹2,000. Impact?",
   o:["Assets ↓, Capital ↓","Assets ↓, Liabilities ↓","Liabilities ↑, Capital ↓","Assets ↑, Capital ↑"], a:0,
   why:"Rent is an expense reducing Capital, and Cash (Asset) decreases."},
  {q:"Sold goods (cost ₹3,000) for cash ₹4,000. Impact?",
   o:["Assets ↑ by 1,000, Capital ↑ by 1,000","Assets ↑ by 4,000, Capital ↑ by 4,000","Assets ↑ by 3,000, Liabilities ↑ by 3,000","Assets ↓ by 1,000, Capital ↓ by 1,000"], a:0,
   why:"Cash rises by 4000, Stock falls by 3000 (Net Asset ↑ 1000). Profit of 1000 increases Capital."},
  {q:"Received commission in cash ₹500. Impact?",
   o:["Assets ↑, Capital ↑","Assets ↑, Liabilities ↑","Assets ↓, Capital ↓","Liabilities ↓, Capital ↑"], a:0,
   why:"Cash (Asset) increases. Commission (Revenue) increases Capital."},
  {q:"Owner took goods for personal use (cost ₹1,000). Impact?",
   o:["Assets ↓, Capital ↓","Assets ↓, Liabilities ↓","Capital ↓, Liabilities ↑","Assets ↑, Capital ↑"], a:0,
   why:"Stock (Asset) decreases. Drawings reduce Capital."},
  {q:"Paid salary outstanding from last year ₹3,000. Impact?",
   o:["Assets ↓, Liabilities ↓","Assets ↓, Capital ↓","Liabilities ↓, Capital ↑","Assets ↑, Liabilities ↑"], a:0,
   why:"Cash (Asset) decreases. Outstanding Salary (Liability) decreases."},
  {q:"Purchased goods on credit ₹8,000. Impact?",
   o:["Assets ↑, Liabilities ↑","Assets ↑, Capital ↑","Assets ↓, Liabilities ↓","Capital ↓, Liabilities ↑"], a:0,
   why:"Stock (Asset) increases. Creditors (Liability) increases."},
  {q:"Borrowed from bank ₹20,000. Impact?",
   o:["Assets ↑, Liabilities ↑","Assets ↑, Capital ↑","Liabilities ↑, Capital ↓","Assets ↓, Liabilities ↓"], a:0,
   why:"Bank balance (Asset) increases. Bank Loan (Liability) increases."},
  {q:"Charged depreciation on machinery ₹2,000. Impact?",
   o:["Assets ↓, Capital ↓","Assets ↓, Liabilities ↓","Assets ↑, Capital ↑","Capital ↓, Liabilities ↑"], a:0,
   why:"Machinery value (Asset) decreases. Expense reduces Capital."},
  {q:"Paid income tax from business cash ₹3,000. Impact?",
   o:["Assets ↓, Capital ↓","Assets ↓, Liabilities ↓","Capital ↓, Liabilities ↑","No change"], a:0,
   why:"Owner's income tax is Drawings, reducing Capital. Cash (Asset) decreases."},
  {q:"Received advance from customer ₹4,000. Impact?",
   o:["Assets ↑, Liabilities ↑","Assets ↑, Capital ↑","Assets ↓, Liabilities ↓","Liabilities ↑, Capital ↓"], a:0,
   why:"Cash (Asset) increases. Advance from Customer (Liability) increases."},
  {q:"Paid rent in advance ₹2,000. Impact?",
   o:["Assets ↑ and ↓ (No net change)","Assets ↓, Capital ↓","Assets ↓, Liabilities ↓","Assets ↑, Capital ↑"], a:0,
   why:"Prepaid Rent (Asset) increases, Cash (Asset) decreases."},
  {q:"Issued cheque to creditor ₹5,000. Impact?",
   o:["Assets ↓, Liabilities ↓","Assets ↑, Liabilities ↑","Assets ↓, Capital ↓","Liabilities ↓, Capital ↑"], a:0,
   why:"Bank (Asset) decreases. Creditors (Liability) decreases."},
  {q:"Accrued interest on investment ₹500. Impact?",
   o:["Assets ↑, Capital ↑","Assets ↑, Liabilities ↑","Assets ↓, Capital ↓","Liabilities ↓, Capital ↑"], a:0,
   why:"Accrued Interest (Asset) increases. Revenue increases Capital."},
  {q:"Unearned commission earned now ₹1,000. Impact?",
   o:["Liabilities ↓, Capital ↑","Assets ↑, Capital ↑","Assets ↓, Liabilities ↓","Assets ↑, Liabilities ↑"], a:0,
   why:"Liability (Unearned Income) decreases. Revenue increases Capital."},
  {q:"Sold goods on credit ₹6,000. Impact?",
   o:["Assets ↑, Capital ↑","Assets ↑, Liabilities ↑","Assets ↓, Capital ↓","Liabilities ↑, Capital ↓"], a:0,
   why:"Debtors (Asset) increases. Sales (Revenue) increases Capital."},
  {q:"Bad debts written off ₹300. Impact?",
   o:["Assets ↓, Capital ↓","Assets ↓, Liabilities ↓","Assets ↑, Capital ↑","Capital ↓, Liabilities ↑"], a:0,
   why:"Debtors (Asset) decreases. Loss reduces Capital."},
  {q:"Interest on Capital provided ₹1,500. Impact?",
   o:["No net change","Assets ↑, Capital ↑","Assets ↓, Capital ↓","Liabilities ↑, Capital ↓"], a:0,
   why:"Expense reduces Capital, but Capital itself increases. Net effect on equation is zero."},
  {q:"Cash stolen by employee ₹200. Impact?",
   o:["Assets ↓, Capital ↓","Assets ↓, Liabilities ↓","Liabilities ↑, Capital ↓","No change"], a:0,
   why:"Cash (Asset) decreases. Abnormal loss reduces Capital."}
];
let g={i:0,score:0};
function gRender(){
  if(g.i>=GAME.length){
    $("#gMission").innerHTML = `🏆 You scored <b>${g.score}/${GAME.length}</b>. ${g.score>=4?"Master class!":"Try again for full score."}`;
    $("#gOpts").innerHTML=""; if(g.score>=4) unlockBadge("game_master"); return;
  }
  const q=GAME[g.i];
  $("#gMis").textContent=g.i+1; $("#gScore").textContent=g.score;
  $("#gMission").textContent = "Mission "+(g.i+1)+": "+q.q;
  $("#gOpts").innerHTML="";
  // shuffle options once
  const idx=q.o.map((_,k)=>k).sort(()=>Math.random()-.5);
  idx.forEach(k=>{
    const b=document.createElement("button"); b.textContent=q.o[k];
    b.onclick=()=>{
      if(k===q.a){b.classList.add("correct"); sfx.good(); g.score++; bumpCombo(); awardXP(10,"Mission cleared"); toast(q.why,"win");}
      else {b.classList.add("wrong"); sfx.bad(); resetCombo(); toast("Hint: "+q.why,"bad");}
      $$("#gOpts button").forEach(x=>x.disabled=true);
      setTimeout(()=>{g.i++; gRender();}, 900);
    };
    $("#gOpts").appendChild(b);
  });
}
$("#gRestart").onclick=()=>{g={i:0,score:0}; gRender(); sfx.tap()};
gRender();

/* ============ MODULE 6: JOURNAL BUILDER PRO ============ */
const JBP = { dr:[], cr:[], narr:"" };
const JBP_LIB = [
  "Cash","Bank","Stock","Debtors","Mohan (Debtor)","Bills Receivable","Machinery","Furniture","Building","Land",
  "Capital","Drawings",
  "Bank Loan","Creditors","Bills Payable","Outstanding Salary",
  "Sales","Sales Returns","Commission Received","Interest Received",
  "Purchases","Purchase Returns","Salary","Rent","Wages","Carriage Inwards","Carriage Outwards","Discount Allowed","Discount Received","Insurance","Electricity"
];
const JBP_QUICK = [
  ["Owner capital ₹50,000",[{a:"Cash",amt:50000}],[{a:"Capital",amt:50000}]],
  ["Add capital by cheque ₹25,000",[{a:"Bank",amt:25000}],[{a:"Capital",amt:25000}]],
  ["Bank loan ₹20,000",[{a:"Cash",amt:20000}],[{a:"Bank Loan",amt:20000}]],
  ["Cash deposit to bank ₹10,000",[{a:"Bank",amt:10000}],[{a:"Cash",amt:10000}]],
  ["Withdraw from bank ₹5,000",[{a:"Cash",amt:5000}],[{a:"Bank",amt:5000}]],
  ["Cash sale ₹5,000",[{a:"Cash",amt:5000}],[{a:"Sales",amt:5000}]],
  ["Credit sale to Mohan ₹7,000",[{a:"Debtors",amt:7000}],[{a:"Sales",amt:7000}]],
  ["Cash purchase ₹4,000",[{a:"Purchases",amt:4000}],[{a:"Cash",amt:4000}]],
  ["Credit purchase ₹8,000",[{a:"Purchases",amt:8000}],[{a:"Creditors",amt:8000}]],
  ["Pay creditor ₹3,000",[{a:"Creditors",amt:3000}],[{a:"Cash",amt:3000}]],
  ["Receive from debtor ₹6,000",[{a:"Cash",amt:6000}],[{a:"Debtors",amt:6000}]],
  ["Purchase return ₹1,000",[{a:"Creditors",amt:1000}],[{a:"Purchase Returns",amt:1000}]],
  ["Sales return ₹500",[{a:"Sales Returns",amt:500}],[{a:"Debtors",amt:500}]],
  ["Pay rent ₹2,000",[{a:"Rent",amt:2000}],[{a:"Cash",amt:2000}]],
  ["Pay salary cheque ₹5,000",[{a:"Salary",amt:5000}],[{a:"Bank",amt:5000}]],
  ["Pay wages ₹1,800",[{a:"Wages",amt:1800}],[{a:"Cash",amt:1800}]],
  ["Electricity ₹800",[{a:"Electricity",amt:800}],[{a:"Cash",amt:800}]],
  ["Insurance ₹2,400",[{a:"Insurance",amt:2400}],[{a:"Cash",amt:2400}]],
  ["Buy machinery ₹15,000",[{a:"Machinery",amt:15000}],[{a:"Cash",amt:15000}]],
  ["Buy furniture cheque ₹10,000",[{a:"Furniture",amt:10000}],[{a:"Bank",amt:10000}]],
  ["Commission received ₹1,500",[{a:"Cash",amt:1500}],[{a:"Commission Received",amt:1500}]],
  ["Interest received cheque ₹600",[{a:"Bank",amt:600}],[{a:"Interest Received",amt:600}]],
  ["Discount allowed ₹200",[{a:"Discount Allowed",amt:200}],[{a:"Debtors",amt:200}]],
  ["Discount received ₹150",[{a:"Creditors",amt:150}],[{a:"Discount Received",amt:150}]],
  ["Depreciation ₹1,500",[{a:"Depreciation",amt:1500}],[{a:"Machinery",amt:1500}]],
  ["Bad debts ₹700",[{a:"Bad Debts",amt:700}],[{a:"Debtors",amt:700}]],
  ["Outstanding salary ₹3,000",[{a:"Salary",amt:3000}],[{a:"Outstanding Salary",amt:3000}]],
  ["Prepaid rent ₹6,000",[{a:"Prepaid Rent",amt:6000}],[{a:"Cash",amt:6000}]],
  ["Bill payable issued ₹4,000",[{a:"Creditors",amt:4000}],[{a:"Bills Payable",amt:4000}]],
  ["Bill receivable accepted ₹3,500",[{a:"Bills Receivable",amt:3500}],[{a:"Debtors",amt:3500}]],
  ["Drawings ₹4,000",[{a:"Drawings",amt:4000}],[{a:"Cash",amt:4000}]],
];
function jbpEng(){ return window.AcctEngine; }
function jbpTypeTag(t){ return {A:"ASSET",L:"LIAB",Q:"CAPITAL",E:"EXPENSE",R:"REVENUE",X:"DRAWINGS"}[t]||"?"; }
function jbpAdd(side, name){
  const list = JBP[side];
  if(list.some(r=>r.a===name)){ toast("Already added on "+side.toUpperCase(),"bad"); sfx.bad(); return; }
  list.push({a:name, amt:0});
  jbpRender();
  // focus the new amount input
  requestAnimationFrame(()=>{
    const inp = $(`#m6 .jbp-side[data-jbside="${side}"] .jbp-row:last-child input`);
    if(inp) inp.focus();
  });
}
function jbpRemove(side, idx){ JBP[side].splice(idx,1); jbpRender(); }
function jbpRow(side, r, idx){
  const e=jbpEng(); const t = e?e.classify(r.a):"A";
  const div=document.createElement("div"); div.className="jbp-row";
  div.innerHTML=`<div class="nm">${r.a}<span class="tt">${jbpTypeTag(t)}</span></div>
    <input type="number" min="0" step="1" value="${r.amt||""}" placeholder="₹"/>
    <button class="rm" title="Remove">✕</button>`;
  div.querySelector("input").addEventListener("input",ev=>{ r.amt=+ev.target.value||0; jbpTotals(); });
  div.querySelector(".rm").onclick=()=>{ jbpRemove(side,idx); sfx.tap(); };
  return div;
}
function jbpRender(){
  ["dr","cr"].forEach(side=>{
    const host = $(`#m6 .jbp-side[data-jbside="${side}"] .jbp-rows`);
    host.innerHTML="";
    if(!JBP[side].length){
      const em=document.createElement("div"); em.className="jbp-empty";
      em.textContent = side==="dr"?"No debit rows yet — search & add accounts.":"No credit rows yet — search & add accounts.";
      host.appendChild(em);
    }
    JBP[side].forEach((r,i)=>host.appendChild(jbpRow(side,r,i)));
  });
  jbpTotals();
}
function jbpTotals(){
  const dT=JBP.dr.reduce((s,r)=>s+(+r.amt||0),0);
  const cT=JBP.cr.reduce((s,r)=>s+(+r.amt||0),0);
  $("#jbpDrT").textContent="₹"+fmt(dT);
  $("#jbpCrT").textContent="₹"+fmt(cT);
  const e=jbpEng();
  let dA=0,dL=0,dQ=0;
  if(e){
    JBP.dr.forEach(r=>{ const d=e.eqDelta(e.classify(r.a),"dr",+r.amt||0); dA+=d.dA; dL+=d.dL; dQ+=d.dQ; });
    JBP.cr.forEach(r=>{ const d=e.eqDelta(e.classify(r.a),"cr",+r.amt||0); dA+=d.dA; dL+=d.dL; dQ+=d.dQ; });
  }
  const sign=v=>(v>0?"+":v<0?"-":"")+"₹"+fmt(Math.abs(v));
  $("#jbpDA").textContent=sign(dA); $("#jbpDA").className="v "+(dA>0?"up":dA<0?"down":"");
  $("#jbpDL").textContent=sign(dL); $("#jbpDL").className="v "+(dL>0?"up":dL<0?"down":"");
  $("#jbpDQ").textContent=sign(dQ); $("#jbpDQ").className="v "+(dQ>0?"up":dQ<0?"down":"");
  // status
  const st=$("#jbpStatus");
  if(!JBP.dr.length||!JBP.cr.length){ st.className="jbp-status"; st.textContent="Add at least one Dr and one Cr row."; return; }
  if(dT===0||cT===0){ st.className="jbp-status"; st.textContent="Enter amounts on both sides."; return; }
  if(dT!==cT){ st.className="jbp-status bad"; st.textContent=`⚠ Dual aspect broken: Dr ₹${fmt(dT)} ≠ Cr ₹${fmt(cT)} (off by ₹${fmt(Math.abs(dT-cT))}).`; return; }
  const eqOk = Math.abs(dA-(dL+dQ))<0.001;
  if(!eqOk){ st.className="jbp-status bad"; st.textContent=`⚠ Equation broken: ΔA ${sign(dA)} ≠ ΔL ${sign(dL)} + ΔC ${sign(dQ)}.`; return; }
  st.className="jbp-status ok";
  st.innerHTML=`✓ Balanced. ΔA ${sign(dA)} = ΔL ${sign(dL)} + ΔC ${sign(dQ)}. Ready to post.`;
}
function jbpSuggest(q){
  const host=$("#jbpSuggest");
  q=(q||"").trim().toLowerCase();
  if(!q){ host.classList.remove("show"); host.innerHTML=""; return; }
  const e=jbpEng();
  const hits = JBP_LIB.filter(n=>n.toLowerCase().includes(q)).slice(0,8);
  if(!hits.length){ host.innerHTML=`<button disabled style="opacity:.5">No match — add custom: <b>${q}</b></button>`; host.classList.add("show"); return; }
  host.innerHTML = hits.map(n=>{
    const t=e?e.classify(n):"A";
    return `<button data-pick="${n}"><span>${n}</span><span class="ttag">${jbpTypeTag(t)}</span></button>`;
  }).join("");
  host.classList.add("show");
}
$("#jbpSearch").addEventListener("input",ev=>jbpSuggest(ev.target.value));
$("#jbpSearch").addEventListener("focus",ev=>jbpSuggest(ev.target.value));
$("#jbpSuggest").addEventListener("click",ev=>{
  const b=ev.target.closest("button[data-pick]"); if(!b) return;
  const name=b.dataset.pick;
  // ask which side via a tiny prompt-less heuristic: add to side whose total is smaller OR default to Dr if both empty
  const dT=JBP.dr.reduce((s,r)=>s+(+r.amt||0),0);
  const cT=JBP.cr.reduce((s,r)=>s+(+r.amt||0),0);
  // Smart default by natural side
  const e=jbpEng();
  let side="dr";
  if(e){ const nat=e.naturalSide(e.classify(name)); side = nat.toLowerCase(); }
  // If amounts already exist, push to lighter side
  if(dT||cT){ side = dT<=cT ? "dr":"cr"; }
  jbpAdd(side,name);
  $("#jbpSearch").value=""; $("#jbpSuggest").classList.remove("show");
  sfx.tap();
});
document.addEventListener("click",ev=>{
  if(!ev.target.closest(".jbp-search")) $("#jbpSuggest").classList.remove("show");
});
// Quick-fill chips
(function(){
  const host=$("#jbpQuick"); host.innerHTML="";
  JBP_QUICK.forEach(([lbl,dr,cr])=>{
    const b=document.createElement("button"); b.textContent="+ "+lbl;
    b.onclick=()=>{ JBP.dr=dr.map(x=>({...x})); JBP.cr=cr.map(x=>({...x})); $("#jbpNarr").value=lbl; jbpRender(); sfx.pop(); };
    host.appendChild(b);
  });
})();
$("#jbpClear").onclick=()=>{ JBP.dr=[]; JBP.cr=[]; $("#jbpNarr").value=""; jbpRender(); sfx.tap(); };
$("#jbpGoSim").onclick=()=>{ go("m7"); };
$("#jbpPost").onclick=()=>{
  const narr=$("#jbpNarr").value.trim() || "Manual journal entry";
  if(!JBP.dr.length||!JBP.cr.length){ toast("Need both Dr and Cr rows","bad"); sfx.bad(); return; }
  if(JBP.dr.some(r=>!r.amt)||JBP.cr.some(r=>!r.amt)){ toast("Fill every amount","bad"); sfx.bad(); return; }
  // simPost is wrapped by AcctEngine — it validates dual aspect + equation
  const ok = window.simPost(narr, JBP.dr.map(r=>({...r})), JBP.cr.map(r=>({...r})));
  if(ok!==false){
    confetti(120); sfx.good(); bumpCombo(); awardXP(25,"Journal posted");
    toast("Posted to Ledger & Balance Sheet ✓","win");
    JBP.dr=[]; JBP.cr=[]; $("#jbpNarr").value=""; jbpRender();
  }
};
requestAnimationFrame(()=>jbpRender());

/* ============ MODULE 7: SIMULATOR ============ */
const SIM = { journal:[], ledger:{} , n:0};
const ACC_TYPE = {Cash:"A", Machinery:"A", Stock:"A", Capital:"Q", "Bank Loan":"L", Sales:"R", Rent:"E", Creditors:"L", Drawings:"Q"};
function simPost(label, dr, cr){
  SIM.n++; SIM.journal.push({n:SIM.n,label,dr,cr});
  // ledger
  function apply(name,type,amt,side){
    if(!SIM.ledger[name]) SIM.ledger[name]={type, bal:0};
    // For A,E: Dr+ Cr-; For L,R,Q: Cr+ Dr-
    const t=ACC_TYPE[name];
    const sign = (t==="A"||t==="E") ? (side==="dr"?1:-1) : (side==="cr"?1:-1);
    SIM.ledger[name].bal += sign*amt;
  }
  dr.forEach(x=>apply(x.a,x.t,x.amt,"dr"));
  cr.forEach(x=>apply(x.a,x.t,x.amt,"cr"));
  simRender();
}
function simRender(){
  // journal
  $("#simJournal").innerHTML = SIM.journal.map(j=>{
    const dr=j.dr.map(x=>`${x.a} A/c Dr.`).join("<br/>");
    const cr=j.cr.map(x=>`&nbsp;&nbsp;To ${x.a} A/c`).join("<br/>");
    const drAmt=j.dr.reduce((s,x)=>s+x.amt,0), crAmt=j.cr.reduce((s,x)=>s+x.amt,0);
    return `<tr><td>${j.n}</td><td>${dr}<br/>${cr}<br/><small style="color:var(--ink-dim)">(${j.label})</small></td><td class="amt">${drAmt.toLocaleString("en-IN")}</td><td class="amt">${crAmt.toLocaleString("en-IN")}</td></tr>`;
  }).join("") || `<tr><td colspan="4" style="text-align:center;color:var(--ink-dim);padding:20px">No entries yet — tap actions above.</td></tr>`;
  // ledger
  $("#simLedger").innerHTML = Object.entries(SIM.ledger).map(([n,o])=>{
    return `<tr><td>${n}</td><td><small>${({A:"Asset",L:"Liability",E:"Expense",R:"Revenue",Q:"Equity"})[o.type]||""}</small></td><td class="amt">${Math.round(o.bal).toLocaleString("en-IN")}</td></tr>`;
  }).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--ink-dim);padding:20px">—</td></tr>`;
  // balance sheet
  let assets=0,lia=0,cap=0,exp=0,rev=0;
  Object.entries(SIM.ledger).forEach(([n,o])=>{
    if(o.type==="A") assets+=o.bal;
    else if(o.type==="L") lia+=o.bal;
    else if(o.type==="Q") cap+=o.bal;
    else if(o.type==="E") exp+=o.bal;
    else if(o.type==="R") rev+=o.bal;
  });
  const adjCap = cap + rev - exp; // P&L flows to capital
  const liaList = Object.entries(SIM.ledger).filter(([n,o])=>o.type==="L").map(([n,o])=>`<div class="ln"><span>${n}</span><span>${Math.round(o.bal).toLocaleString("en-IN")}</span></div>`).join("");
  const astList = Object.entries(SIM.ledger).filter(([n,o])=>o.type==="A").map(([n,o])=>`<div class="ln"><span>${n}</span><span>${Math.round(o.bal).toLocaleString("en-IN")}</span></div>`).join("");
  $("#bsLia").innerHTML = `<div class="ln"><span>Capital (adj. for P&L)</span><span>${Math.round(adjCap).toLocaleString("en-IN")}</span></div>`+liaList;
  $("#bsAst").innerHTML = astList;
  const liaT = adjCap + lia, astT = assets;
  $("#bsLiaT").textContent = Math.round(liaT).toLocaleString("en-IN");
  $("#bsAstT").textContent = Math.round(astT).toLocaleString("en-IN");
  const ok = Math.abs(liaT - astT) < 0.5;
  $("#simBar").style.background = ok? "var(--grad-2)" : "linear-gradient(90deg,#ff5577,#ffb547)";
  $("#simStatus").className="balance-status"+(ok?"":" bad");
  $("#simStatus").textContent = ok? "Balanced ✓" : "Off by ₹"+Math.abs(Math.round(liaT-astT)).toLocaleString("en-IN");
}
const SIM_ACTIONS = {
  capital:()=>simPost("Owner brought capital ₹50,000",[{a:"Cash",amt:50000}],[{a:"Capital",amt:50000}]),
  addCap:()=>simPost("Additional capital by cheque ₹25,000",[{a:"Bank",amt:25000}],[{a:"Capital",amt:25000}]),
  loan:()=>simPost("Bank loan received ₹20,000",[{a:"Cash",amt:20000}],[{a:"Bank Loan",amt:20000}]),
  deposit:()=>simPost("Cash deposited into bank ₹10,000",[{a:"Bank",amt:10000}],[{a:"Cash",amt:10000}]),
  withdrawBank:()=>simPost("Cash withdrawn from bank ₹5,000",[{a:"Cash",amt:5000}],[{a:"Bank",amt:5000}]),
  buyM:()=>simPost("Bought machinery ₹15,000 (cash)",[{a:"Machinery",amt:15000}],[{a:"Cash",amt:15000}]),
  buyFurnB:()=>simPost("Bought furniture ₹10,000 (cheque)",[{a:"Furniture",amt:10000}],[{a:"Bank",amt:10000}]),
  buyBuild:()=>simPost("Bought building ₹60,000 (cheque)",[{a:"Building",amt:60000}],[{a:"Bank",amt:60000}]),
  creditP:()=>simPost("Credit purchase ₹5,000",[{a:"Purchases",amt:5000}],[{a:"Creditors",amt:5000}]),
  cashP:()=>simPost("Cash purchase ₹4,000",[{a:"Purchases",amt:4000}],[{a:"Cash",amt:4000}]),
  sale:()=>simPost("Cash sale ₹8,000",[{a:"Cash",amt:8000}],[{a:"Sales",amt:8000}]),
  creditSale:()=>simPost("Credit sale to Mohan ₹7,000",[{a:"Debtors",amt:7000}],[{a:"Sales",amt:7000}]),
  recvDeb:()=>simPost("Received from Mohan ₹6,000",[{a:"Cash",amt:6000}],[{a:"Debtors",amt:6000}]),
  payCr:()=>simPost("Paid creditor ₹3,000",[{a:"Creditors",amt:3000}],[{a:"Cash",amt:3000}]),
  purRet:()=>simPost("Goods returned to creditor ₹1,000",[{a:"Creditors",amt:1000}],[{a:"Purchase Returns",amt:1000}]),
  salRet:()=>simPost("Sales return from Mohan ₹500",[{a:"Sales Returns",amt:500}],[{a:"Debtors",amt:500}]),
  rent:()=>simPost("Paid rent ₹2,000",[{a:"Rent",amt:2000}],[{a:"Cash",amt:2000}]),
  salary:()=>simPost("Paid salary ₹5,000 (cheque)",[{a:"Salary",amt:5000}],[{a:"Bank",amt:5000}]),
  wages:()=>simPost("Paid wages ₹1,800",[{a:"Wages",amt:1800}],[{a:"Cash",amt:1800}]),
  elec:()=>simPost("Electricity bill ₹800",[{a:"Electricity",amt:800}],[{a:"Cash",amt:800}]),
  ins:()=>simPost("Insurance premium ₹2,400",[{a:"Insurance",amt:2400}],[{a:"Cash",amt:2400}]),
  comm:()=>simPost("Commission received ₹1,500",[{a:"Cash",amt:1500}],[{a:"Commission Received",amt:1500}]),
  intRcvd:()=>simPost("Interest received ₹600 (cheque)",[{a:"Bank",amt:600}],[{a:"Interest Received",amt:600}]),
  discAllow:()=>simPost("Discount allowed to debtor ₹200",[{a:"Discount Allowed",amt:200}],[{a:"Debtors",amt:200}]),
  discRecv:()=>simPost("Discount received from creditor ₹150",[{a:"Creditors",amt:150}],[{a:"Discount Received",amt:150}]),
  dep:()=>simPost("Depreciation on machinery ₹1,500",[{a:"Depreciation",amt:1500}],[{a:"Machinery",amt:1500}]),
  bad:()=>simPost("Bad debts written off ₹700",[{a:"Bad Debts",amt:700}],[{a:"Debtors",amt:700}]),
  outSal:()=>simPost("Salary outstanding ₹3,000",[{a:"Salary",amt:3000}],[{a:"Outstanding Salary",amt:3000}]),
  prepRent:()=>simPost("Rent paid in advance ₹6,000",[{a:"Prepaid Rent",amt:6000}],[{a:"Cash",amt:6000}]),
  billPay:()=>simPost("Issued Bill Payable to creditor ₹4,000",[{a:"Creditors",amt:4000}],[{a:"Bills Payable",amt:4000}]),
  billRcv:()=>simPost("Accepted Bill Receivable from Mohan ₹3,500",[{a:"Bills Receivable",amt:3500}],[{a:"Debtors",amt:3500}]),
  drawing:()=>simPost("Owner drawings ₹4,000 (cash)",[{a:"Drawings",amt:4000}],[{a:"Cash",amt:4000}]),
  reset:()=>{SIM.journal=[];SIM.ledger={};SIM.n=0;simRender();}
};
$$("#m7 [data-sim]").forEach(b=>b.onclick=()=>{SIM_ACTIONS[b.dataset.sim](); sfx.pop(); awardXP(6,"Posted entry"); if(SIM.journal.length>=5) unlockBadge("simulator");});
simRender();

/* ============ MODULE 8: WHAT IF ============ */
function whatif(){
  const a=+$("#sAst").value, l=+$("#sLia").value;
  const cap=a-l;
  $("#vAst").textContent = a.toLocaleString("en-IN");
  $("#vLia").textContent = l.toLocaleString("en-IN");
  $("#vCap").textContent = cap.toLocaleString("en-IN");
  let msg="Healthy net worth ✓", cls="";
  if(cap<0){ msg="🚨 Capital is NEGATIVE — liabilities exceed assets. Business is insolvent."; cls="bad"; }
  else if(cap<a*0.2){ msg="⚠ Highly leveraged — most assets are financed by liabilities."; cls="bad"; }
  $("#vStatus").textContent=msg; $("#vStatus").className="balance-status center"+(cls?" bad":"");
  $("#vNote").innerHTML = cap<0 ? "Add assets or pay down liabilities. Capital must stay positive for a healthy business."
       : cap<a*0.2 ? "Try lowering liabilities — feel the equation breathe."
       : "Strong owner equity. Lower liability share = lower risk.";
}
$("#sAst").oninput=$("#sLia").oninput=whatif; whatif();

/* ============ MODULE 10: BENTO ============ */
const BENTO = [
  {cls:"s1",ttl:"The Accounting Equation", desc:"Assets = Capital + Liabilities. Always. Forever.",
    more:"Every transaction touches at least two accounts and keeps this equation balanced. Example: take a ₹10k loan → Cash +10k, Loan +10k."},
  {cls:"s2",ttl:"Golden Rules (Modern)", desc:"A·E ↑Dr ↓Cr · L·R·Q ↑Cr ↓Dr",
    more:"Assets & Expenses live on the Debit side when they grow. Liabilities, Revenue & Equity live on the Credit side."},
  {cls:"s3",ttl:"Personal Account Rule (Traditional)", desc:"Debit the receiver, Credit the giver.",
    more:"Used in traditional Indian classification for personal accounts (people, firms)."},
  {cls:"s4",ttl:"Real Account Rule", desc:"Debit what comes in, Credit what goes out.",
    more:"For assets (cash, machinery, goods)."},
  {cls:"s5",ttl:"Nominal Account Rule", desc:"Debit all expenses & losses, Credit all incomes & gains.",
    more:"For nominal accounts (rent, salary, sales)."},
  {cls:"s6",ttl:"Journal → Ledger → Trial Balance → BS", desc:"The full flow of accounting in one breath.",
    more:"Record (Journal) → Classify (Ledger) → Summarise (Trial Balance) → Report (Financial Statements)."},
  {cls:"s7",ttl:"Mini Quiz", desc:"Tap to reveal: ‘Salary paid in cash’ — Dr/Cr?",
    more:"<b>Debit Salary, Credit Cash.</b> Expense rises (Dr), Asset falls (Cr)."},
  {cls:"s8",ttl:"Concept Recap (Capital, Drawings, Profit)", desc:"Capital is what the owner invests. Drawings reduce it. Profits add to it.",
    more:"Closing Capital = Opening Capital + Additional Capital + Profit − Drawings − Loss. This is why P&L flows back into Capital on the Balance Sheet."},
];
const bento=$("#bento");
BENTO.forEach(c=>{
  const el=document.createElement("div");
  el.className="bcell "+c.cls;
  el.innerHTML=`<div class="ttl">${c.ttl}</div><div class="desc">${c.desc}</div><div class="more">${c.more}</div>`;
  el.onclick=()=>{el.classList.toggle("open"); sfx.tap(); awardXP(2,"Cheat sheet read");};
  bento.appendChild(el);
});

/* ============ CINEMA ============ */
function showCinema(){
  $("#cinema").classList.add("show");
  confetti(220); sfx.level();
}
$("#cinemaClose").onclick=()=>$("#cinema").classList.remove("show");
$("#cinemaShare").onclick=async ()=>{
  const txt = `I just escaped rote learning in Accounting with the ACCOUNTING UNIVERSE 🌌 — by PP Creations.`;
  try{ if(navigator.share) await navigator.share({title:"Accounting Universe", text:txt}); else { await navigator.clipboard.writeText(txt); toast("Copied to clipboard ✓","win"); } }catch(e){}
};

/* ============ KEYBOARD A11y (Input-Focus Protection) ============ */
function _isEditing(){
  const el=document.activeElement;
  if(!el) return false;
  const tag=(el.tagName||"").toLowerCase();
  if(tag==="input"||tag==="textarea"||tag==="select") return true;
  if(el.isContentEditable) return true;
  return false;
}
document.addEventListener("keydown",e=>{
  if(_isEditing()) return;            // never hijack typing
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key>="1"&&e.key<="9"){ go("m"+e.key); }
  else if(e.key==="0"){ go("m10"); }
  else if(e.key.toLowerCase()==="h"){ go("home"); }
});

/* ============ PERSISTENT SCREEN STATE ============ */
try{
  const _last=sessionStorage.getItem("au:screen");
  if(_last) setTimeout(()=>{ try{ go(_last); }catch(_){ } },0);
  const _origGo=window.go;
  if(typeof _origGo==="function"){
    window.go=function(id){ try{ sessionStorage.setItem("au:screen",id); }catch(_){ } return _origGo(id); };
  }
}catch(_){}

/* ============ INIT TOAST ============ */
setTimeout(()=>toast("Tip: press 1–9 or 0 to jump modules · h for home (typing is safe)"), 600);


/* ============ MODULE 11: TRIAL BALANCE ============ */
const TB_ITEMS = [
  {n:"Cash in Hand", s:"dr"}, {n:"Cash at Bank", s:"dr"}, {n:"Machinery", s:"dr"},
  {n:"Furniture", s:"dr"}, {n:"Debtors", s:"dr"}, {n:"Purchases", s:"dr"},
  {n:"Sales Return", s:"dr"}, {n:"Wages", s:"dr"}, {n:"Salaries", s:"dr"},
  {n:"Rent Paid", s:"dr"}, {n:"Discount Allowed", s:"dr"}, {n:"Bad Debts", s:"dr"},
  {n:"Drawings", s:"dr"}, {n:"Opening Stock", s:"dr"}, {n:"Goodwill", s:"dr"},
  {n:"Patents", s:"dr"}, {n:"Carriage Inwards", s:"dr"}, {n:"Carriage Outwards", s:"dr"},
  {n:"Insurance Premium", s:"dr"}, {n:"Advertisement", s:"dr"}, {n:"Bills Receivable", s:"dr"},
  {n:"Input CGST", s:"dr"}, {n:"Input SGST", s:"dr"}, {n:"Input IGST", s:"dr"},
  {n:"Creditors", s:"cr"}, {n:"Sales", s:"cr"}, {n:"Purchase Return", s:"cr"},
  {n:"Capital", s:"cr"}, {n:"Bank Overdraft", s:"cr"}, {n:"Bank Loan", s:"cr"},
  {n:"Discount Received", s:"cr"}, {n:"Commission Received", s:"cr"}, {n:"Rent Received", s:"cr"},
  {n:"Interest Received", s:"cr"}, {n:"Outstanding Salaries", s:"cr"}, {n:"Provision for Bad Debts", s:"cr"},
  {n:"Provision for Dep", s:"cr"}, {n:"Bills Payable", s:"cr"}, {n:"Output CGST", s:"cr"},
  {n:"Output SGST", s:"cr"}, {n:"Output IGST", s:"cr"}
];

let tbInitialized = false;

function tbInit(){
  if(tbInitialized) return;
  tbInitialized = true;
  const pool = $("#m11Pool");
  if(!pool) return;
  pool.innerHTML = "";
  
  const arr = TB_ITEMS.map(x=>({...x})).sort(()=>Math.random()-.5);
  arr.forEach(it=>{
    const c = document.createElement("div");
    c.className = "chip";
    c.dataset.side = it.s;
    c.dataset.name = it.n;
    c.innerHTML = it.n;
    pool.appendChild(c);
    
    makeDraggable(c, bucket=>{
      if(bucket.classList.contains("dz")){
        bucket.querySelector(".dz-chips").appendChild(c);
        sfx.pop();
      }
    });
  });
}

$("#m11Check").onclick = ()=>{
  let correct = 0;
  let total = 0;
  $$("#m11 .dz .chip").forEach(c=>{
    total++;
    const pSide = c.closest(".dz").dataset.side;
    if(pSide === c.dataset.side){
      c.classList.add("correct");
      c.classList.remove("wrong");
      correct++;
    } else {
      c.classList.add("wrong");
      c.classList.remove("correct");
    }
  });
  if(total===0) {
    toast("Drag accounts to Dr or Cr first!","bad");
    return;
  }
  if(correct === total) {
    sfx.win();
    toast(`Perfect! All ${correct} accounts classified correctly.`,"good");
    awardXP(10, "Trial Balance Master");
  } else {
    sfx.bad();
    toast(`You got ${correct} out of ${total} correct. Check the red ones.`,"bad");
  }
};

$("#m11Reset").onclick = ()=>{
  tbInitialized = false;
  $$("#m11 .dz .dz-chips").forEach(z=>z.innerHTML="");
  tbInit();
  sfx.tap();
};

tbInit(); // Initialize on page load like the other modules!

/* ============ MODULE 12: FINAL ACCOUNTS (Trading + P&L + Balance Sheet) ============ */
/* Rule (never breaks):
   Trading A/c Dr : Opening Stock, Purchases (−Returns), Wages, Carriage Inwards, Direct Expenses, Freight
   Trading A/c Cr : Sales (−Returns), Closing Stock
   P&L A/c    Dr : Salary, Rent, Office Exp, Depreciation, Discount Allowed, Advertisement, Insurance
   P&L A/c    Cr : Commission Received, Discount Received, Interest Received, Rent Received
   B/Sheet Lia   : Capital, Loans, Creditors, Bills Payable, Outstanding Expenses
   B/Sheet Asset : Cash, Bank, Debtors, Closing Stock, Machinery, Furniture, Building, Prepaid
*/
const FA_ITEMS = [
  {n:"Opening Stock",      amt:15000, h:"trad-dr"},
  {n:"Purchases",          amt:80000, h:"trad-dr"},
  {n:"Wages (Direct)",     amt: 6000, h:"trad-dr"},
  {n:"Carriage Inwards",   amt: 2000, h:"trad-dr"},
  {n:"Sales",              amt:140000,h:"trad-cr"},
  {n:"Closing Stock",      amt:20000, h:"trad-cr", alsoBS:"bs-ast"},
  {n:"Salary",             amt:12000, h:"pl-dr"},
  {n:"Rent (Office)",      amt: 6000, h:"pl-dr"},
  {n:"Depreciation",       amt: 3000, h:"pl-dr"},
  {n:"Discount Allowed",   amt: 1000, h:"pl-dr"},
  {n:"Commission Received",amt: 4000, h:"pl-cr"},
  {n:"Discount Received",  amt: 2000, h:"pl-cr"},
  {n:"Capital",            amt:100000,h:"bs-lia"},
  {n:"Bank Loan",          amt: 30000,h:"bs-lia"},
  {n:"Creditors",          amt: 18000,h:"bs-lia"},
  {n:"O/s Salary",         amt:  2000,h:"bs-lia"},
  {n:"Cash in Hand",       amt: 10000,h:"bs-ast"},
  {n:"Bank Balance",       amt: 25000,h:"bs-ast"},
  {n:"Debtors",            amt: 22000,h:"bs-ast"},
  {n:"Machinery",          amt: 60000,h:"bs-ast"},
  {n:"Furniture",          amt: 14000,h:"bs-ast"},
];
const FA = {ok:0,bad:0};
function faInit(){
  FA.ok=0; FA.bad=0; updateFAHud();
  $$("#m12 .dz .dz-chips").forEach(z=>z.innerHTML="");
  $("#faReport").hidden = true;
  const pool=$("#faPool"); pool.innerHTML="";
  // shuffle a copy
  const items=[...FA_ITEMS].sort(()=>Math.random()-.5);
  items.forEach(it=>{
    const c=document.createElement("div");
    const typ = window.AcctEngine ? window.AcctEngine.classify(it.n) : "A";
    c.className="chip"; c.dataset.name=it.n; c.dataset.amt=it.amt; c.dataset.home=it.h; if(it.alsoBS) c.dataset.also=it.alsoBS;
    if (typeof _typeDesc === "function") c.dataset.tooltip = _typeDesc(typ);
    c.innerHTML = `${it.n} <small style="opacity:.65;font-family:var(--font-mono)">₹${it.amt.toLocaleString("en-IN")}</small>`;
    makeDraggable(c, bucket=>{
      const dest = bucket.dataset.fa;
      const correct = (dest===c.dataset.home) || (c.dataset.also && dest===c.dataset.also);
      if(correct){
        bucket.querySelector(".dz-chips").appendChild(c);
        c.classList.add("correct"); FA.ok++;
        sfx.good(); bumpCombo(); awardXP(6,"Right house ✓");
      } else {
        c.classList.add("wrong"); FA.bad++;
        sfx.bad(); resetCombo();
        toast("Wrong house — "+c.dataset.name+" belongs in: "+labelOf(c.dataset.home),"bad");
        setTimeout(()=>c.classList.remove("wrong"), 500);
      }
      updateFAHud();
    });
    pool.appendChild(c);
  });
  updateFAHud();
}
function labelOf(h){return ({"trad-dr":"Trading Dr","trad-cr":"Trading Cr","pl-dr":"P&L Dr","pl-cr":"P&L Cr","bs-lia":"B/S Liabilities","bs-ast":"B/S Assets"})[h]||h}
function updateFAHud(){
  $("#faOK").textContent=FA.ok; $("#faBad").textContent=FA.bad;
  $("#faRem").textContent = $$("#faPool .chip").length;
}
function faPrepare(){
  // Use the canonical correct allocation to compute statements (rule never breaks).
  const sum = h => FA_ITEMS.filter(i=>i.h===h).reduce((s,i)=>s+i.amt,0);
  const closingStock = FA_ITEMS.find(i=>i.n==="Closing Stock").amt;
  // Trading
  const tradDr = FA_ITEMS.filter(i=>i.h==="trad-dr");
  const tradCr = FA_ITEMS.filter(i=>i.h==="trad-cr");
  const tradDrT = tradDr.reduce((s,i)=>s+i.amt,0);
  const tradCrT = tradCr.reduce((s,i)=>s+i.amt,0);
  let rows=[];
  const maxL = Math.max(tradDr.length, tradCr.length);
  for(let i=0;i<maxL;i++){
    const a=tradDr[i], b=tradCr[i];
    rows.push(`<tr><td>${a?"To "+a.n:""}</td><td class="right">${a?a.amt.toLocaleString("en-IN"):""}</td><td>${b?"By "+b.n:""}</td><td class="right">${b?b.amt.toLocaleString("en-IN"):""}</td></tr>`);
  }
  const gp = tradCrT - tradDrT;
  const gpRow = gp>=0
    ? `<tr><td><b>To Gross Profit c/d</b></td><td class="right"><b>${gp.toLocaleString("en-IN")}</b></td><td></td><td class="right"></td></tr>`
    : `<tr><td></td><td class="right"></td><td><b>By Gross Loss c/d</b></td><td class="right"><b>${Math.abs(gp).toLocaleString("en-IN")}</b></td></tr>`;
  rows.push(gpRow);
  const totT = Math.max(tradDrT + Math.max(gp,0), tradCrT + Math.max(-gp,0));
  rows.push(`<tr style="font-weight:700;background:rgba(255,255,255,.04)"><td>Total</td><td class="right">${totT.toLocaleString("en-IN")}</td><td>Total</td><td class="right">${totT.toLocaleString("en-IN")}</td></tr>`);
  $("#faTrad").innerHTML = rows.join("");
  $("#faGP").textContent = (gp>=0?"Gross Profit":"Gross Loss") + " = ₹" + Math.abs(gp).toLocaleString("en-IN") + "  →  carried to P&L A/c";
  $("#faGP").className = "report-foot"+(gp<0?" loss":"");

  // P&L
  const plDr = FA_ITEMS.filter(i=>i.h==="pl-dr");
  const plCr = [...FA_ITEMS.filter(i=>i.h==="pl-cr")];
  // bring GP from trading into P&L credit (or GL to Dr)
  if(gp>=0) plCr.unshift({n:"Gross Profit b/d", amt:gp});
  else plDr.unshift({n:"Gross Loss b/d", amt:-gp});
  const plDrT = plDr.reduce((s,i)=>s+i.amt,0);
  const plCrT = plCr.reduce((s,i)=>s+i.amt,0);
  let prows=[];
  const m2 = Math.max(plDr.length, plCr.length);
  for(let i=0;i<m2;i++){
    const a=plDr[i], b=plCr[i];
    prows.push(`<tr><td>${a?"To "+a.n:""}</td><td class="right">${a?a.amt.toLocaleString("en-IN"):""}</td><td>${b?"By "+b.n:""}</td><td class="right">${b?b.amt.toLocaleString("en-IN"):""}</td></tr>`);
  }
  const np = plCrT - plDrT;
  const npRow = np>=0
    ? `<tr><td><b>To Net Profit (to Capital)</b></td><td class="right"><b>${np.toLocaleString("en-IN")}</b></td><td></td><td class="right"></td></tr>`
    : `<tr><td></td><td class="right"></td><td><b>By Net Loss (from Capital)</b></td><td class="right"><b>${Math.abs(np).toLocaleString("en-IN")}</b></td></tr>`;
  prows.push(npRow);
  const totPL = Math.max(plDrT + Math.max(np,0), plCrT + Math.max(-np,0));
  prows.push(`<tr style="font-weight:700;background:rgba(255,255,255,.04)"><td>Total</td><td class="right">${totPL.toLocaleString("en-IN")}</td><td>Total</td><td class="right">${totPL.toLocaleString("en-IN")}</td></tr>`);
  $("#faPL").innerHTML = prows.join("");
  $("#faNP").textContent = (np>=0?"Net Profit":"Net Loss") + " = ₹" + Math.abs(np).toLocaleString("en-IN") + "  →  added to / deducted from Capital";
  $("#faNP").className = "report-foot"+(np<0?" loss":"");

  // Balance Sheet
  const bsLia = FA_ITEMS.filter(i=>i.h==="bs-lia").map(i=>({...i}));
  const cap = bsLia.find(i=>i.n==="Capital");
  if(cap) cap.amt += np; // P&L to capital
  const bsAst = FA_ITEMS.filter(i=>i.h==="bs-ast").map(i=>({...i}));
  // closing stock also appears as asset (alsoBS) — already in bs-ast list? No, h is trad-cr, so add it:
  if(!bsAst.find(i=>i.n==="Closing Stock")) bsAst.push({n:"Closing Stock", amt:closingStock});
  const liaT = bsLia.reduce((s,i)=>s+i.amt,0);
  const astT = bsAst.reduce((s,i)=>s+i.amt,0);
  let brows=[];
  const m3 = Math.max(bsLia.length, bsAst.length);
  for(let i=0;i<m3;i++){
    const a=bsLia[i], b=bsAst[i];
    const aN = a ? (a.n==="Capital" ? `${a.n} (incl. ${np>=0?"+":""}${np.toLocaleString("en-IN")} P&L)` : a.n) : "";
    brows.push(`<tr><td>${aN}</td><td class="right">${a?a.amt.toLocaleString("en-IN"):""}</td><td>${b?b.n:""}</td><td class="right">${b?b.amt.toLocaleString("en-IN"):""}</td></tr>`);
  }
  brows.push(`<tr style="font-weight:700;background:rgba(255,255,255,.04)"><td>Total</td><td class="right">${liaT.toLocaleString("en-IN")}</td><td>Total</td><td class="right">${astT.toLocaleString("en-IN")}</td></tr>`);
  $("#faBS").innerHTML = brows.join("");
  const balanced = Math.abs(liaT-astT) < 0.5;
  $("#faBSTot").textContent = balanced ? `✓ Balanced: Total Liabilities = Total Assets = ₹${liaT.toLocaleString("en-IN")}  (Rule never breaks)` : `✗ Off by ₹${Math.abs(liaT-astT).toLocaleString("en-IN")}`;
  $("#faBSTot").className = "report-foot"+(balanced?"":" loss");
  $("#faReport").hidden = false;
  if(balanced){ confetti(160); awardXP(40,"Final Accounts prepared"); unlockBadge("final_accounts"); }
}
$("#faReset").onclick=()=>{faInit(); sfx.tap()};
$("#faPrepare").onclick=()=>{faPrepare(); sfx.good();};
faInit();

/* ============ MODULE 13: BALANCE OF ACCOUNT (Dr/Cr) ============ */
const BAL = [
  {n:"Cash A/c",       ty:"Asset",     side:"dr", why:"Asset accounts have a <b>Debit</b> balance. Cash received is Dr, cash paid is Cr — receipts usually exceed payments."},
  {n:"Bank A/c",       ty:"Asset",     side:"dr", why:"Asset → natural <b>Dr</b> balance. (If overdrawn, it becomes a Cr balance = Bank Overdraft, a Liability.)"},
  {n:"Debtors A/c",    ty:"Asset",     side:"dr", why:"Customers owe us → Asset → <b>Dr</b> balance."},
  {n:"Stock A/c",      ty:"Asset",     side:"dr", why:"Goods we own → Asset → <b>Dr</b> balance."},
  {n:"Machinery A/c",  ty:"Asset",     side:"dr", why:"Fixed Asset → <b>Dr</b> balance."},
  {n:"Capital A/c",    ty:"Equity",    side:"cr", why:"Owner's claim on business → <b>Cr</b> balance. Increases by profit & fresh capital, decreases by drawings/loss."},
  {n:"Bank Loan A/c",  ty:"Liability", side:"cr", why:"We owe the bank → Liability → <b>Cr</b> balance."},
  {n:"Creditors A/c",  ty:"Liability", side:"cr", why:"We owe suppliers → Liability → <b>Cr</b> balance."},
  {n:"Sales A/c",      ty:"Revenue",   side:"cr", why:"Income earned → <b>Cr</b> balance. Closed to Trading A/c at year-end."},
  {n:"Commission Recd",ty:"Revenue",   side:"cr", why:"Income → <b>Cr</b> balance. Closed to P&L A/c."},
  {n:"Purchases A/c",  ty:"Expense",   side:"dr", why:"Direct cost → <b>Dr</b> balance. Closed to Trading A/c."},
  {n:"Salary A/c",     ty:"Expense",   side:"dr", why:"Indirect expense → <b>Dr</b> balance. Closed to P&L A/c."},
  {n:"Rent Paid A/c",  ty:"Expense",   side:"dr", why:"Expense → <b>Dr</b> balance."},
  {n:"Drawings A/c",   ty:"Contra-Equity", side:"dr", why:"Drawings reduce Capital → recorded on Dr side, deducted from Capital in Balance Sheet."},
];
const bg=$("#balGrid");
BAL.forEach(b=>{
  const el=document.createElement("div"); el.className="bcard";
  el.innerHTML = `
    <div class="face front">
      <div><div class="ty">${b.ty}</div><div class="nm">${b.n}</div></div>
      <div class="side ${b.side}">${b.side==="dr"?"Dr. balance":"Cr. balance"}</div>
    </div>
    <div class="face back"><p>${b.why}</p><div class="side ${b.side}" style="text-align:right">${b.side.toUpperCase()}</div></div>`;
  el.onclick=()=>{el.classList.toggle("flip"); sfx.tap(); awardXP(2,"Balance learned");};
  bg.appendChild(el);
});

const B = {i:0, score:0, set:[]};
function bStart(){
  B.i=0; B.score=0;
  B.set = [...BAL].sort(()=>Math.random()-.5).slice(0,8);
  bRender();
}
function bRender(){
  if(B.i>=B.set.length){
    $("#bMission").innerHTML = `🏆 You scored <b>${B.score}/${B.set.length}</b>. ${B.score>=6?"Master of Balances!":"Flip the cards & try again."}`;
    $("#bOpts").innerHTML=""; if(B.score>=6) unlockBadge("balance_master");
    return;
  }
  const q=B.set[B.i];
  $("#bQ").textContent=B.i+1; $("#bScore").textContent=B.score;
  $("#bMission").innerHTML = `Mission ${B.i+1}: <b>${q.n}</b> — Which side is its <em>natural balance</em>?`;
  $("#bOpts").innerHTML="";
  ["dr","cr"].forEach(side=>{
    const btn=document.createElement("button");
    btn.innerHTML = side==="dr" ? "🟦 Debit (Dr.)" : "🟪 Credit (Cr.)";
    btn.onclick=()=>{
      const ok = side===q.side;
      if(ok){btn.classList.add("correct"); sfx.good(); B.score++; bumpCombo(); awardXP(8,"Dr/Cr right"); $("#bExplain").innerHTML="✅ "+q.why;}
      else{btn.classList.add("wrong"); sfx.bad(); resetCombo(); $("#bExplain").innerHTML="❌ "+q.why;}
      $$("#bOpts button").forEach(x=>x.disabled=true);
      setTimeout(()=>{B.i++; bRender();}, 1100);
    };
    $("#bOpts").appendChild(btn);
  });
}
$("#bRestart").onclick=()=>{bStart(); sfx.tap()};
bStart();

/* ============ AUDIT FIX: Drawings display sign in Simulator ============ */
/* Drawings account is a contra-equity. Internally stored as negative Q so it reduces Capital.
   Re-wrap simRender's ledger row formatter via a small DOM patch after each call. */
const _simRenderOrig = simRender;
simRender = function(){
  _simRenderOrig.apply(this, arguments);
  // Show Drawings as positive Dr balance in ledger for clarity
  $$("#simLedger tr").forEach(tr=>{
    const td=tr.querySelector("td"); if(!td) return;
    if(td.textContent.trim()==="Drawings"){
      const tds=tr.querySelectorAll("td");
      if(tds[2]){
        const v = Math.abs(parseFloat(tds[2].textContent.replace(/[,]/g,""))||0);
        tds[2].innerHTML = v.toLocaleString("en-IN")+" <small style='color:var(--ink-dim)'>(Dr)</small>";
      }
    }
  });
};
simRender();

/* ============ Extra keyboard shortcuts for new modules ============ */
document.addEventListener("keydown",e=>{
  if(_isEditing()) return;
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key==="-"||e.key==="_") go("m11");
  if(e.key==="="||e.key==="+") go("m12");
  if(e.key==="["||e.key==="{") go("m13");
});

/* ============================================================
   UNIFIED ACCOUNTING STATE BUS
   One source of truth → Simulator → Ledger → Balance Sheet →
   Equation Equalizer (m1) → What-If (m8). No screen jumps.
   ============================================================ */
(function(){
  // --- tiny pub/sub
  const subs={};
  const bus={
    on:(ev,fn)=>{(subs[ev]=subs[ev]||[]).push(fn);},
    emit:(ev,p)=>{(subs[ev]||[]).forEach(fn=>{try{fn(p)}catch(e){console.warn(e)}})}
  };
  window.AUBus = bus;

  // --- persistence (survives screen switches / reloads)
  const KEY="au:sim:v1";
  try{
    const raw=sessionStorage.getItem(KEY);
    if(raw){
      const s=JSON.parse(raw);
      if(s&&s.journal){ SIM.journal=s.journal; SIM.ledger=s.ledger||{}; SIM.n=s.n||0; }
    }
  }catch(_){}
  function persist(){
    try{ sessionStorage.setItem(KEY, JSON.stringify({journal:SIM.journal,ledger:SIM.ledger,n:SIM.n})); }catch(_){}
  }

  // --- compute canonical totals from SIM ledger
  function totals(){
    let assets=0,lia=0,cap=0,exp=0,rev=0;
    Object.values(SIM.ledger).forEach(o=>{
      if(o.type==="A") assets+=o.bal;
      else if(o.type==="L") lia+=o.bal;
      else if(o.type==="Q") cap+=o.bal;
      else if(o.type==="E") exp+=o.bal;
      else if(o.type==="R") rev+=o.bal;
    });
    const adjCap = cap + rev - exp;            // P&L closed to capital
    const liaSide = adjCap + lia;
    const balanced = Math.abs(assets - liaSide) < 0.5;
    return {assets,lia,cap,exp,rev,adjCap,liaSide,balanced,n:SIM.journal.length};
  }
  window.AUState = totals;

  // --- wrap simRender so every state change persists + broadcasts
  const _r = simRender;
  simRender = function(){
    _r.apply(this, arguments);
    persist();
    bus.emit("state", totals());
  };

  // --- mirror to Equation Equalizer (m1) automatically
  // Only mirrors when sim has activity and user hasn't manually moved m1 in last 3s
  let m1Touched=0;
  ["txApply","txReset"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener("click",()=>{ m1Touched=Date.now(); });
  });
  bus.on("state",t=>{
    if(t.n===0) return;
    if(Date.now()-m1Touched < 3000) return;   // respect manual exploration
    if(typeof M1!=="undefined" && typeof m1Render==="function"){
      // Mirror simulator totals into M1 individual accounts
      M1_ACCTS.Cash = t.assets;
      M1_ACCTS.Capital = t.adjCap;
      M1_ACCTS.Creditors = t.lia;
      M1.log.push({label:"↻ Synced from Simulator",
        detail:`A ₹${Math.round(t.assets).toLocaleString("en-IN")} = C ₹${Math.round(t.adjCap).toLocaleString("en-IN")} + L ₹${Math.round(t.lia).toLocaleString("en-IN")}`});
      if(M1.log.length>30) M1.log=M1.log.slice(-30);
      m1Render();
    }
  });

  // --- mirror to What-If (m8) sliders when user opens that screen
  bus.on("state",t=>{
    const a=document.getElementById("sAst"), l=document.getElementById("sLia");
    if(!a||!l||t.n===0) return;
    // only update if sliders are still at defaults / untouched recently
    if(a.dataset.touched==="1"||l.dataset.touched==="1") return;
    const maxA=+a.max||500000, maxL=+l.max||500000;
    a.value=Math.min(Math.max(Math.round(t.assets),+a.min||0),maxA);
    l.value=Math.min(Math.max(Math.round(t.lia),+l.min||0),maxL);
    if(typeof whatif==="function") whatif();
  });
  ["sAst","sLia"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener("input",()=>{ el.dataset.touched="1"; });
  });

  // --- initial paint with restored state
  simRender();

  // --- live status pill in nav (passive indicator, never steals focus)
  const pill=document.createElement("div");
  pill.id="auSyncPill";
  pill.style.cssText="position:fixed;bottom:10px;right:10px;z-index:60;padding:6px 12px;border-radius:999px;font:600 11px/1 system-ui,sans-serif;letter-spacing:.5px;backdrop-filter:blur(10px);background:rgba(20,30,50,.55);border:1px solid rgba(255,255,255,.12);color:#cfe;pointer-events:none;transition:all .3s";
  pill.textContent="● SYNCED";
  document.body.appendChild(pill);
  bus.on("state",t=>{
    pill.textContent = t.n===0 ? "● IDLE"
      : (t.balanced ? `● A=C+L  ₹${Math.round(t.assets).toLocaleString("en-IN")}`
                   : `● OFF BY ₹${Math.abs(Math.round(t.assets-t.liaSide)).toLocaleString("en-IN")}`);
    pill.style.color = t.balanced? "#7fffd4" : "#ffb547";
    pill.style.borderColor = t.balanced? "rgba(127,255,212,.4)" : "rgba(255,181,71,.5)";
  });
  bus.emit("state", totals());
})();

/* ============================================================
   UNIVERSAL ACCOUNTING RULES ENGINE  (CBSE XI compliant)
   Single source of truth for:
     · Account classification (Modern + Traditional)
     · Debit/Credit natural sides
     · Increase/Decrease impact per side
     · Journal entry validation (dual aspect)
     · Accounting equation validation (A = C + L)
   Every module (m1, m6, m7, m9, m11, m12, future) MUST call
   AcctEngine.validate() before posting and AcctEngine.impact()
   to know which way the equation moves.
   ============================================================ */
(function(){
  // --- 1. Classification (Modern approach) -------------------
  //   A = Asset · L = Liability · Q = Capital/Equity (Owner)
  //   E = Expense · R = Revenue
  //   X = Contra-equity (Drawings) — stored under Q with sign rules
  const T = {
    // Assets
    Cash:"A", Bank:"A", "Cash in Hand":"A", "Bank Balance":"A",
    Stock:"A", "Closing Stock":"A", "Opening Stock":"A", Inventory:"A",
    Debtors:"A", "Bills Receivable":"A", "Accounts Receivable":"A",
    Machinery:"A", Furniture:"A", Building:"A", Land:"A", Equipment:"A",
    Vehicle:"A", Computer:"A", Goodwill:"A", Investments:"A",
    Prepaid:"A", "Prepaid Expenses":"A", "Accrued Income":"A",
    // Liabilities
    Creditors:"L", "Accounts Payable":"L", "Bills Payable":"L",
    "Bank Loan":"L", Loan:"L", "Loan from Bank":"L",
    "Outstanding Expenses":"L", "O/s Salary":"L", "O/s Rent":"L",
    "Income Received in Advance":"L", "Unearned Income":"L",
    // Equity
    Capital:"Q", "Owner's Capital":"Q", "Share Capital":"Q",
    Reserves:"Q", "Retained Earnings":"Q",
    Drawings:"X",
    // Revenues
    Sales:"R", "Service Revenue":"R", "Commission Received":"R",
    "Interest Received":"R", "Rent Received":"R",
    "Discount Received":"R", "Dividend Received":"R",
    // Expenses
    Purchases:"E", "Purchase Returns":"R", "Sales Returns":"E",
    Salary:"E", Wages:"E", "Wages (Direct)":"E", Rent:"E", "Rent (Office)":"E",
    Electricity:"E", "Office Exp":"E", "Office Expenses":"E",
    Advertisement:"E", Insurance:"E", "Carriage Inwards":"E",
    "Carriage Outwards":"E", Freight:"E", Depreciation:"E",
    "Discount Allowed":"E", Interest:"E", "Interest Paid":"E", "Bad Debts":"E",
    Commission:"E"
  };
  function classify(name){
    if(T[name]) return T[name];
    const n=(name||"").toLowerCase();
    if(/cash|bank|debtor|stock|inventory|machinery|furniture|building|land|asset|vehicle|computer|goodwill|invest|prepaid|receivable/.test(n)) return "A";
    if(/loan|creditor|payable|outstanding|unearned|advance from/.test(n)) return "L";
    if(/capital|equity|reserve/.test(n)) return "Q";
    if(/drawing/.test(n)) return "X";
    if(/sales|received|revenue|income|gain/.test(n)) return "R";
    return "E"; // default to expense
  }

  // --- 2. Natural side ---------------------------------------
  //   Assets, Expenses, Drawings → Debit balance
  //   Liabilities, Capital, Revenue → Credit balance
  function naturalSide(type){
    return (type==="A"||type==="E"||type==="X") ? "Dr" : "Cr";
  }

  // --- 3. Sign of a posting on the ACCOUNT's own balance -----
  // returns +1 if this side INCREASES the account, -1 if DECREASES
  function effect(type, side){
    const nat = naturalSide(type);
    return (side===nat) ? +1 : -1;
  }

  // --- 4. Effect on the accounting equation totals -----------
  //   returns {dA,dL,dQ}  where Q already absorbs E,R,X
  //   E posted Dr  → Q decreases (loss reduces capital)
  //   R posted Cr  → Q increases (profit adds to capital)
  //   X (Drawings) Dr → Q decreases
  function eqDelta(type, side, amt){
    const e = effect(type, side) * amt;       // change in account bal
    if(type==="A") return {dA:e,  dL:0,  dQ:0};
    if(type==="L") return {dA:0,  dL:e,  dQ:0};
    if(type==="Q") return {dA:0,  dL:0,  dQ:e};
    if(type==="R") return {dA:0,  dL:0,  dQ:e};   // revenue ↑ capital
    if(type==="E") return {dA:0,  dL:0,  dQ:-e};  // expense ↓ capital (e is + when Dr)
    if(type==="X") return {dA:0,  dL:0,  dQ:-e};  // drawings ↓ capital
    return {dA:0,dL:0,dQ:0};
  }

  // --- 5. Journal entry validator ----------------------------
  // entry: { dr:[{a,amt}], cr:[{a,amt}], label }
  function validate(entry){
    const errs=[];
    const dr=entry.dr||[], cr=entry.cr||[];
    if(!dr.length) errs.push("At least one Debit account required.");
    if(!cr.length) errs.push("At least one Credit account required.");
    const sDr = dr.reduce((s,x)=>s+(+x.amt||0),0);
    const sCr = cr.reduce((s,x)=>s+(+x.amt||0),0);
    if(sDr<=0||sCr<=0) errs.push("Amounts must be positive.");
    if(Math.abs(sDr-sCr)>0.005) errs.push(`Dual aspect broken: Dr ₹${sDr.toLocaleString("en-IN")} ≠ Cr ₹${sCr.toLocaleString("en-IN")}.`);
    // equation impact
    let dA=0,dL=0,dQ=0;
    dr.forEach(x=>{ const d=eqDelta(classify(x.a),"Dr",+x.amt||0); dA+=d.dA;dL+=d.dL;dQ+=d.dQ; });
    cr.forEach(x=>{ const d=eqDelta(classify(x.a),"Cr",+x.amt||0); dA+=d.dA;dL+=d.dL;dQ+=d.dQ; });
    const eqOk = Math.abs(dA - (dL+dQ)) < 0.005;
    if(!eqOk) errs.push(`Equation broken: ΔA ${dA} ≠ ΔL ${dL} + ΔC ${dQ}.`);
    return {ok:errs.length===0, errors:errs, sumDr:sDr, sumCr:sCr, delta:{dA,dL,dQ}, eqOk};
  }

  // --- 6. Human explanation ----------------------------------
  function explain(name, side){
    const t=classify(name), nat=naturalSide(t);
    const inc = side===nat ? "increases" : "decreases";
    const typeName = {A:"Asset",L:"Liability",Q:"Capital",E:"Expense",R:"Revenue",X:"Drawings"}[t];
    return `${name} is a ${typeName}. Natural balance: ${nat}. Posting on ${side} → ${inc}.`;
  }
 /* ===== Module 14: CEO Simulator ===== */
const ceoQuestions = [
  {q: "You convinced an angel investor to put ₹10,00,000 into your startup. How do you record this?", opts: ["Increase Cash, Increase Liabilities", "Increase Cash, Increase Equity (Capital)", "Increase Asset, Decrease Asset"], a: 1, exp: "Capital invested by owner/investors increases both Cash (Asset) and Equity (Capital).", val: 1000000},
  {q: "Your team needs new MacBooks. You buy ₹5,00,000 worth of laptops on credit from Apple.", opts: ["Increase Asset, Decrease Cash", "Increase Asset, Increase Liability", "Decrease Liability, Increase Asset"], a: 1, exp: "You acquired an Asset (Computers), but haven't paid yet, so Liability (Creditors) increases.", val: 500000},
  {q: "A supplier offers a 5% discount if you pay a ₹1,00,000 invoice today. You pay via bank.", opts: ["Dr. Creditor 1L, Cr. Bank 95k, Cr. Discount 5k", "Dr. Creditor 95k, Cr. Bank 95k", "Dr. Bank 1L, Cr. Creditor 1L"], a: 0, exp: "Liability drops by full 1L, you pay 95k Cash, and 5k is Discount Received (Revenue/Gain).", val: 5000},
  {q: "Your startup provides consulting services worth ₹2,00,000 to a client on credit.", opts: ["Dr. Cash, Cr. Sales", "Dr. Debtors, Cr. Sales", "Dr. Sales, Cr. Debtors"], a: 1, exp: "Since it's on credit, Debtors (Asset) increase. Sales (Revenue) also increases.", val: 200000},
  {q: "You pay ₹50,000 for office rent for the current month.", opts: ["Decrease Cash, Decrease Capital", "Increase Asset, Decrease Cash", "Decrease Liability, Decrease Cash"], a: 0, exp: "Rent is an expense. It reduces Cash (Asset) and reduces Capital (Equity).", val: -50000},
  {q: "You purchase a 3-year software license upfront for ₹3,00,000.", opts: ["Expense it entirely this year", "Record as Prepaid Expense (Asset)", "Record as a Liability"], a: 1, exp: "Since it benefits future years, it's a Prepaid Expense (Asset), amortized over 3 years.", val: 0},
  {q: "A client who owed you ₹50,000 goes bankrupt and pays nothing.", opts: ["Dr. Bad Debts, Cr. Debtors", "Dr. Cash, Cr. Debtors", "Dr. Debtors, Cr. Bad Debts"], a: 0, exp: "Bad Debts is an expense (Loss). You must reduce the Debtor (Asset) to 0.", val: -50000},
  {q: "You withdraw ₹20,000 from the company for a personal vacation.", opts: ["Dr. Drawings, Cr. Cash", "Dr. Salary Expense, Cr. Cash", "Dr. Cash, Cr. Drawings"], a: 0, exp: "Personal withdrawal is 'Drawings', reducing both Cash and Capital.", val: -20000},
  {q: "The bank charges ₹1,000 as account maintenance fees.", opts: ["Decrease Liability", "Decrease Asset, Decrease Equity", "Increase Liability, Increase Expense"], a: 1, exp: "Bank charges are an expense. They reduce Bank (Asset) and Capital (Equity).", val: -1000},
  {q: "You provide services for ₹1,50,000, receiving ₹50,000 in cash and the rest on credit.", opts: ["Dr. Cash 50k, Dr. Debtors 1L, Cr. Sales 1.5L", "Dr. Cash 1.5L, Cr. Sales 1.5L", "Dr. Debtors 1.5L, Cr. Sales 1.5L"], a: 0, exp: "Assets increase by 1.5L total (Cash + Debtors), matching the Revenue.", val: 150000},
  {q: "You receive ₹20,000 in advance from a client for work you will do next month.", opts: ["Increase Revenue", "Increase Liability (Unearned Revenue)", "Decrease Debtors"], a: 1, exp: "Money received for work not yet performed is an obligation (Liability).", val: 20000},
  {q: "You buy a patent for your tech for ₹10,00,000.", opts: ["Intangible Asset", "Tangible Asset", "Fictitious Asset"], a: 0, exp: "A patent has value but no physical form, so it's an Intangible Asset.", val: 1000000},
  {q: "At year-end, your delivery van depreciates by ₹50,000.", opts: ["Dr. Depreciation, Cr. Cash", "Dr. Depreciation, Cr. Delivery Van", "Dr. Delivery Van, Cr. Depreciation"], a: 1, exp: "Depreciation (Expense) increases, and the Asset's value decreases.", val: -50000},
  {q: "You return defective goods worth ₹10,000 to your supplier.", opts: ["Dr. Purchases Return, Cr. Creditors", "Dr. Creditors, Cr. Purchases Return", "Dr. Cash, Cr. Purchases"], a: 1, exp: "Returning goods reduces your Liability to the supplier (Dr. Creditors).", val: 10000},
  {q: "A customer returns ₹5,000 of items they bought for cash.", opts: ["Dr. Sales Return, Cr. Cash", "Dr. Cash, Cr. Sales Return", "Dr. Debtors, Cr. Sales Return"], a: 0, exp: "Sales Return reduces revenue (Dr). You refund their cash (Cr. Cash).", val: -5000},
  {q: "You pay ₹30,000 for insurance covering the next 12 months.", opts: ["Prepaid Insurance (Asset)", "Outstanding Insurance (Liability)", "Insurance Expense (Full amount)"], a: 0, exp: "Since it covers future periods, it's prepaid (an Asset).", val: 0},
  {q: "Wages of ₹15,000 are due to workers but not yet paid.", opts: ["Dr. Wages, Cr. Cash", "Dr. Outstanding Wages, Cr. Wages", "Dr. Wages, Cr. Outstanding Wages"], a: 2, exp: "Expense is recognized (Dr. Wages), creating a Liability (Cr. Outstanding Wages).", val: -15000},
  {q: "You start using office stationery costing ₹5,000 purchased last month.", opts: ["Converts from Asset to Expense", "Converts from Liability to Asset", "Converts from Expense to Liability"], a: 0, exp: "Stock of stationery (Asset) is consumed, becoming an Expense.", val: -5000},
  {q: "You sell old office furniture (Book Value ₹40,000) for ₹45,000 cash.", opts: ["Gain of ₹5,000", "Loss of ₹5,000", "Revenue of ₹45,000"], a: 0, exp: "Cash (+45k), Furniture (-40k), so Capital increases by 5k (Gain).", val: 5000},
  {q: "You receive a ₹10,000 check from a debtor and deposit it immediately.", opts: ["Dr. Bank, Cr. Debtors", "Dr. Cash, Cr. Debtors", "Dr. Debtors, Cr. Bank"], a: 0, exp: "Bank balance increases, Debtor balance decreases.", val: 0},
  {q: "A debtor's check of ₹10,000 bounces (dishonored).", opts: ["Dr. Debtors, Cr. Bank", "Dr. Bank, Cr. Debtors", "Dr. Bad Debts, Cr. Bank"], a: 0, exp: "You must reverse the original receipt entry. Debtors increase again.", val: 0},
  {q: "You draw a Bill of Exchange for ₹50,000 on a customer who accepts it.", opts: ["Dr. Bills Receivable, Cr. Debtors", "Dr. Debtors, Cr. Bills Receivable", "Dr. Bills Payable, Cr. Debtors"], a: 0, exp: "One asset (Debtors) is converted into a more formal asset (Bills Receivable).", val: 0},
  {q: "You discount the ₹50,000 Bill of Exchange with your bank for ₹48,000.", opts: ["Dr. Bank 48k, Dr. Discount 2k, Cr. B/R 50k", "Dr. Bank 50k, Cr. B/R 50k", "Dr. Bank 48k, Cr. B/R 48k"], a: 0, exp: "Bank increases 48k, Discounting Charge (Expense) is 2k, B/R goes down 50k.", val: -2000},
  {q: "You provide 5% provision for doubtful debts on ₹2,00,000 debtors.", opts: ["Dr. P&L, Cr. Provision (₹10k)", "Dr. Debtors, Cr. Provision (₹10k)", "Dr. Provision, Cr. Debtors (₹10k)"], a: 0, exp: "It's an anticipated loss (Dr. P&L) creating a contra-asset/liability (Cr. Provision).", val: -10000},
  {q: "Your inventory at year-end costs ₹1,00,000 but market value is ₹90,000.", opts: ["Value at ₹1,00,000", "Value at ₹90,000", "Average it to ₹95,000"], a: 1, exp: "Prudence concept: Inventory is valued at Cost or Net Realizable Value, whichever is lower.", val: -10000},
  {q: "You pay income tax of ₹30,000 on behalf of the proprietor.", opts: ["Dr. Tax Expense", "Dr. Drawings", "Dr. Capital"], a: 1, exp: "Proprietor's income tax is a personal expense, hence treated as Drawings.", val: -30000},
  {q: "You install a new machine. Labor cost for installation is ₹10,000.", opts: ["Dr. Wages", "Dr. Machinery", "Dr. Repairs"], a: 1, exp: "Costs incurred to bring an asset to its usable condition are capitalized (added to Asset).", val: 0},
  {q: "Fire destroys goods worth ₹20,000. Insurance admits a claim of ₹15,000.", opts: ["Loss of ₹20,000", "Loss of ₹5,000", "No Loss"], a: 1, exp: "Total loss is 20k, but insurance covers 15k, so net loss to P&L is 5k.", val: -5000},
  {q: "You charge interest on proprietor's drawings ₹2,000.", opts: ["Dr. Drawings, Cr. Interest (Income)", "Dr. Interest, Cr. Drawings", "No entry"], a: 0, exp: "It's an income for the business and increases the owner's drawings liability.", val: 2000},
  {q: "You transfer ₹50,000 from current year profits to General Reserve.", opts: ["Reduces total Equity", "Increases Liabilities", "No change to total Equity"], a: 2, exp: "Reserve is just a retained part of Equity. Total Equity remains the same.", val: 0},
  {q: "A previously written-off bad debt of ₹5,000 is suddenly recovered.", opts: ["Dr. Cash, Cr. Bad Debts Recovered", "Dr. Cash, Cr. Debtors", "Dr. Debtors, Cr. Cash"], a: 0, exp: "It's a sudden gain (Revenue). Cash comes in.", val: 5000}
];

let ceoQIdx = 0;
let ceoValuation = 5000000;
let ceoScore = 0;

function renderCEOQuestion() {
  const q = ceoQuestions[ceoQIdx];
  $("#ceoQNum").textContent = (ceoQIdx + 1);
  $("#ceoVal").textContent = fmt(ceoValuation);
  $("#ceoScenario").innerHTML = `<b>Scenario:</b> ${q.q}`;
  
  const optsDiv = $("#ceoOpts");
  optsDiv.innerHTML = "";
  $("#ceoExplain").style.display = "none";
  $("#ceoNext").style.display = "none";
  
  q.opts.forEach((optText, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn ghost";
    btn.style.textAlign = "left";
    btn.style.height = "auto";
    btn.style.padding = "14px";
    btn.style.fontSize = "14.5px";
    btn.innerHTML = optText;
    btn.onclick = () => handleCEOAnswer(idx, btn);
    optsDiv.appendChild(btn);
  });
}

function handleCEOAnswer(idx, btnElem) {
  const q = ceoQuestions[ceoQIdx];
  const btns = $$("#ceoOpts button");
  btns.forEach(b => { b.disabled = true; b.style.opacity = "0.7"; });
  
  const isCorrect = (idx === q.a);
  if(isCorrect) {
    btnElem.classList.add("correct");
    sfx.good();
    awardXP(50, "Great CEO Decision!");
    ceoValuation += q.val;
    ceoScore++;
  } else {
    btnElem.classList.add("wrong");
    btns[q.a].classList.add("correct");
    sfx.bad();
    ceoValuation -= Math.abs(q.val) * 0.5; // Penalty
  }
  
  $("#ceoVal").textContent = fmt(ceoValuation);
  
  $("#ceoExplain").style.display = "block";
  $("#ceoExplain").innerHTML = `<b>${isCorrect ? "Correct!" : "Oops!"}</b> ${q.exp}`;
  
  $("#ceoNext").style.display = "block";
}

$("#ceoNext").onclick = () => {
  ceoQIdx++;
  if(ceoQIdx < ceoQuestions.length) {
    sfx.pop();
    renderCEOQuestion();
  } else {
    // Game Over
    $("#ceoScenario").innerHTML = `<b>Simulator Complete!</b><br>You handled ${ceoScore}/${ceoQuestions.length} scenarios perfectly.<br>Final Valuation: ${fmt(ceoValuation)}`;
    $("#ceoOpts").innerHTML = "";
    $("#ceoExplain").style.display = "none";
    $("#ceoNext").style.display = "none";
    $("#ceoRestart").style.display = "block";
    sfx.level();
    confetti(150);
  }
};

$("#ceoRestart").onclick = () => {
  ceoQIdx = 0;
  ceoValuation = 5000000;
  ceoScore = 0;
  $("#ceoRestart").style.display = "none";
  sfx.pop();
  
  // Shuffle array randomly
  for (let i = ceoQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ceoQuestions[i], ceoQuestions[j]] = [ceoQuestions[j], ceoQuestions[i]];
  }
  
  renderCEOQuestion();
};

// Initialize CEO game on load
renderCEOQuestion();

  console.info("%c🚀 AcctEngine online - A=C+L enforced","color:#7fffd4;font-weight:600");
})();
  window.AcctEngine = {
    TYPES:T, classify, naturalSide, effect, eqDelta, validate, explain,
    isAsset:n=>classify(n)==="A", isLiab:n=>classify(n)==="L",
    isCapital:n=>classify(n)==="Q", isExpense:n=>classify(n)==="E",
    isRevenue:n=>classify(n)==="R", isDrawings:n=>classify(n)==="X"
  };

  /* ---------- ROUTE EXISTING MODULES THROUGH THE ENGINE ----------
     Patch ACC_TYPE used by Simulator (m7) and wrap simPost so every
     transaction is validated. Equation-Equalizer (m1) TPL also routes
     its labels via engine for consistent wording. */
  if(typeof ACC_TYPE!=="undefined"){
    // upgrade ACC_TYPE to use engine.classify (proxy fallback)
    const proxy = new Proxy(ACC_TYPE,{
      get(o,k){
        if(k in o) return o[k];
        const t = classify(String(k));
        return t==="X" ? "Q" : t;     // simulator's ledger only knows A/L/Q/E/R
      }
    });
    try{ window.ACC_TYPE = proxy; }catch(_){}
  }

  if(typeof simPost==="function"){
    const _simPost = simPost;
    window.simPost = function(label, dr, cr){
      const v = AcctEngine.validate({label, dr, cr});
      if(!v.ok){
        console.warn("[AcctEngine] Entry rejected:", v.errors);
        if(typeof toast==="function") toast("⚠ "+v.errors[0], "bad");
        if(typeof sfx!=="undefined" && sfx.bad) sfx.bad();
        return false;
      }

      // Check for negative physical balances
      let negativeErr = "";
      if (typeof SIM !== "undefined" && SIM.ledger) {
        const testLedger = {};
        for(let acct in SIM.ledger) { testLedger[acct] = SIM.ledger[acct].bal; }
        
        function testApply(name, type, amt, side){
          if(testLedger[name] === undefined) testLedger[name] = 0;
          const sign = (type==="A"||type==="E"||type==="X") ? (side==="dr"?1:-1) : (side==="cr"?1:-1);
          testLedger[name] += sign*amt;
          if (testLedger[name] < 0 && (type==="A" || type==="L")) {
            negativeErr = `Transaction would cause ${name} to have a negative balance.`;
          }
        }
        
        dr.forEach(x=>testApply(x.a, AcctEngine.classify(x.a), x.amt, "dr"));
        if (!negativeErr) cr.forEach(x=>testApply(x.a, AcctEngine.classify(x.a), x.amt, "cr"));
      }
      
      if(negativeErr) {
        if(typeof toast==="function") toast("⚠ "+negativeErr, "bad");
        if(typeof sfx!=="undefined" && sfx.bad) sfx.bad();
        return false;
      }

      return _simPost(label, dr, cr);
    };
  }

  // expose a friendly badge on the live sync pill when engine validates
  console.info("%c⚙ AcctEngine online — A=C+L enforced","color:#7fffd4;font-weight:600");
})();


