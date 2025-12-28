console.log("✅ app.js loaded!");

/**
 * Fin.Journey – lightweight gamification & tools (localStorage).
 * No backend: everything stored on the user's device.
 */

/* ===========================
   GLOBAL CONST
   =========================== */
const STORE_KEY = "finjourney_state_v1";
const NAME_KEY  = "finjourney_user_name";

/* ===========================
   DEFAULT STATE
   =========================== */
const DEFAULT_STATE = {
  createdAt: new Date().toISOString(),
  points: 0,
  reads: {},
  quizzes: {},
  badges: {},
  history: [],
  lastToastTs: 0
};

const LEVELS = [
  { name: "Beginner", min: 0 },
  { name: "Intermediate", min: 160 },
  { name: "Advanced", min: 320 }
];

const BADGES = [
  { id:"fintech_explorer", name:"FinTech Explorer", rule:(s)=>completedModules(s) >= 2 },
  { id:"security_aware", name:"Security Aware", rule:(s)=>(s.quizzes["security_quiz"]?.score||0) >= 3 },
  { id:"reg_ready", name:"Regulation Ready", rule:(s)=>s.reads["regulation"] && (s.quizzes["regulation_quiz"]?.score||0) >= 3 },
  { id:"tool_user", name:"Tool User", rule:(s)=>s.reads["tools"] === true },
  { id:"journey_streak", name:"Journey Starter", rule:(s)=>totalActions(s) >= 4 }
];

/* ===========================
   STATE HELPERS
   =========================== */
