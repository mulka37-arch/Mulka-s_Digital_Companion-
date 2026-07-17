// =========================================================
// AGNOSTIC DYNAMIC VOCABULARY MATRIX ENGINE (PRODUCTION PRO)
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

let currentSortColumn = null;
let isSortAscending = true;

// Voice recognition state monitors
let voiceRecognition = null;
let isListening = false;
let voiceNextTimeout = null;

let activeRepeatMode = "sequence"; 
let rowRepeatCountTarget = 3;      
let rowRepeatCounterCurrent = 0;   
let playbackOrderQueue = [];       

// Hierarchical State Management Variables for Paged MindMaps
let mindMapActiveGroupWords = [];
let mindMapCurrentPage = 0;
let mindMapSelectedMotherTheme = ""; 
const MOBILE_MAX_NODES_PER_MAP = 8; // Caps density strictly to protect text collisions

let cognitiveAnimationId = null;
let cognitiveAngle = 0;
let activeCognitiveNodeIndex = null;

let starData = JSON.parse(localStorage.getItem("germanStarData")) || {};
const wordbankData = [];

// 🎴 Flashcard Interface Parameters
let currentCardIndex = 0;
let isCardFlipped = false;
let selectedFrontColumns = [];
let selectedBackColumns = [];

function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

// Generates a unique, collision-proof compound key for tracking star status safely[cite: 2]
function getWordUniqueKey(item) {
  if (!item) return "unknown";
  const fields = getDynamicColumns();
  const contentKey = fields.map(f => String(item[f] || "").trim().replace(/'/g, "\\'").replace(/"/g, "")).join("||");
  const theme = getItemTheme(item).replace(/'/g, "\\'").replace(/"/g, "");
  return `${theme}||${contentKey}`;
}

function getStar(wordKey) {
  return starData[wordKey] || "neutral";
}

function toggleStar(wordKey, event) {
  if (event) event.stopPropagation();
  const current = getStar(wordKey);
  if (current === "neutral") starData[wordKey] = "hard";
  else if (current === "hard") starData[wordKey] = "easy";
  else starData[wordKey] = "neutral";
  
  localStorage.setItem("germanStarData", JSON.stringify(starData));
  applyFilters();
  
  if (document.getElementById("card-mode-container").style.display === "block") {
    renderCardContent();
  }
}

function getDynamicColumns() {
  if (!filteredWords || filteredWords.length === 0) {
    if (wordbankData && wordbankData.length > 0) {
      return Object.keys(wordbankData[0]).filter(key => !["theme", "Theme", "star", "originalIndex", "Is_Exception", "is_exception", "Exception_Note", "exception_note", "MindMap", "Sub_Group", "sub_theme", "audio", "Audio"].includes(key));
    }
    return ["German", "Meaning"]; 
  }
  
  const allKeys = new Set();
  filteredWords.forEach(item => {
    Object.keys(item).forEach(key => {
      if (!["theme", "Theme", "star", "originalIndex", "Is_Exception", "is_exception", "Exception_Note", "exception_note", "MindMap", "Sub_Group", "sub_theme", "audio", "Audio"].includes(key)) {
        allKeys.add(key);
      }
    });
  });
  
  return Array.from(allKeys);
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
  if (!item) return "unknown";
  const fields = getDynamicColumns();
  return item.word || item.German || item.Noun || item.infinitiv || item[fields[0]] || "unknown";
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
  
  initVoiceRecognition();
  loadExternalVocabulary("data/vocabulary.json"); 
  setupButtons();
  updateStats();
  
  const genderPref = localStorage.getItem("preferred_voice_gender") || "auto";
  const selectEl = document.getElementById("voice-gender-preference");
  if (selectEl) selectEl.value = genderPref;
};

function initVoices() {
  if (typeof speechSynthesis !== "undefined") {
    systemVoices = speechSynthesis.getVoices();
  }
}

function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    voiceRecognition = new SpeechRecognition();
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = false;
    voiceRecognition.maxAlternatives = 1;
  }
}

function setupButtons(){
  const wbBtn = document.getElementById("wordbank-btn");
  const tbBtn = document.getElementById("testbank-btn");
  const mmBtn = document.getElementById("mindmaps-btn");
  const cWb = document.getElementById("close-wordbank");
  const cTb = document.getElementById("close-testbank");
  const cMm = document.getElementById("close-mindmaps");
  const cSet = document.getElementById("close-settings");
  const sWBtn = document.getElementById("show-words-btn");

  if(wbBtn) wbBtn.onclick = () => openModal("wordbank-modal");
  if(tbBtn) tbBtn.onclick = () => openModal("testbank-modal");
  
  if(mmBtn) mmBtn.onclick = () => {
    openModal("mindmaps-modal");
    buildSubThemeClusterMenus();
  };

  if(cWb) cWb.onclick = closeAllModals;
  if(cTb) cTb.onclick = closeAllModals;
  if(cMm) cMm.onclick = closeAllModals;
  if(cSet) cSet.onclick = closeAllModals;
  if(sWBtn) sWBtn.onclick = loadSelectedThemes;
}

function openModal(id){
  const el = document.getElementById(id);
  if(el) el.style.display = "block";
}

function closeAllModals(){
  fullResetUI();
  if (cognitiveAnimationId) cancelAnimationFrame(cognitiveAnimationId);
  document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
  stopAudio();
}

function fullResetUI(){
  stopAudio();
  stopListening();
  if (voiceNextTimeout) clearTimeout(voiceNextTimeout);
  selectedGerman = null;
  selectedEnglish = null;
  const tc = document.getElementById("test-content");
  if(tc) tc.innerHTML = "";
  
  const ttb = document.getElementById("test-theme-buttons");
  const ttyb = document.getElementById("test-type-buttons");
  const toc = document.getElementById("test-options-container");
  const tsa = document.getElementById("theme-selection-area");
  const wtc = document.getElementById("word-table-container");

  if(ttb) ttb.style.display = "grid";
  if(ttyb) ttyb.style.display = "flex";
  if(toc) toc.style.display = "none";
  if(tsa) tsa.style.display = "block";
  if(wtc) wtc.style.display = "none";
}

// ============================================================================
// TWO-TIER SUB-THEME GALAXY INTERFACE IMPLEMENTATION
// ============================================================================
function buildSubThemeClusterMenus() {
  const container = document.getElementById("map-cluster-buttons");
  const titleHeader = document.querySelector("#map-cluster-selection h3");
  if (!container) return;
  container.innerHTML = "";

  if (titleHeader) titleHeader.innerText = "Select an Eligible Theme Container:";

  const motherThemes = [...new Set(wordbankData
    .filter(word => {
      const sub = (word.MindMap || word.Sub_Group || word.sub_theme || "").trim();
      return sub && sub !== "" && sub !== "-";
    })
    .map(word => getItemTheme(word))
  )].filter(Boolean);

  if (motherThemes.length === 0) {
    container.innerHTML = `<p style="color: #94a3b8; padding: 20px; text-align: center; width:100%;">No vocabulary records have been assigned an active sub-theme column tag ("MindMap") yet!</p>`;
    return;
  }

  motherThemes.forEach(motherTheme => {
    const btn = document.createElement("button");
    btn.style.cssText = "background: #1e293b; color: #f8fafc; border: 1px solid #475569; padding: 14px; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;";
    
    const totalCount = wordbankData.filter(w => getItemTheme(w) === motherTheme).length;
    btn.innerHTML = `
      <span style="font-size: 14px; font-weight: bold; color: #f8fafc;">📁 ${formatTheme(motherTheme)}</span>
      <span style="font-size: 11px; color: #38bdf8;">(${totalCount} Total Matrix Items)</span>
    `;
    btn.onclick = () => openMotherThemeSubMenu(motherTheme);
    container.appendChild(btn);
  });
}

