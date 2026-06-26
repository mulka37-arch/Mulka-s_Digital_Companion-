// =========================================================
// AGNOSTIC DYNAMIC VOCABULARY MATRIX ENGINE
// =========================================================

let currentThemes = [];
let currentWords = [];
let filteredWords = [];
let currentTestWords = [];

let currentQuestion = 0;
let currentTest = "";
let score = 0;

let currentFilter = "all";
let currentBatchSize = 20;

let isPlayingAll = false;
let speechRate = 0.8;

let selectedGerman = null;
let selectedEnglish = null;

let answerLocked = false;
let matchedPairs = 0;
let systemVoices = [];

let starData = JSON.parse(localStorage.getItem("germanStarData")) || {};

// Global array placeholder to receive loaded data dynamically
const wordbankData = [];

// Discover dynamic columns ignoring system themes
function getDynamicColumns() {
  if (!wordbankData || wordbankData.length === 0) return ["word", "meaning"];
  // Dynamically scan whatever object properties are present in the current collection slice
  return Object.keys(wordbankData[0]).filter(key => !["theme", "Theme", "star", "originalIndex"].includes(key));
}

function autoDetectLanguage(keyName) {
  if (!keyName) return "de-DE";
  const k = keyName.toLowerCase().trim();
  if (/\b(en|english|translation|eng|meaning|phrasemeaning)\b/.test(k)) return "en-US";
  if (/\b(te|telugu)\b/.test(k)) return "te-IN";
  if (/\b(hi|hindi)\b/.test(k)) return "hi-IN";
  return "de-DE"; 
}

function getPrimaryKey(item) {
  const fields = getDynamicColumns();
  return item.word || item.German || item.infinitiv || item[fields[0]];
}

function getItemTheme(item) {
  if (!item) return "Uncategorized";
  return (item.Theme || item.theme || "").trim();
}

// =========================================================
// LIFECYCLE INIT SYSTEM
// =========================================================
window.onload = () => {
  initVoices();
  if (typeof speechSynthesis !== "undefined" && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = initVoices;
  }
  
  // UNIFIED AUTO-LOAD CORE
  // Automatically reads your combined database asset on runtime startup
  loadExternalVocabulary("data/vocabulary.json"); 
  
  setupButtons();
  updateStats();
};

function initVoices() {
  if (typeof speechSynthesis !== "undefined") {
    systemVoices = speechSynthesis.getVoices();
  }
}

function setupButtons(){
  document.getElementById("wordbank-btn").onclick = () => openModal("wordbank-modal");
  document.getElementById("testbank-btn").onclick = () => openModal("testbank-modal");
  document.getElementById("close-wordbank").onclick = closeAllModals;
  document.getElementById("close-testbank").onclick = closeAllModals;
  document.getElementById("close-settings").onclick = closeAllModals;
  document.getElementById("show-words-btn").onclick = loadSelectedThemes;
}

function openModal(id){
  document.getElementById(id).style.display = "block";
}

function closeAllModals(){
  fullResetUI();
  document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
  stopAudio();
}

function fullResetUI(){
  stopAudio();
  selectedGerman = null;
  selectedEnglish = null;
  const tc = document.getElementById("test-content");
  if(tc) tc.innerHTML = "";
  
  document.getElementById("test-theme-buttons").style.display = "grid";
  document.getElementById("test-type-buttons").style.display = "flex";
  document.getElementById("test-options-container").style.display = "none";
  document.getElementById("theme-selection-area").style.display = "block";
  document.getElementById("word-table-container").style.display = "none";
}

// =========================================================
// COLD EXTRACTION PIPELINE
// =========================================================
async function loadExternalVocabulary(url) {
  try {
    stopAudio();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
    
    const freshData = await response.json();
    if (Array.isArray(freshData) && freshData.length > 0) {
      wordbankData.length = 0; 
      freshData.forEach(item => wordbankData.push(item));
      buildThemes();
      fullResetUI();
      updateStats();
      console.log(`🚀 Success! Loaded ${wordbankData.length} records dynamically into application runtime context.`);
    }
  } catch (error) {
    console.warn("Target destination data asset file not found or contains syntax errors.", error);
  }
}

