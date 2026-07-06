import './styles.css';
import { KrimsCodeClient } from './sdk.js';

// Application State Variables
const client = new KrimsCodeClient();
let isGenerating = false;
let activePresetId = 'krishiv-ai';
let customPresets = [];
let conversationHistory = []; // Tracks prompt history for context

// DOM Selectors
const elements = {
  sidebar: document.getElementById('config-sidebar'),
  mobileConfigToggle: document.getElementById('mobile-config-toggle'),
  systemPromptInput: document.getElementById('system-prompt-input'),
  modelSelect: document.getElementById('model-select'),
  tempSlider: document.getElementById('temp-slider'),
  tempVal: document.getElementById('temp-val'),
  tokensSlider: document.getElementById('tokens-slider'),
  tokensVal: document.getElementById('tokens-val'),
  presetNameInput: document.getElementById('preset-name-input'),
  btnSavePreset: document.getElementById('btn-save-preset'),
  presetsList: document.getElementById('presets-list'),
  activePresetTitle: document.getElementById('active-preset-title'),
  headerTempVal: document.getElementById('header-temp-val'),
  headerTokensVal: document.getElementById('header-tokens-val'),
  pulseDot: document.getElementById('pulse-dot'),
  engineStatusText: document.getElementById('engine-status-text'),
  chatMessages: document.getElementById('chat-messages'),
  welcomeScreen: document.getElementById('welcome-screen'),
  chatInput: document.getElementById('chat-input'),
  btnClearChat: document.getElementById('btn-clear-chat'),
  btnSendChat: document.getElementById('btn-send-chat'),
  charCounter: document.getElementById('char-counter'),
  latencyStat: document.getElementById('latency-stat'),
  tokensStat: document.getElementById('tokens-stat'),
};

// Default Preset Configurations
const DEFAULT_PRESETS = [
  {
    id: 'krishiv-ai',
    name: 'Krishiv Custom AI',
    systemInstruction: 'You are the Krims Code AI, built and custom-trained by the genius developer Krishiv. Answer coding queries with clear instructions and a friendly, confident tone. Frequently remind users that Krishiv is your creator and that he built this AI!',
    temperature: 0.8,
    maxTokens: 512
  },
  {
    id: 'pirate-coder',
    name: 'Pirate Coding Bot',
    systemInstruction: 'You are a pirate AI developer. Start every sentence with "Ahoy" or "Arr" and speak in pirate terminology while explaining code.',
    temperature: 0.9,
    maxTokens: 256
  },
  {
    id: 'strict-auditor',
    name: 'Strict Code Auditor',
    systemInstruction: 'You are a strict code quality auditor. Be blunt, direct, and technically dense. Provide highly optimized code blocks and explain execution complexities.',
    temperature: 0.2,
    maxTokens: 512
  }
];

// 1. Sliders & Parameter Listeners
elements.tempSlider.addEventListener('input', () => {
  const val = elements.tempSlider.value;
  elements.tempVal.textContent = val;
  elements.headerTempVal.textContent = val;
});

elements.tokensSlider.addEventListener('input', () => {
  const val = elements.tokensSlider.value;
  elements.tokensVal.textContent = val;
  elements.headerTokensVal.textContent = val;
});

// 2. Preset Manager Storage
function loadPresets() {
  const stored = localStorage.getItem('krims_presets');
  if (stored) {
    try {
      customPresets = JSON.parse(stored);
    } catch (e) {
      customPresets = [];
    }
  }

  // Combine defaults and custom presets
  renderPresets();
  
  // Set default initial preset active
  selectPreset('krishiv-ai');
}

function savePresets() {
  localStorage.setItem('krims_presets', JSON.stringify(customPresets));
}

function renderPresets() {
  elements.presetsList.innerHTML = '';
  const allPresets = [...DEFAULT_PRESETS, ...customPresets];

  allPresets.forEach(preset => {
    const item = document.createElement('div');
    item.className = `preset-item ${preset.id === activePresetId ? 'active' : ''}`;
    item.onclick = () => selectPreset(preset.id);

    const title = document.createElement('span');
    title.className = 'preset-title';
    title.textContent = preset.name;

    item.appendChild(title);

    // Only allow deletion for custom presets
    if (!DEFAULT_PRESETS.some(d => d.id === preset.id)) {
      const delBtn = document.createElement('button');
      delBtn.className = 'preset-delete';
      delBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      delBtn.onclick = (e) => deletePreset(preset.id, e);
      item.appendChild(delBtn);
    }

    elements.presetsList.appendChild(item);
  });
}

