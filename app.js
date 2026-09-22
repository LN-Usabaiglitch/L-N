/* ══════════════════════════════════════════════════
   ຄ່າຕັ້ງທັງໝົດຢູ່ໄຟລ໌ config.js — ແກ້ຢູ່ນັ້ນ
   ══════════════════════════════════════════════════ */
import { MANAGERS, FIREBASE_CONFIG } from "./config.js";

/* ═══════ 3) ລາຍຊື່ໂຄງການ — ຈັດການໄດ້ໃນແຖບ “ຜູ້ດູແລ” ═══════ */
let PROJECTS = [];
/* ═══════════════════════════════════════════════ */

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signOut, setPersistence, browserLocalPersistence, sendPasswordResetEmail,
         updatePassword, reauthenticateWithCredential, EmailAuthProvider }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection,
         addDoc, setDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp,
         arrayUnion, arrayRemove }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = s => document.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const LS = { get(k){try{return localStorage.getItem(k)}catch(_){return null}},
             set(k,v){try{localStorage.setItem(k,v)}catch(_){}} };

if (FIREBASE_CONFIG.apiKey.startsWith("PASTE")){ $("#setup").classList.add("on"); throw new Error("no config"); }

const app  = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = initializeFirestore(app,{ localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
const COL   = collection(db,"customers");
const STAFF = collection(db,"staff");
const CFG   = doc(db,"config","app");

let items=[], staff=[], unsub=null, unsubStaff=null, unsubCfg=null;
let editId=null, addStatus="open", editStatus="open", listFilter="all", addSource="", editSource="";
let manager=false;
const OWNERS=MANAGERS.map(e=>e.toLowerCase());
const isOwner=e=>OWNERS.includes((e||"").toLowerCase());
const roleOf=e=>{const s=staff.find(x=>(x.email||"").toLowerCase()===(e||"").toLowerCase());return s?(s.role||"staff"):"staff";};
const isManager=e=>isOwner(e)||roleOf(e)==="manager";
const staffOf=e=>staff.find(x=>(x.email||"").toLowerCase()===(e||"").toLowerCase())||null;
const picOf=e=>{const s=staffOf(e);return s&&s.photo?s.photo:"";};
const staffDocId=e=>{const s=staffOf(e);return s?s.id:(e||"").toLowerCase();};

/* ── ໄອຄອນຄົນ (ສີດຳ) ໃຊ້ແທນຕົວອັກສອນຫຍໍ້ ── */
const PERSON=`<svg class="ico-p" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.2a5.1 5.1 0 1 0 0-10.2 5.1 5.1 0 0 0 0 10.2Zm0 1.9c-4.5 0-8.2 2.3-8.2 5.1V22h16.4v-2.8c0-2.8-3.7-5.1-8.2-5.1Z"/></svg>`;

/* ── ຈັດຮູບແບບເບີໂທ: 02056997280 → 020 5699 7280 ── */
const PH_PREFIX="020";
const NOPHONE="ບໍ່ມີເບີ";
const digitsOf=p=>String(p??"").replace(/\D/g,"");
const isNoPhone=it=>!!it.nophone||!digitsOf(it.phone);
/* ເບີຖືກຕ້ອງ: ສ່ວນຫຼັງລະຫັດນຳໜ້າ ຕ້ອງ 7 ໂຕຂຶ້ນໄປ */
function phoneOk(v){
  const d=digitsOf(v);
  if(!d) return false;
  const sub=d.startsWith("0")?d.slice(3):d;
  return sub.length>=7;
}
function samePhone(a,b){const x=digitsOf(a),y=digitsOf(b);return !!x&&x===y;}
function findByPhone(v){const d=digitsOf(v);if(!d)return null;
  return alive().find(i=>digitsOf(i.phone)===d)||null;}

function fmtPhone(p){
  const d=String(p??"").replace(/\D/g,"");
  if(!d) return NOPHONE;
  if(d.length===11&&d.startsWith("0")) return `${d.slice(0,3)} ${d.slice(3,7)} ${d.slice(7)}`;
  if(d.length===10&&d.startsWith("0")) return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`;
  return String(p??"");
}
/* ── ຕົວເລກ + ຄຳວ່າ “ຄົນ” ── */
const nPeople=n=>`${n}<i class="unit">ຄົນ</i>`;

/* ── ສີປະຈຳແຕ່ລະລາຍການ (ໂຄງການ / ພະນັກງານ) ── */
const PALETTE=["#C4620E","#16255A","#2E6B4C","#8A2BE2","#0E7490","#B3261E","#B7791F","#4C51BF","#0F766E","#9D174D"];
const colorOf=(s,i)=>PALETTE[(i>=0?i:0)%PALETTE.length];

/* ══════════════════════════════════════════════════════════════
   ລາຍການເລືອກທີ່ແກ້ໄຂໄດ້: ສະຖານະ + ເຫັນໂຄສະນາຈາກໃສ
   - ບໍ່ມີລາຍການຫຼັກທີ່ລັອກໄວ້ — ລຶບ / ເພີ່ມໄດ້ທຸກລາຍການ
   - ລູກຄ້າເກົ່າທີ່ໃຊ້ລາຍການທີ່ຖືກລຶບ ຍັງສະແດງຄືເກົ່າ
   ══════════════════════════════════════════════════════════════ */
/* ສອງສະຖານະເດີມເກັບໃນຖານຂໍ້ມູນເປັນລະຫັດ open / sold (ຂໍ້ມູນເກົ່າຈຶ່ງບໍ່ປ່ຽນ) */
const BUILTIN={open:"ສົນໃຈ / ຖາມ",sold:"ປິດຍອດຂາຍແລ້ວ"};
const idOfLabel=l=>l===BUILTIN.open?"open":(l===BUILTIN.sold?"sold":l);
let STATUS_LIST=[BUILTIN.open,BUILTIN.sold];          /* ປ້າຍທັງໝົດ ຕາມລຳດັບ */
const DEFAULT_SOURCES=["ເພຈ Facebook","ປ້າຍໂຄສະນາ","ອື່ນໆ"];
let SOURCES=[...DEFAULT_SOURCES];
const NOSRC="ບໍ່ໄດ້ລະບຸ";
let cfgHas={statusList:false,sources:false,projects:false};

const allStatus=()=>STATUS_LIST.map(l=>({id:idOfLabel(l),label:l}));
const statusLabel=id=>BUILTIN[id||"open"]||id;
const statusClass=id=>id==="sold"?"sold":(id==="open"?"open":"other");
/* ຄ່າເລີ່ມຕົ້ນຕອນບັນທຶກ: “ສົນໃຈ / ຖາມ” ຖ້າຍັງມີ — ບໍ່ເລືອກ “ປິດຍອດ” ເອງເດັດຂາດ */
function defStatus(){
  const ids=allStatus().map(x=>x.id);
  if(ids.includes("open")) return "open";
  return ids.find(x=>x!=="sold")||ids[0]||"open";
}
const ST_PALETTE=["#C4620E","#8A2BE2","#0E7490","#B3261E","#B7791F","#4C51BF","#0F766E","#9D174D","#A16207","#475569"];
const hashIdx=(s,n)=>{let h=0;for(const ch of String(s))h=(h*31+ch.codePointAt(0))>>>0;return h%n;};
function statusColor(id){
  id=id||"open";
  if(id==="sold") return "#2E6B4C";
  if(id==="open") return "#16255A";
  const custom=allStatus().filter(x=>x.id!=="open"&&x.id!=="sold").map(x=>x.id);
  const i=custom.indexOf(id);
  return ST_PALETTE[(i>=0?i:hashIdx(id,ST_PALETTE.length))%ST_PALETTE.length];
}
const SRC_PALETTE=["#1877F2","#C4620E","#2E6B4C","#8A2BE2","#0E7490","#B7791F","#9D174D","#4C51BF"];
const sourceColor=s=>{if(!s) return "#9AA0A6";const i=SOURCES.indexOf(s);
  return SRC_PALETTE[(i>=0?i:hashIdx(s,SRC_PALETTE.length))%SRC_PALETTE.length];};

const ADDNEW="__add__";
/* ລາຍການທີ່ມີໃນຂໍ້ມູນຈິງ ແຕ່ຖືກລຶບອອກຈາກລາຍການເລືອກແລ້ວ (ໃຊ້ໃນຕົວກັ່ນຕອງ) */
function statusOptions(withData){
  const list=allStatus();
  if(withData){
    const have=new Set(list.map(x=>x.id));
    items.filter(i=>!i.deleted).forEach(i=>{const s=i.status||"open";
      if(!have.has(s)){have.add(s);list.push({id:s,label:statusLabel(s),old:true});}});
  }
  return list;
}
/* ເຕີມ <select> ສະຖານະ — ຖ້າຄ່າປັດຈຸບັນບໍ່ຢູ່ໃນລາຍການ ຈະໃສ່ໄວ້ໃຫ້ ບໍ່ໃຫ້ປ່ຽນເອງໂດຍບໍ່ຮູ້ຕົວ */
function fillStatusSel(sel,cur,opts){
  opts=opts||{};
  const el=$(sel); if(!el) return;
  const list=statusOptions(!!opts.withData);
  if(cur&&cur!=="all"&&cur!==ADDNEW&&!list.some(x=>x.id===cur)) list.push({id:cur,label:statusLabel(cur),old:true});
  const html=(opts.withAll?`<option value="all">ທັງໝົດ</option>`:"")
    +list.map(x=>`<option value="${esc(x.id)}">${esc(x.label)}${x.old?" (ລຶບອອກຈາກລາຍການແລ້ວ)":""}</option>`).join("")
    +(opts.withAdd?`<option value="${ADDNEW}">+ ເພີ່ມລາຍການໃໝ່</option>`:"");
  if(el._sig!==html){ el.innerHTML=html; el._sig=html; }
  const ok=[...el.options].some(o=>o.value===cur&&cur!==ADDNEW);
  el.value=ok?cur:(opts.withAll?"all":defStatus());
}
function fillSourceSel(sel,cur,opts){
  opts=opts||{};
  const el=$(sel); if(!el) return;
  const list=[...SOURCES];
  const extra=cur&&cur!==ADDNEW&&!list.includes(cur);
  const html=`<option value="">— ${NOSRC} —</option>`
    +list.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("")
    +(extra?`<option value="${esc(cur)}">${esc(cur)} (ລຶບອອກຈາກລາຍການແລ້ວ)</option>`:"")
    +(opts.withAdd!==false?`<option value="${ADDNEW}">+ ເພີ່ມລາຍການໃໝ່</option>`:"");
  if(el._sig!==html){ el.innerHTML=html; el._sig=html; }
  el.value=(cur&&cur!==ADDNEW)?cur:"";
}

/* ── ບັນທຶກລາຍການເລືອກລົງ config ──
   ຄັ້ງທຳອິດຂຽນທັງລາຍການ, ຕໍ່ໄປໃຊ້ arrayUnion/arrayRemove ເພື່ອບໍ່ໃຫ້ຫຼາຍຄົນກົດພ້ອມກັນແລ້ວທັບກັນ */
const LISTS={
  status:{field:"statusList",get:()=>STATUS_LIST,set:v=>{STATUS_LIST=v;}},
  source:{field:"sources",get:()=>SOURCES,set:v=>{SOURCES=v;}},
  project:{field:"projects",get:()=>PROJECTS,set:v=>{PROJECTS=v;}}
};
async function listAdd(kind,label){
  const L=LISTS[kind], base=L.get();
  if(!label||["open","sold","all",ADDNEW,OTHERKEY].includes(label)) throw new Error("ໃຊ້ຊື່ນີ້ບໍ່ໄດ້");
  if(base.includes(label)) return false;
  const meta={by:auth.currentUser.email,at:serverTimestamp()};
  if(cfgHas[L.field]) await setDoc(CFG,{[L.field]:arrayUnion(label),...meta},{merge:true});
  else await setDoc(CFG,{[L.field]:[...base,label],...meta},{merge:true});
  cfgHas[L.field]=true;
  if(!L.get().includes(label)) L.set([...L.get(),label]);
  return true;
}
async function listRemove(kind,label){
  const L=LISTS[kind], base=L.get();
  const meta={by:auth.currentUser.email,at:serverTimestamp()};
  if(cfgHas[L.field]) await setDoc(CFG,{[L.field]:arrayRemove(label),...meta},{merge:true});
  else await setDoc(CFG,{[L.field]:base.filter(x=>x!==label),...meta},{merge:true});
  cfgHas[L.field]=true;
  L.set(L.get().filter(x=>x!==label));
}
async function listWhole(kind,list){
  const L=LISTS[kind];
  await setDoc(CFG,{[L.field]:list,by:auth.currentUser.email,at:serverTimestamp()},{merge:true});
  cfgHas[L.field]=true; L.set(list);
}
const writeErr=e=>(e&&e.code==="permission-denied")?"ບໍ່ມີສິດບັນທຶກ — ຕິດຕໍ່ຜູ້ດູແລ":("ບັນທຶກບໍ່ໄດ້: "+((e&&(e.code||e.message))||""));

/* ເລືອກ “+ ເພີ່ມລາຍການໃໝ່” → ເປີດຊ່ອງພິມ; ບັນທຶກແລ້ວທຸກຄົນເຫັນ */
function bindListAdd(kind,sel,addBox,input,saveBtn,onPicked){
  const refill=v=>kind==="status"?fillStatusSel(sel,v,{withAdd:true}):fillSourceSel(sel,v);
  $(sel).addEventListener("change",()=>{
    const v=$(sel).value;
    $(addBox).classList.toggle("hide",v!==ADDNEW);
    if(v===ADDNEW){ $(input).value=""; $(input).focus(); }
    else onPicked(v);
  });
  const save=async()=>{
    const v=$(input).value.trim().replace(/\s+/g," ");
    if(!v){ toast(kind==="status"?"ພິມຊື່ສະຖານະກ່ອນ":"ພິມຊື່ຊ່ອງທາງກ່ອນ"); $(input).focus(); return; }
    const exists=LISTS[kind].get().includes(v);
    $(saveBtn).disabled=true;
    try{
      if(!exists) await listAdd(kind,v);
      const val=kind==="status"?idOfLabel(v):v;
      refill(val);
      $(addBox).classList.add("hide");
      onPicked(val);
      toast(exists?"ມີລາຍການນີ້ແລ້ວ — ເລືອກໃຫ້ແລ້ວ":"ເພີ່ມລາຍການແລ້ວ ✓");
    }catch(e){ toast(writeErr(e)); }
    $(saveBtn).disabled=false;
  };
  $(saveBtn).onclick=save;
  $(input).addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); save(); } });
}

function tagHTML(email,extra){
  const p=picOf(email);
  return p?`<span class="tag pic ${extra||""}" style="background-image:url('${p}')"></span>`
          :`<span class="tag ${extra||""}">${PERSON}</span>`;
}
/* ຫຍໍ້ຮູບໃຫ້ນ້ອຍ ແລ້ວເກັບເປັນ text ໃນ Firestore (ບໍ່ຕ້ອງໃຊ້ Storage) */
function shrinkImage(file,max=240,q=0.82){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onerror=()=>rej(new Error("ອ່ານໄຟລ໌ບໍ່ໄດ້"));
    fr.onload=()=>{
      const img=new Image();
      img.onerror=()=>rej(new Error("ຮູບບໍ່ຖືກຕ້ອງ"));
      img.onload=()=>{
        const side=Math.min(img.width,img.height);
        const sx=(img.width-side)/2, sy=(img.height-side)/2;
        const c=document.createElement("canvas"); c.width=max; c.height=max;
        c.getContext("2d").drawImage(img,sx,sy,side,side,0,0,max,max);
        let out=c.toDataURL("image/jpeg",q);
        let tries=0;
        while(out.length>180000 && tries<5){ q-=0.12; out=c.toDataURL("image/jpeg",Math.max(q,0.3)); tries++; }
        res(out);
      };
      img.src=fr.result;
    };
    fr.readAsDataURL(file);
  });
}

const NOPROJ="ບໍ່ໄດ້ລະບຸ";
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),2200);};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const alive=()=>items.filter(i=>!i.deleted);
const labelOf=it=>(it.name&&it.name.trim())?it.name.trim():("A"+(it.autoNum||"?"));
const isAuto=it=>!(it.name&&it.name.trim());
const nextNum=()=>{const u=new Set(alive().filter(i=>isAuto(i)&&i.autoNum).map(i=>i.autoNum));let n=1;while(u.has(n))n++;return n;};
const who=e=>{const s=staff.find(x=>(x.email||"").toLowerCase()===(e||"").toLowerCase());return (s&&s.name)?s.name:(e||"").split("@")[0];};
function parseName(v,fb){const s=(v||"").trim();if(!s)return{name:"",autoNum:fb};
  const m=s.match(/^[Aa](\d+)$/);if(m)return{name:"",autoNum:parseInt(m[1],10)};return{name:s,autoNum:null};}
function segBind(sel,cb){$(sel).addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  [...$(sel).children].forEach(x=>x.setAttribute("aria-pressed",String(x===b)));cb(b.dataset.s||b.dataset.f);});}
function segSet(sel,v){[...$(sel).children].forEach(x=>x.setAttribute("aria-pressed",String((x.dataset.s||x.dataset.f)===v)));}
/* ══ ໂຄງການ: ເລືອກໄດ້ຫຼາຍໂຄງການພ້ອມກັນ (ກົດປຸ່ມເພື່ອເລືອກ / ກົດອີກເທື່ອເພື່ອເອົາອອກ) ══
   ຂໍ້ມູນໃໝ່ເກັບເປັນ projects:[...]; ຂໍ້ມູນເກົ່າທີ່ມີ project ດຽວ ຍັງອ່ານໄດ້ຄືເກົ່າ */
const projOf=it=>{
  if(Array.isArray(it.projects)) return it.projects.filter(p=>p&&p!==NOPROJ);
  return (it.project&&it.project!==NOPROJ)?[it.project]:[];
};
const projText=it=>projOf(it).join(", ");
const OTHERKEY="__other__";
function renderChips(box,selected,extras,otherOn){
  const el=$(box); if(!el) return;
  selected=selected||[];
  const list=[...PROJECTS,...(extras||[]).filter(p=>p&&!PROJECTS.includes(p))];
  el.innerHTML=list.map(p=>`<button type="button" class="chipbtn" data-p="${esc(p)}" aria-pressed="${selected.includes(p)}">${esc(p)}</button>`).join("")
    +`<button type="button" class="chipbtn other" data-p="${OTHERKEY}" aria-pressed="${!!otherOn}">+ ອື່ນໆ (ພິມເອງ)</button>`;
}
const chipBtns=box=>[...$(box).querySelectorAll(".chipbtn")];
const chipsSelected=box=>chipBtns(box).filter(b=>b.getAttribute("aria-pressed")==="true"&&b.dataset.p!==OTHERKEY).map(b=>b.dataset.p);
const otherIsOn=box=>chipBtns(box).some(b=>b.dataset.p===OTHERKEY&&b.getAttribute("aria-pressed")==="true");
function bindChips(box,other){
  $(box).addEventListener("click",e=>{
    const b=e.target.closest(".chipbtn"); if(!b) return;
    const on=b.getAttribute("aria-pressed")!=="true";
    b.setAttribute("aria-pressed",String(on));
    if(b.dataset.p===OTHERKEY){ $(other).classList.toggle("hide",!on); if(on) $(other).focus(); }
  });
}
function chipsValue(box,other){
  const sel=chipsSelected(box);
  const typed=otherIsOn(box)?$(other).value.trim().replace(/\s+/g," "):"";
  if(typed&&typed!==NOPROJ&&!sel.includes(typed)) sel.push(typed);
  return sel;
}
function resetChips(box,other){ renderChips(box,[],[],false); $(other).value=""; $(other).classList.add("hide"); }
/* ລາຍຊື່ໂຄງການປ່ຽນ (ຜູ້ດູແລເພີ່ມ/ລຶບ) → ວາດໃໝ່ ແຕ່ຮັກສາສິ່ງທີ່ເລືອກໄວ້ແລ້ວ */
function refreshChips(box){ const sel=chipsSelected(box); renderChips(box,sel,sel,otherIsOn(box)); }

/* ຖ້າພິມລາຍການໃໝ່ໄວ້ ແຕ່ລືມກົດ “ບັນທຶກ” — ເພີ່ມໃຫ້ເລີຍຕອນບັນທຶກລູກຄ້າ */
async function pendingPick(kind,sel,input){
  if($(sel).value!==ADDNEW) return null;
  const v=$(input).value.trim().replace(/\s+/g," ");
  if(!v) return null;
  if(!LISTS[kind].get().includes(v)) await listAdd(kind,v);
  return kind==="status"?idOfLabel(v):v;
}

renderChips("#a-projects"); renderChips("#e-projects");
bindChips("#a-projects","#a-project-other"); bindChips("#e-projects","#e-project-other");
fillStatusSel("#a-status",defStatus(),{withAdd:true});
fillStatusSel("#e-status",defStatus(),{withAdd:true});
fillStatusSel("#l-status","all",{withAll:true,withData:true});
fillSourceSel("#a-source",""); fillSourceSel("#e-source","");
bindListAdd("status","#a-status","#a-status-add","#a-status-new","#a-status-save",v=>{addStatus=v;});
bindListAdd("status","#e-status","#e-status-add","#e-status-new","#e-status-save",v=>{editStatus=v;});
bindListAdd("source","#a-source","#a-source-add","#a-source-new","#a-source-save",v=>{addSource=v;});
bindListAdd("source","#e-source","#e-source-add","#e-source-new","#e-source-save",v=>{editSource=v;});
$("#l-status").addEventListener("change",()=>{listFilter=$("#l-status").value;renderList();});

/* ---------- ວັນທີແບບຕົວເລກສາກົນ (ຄືກັນທຸກເຄື່ອງ) ---------- */
const pad=n=>String(n).padStart(2,"0");
function buildDate(py,pm,pd){
  const ys=[];for(let y=2030;y>=2025;y--)ys.push(y);
  $(py).innerHTML=ys.map(y=>`<option value="${y}">${y}</option>`).join("");
  $(pm).innerHTML=Array.from({length:12},(_,i)=>`<option value="${pad(i+1)}">${pad(i+1)}</option>`).join("");
  const fixDays=()=>{
    const y=+$(py).value,m=+$(pm).value,keep=$(pd).value;
    const dim=new Date(y,m,0).getDate();
    $(pd).innerHTML=Array.from({length:dim},(_,i)=>`<option value="${pad(i+1)}">${pad(i+1)}</option>`).join("");
    $(pd).value=(+keep&&+keep<=dim)?pad(+keep):$(pd).value;
  };
  $(py).addEventListener("change",fixDays);
  $(pm).addEventListener("change",fixDays);
  fixDays();
}
function setDate(py,pm,pd,iso){
  const [y,m,d]=(iso||today()).split("-");
  $(py).value=y; $(pm).value=m;
  $(py).dispatchEvent(new Event("change"));
  $(pd).value=d;
}
const getDate=(py,pm,pd)=>`${$(py).value}-${$(pm).value}-${$(pd).value}`;
buildDate("#a-y","#a-m","#a-d"); buildDate("#e-y","#e-m","#e-d");
setDate("#a-y","#a-m","#a-d",today());


/* ---------- ວັດຄວາມສູງແຖບເທິງ ເພື່ອລັອກແຖບຂ້າງໃຫ້ພໍດີ ---------- */
function syncHeaderHeight(){
  const h=document.querySelector(".topbar");
  if(h) document.documentElement.style.setProperty("--hh", h.offsetHeight+"px");
}
addEventListener("resize",syncHeaderHeight);
if(window.ResizeObserver){
  const ro=new ResizeObserver(syncHeaderHeight);
  const hb=document.querySelector(".topbar"); if(hb) ro.observe(hb);
}
setTimeout(syncHeaderHeight,300);

const GATES=["#gate","#gate-reset","#setup"];
const showGate=id=>{GATES.forEach(g=>$(g).classList.remove("on"));$("#app").classList.add("hide");
  document.querySelectorAll(".err").forEach(x=>x.classList.remove("on"));if(id)$(id).classList.add("on");scrollTo(0,0);};
const showApp=()=>{GATES.forEach(g=>$(g).classList.remove("on"));$("#app").classList.remove("hide");scrollTo(0,0);};

const AUTH_ERR={
  "auth/invalid-email":"ຮູບແບບອີເມວບໍ່ຖືກຕ້ອງ","auth/missing-password":"ກະລຸນາໃສ່ລະຫັດຜ່ານ",
  "auth/invalid-credential":"ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ","auth/wrong-password":"ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ",
  "auth/user-not-found":"ບໍ່ພົບບັນຊີນີ້ — ຕິດຕໍ່ຜູ້ຈັດການ","auth/email-already-in-use":"ອີເມວນີ້ມີບັນຊີແລ້ວ",
  "auth/weak-password":"ລະຫັດຜ່ານຕ້ອງ 6 ຕົວຂຶ້ນໄປ","auth/network-request-failed":"ເຊື່ອມຕໍ່ອິນເຕີເນັດບໍ່ໄດ້",
  "auth/too-many-requests":"ລອງຫຼາຍເທື່ອເກີນໄປ ລໍຖ້າກ່ອນ","auth/requires-recent-login":"ກະລຸນາອອກແລ້ວເຂົ້າໃໝ່ ກ່ອນປ່ຽນລະຫັດ",
  "permission-denied":"ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ — ຕິດຕໍ່ຜູ້ຈັດການ"
};
const showErr=(sel,e)=>{const b=$(sel);b.textContent=AUTH_ERR[e?.code]||e?.message||("ຜິດພາດ: "+(e?.code||""));b.classList.add("on");};

setPersistence(auth,browserLocalPersistence);
$("#email").value=LS.get("usb_email")||"";
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const b=$("#btnLogin");b.disabled=true;
  const em=$("#email").value.trim();
  try{await signInWithEmailAndPassword(auth,em,$("#pass").value);LS.set("usb_email",em);}
  catch(err){showErr("#autherr",err);}
  b.disabled=false;
});
$("#btnForgot").onclick=()=>{$("#reset-email").value=$("#email").value.trim();showGate("#gate-reset");};
$("#btnBackLogin").onclick=()=>showGate("#gate");
$("#btnSendReset").onclick=async()=>{
  const em=$("#reset-email").value.trim();
  if(!em){showErr("#reseterr",{message:"ກະລຸນາໃສ່ອີເມວ"});return;}
  const b=$("#btnSendReset");b.disabled=true;
  try{await sendPasswordResetEmail(auth,em);showGate("#gate");toast("ສົ່ງລິງຄ໌ແລ້ວ — ກວດກ່ອງ Spam ນຳ");}
  catch(e){showErr("#reseterr",e);}
  b.disabled=false;
};
$("#btnOut").onclick=()=>signOut(auth);

$("#btnChangePw").onclick=()=>{$("#pw-old").value="";$("#pw-new").value="";$("#pwerr").classList.remove("on");$("#pwsheet").classList.add("on");};
$("#btnPwCancel").onclick=()=>$("#pwsheet").classList.remove("on");
$("#pwsheet").addEventListener("click",e=>{if(e.target===$("#pwsheet"))$("#pwsheet").classList.remove("on");});
$("#btnPwSave").onclick=async()=>{
  const o=$("#pw-old").value,n=$("#pw-new").value;
  if(!o||!n){showErr("#pwerr",{message:"ກະລຸນາໃສ່ໃຫ້ຄົບ"});return;}
  if(n.length<6){showErr("#pwerr",{code:"auth/weak-password"});return;}
  const b=$("#btnPwSave");b.disabled=true;
  try{const u=auth.currentUser;
    await reauthenticateWithCredential(u,EmailAuthProvider.credential(u.email,o));
    await updatePassword(u,n);$("#pwsheet").classList.remove("on");toast("ປ່ຽນລະຫັດຜ່ານແລ້ວ ✓");
  }catch(e){showErr("#pwerr",e);}
  b.disabled=false;
};

$("#nav").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  $("#nav").querySelectorAll("button").forEach(x=>x.removeAttribute("aria-current"));
  b.setAttribute("aria-current","page");
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("on"));
  $("#v-"+b.dataset.v).classList.add("on");scrollTo(0,0);
});

/* ── ຊ່ອງເບີ: ຕັ້ງ 020 ໄວ້ລ່ວງໜ້າ / ປຸ່ມບໍ່ມີເບີ ── */
function primePhone(){
  const el=$("#a-phone");
  if(!$("#a-nophone").checked && !el.value.trim()) el.value=PH_PREFIX+" ";
}
function bindNoPhone(chk,inp){
  const sync=()=>{
    const off=$(chk).checked;
    $(inp).disabled=off;
    $(inp).classList.toggle("off",off);
    if(off) $(inp).value=""; else if(!$(inp).value.trim()) $(inp).value=PH_PREFIX+" ";
  };
  $(chk).addEventListener("change",sync);
  return sync;
}
const syncAddPhone=bindNoPhone("#a-nophone","#a-phone");
const syncEditPhone=bindNoPhone("#e-nophone","#e-phone");
$("#a-phone").addEventListener("focus",primePhone);
primePhone();

/* ── ເບີຊ້ຳ: ບອກໃຫ້ຮູ້ລ່ວງໜ້າຕັ້ງແຕ່ພິມເບີ ── */
/* ══ ປະຫວັດການຕິດຕໍ່: ທຸກຄັ້ງທີ່ບັນທຶກເບີເກົ່າຊ້ຳ ຈະເກັບວັນທີ + ສະຖານະຂອງມື້ນັ້ນໄວ້ ══
   history:[{d:"2026-09-21",st:"ມັດຈຳ 10%",by:"...",t:ເວລາ,n:ໝາຍເຫດ,pj:[ໂຄງການ]}]
   ຂໍ້ມູນເກົ່າທີ່ຍັງບໍ່ມີ history → ສ້າງຈາກ date / lastDate ໃຫ້ອັດຕະໂນມັດ */
function timeline(it){
  let h=Array.isArray(it.history)?it.history.filter(e=>e&&e.d).map(e=>({...e})):[];
  if(!h.length){
    const two=!!(it.lastDate&&it.date&&it.lastDate!==it.date);
    h=[{d:it.date||"",st:two?null:(it.status||"open"),by:it.by,synth:true}];
    if(two) h.push({d:it.lastDate,st:it.status||"open",by:it.lastBy||it.by,synth:true});
  }else{
    h.sort((a,b)=>(a.d||"").localeCompare(b.d||"")||((a.t||0)-(b.t||0)));
    const last=h[h.length-1];
    if(it.lastDate&&it.lastDate>last.d) h.push({d:it.lastDate,st:it.status||"open",by:it.lastBy||it.by,synth:true});
  }
  return h;
}
const stText=e=>e.st?statusLabel(e.st):"—";
/* ຂໍ້ຄວາມສັ້ນ: 2026-09-21 ມັດຈຳ 10% → 2026-09-22 ປິດຍອດຂາຍແລ້ວ */
function histText(it){
  const h=timeline(it); if(h.length<2) return "";
  const part=e=>e.d+(e.st?" "+statusLabel(e.st):"");
  const list=h.length>4?[part(h[0]),"…",...h.slice(-2).map(part)]:h.map(part);
  return list.join(" → ");
}
function showDupNote(){
  const box=$("#a-dup"); if(!box) return;
  const v=$("#a-phone").value;
  const d=(!$("#a-nophone").checked&&phoneOk(v))?findByPhone(v):null;
  box.classList.toggle("hide",!d);
  if(!d) return;
  const h=timeline(d);
  box.innerHTML=`ລູກຄ້າເກົ່າ: <b>${esc(labelOf(d))}</b> · ບັນທຶກຄັ້ງທຳອິດ <span class="num">${esc(h[0].d)}</span> ໂດຍ ${esc(who(d.by))}`
    +`<br>ມາແລ້ວ ${h.length} ຄັ້ງ: <span class="num">${h.map(e=>esc(e.d)+(e.st?" "+esc(statusLabel(e.st)):"")).join(" → ")}</span>`
    +`<br>ກົດບັນທຶກ = ເພີ່ມການຕິດຕໍ່ຄັ້ງທີ ${h.length+1} ໃສ່ລູກຄ້າຄົນນີ້ (ບໍ່ເພີ່ມຊ້ຳ)`;
}
$("#a-phone").addEventListener("input",showDupNote);
$("#a-nophone").addEventListener("change",showDupNote);
let addStatusTouched=false;
$("#a-status").addEventListener("change",()=>{ if($("#a-status").value!==ADDNEW) addStatusTouched=true; });

function resetAddForm(){
  $("#a-name").value="";$("#a-note").value="";
  $("#a-nophone").checked=false;syncAddPhone();$("#a-phone").value=PH_PREFIX+" ";
  setDate("#a-y","#a-m","#a-d",today());
  resetChips("#a-projects","#a-project-other");
  addStatus=defStatus();addStatusTouched=false;
  fillStatusSel("#a-status",addStatus,{withAdd:true});$("#a-status-add").classList.add("hide");
  addSource="";fillSourceSel("#a-source","");$("#a-source-add").classList.add("hide");
  showDupNote();
}

$("#btnAdd").onclick=async()=>{
  const noPhone=$("#a-nophone").checked;
  const phone=noPhone?"":$("#a-phone").value.trim();
  if(!noPhone){
    if(!phone||phone===PH_PREFIX||phone===PH_PREFIX+" "){toast("ກະລຸນາໃສ່ເບີໂທ ຫຼື ຕິກ “ບໍ່ມີເບີໂທ”");$("#a-phone").focus();return;}
    if(!phoneOk(phone)){toast("ເບີບໍ່ຄົບ — ຫຼັງ "+PH_PREFIX+" ຕ້ອງມີຢ່າງໜ້ອຍ 7 ໂຕ");$("#a-phone").focus();return;}
  }
  const b=$("#btnAdd");b.disabled=true;
  const projs=chipsValue("#a-projects","#a-project-other");
  const dt=getDate("#a-y","#a-m","#a-d");
  const note=$("#a-note").value.trim();
  const typedName=$("#a-name").value.trim();
  try{
    /* ພິມລາຍການໃໝ່ໄວ້ແຕ່ລືມກົດບັນທຶກ → ເພີ່ມໃຫ້ເລີຍ */
    const pSt=await pendingPick("status","#a-status","#a-status-new");
    if(pSt){addStatus=pSt;addStatusTouched=true;}
    const pSrc=await pendingPick("source","#a-source","#a-source-new");
    if(pSrc) addSource=pSrc;
    const src=addSource||"";
    const dup=noPhone?null:findByPhone(phone);
    if(dup){
      /* ── ເບີຊ້ຳ: ອັບເດດແຖວເກົ່າ ບໍ່ເພີ່ມໃໝ່ ──
         ໂຄງການ = ລວມຂອງເກົ່າ + ທີ່ເລືອກໃໝ່, ສະຖານະປ່ຽນສະເພາະເມື່ອເລືອກເອງ */
      const merged=[...new Set([...projOf(dup),...projs])];
      const me=auth.currentUser.email, prevLast=dup.lastDate||dup.date||"";
      const patch={projects:merged,project:merged.length?merged.join(", "):NOPROJ,
        lastDate:dt>prevLast?dt:prevLast,lastBy:me,updatedAt:serverTimestamp()};
      if(addStatusTouched) patch.status=addStatus;
      /* ບັນທຶກເຂົ້າປະຫວັດ: ວັນທີ + ສະຖານະຂອງມື້ນີ້ */
      const entry={d:dt,st:addStatusTouched?addStatus:(dup.status||"open"),by:me,t:Date.now()};
      if(note) entry.n=note;
      if(projs.length) entry.pj=projs;
      if(Array.isArray(dup.history)&&dup.history.length) patch.history=arrayUnion(entry);
      else patch.history=[...timeline(dup).map(e=>({d:e.d,st:e.st||null,by:e.by||null,t:0})),entry];
      const firstDay=timeline(dup)[0].d;
      if(src) patch.source=src;
      if(typedName){const p=parseName(typedName,dup.autoNum);patch.name=p.name;patch.autoNum=p.autoNum;}
      if(note) patch.note=(dup.note?dup.note+"\n":"")+dt+" — "+note;
      await updateDoc(doc(db,"customers",dup.id),patch);
      toast("ລູກຄ້າເກົ່າ (ຈາກ "+firstDay+") — ບັນທຶກການຕິດຕໍ່ວັນທີ "+dt+" ແລ້ວ ✓");
    }else{
      const {name,autoNum}=parseName(typedName,nextNum());
      const first={d:dt,st:addStatus,by:auth.currentUser.email,t:Date.now()};
      if(note) first.n=note;
      if(projs.length) first.pj=projs;
      await addDoc(COL,{phone,name,autoNum,nophone:noPhone,status:addStatus,
        projects:projs,project:projs.length?projs.join(", "):NOPROJ,source:src,history:[first],
        date:dt,lastDate:dt,note,by:auth.currentUser.email,deleted:false,createdAt:serverTimestamp()});
      toast("ບັນທຶກແລ້ວ ✓");
    }
    resetAddForm();
  }catch(e){toast("ບັນທຶກບໍ່ໄດ້: "+(AUTH_ERR[e.code]||e.code||e.message));}
  b.disabled=false;
};

$("#q").addEventListener("input",renderList);
$("#m-month").addEventListener("change",renderList);
function matches(it,q){if(!q)return true;
  const d=q.replace(/\D/g,"");
  if(d&&String(it.phone||"").replace(/\D/g,"").includes(d))return true;
  return labelOf(it).toLowerCase().includes(q.toLowerCase());}
function renderList(){
  const q=$("#q").value.trim(),mk=$("#m-month").value;
  const inM=it=>!mk||mk==="all"||(it.date||"").startsWith(mk);
  $("#m-count").innerHTML=nPeople(alive().filter(inM).length);
  const rows=items.filter(it=>inM(it)&&matches(it,q)&&(listFilter==="all"||(!it.deleted&&it.status===listFilter)));
  $("#list").innerHTML=rows.length?rows.map(it=>{
    const lb=labelOf(it);
    const cls=it.deleted?"gone":statusClass(it.status||"open");
    const tl=timeline(it), ht=it.deleted?"":histText(it);
    const proj=(projText(it)?` · ${esc(projText(it))}`:"")+(it.source?` · ຈາກ ${esc(it.source)}`:"");
    return `<button class="item ${it.deleted?"gone":""}" data-id="${it.id}">
      ${tagHTML(it.by,cls)}
      <span class="meta"><span class="nm">ຊື່ລູກຄ້າ: ${esc(lb)}${tl.length>1&&!it.deleted?` <i class="stbadge visits">ມາ ${tl.length} ຄັ້ງ</i>`:""}</span>
        <span class="ph num">ເບີ ${esc(fmtPhone(it.phone))}</span>
        ${it.deleted?`<span class="sub warn">ລຶບໂດຍ ${esc(who(it.deletedBy))}</span>`
                    :`<span class="sub">ເພີ່ມໂດຍ ${esc(who(it.by))}${proj}</span>`}
        ${ht?`<span class="sub hist">ປະຫວັດ: ${esc(ht)}</span>`:""}
      </span><span class="dt num">${esc(it.date||"")}</span></button>`;
  }).join(""):`<div class="empty">${q?"ບໍ່ພົບເບີ ຫຼື ຊື່ນີ້":"ຍັງບໍ່ມີລາຍການ"}</div>`;
}
document.addEventListener("click",e=>{
  const b=e.target.closest(".item[data-id], .plot[data-id]");if(!b)return;openRec(b.dataset.id);
});

function openRec(id){
  const it=items.find(x=>x.id===id);if(!it)return;
  editId=id;$("#editerr").classList.remove("on");
  if(it.deleted&&!manager){
    $("#sheetTitle").textContent="ລາຍການນີ້ຖືກລຶບແລ້ວ";
    $("#editForm").classList.add("hide");$("#viewOnly").classList.remove("hide");
    $("#roBox").innerHTML=`
      <div><span>ຊື່</span><b>${esc(labelOf(it))}</b></div>
      <div><span>ເບີໂທ</span><b class="num">${esc(it.phone||"")}</b></div>
      <div><span>ໂຄງການ</span><b>${esc(projText(it)||NOPROJ)}</b></div>
      <div><span>ເຫັນໂຄສະນາຈາກ</span><b>${esc(it.source||NOSRC)}</b></div>
      <div><span>ວັນທີ</span><b class="num">${esc(it.date||"")}</b></div>
      <div><span>ເພີ່ມໂດຍ</span><b>${esc(who(it.by))}</b></div>
      <div><span style="color:var(--red)">ຖືກລຶບໂດຍ</span><b style="color:var(--red)">${esc(who(it.deletedBy))}</b></div>
      ${histText(it)?`<div><span>ປະຫວັດ</span><b class="num">${esc(histText(it))}</b></div>`:""}`;
    $("#sheet").classList.add("on");return;
  }
  $("#sheetTitle").textContent="ແກ້ໄຂຂໍ້ມູນລູກຄ້າ";
  $("#viewOnly").classList.add("hide");$("#editForm").classList.remove("hide");
  editStatus=it.status||"open";
  $("#e-nophone").checked=isNoPhone(it);
  $("#e-phone").value=isNoPhone(it)?"":(it.phone||"");
  syncEditPhone();
  $("#e-name").value=isAuto(it)?"":it.name;
  $("#e-name").placeholder=isAuto(it)?labelOf(it)+" (ພິມຊື່ຈິງທັບໄດ້)":"";
  const pj=projOf(it);
  renderChips("#e-projects",pj,pj,false);
  $("#e-project-other").value="";$("#e-project-other").classList.add("hide");
  editSource=it.source||"";
  fillSourceSel("#e-source",editSource);$("#e-source-add").classList.add("hide");
  setDate("#e-y","#e-m","#e-d",it.date||today());
  $("#e-note").value=it.note||"";
  fillStatusSel("#e-status",editStatus,{withAdd:true});$("#e-status-add").classList.add("hide");
  renderHist(it);
  $("#roMeta").innerHTML=`<div><span>ເພີ່ມໂດຍ</span><b>${esc(who(it.by))}</b></div>
    ${it.deleted?`<div><span style="color:var(--red)">ຖືກລຶບໂດຍ</span><b style="color:var(--red)">${esc(who(it.deletedBy))}</b></div>`:""}`;
  $("#btnRestore").classList.toggle("hide",!(manager&&it.deleted));
  $("#btnDel").textContent=(manager&&it.deleted)?"ລຶບຖາວອນ":"ລຶບ";
  $("#sheet").classList.add("on");
}
/* ── ປະຫວັດການຕິດຕໍ່ ໃນໜ້າແກ້ໄຂ (ລຶບຄັ້ງທີ່ບັນທຶກຜິດໄດ້) ── */
function renderHist(it){
  const tl=timeline(it);
  const real=Array.isArray(it.history)&&it.history.length>0;
  $("#e-hist").innerHTML=`<p class="histttl">ປະຫວັດການຕິດຕໍ່ (${tl.length} ຄັ້ງ)</p>`+tl.map((e,i)=>`
    <div class="hrow">
      <span class="hdot" style="background:${e.st?statusColor(e.st):"#9AA0A6"}"></span>
      <span class="hbody"><b class="num">${esc(e.d)}</b> · ${esc(stText(e))}${i===0?' <i class="stbadge visits">ຄັ້ງທຳອິດ</i>':""}
        <small>${esc(who(e.by))}${e.pj&&e.pj.length?" · "+esc(e.pj.join(", ")):""}${e.n?" · "+esc(e.n):""}</small></span>
      ${real&&i>0&&!e.synth?`<button type="button" class="btn danger sm" data-delh="${e.t||0}" data-d="${esc(e.d)}">ລຶບ</button>`:""}
    </div>`).join("");
}
$("#e-hist").addEventListener("click",async e=>{
  const b=e.target.closest("[data-delh]"); if(!b||!editId) return;
  const cur=items.find(x=>x.id===editId); if(!cur||!Array.isArray(cur.history)) return;
  const t=+b.dataset.delh, d=b.dataset.d;
  const hist=cur.history.slice();
  const idx=hist.findIndex(x=>(x.t||0)===t&&x.d===d); if(idx<0) return;
  if(!confirm(`ລຶບການຕິດຕໍ່ວັນທີ ${d} ອອກຈາກປະຫວັດ?\n(ໃຊ້ເມື່ອບັນທຶກຜິດ)`)) return;
  const before=timeline(cur), wasLast=before[before.length-1].d===d&&(before[before.length-1].t||0)===t;
  hist.splice(idx,1);
  const after=timeline({...cur,history:hist,lastDate:null});
  const last=after[after.length-1];
  const patch={history:hist,lastDate:(last&&last.d)||cur.date};
  if(wasLast&&last&&last.st) patch.status=last.st;
  try{
    await updateDoc(doc(db,"customers",editId),patch);
    Object.assign(cur,patch);
    if(patch.status){ editStatus=patch.status; fillStatusSel("#e-status",editStatus,{withAdd:true}); }
    renderHist(cur); toast("ລຶບອອກຈາກປະຫວັດແລ້ວ");
  }catch(err){ showErr("#editerr",err); }
});
const closeSheet=()=>{$("#sheet").classList.remove("on");editId=null;};
$("#btnCancel").onclick=closeSheet;$("#btnCloseRo").onclick=closeSheet;
$("#sheet").addEventListener("click",e=>{if(e.target===$("#sheet"))closeSheet();});

$("#btnSave").onclick=async()=>{
  if(!editId)return;const cur=items.find(x=>x.id===editId);
  const {name,autoNum}=parseName($("#e-name").value,isAuto(cur)?cur.autoNum:nextNum());
  const eNo=$("#e-nophone").checked;
  const ePh=eNo?"":$("#e-phone").value.trim();
  if(!eNo&&!phoneOk(ePh)){showErr("#editerr",{message:"ເບີບໍ່ຄົບ — ຫຼັງ "+PH_PREFIX+" ຕ້ອງມີຢ່າງໜ້ອຍ 7 ໂຕ"});return;}
  const other=eNo?null:alive().find(x=>x.id!==editId&&samePhone(x.phone,ePh));
  if(other){showErr("#editerr",{message:"ເບີນີ້ມີຢູ່ແລ້ວໃນລາຍຊື່ — ("+who(other.by)+" ເປັນຜູ້ບັນທຶກ)"});return;}
  const b=$("#btnSave");b.disabled=true;
  try{
    const pSt=await pendingPick("status","#e-status","#e-status-new"); if(pSt) editStatus=pSt;
    const pSrc=await pendingPick("source","#e-source","#e-source-new"); if(pSrc) editSource=pSrc;
    const projs=chipsValue("#e-projects","#e-project-other");
    await updateDoc(doc(db,"customers",editId),{phone:ePh,nophone:eNo,name,autoNum,
      status:editStatus,projects:projs,project:projs.length?projs.join(", "):NOPROJ,source:editSource||"",
      date:getDate("#e-y","#e-m","#e-d"),note:$("#e-note").value.trim()});
    closeSheet();toast("ແກ້ໄຂແລ້ວ ✓");
  }catch(e){showErr("#editerr",e);}
  b.disabled=false;
};
$("#btnDel").onclick=async()=>{
  if(!editId)return;const cur=items.find(x=>x.id===editId);
  try{
    if(cur.deleted&&manager){
      if(!confirm("ລຶບຖາວອນ? ກູ້ຄືນບໍ່ໄດ້ອີກ"))return;
      await deleteDoc(doc(db,"customers",editId));toast("ລຶບຖາວອນແລ້ວ");
    }else{
      if(!confirm("ຢືນຢັນລຶບ? ລາຍການຈະຍັງສະແດງເປັນສີແດງ ພ້ອມຊື່ຜູ້ລຶບ"))return;
      await updateDoc(doc(db,"customers",editId),{deleted:true,deletedBy:auth.currentUser.email,deletedAt:serverTimestamp()});
      toast("ລຶບແລ້ວ — ບັນທຶກຜູ້ລຶບໄວ້");
    }
    closeSheet();
  }catch(e){showErr("#editerr",e);}
};
$("#btnRestore").onclick=async()=>{
  if(!editId)return;
  try{await updateDoc(doc(db,"customers",editId),{deleted:false,deletedBy:null,deletedAt:null});
    closeSheet();toast("ກູ້ຄືນແລ້ວ ✓");}catch(e){showErr("#editerr",e);}
};

function monthKeys(){
  const s=new Set(items.map(i=>(i.date||"").slice(0,7)).filter(Boolean));
  const d=new Date();s.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  return [...s].sort().reverse();
}
function fillMonths(sel){
  const el=$(sel),keep=el.value,ks=monthKeys();
  el.innerHTML=`<option value="all">ທັງໝົດ</option>`+ks.map(k=>`<option value="${k}">${k}</option>`).join("");
  el.value=(ks.includes(keep)||keep==="all")?keep:(ks[0]||"all");
}

/* ══════════ ສະຫຼຸບ: ແຖບ “ລາຍເດືອນ” / “ລາຍວັນ” ══════════ */
let sumMode=LS.get("usb_summode")==="day"?"day":"month";
function setSumMode(m){
  sumMode=m==="day"?"day":"month";
  [...$("#sumtabs").querySelectorAll("button[data-m]")].forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.m===sumMode)));
  $("#sum-month").classList.toggle("hide",sumMode!=="month");
  $("#sum-day").classList.toggle("hide",sumMode!=="day");
  LS.set("usb_summode",sumMode);
}
$("#sumtabs").addEventListener("click",e=>{const b=e.target.closest("button[data-m]");if(b)setSumMode(b.dataset.m);});
setSumMode(sumMode);

$("#s-month").addEventListener("change",renderSummary);
$("#s-project").addEventListener("change",renderSummary);
function bar(label,n,max,color,pct){
  const c=color||"var(--orange)";
  const p=(pct==null)?"":`<span class="pct">${pct}%</span>`;
  return `<div class="pbar"><div class="top"><span><i class="dot" style="background:${c}"></i>${esc(label)}</span><b class="num">${nPeople(n)}${p}</b></div>
    <div class="track"><div class="fill" style="width:${max?Math.round(n/max*100):0}%;background:${c}"></div></div></div>`;
}
const projColor=p=>{if(!p||p===NOPROJ) return "#9AA0A6";const i=PROJECTS.indexOf(p);
  return PALETTE[(i>=0?i:hashIdx(p,PALETTE.length))%PALETTE.length];};
function groupBy(rows,keysOf){
  const m=new Map();
  rows.forEach(r=>{const ks=keysOf(r);(ks.length?ks:[""]).forEach(k=>m.set(k,(m.get(k)||0)+1));});
  return [...m].map(([k,n])=>({k,n})).sort((a,b)=>b.n-a.n||String(a.k).localeCompare(String(b.k)));
}
/* ກຣາຟ 3 ອັນ (ສະຖານະ / ໂຄງການ / ເຫັນໂຄສະນາຈາກໃສ) — ໃຊ້ຮ່ວມກັນທັງໜ້າຈໍ ແລະ ລາຍງານ PDF/ຮູບ */
function breakdowns(rows){
  return {
    st:groupBy(rows,r=>[r.status||"open"]).map(x=>({label:statusLabel(x.k),n:x.n,color:statusColor(x.k)})),
    pj:groupBy(rows,r=>projOf(r)).map(x=>({label:x.k||NOPROJ,n:x.n,color:projColor(x.k)})),
    sr:groupBy(rows,r=>[r.source||""]).map(x=>({label:x.k||NOSRC,n:x.n,color:sourceColor(x.k)})),
    multi:rows.some(r=>projOf(r).length>1)
  };
}
const MULTI_NOTE=`<p class="hint">ລູກຄ້າ 1 ຄົນ ເລືອກໄດ້ຫຼາຍໂຄງການ — ລວມເປີເຊັນຈຶ່ງອາດເກີນ 100%</p>`;
function barsHTML(list,total,empty){
  if(!list.length) return `<div class="empty">${empty||"ບໍ່ມີຂໍ້ມູນ"}</div>`;
  const mx=Math.max(1,...list.map(x=>x.n));
  return list.map(x=>bar(x.label,x.n,mx,x.color,total?Math.round(x.n/total*100):0)).join("");
}
/* ແຖວລູກຄ້າ (ໜ້າສະຫຼຸບ) */
function custRow(it,opt){
  opt=opt||{};
  const st=it.status||"open", by=opt.by||it.by;
  const sub=[`(${esc(who(by))})`,projText(it)?esc(projText(it)):"",it.source?"ຈາກ "+esc(it.source):""].filter(Boolean).join(" · ");
  const tl=timeline(it), ht=histText(it);
  const oldLine=opt.old?`<span class="sub hist">ລູກຄ້າເກົ່າ ຈາກວັນທີ ${esc(opt.old.first)} · ມາຄັ້ງທີ ${opt.old.visit}${ht?" — "+esc(ht):""}</span>`
    :(ht?`<span class="sub hist">ປະຫວັດ: ${esc(ht)}</span>`:"");
  return `<button class="item" data-id="${it.id}">
      ${tagHTML(by,statusClass(st))}
      <span class="meta">
        <span class="nm">${esc(labelOf(it))} <i class="stbadge" style="background:${statusColor(st)}">${esc(statusLabel(st))}</i>${opt.old?' <i class="stbadge visits">ລູກຄ້າເກົ່າ</i>':(tl.length>1?` <i class="stbadge visits">ມາ ${tl.length} ຄັ້ງ</i>`:"")}</span>
        <span class="ph num">${esc(fmtPhone(it.phone))}</span>
        <span class="sub">${sub}</span>
        ${oldLine}
      </span>
      ${opt.noDate?"":`<span class="dt num">${esc(it.date||"")}</span>`}</button>`;
}

function monthScope(){
  const mk=$("#s-month").value||"all", pj=$("#s-project").value||"all";
  const inM=it=>mk==="all"||(it.date||"").startsWith(mk);
  const inP=it=>{if(pj==="all")return true;const p=projOf(it);return pj===NOPROJ?!p.length:p.includes(pj);};
  const inScope=it=>inM(it)&&inP(it);
  const rows=alive().filter(inScope).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const gone=items.filter(i=>i.deleted&&inScope(i));
  const ems=[...new Set(items.filter(inScope).map(i=>i.by).filter(Boolean))];
  const users=ems.map(em=>{const a=rows.filter(r=>r.by===em);
    return {em,name:who(em),n:a.length,sold:a.filter(r=>r.status==="sold").length,
      del:items.filter(x=>x.deleted&&inScope(x)&&x.deletedBy===em).length};}).sort((a,b)=>b.n-a.n);
  return {mk,pj,rows,gone,users,
    sold:rows.filter(r=>r.status==="sold").length,
    open:rows.filter(r=>(r.status||"open")==="open").length,
    nop:rows.filter(isNoPhone).length};
}

function renderSummary(){
  fillMonths("#s-month");
  fillSumProjects();
  const S=monthScope(), rows=S.rows, total=rows.length;
  const pc=n=>total?Math.round(n/total*100):0;
  $("#s-total").innerHTML=nPeople(total);
  $("#s-sold").innerHTML=nPeople(S.sold);
  $("#s-open").innerHTML=nPeople(S.open);
  $("#s-del").innerHTML=nPeople(S.gone.length);

  const B=breakdowns(rows);
  $("#bystatus").innerHTML=barsHTML(B.st,total);
  if(B.st.length){ $("#s-top").textContent=pc(B.st[0].n)+"%"; $("#s-toplab").textContent=B.st[0].label; }
  else{ $("#s-top").textContent="—"; $("#s-toplab").textContent="ສະຖານະທີ່ພົບຫຼາຍສຸດ"; }
  $("#byproject").innerHTML=barsHTML(B.pj,total)+(B.multi?MULTI_NOTE:"");
  $("#bysource").innerHTML=barsHTML(B.sr,total);

  /* ── ລາຍຊື່ລູກຄ້າ: ຊື່ + ເບີ + (ໃຜເພີ່ມ) ── */
  $("#custlist").innerHTML=rows.length?rows.map(it=>custRow(it)).join(""):`<div class="empty">ບໍ່ມີຂໍ້ມູນ</div>`;

  /* ── ຜົນງານແຕ່ລະຄົນ ── */
  $("#byuser").innerHTML=S.users.length?S.users.map((u,i)=>{
    const c=colorOf(u.em,i);
    return `<div class="item" style="border-left:5px solid ${c};padding-left:10px">${tagHTML(u.em)}
      <span class="meta"><span class="nm">${esc(u.name)}</span>
      <span class="sub num">ເພີ່ມ ${u.n} ຄົນ · ຂາຍໄດ້ ${u.sold} ຄົນ · ຍົກເລີກ ${u.del} ຄົນ</span></span></div>`;
  }).join(""):`<div class="empty">ບໍ່ມີຂໍ້ມູນ</div>`;

  /* ── ລາຍການທີ່ຍົກເລີກ ── */
  $("#deleted").innerHTML=S.gone.length?S.gone.map(it=>`
    <button class="item gone" data-id="${it.id}">${tagHTML(it.by,"gone")}
      <span class="meta"><span class="nm">ຊື່ລູກຄ້າ: ${esc(labelOf(it))}</span><span class="ph num">ເບີ ${esc(fmtPhone(it.phone))}</span>
      <span class="sub warn">ຍົກເລີກໂດຍ ${esc(who(it.deletedBy))}</span></span>
      <span class="dt num">${esc(it.date||"")}</span></button>`).join(""):`<div class="empty">ບໍ່ມີລາຍການທີ່ຍົກເລີກ</div>`;
}

/* ══════════ ສະຫຼຸບລາຍວັນ ══════════ */
function dayKeys(){
  const set=new Set();
  items.filter(i=>!i.deleted).forEach(i=>{ if(i.date)set.add(i.date); if(i.lastDate)set.add(i.lastDate);
    timeline(i).forEach(e=>{ if(e.d) set.add(e.d); }); });
  set.add(today());
  return [...set].sort().reverse();
}
function fillDays(){
  const el=$("#d-day"); if(!el) return;
  const keep=el.value, ks=dayKeys();
  el.innerHTML=ks.map(k=>`<option value="${k}">${k}</option>`).join("");
  el.value=ks.includes(keep)?keep:(ks[0]||today());
}
/* ລູກຄ້າຂອງມື້: ໃໝ່ (ບັນທຶກມື້ນັ້ນ) + ເບີເກົ່າທີ່ຕິດຕໍ່ມາອີກໃນມື້ນັ້ນ */
/* ໃຊ້ປະຫວັດ: ລູກຄ້າທີ່ມີການຕິດຕໍ່ໃນມື້ນັ້ນ + ສະຖານະ “ຂອງມື້ນັ້ນ” (ບໍ່ແມ່ນສະຖານະລ່າສຸດ)
   ເຊັ່ນ ມັດຈຳ 21 → ປິດການຂາຍ 22: ມື້ 21 ສະແດງ “ມັດຈຳ”, ມື້ 22 ສະແດງ “ປິດຍອດ · ລູກຄ້າເກົ່າຈາກ 21” */
function dayData(d){
  const all=[];
  alive().forEach(it=>{
    const tl=timeline(it);
    const idx=tl.map(e=>e.d).lastIndexOf(d);
    if(idx<0) return;
    const e=tl[idx];
    all.push({...it,status:e.st||it.status||"open",_by:e.by||it.by,_first:tl[0].d,_visit:idx+1,_new:tl[0].d===d,_note:e.n||""});
  });
  const fresh=all.filter(r=>r._new), upd=all.filter(r=>!r._new);
  all.splice(0,all.length,...fresh,...upd);
  const byOf=i=>i._by||i.by;
  const ems=[...new Set(all.map(byOf).filter(Boolean))];
  const users=ems.map(em=>{const a=all.filter(r=>byOf(r)===em);
    return {em,name:who(em),n:a.length,sold:a.filter(r=>r.status==="sold").length};}).sort((a,b)=>b.n-a.n);
  return {d,fresh,upd,all,users,byOf,
    sold:all.filter(i=>i.status==="sold").length,
    nop:all.filter(isNoPhone).length};
}
function renderDaily(){
  if(!$("#d-day")) return;
  fillDays();
  const D=dayData($("#d-day").value);
  $("#d-total").innerHTML=nPeople(D.all.length);
  $("#d-caption").textContent=D.d===today()?"ລູກຄ້າໃນມື້ນີ້":"ລູກຄ້າວັນທີ "+D.d;
  $("#d-new").innerHTML=nPeople(D.fresh.length);
  $("#d-upd").innerHTML=nPeople(D.upd.length);
  $("#d-sold").innerHTML=nPeople(D.sold);
  $("#d-nop").innerHTML=nPeople(D.nop);
  const B=breakdowns(D.all), tot=D.all.length, none="ບໍ່ມີຂໍ້ມູນໃນວັນທີນີ້";
  $("#d-status").innerHTML=barsHTML(B.st,tot,none);
  $("#d-proj").innerHTML=barsHTML(B.pj,tot,none)+(B.multi?MULTI_NOTE:"");
  $("#d-source").innerHTML=barsHTML(B.sr,tot,none);
  $("#d-list").innerHTML=D.all.length
    ?D.all.map(it=>custRow(it,{noDate:true,by:D.byOf(it),old:it._new?null:{first:it._first,visit:it._visit}})).join("")
    :`<div class="empty">${none}</div>`;
  const el=$("#d-day");
  $("#d-prev").disabled=el.selectedIndex>=el.options.length-1;
  $("#d-next").disabled=el.selectedIndex<=0;
}
$("#d-day").addEventListener("change",renderDaily);
$("#d-prev").onclick=()=>{const el=$("#d-day");const i=el.selectedIndex;if(i<el.options.length-1){el.selectedIndex=i+1;renderDaily();}};
$("#d-next").onclick=()=>{const el=$("#d-day");const i=el.selectedIndex;if(i>0){el.selectedIndex=i-1;renderDaily();}};

function fillSumProjects(){
  const el=$("#s-project"); if(!el) return;
  const keep=el.value;
  const set=new Set(PROJECTS); let none=false;
  items.forEach(i=>{const p=projOf(i); if(!p.length) none=true; p.forEach(x=>set.add(x));});
  const present=[...set]; if(none) present.push(NOPROJ);
  el.innerHTML=`<option value="all">ທຸກໂຄງການ</option>`+present.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join("");
  el.value=(keep&&(keep==="all"||present.includes(keep)))?keep:"all";
}

/* ══════════ ກ່ອງ “ລາຍການທີ່ບັນທຶກ” ຂ້າງຟອມ ══════════ */
function renderToday(){
  if(!$("#t-today")) return;
  const t=today(), mk=t.slice(0,7), a=alive();
  const D=dayData(t);
  const mon=a.filter(i=>(i.date||"").startsWith(mk));
  $("#t-today").innerHTML=nPeople(D.all.length);
  $("#t-month").innerHTML=nPeople(mon.length);
  $("#t-sold").innerHTML=nPeople(mon.filter(i=>i.status==="sold").length);
  /* ລ່າສຸດຢູ່ເທິງ (ລາຍການທີ່ກຳລັງບັນທຶກ ເວລາຍັງບໍ່ມາຈາກເຊີບເວີ ໃຫ້ຢູ່ເທິງສຸດ) */
  const ts=i=>(i.createdAt===null||i.updatedAt===null)?9e15:Math.max((i.updatedAt&&i.updatedAt.seconds)||0,(i.createdAt&&i.createdAt.seconds)||0);
  const latest=D.all.slice().sort((x,y)=>ts(y)-ts(x)).slice(0,8);
  $("#todaylist").innerHTML=latest.length?latest.map(it=>{
    const st=it.status||"open", by=it._by||it.by;
    return `<button class="item" data-id="${it.id}">${tagHTML(by,statusClass(st))}
      <span class="meta"><span class="nm">${esc(labelOf(it))}${it._new?"":' <i class="stbadge visits">ລູກຄ້າເກົ່າ</i>'}</span>
        <span class="ph num">${esc(fmtPhone(it.phone))}</span>
        <span class="sub">${esc(statusLabel(st))} · ${esc(who(by))}${it._new?"":" · ຈາກວັນທີ "+esc(it._first)}</span></span></button>`;
  }).join("")+(D.all.length>latest.length?`<p class="hint" style="text-align:center">ແລະ ອີກ ${D.all.length-latest.length} ຄົນ — ເບິ່ງທັງໝົດໃນ “ສະຫຼຸບລາຍວັນ”</p>`:"")
  :`<div class="empty">ມື້ນີ້ຍັງບໍ່ມີການບັນທຶກ</div>`;
}

const renderAll=()=>{
  fillMonths("#m-month");
  fillStatusSel("#l-status",listFilter,{withAll:true,withData:true});
  renderList();renderSummary();renderDaily();renderToday();
  renderProjects();renderStatuses();renderSources();
  $("#a-hint").textContent="A"+nextNum();
  showDupNote();
};

/* ── ປຸ່ມບັນທຶກລາຍງານ (PDF / ຮູບ) — ໃຊ້ໄດ້ທັງຄອມ ແລະ ໂທລະສັບ ── */
$("#btnMonPdf").onclick=()=>makeReport("month","pdf");
$("#btnMonImg").onclick=()=>makeReport("month","png");
$("#btnDayPdf").onclick=()=>makeReport("day","pdf");
$("#btnDayImg").onclick=()=>makeReport("day","png");

/* ══════════════════════════════════════════════════════════════
   ລາຍງານ PDF / ຮູບ — ວາດເອງດ້ວຍ canvas (ບໍ່ພຶ່ງໄລບຣາຣີພາຍນອກ)
   ໜ້າ A4 = 1240×1754 px (≈150 dpi) · PDF ຫຼາຍໜ້າ · ຮູບ = ແຜ່ນດຽວ
   ══════════════════════════════════════════════════════════════ */
const RW=1240, RH=1754, RM=64, IMG_MAX_ROWS=40;
const RFONT='Phetsarath, "Noto Sans Lao", "Lao Sangam MN", "Lao UI", sans-serif';
const rf=(sz,w)=>`${w||400} ${sz}px ${RFONT}`;
const C_INK="#1A1D26", C_MUTED="#6E7480", C_LINE="#DCDDD8", C_NAVY="#16255A", C_ORANGE="#C4620E";
async function reportFonts(){
  try{
    if(document.fonts&&document.fonts.load){
      const t="ລາຍງານ 0123456789 ABC";
      await Promise.race([
        Promise.all([document.fonts.load(rf(30,400),t),document.fonts.load(rf(30,700),t)]),
        new Promise(r=>setTimeout(r,3000))]);
    }
  }catch(_){}
}
let _logo;
function reportLogo(){
  if(_logo!==undefined) return Promise.resolve(_logo);
  return new Promise(res=>{
    const im=new Image(); let done=false;
    const fin=v=>{if(!done){done=true;_logo=v;res(v);}};
    im.onload=()=>fin(im); im.onerror=()=>fin(null);
    im.src="logo-white.png"; setTimeout(()=>fin(null),4000);
  });
}
/* ຕັດຂໍ້ຄວາມໃຫ້ພໍດີຊ່ອງ ແລ້ວໃສ່ “…” (ບໍ່ຕັດສະຫຼະອອກຈາກພະຍັນຊະນະ) */
const SEG=(typeof Intl!=="undefined"&&Intl.Segmenter)?new Intl.Segmenter("lo",{granularity:"grapheme"}):null;
const graphemes=t=>SEG?[...SEG.segment(t)].map(x=>x.segment):Array.from(t);
function fit(x,text,maxW){
  text=String(text??"");
  if(maxW<=0) return "";
  if(x.measureText(text).width<=maxW) return text;
  const g=graphemes(text); let lo=0,hi=g.length;
  while(lo<hi){const mid=(lo+hi+1)>>1; if(x.measureText(g.slice(0,mid).join("")+"…").width<=maxW) lo=mid; else hi=mid-1;}
  return g.slice(0,lo).join("")+"…";
}
function rrect(x,px,py,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  x.beginPath();
  x.moveTo(px+r,py); x.arcTo(px+w,py,px+w,py+h,r); x.arcTo(px+w,py+h,px,py+h,r);
  x.arcTo(px,py+h,px,py,r); x.arcTo(px,py,px+w,py,r); x.closePath();
}
function txt(x,t,px,py,font,color,align,maxW){
  x.font=font; x.fillStyle=color; x.textAlign=align||"left";
  x.fillText(maxW?fit(x,t,maxW):String(t),px,py);
}
const nowStamp=()=>{const d=new Date();return today()+" "+pad(d.getHours())+":"+pad(d.getMinutes());};

/* ── ຂໍ້ມູນລາຍງານ (ໃຊ້ຕົວກັ່ນຕອງດຽວກັບໜ້າຈໍ) ── */
function reportData(kind){
  if(kind==="day"){
    const D=dayData($("#d-day").value);
    return {kind,title:"ລາຍງານລູກຄ້າປະຈຳວັນ",period:"ວັນທີ "+D.d,sub:"",file:"USABAI-daily-"+D.d,
      tiles:[["ລູກຄ້າທັງໝົດ",D.all.length,C_NAVY],["ລູກຄ້າໃໝ່",D.fresh.length,"#2B4C7E"],["ລູກຄ້າເກົ່າກັບມາ",D.upd.length,C_MUTED],
             ["ປິດຍອດຂາຍ",D.sold,"#2E6B4C"],["ບໍ່ມີເບີໂທ",D.nop,"#8A6D3B"]],
      rows:D.all,B:breakdowns(D.all),users:D.users,gone:[],byOf:D.byOf,day:D.d};
  }
  const S=monthScope();
  const pjAll=S.pj==="all";
  return {kind,title:"ລາຍງານລູກຄ້າປະຈຳເດືອນ",period:S.mk==="all"?"ທຸກເດືອນ":"ເດືອນ "+S.mk,
    sub:"ໂຄງການ: "+(pjAll?"ທຸກໂຄງການ":S.pj),
    file:"USABAI-monthly-"+(S.mk==="all"?"all":S.mk)+(pjAll?"":"-"+(PROJECTS.indexOf(S.pj)+1||"x")),
    tiles:[["ລູກຄ້າທັງໝົດ",S.rows.length,C_NAVY],["ປິດຍອດຂາຍແລ້ວ",S.sold,"#2E6B4C"],["ຜູ້ສົນໃຈ",S.open,"#2B4C7E"],
           ["ບໍ່ມີເບີໂທ",S.nop,C_MUTED],["ຍົກເລີກ (ພິມເບີຜິດ)",S.gone.length,"#B3261E"]],
    rows:S.rows,B:breakdowns(S.rows),users:S.users,byOf:i=>i.by,
    gone:S.gone.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""))};
}

/* ── ກ່ອງກຣາຟແທ່ງ ── */
function chartBlock(title,list,total,note){
  const MAXB=8; let L=list.slice();
  if(L.length>MAXB){const rest=L.slice(MAXB-1); L=L.slice(0,MAXB-1);
    L.push({label:`ອື່ນໆ (${rest.length} ລາຍການ)`,n:rest.reduce((a,b)=>a+b.n,0),color:"#9AA0A6"});}
  const h=78+Math.max(1,L.length)*58+(note?36:0)+14;
  const draw=(x,bx,by,bw,bh)=>{
    x.fillStyle="#fff"; rrect(x,bx,by,bw,bh,16); x.fill();
    x.strokeStyle=C_LINE; x.lineWidth=2; x.stroke();
    x.fillStyle=C_ORANGE; rrect(x,bx+24,by+24,6,30,3); x.fill();
    txt(x,title,bx+42,by+49,rf(24,700),C_NAVY,"left",bw-66);
    if(!L.length){ txt(x,"ບໍ່ມີຂໍ້ມູນ",bx+bw/2,by+bh/2+14,rf(21,400),C_MUTED,"center"); return; }
    const mx=Math.max(1,...L.map(v=>v.n)), iw=bw-48;
    L.forEach((v,i)=>{
      const y0=by+84+i*58;
      const right=v.right||(v.n+" ຄົນ · "+(total?Math.round(v.n/total*100):0)+"%");
      x.font=rf(20,400); const rw=x.measureText(right).width;
      x.fillStyle=v.color||C_ORANGE; rrect(x,bx+24,y0+3,13,13,3); x.fill();
      txt(x,v.label,bx+46,y0+17,rf(21,400),C_INK,"left",iw-rw-40);
      txt(x,right,bx+bw-24,y0+17,rf(20,700),C_MUTED,"right");
      x.fillStyle="#ECECE8"; rrect(x,bx+24,y0+30,iw,12,6); x.fill();
      x.fillStyle=v.color||C_ORANGE; rrect(x,bx+24,y0+30,Math.max(12,iw*v.n/mx),12,6); x.fill();
    });
    if(note) txt(x,note,bx+24,by+bh-24,rf(17,400),C_MUTED,"left",iw);
  };
  return {h,draw};
}
/* ── ສ່ວນປະກອບຂອງລາຍງານ (ແຕ່ລະກ້ອນຮູ້ຄວາມສູງຂອງຕົນ → ແບ່ງໜ້າ A4 ໄດ້) ── */
function tableCols(kind){
  return kind==="day"
    ?[{k:"i",t:"#",w:52},{k:"name",t:"ລູກຄ້າ",w:170},{k:"phone",t:"ເບີໂທ",w:160},{k:"status",t:"ສະຖານະມື້ນີ້",w:170},
      {k:"proj",t:"ໂຄງການ",w:170},{k:"src",t:"ເຫັນຈາກ",w:110},{k:"by",t:"ຜູ້ບັນທຶກ",w:110},{k:"type",t:"ລູກຄ້າ ໃໝ່/ເກົ່າ",w:170}]
    :[{k:"i",t:"#",w:52},{k:"date",t:"ວັນທີ",w:120},{k:"name",t:"ລູກຄ້າ",w:196},{k:"phone",t:"ເບີໂທ",w:150},
      {k:"status",t:"ສະຖານະ",w:160},{k:"proj",t:"ໂຄງການ",w:180},{k:"src",t:"ເຫັນຈາກ",w:120},{k:"by",t:"ຜູ້ບັນທຶກ",w:134}];
}
const GONE_COLS=[{t:"#",w:52},{t:"ວັນທີ",w:120},{t:"ລູກຄ້າ",w:196},{t:"ເບີໂທ",w:150},{t:"ໝາຍເຫດ",w:594}];
function heroBlock(R,logo){return {type:"hero",h:252,draw:(x,y)=>{
  x.fillStyle=C_ORANGE; x.fillRect(0,y,RW,220);
  x.fillStyle=C_NAVY; x.fillRect(0,y,RW,10);
  let tx=RM;
  if(logo){const lh=128, lw=logo.width*lh/logo.height; x.drawImage(logo,RM,y+48,lw,lh); tx=RM+lw+30;}
  const me=auth.currentUser?who(auth.currentUser.email):"";
  const st="ພິມ "+nowStamp();
  x.font=rf(19,400); const rw=Math.min(300,Math.max(x.measureText(st).width,me?x.measureText("ໂດຍ "+me).width:0));
  txt(x,st,RW-RM,y+62,rf(19,400),"#fff","right");
  if(me) txt(x,"ໂດຍ "+me,RW-RM,y+90,rf(19,400),"#fff","right",300);
  txt(x,R.title,tx,y+100,rf(44,700),"#fff","left",RW-RM-tx-rw-24);
  txt(x,"ບໍລິສັດ ຢູ່ສະບາຍ ແລນ ແອນ ເຮົາສ໌ · ໂຄງການດິນຈັດສັນ",tx,y+142,rf(23,400),"#fff","left",RW-RM-tx);
  txt(x,R.period+(R.sub?"   ·   "+R.sub:""),tx,y+190,rf(29,700),"#fff","left",RW-RM-tx);
}};}
function tilesBlock(R){return {type:"tiles",h:172,draw:(x,y)=>{
  const n=R.tiles.length, gap=16, w=(RW-2*RM-gap*(n-1))/n;
  R.tiles.forEach(([lab,v,col],i)=>{
    const bx=RM+i*(w+gap);
    x.fillStyle="#fff"; rrect(x,bx,y,w,150,16); x.fill();
    x.save(); rrect(x,bx,y,w,150,16); x.clip(); x.fillStyle=col; x.fillRect(bx,y,w,8); x.restore();
    x.strokeStyle=C_LINE; x.lineWidth=2; rrect(x,bx,y,w,150,16); x.stroke();
    const num=String(v);
    x.font=rf(54,700); const nw=x.measureText(num).width;
    x.font=rf(22,400); const uw=x.measureText("ຄົນ").width;
    const sx=bx+w/2-(nw+8+uw)/2;
    txt(x,num,sx,y+88,rf(54,700),col,"left");
    txt(x,"ຄົນ",sx+nw+8,y+88,rf(22,400),C_MUTED,"left");
    txt(x,lab,bx+w/2,y+128,rf(20,400),C_MUTED,"center",w-20);
  });
}};}
function chartRowBlock(a,b){const h=Math.max(a.h,b?b.h:0);return {type:"charts",h:h+20,draw:(x,y)=>{
  const w=(RW-2*RM-24)/2; a.draw(x,RM,y,w,h); if(b) b.draw(x,RM+w+24,y,w,h);
}};}
function sectionBlock(t){return {type:"section",h:72,keep:true,draw:(x,y)=>{
  x.fillStyle=C_ORANGE; rrect(x,RM,y+22,6,30,3); x.fill();
  txt(x,t,RM+18,y+47,rf(26,700),C_NAVY,"left",RW-2*RM-18);
}};}
function theadBlock(cols){return {type:"thead",h:50,draw:(x,y)=>{
  x.fillStyle=C_NAVY; rrect(x,RM,y,RW-2*RM,46,8); x.fill();
  let cx=RM; cols.forEach(c=>{txt(x,c.t,cx+10,y+30,rf(18,700),"#fff","left",c.w-20); cx+=c.w;});
}};}
/* ແຖວລູກຄ້າ — ຖ້າມາຫຼາຍຄັ້ງ ຈະມີແຖວນ້ອຍລຸ່ມ: ປະຫວັດ 2026-09-21 ມັດຈຳ → 2026-09-22 ປິດຍອດ */
function rowBlock(R,cols,it,i){
  const ht=histText(it), H=ht?70:44;
  return {type:"row",h:H,draw:(x,y)=>{
  if(i%2===1){x.fillStyle="#F5F5F2"; x.fillRect(RM,y,RW-2*RM,H);}
  const st=it.status||"open", old=!!(R.day&&it._new===false);
  const v={i:String(i+1),date:it.date||"",name:labelOf(it),phone:fmtPhone(it.phone),status:statusLabel(st),
    proj:projText(it)||"—",src:it.source||"—",by:who(R.byOf(it)),type:old?"ເກົ່າ ຈາກ "+it._first:"ໃໝ່"};
  const upd=old;
  let cx=RM;
  cols.forEach(c=>{
    let tx=cx+10, w=c.w-20;
    if(c.k==="status"){x.fillStyle=statusColor(st); x.beginPath(); x.arc(tx+6,y+22,6,0,Math.PI*2); x.fill(); tx+=18; w-=18;}
    const color=c.k==="i"?C_MUTED:(c.k==="type"&&upd?C_ORANGE:C_INK);
    txt(x,v[c.k],tx,y+29,rf(c.k==="type"&&upd?17:19,c.k==="name"?700:400),color,"left",w);
    cx+=c.w;
  });
  if(ht){ const hx=RM+cols[0].w+10; txt(x,"ປະຫວັດ: "+ht,hx,y+58,rf(16,400),C_MUTED,"left",RW-RM-hx-10); }
  x.fillStyle="#E4E4DF"; x.fillRect(RM,y+H-1,RW-2*RM,1);
}};}
function goneRow(it){return {type:"row",h:44,draw:(x,y)=>{
  x.fillStyle="#FBEAE8"; x.fillRect(RM,y,RW-2*RM,44);
  const vals=["–",it.date||"",labelOf(it),fmtPhone(it.phone),"ຍົກເລີກໂດຍ "+who(it.deletedBy)+" · ບັນທຶກໂດຍ "+who(it.by)];
  let cx=RM; GONE_COLS.forEach((c,k)=>{txt(x,vals[k],cx+10,y+29,rf(19,400),"#B3261E","left",c.w-20); cx+=c.w;});
  x.fillStyle="#EBC9C5"; x.fillRect(RM,y+43,RW-2*RM,1);
}};}
function noteBlock(t,color){return {type:"note",h:58,draw:(x,y)=>txt(x,t,RM+10,y+38,rf(20,400),color||C_MUTED,"left",RW-2*RM-20)};}
function signBlock(){return {type:"sign",h:176,draw:(x,y)=>{
  const cx=RW-RM-200;
  txt(x,"ຜູ້ລາຍງານ",cx,y+64,rf(21,400),C_INK,"center");
  x.strokeStyle="#9AA0A6"; x.lineWidth=2; x.setLineDash([4,6]);
  x.beginPath(); x.moveTo(cx-170,y+124); x.lineTo(cx+170,y+124); x.stroke(); x.setLineDash([]);
  txt(x,"ວັນທີ ........ / ........ / ........",cx,y+162,rf(19,400),C_MUTED,"center");
}};}
function reportBlocks(R,logo,forImage){
  const tot=R.rows.length;
  const out=[heroBlock(R,logo),tilesBlock(R)];
  const multi=R.B.multi?"ລູກຄ້າ 1 ຄົນ ເລືອກໄດ້ຫຼາຍໂຄງການ — ລວມເປີເຊັນອາດເກີນ 100%":"";
  const staff=R.users.map((u,i)=>({label:u.name,n:u.n,color:PALETTE[i%PALETTE.length],right:`${u.n} ຄົນ · ຂາຍໄດ້ ${u.sold}`}));
  out.push(chartRowBlock(chartBlock("ສະຖານະລູກຄ້າ",R.B.st,tot),chartBlock("ເຫັນໂຄສະນາຈາກໃສ",R.B.sr,tot)));
  out.push(chartRowBlock(chartBlock("ໂຄງການທີ່ສົນໃຈ",R.B.pj,tot,multi),
    chartBlock("ລາຍການບັນທຶກແຕ່ລະຄົນ",staff,tot)));
  out.push(sectionBlock(`ລາຍຊື່ລູກຄ້າ (${tot} ຄົນ)`));
  if(!tot) out.push(noteBlock("ບໍ່ມີຂໍ້ມູນ"));
  else{
    const cols=tableCols(R.kind);
    out.push(theadBlock(cols));
    const lim=forImage?Math.min(tot,IMG_MAX_ROWS):tot;
    for(let i=0;i<lim;i++) out.push(rowBlock(R,cols,R.rows[i],i));
    if(lim<tot) out.push(noteBlock(`… ແລະ ອີກ ${tot-lim} ຄົນ — ກົດ “ບັນທຶກ PDF” ເພື່ອເບິ່ງລາຍຊື່ຄົບ`,C_ORANGE));
  }
  if(R.gone.length){
    out.push(sectionBlock(`ລາຍການທີ່ຍົກເລີກ (ພິມເບີຜິດ) — ${R.gone.length} ລາຍການ`));
    out.push(theadBlock(GONE_COLS));
    const lim=forImage?Math.min(R.gone.length,10):R.gone.length;
    for(let i=0;i<lim;i++) out.push(goneRow(R.gone[i]));
    if(lim<R.gone.length) out.push(noteBlock(`… ແລະ ອີກ ${R.gone.length-lim} ລາຍການ`));
  }
  if(!forImage) out.push(signBlock());
  return out;
}

/* ── ແບ່ງໜ້າ A4: ຫົວຕາຕະລາງຊ້ຳທຸກໜ້າ, ຫົວຂໍ້ບໍ່ຄ້າງຢູ່ທ້າຍໜ້າຄົນດຽວ ── */
const PAGE_TOP_CONT=112, PAGE_BOTTOM=RH-86;
function paginate(blocks){
  const pages=[]; let cur, y, head=null;
  const newPage=()=>{cur=[];pages.push(cur);y=pages.length===1?0:PAGE_TOP_CONT;};
  newPage();
  blocks.forEach((b,i)=>{
    if(b.type==="section") head=null;
    let need=b.h;
    if(b.keep||b.type==="thead"){
      for(let j=i+1;j<blocks.length&&j<=i+2;j++){need+=blocks[j].h; if(blocks[j].type!=="thead") break;}
    }
    if(y+need>PAGE_BOTTOM&&cur.length){
      newPage();
      if(b.type==="row"&&head){cur.push({b:head,y}); y+=head.h;}
    }
    cur.push({b,y}); y+=b.h;
    if(b.type==="thead") head=b;
  });
  return pages;
}
function drawPageChrome(x,R,pi,pn){
  if(pi>0){
    x.fillStyle=C_ORANGE; x.fillRect(0,0,RW,12);
    txt(x,R.title+" · "+R.period+(R.sub?" · "+R.sub:""),RM,70,rf(24,700),C_NAVY,"left",RW-2*RM-120);
    txt(x,"(ຕໍ່)",RW-RM,70,rf(20,400),C_MUTED,"right");
    x.fillStyle=C_LINE; x.fillRect(RM,92,RW-2*RM,2);
  }
  x.fillStyle=C_LINE; x.fillRect(RM,RH-68,RW-2*RM,2);
  txt(x,"U-SABAI LAND AND HOUSE · ລະບົບສະຖິຕິລູກຄ້າ · "+nowStamp(),RM,RH-32,rf(17,400),C_MUTED,"left",RW-2*RM-180);
  txt(x,"ໜ້າ "+(pi+1)+" / "+pn,RW-RM,RH-32,rf(18,700),C_MUTED,"right");
}
const toBlob=(c,type,q)=>new Promise((res,rej)=>{
  try{c.toBlob(b=>b?res(b):rej(new Error("ຮູບໃຫຍ່ເກີນໄປ")),type,q);}catch(e){rej(e);}
});
const blobBytes=async b=>new Uint8Array(await new Response(b).arrayBuffer());

/* ── ສ້າງໄຟລ໌ PDF ເອງ: ແຕ່ລະໜ້າເປັນຮູບ JPEG ຂະໜາດ A4 ── */
function pdfText(t){
  let h="FEFF";
  for(const ch of String(t)){
    const c=ch.codePointAt(0);
    if(c>0xFFFF){const v=c-0x10000; h+=(0xD800+(v>>10)).toString(16).padStart(4,"0")+(0xDC00+(v&0x3FF)).toString(16).padStart(4,"0");}
    else h+=c.toString(16).padStart(4,"0");
  }
  return "<"+h.toUpperCase()+">";
}
function buildPdf(pages,title){
  const enc=new TextEncoder(), parts=[], offs=[]; let len=0;
  const put=d=>{const b=typeof d==="string"?enc.encode(d):d; parts.push(b); len+=b.length;};
  const obj=(id,body)=>{offs[id]=len; put(id+" 0 obj\n"); if(typeof body==="string") put(body); else body(); put("\nendobj\n");};
  const PW=595.28, PH=841.89, n=pages.length, first=4, total=first+n*3;
  put("%PDF-1.4\n"); put(new Uint8Array([37,226,227,207,211,10]));
  obj(1,"<< /Type /Catalog /Pages 2 0 R >>");
  obj(2,"<< /Type /Pages /Kids ["+pages.map((_,i)=>(first+i*3)+" 0 R").join(" ")+"] /Count "+n+" >>");
  obj(3,"<< /Title "+pdfText(title)+" /Producer (U-SABAI customer app) /Creator (U-SABAI) >>");
  pages.forEach((pg,i)=>{
    const pid=first+i*3, cid=pid+1, iid=pid+2;
    obj(pid,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`);
    const cs=`q ${PW} 0 0 ${PH} 0 0 cm /Im${i} Do Q`;
    obj(cid,`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
    obj(iid,()=>{
      put(`<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.bytes.length} >>\nstream\n`);
      put(pg.bytes); put("\nendstream");
    });
  });
  const xref=len;
  let t="xref\n0 "+total+"\n0000000000 65535 f \n";
  for(let i=1;i<total;i++) t+=String(offs[i]).padStart(10,"0")+" 00000 n \n";
  put(t);
  put("trailer\n<< /Size "+total+" /Root 1 0 R /Info 3 0 R >>\nstartxref\n"+xref+"\n%%EOF\n");
  return new Blob(parts,{type:"application/pdf"});
}
async function renderPdf(R,logo){
  const pages=paginate(reportBlocks(R,logo,false));
  const c=document.createElement("canvas"); c.width=RW; c.height=RH;
  const x=c.getContext("2d");
  const jpegs=[], previews=[];
  for(let i=0;i<pages.length;i++){
    x.fillStyle="#fff"; x.fillRect(0,0,RW,RH);
    pages[i].forEach(({b,y})=>{x.save(); b.draw(x,y); x.restore();});
    drawPageChrome(x,R,i,pages.length);
    const blob=await toBlob(c,"image/jpeg",0.9);
    jpegs.push({bytes:await blobBytes(blob),w:RW,h:RH});
    previews.push(URL.createObjectURL(blob));
  }
  return {blob:buildPdf(jpegs,R.title+" "+R.period),previews};
}
async function renderPng(R,logo){
  const blocks=reportBlocks(R,logo,true);
  const H=blocks.reduce((a,b)=>a+b.h,0)+84;
  const c=document.createElement("canvas"); c.width=RW; c.height=H;
  const x=c.getContext("2d");
  x.fillStyle="#fff"; x.fillRect(0,0,RW,H);
  let y=0; blocks.forEach(b=>{x.save(); b.draw(x,y); x.restore(); y+=b.h;});
  x.fillStyle=C_LINE; x.fillRect(RM,H-70,RW-2*RM,2);
  txt(x,"ສ້າງໂດຍລະບົບສະຖິຕິລູກຄ້າ U-SABAI · "+nowStamp(),RW/2,H-30,rf(18,400),C_MUTED,"center",RW-2*RM);
  const blob=await toBlob(c,"image/png");
  return {blob,previews:[URL.createObjectURL(blob)]};
}
/* ── ປຸ່ມກົດ → ສ້າງລາຍງານ → ເປີດໜ້າຕ່າງ ແຊຣ໌ / ດາວໂຫຼດ / ພິມ ──
   (ແຍກເປັນ 2 ຂັ້ນ ເພາະໂທລະສັບຍອມໃຫ້ແຊຣ໌ໄຟລ໌ໄດ້ສະເພາະຕອນກົດປຸ່ມໂດຍກົງ) */
const isTouch=()=>{try{return matchMedia("(pointer:coarse)").matches||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);}catch(_){return false;}};
const canShareFile=f=>{try{return !!(navigator.share&&navigator.canShare&&navigator.canShare({files:[f]}));}catch(_){return false;}};
let exState=null, reportBusy=false;
async function makeReport(kind,fmt){
  if(reportBusy) return;
  const btn=$(kind==="day"?(fmt==="pdf"?"#btnDayPdf":"#btnDayImg"):(fmt==="pdf"?"#btnMonPdf":"#btnMonImg"));
  const label=btn.innerHTML;
  reportBusy=true; btn.disabled=true; btn.textContent="ກຳລັງສ້າງ…";
  try{
    await reportFonts();
    const logo=await reportLogo();
    const R=reportData(kind);
    const out=fmt==="pdf"?await renderPdf(R,logo):await renderPng(R,logo);
    const name=R.file+"."+fmt;
    let file;
    try{ file=new File([out.blob],name,{type:out.blob.type}); }catch(_){ file=out.blob; }
    openExport({file,name,fmt,previews:out.previews,title:R.title+" · "+R.period+(R.sub?" · "+R.sub:"")});
  }catch(e){ console.error(e); toast("ສ້າງລາຍງານບໍ່ໄດ້: "+((e&&e.message)||e)); }
  reportBusy=false; btn.disabled=false; btn.innerHTML=label;
}
function clearExport(){
  if(!exState) return;
  exState.previews.forEach(u=>URL.revokeObjectURL(u));
  if(exState.dl) URL.revokeObjectURL(exState.dl);
  $("#sheetprint").innerHTML="";
  exState=null;
}
function openExport(st){
  clearExport(); exState=st;
  $("#exTitle").textContent=st.fmt==="pdf"?"ລາຍງານ PDF ພ້ອມແລ້ວ":"ຮູບລາຍງານພ້ອມແລ້ວ";
  $("#exImg").src=st.previews[0];
  const kb=Math.max(1,Math.round(st.file.size/1024));
  $("#exMeta").innerHTML=`<b>${esc(st.title)}</b><br><span class="num">${esc(st.name)} · ${kb>=1024?(kb/1024).toFixed(1)+" MB":kb+" KB"}${st.fmt==="pdf"?" · "+st.previews.length+" ໜ້າ":""}</span>`;
  const touch=isTouch(), share=touch&&canShareFile(st.file);
  $("#btnExShare").classList.toggle("hide",!share);
  $("#btnExDown").classList.toggle("orange",!share);
  $("#btnExDown").classList.toggle("ghost",share);
  $("#btnExPrint").classList.toggle("hide",touch||st.fmt!=="pdf");
  $("#exHint").classList.toggle("hide",!(touch&&st.fmt==="png"));
  $("#exsheet").classList.add("on");
}
function exDownload(){
  if(!exState) return;
  if(!exState.dl) exState.dl=URL.createObjectURL(exState.file);
  const a=document.createElement("a");
  a.href=exState.dl; a.download=exState.name; a.rel="noopener";
  document.body.appendChild(a); a.click(); a.remove();
  toast(isTouch()?"ກຳລັງບັນທຶກ — ເບິ່ງໃນແອັບ Files / ດາວໂຫຼດ":"ດາວໂຫຼດແລ້ວ — ເບິ່ງໃນໂຟນເດີ Downloads");
}
$("#btnExShare").onclick=async()=>{
  if(!exState) return;
  try{ await navigator.share({files:[exState.file],title:exState.title}); }
  catch(e){ if(e&&e.name==="AbortError") return; exDownload(); }
};
$("#btnExDown").onclick=exDownload;
$("#btnExPrint").onclick=()=>{
  if(!exState) return;
  $("#sheetprint").innerHTML=exState.previews.map(u=>`<img src="${u}" alt="">`).join("");
  const imgs=[...$("#sheetprint").querySelectorAll("img")];
  Promise.all(imgs.map(im=>im.complete?1:new Promise(r=>{im.onload=im.onerror=r;}))).then(()=>setTimeout(()=>print(),80));
};
const closeEx=()=>$("#exsheet").classList.remove("on");
$("#btnExClose").onclick=closeEx;
$("#exsheet").addEventListener("click",e=>{if(e.target===$("#exsheet"))closeEx();});

/* ══ ຈັດການລາຍການເລືອກ (ໜ້າຜູ້ດູແລ): ໂຄງການ / ສະຖານະ / ເຫັນໂຄສະນາຈາກໃສ ══
   ລຶບໄດ້ທຸກລາຍການ (ບໍ່ມີຄ່າຫຼັກທີ່ລັອກ) — ລູກຄ້າເກົ່າບໍ່ຖືກກະທົບ */
const ADMIN_LISTS={
  project:{box:"#projlist",input:"#ad-proj",btn:"#btnAddProj",what:"ໂຄງການ",empty:"ຍັງບໍ່ມີໂຄງການ — ເພີ່ມຢູ່ລຸ່ມນີ້"},
  status:{box:"#statlist",input:"#ad-stat",btn:"#btnAddStat",what:"ສະຖານະ",empty:"ຍັງບໍ່ມີສະຖານະ",min:1},
  source:{box:"#srclist",input:"#ad-src",btn:"#btnAddSrc",what:"ຊ່ອງທາງ",empty:"ຍັງບໍ່ມີລາຍການ — ເພີ່ມຢູ່ລຸ່ມນີ້"}
};
function usageCount(kind,label){
  const a=alive();
  if(kind==="project") return a.filter(i=>projOf(i).includes(label)).length;
  if(kind==="status"){const id=idOfLabel(label);return a.filter(i=>(i.status||"open")===id).length;}
  return a.filter(i=>(i.source||"")===label).length;
}
function renderAdminList(kind){
  const A=ADMIN_LISTS[kind], el=$(A.box); if(!el) return;
  const list=LISTS[kind].get();
  let html=list.length?list.map(v=>{
    let sub=`ໃຊ້ຢູ່ ${usageCount(kind,v)} ຄົນ`;
    if(kind==="status"){
      const id=idOfLabel(v);
      if(id==="sold") sub+=" · ນັບເປັນ “ປິດຍອດຂາຍແລ້ວ” ໃນສະຫຼຸບ";
      if(id==="open") sub+=" · ນັບເປັນ “ຜູ້ສົນໃຈ” ໃນສະຫຼຸບ";
      if(id===defStatus()) sub+=" · ຄ່າເລີ່ມຕົ້ນຕອນບັນທຶກ";
    }
    return `<div class="item"><span class="meta"><span class="nm">${esc(v)}</span><span class="sub">${sub}</span></span>
      <button class="btn danger sm" data-del="${esc(v)}">ລຶບ</button></div>`;
  }).join(""):`<div class="empty">${A.empty}</div>`;
  if(kind==="status"){
    const miss=["open","sold"].filter(id=>!list.includes(BUILTIN[id]));
    if(miss.length) html+=`<div class="restore">${miss.map(id=>`<button class="btn ghost sm" data-restore="${id}">↩ ເອົາ “${esc(BUILTIN[id])}” ຄືນ</button>`).join("")}</div>`;
  }
  el.innerHTML=html;
}
const renderProjects=()=>renderAdminList("project");
const renderStatuses=()=>renderAdminList("status");
const renderSources=()=>renderAdminList("source");

/* ລາຍການປ່ຽນ → ວາດທຸກບ່ອນທີ່ກ່ຽວຂ້ອງໃໝ່ (ຮັກສາສິ່ງທີ່ກຳລັງເລືອກຢູ່) */
function afterListChange(){
  renderProjects(); renderStatuses(); renderSources();
  refreshChips("#a-projects");
  if(!allStatus().some(x=>x.id===addStatus)){ addStatus=defStatus(); addStatusTouched=false; }
  if($("#a-status").value!==ADDNEW) fillStatusSel("#a-status",addStatus,{withAdd:true});
  if(addSource&&!SOURCES.includes(addSource)) addSource="";
  if($("#a-source").value!==ADDNEW) fillSourceSel("#a-source",addSource);
  fillStatusSel("#l-status",listFilter,{withAll:true,withData:true});
  renderList(); renderSummary(); renderDaily();
}

Object.entries(ADMIN_LISTS).forEach(([kind,A])=>{
  const add=async()=>{
    const v=$(A.input).value.trim().replace(/\s+/g," ");
    if(!v){ toast("ພິມຊື່"+A.what+"ກ່ອນ"); $(A.input).focus(); return; }
    if(kind==="project"&&v===NOPROJ){ toast("ໃຊ້ຊື່ນີ້ບໍ່ໄດ້"); return; }
    if(LISTS[kind].get().includes(v)){ toast("ມີ"+A.what+"ນີ້ແລ້ວ"); return; }
    const b=$(A.btn); b.disabled=true;
    try{ await listAdd(kind,v); $(A.input).value=""; toast("ເພີ່ມ"+A.what+"ແລ້ວ ✓"); afterListChange(); }
    catch(e){ toast(writeErr(e)); }
    b.disabled=false;
  };
  $(A.btn).onclick=add;
  $(A.input).addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); add(); } });
  $(A.box).addEventListener("click",async e=>{
    const r=e.target.closest("[data-restore]");
    if(r){
      const id=r.dataset.restore, lab=BUILTIN[id], cur=STATUS_LIST.filter(x=>x!==lab);
      let next;
      if(id==="open") next=[lab,...cur];
      else{ const i=cur.indexOf(BUILTIN.open); next=cur.slice(); next.splice(i>=0?i+1:0,0,lab); }
      try{ await listWhole("status",next); toast("ເອົາຄືນແລ້ວ ✓"); afterListChange(); }
      catch(err){ toast(writeErr(err)); }
      return;
    }
    const b=e.target.closest("[data-del]"); if(!b) return;
    const v=b.dataset.del, list=LISTS[kind].get();
    if(A.min&&list.length<=A.min){ toast("ຕ້ອງມີຢ່າງໜ້ອຍ 1 ລາຍການ — ເພີ່ມລາຍການໃໝ່ກ່ອນ ແລ້ວຈຶ່ງລຶບອັນນີ້"); return; }
    const n=usageCount(kind,v);
    let msg=`ລຶບ “${v}” ອອກຈາກລາຍການເລືອກ?\n\nລູກຄ້າເກົ່າ ${n} ຄົນ ທີ່ໃຊ້ລາຍການນີ້ ຈະຍັງສະແດງຄືເກົ່າ (ບໍ່ຖືກລຶບ)`;
    if(kind==="status"&&idOfLabel(v)==="sold")
      msg+=`\n\nໝາຍເຫດ: ຖ້າລຶບ ຈະເລືອກ “ປິດຍອດຂາຍແລ້ວ” ບໍ່ໄດ້ອີກ ແລະ ກ່ອງ “ປິດຍອດຂາຍແລ້ວ” ໃນໜ້າສະຫຼຸບ ຈະນັບແຕ່ລູກຄ້າເກົ່າ — ກົດ “ເອົາຄືນ” ໄດ້ທຸກເວລາ`;
    if(!confirm(msg)) return;
    try{ await listRemove(kind,v); toast("ລຶບແລ້ວ"); afterListChange(); }
    catch(err){ toast(writeErr(err)); }
  });
});

$("#btnSaveBanner").onclick=async()=>{
  try{await setDoc(CFG,{banner:$("#ad-banner").value.trim(),by:auth.currentUser.email,at:serverTimestamp()},{merge:true});
    toast("ບັນທຶກໝາຍເຫດແລ້ວ ✓");}catch(e){toast("ບັນທຶກບໍ່ໄດ້: "+e.code);}
};
$("#btnMakeStaff").onclick=async()=>{
  const email=$("#ad-email").value.trim().toLowerCase(),pass=$("#ad-pass").value,nm=$("#ad-name").value.trim();
  if(!email||!pass){showErr("#adminerr",{message:"ກະລຸນາໃສ່ອີເມວ ແລະ ລະຫັດຜ່ານ"});return;}
  if(pass.length<6){showErr("#adminerr",{code:"auth/weak-password"});return;}
  const b=$("#btnMakeStaff");b.disabled=true;let sec=null;
  try{
    sec=initializeApp(FIREBASE_CONFIG,"creator-"+Date.now());
    await createUserWithEmailAndPassword(getAuth(sec),email,pass);
    await setDoc(doc(db,"staff",staffDocId(email)),{email,name:nm,active:true,createdAt:serverTimestamp(),by:auth.currentUser.email},{merge:true});
    $("#ad-email").value="";$("#ad-pass").value="";$("#ad-name").value="";
    $("#adminerr").classList.remove("on");toast("ສ້າງບັນຊີໃຫ້ "+email+" ແລ້ວ ✓");
  }catch(e){showErr("#adminerr",e);}
  if(sec){try{await deleteApp(sec);}catch(_){}}
  b.disabled=false;
};
function renderStaff(){
  $("#stafflist").innerHTML=staff.length?staff.map(s=>{
    const own=isOwner(s.email);
    const mg=own||(s.role==="manager");
    const off=s.active===false;
    return `<div class="item" style="flex-wrap:wrap;${off?"opacity:.55":""}">
      ${tagHTML(s.email)}
      <span class="meta"><span class="nm">${esc(s.name||"(ບໍ່ໄດ້ໃສ່ຊື່)")}</span>
        <span class="ph">${esc(s.email||"")}${s.title?" · "+esc(s.title):""}</span>
        <span class="sub">${own?"ເຈົ້າຂອງລະບົບ":(mg?"ຜູ້ດູແລ":(off?"ຖືກປິດການໃຊ້ງານ":"ພະນັກງານ"))}</span></span>
      ${own?"":`<span style="display:flex;gap:6px;flex-wrap:wrap;width:100%;margin-top:6px">
        <button class="btn ${mg?"ghost":"sm-navy"} sm" data-role="${esc(s.email)}" data-mg="${mg?1:0}">${mg?"↓ ຍົກເລີກຜູ້ດູແລ":"↑ ຕັ້ງເປັນຜູ້ດູແລ"}</button>
        <button class="btn ghost sm" data-prof="${esc(s.email)}">ແກ້ໂປຣໄຟລ໌</button>
        <button class="btn ghost sm" data-pw="${esc(s.email)}">ສົ່ງລິງຄ໌ປ່ຽນລະຫັດ</button>
        <button class="btn ${off?"ghost":"danger"} sm" data-tog="${esc(s.email)}" data-off="${off?1:0}">${off?"ເປີດໃຊ້ງານ":"ປິດການໃຊ້ງານ"}</button>
        <button class="btn danger sm" data-rm="${esc(s.email)}">ລຶບອອກຈາກລາຍຊື່</button>
      </span>`}</div>`;
  }).join(""):`<div class="empty">ຍັງບໍ່ມີພະນັກງານໃນລະບົບ</div>`;
}
$("#stafflist").addEventListener("click",async e=>{
  const pw=e.target.closest("[data-pw]"),tg=e.target.closest("[data-tog]"),rm=e.target.closest("[data-rm]"),rl=e.target.closest("[data-role]"),pf=e.target.closest("[data-prof]");
  if(pf){ openProfile(pf.dataset.prof); return; }
  if(rl){
    const wasMg=rl.dataset.mg==="1";
    if(!confirm(wasMg?"ຍົກເລີກສິດຜູ້ດູແລຂອງ "+rl.dataset.role+"?":"ຕັ້ງ "+rl.dataset.role+" ເປັນຜູ້ດູແລ?\nລາວຈະເຫັນແຖບ ສະຫຼຸບ ແລະ ຜູ້ດູແລ ຄືກັນກັບເຈົ້າ"))return;
    try{await setDoc(doc(db,"staff",staffDocId(rl.dataset.role)),{email:rl.dataset.role,role:wasMg?"staff":"manager"},{merge:true});
      toast(wasMg?"ຍົກເລີກສິດແລ້ວ":"ຕັ້ງເປັນຜູ້ດູແລແລ້ວ ✓");}
    catch(err){toast("ບໍ່ສຳເລັດ: "+err.code);}
    return;
  }
  if(rm){
    if(!confirm("ລຶບ "+rm.dataset.rm+" ອອກຈາກລາຍຊື່?\n\nສຳຄັນ: ຕ້ອງໄປລຶບບັນຊີໃນ Firebase Console ກ່ອນ ບໍ່ດັ່ງນັ້ນລາວຍັງເຂົ້າລະບົບໄດ້"))return;
    try{await deleteDoc(doc(db,"staff",staffDocId(rm.dataset.rm)));toast("ລຶບອອກຈາກລາຍຊື່ແລ້ວ");}
    catch(err){toast("ບໍ່ສຳເລັດ: "+err.code);}
    return;
  }
  if(pw){try{await sendPasswordResetEmail(auth,pw.dataset.pw);toast("ສົ່ງລິງຄ໌ໄປ "+pw.dataset.pw+" ແລ້ວ");}
    catch(err){toast("ສົ່ງບໍ່ໄດ້: "+err.code);}return;}
  if(tg){const off=tg.dataset.off==="1";
    if(!confirm(off?"ເປີດໃຫ້ບັນຊີນີ້ເຂົ້າລະບົບໄດ້ອີກ?":"ປິດບໍ່ໃຫ້ບັນຊີນີ້ເຂົ້າລະບົບ?"))return;
    try{await setDoc(doc(db,"staff",staffDocId(tg.dataset.tog)),{email:tg.dataset.tog,active:off},{merge:true});
      toast(off?"ເປີດໃຊ້ງານແລ້ວ":"ປິດການໃຊ້ງານແລ້ວ");}catch(err){toast("ບໍ່ສຳເລັດ: "+err.code);}}
});


/* ---------- ໂປຣໄຟລ໌ ---------- */
let profEmail=null, profPhoto="";
function paintProfPic(){
  const el=$("#prof-pic");
  if(profPhoto){ el.style.backgroundImage=`url('${profPhoto}')`; el.textContent=""; }
  else { el.style.backgroundImage="none"; el.textContent=(who(profEmail)||"?").slice(0,2); }
}
function openProfile(email){
  profEmail=(email||auth.currentUser.email).toLowerCase();
  const s=staffOf(profEmail)||{};
  const mine=profEmail===(auth.currentUser.email||"").toLowerCase();
  $("#profTitle").textContent=mine?"ໂປຣໄຟລ໌ຂອງຂ້ອຍ":"ແກ້ໂປຣໄຟລ໌: "+profEmail;
  profPhoto=s.photo||"";
  $("#prof-name").value=s.name||"";
  $("#prof-title").value=s.title||"";
  $("#prof-phone").value=s.phone||"";
  $("#prof-meta").innerHTML=`<div><span>ອີເມວ</span><b>${esc(profEmail)}</b></div>
    <div><span>ສິດ</span><b>${isOwner(profEmail)?"ເຈົ້າຂອງລະບົບ":(isManager(profEmail)?"ຜູ້ດູແລ":"ພະນັກງານ")}</b></div>`;
  $("#proferr").classList.remove("on");
  paintProfPic();
  $("#profsheet").classList.add("on");
}
$("#btnProfile").onclick=()=>openProfile(auth.currentUser.email);
$("#btnProfCancel").onclick=()=>$("#profsheet").classList.remove("on");
$("#profsheet").addEventListener("click",e=>{if(e.target===$("#profsheet"))$("#profsheet").classList.remove("on");});
$("#btnProfClear").onclick=()=>{profPhoto="";paintProfPic();};
$("#prof-file").addEventListener("change",async e=>{
  const f=e.target.files&&e.target.files[0]; if(!f)return;
  try{ profPhoto=await shrinkImage(f); paintProfPic(); }
  catch(err){ showErr("#proferr",{message:err.message}); }
  e.target.value="";
});
$("#btnProfSave").onclick=async()=>{
  if(!profEmail)return;
  const b=$("#btnProfSave");b.disabled=true;
  try{
    await setDoc(doc(db,"staff",staffDocId(profEmail)),{
      email:profEmail,
      name:$("#prof-name").value.trim(),
      title:$("#prof-title").value.trim(),
      phone:$("#prof-phone").value.trim(),
      photo:profPhoto
    },{merge:true});
    $("#profsheet").classList.remove("on"); toast("ບັນທຶກໂປຣໄຟລ໌ແລ້ວ ✓");
  }catch(e){ showErr("#proferr",e); }
  b.disabled=false;
};

function applyRole(){
  const u=auth.currentUser; if(!u) return;
  const was=manager;
  manager=isManager(u.email);
  $("#roleTag").textContent=isOwner(u.email)?"ເຈົ້າຂອງລະບົບ":(manager?"ຜູ້ດູແລ":"ພະນັກງານ");
  const mypic=picOf(u.email);
  $("#who").innerHTML=(mypic?`<span class="hpic" style="background-image:url('${mypic}')"></span>`:"")+esc(who(u.email)||u.email);
  $("#navSum").classList.remove("hide");
  $("#navAdmin").classList.toggle("hide",!manager);
  if(was&&!manager){
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("on"));
    $("#v-add").classList.add("on");
    $("#nav").querySelectorAll("button").forEach(x=>x.removeAttribute("aria-current"));
    $("#nav").querySelector('[data-v="add"]').setAttribute("aria-current","page");
  }
}

onAuthStateChanged(auth,user=>{
  if(user){
    showApp();
    $("#who").textContent=user.email;
    $("#pass").value="";
    applyRole();
    /* ຖ້າຍັງບໍ່ມີແຖວຂອງຕົນເອງ ໃຫ້ສ້າງໄວ້ ເພື່ອຕັ້ງໂປຣໄຟລ໌ໄດ້ */
    setTimeout(()=>{
      const em=(user.email||"").toLowerCase();
      setDoc(doc(db,"staff",staffDocId(em)),{email:em,active:true},{merge:true}).catch(()=>{});
    },1500);
    if(!manager){
      document.querySelectorAll(".view").forEach(v=>v.classList.remove("on"));
      $("#v-add").classList.add("on");
      $("#nav").querySelectorAll("button").forEach(x=>x.removeAttribute("aria-current"));
      $("#nav").querySelector('[data-v="add"]').setAttribute("aria-current","page");
    }
    if(!unsub)unsub=onSnapshot(query(COL,orderBy("date","desc")),snap=>{
      items=snap.docs.map(d=>({id:d.id,...d.data()}));renderAll();
    },err=>{
      if(err.code==="permission-denied"){toast("ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ");signOut(auth);}
      else toast("ໂຫຼດຂໍ້ມູນບໍ່ໄດ້: "+err.code);
    });
    if(!unsubStaff)unsubStaff=onSnapshot(STAFF,snap=>{
      staff=snap.docs.map(d=>({id:d.id,...d.data()}));
      applyRole();renderStaff();renderList();renderSummary();renderDaily();renderToday();
    },()=>{});
    if(!unsubCfg)unsubCfg=onSnapshot(CFG,d=>{
      const c=d.data()||{};
      const t=c.banner||"";
      $("#banner").textContent=t;$("#banner").classList.toggle("hide",!t);
      setTimeout(syncHeaderHeight,60);
      if(document.activeElement!==$("#ad-banner")) $("#ad-banner").value=t;
      /* ລາຍການເລືອກ — ຖ້າຍັງບໍ່ເຄີຍບັນທຶກແບບໃໝ່ ໃຫ້ໃຊ້ຄ່າເກົ່າ (statuses) ຕໍ່ ບໍ່ໃຫ້ຫາຍ */
      const uniq=a=>[...new Set(a.filter(x=>typeof x==="string"&&x.trim()))];
      cfgHas={statusList:Array.isArray(c.statusList),sources:Array.isArray(c.sources),projects:Array.isArray(c.projects)};
      PROJECTS=cfgHas.projects?uniq(c.projects):[];
      STATUS_LIST=cfgHas.statusList?uniq(c.statusList)
        :uniq([BUILTIN.open,BUILTIN.sold,...(Array.isArray(c.statuses)?c.statuses:[])]);
      if(!STATUS_LIST.length){ STATUS_LIST=[BUILTIN.open,BUILTIN.sold]; cfgHas.statusList=false; }
      SOURCES=cfgHas.sources?uniq(c.sources):[...DEFAULT_SOURCES];
      afterListChange();
    },()=>{});
  }else{
    if(unsub){unsub();unsub=null;}if(unsubStaff){unsubStaff();unsubStaff=null;}if(unsubCfg){unsubCfg();unsubCfg=null;}
    items=[];staff=[];manager=false;
    $("#banner").classList.add("hide");
    showGate("#gate");
  }
});
