/**
 * src/main.js - Trình điều phối hoạt ảnh và trạng thái Mascot Hina
 */

import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

// DOM Elements
const appContainer = document.getElementById('app');
const chibiWrapper = document.getElementById('chibi-wrapper');
const chibiImg = document.getElementById('chibi-img');
const speechBubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
const voicePlayer = document.getElementById('voice-player');
const contextMenu = document.getElementById('context-menu');
const menuPoke = document.getElementById('menu-poke');
const menuMute = document.getElementById('menu-mute');
const menuExit = document.getElementById('menu-exit');

// State Machine
let currentState = 'idle';
let isDragging = false;
let isMuted = false;
let typingTimeout = null;
let panicTimeout = null;
let speechTimeout = null;
let manifest = null;

// Tải thông tin nhân vật từ manifest.json
async function loadManifest() {
  try {
    const res = await fetch('/characters/hina/manifest.json');
    manifest = await res.json();
    console.log('[Anima Engine] Loaded character manifest:', manifest);
  } catch (err) {
    console.error('[Anima Engine] Error loading manifest:', err);
  }
}

// Chuyển đổi trạng thái nhân vật
function setState(newState, forceDialogue = null, forceSound = null) {
  if (currentState === newState && !forceDialogue) return;
  currentState = newState;

  // Cập nhật class CSS
  appContainer.className = 'mascot-container';
  if (newState === 'idle') appContainer.classList.add('state-idle');
  else if (newState === 'typing') appContainer.classList.add('state-typing');
  else if (newState === 'panic_shutdown') appContainer.classList.add('state-panic');
  else if (newState === 'dragged') appContainer.classList.add('state-dragged');

  // Cập nhật Sprite ảnh
  if (manifest && manifest.states && manifest.states[newState]) {
    const stateData = manifest.states[newState];
    chibiImg.src = `/characters/hina/${stateData.asset}`;

    // Lời thoại
    const dialogues = stateData.dialogues;
    if (dialogues && dialogues.length > 0) {
      const text = forceDialogue || dialogues[Math.floor(Math.random() * dialogues.length)];
      showSpeech(text);
    }

    // Âm thanh
    const sound = forceSound || stateData.sound;
    if (sound) {
      playVoice(`/characters/hina/${sound}`);
    }
  } else {
    // Fallback nếu chưa tải xong manifest
    const assetMap = {
      idle: '/characters/hina/animations/idle.png',
      typing: '/characters/hina/animations/typing.png',
      panic_shutdown: '/characters/hina/animations/panic.png',
      dragged: '/characters/hina/animations/dragged.png'
    };
    if (assetMap[newState]) chibiImg.src = assetMap[newState];
  }
}

// Hiển thị bong bóng thoại
function showSpeech(text, duration = 3500) {
  speechText.textContent = text;
  speechBubble.classList.remove('hidden');

  if (speechTimeout) clearTimeout(speechTimeout);
  speechTimeout = setTimeout(() => {
    speechBubble.classList.add('hidden');
  }, duration);
}

// Phát âm thanh thoại Sensei
function playVoice(soundPath) {
  if (isMuted) return;
  try {
    voicePlayer.src = soundPath;
    voicePlayer.currentTime = 0;
    voicePlayer.play().catch(e => {
      console.warn('[Audio] Autoplay prevented or error:', e);
    });
  } catch (e) {
    console.error('[Audio] Error:', e);
  }
}

// Tương tác xoa đầu (Poke)
function pokeHina() {
  const pokeSounds = [
    '/characters/hina/audio/Hina_Cafe_Act_1.ogg.mp3',
    '/characters/hina/audio/Hina_Cafe_Act_2.ogg.mp3',
    '/characters/hina/audio/Hina_Cafe_Act_3.ogg.mp3'
  ];
  const pokeDialogues = [
    'Sensei... xoa đầu tôi sao? Thật là...',
    'Được Sensei chăm sóc thế này... dễ chịu thật đấy.',
    'Sensei đừng chọc tôi mãi chứ, tôi còn phải làm việc...',
    'Hôm nay Sensei cũng vất vả rồi nhé! 💕'
  ];
  const sound = pokeSounds[Math.floor(Math.random() * pokeSounds.length)];
  const dialogue = pokeDialogues[Math.floor(Math.random() * pokeDialogues.length)];
  
  setState('idle', dialogue, sound);
}

