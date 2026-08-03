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
         addDoc, setDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp }
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
let editId=null, addStatus="open", editStatus="open", listFilter="all";
let manager=false;
const OWNERS=MANAGERS.map(e=>e.toLowerCase());
const isOwner=e=>OWNERS.includes((e||"").toLowerCase());
const roleOf=e=>{const s=staff.find(x=>(x.email||"").toLowerCase()===(e||"").toLowerCase());return s?(s.role||"staff"):"staff";};
const isManager=e=>isOwner(e)||roleOf(e)==="manager";
const staffOf=e=>staff.find(x=>(x.email||"").toLowerCase()===(e||"").toLowerCase())||null;
const picOf=e=>{const s=staffOf(e);return s&&s.photo?s.photo:"";};
const staffDocId=e=>{const s=staffOf(e);return s?s.id:(e||"").toLowerCase();};
function tagHTML(email,extra){
  const p=picOf(email),n=who(email);
  return p?`<span class="tag pic ${extra||""}" style="background-image:url('${p}')"></span>`
          :`<span class="tag ${extra||""}">${esc(n.slice(0,2))}</span>`;
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
const OTHER="ອື່ນໆ (ພິມເອງ)";
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
function fillProjects(sel,keep){
  const el=$(sel),cur=keep!==undefined?keep:el.value;
  el.innerHTML=[NOPROJ,...PROJECTS,OTHER].map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join("");
  el.value=[NOPROJ,...PROJECTS,OTHER].includes(cur)?cur:NOPROJ;
}
function bindOther(sel,other){
  const upd=()=>$(other).classList.toggle("hide",$(sel).value!==OTHER);
  $(sel).addEventListener("change",upd); upd();
}
function projValue(sel,other){
  const v=$(sel).value;
  if(v!==OTHER) return v;
  return $(other).value.trim()||NOPROJ;
}
fillProjects("#a-project"); fillProjects("#e-project");
bindOther("#a-project","#a-project-other"); bindOther("#e-project","#e-project-other");

/* ---------- ວັນທີແບບຕົວເລກສາກົນ (ຄືກັນທຸກເຄື່ອງ) ---------- */
const pad=n=>String(n).padStart(2,"0");
function buildDate(py,pm,pd){
  const nowY=new Date().getFullYear();
  const ys=[];for(let y=nowY+1;y>=nowY-5;y--)ys.push(y);
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

segBind("#a-seg",v=>addStatus=v);
$("#btnAdd").onclick=async()=>{
  const phone=$("#a-phone").value.trim();
  if(!phone){toast("ກະລຸນາໃສ່ເບີໂທ");$("#a-phone").focus();return;}
  const {name,autoNum}=parseName($("#a-name").value,nextNum());
  const b=$("#btnAdd");b.disabled=true;
  try{
    await addDoc(COL,{phone,name,autoNum,status:addStatus,project:projValue("#a-project","#a-project-other"),
      date:getDate("#a-y","#a-m","#a-d"),note:$("#a-note").value.trim(),
      by:auth.currentUser.email,deleted:false,createdAt:serverTimestamp()});
    $("#a-phone").value="";$("#a-name").value="";$("#a-note").value="";$("#a-project-other").value="";
    setDate("#a-y","#a-m","#a-d",today());$("#a-project").value=NOPROJ;$("#a-project-other").classList.add("hide");
    segSet("#a-seg","open");addStatus="open";
    toast("ບັນທຶກແລ້ວ ✓");
  }catch(e){toast("ບັນທຶກບໍ່ໄດ້: "+(AUTH_ERR[e.code]||e.code));}
  b.disabled=false;
};

$("#q").addEventListener("input",renderList);
segBind("#l-seg",v=>{listFilter=v;renderList();});
$("#m-month").addEventListener("change",renderList);
function matches(it,q){if(!q)return true;
  const d=q.replace(/\D/g,"");
  if(d&&String(it.phone||"").replace(/\D/g,"").includes(d))return true;
  return labelOf(it).toLowerCase().includes(q.toLowerCase());}
function renderList(){
  const q=$("#q").value.trim(),mk=$("#m-month").value;
  const inM=it=>!mk||mk==="all"||(it.date||"").startsWith(mk);
  $("#m-count").textContent=alive().filter(inM).length;
  const rows=items.filter(it=>inM(it)&&matches(it,q)&&(listFilter==="all"||(!it.deleted&&it.status===listFilter)));
  $("#list").innerHTML=rows.length?rows.map(it=>{
    const lb=labelOf(it),auto=isAuto(it);
    const cls=it.deleted?"gone":(it.status==="sold"?"sold":"");
    const proj=(it.project&&it.project!==NOPROJ)?` · ${esc(it.project)}`:"";
    return `<button class="item ${it.deleted?"gone":""}" data-id="${it.id}">
      <span class="tag ${cls}">${esc(auto?lb:lb.slice(0,2))}</span>
      <span class="meta"><span class="nm">${esc(lb)}</span>
        <span class="ph num">${esc(it.phone||"")}</span>
        ${it.deleted?`<span class="sub warn">ລຶບໂດຍ ${esc(who(it.deletedBy))}</span>`
                    :`<span class="sub">ເພີ່ມໂດຍ ${esc(who(it.by))}${proj}</span>`}
      </span><span class="dt num">${esc(it.date||"")}</span></button>`;
  }).join(""):`<div class="empty">${q?"ບໍ່ພົບເບີ ຫຼື ຊື່ນີ້":"ຍັງບໍ່ມີລາຍການ"}</div>`;
}
document.addEventListener("click",e=>{
  const b=e.target.closest(".item[data-id], .plot[data-id]");if(!b)return;openRec(b.dataset.id);
});

segBind("#e-seg",v=>editStatus=v);
function openRec(id){
  const it=items.find(x=>x.id===id);if(!it)return;
  editId=id;$("#editerr").classList.remove("on");
  if(it.deleted&&!manager){
    $("#sheetTitle").textContent="ລາຍການນີ້ຖືກລຶບແລ້ວ";
    $("#editForm").classList.add("hide");$("#viewOnly").classList.remove("hide");
    $("#roBox").innerHTML=`
      <div><span>ຊື່</span><b>${esc(labelOf(it))}</b></div>
      <div><span>ເບີໂທ</span><b class="num">${esc(it.phone||"")}</b></div>
      <div><span>ໂຄງການ</span><b>${esc(it.project||NOPROJ)}</b></div>
      <div><span>ວັນທີ</span><b class="num">${esc(it.date||"")}</b></div>
      <div><span>ເພີ່ມໂດຍ</span><b>${esc(who(it.by))}</b></div>
      <div><span style="color:var(--red)">ຖືກລຶບໂດຍ</span><b style="color:var(--red)">${esc(who(it.deletedBy))}</b></div>`;
    $("#sheet").classList.add("on");return;
  }
  $("#sheetTitle").textContent="ແກ້ໄຂຂໍ້ມູນລູກຄ້າ";
  $("#viewOnly").classList.add("hide");$("#editForm").classList.remove("hide");
  editStatus=it.status||"open";
  $("#e-phone").value=it.phone||"";
  $("#e-name").value=isAuto(it)?"":it.name;
  $("#e-name").placeholder=isAuto(it)?labelOf(it)+" (ພິມຊື່ຈິງທັບໄດ້)":"";
  const known=[NOPROJ,...PROJECTS].includes(it.project||NOPROJ);
  fillProjects("#e-project", known?(it.project||NOPROJ):OTHER);
  $("#e-project-other").value=known?"":(it.project||"");
  $("#e-project-other").classList.toggle("hide",known);
  setDate("#e-y","#e-m","#e-d",it.date||today());
  $("#e-note").value=it.note||"";
  segSet("#e-seg",editStatus);
  $("#roMeta").innerHTML=`<div><span>ເພີ່ມໂດຍ</span><b>${esc(who(it.by))}</b></div>
    ${it.deleted?`<div><span style="color:var(--red)">ຖືກລຶບໂດຍ</span><b style="color:var(--red)">${esc(who(it.deletedBy))}</b></div>`:""}`;
  $("#btnRestore").classList.toggle("hide",!(manager&&it.deleted));
  $("#btnDel").textContent=(manager&&it.deleted)?"ລຶບຖາວອນ":"ລຶບ";
  $("#sheet").classList.add("on");
}
const closeSheet=()=>{$("#sheet").classList.remove("on");editId=null;};
$("#btnCancel").onclick=closeSheet;$("#btnCloseRo").onclick=closeSheet;
$("#sheet").addEventListener("click",e=>{if(e.target===$("#sheet"))closeSheet();});

$("#btnSave").onclick=async()=>{
  if(!editId)return;const cur=items.find(x=>x.id===editId);
  const {name,autoNum}=parseName($("#e-name").value,isAuto(cur)?cur.autoNum:nextNum());
  try{await updateDoc(doc(db,"customers",editId),{phone:$("#e-phone").value.trim(),name,autoNum,
      status:editStatus,project:projValue("#e-project","#e-project-other"),date:getDate("#e-y","#e-m","#e-d"),note:$("#e-note").value.trim()});
    closeSheet();toast("ແກ້ໄຂແລ້ວ ✓");
  }catch(e){showErr("#editerr",e);}
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

$("#s-month").addEventListener("change",renderSummary);
function bar(label,n,max){
  return `<div class="pbar"><div class="top"><span>${esc(label)}</span><b class="num">${n}</b></div>
    <div class="track"><div class="fill" style="width:${max?Math.round(n/max*100):0}%"></div></div></div>`;
}
function renderSummary(){
  if(!manager)return;
  fillMonths("#s-month");
  const mk=$("#s-month").value;
  const inM=it=>mk==="all"||(it.date||"").startsWith(mk);
  const rows=alive().filter(inM).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const gone=items.filter(i=>i.deleted&&inM(i));
  const sold=rows.filter(r=>r.status==="sold").length;
  $("#s-total").textContent=rows.length;
  $("#s-sold").textContent=sold;
  $("#s-open").textContent=rows.length-sold;
  $("#s-rate").textContent=(rows.length?Math.round(sold/rows.length*100):0)+"%";
  $("#s-del").textContent=gone.length;

  const allProj=[...new Set([...PROJECTS, ...rows.map(r=>r.project||NOPROJ)])];
  const counts=allProj.map(p=>({p,n:rows.filter(r=>(r.project||NOPROJ)===p).length}))
    .filter(x=>x.n>0).sort((a,b)=>b.n-a.n);
  const mx=Math.max(1,...counts.map(c=>c.n));
  $("#byproject").innerHTML=counts.length?counts.map(c=>bar(c.p,c.n,mx)).join(""):`<div class="empty">ບໍ່ມີຂໍ້ມູນ</div>`;

  $("#plots").innerHTML=rows.length?rows.map(it=>{
    const lb=labelOf(it);
    return `<button class="plot ${it.status==="sold"?"sold":""}" data-id="${it.id}" title="${esc(lb)} · ${esc(it.phone||"")}">${esc(isAuto(it)?lb:lb.slice(0,2))}</button>`;
  }).join(""):`<div class="empty">ບໍ່ມີຂໍ້ມູນ</div>`;

  const ems=[...new Set(items.filter(inM).map(i=>i.by).filter(Boolean))];
  $("#byuser").innerHTML=ems.length?ems.map(em=>{
    const a=rows.filter(r=>r.by===em),s=a.filter(r=>r.status==="sold").length;
    const d=items.filter(i=>i.deleted&&inM(i)&&i.deletedBy===em).length;
    return `<div class="item">${tagHTML(em)}
      <span class="meta"><span class="nm">${esc(who(em))}</span>
      <span class="sub num">ເພີ່ມ ${a.length} · ຂາຍໄດ້ ${s} · ລຶບ ${d}</span></span></div>`;
  }).join(""):`<div class="empty">ບໍ່ມີຂໍ້ມູນ</div>`;

  $("#deleted").innerHTML=gone.length?gone.map(it=>`
    <button class="item gone" data-id="${it.id}"><span class="tag gone">${esc(labelOf(it).slice(0,2))}</span>
      <span class="meta"><span class="nm">${esc(labelOf(it))}</span><span class="ph num">${esc(it.phone||"")}</span>
      <span class="sub warn">ລຶບໂດຍ ${esc(who(it.deletedBy))}</span></span>
      <span class="dt num">${esc(it.date||"")}</span></button>`).join(""):`<div class="empty">ບໍ່ມີລາຍການທີ່ຖືກລຶບ</div>`;
}
const renderAll=()=>{fillMonths("#m-month");renderList();renderSummary();$("#a-hint").textContent="A"+nextNum();};

$("#btnPrint").onclick=()=>{
  const mk=$("#s-month").value,inM=it=>mk==="all"||(it.date||"").startsWith(mk);
  const rows=alive().filter(inM).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const gone=items.filter(i=>i.deleted&&inM(i));
  const sold=rows.filter(r=>r.status==="sold").length;
  $("#sheetprint").innerHTML=`
    <h1>ລາຍງານສະຖິຕິລູກຄ້າ</h1>
    <p class="ph">ບໍລິສັດ ຢູ່ສະບາຍ ແລນ ແອນ ເຮົາສ໌ — ໂຄງການດິນຈັດສັນ<br>
    ໄລຍະ: ${mk==="all"?"ທັງໝົດ":mk} · ພິມວັນທີ ${today()}</p>
    <div class="sum">
      <div><b>${rows.length}</b><span>ລູກຄ້າທັງໝົດ</span></div>
      <div><b>${sold}</b><span>ປິດຍອດຂາຍແລ້ວ</span></div>
      <div><b>${rows.length-sold}</b><span>ຜູ້ສົນໃຈ</span></div>
      <div><b>${rows.length?Math.round(sold/rows.length*100):0}%</b><span>ອັດຕາປິດການຂາຍ</span></div>
      <div><b>${gone.length}</b><span>ຖືກລຶບ</span></div>
    </div>
    <table><thead><tr><th style="width:6%">ລຳດັບ</th><th style="width:12%">ວັນທີ</th><th style="width:15%">ລູກຄ້າ</th>
      <th style="width:15%">ເບີໂທ</th><th style="width:10%">ສະຖານະ</th><th style="width:14%">ໂຄງການ</th>
      <th style="width:12%">ຜູ້ບັນທຶກ</th><th>ໝາຍເຫດ</th></tr></thead><tbody>
      ${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.date||"")}</td><td>${esc(labelOf(r))}</td>
        <td>${esc(r.phone||"")}</td><td>${r.status==="sold"?"ຊື້ແລ້ວ":"ສົນໃຈ"}</td>
        <td>${esc(r.project||"—")}</td><td>${esc(who(r.by))}</td><td>${esc(r.note||"")}</td></tr>`).join("")
        ||`<tr><td colspan="8" style="text-align:center">ບໍ່ມີຂໍ້ມູນ</td></tr>`}
      ${gone.map(r=>`<tr class="gone"><td>–</td><td>${esc(r.date||"")}</td><td>${esc(labelOf(r))}</td>
        <td>${esc(r.phone||"")}</td><td>ຖືກລຶບ</td><td>${esc(r.project||"—")}</td>
        <td>${esc(who(r.by))}</td><td>ລຶບໂດຍ ${esc(who(r.deletedBy))}</td></tr>`).join("")}
    </tbody></table>
    <div class="sig"><div>ຜູ້ລາຍງານ<br><br>............................................<br>ວັນທີ ......../......../........</div></div>`;
  print();
};

function renderProjects(){
  $("#projlist").innerHTML=PROJECTS.length?PROJECTS.map(p=>`
    <div class="item"><span class="meta"><span class="nm">${esc(p)}</span></span>
      <button class="btn danger sm" data-delproj="${esc(p)}">ລຶບ</button></div>`).join("")
    :`<div class="empty">ຍັງບໍ່ມີໂຄງການ — ເພີ່ມຢູ່ລຸ່ມນີ້</div>`;
}
async function saveProjects(list){
  await setDoc(CFG,{projects:list,by:auth.currentUser.email,at:serverTimestamp()},{merge:true});
}
$("#btnAddProj").onclick=async()=>{
  const v=$("#ad-proj").value.trim();
  if(!v){toast("ໃສ່ຊື່ໂຄງການກ່ອນ");return;}
  if(PROJECTS.includes(v)){toast("ມີໂຄງການນີ້ແລ້ວ");return;}
  const b=$("#btnAddProj");b.disabled=true;
  try{await saveProjects([...PROJECTS,v]);$("#ad-proj").value="";toast("ເພີ່ມໂຄງການແລ້ວ ✓");}
  catch(e){toast("ບໍ່ສຳເລັດ: "+e.code);}
  b.disabled=false;
};
$("#projlist").addEventListener("click",async e=>{
  const b=e.target.closest("[data-delproj]");if(!b)return;
  const p=b.dataset.delproj;
  if(!confirm(`ລຶບ “${p}” ອອກຈາກລາຍການເລືອກ?\nຂໍ້ມູນລູກຄ້າເກົ່າທີ່ເລືອກໂຄງການນີ້ຈະຍັງຢູ່ຄືເກົ່າ`))return;
  try{await saveProjects(PROJECTS.filter(x=>x!==p));toast("ລຶບແລ້ວ");}
  catch(err){toast("ບໍ່ສຳເລັດ: "+err.code);}
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
  $("#navSum").classList.toggle("hide",!manager);
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
      applyRole();renderStaff();renderList();renderSummary();
    },()=>{});
    if(!unsubCfg)unsubCfg=onSnapshot(CFG,d=>{
      const c=d.data()||{};
      const t=c.banner||"";
      $("#banner").textContent=t;$("#banner").classList.toggle("hide",!t);
      setTimeout(syncHeaderHeight,60);
      $("#ad-banner").value=t;
      PROJECTS=Array.isArray(c.projects)?c.projects:[];
      renderProjects();
      fillProjects("#a-project");
      $("#a-project-other").classList.toggle("hide",$("#a-project").value!==OTHER);
      renderSummary();
    },()=>{});
  }else{
    if(unsub){unsub();unsub=null;}if(unsubStaff){unsubStaff();unsubStaff=null;}if(unsubCfg){unsubCfg();unsubCfg=null;}
    items=[];staff=[];manager=false;
    $("#banner").classList.add("hide");
    showGate("#gate");
  }
});