// =========================================================
// STRUCTURAL FILTER PIPELINE MAP
// =========================================================
function buildThemes(){
  const themes = [...new Set(wordbankData.map(w => getItemTheme(w)))].filter(Boolean);
  const themeButtons = document.getElementById("theme-buttons");
  const testThemeButtons = document.getElementById("test-theme-buttons");

  themeButtons.innerHTML = "";
  testThemeButtons.innerHTML = "";

  themes.forEach(theme => {
    const safeTheme = theme.replace(/'/g, "\\'");
    themeButtons.innerHTML += `
      <label class="theme-checkbox">
        <input type="checkbox" value="${theme}" class="theme-input">
        ${formatTheme(theme)}
      </label>
    `;
    testThemeButtons.innerHTML += `
      <button onclick="selectTestTheme('${safeTheme}')">${formatTheme(theme)}</button>
    `;
  });
}

function formatTheme(theme){
  return theme.replace(/_/g," ").replace(/\b\w/g,c => c.toUpperCase());
}

function loadSelectedThemes(){
  const selected = [...document.querySelectorAll(".theme-input:checked")].map(i => i.value);
  if(selected.length === 0){
    alert("Select at least one theme");
    return;
  }
  currentThemes = selected;
  currentWords = wordbankData.filter(w => currentThemes.includes(getItemTheme(w)));
  applyFilters();

  document.getElementById("theme-selection-area").style.display = "none";
  document.getElementById("word-table-container").style.display = "block";
  document.getElementById("theme-title").innerText = currentThemes.map(formatTheme).join(", ");
}

function setFilter(type){ currentFilter = type; applyFilters(); }
function setBatchSize(size){ currentBatchSize = size; applyFilters(); }

function applyFilters(){
  filteredWords = [...currentWords];

  if(currentFilter === "easy"){
    filteredWords = filteredWords.filter(w => getStar(getPrimaryKey(w)) === "easy");
  } else if(currentFilter === "hard"){
    filteredWords = filteredWords.filter(w => getStar(getPrimaryKey(w)) === "hard");
  } else if(currentFilter === "neutral"){
    filteredWords = filteredWords.filter(w => getStar(getPrimaryKey(w)) === "neutral");
  }

  if(currentBatchSize > 0){
    filteredWords = filteredWords.slice(0, currentBatchSize);
  }

  renderTable();
  updateStats();
}

function getStar(wordKey){ return starData[wordKey] || "neutral"; }

// =========================================================
// REAL-TIME DYNAMIC TABLE COMPILER
// =========================================================
function renderTable(){
  const table = document.getElementById("word-table");
  if (!table) return;
  table.innerHTML = "";

  const fields = getDynamicColumns();

  const thead = document.createElement("thead");
  let headerHtml = `<tr><th>⭐</th>`;
  fields.forEach(f => { headerHtml += `<th>${f}</th>`; });
  headerHtml += `</tr>`;
  thead.innerHTML = headerHtml;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  tbody.id = "word-table-body";

  filteredWords.forEach((word, index) => {
    const wordKey = getPrimaryKey(word);
    let starClass = "star-neutral";
    let starIcon = "⚪";

    if(getStar(wordKey) === "easy") { starClass = "star-easy"; starIcon = "🟢"; }
    if(getStar(wordKey) === "hard") { starClass = "star-hard"; starIcon = "🔴"; }

    const row = document.createElement("tr");
    row.className = "clickable-row";
    row.setAttribute("data-index", index);

    let rowHtml = `
      <td>
        <span class="star-btn ${starClass}" onclick="toggleStar('${wordKey.replace(/'/g, "\\'")}', event)">
          ${starIcon}
        </span>
      </td>
    `;

    fields.forEach(f => {
      let val = word[f];
      if (f === "Article" && !val) val = "-";
      rowHtml += `<td>${val !== null && val !== undefined ? val : ""}</td>`;
    });

    row.innerHTML = rowHtml;
    row.onclick = () => playAllAudio(index);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);

  if (!document.getElementById("advanced-loop-controls")) {
    const controlsBar = document.querySelector(".controls-bar");
    if (controlsBar) {
      const advancedLoopDiv = document.createElement("div");
      advancedLoopDiv.id = "advanced-loop-controls";
      advancedLoopDiv.style.cssText = "display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:10px; padding:10px; background:#f1f5f9; border-radius:8px; width:100%;";
      advancedLoopDiv.innerHTML = `
        <span style="font-weight:bold; font-size:13px; color:#1d3557;">🎛️ Audio Loop Mode:</span>
        <select id="loop-mode-select" onchange="updateAudioLoopSettings()" style="padding:6px; border-radius:6px; border:1px solid #cbd5e1; background:white;">
          <option value="sequence">In Sequence (1 to N)</option>
          <option value="alphabetical">Alphabetical Order</option>
          <option value="shuffle">Shuffle Playlist</option>
          <option value="repeat-row">Repeat Each Row X Times</option>
        </select>
        <div id="row-count-wrapper" style="display:none; align-items:center; gap:5px;">
          <label style="font-size:12px; font-weight:bold;">Count:</label>
          <input type="number" id="row-repeat-input" value="3" min="1" max="10" style="width:50px; padding:4px; border-radius:4px; border:1px solid #cbd5e1; text-align:center;">
        </div>
      `;
      controlsBar.parentNode.insertBefore(advancedLoopDiv, controlsBar.nextSibling);
    }
  }
}

function updateStats(){
  const total = currentWords.length;
  const easy = currentWords.filter(w => getStar(getPrimaryKey(w)) === "easy").length;
  const hard = currentWords.filter(w => getStar(getPrimaryKey(w)) === "hard").length;
  const neutral = currentWords.filter(w => getStar(getPrimaryKey(w)) === "neutral").length;

  const html = `
    <span>📚 Total: ${total}</span>
    <span>🔴 Hard: ${hard}</span>
    <span>🟢 Easy: ${easy}</span>
    <span>⚪ Neutral: ${neutral}</span>
  `;
  
  const statsBox = document.getElementById("stats-box");
  if(statsBox) statsBox.innerHTML = html;
  
  const testBox = document.getElementById("test-stats-box");
  if(testBox) testBox.innerHTML = html;
}

// =========================================================
// RUNTIME PLAYBACK ENGINE WITH CONTINUOUS CHANNELS
// =========================================================
function safeSpeak(text, lang = "de-DE") {
  if (typeof speechSynthesis === "undefined") return null;
  try {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = speechRate || 0.8;

    if (systemVoices.length > 0) {
      let chosenVoice = systemVoices.find(v => v.lang.startsWith(lang) && v.localService === true) || systemVoices.find(v => v.lang.startsWith(lang));
      if (chosenVoice) utter.voice = chosenVoice;
    }
    speechSynthesis.speak(utter);
    return utter;
  } catch(err) { console.log(err); return null; }
}

function stopAudio(){
  isPlayingAll = false;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  document.querySelectorAll("tr").forEach(r => r.classList.remove("playing"));
}

// ============================================================================
// PRACTICE MATRIX CORE
// ============================================================================
function selectTestTheme(theme){
  currentThemes = [theme];
  currentWords = wordbankData.filter(w => getItemTheme(w) === theme);
  applyFilters();
  
  document.getElementById("test-theme-title").innerText = formatTheme(theme);
  document.getElementById("test-selection-area").style.display = "none";
  document.getElementById("test-options-container").style.display = "block";

  const qSelect = document.getElementById("test-question-col");
  const aSelect = document.getElementById("test-answer-col");
  const fields = getDynamicColumns();

  qSelect.innerHTML = "";
  aSelect.innerHTML = "";

  fields.forEach((f, idx) => {
    qSelect.innerHTML += `<option value="${f}" ${idx === 0 ? "selected" : ""}>${f}</option>`;
    aSelect.innerHTML += `<option value="${f}" ${idx === 1 ? "selected" : (idx === 0 ? "selected" : "")}>${f}</option>`;
  });

  const articleBtn = document.getElementById("article-test-btn");
  if (fields.includes("Article")) {
    articleBtn.style.display = "inline-block";
  } else {
    articleBtn.style.display = "none";
  }
}

function enterTestMode(){
  document.getElementById("test-type-buttons").style.display = "none";
  document.querySelector(".config-panel").style.display = "none";
}

function exitTestMode(){
  document.getElementById("test-type-buttons").style.display = "flex";
  document.querySelector(".config-panel").style.display = "block";
  const tc = document.getElementById("test-content");
  if(tc) tc.innerHTML = "";
}

function lockAnswers(){
  if(answerLocked) return true;
  answerLocked = true;
  setTimeout(() => { answerLocked = false; }, 1300);
  return false;
}

function startMeaningsTest(){
  currentTest = "meanings"; score = 0; currentQuestion = 0;
  buildTestWords(); enterTestMode(); renderMeanings();
}

function checkMeaning(btn, selected, correct, wordKey){
  if (lockAnswers()) return;
  const buttons = document.querySelectorAll(".option-btn");
  buttons.forEach(b => b.disabled = true);

  if(selected === correct){
    btn.classList.add("correct"); score++; autoUpdateStar(wordKey, true);
  } else {
    btn.classList.add("incorrect"); autoUpdateStar(wordKey, false);
    buttons.forEach(b => { if(b.innerText === correct) b.classList.add("correct"); });
  }
  setTimeout(() => { currentQuestion++; renderMeanings(); }, 1400);
}

function startDictationTest(){
  currentTest = "dictation"; score = 0; currentQuestion = 0;
  buildTestWords(); enterTestMode(); renderDictation();
}

function insertUmlaut(char){
  const input = document.getElementById("dictation-input");
  if(!input) return;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.value = input.value.substring(0, start) + char + input.value.substring(end);
  input.focus();
}

function normalizeGerman(text){
  return text.toLowerCase().replace(/ae/g,"ä").replace(/oe/g,"ö").replace(/ue/g,"ü").replace(/ss/g,"ß").trim();
}

function startArticleTest(){
  currentTest = "article"; score = 0; currentQuestion = 0;
  currentTestWords = filteredWords.filter(w => w.Article && ["der","die","das"].includes(w.Article.toLowerCase().trim()));
  if(currentTestWords.length === 0){
    alert("No explicit Article gender keys found in this theme slice!");
    return;
  }
  enterTestMode(); renderArticle();
}

function renderArticle() {
  if(currentQuestion >= currentTestWords.length) { finishTest(); return; }
  const q = currentTestWords[currentQuestion];
  const fields = getDynamicColumns();
  const displayField = fields.find(f => f.toLowerCase().includes("german") || f.toLowerCase().includes("word") || f.toLowerCase().includes("infinitiv")) || fields[0];
  const options = shuffle(["der","die","das"]);

  document.getElementById("test-content").innerHTML = `
    <div class="question-box">
      <h2>Grammatical Article Gender Test</h2>
      <div class="word-display">${q[displayField]}</div>
      <div class="options-grid">
        ${options.map(o => `
          <button class="option-btn" onclick="checkArticle(this,'${o}','${q.Article}','${getPrimaryKey(q).replace(/'/g, "\\'")}')">${o}</button>
        `).join("")}
      </div>
      <div class="score-box">Score: ${score}/${currentQuestion}</div>
      <div class="test-controls" style="margin-top:15px;"><button onclick="exitTestMode()" class="stop-btn">🏠 Stop Test</button></div>
    </div>
  `;
}

document.addEventListener("click", (e) => {
  const item = e.target.closest(".match-item");
  if (!item) return;
  if (item.innerText) {
    safeSpeak(item.innerText, item.dataset.lang || "de-DE");
  }
});

function checkArticle(btn, selected, correct, wordKey){
  if (lockAnswers()) return;
  const buttons = document.querySelectorAll(".option-btn");
  buttons.forEach(b => b.disabled = true);

  if(selected.trim().toLowerCase() === correct.trim().toLowerCase()){
    btn.classList.add("correct"); score++; autoUpdateStar(wordKey, true);
  } else {
    btn.classList.add("incorrect"); autoUpdateStar(wordKey, false);
  }
  setTimeout(() => { currentQuestion++; renderArticle(); }, 1200);
}

function startMatchingTest(){
  currentTest = "matching"; score = 0; matchedPairs = 0;
  buildTestWords(); enterTestMode(); renderMatching();
}

function selectGerman(el){
  document.querySelectorAll(".german-item").forEach(i => i.classList.remove("match-selected"));
  el.classList.add("match-selected");
  selectedGerman = el;
}

function selectEnglish(el){
  if(!selectedGerman) return;
  selectedEnglish = el;

  if(selectedGerman.dataset.id === selectedEnglish.dataset.id){
    selectedGerman.classList.add("match-correct");
    selectedEnglish.classList.add("match-correct");
    score++; matchedPairs++;
    autoUpdateStar(selectedGerman.dataset.id, true);
  } else {
    selectedGerman.classList.add("match-wrong");
    selectedEnglish.classList.add("match-wrong");
    autoUpdateStar(selectedGerman.dataset.id, false);
  }

  setTimeout(() => {
    selectedGerman = null; selectedEnglish = null;
    if (matchedPairs >= currentTestWords.length) finishTest();
    else renderMatching();
  }, 1000);
}

function finishTest(){
  document.getElementById("test-content").innerHTML = `
    <div class="question-box">
      <h2>🎉 Session Completed!</h2>
      <div class="word-display">${score}/${currentTestWords.length}</div>
      <button class="primary-btn" onclick="exitTestMode()">Return Home</button>
    </div>
  `;
}

function openSettingsModal(){ document.getElementById("settings-modal").style.display = "block"; }
function saveSettings(){
  speechRate = parseFloat(document.getElementById("speech-rate").value);
  localStorage.setItem("germanSpeechRate", speechRate);
  closeAllModals();
}

function backToThemes(){
  document.getElementById("word-table-container").style.display = "none";
  document.getElementById("theme-selection-area").style.display = "block";
}

function buildTestWords(){
  currentTestWords = shuffle([...filteredWords]);
  if(currentBatchSize > 0) currentTestWords = currentTestWords.slice(0, currentBatchSize);
}

function shuffle(arr){ return [...arr].sort(() => Math.random() - 0.5); }

let activeRepeatMode = "sequence";
let rowRepeatCountTarget = 1;       
let rowRepeatCounterCurrent = 0;
let playbackOrderQueue = [];

function updateAudioLoopSettings() {
  activeRepeatMode = document.getElementById("loop-mode-select").value;
  rowRepeatCountTarget = parseInt(document.getElementById("row-repeat-input").value) || 1;
  
  const wrapper = document.getElementById("row-count-wrapper");
  if (wrapper) {
    wrapper.style.display = (activeRepeatMode === "repeat-row") ? "flex" : "none";
  }
  if (isPlayingAll) {
    generatePlaybackQueue(playbackOrderQueue[currentQuestion] || 0);
  }
}

function generatePlaybackQueue(activeRowIndex) {
  let indices = filteredWords.map((_, idx) => idx);
  if (activeRepeatMode === "alphabetical") {
    const primaryField = getDynamicColumns()[0];
    indices.sort((a, b) => {
      let valA = String(filteredWords[a][primaryField] || "").toLowerCase();
      let valB = String(filteredWords[b][primaryField] || "").toLowerCase();
      return valA.localeCompare(valB);
    });
  } else if (activeRepeatMode === "shuffle") {
    indices.sort(() => Math.random() - 0.5);
  }
  playbackOrderQueue = indices;
  const currentPos = playbackOrderQueue.indexOf(activeRowIndex);
  return currentPos !== -1 ? currentPos : 0;
}

playAllAudio = function(startIndex = 0) {
  if (filteredWords.length === 0) return;
  isPlayingAll = true;
  rowRepeatCounterCurrent = 0;

  let queuePosition = generatePlaybackQueue(startIndex);

  function executeQueueLoop(pos) {
    if (!isPlayingAll || pos >= playbackOrderQueue.length) { stopAudio(); return; }

    const actualWordIndex = playbackOrderQueue[pos];
    
    document.querySelectorAll("#word-table-body tr").forEach(r => r.classList.remove("playing"));
    const row = document.querySelector(`tr[data-index="${actualWordIndex}"]`);
    if (row) {
      row.classList.add("playing");
      row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    const currentItem = filteredWords[actualWordIndex];
    const fields = getDynamicColumns();
    
    let itemsToSpeak = [];
    fields.forEach(f => {
      if (f === "Article") return;
      let textVal = currentItem[f];
      if (textVal && String(textVal).trim() !== "") {
        itemsToSpeak.push({ text: String(textVal), lang: autoDetectLanguage(f) });
      }
    });

    function speakChainIndex(chainIdx) {
      if (!isPlayingAll) return;
      if (chainIdx >= itemsToSpeak.length) {
        if (activeRepeatMode === "repeat-row" && rowRepeatCounterCurrent < rowRepeatCountTarget - 1) {
          rowRepeatCounterCurrent++;
          speakChainIndex(0); 
        } else {
          rowRepeatCounterCurrent = 0; 
          executeQueueLoop((pos + 1) % playbackOrderQueue.length); 
        }
        return;
      }

      const segment = itemsToSpeak[chainIdx];
      let utter = safeSpeak(segment.text, segment.lang);
      if (utter) {
        utter.onend = () => speakChainIndex(chainIdx + 1);
        utter.onerror = () => speakChainIndex(chainIdx + 1);
      } else {
        speakChainIndex(chainIdx + 1);
      }
    }
    speakChainIndex(0);
  }

  executeQueueLoop(queuePosition);
};

renderMeanings = function() {
  if(currentQuestion >= currentTestWords.length) { finishTest(); return; }
  const q = currentTestWords[currentQuestion];
  
  const qField = document.getElementById("test-question-col").value;
  const aField = document.getElementById("test-answer-col").value;

  const correct = String(q[aField] || "---");
  let options = shuffle(wordbankData.filter(w => String(w[aField]) !== correct && w[aField]).map(w => String(w[aField])));
  options = [...new Set(options)].slice(0, 3); 
  options.push(correct);
  options = shuffle(options);

  document.getElementById("test-content").innerHTML = `
    <div class="question-box">
      <h2>Evaluation Quiz: ${qField} ➡️ ${aField}</h2>
      <div class="word-display" style="font-size: 28px; color: #1d3557; background: #f8fafc; padding: 15px; border-radius: 8px;">
        ${q[qField] || "---"}
      </div>
      <div class="options-grid">
        ${options.map(o => `
          <button class="option-btn" onclick="checkMeaning(this,'${o.replace(/'/g, "\\'")}','${correct.replace(/'/g, "\\'")}','${getPrimaryKey(q).replace(/'/g, "\\'")}')">${o}</button>
        `).join("")}
      </div>
      <div class="score-box" style="margin-top:15px; font-weight:bold;">Progress Score: ${score}/${currentQuestion}</div>
      <div class="test-controls" style="margin-top:15px;"><button onclick="exitTestMode()" class="stop-btn">🏠 Exit Test</button></div>
    </div>
  `;
  safeSpeak(String(q[qField]), autoDetectLanguage(qField));
};

renderDictation = function() {
  if(currentQuestion >= currentTestWords.length) { finishTest(); return; }
  const q = currentTestWords[currentQuestion];
  const qField = document.getElementById("test-question-col").value;
  const targetSpelling = String(q[qField]);
  const activeLocale = autoDetectLanguage(qField);

  document.getElementById("test-content").innerHTML = `
    <div class="question-box">
      <h2>Variable Target Dictation Test (${qField})</h2>
      <button class="primary-btn" onclick="safeSpeak('${targetSpelling.replace(/'/g, "\\'")}', '${activeLocale}')">🔊 Listen Prompt</button>
      <input type="text" id="dictation-input" autocomplete="off" placeholder="Type what you hear..." inputmode="text">
      <div class="umlaut-buttons">
        <button onclick="insertUmlaut('ä')">ä</button><button onclick="insertUmlaut('ö')">ö</button>
        <button onclick="insertUmlaut('ü')">ü</button><button onclick="insertUmlaut('ß')">ß</button>
      </div>
      <div id="dict-feedback"></div>
      <div class="score-box">Score: ${score}/${currentQuestion}</div>
      <div class="test-controls" style="margin-top:15px;"><button onclick="exitTestMode()" class="stop-btn">🏠 Stop Test</button></div>
    </div>
  `;
  
  const input = document.getElementById("dictation-input");
  if (input) {
    input.focus();
    setTimeout(() => { safeSpeak(targetSpelling, activeLocale); }, 300);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = normalizeGerman(input.value);
        const expected = normalizeGerman(targetSpelling);
        const wordKey = getPrimaryKey(q);

        if (val === expected) {
          score++; autoUpdateStar(wordKey, true);
          document.getElementById("dict-feedback").innerHTML = `<p class="correct">Correct!</p>`;
        } else {
          autoUpdateStar(wordKey, false);
          document.getElementById("dict-feedback").innerHTML = `<p class="incorrect">Incorrect! Was: ${targetSpelling}</p>`;
        }
        setTimeout(() => { currentQuestion++; renderDictation(); }, 1400);
      }
    });
  }
};

