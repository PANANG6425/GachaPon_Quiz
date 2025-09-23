let questions = []; // Seed Questions

let totalDraws = 0;
let currentQuestion = null;
const usedIdsByKey = new Map();
let isRolling = false;

// DOM Elements
const gachaBtn = document.getElementById('gachaBtn');
const categoryFilter = document.getElementById('categoryFilter');
const resetUsedBtn = document.getElementById('resetUsedBtn');
const noRepeatToggle = document.getElementById('noRepeatToggle');
const questionList = document.getElementById('questionList');
const animHint = document.getElementById('animHint');

const titleEl = document.getElementById('newQuestionTitle');
const contentEl = document.getElementById('newQuestionContent');
const categoryEl = document.getElementById('newQuestionCategory');
const addBtn = document.getElementById('addQuestionBtn');
const clearBtn = document.getElementById('clearFormBtn');
const csvInput = document.getElementById('csvInput');
const csvStatus = document.getElementById('csvImportStatus');

updateStats();
renderQuestionList();

document.addEventListener('keydown', (e) => { if (e.code==='Space'&&!e.repeat){e.preventDefault(); drawRandomQuestion();} });
categoryFilter.addEventListener('change', ()=>{usedIdsByKey.set(getUsedKey(), new Set());});
resetUsedBtn.addEventListener('click', ()=>{usedIdsByKey.clear(); alert('รีเซ็ตโหมดไม่ซ้ำแล้ว');});
gachaBtn.addEventListener('click', drawRandomQuestion);

// Add/Clear Question
addBtn.addEventListener('click', () => {
  const title = titleEl.value.trim(), content = contentEl.value.trim(), category = categoryEl.value.trim();
  if(!title||!content||!category){ alert('กรุณากรอกหัวข้อ/เนื้อหา และเลือกหมวดหมู่ให้ครบ'); return; }
  questions.push({id:Date.now(), title, content, category, drawCount:0});
  titleEl.value=''; contentEl.value=''; categoryEl.value='';
  updateStats(); renderQuestionList();
});
clearBtn.addEventListener('click', ()=>{ titleEl.value=''; contentEl.value=''; categoryEl.value=''; });

// CSV Import
csvInput.addEventListener('change', (e)=>{
  const file = e.target.files?.[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload=()=>{
    csvStatus.textContent='กำลังประมวลผล...';
    try{
      const bytes = new Uint8Array(reader.result||[]);
      let start=0; if(bytes.length>=3 && bytes[0]===0xEF && bytes[1]===0xBB && bytes[2]===0xBF){ start=3; }
      let text=null; const encs=['utf-8','windows-874'];
      for(const enc of encs){ try{ const dec=new TextDecoder(enc); const cand=dec.decode(bytes.subarray(start)); if(!/\uFFFD/.test(cand)||/[\u0E00-\u0E7F]/.test(cand)){text=cand; break;} }catch(err){} }
      if(text===null){ try{text=new TextDecoder('utf-8').decode(bytes);}catch(err){text=String.fromCharCode.apply(null,Array.from(bytes));}}
      text=text.replace(/^\uFEFF/,'').normalize('NFC');
      const rows=parseCSV(text);
      let header=['title','content','category'], startIdx=1;
      if(rows.length && rows[0].length>=3){ const first=rows[0].map(x=>x.trim().toLowerCase()); if(first.includes('title')&&first.includes('content')&&first.includes('category')){header=first;} }
      let added=0;
      for(let i=startIdx;i<rows.length;i++){
        const r=rows[i]; if(r.length<3) continue;
        const rec=objFromRow(header,r);
        const title=(rec.title||'').trim(), content=(rec.content||'').trim(), category=(rec.category||'').trim();
        if(!title||!content||!category) continue;
        questions.push({id:Date.now()+Math.floor(Math.random()*1000), title, content, category, drawCount:0});
        added++;
      }
      updateStats(); renderQuestionList(); csvStatus.textContent=`นำเข้าแล้ว ${added} ข้อ`;
    }catch(err){ console.error(err); csvStatus.textContent='เกิดข้อผิดพลาดในการอ่านไฟล์'; } finally{ e.target.value=''; }
  };
  reader.readAsArrayBuffer(file);
});

// CSV helpers
function parseCSV(text){ return text.split(/\r?\n/).filter(l=>l.trim()).map(parseCSVLine); }
function parseCSVLine(line){ let res=[], cur='', inQuotes=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(ch==='"'){ if(inQuotes && line[i+1]==='"'){cur+='"';i++;}else{inQuotes=!inQuotes;} } else if(ch===','&&!inQuotes){res.push(cur);cur='';}else{cur+=ch;} } res.push(cur); return res; }
function objFromRow(header,row){ const obj={}; for(let i=0;i<3;i++){ obj[(header[i]||'').toLowerCase()]=row[i]??''; } return obj; }