// Thiết lập sự kiện kéo thả & chuột
function setupMouseInteractions() {
  const currentWindow = getCurrentWindow();

  // Kéo thả bằng chuột trái
  chibiWrapper.addEventListener('mousedown', async (e) => {
    if (e.button === 0) { // Chuột trái
      contextMenu.classList.add('hidden');
      isDragging = true;
      setState('dragged');
      
      try {
        await currentWindow.startDragging();
      } catch (err) {
        console.warn('Start dragging error:', err);
      } finally {
        isDragging = false;
        setTimeout(() => {
          if (!isDragging && currentState === 'dragged') {
            setState('idle');
          }
        }, 200);
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      setTimeout(() => {
        if (!isDragging && currentState === 'dragged') {
          setState('idle');
        }
      }, 200);
    }
  });

  // Click vào chibi (Xoa đầu)
  let lastClickTime = 0;
  chibiWrapper.addEventListener('click', (e) => {
    const now = Date.now();
    // Bỏ qua nếu vừa kéo xong
    if (now - lastClickTime < 300) return;
    lastClickTime = now;
    if (!isDragging && currentState === 'idle') {
      pokeHina();
    }
  });

  // Chuột phải -> Mở menu
  chibiWrapper.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenu.classList.toggle('hidden');
  });

  // Đóng menu khi click ra ngoài
  window.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target) && e.target !== chibiWrapper) {
      contextMenu.classList.add('hidden');
    }
  });

  // Menu action items
  menuPoke.addEventListener('click', () => {
    contextMenu.classList.add('hidden');
    pokeHina();
  });

  menuMute.addEventListener('click', () => {
    isMuted = !isMuted;
    menuMute.textContent = isMuted ? 'Bật âm thanh 🔈' : 'Tắt âm thanh 🔇';
    contextMenu.classList.add('hidden');
    showSpeech(isMuted ? 'Đã tắt tiếng Hina!' : 'Đã bật lại tiếng Hina!');
  });

  menuExit.addEventListener('click', async () => {
    try {
      await currentWindow.close();
    } catch {
      window.close();
    }
  });
}

// Lắng nghe sự kiện cảm biến từ Rust backend
async function setupTauriListeners() {
  try {
    // 1. Cảm biến nhịp gõ phím
    await listen('sensor:typing', (event) => {
      if (isDragging || currentState === 'panic_shutdown') return;

      if (typingTimeout) clearTimeout(typingTimeout);
      setState('typing');

      // Quay lại Idle sau 2.5 giây kể từ lần gõ phím cuối
      typingTimeout = setTimeout(() => {
        if (!isDragging && currentState === 'typing') {
          setState('idle');
        }
      }, 2500);
    });

    // 2. Cảm biến cảnh báo vùng Shutdown/Start
    await listen('sensor:alert', (event) => {
      if (isDragging) return;
      const payload = event.payload || {};

      if (payload.type === 'shutdown_panic') {
        if (panicTimeout) clearTimeout(panicTimeout);
        setState('panic_shutdown');

        panicTimeout = setTimeout(() => {
          if (!isDragging && currentState === 'panic_shutdown') {
            setState('idle');
          }
        }, 3000);
      }
    });

    console.log('[Anima Engine] Tauri listeners registered successfully.');
  } catch (err) {
    console.warn('[Anima Engine] Error setting up Tauri listeners (running in browser mode?):', err);
  }
}

// Khởi chạy ứng dụng
async function init() {
  await loadManifest();
  setupMouseInteractions();
  await setupTauriListeners();
  
  // Trạng thái ban đầu
  setState('idle');
  setTimeout(() => {
    showSpeech('Chào Sensei! Hina đã sẵn sàng đồng hành cùng người.', 4000);
  }, 600);
}

init();