renderMatching = function() {
  const qField = document.getElementById("test-question-col").value;
  const aField = document.getElementById("test-answer-col").value;

  const german = [...currentTestWords];
  const english = shuffle([...currentTestWords]);

  document.getElementById("test-content").innerHTML = `
    <div class="question-box">
      <h2>Matching Test Block (${qField} ⬌ ${aField})</h2>
      <div class="matching-container">
        <div class="match-column">
          <h3>${qField}</h3>
          ${german.map(w => `
            <div class="match-item german-item" data-id="${getPrimaryKey(w)}" data-lang="${autoDetectLanguage(qField)}" onclick="selectGerman(this)">
              ${w.Article ? w.Article + " " : ""}${w[qField]}
            </div>
          `).join("")}
        </div>
        <div class="match-column">
          <h3>${aField}</h3>
          ${english.map(w => `
            <div class="match-item english-item" data-id="${getPrimaryKey(w)}" onclick="selectEnglish(this)">
              ${w[aField]}
            </div>
          `).join("")}
        </div>
      </div>
      <div class="score-box">Score: ${score}/${currentTestWords.length}</div>
      <div class="test-controls" style="margin-top:15px;"><button onclick="exitTestMode()" class="stop-btn">🏠 Stop Test</button></div>
    </div>
  `;
};

