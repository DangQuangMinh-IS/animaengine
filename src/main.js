/**
 * src/main.js - Trình điều phối hoạt ảnh và trạng thái Mascot Đa Nhân Vật (2D & 3D)
 */

import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { ThreeMascotRenderer } from './renderer3d.js';

// DOM Elements
const appContainer = document.getElementById('app');
const chibiWrapper = document.getElementById('chibi-wrapper');
const chibiImg = document.getElementById('chibi-img');
const chibiCanvas = document.getElementById('chibi-canvas');
const speechBubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
const voicePlayer = document.getElementById('voice-player');
const contextMenu = document.getElementById('context-menu');
const menuPoke = document.getElementById('menu-poke');
const menuMute = document.getElementById('menu-mute');
const menuExit = document.getElementById('menu-exit');
const charOptionElements = document.querySelectorAll('.char-option');

// Danh sách các nhân vật được hỗ trợ
const CHARACTER_CATALOG = {
  hina: { path: '/characters/hina/manifest.json', defaultType: '2d' },
  hina_dress: { path: '/characters/hina_dress/manifest.json', defaultType: '3d' },
  hanako: { path: '/characters/hanako/manifest.json', defaultType: '3d' },
  airi: { path: '/characters/airi/manifest.json', defaultType: '3d' }
};

function logToBackend(msg) {
  console.log(msg);
  try {
    invoke('log_front', { msg: String(msg) }).catch(() => {});
  } catch {}
}

window.addEventListener('error', (e) => {
  logToBackend(`[FATAL JS ERROR] ${e.message} at ${e.filename}:${e.lineno}`);
});

window.addEventListener('unhandledrejection', (e) => {
  logToBackend(`[UNHANDLED REJECTION] ${e.reason}`);
});

// Trạng thái hệ thống
let currentCharacterId = localStorage.getItem('anima_active_character') || 'hina';
let currentManifest = null;
let currentState = 'idle';
let isDragging = false;
let isMuted = false;
let typingTimeout = null;
let panicTimeout = null;
let speechTimeout = null;
let renderer3d = null;

// Lấy thông tin cửa sổ hiện tại (nếu chạy dưới Tauri)
let currentWindow = null;
try {
  currentWindow = getCurrentWindow();
} catch (e) {
  console.warn('[Window] Running outside Tauri runtime:', e);
}

/**
 * Tải manifest của nhân vật được chọn và thiết lập Renderer tương ứng (2D hoặc 3D)
 */