function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  }catch(e){
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState(state){
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

/* ===========================
   HISTORY LOG
   =========================== */
function logActivity(type, id, detail=""){
  const s = loadState();
  s.history = s.history || [];

  s.history.unshift({
    type,
    id,
    detail,
    ts: new Date().toISOString()
  });

  if(s.history.length > 30) s.history.pop();
  saveState(s);
  renderHistoryUI();
}

/* ===========================
   USER NAME
   =========================== */
function getUserName(){
  return (localStorage.getItem(NAME_KEY) || "").trim();
}

function setUserName(name){
  localStorage.setItem(NAME_KEY, name.trim());
}

function renderGreeting(){
  const name = getUserName();
  const el = document.getElementById("greetingText");
  if(!el) return;

  const page = document.body.dataset.page || "default";

  const messages = {
    home:      "Selamat datang di Fin.Journey!",
    modules:   "Selamat belajar modul hari ini 🚀",
    tools:     "Yuk coba simulasi & tools keuangan 💡",
    gamification: "Pantau terus progress kamu dan klaim badge 🏅",
    team:      "Kenalan dulu yuk sama tim Fin.Journey 🤝",
    security:  "Jaga akunmu ya! Dan belajar keamanan digital 🔐",
    about:     "Yuk kenali alasan Fin.Journey dibuat ✨",
    faq:       "Kamu bisa cari jawaban cepat di FAQ ya!📌",
    default:   "Selamat belajar di Fin.Journey! 🌟"
  };

  const msg = messages[page] || messages.default;

  if(name){
    el.innerHTML = `Halo, <strong>${name}</strong> 👋 ${msg}`;
  }else{
    el.innerHTML = "";
  }
}

function showNameModal(){
  const modal = document.getElementById("nameModal");
  if(!modal) return;

  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");

  const input = document.getElementById("nameInput");
  const btn   = document.getElementById("saveNameBtn");

  setTimeout(()=> input?.focus(), 200);

  btn.onclick = () => {
    const val = (input?.value || "").trim();
    if(val.length < 2){
      toast("Nama minimal 2 huruf ya 😊","warn");
      return;
    }

    setUserName(val);
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden","true");

    renderGreeting();
    toast(`Halo ${val}! Selamat belajar 🚀`,"success");
  };
}

/* ===========================
   UI HELPERS
   =========================== */
function toast(msg, type="info"){
  const el = document.getElementById("toast");
  if(!el) return;
  el.textContent = msg;

  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> el.classList.remove("show"), 2600);
}

function setActiveNav(){
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll("[data-nav]").forEach(a=>{
    const target = (a.getAttribute("href")||"").split("/").pop().toLowerCase();
    if(target === path) a.classList.add("active");
  });
}

/* ===========================
   POINTS + ACTIONS
   =========================== */
function addPoints(amount, reason=""){
  const s = loadState();
  s.points = Math.max(0, (s.points||0) + amount);

  awardBadges(s);
  saveState(s);

  toast(`🪙 +${amount} poin! ${reason}`.trim(),"points");
  refreshGamificationUI();
}

function markRead(moduleId){
  const s = loadState();
  if(!moduleId) moduleId = "fintech";

  if(s.reads[moduleId]){
    toast("✅ Materi ini sudah tercatat","info");
    return;
  }

  s.reads[moduleId] = true;
  s.points += 30;

  awardBadges(s);
  saveState(s);

  logActivity("📘 Modul", moduleId, "Menyelesaikan modul");
  toast("📘 Materi selesai! +30 poin ✅","success");

  refreshGamificationUI();
  updateModuleTOCStatus();
}

/* ===========================
   QUIZ + SCORE
   =========================== */
function recordQuiz(quizId, score, total){
  const s = loadState();
  const prev = s.quizzes[quizId];

  s.quizzes[quizId] = { score, total, ts: new Date().toISOString() };

  const base = 40;
  const perf = Math.round((score/total)*40);
  let gained = base + perf;

  if(prev && score > (prev.score||0)) gained += 15;

  s.points += gained;
  awardBadges(s);
  saveState(s);

  logActivity("🎯 Kuis", quizId, `Skor ${score}/${total} (+${gained} poin)`);
  toast(`🎯 Kuis tersimpan! Skor ${score}/${total} • +${gained} poin`,"success");

  refreshGamificationUI();
}

/* ===========================
   QUIZ WIRE + FEEDBACK
   =========================== */
function wireQuiz(formId, quizId, answers){
  const form = document.getElementById(formId);
  if(!form) return;

  const resultEl = form.querySelector("[data-quiz-result]");
  const qs = Object.keys(answers);

  form.addEventListener("submit", (e)=>{
    e.preventDefault();

    form.querySelectorAll(".q").forEach(q=>q.classList.remove("correct","wrong"));
    form.querySelectorAll("label").forEach(lb=>{
      lb.classList.remove("correct-option","wrong-option");
    });

    let correct = 0;
    let filled = 0;

    qs.forEach((q)=>{
      const selected = form.querySelector(`input[name="${q}"]:checked`);
      if(!selected) return;
      filled++;

      const userAns = selected.value;
      const correctAns = answers[q];

      const qBox = selected.closest(".q");
      if(qBox){
        if(userAns === correctAns){
          qBox.classList.add("correct");
          correct++;
        }else{
          qBox.classList.add("wrong");
        }
      }

      const userLabel = selected.closest("label");
      if(userLabel){
        userLabel.classList.add(userAns === correctAns ? "correct-option" : "wrong-option");
      }

      const correctInput = form.querySelector(`input[name="${q}"][value="${correctAns}"]`);
      correctInput?.closest("label")?.classList.add("correct-option");
    });

    if(filled < qs.length){
      if(resultEl) resultEl.innerHTML = `⚠️ Kamu belum menjawab semua pertanyaan (${filled}/${qs.length})`;
      toast("⚠️ Lengkapi semua jawaban dulu ya!","warn");
      return;
    }

    if(resultEl) resultEl.innerHTML = `✅ Skor kamu: <strong>${correct}/${qs.length}</strong> benar`;
    recordQuiz(quizId, correct, qs.length);
  });
}

/* ===========================
   BADGES + LEVEL
   =========================== */
function awardBadges(s){
  for(const b of BADGES){
    if(s.badges[b.id]) continue;
    if(b.rule(s)){
      s.badges[b.id] = true;
      toast(`🏅 Badge terbuka: ${b.name}!`,"success");
    }
  }
}

function levelFor(points){
  let cur = LEVELS[0];
  for(const lv of LEVELS){
    if(points >= lv.min) cur = lv;
  }
  const idx = LEVELS.indexOf(cur);
  const next = LEVELS[idx+1] || null;
  return { current: cur, next };
}

/* ===========================
   PROGRESS HELPERS
   =========================== */
function completedModules(s){
  return Object.values(s.reads||{}).filter(Boolean).length;
}

function completedQuizzes(s){
  return Object.keys(s.quizzes||{}).length;
}

function totalActions(s){
  return completedModules(s) + completedQuizzes(s);
}

function overallProgress(s){
  const modulesTarget = 4;
  const quizzesTarget = 4;

  const doneM = Math.min(completedModules(s), modulesTarget);
  const doneQ = Math.min(completedQuizzes(s), quizzesTarget);

  const done = doneM + doneQ;
  const total = modulesTarget + quizzesTarget;
  const pct = total > 0 ? Math.round((done/total)*100) : 0;

  return { done, total, pct };
}

function formatPct(p){
  return `${Math.max(0, Math.min(100, p))}%`;
}

/* ===========================
   CHECKPOINT UI + MOTIVATION
   =========================== */
function renderCheckpointDots(done, total){
  const wrap = document.getElementById("checkpointDots");
  if(!wrap) return;

  wrap.innerHTML = Array.from({length: total}).map((_,i)=>{
    return `<span class="checkpoint-dot ${i < done ? "on" : ""}"></span>`;
  }).join("");
}

function progressMotivation(pct, done, total){
  if(done === 0) return "🚀 Kamu baru memulai perjalanan. Coba selesaikan 1 modul dulu!";
  if(pct < 30) return `🔥 Nice! Kamu sudah lewat ${done}/${total} checkpoint. Konsisten ya!`;
  if(pct < 60) return `💪 Mantap! Kamu sudah setengah jalan. Tinggal sedikit lagi!`;
  if(pct < 90) return `⚡ Hampir selesai! Tinggal ${total-done} checkpoint lagi. Jangan berhenti sekarang!`;
  return "🎉 Luar biasa! Semua checkpoint selesai. Kamu siap jadi FinTech Smart Learner!";
}

function readerStatement(pct){
  const name = getUserName() || "Kamu";

  if(pct === 0){
    return `👋 ${name}, kamu sedang memulai langkah pertama menuju literasi finansial digital. Keputusanmu belajar hari ini sangat tepat!`;
  }
  if(pct < 40){
    return `✅ ${name}, kamu sedang membangun fondasi yang kuat. Konsistensi kecil akan jadi hasil besar.`;
  }
  if(pct < 80){
    return `🔥 ${name}, progresmu bagus! Kamu siap menghadapi tantangan finansial digital lebih percaya diri.`;
  }
  return `🏅 ${name}, kamu sudah mencapai level tinggi. Kamu bukan hanya belajar, tapi berkembang!`;
}

/* ===========================
   BADGE LIST UI
   =========================== */
function renderBadgesUI(){
  const s = loadState();
  const list = document.getElementById("badgeList");
  if(!list) return;

  list.innerHTML = "";

  BADGES.forEach(b=>{
    const unlocked = s.badges?.[b.id];
    const el = document.createElement("div");
    el.className = "badge-chip";
    el.innerHTML = unlocked ? `✅ ${b.name}` : `🔒 ${b.name}`;
    list.appendChild(el);
  });
}

/* ===========================
   HISTORY TABLE UI
   =========================== */
function renderHistoryUI(){
  const s = loadState();
  const tbody = document.getElementById("historyBody");
  if(!tbody) return;

  const history = s.history || [];

  if(history.length === 0){
    tbody.innerHTML = `
      <tr class="history-empty-row">
        <td colspan="3">
          <div class="history-empty-box">
            ✨ Belum ada aktivitas.<br/>
            Mulai dari modul atau kuis dulu ya!
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = history.map(h=>{
    const date = new Date(h.ts).toLocaleString("id-ID", {
      day:"2-digit", month:"short", year:"numeric",
      hour:"2-digit", minute:"2-digit"
    });

    return `
      <tr>
        <td>${h.type}</td>
        <td>${h.id}</td>
        <td>${h.detail} <span style="opacity:.55">• ${date}</span></td>
      </tr>
    `;
  }).join("");
}


/* ===========================
   GAMIFICATION UI UPDATE
   =========================== */
function refreshGamificationUI(){
  const s = loadState();
  const points = s.points || 0;
  const lv = levelFor(points);
  const prog = overallProgress(s);

  const setText = (id,val)=>{
    const el=document.getElementById(id);
    if(el) el.textContent = val;
  };

  setText("pointsVal", points.toString());
  setText("levelVal", lv.current.name);

  const lvBar = document.getElementById("levelBar");
  if(lvBar){
    const start = lv.current.min;
    const end = lv.next ? lv.next.min : (lv.current.min + 120);
    const pct = lv.next ? Math.round(((points-start)/(end-start))*100) : 100;
    lvBar.style.width = formatPct(pct);
  }

  const progBar = document.getElementById("progressBar");
  if(progBar) progBar.style.width = formatPct(prog.pct);

  setText("progressVal", `${prog.pct}%`);
  setText("progressMeta", `${prog.done}/${prog.total} checkpoint`);

  renderCheckpointDots(prog.done, prog.total);

  const msg = document.getElementById("progressMessage");
  if(msg) msg.innerHTML = progressMotivation(prog.pct, prog.done, prog.total);

  const st = document.getElementById("readerStatement");
  if(st) st.innerHTML = readerStatement(prog.pct);

  renderBadgesUI();
  renderHistoryUI();
}

/* ===========================
   TOC STATUS
   =========================== */
function updateModuleTOCStatus(){
  const s = loadState();
  ["fintech","types","security","regulation"].forEach(id=>{
    const el = document.getElementById(`status-${id}`);
    if(el) el.textContent = s.reads?.[id] ? "✅" : "⏳";
  });
}

/* ===========================
   SCROLL PROGRESS + BACK TO TOP
   =========================== */
function setupScrollProgressAndTopBtn(){
  const bar = document.getElementById("scrollProgress");
  const btn = document.getElementById("backToTop");
  if(!bar || !btn) return;

  let hideTimer = null;

  function showBtn(){
    btn.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(()=> btn.classList.remove("show"), 900);
  }

  function update(){
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

    bar.style.width = pct + "%";

    if(scrollTop > 200) showBtn();
    else btn.classList.remove("show");
  }

  window.addEventListener("scroll", update, { passive:true });
  update();

  btn.addEventListener("click", ()=> window.scrollTo({ top:0, behavior:"smooth" }));
}

/* ===========================
   FORMAT INPUT ANGKA (IDR)
   =========================== */
function wireNumberFormatting(){
  const ids = ["income","need","want","save","target","monthly","months"];

  ids.forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;

    el.addEventListener("input", ()=>{
      if(id === "months"){
        el.value = el.value.replace(/\D/g,"");
        return;
      }

      const raw = el.value.replace(/\D/g,"");
      if(!raw){ el.value=""; return; }

      el.value = new Intl.NumberFormat("id-ID").format(raw);
    });
  });
}

/* ===========================
   TOOLS: SIMULASI TABUNGAN
   =========================== */
function wireSavingsTool(){
  const form = document.getElementById("saveForm");
  const targetEl = document.getElementById("target");
  const monthlyEl = document.getElementById("monthly");
  const monthsEl = document.getElementById("months");
  const out = document.getElementById("saveOut");

  if(!form || !targetEl || !monthlyEl || !monthsEl || !out) return;

  function numOnly(v){
    return parseFloat((v || "").toString().replace(/\D/g,"")) || 0;
  }
  function rupiah(n){
    return "Rp " + new Intl.NumberFormat("id-ID").format(n);
  }

  form.addEventListener("submit", (e)=>{
    e.preventDefault();

    const target = numOnly(targetEl.value);
    const monthly = numOnly(monthlyEl.value);
    const months = numOnly(monthsEl.value);

    if(!target){
      out.innerHTML = `<div class="notice">⚠️ <strong>Hasil:</strong> Masukkan target dana terlebih dahulu.</div>`;
      toast("Target dana belum diisi!","warn");
      return;
    }

    logActivity("🏦 Tabungan", "save_tool", `Target ${rupiah(target)}`);

    if(monthly > 0 && months === 0){
      const needMonths = Math.ceil(target / monthly);
      out.innerHTML = `
        <div class="notice">
          <strong>Hasil:</strong> Jika menabung <strong>${rupiah(monthly)}</strong>/bulan,
          kamu butuh sekitar <strong>${needMonths} bulan</strong> untuk mencapai target
          <strong>${rupiah(target)}</strong>. ✅
        </div>
      `;
      addPoints(10,"Kamu mencoba simulasi tabungan!");
      return;
    }

    if(months > 0 && monthly === 0){
      const needMonthly = Math.ceil(target / months);
      out.innerHTML = `
        <div class="notice">
          <strong>Hasil:</strong> Untuk mencapai target <strong>${rupiah(target)}</strong>
          dalam <strong>${months} bulan</strong>, kamu perlu menabung sekitar
          <strong>${rupiah(needMonthly)}</strong>/bulan. ✅
        </div>
      `;
      addPoints(10,"Kamu mencoba simulasi tabungan!");
      return;
    }

    if(monthly > 0 && months > 0){
      const total = monthly * months;

      if(total >= target){
        out.innerHTML = `
          <div class="notice">
            <strong>Hasil:</strong> Jika menabung <strong>${rupiah(monthly)}</strong>/bulan selama
            <strong>${months} bulan</strong>, totalnya <strong>${rupiah(total)}</strong>.
            ✅ <strong>Target tercapai!</strong>
          </div>
        `;
      }else{
        const kurang = target - total;
        out.innerHTML = `
          <div class="notice">
            <strong>Hasil:</strong> Jika menabung <strong>${rupiah(monthly)}</strong>/bulan selama
            <strong>${months} bulan</strong>, totalnya <strong>${rupiah(total)}</strong>.
            ⚠️ Target belum tercapai.<br/>
            Kekurangan: <strong>${rupiah(kurang)}</strong>
          </div>
        `;
      }

      addPoints(10,"Kamu mencoba simulasi tabungan!");
      return;
    }

    out.innerHTML = `<div class="notice">⚠️ <strong>Hasil:</strong> Isi setoran/bulan atau durasi agar bisa dihitung.</div>`;
    toast("Isi setoran atau durasi dulu ya!","warn");
  });
}

/* ===========================
   TOOLS: SIMULASI BUDGETING
   =========================== */
function wireBudgetTool(){
  const form = document.getElementById("budgetForm");
  const incomeEl = document.getElementById("income");
  const needEl   = document.getElementById("need");
  const wantEl   = document.getElementById("want");
  const saveEl   = document.getElementById("save");
  const out      = document.getElementById("budgetOut");

  if(!form || !incomeEl || !needEl || !wantEl || !saveEl || !out) return;

  function numOnly(v){
    return parseFloat((v || "").toString().replace(/\D/g,"")) || 0;
  }
  function rupiah(n){
    return "Rp " + new Intl.NumberFormat("id-ID").format(n);
  }
  function pct(part, total){
    if(!total) return 0;
    return Math.round((part / total) * 100);
  }

  form.addEventListener("submit", (e)=>{
    e.preventDefault();

    const income = numOnly(incomeEl.value);
    const need   = numOnly(needEl.value);
    const want   = numOnly(wantEl.value);
    const save   = numOnly(saveEl.value);

    if(!income){
      out.innerHTML = `<div class="notice">⚠️ <strong>Input belum lengkap.</strong> Masukkan pemasukan bulanan.</div>`;
      toast("Isi pemasukan dulu ya!","warn");
      return;
    }

    const totalAlloc = need + want + save;
    const remaining  = income - totalAlloc;

    logActivity("💰 Budgeting", "budget_tool", `Pemasukan ${rupiah(income)} | Sisa ${rupiah(remaining)}`);

    const needPct = pct(need, income);
    const wantPct = pct(want, income);
    const savePct = pct(save, income);

    let insight = "";
    if(remaining < 0){
      insight = "Pengeluaran melebihi pemasukan. Coba kurangi keinginan atau tambah pemasukan.";
    }else if(savePct < 10){
      insight = "Porsi tabungan/investasi masih kecil. Mulai dari auto-debit kecil tapi konsisten.";
    }else if(savePct < 20){
      insight = "Porsi tabungan sudah cukup baik. Pertahankan dan coba tingkatkan sedikit demi sedikit.";
    }else{
      insight = "Porsi tabungan/investasi sudah bagus. Pastikan juga dana darurat & tujuan finansial jelas.";
    }

    out.innerHTML = `
      <div class="budget-kpis">
        <div class="budget-kpi">
          <div class="val">${rupiah(income)}</div>
          <div class="lbl">Pemasukan</div>
        </div>

        <div class="budget-kpi">
          <div class="val">${rupiah(totalAlloc)}</div>
          <div class="lbl">Total Alokasi</div>
        </div>

        <div class="budget-kpi">
          <div class="val">${rupiah(remaining)}</div>
          <div class="lbl">Sisa</div>
        </div>
      </div>

      <hr class="sep"/>

      <div class="budget-insight">
        <strong>Insight cepat:</strong> ${insight}
      </div>

      <div class="budget-bars">
        <div class="title">Visual alokasi (perkiraan)</div>

        <div class="budget-bar">
          <div class="label">Kebutuhan</div>
          <div class="track"><div class="fill" style="width:${needPct}%"></div></div>
          <div class="pct">Kebutuhan: <strong>${needPct}%</strong></div>
        </div>

        <div class="budget-bar">
          <div class="label">Keinginan</div>
          <div class="track"><div class="fill" style="width:${wantPct}%"></div></div>
          <div class="pct">Keinginan: <strong>${wantPct}%</strong></div>
        </div>

        <div class="budget-bar">
          <div class="label">Tabungan/Investasi</div>
          <div class="track"><div class="fill" style="width:${savePct}%"></div></div>
          <div class="pct">Tabungan/Investasi: <strong>${savePct}%</strong></div>
        </div>
      </div>
    `;

    addPoints(15,"Simulasi budgeting berhasil disimpan!");
  });
}
function resetProgress(){
  if(!confirm("Reset progress Fin.Journey di perangkat ini?")) return;
  localStorage.removeItem(STORE_KEY);
  toast("Progress di-reset. Kamu bisa mulai ulang ✅","success");
  refreshGamificationUI();
}
function drawActivityChart(){
  const canvas = document.getElementById("activityChart");
  if(!canvas) return;

  const ctx = canvas.getContext("2d");
  const s = loadState();

  // ✅ data progress
  const modules = Object.values(s.reads||{}).filter(Boolean).length;
  const quizzes = Object.keys(s.quizzes||{}).length;

  const total = modules + quizzes;

  // ✅ reset canvas
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 85;
  const lineWidth = 22;

  // ✅ base ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI*2);
  ctx.strokeStyle = "rgba(255,255,255,.06)";
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // ✅ kalau total = 0 tampilkan "Belum ada aktivitas"
  if(total === 0){
    ctx.font = "900 16px system-ui";
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.textAlign = "center";
    ctx.fillText("0", centerX, centerY - 4);

    ctx.font = "700 12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillText("Belum ada aktivitas", centerX, centerY + 18);
    return;
  }

  // ✅ komposisi
  const modPct = modules / total;
  const quizPct = quizzes / total;

  let startAngle = -Math.PI/2;

  // ✅ modul arc
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, startAngle + Math.PI*2*modPct);
  ctx.strokeStyle = "rgba(0,230,118,.95)";
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.stroke();

  startAngle += Math.PI*2*modPct;

  // ✅ quiz arc
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, startAngle + Math.PI*2*quizPct);
  ctx.strokeStyle = "rgba(255,213,79,.95)";
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.stroke();

  // ✅ text center
  ctx.font = "900 22px system-ui";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(`${total}`, centerX, centerY - 6);

  ctx.font = "700 12px system-ui";
  ctx.fillStyle = "rgba(255,255,255,.6)";
  ctx.fillText("Aktivitas selesai", centerX, centerY + 16);
}

/* ===========================
   BOOT (HANYA SEKALI)
   =========================== */
document.addEventListener("DOMContentLoaded", ()=>{
  setActiveNav();
  setupScrollProgressAndTopBtn();
  drawActivityChart();
  wireNumberFormatting();
  wireBudgetTool();
  wireSavingsTool();
renderHistoryUI();
  refreshGamificationUI();
  updateModuleTOCStatus();

  renderGreeting();
  if(!getUserName()) showNameModal();
  setTimeout(drawActivityChart, 150);
  // Quiz (jalan kalau form ada)
  wireQuiz("fintechQuiz","fintech_quiz",{q1:"b", q2:"a", q3:"a", q4:"b"});
  wireQuiz("typesQuiz","types_quiz",{q1:"b", q2:"a", q3:"a", q4:"a"});
  wireQuiz("securityQuiz","security_quiz",{q1:"b", q2:"a", q3:"a", q4:"b"});
  wireQuiz("regulationQuiz","regulation_quiz",{q1:"a", q2:"a", q3:"b", q4:"a"});
});