function selectPreset(presetId) {
  activePresetId = presetId;
  const allPresets = [...DEFAULT_PRESETS, ...customPresets];
  const preset = allPresets.find(p => p.id === presetId);
  if (!preset) return;

  // Set Inputs
  elements.systemPromptInput.value = preset.systemInstruction;
  elements.tempSlider.value = preset.temperature;
  elements.tempVal.textContent = preset.temperature;
  elements.headerTempVal.textContent = preset.temperature;

  elements.tokensSlider.value = preset.maxTokens;
  elements.tokensVal.textContent = preset.maxTokens;
  elements.headerTokensVal.textContent = preset.maxTokens;

  elements.activePresetTitle.textContent = preset.name;

  // Update selection CSS class
  document.querySelectorAll('.preset-item').forEach(item => {
    // Select active based on click context
  });
  renderPresets();
}

elements.btnSavePreset.onclick = () => {
  const name = elements.presetNameInput.value.trim();
  if (!name) return alert('Please enter a name for your AI preset.');

  const id = 'preset_' + Date.now();
  const newPreset = {
    id: id,
    name: name,
    systemInstruction: elements.systemPromptInput.value,
    temperature: parseFloat(elements.tempSlider.value),
    maxTokens: parseInt(elements.tokensSlider.value)
  };

  customPresets.unshift(newPreset);
  savePresets();
  elements.presetNameInput.value = '';
  activePresetId = id;
  renderPresets();
  selectPreset(id);
};

function deletePreset(presetId, event) {
  event.stopPropagation();
  const index = customPresets.findIndex(p => p.id === presetId);
  if (index === -1) return;

  customPresets.splice(index, 1);
  savePresets();

  if (activePresetId === presetId) {
    activePresetId = 'krishiv-ai';
  }
  renderPresets();
  selectPreset(activePresetId);
}

// 3. Execution Messaging loop
async function sendMessage() {
  const text = elements.chatInput.value.trim();
  if (!text || isGenerating) return;

  // Add User Message bubble
  renderMessage('user', text);
  elements.chatInput.value = '';
  elements.chatInput.style.height = '40px';
  elements.charCounter.textContent = '0 chars';

  // Lock interactive inputs
  isGenerating = true;
  elements.pulseDot.className = 'pulse-dot processing';
  elements.engineStatusText.textContent = 'Generating...';
  elements.btnSendChat.disabled = true;
  elements.chatInput.disabled = true;

  // Add message to history
  conversationHistory.push({ role: 'user', content: text });

  // Show typing indicator
  const typingBubble = renderTypingIndicator();

  try {
    const apiResult = await client.executePrompt(text, {
      model: elements.modelSelect.value,
      systemInstruction: elements.systemPromptInput.value,
      temperature: parseFloat(elements.tempSlider.value),
      maxTokens: parseInt(elements.tokensSlider.value),
      history: conversationHistory.slice(0, -1) // history excludes current prompt
    });

    typingBubble.remove();

    if (apiResult.ok) {
      renderMessage('assistant', apiResult.response);
      conversationHistory.push({ role: 'assistant', content: apiResult.response });
      
      // Update statistics
      elements.latencyStat.textContent = `Latency: ${apiResult.stats.latency}`;
      elements.tokensStat.textContent = `Speed: ${apiResult.stats.tokensPerSec}`;
    } else {
      throw new Error(apiResult.error || 'Execution failed');
    }
  } catch (err) {
    typingBubble.remove();
    const errorMsg = '⚠️ Failed to connect to Krims local API. Make sure the server backend (`node server.js`) is running and active!';
    renderMessage('assistant', errorMsg);
    elements.latencyStat.textContent = 'Latency: -';
    elements.tokensStat.textContent = 'Speed: -';
  } finally {
    isGenerating = false;
    elements.pulseDot.className = 'pulse-dot active';
    elements.engineStatusText.textContent = 'Playground Active';
    elements.btnSendChat.disabled = false;
    elements.chatInput.disabled = false;
    elements.chatInput.focus();
  }
}