downloadWordList = function() {
  const table = document.getElementById("pdf-word-table");
  table.innerHTML = "";
  const fields = getDynamicColumns();

  let headHtml = `<tr>`;
  fields.forEach(f => { headHtml += `<th>${f}</th>`; });
  headHtml += `</tr>`;
  table.innerHTML += headHtml;

  filteredWords.forEach(w => {
    let rowHtml = `<tr>`;
    fields.forEach(f => { rowHtml += `<td>${w[f] ? w[f] : "-"}</td>`; });
    rowHtml += `</tr>`;
    table.innerHTML += rowHtml;
  });

  html2pdf().from(document.getElementById("pdf-content")).save("Vocabulary_Matrix.pdf");
};

function toggleStar(wordKey, event) {
  if (event) event.stopPropagation();
  let current = starData[wordKey] || "neutral";
  let next = "neutral";
  if (current === "neutral") next = "hard";
  else if (current === "hard") next = "easy";
  
  starData[wordKey] = next;
  localStorage.setItem("germanStarData", JSON.stringify(starData));
  applyFilters();
}

function autoUpdateStar(wordKey, isCorrect) {
  if (isCorrect) {
    if (starData[wordKey] === "hard") starData[wordKey] = "neutral";
    else starData[wordKey] = "easy";
  } else {
    starData[wordKey] = "hard";
  }
  localStorage.setItem("germanStarData", JSON.stringify(starData));
}

document.addEventListener("DOMContentLoaded", () => {
  const filePicker = document.getElementById("vocab-file-picker");
  if (filePicker) {
    filePicker.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const parsedData = JSON.parse(e.target.result);
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            wordbankData.length = 0;
            parsedData.forEach(item => wordbankData.push(item));
            currentFilter = "all";
            currentBatchSize = 20;
            stopAudio();
            buildThemes();
            fullResetUI();
            updateStats();
            alert(`🎉 Success! Loaded ${wordbankData.length} manual entries.`);
          }
        } catch (err) {
          alert("❌ Error parsing manual file entry structural design.");
        }
      };
      reader.readAsText(file);
    });
  }
});