function openMotherThemeSubMenu(motherThemeName) {
  const container = document.getElementById("map-cluster-buttons");
  const titleHeader = document.querySelector("#map-cluster-selection h3");
  if (!container) return;
  
  mindMapSelectedMotherTheme = motherThemeName;
  container.innerHTML = "";

  if (titleHeader) {
    titleHeader.innerHTML = `Course: <span style="color: #38bdf8;">${formatTheme(motherThemeName)}</span> ➡️ Select Lesson Map:`;
  }

  const trackingMap = {};
  wordbankData.forEach(word => {
    if (getItemTheme(word) === motherThemeName) {
      const subTheme = (word.MindMap || word.Sub_Group || word.sub_theme || "").trim();
      if (subTheme && subTheme !== "" && subTheme !== "-") {
        trackingMap[subTheme] = (trackingMap[subTheme] || 0) + 1;
      }
    }
  });

  const availableSubThemes = Object.keys(trackingMap);

  const backBtn = document.createElement("button");
  backBtn.style.cssText = "background: #475569; color: #ffffff; padding: 14px; border-radius: 10px; font-weight: bold; grid-column: 1 / -1;";
  backBtn.innerText = "⬅️ Back to Main Course Themes";
  backBtn.onclick = () => buildSubThemeClusterMenus();
  container.appendChild(backBtn);

  availableSubThemes.forEach(subTheme => {
    const btn = document.createElement("button");
    btn.style.cssText = "background: #0f172a; color: #f8fafc; border: 1px solid #3b82f6; padding: 14px; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;";
    btn.innerHTML = `
      <span style="font-size: 13px; font-weight: bold; color: #34d399;">🌌 ${subTheme}</span>
      <span style="font-size: 11px; color: #94a3b8;">(${trackingMap[subTheme]} Cluster Nodes)</span>
    `;
    btn.onclick = () => initializeMindMapWorkspace(subTheme);
    container.appendChild(btn);
  });
}

function initializeMindMapWorkspace(subThemeName) {
  document.getElementById("map-cluster-selection").style.display = "none";
  document.getElementById("map-galaxy-workspace").style.display = "block";

  mindMapActiveGroupWords = wordbankData.filter(word => {
    const val = (word.MindMap || word.Sub_Group || word.sub_theme || "").trim();
    return val === subThemeName && getItemTheme(word) === mindMapSelectedMotherTheme;
  });

  mindMapCurrentPage = 0; 
  renderPagedCognitiveGalaxy(subThemeName);
}

function renderPagedCognitiveGalaxy(subThemeName) {
  const svg = document.getElementById("cognitive-galaxy-svg");
  if (!svg) return;
  svg.innerHTML = "";
  stopAudio();

  const totalWords = mindMapActiveGroupWords.length;
  const totalPages = Math.ceil(totalWords / MOBILE_MAX_NODES_PER_MAP);

  const strip = document.getElementById("pagination-button-strip");
  if (strip) {
    strip.innerHTML = "";
    for (let p = 0; p < totalPages; p++) {
      const pBtn = document.createElement("button");
      pBtn.innerText = p + 1;
      pBtn.style.cssText = `padding: 4px 10px; font-size: 12px; border-radius: 4px; border: none; font-weight: bold; cursor: pointer;`;
      if (p === mindMapCurrentPage) {
        pBtn.style.background = "#2a9d8f"; pBtn.style.color = "#ffffff";
      } else {
        pBtn.style.background = "#334155"; pBtn.style.color = "#94a3b8";
      }
      pBtn.onclick = () => {
        mindMapCurrentPage = p;
        renderPagedCognitiveGalaxy(subThemeName);
      };
      strip.appendChild(pBtn);
    }
  }

  const startIdx = mindMapCurrentPage * MOBILE_MAX_NODES_PER_MAP;
  const pageWordsSlice = mindMapActiveGroupWords.slice(startIdx, startIdx + MOBILE_MAX_NODES_PER_MAP);

  const w = svg.clientWidth || 360;
  const h = svg.clientHeight || 400;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const cx = w / 2;
  const cy = h / 2;
  const orbitRadius = Math.min(w, h) * 0.34; 

  const linesG = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const nodesG = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.appendChild(linesG);
  svg.appendChild(nodesG);

  pageWordsSlice.forEach((word, index) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    linesG.appendChild(line);

    const nodeG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    nodeG.className.baseVal = "cognitive-node-item";

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const isException = word.Is_Exception === true || word.Is_Exception === "true" || word.is_exception === true;
    
    circle.setAttribute("r", isException ? "24" : "19");
    circle.setAttribute("fill", isException ? "#e11d48" : "#1e40af");
    circle.setAttribute("stroke", "#ffffff");
    circle.setAttribute("stroke-width", "2");
    if (isException) circle.classList.add("exception-pulse");
    nodeG.appendChild(circle);

    const primaryText = getPrimaryKey(word);
    const displayText = word.Article && word.Article !== "-" ? `${word.Article} ${primaryText}` : primaryText;

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("text-anchor", "middle");
    text.textContent = displayText;
    nodeG.appendChild(text);

    nodeG.onclick = () => {
      activeCognitiveNodeIndex = index;
      let speechPhrase = primaryText;
      if (word.Article && word.Article !== "-") speechPhrase = `${word.Article} ${primaryText}`;
      
      const ticker = document.getElementById("exception-display-ticker");
      if (ticker) {
        ticker.innerText = isException ? (word.Exception_Note || word.exception_note || "⚠️ Outlier Detected!") : "";
      }
      safeSpeak(speechPhrase, autoDetectLanguage("German"));
    };

    nodesG.appendChild(nodeG);
  });

  const sunG = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const sunCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  sunCircle.setAttribute("cx", cx); sunCircle.setAttribute("cy", cy);
  sunCircle.setAttribute("r", "38");
  sunCircle.setAttribute("class", "cognitive-center-sun");
  sunG.appendChild(sunCircle);

  const sunText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  sunText.setAttribute("x", cx); sunText.setAttribute("y", cy + 4);
  sunText.setAttribute("text-anchor", "middle");
  sunText.textContent = subThemeName.length > 11 ? subThemeName.substring(0, 9) + ".." : subThemeName;
  sunG.appendChild(sunText);
  svg.appendChild(sunG);

  if (cognitiveAnimationId) cancelAnimationFrame(cognitiveAnimationId);
  
  function stepAnimation() {
    if (document.getElementById("mindmaps-modal").style.display === "none") return;
    cognitiveAngle += 0.0025;

    const nodes = nodesG.children;
    const links = linesG.children;
    const count = nodes.length;

    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI / count) * i + cognitiveAngle;
      const x = cx + orbitRadius * Math.cos(angle);
      const y = cy + orbitRadius * Math.sin(angle);

      if (nodes[i]) {
        const circ = nodes[i].querySelector("circle");
        const txt = nodes[i].querySelector("text");
        if (circ) {
          circ.setAttribute("cx", x); circ.setAttribute("cy", y);
          if (activeCognitiveNodeIndex === i) {
            circ.setAttribute("stroke", "#34d399"); circ.setAttribute("stroke-width", "5");
          } else {
            circ.setAttribute("stroke", "#ffffff"); circ.setAttribute("stroke-width", "2");
          }
        }
        if (txt) { txt.setAttribute("x", x); txt.setAttribute("y", y + 4); }
      }
      if (links[i]) {
        links[i].setAttribute("x1", cx); links[i].setAttribute("y1", cy);
        links[i].setAttribute("x2", x); links[i].setAttribute("y2", y);
      }
    }
    cognitiveAnimationId = requestAnimationFrame(stepAnimation);
  }
  stepAnimation();
}

