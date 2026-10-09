(() => {
  "use strict";
  const STORAGE_KEY = "pocketCards.v1";
  const COLORS = ["lavender", "peach", "mint", "blue", "rose"];
  const SYMBOLS = {lavender:"✦", peach:"☼", mint:"❋", blue:"✧", rose:"♡"};
  const $ = id => document.getElementById(id);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));
  const todayKey = () => new Date().toISOString().slice(0,10);
  let state = loadState();
  let currentView = "homeView";
  let activeDeckId = null;
  let studyQueue = [];
  let studyIndex = 0;
  let showingAnswer = false;
  let currentStudyMode = "due";
  let drafts = [];
  let toastTimer;

  function freshState(){return {version:1,decks:[],cards:[]};}
  function loadState(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw)return freshState();
      const parsed=JSON.parse(raw);
      if(!parsed || !Array.isArray(parsed.decks)||!Array.isArray(parsed.cards))return freshState();
      parsed.cards=parsed.cards.map(c=>({...c,interval:Number(c.interval)||0,repetitions:Number(c.repetitions)||0,lapses:Number(c.lapses)||0}));
      return parsed;
    }catch(e){return freshState();}
  }
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAll();}catch(e){toast("Storage is full. Export a backup and remove some data.");}}
  function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
  function deckCards(id){return state.cards.filter(c=>c.deckId===id);}
  function dueCards(id){const today=todayKey();return deckCards(id).filter(c=>!c.dueDate||c.dueDate<=today);}
  function isMastered(c){return (c.repetitions||0)>=3&&(c.interval||0)>=7;}
  function cardDefaults(card){return {createdAt:Date.now(),dueDate:todayKey(),interval:0,repetitions:0,lapses:0,lastReviewed:null,source:"",...card};}
  function getDeck(id){return state.decks.find(d=>d.id===id);}
  function view(name){currentView=name;document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===name));document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));if(name==="studyView")document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));renderAll();window.scrollTo({top:0,behavior:"smooth"});}
  function renderAll(){renderHome();renderDecks();renderSelects();renderProgress();}
  function renderHome(){
    $("statCards").textContent=state.cards.length;
    $("statDue").textContent=state.cards.filter(c=>!c.dueDate||c.dueDate<=todayKey()).length;
    $("statMastered").textContent=state.cards.filter(isMastered).length;
    const container=$("homeDecks");
    container.innerHTML=state.decks.slice(0,6).map(deckCardHtml).join("");
    $("emptyState").classList.toggle("hidden",state.decks.length>0);
    container.classList.toggle("hidden",state.decks.length===0);
    bindDeckCards(container);
  }
  function deckCardHtml(d){
    const cards=deckCards(d.id), due=dueCards(d.id).length, mastered=cards.filter(isMastered).length, pct=cards.length?Math.round(mastered/cards.length*100):0;
    return `<article class="deck-card" data-deck="${escapeHtml(d.id)}" tabindex="0" role="button" aria-label="Open ${escapeHtml(d.name)}"><div class="deck-top"><span class="deck-symbol ${COLORS.includes(d.color)?d.color:"lavender"}">${SYMBOLS[d.color]||"✦"}</span><span class="deck-dots">•••</span></div><h3>${escapeHtml(d.name)}</h3><span class="deck-meta">${cards.length} card${cards.length===1?"":"s"} · ${due} due</span><div class="deck-bottom"><span>${pct}% mastered</span><div class="mini-progress"><span style="width:${pct}%"></span></div></div></article>`;
  }
  function bindDeckCards(container){container.querySelectorAll("[data-deck]").forEach(el=>{const open=()=>openDeck(el.dataset.deck);el.addEventListener("click",open);el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});});}
  function renderDecks(){
    const container=$("allDecks");container.innerHTML=state.decks.map(deckCardHtml).join("");bindDeckCards(container);
    $("allDecksEmpty").classList.toggle("hidden",state.decks.length>0);container.classList.toggle("hidden",state.decks.length===0);
  }
  function renderSelects(){
    const options=state.decks.map(d=>`<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`).join("");
    $("cardDeck").innerHTML=options||'<option value="">Create a deck first</option>';
    $("pdfDeckSelect").innerHTML=options||'<option value="">Create a deck first</option>';
  }
  function renderProgress(){
    const total=state.cards.length, mastered=state.cards.filter(isMastered).length, pct=total?Math.round(mastered/total*100):0;
    $("masteryPercent").textContent=pct+"%";document.querySelector(".progress-ring").style.setProperty("--pct",pct+"%");
    $("progressHeadline").textContent=total?(pct>=75?"Look at you, memory machine!":pct>=35?"Your recall is growing":"Every card is a fresh start"):"Your journey starts here";
    $("progressCopy").textContent=total?`${mastered} of ${total} cards mastered. ${state.cards.filter(c=>!c.dueDate||c.dueDate<=todayKey()).length} ready for review today.`:"Add a few cards and your progress will appear here.";
    $("progressDecks").innerHTML=state.decks.map(d=>{const cards=deckCards(d.id),m=cards.filter(isMastered).length,p=cards.length?Math.round(m/cards.length*100):0;return `<div class="progress-deck"><div class="progress-deck-top"><strong>${escapeHtml(d.name)}</strong><span>${m}/${cards.length} mastered · ${p}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div></div>`;}).join("")||'<p class="small-note">Your decks will show up here once you create them.</p>';
  }
  function openDialog(id){$(id).showModal();}
  function closeDialog(id){$(id).close();}
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeDialog(b.dataset.close)));
  function openDeck(id){
    const d=getDeck(id);if(!d)return;activeDeckId=id;
    $("detailDeckName").textContent=d.name;
    const cards=deckCards(id);$("detailDeckMeta").textContent=`${cards.length} cards · ${dueCards(id).length} due for review`;
    $("detailCards").innerHTML=cards.map(c=>`<div class="detail-card"><div><strong>${escapeHtml(c.question)}</strong><p>${escapeHtml(c.source||"No source reference")}</p></div><div class="detail-card-actions"><button data-edit-card="${escapeHtml(c.id)}">Edit</button><button data-delete-card="${escapeHtml(c.id)}">Delete</button></div></div>`).join("")||'<p class="small-note">No cards in this deck yet. Add your first one.</p>';
    $("detailCards").querySelectorAll("[data-edit-card]").forEach(b=>b.addEventListener("click",()=>editCard(b.dataset.editCard)));
    $("detailCards").querySelectorAll("[data-delete-card]").forEach(b=>b.addEventListener("click",()=>deleteCard(b.dataset.deleteCard)));
    $("detailStudyDue").disabled=dueCards(id).length===0;$("detailStudyDue").style.opacity=dueCards(id).length===0?".5":"1";
    openDialog("deckDetailDialog");
  }
  function openDeckForm(id=null){
    const d=id?getDeck(id):null;$("deckId").value=d?d.id:"";$("deckName").value=d?d.name:"";$("deckColor").value=d?d.color:"lavender";$("deckDialogTitle").textContent=d?"Edit deck":"Create a deck";openDialog("deckDialog");
  }
  function openCardForm(card=null,deckId=null){
    if(!state.decks.length){toast("Create a deck first.");openDeckForm();return;}
    $("cardId").value=card?card.id:"";$("cardDeck").value=(card&&card.deckId)||deckId||activeDeckId||state.decks[0].id;
    $("cardQuestion").value=card?card.question:"";$("cardAnswer").value=card?card.answer:"";$("cardSourceInput").value=card?card.source||"":"";
    $("cardDialogTitle").textContent=card?"Edit flashcard":"Add a flashcard";openDialog("cardDialog");
  }
  function editCard(id){const c=state.cards.find(x=>x.id===id);if(!c)return;closeDialog("deckDetailDialog");openCardForm(c);}
  function deleteCard(id){const c=state.cards.find(x=>x.id===id);if(!c)return;if(!confirm("Delete this flashcard? This cannot be undone."))return;state.cards=state.cards.filter(x=>x.id!==id);save();openDeck(activeDeckId);toast("Card deleted.");}
  $("deckForm").addEventListener("submit",e=>{
    e.preventDefault();const id=$("deckId").value,name=$("deckName").value.trim(),color=$("deckColor").value;if(!name)return;
    if(id){const d=getDeck(id);if(d){d.name=name;d.color=color;}}
    else{const d={id:uid(),name,color,createdAt:Date.now()};state.decks.push(d);}
    closeDialog("deckDialog");save();toast(id?"Deck updated.":"Deck created.");
  });
  $("cardForm").addEventListener("submit",e=>{
    e.preventDefault();const id=$("cardId").value,deckId=$("cardDeck").value,question=$("cardQuestion").value.trim(),answer=$("cardAnswer").value.trim(),source=$("cardSourceInput").value.trim();if(!deckId||!question||!answer){toast("Choose a deck and fill in both sides.");return;}
    if(id){const c=state.cards.find(x=>x.id===id);if(c)Object.assign(c,{deckId,question,answer,source});}
    else state.cards.push(cardDefaults({id:uid(),deckId,question,answer,source}));
    closeDialog("cardDialog");save();toast(id?"Card updated.":"Card saved.");
    if(activeDeckId)openDeck(activeDeckId);
  });
  $("createDeckBtn").addEventListener("click",()=>openDeckForm());
  $("createDeckShortcut").addEventListener("click",()=>openDeckForm());
  $("emptyCreateDeck").addEventListener("click",()=>openDeckForm());
  $("detailAddCard").addEventListener("click",()=>{closeDialog("deckDetailDialog");openCardForm(null,activeDeckId);});
  $("detailEditDeck").addEventListener("click",()=>{const id=activeDeckId;closeDialog("deckDetailDialog");openDeckForm(id);});
  $("detailDeleteDeck").addEventListener("click",()=>{
    const d=getDeck(activeDeckId);if(!d)return;
    if(!confirm(`Delete "${d.name}" and all its cards? This cannot be undone.`))return;
    state.decks=state.decks.filter(x=>x.id!==d.id);state.cards=state.cards.filter(c=>c.deckId!==d.id);closeDialog("deckDetailDialog");save();toast("Deck deleted.");
  });
  document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>view(b.dataset.view)));
  $("backFromStudy").addEventListener("click",()=>{view("decksView");if(activeDeckId&&getDeck(activeDeckId))openDeck(activeDeckId);});
  $("detailStudyDue").addEventListener("click",()=>startStudy(activeDeckId,"due"));
  $("detailStudyAll").addEventListener("click",()=>startStudy(activeDeckId,"all"));
  $("flashcard").addEventListener("click",flipCard);
  $("studyAllBtn").addEventListener("click",()=>startStudy(activeDeckId,"all"));
  $("editStudyCard").addEventListener("click",()=>{const c=studyQueue[studyIndex];if(c)openCardForm(state.cards.find(x=>x.id===c.id));});
  $("shuffleStudy").addEventListener("click",()=>{studyQueue=shuffle(studyQueue);studyIndex=0;showingAnswer=false;renderStudyCard();toast("Cards shuffled.");});
  document.querySelectorAll("[data-rating]").forEach(b=>b.addEventListener("click",()=>rateCard(b.dataset.rating)));
  function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function startStudy(deckId,mode="due"){
    const d=getDeck(deckId);if(!d)return;activeDeckId=deckId;currentStudyMode=mode;
    const cards=deckCards(deckId);studyQueue=(mode==="due"?cards.filter(c=>!c.dueDate||c.dueDate<=todayKey()):cards);
    studyQueue=shuffle(studyQueue);studyIndex=0;showingAnswer=false;closeDialog("deckDetailDialog");view("studyView");renderStudyCard();
  }
  function renderStudyCard(){
    const empty=studyQueue.length===0||studyIndex>=studyQueue.length;
    $("studyEmpty").classList.toggle("hidden",!empty);$("flashcard").classList.toggle("hidden",empty);$("answerActions").classList.add("hidden");$("studyEditRow").classList.toggle("hidden",empty);
    if(empty){$("studyCounter").textContent="All done";$("studyRemaining").textContent="0 remaining";$("studyProgressBar").style.width="100%";return;}
    const c=studyQueue[studyIndex];$("studyDeckName").textContent=(getDeck(activeDeckId)||{}).name||"Study";
    $("studyCounter").textContent=`Card ${studyIndex+1} of ${studyQueue.length}`;$("studyRemaining").textContent=`${studyQueue.length-studyIndex-1} remaining`;
    $("studyProgressBar").style.width=`${Math.round(studyIndex/studyQueue.length*100)}%`;
    $("cardType").textContent=showingAnswer?"ANSWER":"QUESTION";$("cardPrompt").textContent=showingAnswer?c.answer:c.question;
    $("cardSource").textContent=c.source?`Source: ${c.source}`:"";
    $("flipHint").textContent=showingAnswer?"Answer revealed":"Tap to reveal answer ↗";
    $("flashcard").classList.toggle("is-answer",showingAnswer);$("flashcard").setAttribute("aria-label",showingAnswer?"Answer shown. Tap to see question":"Question shown. Tap to reveal answer");
    if(showingAnswer)$("answerActions").classList.remove("hidden");
  }
  function flipCard(){if(!studyQueue[studyIndex])return;showingAnswer=!showingAnswer;renderStudyCard();}
  function rateCard(rating){
    const c=studyQueue[studyIndex];if(!c)return;const original=state.cards.find(x=>x.id===c.id);if(!original)return;
    const now=new Date();original.lastReviewed=now.toISOString();
    if(rating==="again"){original.repetitions=0;original.interval=0;original.lapses=(original.lapses||0)+1;original.dueDate=todayKey();}
    else if(rating==="hard"){original.repetitions=(original.repetitions||0)+1;original.interval=Math.max(1,Math.round((original.interval||1)*1.2));original.dueDate=addDays(1);}
    else{original.repetitions=(original.repetitions||0)+1;original.interval=original.repetitions===1?1:original.repetitions===2?3:Math.max(7,Math.round((original.interval||3)*2));original.dueDate=addDays(original.interval);}
    save();studyIndex++;showingAnswer=false;renderStudyCard();if(studyIndex>=studyQueue.length)toast("Session complete. Nice work! ✨");
  }
  function addDays(n){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}

  // Local PDF text extraction uses PDF.js. The first-party files are hosted on a CDN for this optional feature.
  if(window.pdfjsLib){pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";}
  $("pdfForm").addEventListener("submit",async e=>{
    e.preventDefault();const file=$("pdfFile").files[0],deckId=$("pdfDeckSelect").value,limit=Number($("pdfCardCount").value)||20;
    if(!state.decks.length){toast("Create a deck first.");return;}
    if(!file){showPdfStatus("Choose a PDF first.",true);return;}
    if(!file.name.toLowerCase().endsWith(".pdf")&&file.type!=="application/pdf"){showPdfStatus("Please choose a PDF file.",true);return;}
    if(!window.pdfjsLib){showPdfStatus("PDF reader library could not load. Connect to the internet once and reload this page, or try again later.",true);return;}
    const btn=$("generateBtn");btn.disabled=true;btn.textContent="Reading PDF…";$("draftArea").classList.add("hidden");
    try{
      const buffer=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:buffer}).promise;let allText="",pageTexts=[];
      for(let p=1;p<=pdf.numPages;p++){
        showPdfStatus(`Reading page ${p} of ${pdf.numPages}…`);
        const page=await pdf.getPage(p),content=await page.getTextContent();
        const text=content.items.map(it=>it.str).join(" ").replace(/\s+/g," ").trim();
        pageTexts.push({page:p,text});allText+=`\n${text}`;
      }
      if(allText.replace(/\s/g,"").length<80){throw new Error("This PDF has little or no selectable text. It may be scanned or image-only, which this version cannot read.");}
      drafts=makeDrafts(pageTexts,limit,file.name);
      if(!drafts.length)throw new Error("I couldn't find enough useful text to draft cards. Try a text-based PDF with clearer headings or definitions.");
      drafts=drafts.map(d=>({...d,deckId,selected:true,source:`${file.name} · page ${d.page}`}));
      renderDrafts();showPdfStatus(`Made ${drafts.length} draft cards from ${pdf.numPages} pages. Please check every answer and source before saving.`);
    }catch(err){showPdfStatus(err.message||"Something went wrong while reading this PDF.",true);}
    finally{btn.disabled=false;btn.textContent="Extract text & draft cards";}
  });
  function showPdfStatus(msg,error=false){$("pdfStatus").textContent=msg;$("pdfStatus").classList.remove("hidden");$("pdfStatus").classList.toggle("error",error);}
  function makeDrafts(pages,limit,filename){
    const out=[],seen=new Set();
    const add=(question,answer,page,kind="key point")=>{
      question=question.trim().replace(/\s+/g," ");answer=answer.trim().replace(/\s+/g," ");
      if(question.length<10||answer.length<12||question.length>240||answer.length>900)return;
      const key=(question+"|"+answer).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
      if(seen.has(key))return;seen.add(key);out.push({id:uid(),question,answer,page,kind,filename});
    };
    for(const pg of pages){
      if(out.length>=limit)break;const t=pg.text;if(!t)continue;
      // Definition-like patterns: "X means/is/refers to..."
      const sentences=t.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).map(s=>s.trim()).filter(Boolean);
      for(const s of sentences){
        if(out.length>=limit)break;
        const m=s.match(/^(.{3,95}?)\s+(?:means|is defined as|refers to|is the process of|are defined as)\s+(.{15,})$/i);
        if(m){add(`What is ${m[1].replace(/[,:;]+$/,"")}?`,s,pg.page,"definition");continue;}
        const m2=s.match(/^(.{3,90}?)\s*:\s*(.{18,})$/);
        if(m2 && !/[;.!?]$/.test(m2[1])){add(`Explain ${m2[1]} .`,m2[2],pg.page,"definition");}
      }
      // Heading + following content.
      const chunks=t.split(/(?<=[.!?])\s+|\s{2,}/).map(s=>s.trim()).filter(Boolean);
      for(let i=0;i<chunks.length-1&&out.length<limit;i++){
        const h=chunks[i].replace(/^[\d.()\- ]+/,"").trim();
        const next=chunks[i+1];
        if(h.length>=8&&h.length<=75&&h.split(/\s+/).length<=9&&!/[.!?]$/.test(h)&&next.length>=35&&next.length<=550){
          if(/^(chapter|contents|index|page \d+|illustration|example \d*|figure \d*)/i.test(h))continue;
          add(`What are the key points about "${h}"?`,next,pg.page,"key point");
        }
      }
      // List-like clauses are useful as recall prompts.
      const listMatch=t.match(/(.{5,90}?)(?:include|includes|consist of|consists of|are as follows)\s+(.{20,350}?)(?:[.!?]|$)/i);
      if(listMatch&&out.length<limit)add(`List the points related to ${listMatch[1].trim()}?`,listMatch[2].trim(),pg.page,"list");
    }
    // Fallback: turn coherent, medium-length sentences into a basic recall card.
    if(out.length<Math.min(5,limit)){
      for(const pg of pages){
        const sentences=pg.text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>=55&&s.length<=420);
        for(const s of sentences){if(out.length>=limit)break;const first=s.split(/[,:;]/)[0];add(`Recall the main point about: ${first.slice(0,85)}?`,s,pg.page,"recall");}
        if(out.length>=limit)break;
      }
    }
    return out.slice(0,limit);
  }
  function renderDrafts(){
    $("draftArea").classList.remove("hidden");$("draftCount").textContent=drafts.length;
    $("draftList").innerHTML=drafts.map((d,i)=>`<article class="draft-card"><input type="checkbox" data-draft-check="${i}" ${d.selected?"checked":""} aria-label="Select draft card"><div><p class="draft-question">${escapeHtml(d.question)}</p><p class="draft-answer">${escapeHtml(d.answer)}</p><div class="draft-source">📄 ${escapeHtml(d.source)} · ${escapeHtml(d.kind)}</div></div><button class="draft-edit" data-draft-edit="${i}">Edit</button></article>`).join("");
    $("draftList").querySelectorAll("[data-draft-check]").forEach(el=>el.addEventListener("change",()=>{drafts[Number(el.dataset.draftCheck)].selected=el.checked;}));
    $("draftList").querySelectorAll("[data-draft-edit]").forEach(el=>el.addEventListener("click",()=>editDraft(Number(el.dataset.draftEdit))));
  }
  function editDraft(i){
    const d=drafts[i];if(!d)return;
    const q=prompt("Edit question / prompt:",d.question);if(q===null)return;
    const a=prompt("Edit answer:",d.answer);if(a===null)return;
    const s=prompt("Edit source reference:",d.source);if(s===null)return;
    if(!q.trim()||!a.trim()){toast("Question and answer cannot be empty.");return;}
    Object.assign(d,{question:q.trim(),answer:a.trim(),source:s.trim()});renderDrafts();
  }
  $("selectAllDrafts").addEventListener("click",()=>{drafts.forEach(d=>d.selected=true);renderDrafts();});
  $("clearDrafts").addEventListener("click",()=>{if(confirm("Clear all unsaved draft cards?")){$("draftArea").classList.add("hidden");drafts=[];$("pdfFile").value="";}});
  $("saveDrafts").addEventListener("click",()=>{
    const chosen=drafts.filter(d=>d.selected);if(!chosen.length){toast("Select at least one card.");return;}
    for(const d of chosen)state.cards.push(cardDefaults({id:uid(),deckId:d.deckId,question:d.question,answer:d.answer,source:d.source,origin:"pdf"}));
    save();toast(`${chosen.length} cards saved to your deck.`);drafts=drafts.filter(d=>!d.selected);renderDrafts();if(!drafts.length)$("draftArea").classList.add("hidden");
  });

  $("exportBtn").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`pocket-cards-backup-${todayKey()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast("Backup exported.");
  });
  $("importFile").addEventListener("change",async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data.decks)||!Array.isArray(data.cards))throw new Error("This doesn't look like a Pocket Cards backup.");
      if(!confirm("Importing will replace the cards and decks currently saved in this browser. Export a backup first if needed. Continue?"))return;
      const deckIds=new Set(data.decks.map(d=>d.id));
      if(data.cards.some(c=>!deckIds.has(c.deckId)))throw new Error("Some cards refer to missing decks.");
      state={version:1,decks:data.decks,cards:data.cards};save();toast("Backup imported.");
    }catch(err){toast(err.message||"Could not import backup.");}
    finally{e.target.value="";}
  });

  // Optional PWA installation prompt.
  let installPrompt=null;
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("installBtn").classList.remove("hidden");});
  $("installBtn").addEventListener("click",async()=>{if(!installPrompt){toast("Use your browser menu and choose Install app or Add to Home screen.");return;}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installBtn").classList.add("hidden");});
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"))window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));

  renderAll();
})();