async function loadCharacter(charId) {
  const charConfig = CHARACTER_CATALOG[charId] || CHARACTER_CATALOG.hina;
  currentCharacterId = charId;
  localStorage.setItem('anima_active_character', charId);

  // Cập nhật giao diện menu ngữ cảnh
  charOptionElements.forEach((el) => {
    if (el.dataset.char === charId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  try {
    const res = await fetch(charConfig.path);
    currentManifest = await res.json();
    console.log(`[Anima Engine] Đã nạp manifest cho nhân vật "${charId}":`, currentManifest);
  } catch (err) {
    console.error(`[Anima Engine] Lỗi nạp manifest cho "${charId}":`, err);
    return;
  }

  // Chuyển đổi giữa chế độ 2D Sprite và 3D Three.js
  if (currentManifest.type === '3d') {
    chibiImg.classList.add('hidden');
    chibiCanvas.classList.remove('hidden');

    if (!renderer3d) {
      renderer3d = new ThreeMascotRenderer(chibiCanvas);
    }

    const modelUrl = `/characters/${charId}/${currentManifest.model || 'model.glb'}`;
    await renderer3d.loadModel(modelUrl, currentManifest.camera, () => {
      applyStateToRenderer(currentState);
    });
  } else {
    // Chế độ 2D
    chibiCanvas.classList.add('hidden');
    chibiImg.classList.remove('hidden');

    if (renderer3d) {
      renderer3d.unloadCurrentModel();
    }
  }

  // Áp dụng trạng thái hiện tại
  setState(currentState, true);
}

/**
 * Áp dụng trạng thái hoạt ảnh vào 2D Sprite hoặc 3D Model
 */
function applyStateToRenderer(stateName) {
  if (!currentManifest) return;

  const stateData = currentManifest.states?.[stateName];

  if (currentManifest.type === '3d' && renderer3d) {
    const clipName = stateData?.clip || 'Cafe_Idle';
    const isLoop = stateData?.loop !== false;
    renderer3d.playAnimation(clipName, isLoop);
  } else if (currentManifest.type === '2d') {
    if (stateData?.asset) {
      chibiImg.src = `/characters/${currentCharacterId}/${stateData.asset}`;
    } else {
      // Fallback
      const defaultAssets = {
        idle: '/characters/hina/animations/idle.png',
        typing: '/characters/hina/animations/typing.png',
        panic_shutdown: '/characters/hina/animations/panic.png',
        dragged: '/characters/hina/animations/dragged.png'
      };
      if (defaultAssets[stateName]) chibiImg.src = defaultAssets[stateName];
    }
  }
}

/**
 * Chuyển đổi trạng thái nhân vật (FSM)
 */
function setState(newState, forceUpdate = false, forceDialogue = null, forceSound = null) {
  if (currentState === newState && !forceUpdate && !forceDialogue) return;
  currentState = newState;

  // Cập nhật CSS Container
  appContainer.className = 'mascot-container';
  if (newState === 'idle') appContainer.classList.add('state-idle');
  else if (newState === 'typing') appContainer.classList.add('state-typing');
  else if (newState === 'panic_shutdown') appContainer.classList.add('state-panic');
  else if (newState === 'dragged') appContainer.classList.add('state-dragged');

  // Cập nhật hoạt ảnh
  applyStateToRenderer(newState);

  // Xử lý thoại và âm thanh nếu có trong manifest
  if (currentManifest?.states?.[newState]) {
    const stateData = currentManifest.states[newState];

    // Lời thoại
    const dialogues = stateData.dialogues;
    if (dialogues && dialogues.length > 0) {
      const text = forceDialogue || dialogues[Math.floor(Math.random() * dialogues.length)];
      showSpeech(text);
    }

    // Âm thanh
    const sound = forceSound || stateData.sound;
    if (sound) {
      const soundUrl = sound.startsWith('/') ? sound : `/characters/${currentCharacterId}/${sound}`;
      playVoice(soundUrl);
    }
  }
}

/**
 * Hiển thị bong bóng thoại
 */
function showSpeech(text, duration = 3500) {
  speechText.textContent = text;
  speechBubble.classList.remove('hidden');

  if (speechTimeout) clearTimeout(speechTimeout);
  speechTimeout = setTimeout(() => {
    speechBubble.classList.add('hidden');
  }, duration);
}

/**
 * Phát âm thanh lồng tiếng
 */
function playVoice(soundPath) {
  if (isMuted) return;
  try {
    voicePlayer.src = soundPath;
    voicePlayer.currentTime = 0;
    voicePlayer.play().catch((e) => {
      console.warn('[Audio] Autoplay prevented or error:', e);
    });
  } catch (e) {
    console.error('[Audio] Error:', e);
  }
}

/**
 * Tương tác xoa đầu / Chọc nhân vật (Poke)
 */
function pokeCharacter() {
  if (currentManifest?.states?.poke) {
    const pokeState = currentManifest.states.poke;
    const sound = pokeState.sound;
    const dialogues = pokeState.dialogues || [];
    const text = dialogues[Math.floor(Math.random() * dialogues.length)];

    if (currentManifest.type === '3d' && renderer3d && pokeState.clip) {
      renderer3d.playAnimation(pokeState.clip, false, 0.15);
      setTimeout(() => {
        if (currentState === 'idle') {
          applyStateToRenderer('idle');
        }
      }, 2000);
    }

    if (text) showSpeech(text);
    if (sound) {
      const soundUrl = sound.startsWith('/') ? sound : `/characters/${currentCharacterId}/${sound}`;
      playVoice(soundUrl);
    }
  } else {
    // Mặc định fallback thoại tương tác
    const defaultDialogues = [
      'Sensei... xoa đầu tôi sao? Thật là...',
      'Được Sensei chăm sóc thế này... dễ chịu thật đấy.',
      'Hôm nay Sensei cũng vất vả rồi nhé! 💕'
    ];
    const text = defaultDialogues[Math.floor(Math.random() * defaultDialogues.length)];
    showSpeech(text);
  }
}

/**
 * Thiết lập sự kiện kéo thả chuột và tương tác UI
 */
function setupMouseInteractions() {
  let dragStartTime = 0;

  const finishDrag = () => {
    if (isDragging || currentState === 'dragged') {
      isDragging = false;
      setTimeout(() => {
        if (!isDragging && currentState === 'dragged') {
          setState('idle');
        }
      }, 80);
    }
  };

  // Kéo thả bằng chuột trái
  chibiWrapper.addEventListener('mousedown', async (e) => {
    if (e.button === 0) {
      contextMenu.classList.add('hidden');
      isDragging = true;
      dragStartTime = Date.now();
      setState('dragged');

      try {
        await invoke('start_drag_tracking');
        if (currentWindow) {
          await currentWindow.startDragging();
        }
      } catch (err) {
        console.warn('Start dragging error:', err);
        finishDrag();
      }
    }
  });

  window.addEventListener('mouseup', finishDrag);

  // Click vào chibi (Xoa đầu)
  chibiWrapper.addEventListener('click', () => {
    const elapsed = Date.now() - dragStartTime;
    if (elapsed < 250) {
      pokeCharacter();
    }
  });

  // Chuột phải -> Mở menu ngữ cảnh
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

  // Tương tác Poke từ menu
  menuPoke.addEventListener('click', () => {
    contextMenu.classList.add('hidden');
    pokeCharacter();
  });

  // Bật/Tắt âm thanh
  menuMute.addEventListener('click', () => {
    isMuted = !isMuted;
    menuMute.textContent = isMuted ? 'Bật âm thanh 🔈' : 'Tắt âm thanh 🔊';
    contextMenu.classList.add('hidden');
    showSpeech(isMuted ? 'Đã tắt âm thanh!' : 'Đã bật lại âm thanh!');
  });

  // Chọn nhân vật từ Menu
  charOptionElements.forEach((optionEl) => {
    optionEl.addEventListener('click', async () => {
      const selectedId = optionEl.dataset.char;
      if (selectedId && selectedId !== currentCharacterId) {
        contextMenu.classList.add('hidden');
        await loadCharacter(selectedId);
        showSpeech(`Đã chuyển sang ${currentManifest.name || selectedId}! 💕`);
      }
    });
  });

  // Thoát ứng dụng
  menuExit.addEventListener('click', async () => {
    try {
      if (currentWindow) await currentWindow.close();
      else window.close();
    } catch {
      window.close();
    }
  });

  // Xử lý xoay nhìn theo chuột (Local Mouse Fallback)
  window.addEventListener('mousemove', (e) => {
    if (currentManifest?.type === '3d' && renderer3d && !isDragging) {
      const rect = chibiWrapper.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const angle = Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);
      renderer3d.updateMouseLook(angle, distance);
    }
  });
}

/**
 * Lắng nghe sự kiện cảm biến từ Rust backend
 */
async function setupTauriListeners() {
  try {
    // 1. Cảm biến nhịp gõ phím toàn cục
    await listen('sensor:typing', () => {
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

    // 3. Tín hiệu kết thúc kéo thả từ cảm biến OS Rust
    await listen('sensor:drag_ended', () => {
      if (isDragging || currentState === 'dragged') {
        isDragging = false;
        setTimeout(() => {
          if (!isDragging && currentState === 'dragged') {
            setState('idle');
          }
        }, 80);
      }
    });

    // 4. Cảm biến tọa độ chuột toàn cục cho 3D Look-at
    await listen('sensor:mouse', async (event) => {
      if (currentManifest?.type === '3d' && renderer3d && !isDragging && currentWindow) {
        try {
          const winPos = await currentWindow.outerPosition();
          const globalX = event.payload?.x ?? 0;
          const globalY = event.payload?.y ?? 0;
          // Trung tâm nhân vật trong cửa sổ 320x400
          const mascotGlobalX = winPos.x + 160;
          const mascotGlobalY = winPos.y + 240;

          const dx = globalX - mascotGlobalX;
          const dy = globalY - mascotGlobalY;
          const angle = Math.atan2(dy, dx);
          const distance = Math.sqrt(dx * dx + dy * dy);
          renderer3d.updateMouseLook(angle, distance);
        } catch {
          // Ignore
        }
      }
    });

    console.log('[Anima Engine] Tauri listeners registered successfully.');
  } catch (err) {
    console.warn('[Anima Engine] Error setting up Tauri listeners (running in browser mode?):', err);
  }
}

/**
 * Khởi chạy ứng dụng
 */
async function init() {
  logToBackend('[Init] Anima Engine starting...');
  await loadCharacter(currentCharacterId);
  setupMouseInteractions();
  await setupTauriListeners();
  logToBackend(`[Init] Anima Engine started successfully with character: ${currentCharacterId}`);

  setTimeout(() => {
    showSpeech(`Chào Sensei! ${currentManifest?.name || 'Hina'} đã sẵn sàng đồng hành cùng người.`, 4000);
  }, 600);
}

init();