function playSystemicCognitiveAudio() {
  const startIdx = mindMapCurrentPage * MOBILE_MAX_NODES_PER_MAP;
  const pageWordsSlice = mindMapActiveGroupWords.slice(startIdx, startIdx + MOBILE_MAX_NODES_PER_MAP);
  
  if (pageWordsSlice.length === 0) return;
  isPlayingAll = true;
  let currentStep = 0;

  function runAudioSequenceChain() {
    if (!isPlayingAll || currentStep >= pageWordsSlice.length) {
      activeCognitiveNodeIndex = null; isPlayingAll = false; return;
    }

    activeCognitiveNodeIndex = currentStep;
    const word = pageWordsSlice[currentStep];
    const primaryKey = getPrimaryKey(word);
    let talkStr = word.Article && word.Article !== "-" ? `${word.Article} ${primaryKey}` : primaryKey;

    const isException = word.Is_Exception === true || word.Is_Exception === "true" || word.is_exception === true;
    const ticker = document.getElementById("exception-display-ticker");
    if (ticker) {
      ticker.innerText = isException ? (word.Exception_Note || word.exception_note || "⚠️ Rule Exception!") : "";
    }

    let utter = safeSpeak(talkStr, autoDetectLanguage("German"));
    if (utter) {
      utter.onend = () => { setTimeout(() => { currentStep++; runAudioSequenceChain(); }, 1100); };
      utter.onerror = () => { currentStep++; runAudioSequenceChain(); };
    } else { currentStep++; runAudioSequenceChain(); }
  }
  runAudioSequenceChain();
}