// Randomization
function drawRandomQuestion(){
  if(isRolling) return;
  const list=getFilteredQuestions();
  if(list.length===0){ alert('ไม่มีโจทย์ในหมวดหมู่นี้'); return; }
  isRolling=true; gachaBtn.classList.add('spin'); animHint.textContent='กำลังสุ่ม...'; animHint.classList.add('slot');
  const titleElD=document.getElementById('questionTitle');
  const contentElD=document.getElementById('questionContent');
  const catEl=document.getElementById('questionCategory');
  const resultEl=document.getElementById('questionResult');
  const noEl=document.getElementById('noQuestion');
  resultEl.classList.remove('hidden'); noEl.classList.add('hidden');

  let tick=0;
  const rollInterval=setInterval(()=>{ const r=list[Math.floor(Math.random()*list.length)]; titleElD.textContent=r.title; contentElD.textContent=r.content; catEl.textContent=r.category; tick++; }, 70);

  setTimeout(()=>{
    clearInterval(rollInterval);
    let q;
    if(noRepeatToggle.checked){ q=getRandomNoRepeat(list); if(!q){ usedIdsByKey.set(getUsedKey(), new Set()); q=getRandomNoRepeat(list);} } else { q=list[Math.floor(Math.random()*list.length)]; }
    currentQuestion=q; currentQuestion.drawCount++; totalDraws++;
    displayQuestion(q); updateStats(); renderQuestionList();
    gachaBtn.classList.remove('spin'); gachaBtn.classList.add('shake'); setTimeout(()=>gachaBtn.classList.remove('shake'),700);
    animHint.textContent='เสร็จแล้ว!'; isRolling=false;
  },1200);
}

function getFilteredQuestions(){ const sel=categoryFilter.value; return sel?questions.filter(q=>q.category===sel):questions; }
function getRandomNoRepeat(list){ const key=getUsedKey(); if(!usedIdsByKey.has(key)) usedIdsByKey.set(key,new Set()); const used=usedIdsByKey.get(key); const candidates=list.filter(q=>!used.has(q.id)); if(candidates.length===0) return null; const chosen=candidates[Math.floor(Math.random()*candidates.length)]; used.add(chosen.id); usedIdsByKey.set(key,used); return chosen; }
function getUsedKey(){ const sel=categoryFilter.value; return sel?`CAT:${sel}`:'ALL'; }

function displayQuestion(q){ document.getElementById('questionCategory').textContent=q.category; document.getElementById('questionCount').textContent=`สุ่มแล้ว ${q.drawCount} ครั้ง`; document.getElementById('questionTitle').textContent=q.title; document.getElementById('questionContent').textContent=q.content; document.getElementById('questionResult').classList.remove('hidden'); document.getElementById('noQuestion').classList.add('hidden'); }

function updateStats(){ document.getElementById('totalQuestions').textContent=questions.length; document.getElementById('totalDraws').textContent=totalDraws; document.getElementById('currentQuestionId').textContent=currentQuestion?`#${currentQuestion.id}`:'-'; }

function renderQuestionList(){
  questionList.innerHTML='';
  questions.forEach(q=>{
    const div=document.createElement('div'); div.className='flex justify-between items-center p-3 bg-gray-50 rounded-lg';
    div.innerHTML=`<div class="flex-1 min-w-0"><div class="font-medium text-sm truncate">${escapeHtml(q.title)}</div><div class="text-xs text-gray-500">${escapeHtml(q.category)} • สุ่ม ${q.drawCount} ครั้ง</div></div><div class="flex items-center gap-2"><button class="edit text-blue-600 hover:text-blue-800 text-sm font-bold">แก้ไข</button><button class="del text-red-500 hover:text-red-700 text-sm font-bold">ลบ</button></div>`;
    div.querySelector('.del').onclick=()=>{ if(confirm('ต้องการลบโจทย์นี้หรือไม่?')){ questions=questions.filter(x=>x.id!==q.id); if(currentQuestion&&currentQuestion.id===q.id){document.getElementById('questionResult').classList.add('hidden'); document.getElementById('noQuestion').classList.remove('hidden'); currentQuestion=null;} updateStats(); renderQuestionList(); } };
    div.querySelector('.edit').onclick=()=>{ const nt=prompt('หัวข้อโจทย์',q.title)??q.title; const nc=prompt('เนื้อหาโจทย์',q.content)??q.content; const cat=prompt('หมวดหมู่ (คณิตศาสตร์/วิทยาศาสตร์/ภาษาไทย/ภาษาอังกฤษ/สังคมศึกษา)',q.category)??q.category; if(!nt.trim()||!nc.trim()||!cat.trim()){ alert('กรุณากรอกหัวข้อ/เนื้อหา/หมวดหมู่ให้ครบ'); return; } q.title=nt.trim(); q.content=nc.trim(); q.category=cat.trim(); renderQuestionList(); if(currentQuestion&&currentQuestion.id===q.id) displayQuestion(q); };
    questionList.appendChild(div);
  });
}

function escapeHtml(s=''){ return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