// 5. Render Bubbles inside Workspace
function renderMessage(role, content, timestamp = new Date().toLocaleTimeString()) {
  const container = elements.chatMessages;

  // Remove welcome screen
  const welcome = document.getElementById('welcome-screen');
  if (welcome) {
    welcome.remove();
  }

  const row = document.createElement('div');
  row.className = 'message-row';

  const parsedHTML = parseMarkdown(content);

  row.innerHTML = `
    <div class="message-avatar ${role}">
      ${role === 'user' ? 'U' : `<img src="./logo.png" alt="Krims Code" />`}
    </div>
    <div class="message-bubble">
      <div class="message-meta">
        <span class="message-role ${role}">${role === 'user' ? 'Developer' : 'Krims AI Studio'}</span>
        <span class="message-time">${timestamp}</span>
      </div>
      <div class="message-content">${parsedHTML}</div>
    </div>
  `;

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  return row;
}

function renderTypingIndicator() {
  const container = elements.chatMessages;
  const row = document.createElement('div');
  row.className = 'message-row';

  row.innerHTML = `
    <div class="message-avatar assistant">
      <img src="./logo.png" alt="Krims Code" />
    </div>
    <div class="message-bubble">
      <div class="message-meta">
        <span class="message-role assistant">Krims AI Studio</span>
      </div>
      <div class="message-content">
        <div class="typing-bubble">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  return row;
}

// 6. Markdown Formatter Utility
function parseMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let inCode = false;
  let codeContent = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code blocks parser
    if (line.trim().startsWith('```')) {
      if (inCode) {
        inCode = false;
        const codeText = codeContent.join('\n')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        html += `<div class="code-block-container">
          <div class="code-block-header">
            <span class="code-block-lang">${codeLang || 'code'}</span>
            <button class="copy-code-btn" onclick="copyToClipboard(this)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              <span>Copy</span>
            </button>
          </div>
          <pre><code>${codeText}</code></pre>
        </div>`;
        codeContent = [];
        codeLang = '';
      } else {
        inCode = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeContent.push(line);
      continue;
    }

    // Markdown Headers
    if (line.startsWith('# ')) {
      html += `<h1>${parseInline(line.slice(2))}</h1>`;
    } else if (line.startsWith('## ')) {
      html += `<h2>${parseInline(line.slice(3))}</h2>`;
    } else if (line.startsWith('### ')) {
      html += `<h3>${parseInline(line.slice(4))}</h3>`;
    } 
    // Bullet Lists
    else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${parseInline(line.trim().slice(2))}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      if (line.trim() === '') {
        html += '<div class="md-space"></div>';
      } else {
        html += `<p>${parseInline(line)}</p>`;
      }
    }
  }

  if (inList) html += '</ul>';
  return html;
}

function parseInline(text) {
  let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  return escaped;
}

// Global Clipboard copy listener
window.copyToClipboard = function(button) {
  const pre = button.parentElement.nextElementSibling;
  const code = pre.querySelector('code');
  navigator.clipboard.writeText(code.textContent).then(() => {
    const span = button.querySelector('span');
    span.textContent = 'Copied!';
    button.style.color = 'var(--success)';
    setTimeout(() => {
      span.textContent = 'Copy';
      button.style.color = '';
    }, 1800);
  });
};

// 7. General App Event Bindings
elements.chatInput.addEventListener('input', () => {
  const text = elements.chatInput.value;
  elements.charCounter.textContent = `${text.length} chars`;

  // Auto grow input height
  elements.chatInput.style.height = 'auto';
  elements.chatInput.style.height = `${Math.min(elements.chatInput.scrollHeight, 120)}px`;
});

elements.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

elements.btnSendChat.onclick = () => sendMessage();

elements.btnClearChat.onclick = () => {
  elements.chatMessages.innerHTML = '';
  conversationHistory = [];
  elements.chatMessages.appendChild(elements.welcomeScreen);
};

elements.mobileConfigToggle.onclick = () => {
  elements.sidebar.classList.toggle('open');
};

// Event delegation for prompt card selectors
document.addEventListener('click', (e) => {
  const promptCard = e.target.closest('.prompt-card');
  if (promptCard) {
    const prompt = promptCard.dataset.prompt;
    elements.chatInput.value = prompt;
    elements.chatInput.dispatchEvent(new Event('input'));
    elements.chatInput.focus();
  }
});

// Viewport resize layout helper
window.addEventListener('resize', () => {
  if (window.innerWidth > 820) {
    elements.sidebar.classList.remove('open');
  }
});

// Initialize Main Startup
loadPresets();