function exitMindMapWorkspace() {
  stopAudio();
  if (cognitiveAnimationId) cancelAnimationFrame(cognitiveAnimationId);
  document.getElementById("map-galaxy-workspace").style.display = "none";
  document.getElementById("map-cluster-selection").style.display = "block";
  
  if (mindMapSelectedMotherTheme) openMotherThemeSubMenu(mindMapSelectedMotherTheme);
  else buildSubThemeClusterMenus();
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
      console.log(`🚀 Success! Loaded ${wordbankData.length} records dynamically.`);
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

  if(themeButtons) themeButtons.innerHTML = "";
  if(testThemeButtons) testThemeButtons.innerHTML = "";

  themes.forEach(theme => {
    const safeTheme = theme.replace(/'/g, "\\'");
    if(themeButtons) {
      themeButtons.innerHTML += `
        <label class="theme-checkbox">
          <input type="checkbox" value="${theme}" class="theme-input">
          ${formatTheme(theme)}
        </label>
      `;
    }
    if(testThemeButtons) {
      testThemeButtons.innerHTML += `
        <button onclick="selectTestTheme('${safeTheme}')">${formatTheme(theme)}</button>
      `;
    }
  });
}

function formatTheme(theme){ return theme.replace(/_/g," ").replace(/\b\w/g,c => c.toUpperCase()); }

function loadSelectedThemes(){
  const selected = [...document.querySelectorAll(".theme-input:checked")].map(i => i.value);
  if(selected.length === 0){ alert("Select at least one theme"); return; }
  currentThemes = selected;
  currentWords = wordbankData.filter(w => currentThemes.includes(getItemTheme(w)));
  applyFilters();

  document.getElementById("theme-selection-area").style.display = "none";
  document.getElementById("word-table-container").style.display = "block";
  document.getElementById("theme-title").innerText = currentThemes.map(formatTheme).join(", ");
}

function setFilter(type){ currentFilter = type; applyFilters(); }
function setBatchSize(size){ currentBatchSize = size; applyFilters(); }

function applyFilters() {
  filteredWords = [...currentWords];

  if(currentFilter === "easy"){
    filteredWords = filteredWords.filter(w => getStar(getWordUniqueKey(w)) === "easy");
  } else if(currentFilter === "hard"){
    filteredWords = filteredWords.filter(w => getStar(getWordUniqueKey(w)) === "hard");
  } else if(currentFilter === "neutral"){
    filteredWords = filteredWords.filter(w => getStar(getWordUniqueKey(w)) === "neutral");
  }

  if(currentBatchSize > 0){ filteredWords = filteredWords.slice(0, currentBatchSize); }
  renderTable();
  updateStats();
  
  if (document.getElementById("card-mode-container").style.display === "block") {
    currentCardIndex = 0;
    renderCardContent();
  }
}

// =========================================================
// REAL-TIME DYNAMIC TABLE COMPILER WITH SELECTION CONTROLS
// =========================================================
function renderTable(){
  const table = document.getElementById("word-table");
  if (!table) return;
  table.innerHTML = "";

  const fields = getDynamicColumns();
  const thead = document.createElement("thead");
  let headerHtml = `<tr><th>⭐</th>`;
  fields.forEach(f => {
    let arrow = "↕"; 
    if (currentSortColumn === f) { arrow = isSortAscending ? "🔼" : "🔽"; }
    headerHtml += `
      <th style="cursor:pointer;">
        <div style="display:flex; align-items:center; gap:5px; justify-content:center;">
          <input type="checkbox" class="play-column-selector" data-column="${f}" checked onclick="event.stopPropagation();">
          <span onclick="sortMatrixByColumn('${f.replace(/'/g, "\\'")}')">${f} <span class="sort-icon">${arrow}</span></span>
        </div>
      </th>`;
  });
  headerHtml += `</tr>`;
  thead.innerHTML = headerHtml;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  tbody.id = "word-table-body";

  filteredWords.forEach((word, index) => {
    const wordKey = getWordUniqueKey(word);
    let starClass = "star-neutral"; let starIcon = "⚪";

    if(getStar(wordKey) === "easy") { starClass = "star-easy"; starIcon = "🟢"; }
    if(getStar(wordKey) === "hard") { starClass = "star-hard"; starIcon = "🔴"; }

    const row = document.createElement("tr");
    row.className = "clickable-row";
    row.setAttribute("data-index", index);

    if (isPlayingAll && typeof playbackOrderQueue !== "undefined") {
      if (index === playbackOrderQueue[currentQuestion]) row.classList.add("playing");
    }

    const safeWordKey = typeof wordKey === 'string' ? wordKey.replace(/'/g, "\\'") : String(wordKey);
    let rowHtml = `<td><span class="star-btn ${starClass}" onclick="toggleStar('${safeWordKey}', event)">${starIcon}</span></td>`;

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
          <input type="number" id="row-repeat-input" onchange="updateAudioLoopSettings()" value="3" min="1" max="10" style="width:50px; padding:4px; border-radius:4px; border:1px solid #cbd5e1; text-align:center;">
        </div>
      `;
      controlsBar.parentNode.insertBefore(advancedLoopDiv, controlsBar.nextSibling);
    }
  }
}

function sortMatrixByColumn(columnName) {
  if (filteredWords.length === 0) return;
  if (currentSortColumn === columnName) { isSortAscending = !isSortAscending; } 
  else { currentSortColumn = columnName; isSortAscending = true; }

  let activePlayingWordKey = null;
  if (isPlayingAll && typeof playbackOrderQueue !== "undefined" && playbackOrderQueue.length > 0) {
    if (filteredWords[playbackOrderQueue[currentQuestion]]) {
      activePlayingWordKey = getPrimaryKey(filteredWords[playbackOrderQueue[currentQuestion]]);
    }
  }

  filteredWords.sort((a, b) => {
    let valA = String(a[columnName] || "").trim(); let valB = String(b[columnName] || "").trim();
    if (valA === "-") valA = ""; if (valB === "-") valB = "";
    return isSortAscending ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
  });

  if (isPlayingAll && activePlayingWordKey && typeof generatePlaybackQueue === "function") {
    const newRowIndex = filteredWords.findIndex(w => getPrimaryKey(w) === activePlayingWordKey);
    if (newRowIndex !== -1) currentQuestion = generatePlaybackQueue(newRowIndex);
  }
  renderTable(); 
}

function updateStats(){
  const total = currentWords.length;
  const easy = currentWords.filter(w => getStar(getWordUniqueKey(w)) === "easy").length;
  const hard = currentWords.filter(w => getStar(getWordUniqueKey(w)) === "hard").length;
  const neutral = currentWords.filter(w => getStar(getWordUniqueKey(w)) === "neutral").length;

  const html = `<span>📚 Total: ${total}</span><span>🔴 Hard: ${hard}</span><span>🟢 Easy: ${easy}</span><span>⚪ Neutral: ${neutral}</span>`;
  const statsBox = document.getElementById("stats-box"); if(statsBox) statsBox.innerHTML = html;
  const testBox = document.getElementById("test-stats-box"); if(testBox) testBox.innerHTML = html;
}

function updateAudioLoopSettings() {
  const modeSelect = document.getElementById("loop-mode-select");
  const countWrapper = document.getElementById("row-count-wrapper");
  const repeatInput = document.getElementById("row-repeat-input");

  if (modeSelect) activeRepeatMode = modeSelect.value;
  if (countWrapper && modeSelect) countWrapper.style.display = modeSelect.value === "repeat-row" ? "flex" : "none";
  if (repeatInput) rowRepeatCountTarget = parseInt(repeatInput.value, 10) || 3;
}

// =========================================================
// RUNTIME PLAYBACK ENGINE WITH DYNAMIC AUDIO FILE SUPPORT
// =========================================================
function safeSpeak(text, lang = "de-DE", customAudioFile = null) {
  if (customAudioFile && customAudioFile !== "-" && customAudioFile.trim() !== "") {
    try {
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      const audio = new Audio(customAudioFile);
      audio.play();
      return {
        onend: null,
        set onerror(cb) { audio.onerror = cb; },
        set onend(cb) { audio.onended = cb; }
      };
    } catch (e) {
      console.warn("MP3 Audio resource playback failed. Falling back to synthetic Speech Synthesis API:", e);
    }
  }

  if (typeof speechSynthesis === "undefined") return null;
  try {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang; utter.rate = speechRate || 0.8;

    const voicePreference = localStorage.getItem("preferred_voice_gender") || "auto";

    if (systemVoices.length > 0) {
      let matchingVoices = systemVoices.filter(v => v.lang.startsWith(lang));
      let chosenVoice = null;

      if (voicePreference === "male") {
        chosenVoice = matchingVoices.find(v => v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("microsoft stefan") || v.name.toLowerCase().includes("google deutsch male"));
      } else if (voicePreference === "female") {
        chosenVoice = matchingVoices.find(v => v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("microsoft heda") || v.name.toLowerCase().includes("google deutsch female"));
      }

      if (!chosenVoice) {
        chosenVoice = matchingVoices.find(v => v.localService === true) || matchingVoices[0];
      }

      if (chosenVoice) utter.voice = chosenVoice;
    }
    speechSynthesis.speak(utter);
    return utter;
  } catch(err) { return null; }
}

function stopAudio(){
  isPlayingAll = false; activeCognitiveNodeIndex = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  document.querySelectorAll("tr").forEach(r => r.classList.remove("playing"));
}

// Ensures speech recognition monitors turn off cleanly when resetting
function stopListening() { isListening = false; if (voiceRecognition) { try { voiceRecognition.stop(); } catch(e) {} } }

function getUmlautKeyboardHTML() {
  return `<div class="umlaut-buttons"><button type="button" onclick="insertUmlaut('ä')">ä</button><button type="button" onclick="insertUmlaut('ö')">ö</button><button type="button" onclick="insertUmlaut('ü')">ü</button><button type="button" onclick="insertUmlaut('ß')">ß</button></div>`;
}

function insertUmlaut(char) {
  const input = document.querySelector("#test-content input[type='text']");
  if (input) {
    const start = input.selectionStart; const end = input.selectionEnd;
    input.value = input.value.substring(0, start) + char + input.value.substring(end);
    input.focus(); input.setSelectionRange(start + 1, start + 1);
  }
}

// ============================================================================
// PRACTICE MATRIX ENGINE
// ============================================================================
function selectTestTheme(theme){
  currentThemes = [theme]; currentWords = wordbankData.filter(w => getItemTheme(w) === theme); applyFilters(); 
  document.getElementById("test-theme-title").innerText = formatTheme(theme);
  document.getElementById("test-selection-area").style.display = "none";
  document.getElementById("test-options-container").style.display = "block";

  const qSelect = document.getElementById("test-question-col"); const aSelect = document.getElementById("test-answer-col");
  const fields = getDynamicColumns();

  if(qSelect && aSelect) {
    qSelect.innerHTML = ""; aSelect.innerHTML = "";
    fields.forEach((f, idx) => {
      qSelect.innerHTML += `<option value="${f}" ${idx === 0 ? "selected" : ""}>${f}</option>`;
      aSelect.innerHTML += `<option value="${f}" ${idx === 1 ? "selected" : (idx === 0 ? "selected" : "")}>${f}</option>`;
    });
  }

  const articleBtn = document.getElementById("article-test-btn");
  if (articleBtn) {
    const validCandidates = filteredWords.filter(w => w.Article && ["der","die","das"].includes(String(w.Article).toLowerCase().trim()));
    articleBtn.style.display = validCandidates.length > 0 ? "inline-block" : "none";
  }
}

function enterTestMode() {
  const ttb = document.getElementById("test-type-buttons"); const cp = document.querySelector(".config-panel");
  if(ttb) ttb.style.display = "none"; if(cp) cp.style.display = "none";
}

function exitTestMode() {
  stopListening(); if (voiceNextTimeout) clearTimeout(voiceNextTimeout);
  const ttb = document.getElementById("test-type-buttons"); const cp = document.querySelector(".config-panel");
  if(ttb) ttb.style.display = "flex"; if(cp) cp.style.display = "block";
  const tc = document.getElementById("test-content"); if(tc) tc.innerHTML = "";
}

function lockAnswers() {
  if(answerLocked) return true;
  answerLocked = true; setTimeout(() => { answerLocked = false; }, 1300); return false;
}

function buildTestWords() { currentTestWords = shuffle([...filteredWords]); }
function startMeaningsTest(){ currentTest = "meanings"; score = 0; currentQuestion = 0; buildTestWords(); enterTestMode(); renderMeanings(); }

function checkMeaning(btn, selected, correct, wordKey){
  if (lockAnswers()) return; const buttons = document.querySelectorAll(".option-btn"); buttons.forEach(b => b.disabled = true);
  if(selected === correct){ btn.classList.add("correct"); score++; autoUpdateStar(wordKey, true); } 
  else { btn.classList.add("incorrect"); autoUpdateStar(wordKey, false); buttons.forEach(b => { if(b.innerText === correct) b.classList.add("correct"); }); }
  setTimeout(() => { currentQuestion++; renderMeanings(); }, 1400);
}

function startDictationTest(){ currentTest = "dictation"; score = 0; currentQuestion = 0; buildTestWords(); enterTestMode(); renderDictation(); }
function normalizeGerman(text){ return String(text).toLowerCase().replace(/ae/g,"ä").replace(/oe/g,"ö").replace(/ue/g,"ü").replace(/ss/g,"ß").replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"").trim(); }
function startArticleTest(){ currentTest = "article"; score = 0; currentQuestion = 0; currentTestWords = shuffle(filteredWords.filter(w => w.Article && ["der","die","das"].includes(String(w.Article).toLowerCase().trim()))); enterTestMode(); renderArticle(); }

function renderArticle() {
  if(currentQuestion >= currentTestWords.length) { finishTest(); return; }
  const q = currentTestWords[currentQuestion]; const fields = getDynamicColumns();
  const displayField = fields.find(f => f.toLowerCase().includes("noun") || f.toLowerCase().includes("german") || f.toLowerCase().includes("word")) || fields[0];
  const options = shuffle(["der","die","das"]);

  document.getElementById("test-content").innerHTML = `
    <div class="question-box">
      <h2>Grammatical Article Gender Test</h2><div class="word-display">${q[displayField]}</div>
      <div class="options-grid">${options.map(o => `<button class="option-btn" onclick="checkArticle(this,'${o}','${String(q.Article).trim().toLowerCase()}','${getWordUniqueKey(q).replace(/'/g, "\\'")}')">${o}</button>`).join("")}</div>
      <div class="score-box">Score: ${score}/${currentQuestion}</div><div class="test-controls" style="margin-top:15px;"><button onclick="exitTestMode()" class="stop-btn">🏠 Stop Test</button></div>
    </div>`;
}

function checkArticle(btn, selected, correct, wordKey){
  if (lockAnswers()) return; const buttons = document.querySelectorAll(".option-btn"); buttons.forEach(b => b.disabled = true);
  if(selected.trim().toLowerCase() === correct.trim().toLowerCase()){ btn.classList.add("correct"); score++; autoUpdateStar(wordKey, true); } 
  else { btn.classList.add("incorrect"); autoUpdateStar(wordKey, false); buttons.forEach(b => { if(b.innerText.toLowerCase().trim() === correct) b.classList.add("correct"); }); }
  setTimeout(() => { currentQuestion++; renderArticle(); }, 1200);
}

function startMatchingTest(){ currentTest = "matching"; score = 0; matchedPairs = 0; buildTestWords(); enterTestMode(); renderMatching(); }

function selectGerman(el){
  if (el.classList.contains("match-correct")) return; 
  document.querySelectorAll(".german-item").forEach(i => i.classList.remove("match-selected"));
  el.classList.add("match-selected"); selectedGerman = el;
}

function selectEnglish(el){
  if (el.classList.contains("match-correct") || !selectedGerman) return; 
  selectedEnglish = el;
  if(selectedGerman.dataset.id === selectedEnglish.dataset.id){
    selectedGerman.classList.remove("match-selected"); selectedGerman.classList.add("match-correct"); selectedEnglish.classList.add("match-correct");
    score++; matchedPairs++; autoUpdateStar(selectedGerman.dataset.id, true);
  } else {
    selectedGerman.classList.add("match-wrong"); selectedEnglish.classList.add("match-wrong"); autoUpdateStar(selectedGerman.dataset.id, false);
    const sg = selectedGerman; const se = selectedEnglish;
    setTimeout(() => { sg.classList.remove("match-wrong", "match-selected"); se.classList.remove("match-wrong"); }, 900);
  }
  selectedGerman = null; selectedEnglish = null;
  if (matchedPairs >= currentTestWords.length) { setTimeout(finishTest, 1000); }
}

// ============================================================================
// 🎙️ INTERNATIONAL-STANDARD VOICE TEST IMPLEMENTATION
// ============================================================================
function startVoiceTest() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { 
    alert("Web Speech recognition API is not supported in this browser. Please practice pronunciation in Chrome or Edge."); 
    return; 
  }
  currentTest = "voice"; 
  score = 0; 
  currentQuestion = 0; 
  buildTestWords(); 
  enterTestMode(); 
  renderVoiceQuestion();
}

function renderVoiceQuestion() {
  if (voiceNextTimeout) clearTimeout(voiceNextTimeout);
  if (currentQuestion >= currentTestWords.length) { finishTest(); return; }
  stopListening();

  const q = currentTestWords[currentQuestion]; 
  const qField = document.getElementById("test-question-col").value; 
  const aField = document.getElementById("test-answer-col").value;
  
  let targetQuestionText = String(q[qField] || ""); 
  let targetAnswerText = String(q[aField] || "");
  let questionLang = autoDetectLanguage(qField); 
  let answerLang = autoDetectLanguage(aField);
  let subModeTitle = `Translate Column [${qField}] ➡️ [${aField}]`;

  if (q.Article && ["der","die","das"].includes(String(q.Article).toLowerCase().trim()) && aField.toLowerCase().includes("article")) {
    targetAnswerText = String(q.Article).trim().toLowerCase(); 
    answerLang = "de-DE"; 
    subModeTitle = `Speak Only the Matching Article for: [ ${q[qField]} ]`;
  }

  document.getElementById("test-content").innerHTML = `
    <div id="voice-eval-card" class="question-box voice-pulse-active" style="border: 3px solid #3b82f6; background: #fafcff; transition: all 0.3s ease;">
      <h2>🗣️ Pronunciation Validation Test</h2>
      <p style="font-weight:bold; color:#2563eb; margin-bottom:10px;">${subModeTitle}</p>
      
      <div class="word-display" style="font-size:28px; color:#1e293b; background:#fff; padding:20px; border-radius:8px; margin:15px 0; border: 1px solid #e2e8f0;">
        ${targetQuestionText}
      </div>
      
      <!-- Visual Feedback Waveform Container -->
      <div id="voice-indicator-box" style="padding:15px; border-radius:8px; font-weight:bold; background:#3b82f6; color:#fff; transition: background-color 0.3s;">
        🔊 Generating Voice Prompt...
      </div>
      
      <div id="voice-transcript-output" style="font-weight:600; font-size:18px; color:#475569; min-height:30px; margin:15px 0; padding:10px; background:#f1f5f9; border-radius:6px;">
        Captured Answer: <span style="color:#2563eb;">"Waiting..."</span>
      </div>
      
      <div id="voice-feedback-output" style="min-height:24px; margin-top:10px;"></div>
      
      ${getUmlautKeyboardHTML()}
      
      <div class="score-box" style="margin-top:15px;">Progress Session Score: ${score}/${currentQuestion}</div>
      <div class="test-controls" style="margin-top:15px; display:flex; gap:10px; justify-content:center;">
        <button onclick="safeSpeak('${targetQuestionText.replace(/'/g, "\\'")}', '${questionLang}', '${q.audio || q.Audio || ""}')" class="primary-btn" style="background:#3b82f6;">🔊 Replay Prompt</button>
        <button onclick="exitTestMode()" class="stop-btn">🏠 Exit Test</button>
      </div>
    </div>`;

  let utterText = targetQuestionText; 
  if (q.Article && qField.toLowerCase().includes("noun")) { 
    utterText = q.Article + " " + targetQuestionText; 
  }
  
  let utter = safeSpeak(utterText, questionLang, q.audio || q.Audio || null);
  if (utter && utter.onend !== undefined) {
    utter.onend = () => triggerMicrophoneListen(targetAnswerText, answerLang); 
    utter.onerror = () => triggerMicrophoneListen(targetAnswerText, answerLang);
  } else { 
    // Fallback delay if it is a native Audio file or speech generation starts immediately
    setTimeout(() => triggerMicrophoneListen(targetAnswerText, answerLang), 1000); 
  }
}

function triggerMicrophoneListen(expectedAnswer, targetLang) {
  if (currentTest !== "voice") return;
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  voiceRecognition = new SpeechRecognition();
  voiceRecognition.lang = targetLang;
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = false;
  voiceRecognition.maxAlternatives = 1;

  const card = document.getElementById("voice-eval-card");
  const indicator = document.getElementById("voice-indicator-box"); 
  
  if (indicator) { 
    indicator.style.backgroundColor = "#10b981"; 
    indicator.innerHTML = "🎙️ LISTENING NOW... Please Speak Clear Accent"; 
  }
  if (card) {
    card.className = "question-box voice-listening-ring";
  }

  voiceRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript; 
    const outputTranscript = document.getElementById("voice-transcript-output"); 
    
    if (outputTranscript) {
      outputTranscript.innerHTML = `Captured Answer: <span style="color:#10b981; font-weight:bold;">"${transcript}"</span>`;
    }
    
    // Heuristic Normalization Matching Engine
    const normalizeSpeech = (text) => {
      return String(text)
        .toLowerCase()
        .replace(/ae/g,"ä")
        .replace(/oe/g,"ö")
        .replace(/ue/g,"ü")
        .replace(/ss/g,"ß")
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"")
        .trim();
    };

    const normalizedUser = normalizeSpeech(transcript); 
    const normalizedTarget = normalizeSpeech(expectedAnswer);
    const wordKey = getWordUniqueKey(currentTestWords[currentQuestion]); 
    const fbBox = document.getElementById("voice-feedback-output");

    const exactMatch = (normalizedUser === normalizedTarget);
    const containsMatch = (normalizedUser.includes(normalizedTarget) || normalizedTarget.includes(normalizedUser));

    if (exactMatch || containsMatch) {
      score++; 
      autoUpdateStar(wordKey, true); 
      if (card) card.className = "question-box voice-listening-ring";
      if (fbBox) fbBox.innerHTML = `<p class="correct" style="color:white; padding:8px; border-radius:6px; font-weight:bold;">✓ Correct Pronunciation Detected!</p>`;
      if (indicator) {
        indicator.style.backgroundColor = "#10b981";
        indicator.innerHTML = "✓ Match Validated!";
      }
    } else {
      autoUpdateStar(wordKey, false); 
      if (card) card.className = "question-box voice-error-ring";
      if (fbBox) fbBox.innerHTML = `<p class="incorrect" style="color:white; padding:8px; border-radius:6px; font-weight:bold;">❌ Pronunciation Discrepancy! Expected: "${expectedAnswer}"</p>`;
      if (indicator) {
        indicator.style.backgroundColor = "#ef4444";
        indicator.innerHTML = "❌ Discrepancy Found";
      }
    }
    voiceNextTimeout = setTimeout(() => { currentQuestion++; renderVoiceQuestion(); }, 1800); 
  };

  voiceRecognition.onerror = (err) => { 
    console.warn("ASR Error capture:", err);
    if (indicator) {
      indicator.style.backgroundColor = "#ef4444";
      indicator.innerHTML = "⚠️ Listening Timed Out / Microphone Error";
    }
    if (card) card.className = "question-box voice-error-ring";
    voiceNextTimeout = setTimeout(() => { currentQuestion++; renderVoiceQuestion(); }, 2000); 
  };
  
  try { 
    voiceRecognition.start(); 
    isListening = true; 
  } catch(e) {
    console.error("Failed to start SpeechRecognition:", e);
  }
}

function finishTest(){
  stopListening(); if (voiceNextTimeout) clearTimeout(voiceNextTimeout);
  document.getElementById("test-content").innerHTML = `<div class="question-box"><h2>🎉 Session Completed!</h2><div class="word-display">${score}/${currentTestWords.length}</div><button class="primary-btn" onclick="exitTestMode()">Return Home</button></div>`;
}

function openSettingsModal(){ document.getElementById("settings-modal").style.display = "block"; }

function saveSettings() {
  speechRate = parseFloat(document.getElementById("speech-rate").value);
  localStorage.setItem("germanSpeechRate", speechRate);
  
  const genderPref = document.getElementById("voice-gender-preference").value;
  localStorage.setItem("preferred_voice_gender", genderPref);
  
  closeAllModals();
}

function backToThemes(){ document.getElementById("word-table-container").style.display = "none"; document.getElementById("theme-selection-area").style.display = "block"; }

const generatePlaybackQueue = function(activeRowIndex) {
  let indices = filteredWords.map((_, idx) => idx);
  if (activeRepeatMode === "alphabetical") {
    const primaryField = getDynamicColumns()[0];
    indices.sort((a, b) => String(filteredWords[a][primaryField] || "").toLowerCase().localeCompare(String(filteredWords[b][primaryField] || "").toLowerCase()));
  } else if (activeRepeatMode === "shuffle") { indices.sort(() => Math.random() - 0.5); }
  playbackOrderQueue = indices; return playbackOrderQueue.indexOf(activeRowIndex) !== -1 ? playbackOrderQueue.indexOf(activeRowIndex) : 0;
};

const playAllAudio = function(startIndex = 0) {
  if (filteredWords.length === 0) return;
  isPlayingAll = true; rowRepeatCounterCurrent = 0;
  let queuePosition = generatePlaybackQueue(startIndex);

  function executeQueueLoop(pos) {
    if (!isPlayingAll || pos >= playbackOrderQueue.length) { stopAudio(); return; }
    const actualWordIndex = playbackOrderQueue[pos];
    currentQuestion = pos; 
    
    document.querySelectorAll("#word-table-body tr").forEach(r => r.classList.remove("playing"));
   const row = document.querySelector(`tr[data-index="${actualWordIndex}"]`);
    if (row) { 
      row.classList.add("playing"); 
      
      // 🎯 Bulletproof Screen-Coordinate Center Alignment Engine
      const tableWrapper = document.querySelector(".table-wrapper");
      if (tableWrapper) {
        // Get physical bounding layout positions on the screen
        const wrapperRect = tableWrapper.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        
        // Calculate the row's exact relative offset inside the wrapper independent of offsetParent bugs
        const exactRowTopInsideWrapper = tableWrapper.scrollTop + (rowRect.top - wrapperRect.top);
        
        // Target scroll destination (centers the row vertically within the container)
        tableWrapper.scrollTo({
          top: exactRowTopInsideWrapper - (wrapperRect.height / 2) + (rowRect.height / 2),
          behavior: "smooth"
        });
      }
    }

    const currentItem = filteredWords[actualWordIndex]; const fields = getDynamicColumns();
    let itemsToSpeak = [];
    fields.forEach(f => {
      const colSelector = document.querySelector(`.play-column-selector[data-column="${f}"]`);
      if (colSelector ? colSelector.checked : true) {
        let textVal = currentItem[f];
        if (textVal && String(textVal).trim() !== "") {
          if (f.toLowerCase().includes("noun") && currentItem.Article && ["der","die","das"].includes(String(currentItem.Article).toLowerCase().trim())) { textVal = currentItem.Article + " " + textVal; }
          itemsToSpeak.push({ 
            text: String(textVal), 
            lang: autoDetectLanguage(f),
            audio: currentItem.audio || currentItem.Audio || null 
          });
        }
      }
    });

    function speakChainIndex(chainIdx) {
      if (!isPlayingAll) return;
      if (chainIdx >= itemsToSpeak.length) {
        if (activeRepeatMode === "repeat-row" && rowRepeatCounterCurrent < rowRepeatCountTarget - 1) { rowRepeatCounterCurrent++; speakChainIndex(0); }
        else { rowRepeatCounterCurrent = 0; executeQueueLoop((pos + 1) % playbackOrderQueue.length); }
        return;
      }
      const segment = itemsToSpeak[chainIdx]; 
      let utter = safeSpeak(segment.text, segment.lang, segment.audio);
      if (utter) { utter.onend = () => speakChainIndex(chainIdx + 1); utter.onerror = () => speakChainIndex(chainIdx + 1); }
      else { speakChainIndex(chainIdx + 1); }
    }
    speakChainIndex(0);
  }
  executeQueueLoop(queuePosition);
};

const renderMeanings = function() {
  if(currentQuestion >= currentTestWords.length) { finishTest(); return; }
  const q = currentTestWords[currentQuestion]; const qField = document.getElementById("test-question-col").value; const aField = document.getElementById("test-answer-col").value;
  const correct = String(q[aField] || "---");
  let options = shuffle(wordbankData.filter(w => String(w[aField]) !== correct && w[aField]).map(w => String(w[aField])));
  options = [...new Set(options)].slice(0, 3); options.push(correct); options = shuffle(options);

  document.getElementById("test-content").innerHTML = `
    <div class="question-box">
      <h2>Evaluation Quiz: ${qField} ➡️ ${aField}</h2>
      <div class="word-display" style="font-size:28px; color:#1d3557; background:#f8fafc; padding:15px; border-radius:8px;">${q[qField] || "---"}</div>
      <div class="options-grid">${options.map(o => `<button class="option-btn" onclick="checkMeaning(this,'${o.replace(/'/g, "\\'")}','${correct.replace(/'/g, "\\'")}','${getWordUniqueKey(q).replace(/'/g, "\\'")}')">${o}</button>`).join("")}</div>
      <div class="score-box">Progress Score: ${score}/${currentQuestion}</div><div class="test-controls" style="margin-top:15px;"><button onclick="exitTestMode()" class="stop-btn">🏠 Exit Test</button></div>
    </div>`;
  safeSpeak(String(q[qField]), autoDetectLanguage(qField));
};

const renderDictation = function() {
  if(currentQuestion >= currentTestWords.length) { finishTest(); return; }
  const q = currentTestWords[currentQuestion]; const qField = document.getElementById("test-question-col").value; const targetSpelling = String(q[qField]); const activeLocale = autoDetectLanguage(qField);

  document.getElementById("test-content").innerHTML = `
    <div class="question-box">
      <h2>Variable Target Dictation Test (${qField})</h2><button class="primary-btn" onclick="safeSpeak('${targetSpelling.replace(/'/g, "\\'")}', '${activeLocale}')">🔊 Listen Prompt</button>
      <input type="text" id="dictation-input" autocomplete="off" placeholder="Type what you hear...">
      ${getUmlautKeyboardHTML()}<div id="dict-feedback"></div><div class="score-box">Score: ${score}/${currentQuestion}</div>
      <div class="test-controls" style="margin-top:15px;"><button onclick="exitTestMode()" class="stop-btn">🏠 Stop Test</button></div>
    </div>`;
  const input = document.getElementById("dictation-input");
  if (input) {
    input.focus(); setTimeout(() => { safeSpeak(targetSpelling, activeLocale); }, 300);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = normalizeGerman(input.value); const expected = normalizeGerman(targetSpelling); const wordKey = getWordUniqueKey(q);
        if (val === expected) { score++; autoUpdateStar(wordKey, true); document.getElementById("dict-feedback").innerHTML = `<p class="correct">Correct!</p>`; }
        else { autoUpdateStar(wordKey, false); document.getElementById("dict-feedback").innerHTML = `<p class="incorrect">Incorrect! Was: ${targetSpelling}</p>`; }
        setTimeout(() => { currentQuestion++; renderDictation(); }, 1400);
      }
    });
  }
};

const renderMatching = function() {
  const qField = document.getElementById("test-question-col").value; const aField = document.getElementById("test-answer-col").value;
  const german = [...currentTestWords]; const english = shuffle([...currentTestWords]);

  document.getElementById("test-content").innerHTML = `
    <div class="question-box">
      <h2>Matching Test Block (${qField} ⬌ ${aField})</h2>
      <div class="matching-container">
        <div class="match-column"><h3>${qField}</h3>${german.map(w => `<div class="match-item german-item" data-id="${getWordUniqueKey(w)}" onclick="selectGerman(this)">${w.Article ? w.Article + " " : ""}${w[qField] || "-"}</div>`).join("")}</div>
        <div class="match-column"><h3>${aField}</h3>${english.map(w => `<div class="match-item english-item" data-id="${getWordUniqueKey(w)}" onclick="selectEnglish(this)">${w[aField] || "-"}</div>`).join("")}</div>
      </div>
      <div class="score-box">Score: ${score}/${currentTestWords.length}</div><div class="test-controls" style="margin-top:15px;"><button onclick="exitTestMode()" class="stop-btn">🏠 Stop Test</button></div>
    </div>`;
};

const downloadWordList = function() {
  const table = document.getElementById("pdf-word-table"); if(!table) return; table.innerHTML = ""; const fields = getDynamicColumns();
  let headHtml = `<tr>`; fields.forEach(f => { headHtml += `<th>${f}</th>`; }); headHtml += `</tr>`; table.innerHTML += headHtml;
  filteredWords.forEach(w => { let rowHtml = `<tr>`; fields.forEach(f => { rowHtml += `<td>${w[f] ? w[f] : "-"}</td>`; }); rowHtml += `</tr>`; table.innerHTML += rowHtml; });
  html2pdf().from(document.getElementById("pdf-content")).save("Vocabulary_Matrix.pdf");
};

function autoUpdateStar(wordKey, isCorrect) {
  if (isCorrect) { starData[wordKey] = (starData[wordKey] === "hard") ? "neutral" : "easy"; } 
  else { starData[wordKey] = "hard"; }
  localStorage.setItem("germanStarData", JSON.stringify(starData));
}

// =========================================================
// 🔍 DYNAMIC SEARCH & INTEGRATED UMLAUT INSERTION ENGINE
// =========================================================
function insertUmlautToSearch(char) {
  const input = document.getElementById("matrix-search-input");
  if (input) {
    input.value += char;
    input.focus();
    performMatrixSearch();
  }
}

function clearMatrixSearch() {
  const input = document.getElementById("matrix-search-input");
  if (input) {
    input.value = "";
    performMatrixSearch();
  }
}

function performMatrixSearch() {
  const searchVal = document.getElementById("matrix-search-input").value.toLowerCase().trim();
  
  const normalizeText = (text) => {
    return String(text)
      .toLowerCase()
      .replace(/ä/g, "a")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ß/g, "ss");
  };

  const normalizedQuery = normalizeText(searchVal);

  if (normalizedQuery === "") {
    applyFilters();
    return;
  }

  const fields = getDynamicColumns();
  filteredWords = currentWords.filter(word => {
    return fields.some(f => {
      const value = String(word[f] || "").trim();
      return normalizeText(value).includes(normalizedQuery);
    });
  });

  renderTable();
}

// =========================================================
// 🔍 ZOOM MODE (INTERFACE SCALING & WRAPPING TOGGLES)
// =========================================================
function toggleZoom(mode) {
  const wrapper = document.querySelector(".table-wrapper");
  if (!wrapper) return;
  if (mode === 'out') {
    wrapper.classList.add("zoom-out");
  } else {
    wrapper.classList.remove("zoom-out");
  }
}

// =========================================================
// 🎴 CUSTOMISABLE FLASHCARD CORE SYSTEM WITH CHOOSE INTERFACE
// =========================================================
function buildCardColumnSelectionPanel() {
  const panel = document.getElementById("card-column-selectors");
  if (!panel) return;
  panel.innerHTML = "";

  const fields = getDynamicColumns();
  
  // Set default configurations if not defined
  if (selectedFrontColumns.length === 0) {
    selectedFrontColumns = [fields[0]]; // Primary column to front
  }
  if (selectedBackColumns.length === 0) {
    selectedBackColumns = [fields[1] || fields[0]]; // Secondary translation to back
  }

  fields.forEach(f => {
    const colGroup = document.createElement("div");
    colGroup.style.cssText = "display: flex; align-items: center; gap: 4px; background: #fff; padding: 4px 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 11px;";
    
    const isFrontChecked = selectedFrontColumns.includes(f) ? "checked" : "";
    const isBackChecked = selectedBackColumns.includes(f) ? "checked" : "";

    colGroup.innerHTML = `
      <span style="font-weight:bold; color:#1e293b; margin-right: 4px;">${f}:</span>
      <label style="cursor:pointer; display:flex; align-items:center; gap:2px;">
        <input type="checkbox" data-col="${f}" class="front-card-chk" ${isFrontChecked} onchange="updateCardColumnSelection()"> F
      </label>
      <label style="cursor:pointer; display:flex; align-items:center; gap:2px; margin-left:4px;">
        <input type="checkbox" data-col="${f}" class="back-card-chk" ${isBackChecked} onchange="updateCardColumnSelection()"> B
      </label>
    `;
    panel.appendChild(colGroup);
  });
}

function updateCardColumnSelection() {
  selectedFrontColumns = [...document.querySelectorAll(".front-card-chk:checked")].map(el => el.dataset.col);
  selectedBackColumns = [...document.querySelectorAll(".back-card-chk:checked")].map(el => el.dataset.col);
  
  // Prevent zero checking fallback
  if (selectedFrontColumns.length === 0) {
    const firstField = getDynamicColumns()[0];
    selectedFrontColumns = [firstField];
    const chk = document.querySelector(`.front-card-chk[data-col="${firstField}"]`);
    if (chk) chk.checked = true;
  }
  if (selectedBackColumns.length === 0) {
    const fields = getDynamicColumns();
    const secondField = fields[1] || fields[0];
    selectedBackColumns = [secondField];
    const chk = document.querySelector(`.back-card-chk[data-col="${secondField}"]`);
    if (chk) chk.checked = true;
  }
  
  renderCardContent();
}

function toggleCardLayout(view) {
  const tableWrapper = document.querySelector(".table-wrapper");
  const cardWrapper = document.getElementById("card-mode-container");
  
  if (!tableWrapper || !cardWrapper) return;
  
  if (view === "card") {
    tableWrapper.style.display = "none";
    cardWrapper.style.display = "block";
    currentCardIndex = 0;
    isCardFlipped = false;
    
    // Automatically configure selected column settings
    buildCardColumnSelectionPanel();
    renderCardContent();
  } else {
    tableWrapper.style.display = "block";
    cardWrapper.style.display = "none";
  }
}

// =========================================================
// 🎴 COGNITIVE HARMONY FLASHCARD RENDER SYSTEM (JS CORE PATCH)[cite: 2]
// =========================================================
function renderCardContent() {
  const box = document.getElementById("flashcard-box");
  if (!box || filteredWords.length === 0) {
    if (box) box.innerHTML = `<h3>Empty Matrix Vocabulary Deck</h3>`;
    return;
  }
  
  const word = filteredWords[currentCardIndex];
  const wordKey = getWordUniqueKey(word); // Safe star key remains intact[cite: 2]
  const status = getStar(wordKey); // Safe star system remains intact[cite: 2]
  
  // Set badge colors
  let badgeBg = "#64748b";
  if (status === "easy") badgeBg = "#10b981";
  if (status === "hard") badgeBg = "#ef4444";

  let displayDataPoints = [];
  
  if (!isCardFlipped) {
    // 1. FRONT CARD: Deep contrast Slate on Creamy Alabaster[cite: 3]
    box.classList.remove("flipped-reward");
    
    displayDataPoints = selectedFrontColumns.map(col => {
      let val = word[col] || "-";
      if (col.toLowerCase().includes("noun") && word.Article && word.Article !== "-") {
        val = `${word.Article} ${val}`;
      }
      return `
        <div style="margin-top: 6px;">
          <div class="card-datapoint-label">${col}</div>
          <div class="card-datapoint-value-front">${val}</div>
        </div>`;
    });

    box.innerHTML = `
      <span class="card-status-badge" style="background: ${badgeBg}; color: white;">${status}</span>
      <div class="card-face-title" style="color: #3b82f6;">📖 Front View</div>
      <div style="display:flex; flex-direction:column; gap:10px; width:100%;">${displayDataPoints.join("")}</div>
      <p style="font-size: 11px; color: #94a3b8; margin-top: 24px; font-weight: 500; letter-spacing: 0.2px;">💡 Tap card space to flip & reveal</p>
    `;
  } else {
    // 2. BACK CARD: Satisfying Emerald on Sage Mint[cite: 3]
    box.classList.add("flipped-reward");
    
    displayDataPoints = selectedBackColumns.map(col => {
      let val = word[col] || "-";
      if (col.toLowerCase().includes("noun") && word.Article && word.Article !== "-") {
        val = `${word.Article} ${val}`;
      }
      return `
        <div style="margin-top: 6px;">
          <div class="card-datapoint-label">${col}</div>
          <div class="card-datapoint-value-back">${val}</div>
        </div>`;
    });

    box.innerHTML = `
      <span class="card-status-badge" style="background: ${badgeBg}; color: white;">${status}</span>
      <div class="card-face-title" style="color: #10b981;">✅ Translation Revealed</div>
      <div style="display:flex; flex-direction:column; gap:10px; width:100%;">${displayDataPoints.join("")}</div>
      <p style="font-size: 11px; color: #059669; margin-top: 24px; font-weight: 600; letter-spacing: 0.2px;">🔄 Tap card space to flip back</p>
    `;
  }
  
  box.onclick = flipCard;
}

function flipCard() {
  isCardFlipped = !isCardFlipped;
  renderCardContent();
  playActiveCardFaceAudio();
}

function playActiveCardFaceAudio() {
  if (filteredWords.length === 0) return;
  const word = filteredWords[currentCardIndex];
  
  // Decide which face columns to speak out loud
  const columnsToSpeak = isCardFlipped ? selectedBackColumns : selectedFrontColumns;
  
  columnsToSpeak.forEach(col => {
    let speakStr = word[col];
    if (speakStr && String(speakStr).trim() !== "") {
      if (col.toLowerCase().includes("noun") && word.Article && word.Article !== "-") {
        speakStr = `${word.Article} ${speakStr}`;
      }
      safeSpeak(speakStr, autoDetectLanguage(col), word.audio || word.Audio || null);
    }
  });
}

function nextCard() {
  if (filteredWords.length === 0) return;
  currentCardIndex = (currentCardIndex + 1) % filteredWords.length;
  isCardFlipped = false;
  renderCardContent();
  playActiveCardFaceAudio();
}

function prevCard() {
  if (filteredWords.length === 0) return;
  currentCardIndex = (currentCardIndex - 1 + filteredWords.length) % filteredWords.length;
  isCardFlipped = false;
  renderCardContent();
  playActiveCardFaceAudio();
}

document.addEventListener("DOMContentLoaded", () => {
  const filePicker = document.getElementById("vocab-file-picker");
  if (filePicker) {
    filePicker.addEventListener("change", (event) => {
      const file = event.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const parsedData = JSON.parse(e.target.result);
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            wordbankData.length = 0; parsedData.forEach(item => wordbankData.push(item));
            currentFilter = "all"; currentBatchSize = 20; stopAudio(); buildThemes(); fullResetUI(); updateStats();
            alert(`🎉 Success! Loaded ${wordbankData.length} manual entries.`);
          }
        } catch (err) { alert("❌ Error parsing entry structural design JSON format."); }
      };
      reader.readAsText(file);
    });
  }
});

console.log("🔼 Dynamic N-Column Matrix Engine fully hardened.");