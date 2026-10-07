/**
 * src/main.js - Trình điều phối hoạt ảnh và trạng thái Mascot Đa Nhân Vật (2D & 3D)
 * Hỗ trợ:
 * - Hệ thống nhân vật Hybrid (Hina 2D, Hina Dạ Hội 3D, Yuuka Đồ Ngủ 3D, Yuzu Thùng Game 3D, Mika 3D, Arisu 3D, Hanako 3D, Airi 3D)
 * - Tự thêm Model & Voice riêng qua Character Studio với Three.js GLTFLoader & Auto Clip Mapping
 * - Modal Cài đặt & Tinh chỉnh chi tiết (Ánh sáng, Màu sắc, Zoom Camera, Âm lượng, Tần suất tự thoại, Khử răng cưa)
 * - Nhận diện rung lắc chuột (Drag Shake) từ cả OS Hook Rust backend lẫn Webview
 * - Hiệu ứng chóng mặt (Dizzy Shake animation) kèm hội thoại và âm thanh tương tác
 */

import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { invoke } from '@tauri-apps/api/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
const menuMute = document.getElementById('menu-mute');
const menuExit = document.getElementById('menu-exit');
const menuSettings = document.getElementById('menu-settings');

// Settings & Studio elements
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const btnResetSettings = document.getElementById('btn-reset-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const sliderAmbient = document.getElementById('slider-ambient');
const valAmbient = document.getElementById('val-ambient');
const sliderKeylight = document.getElementById('slider-keylight');
const valKeylight = document.getElementById('val-keylight');
const pickerTint = document.getElementById('picker-tint');
const sliderCameraDist = document.getElementById('slider-camera-dist');
const valCameraDist = document.getElementById('val-camera-dist');
const sliderCameraY = document.getElementById('slider-camera-y');
const valCameraY = document.getElementById('val-camera-y');
const selectQuality = document.getElementById('select-quality');
const sliderVolume = document.getElementById('slider-volume');
const valVolume = document.getElementById('val-volume');
const selectAmbientFreq = document.getElementById('select-ambient-freq');
const selectShakeSens = document.getElementById('select-shake-sens');
const installedCharList = document.getElementById('installed-char-list');
const customModelFile = document.getElementById('custom-model-file');
const customVoiceFile = document.getElementById('custom-voice-file');
const customCharName = document.getElementById('custom-char-name');
const modelInspectInfo = document.getElementById('model-inspect-info');
const clipMappingContainer = document.getElementById('clip-mapping-container');
const btnSaveCustomChar = document.getElementById('btn-save-custom-char');

// Danh sách các nhân vật được hỗ trợ
const CHARACTER_CATALOG = {
  hina: { path: '/characters/hina/manifest.json', defaultType: '2d', name: '🌸 Hina (2D Chibi)' },
  hina_dress: { path: '/characters/hina_dress/manifest.json', defaultType: '3d', name: '👗 Hina - Dạ Hội (3D)' },
  yuuka_pajama: { path: '/characters/yuuka_pajama/manifest.json', defaultType: '3d', name: '🧮 Yuuka - Đồ Ngủ (3D)' },
  yuzu: { path: '/characters/yuzu/manifest.json', defaultType: '3d', name: '📦 Yuzu - Thùng Game (3D)' },
  mika: { path: '/characters/mika/manifest.json', defaultType: '3d', name: '👑 Mika - Công Chúa (3D)' },
  arisu: { path: '/characters/arisu/manifest.json', defaultType: '3d', name: '🎮 Arisu - Dũng Sĩ (3D)' },
  hanako: { path: '/characters/hanako/manifest.json', defaultType: '3d', name: '🌺 Hanako (3D)' },
  airi: { path: '/characters/airi/manifest.json', defaultType: '3d', name: '🎸 Airi - Band (3D)' }
};

// Cấu hình mặc định
const DEFAULT_SETTINGS = {
  ambientIntensity: 1.4,
  keyIntensity: 0.8,
  tintColor: '#ffffff',
  cameraDistance: 2.6,
  cameraTargetY: 0.5,
  volume: 100,
  ambientFreq: 30000,
  shakeSens: 'normal',
  quality: 'balanced'
};

let appSettings = Object.assign({}, DEFAULT_SETTINGS);
try {
  const saved = localStorage.getItem('anima_engine_settings');
  if (saved) Object.assign(appSettings, JSON.parse(saved));
} catch {}

// Tải nhân vật tùy chỉnh do người dùng thêm
let customCharacters = {};
try {
  customCharacters = JSON.parse(localStorage.getItem('anima_custom_characters') || '{}');
  Object.assign(CHARACTER_CATALOG, customCharacters);
} catch (e) {
  console.warn('[Storage] Error loading custom characters:', e);
}

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
let ambientInterval = null;
let renderer3d = null;

// Lấy thông tin cửa sổ hiện tại (nếu chạy dưới Tauri)
let currentWindow = null;
try {
  currentWindow = getCurrentWindow();
} catch (e) {
  console.warn('[Window] Running outside Tauri runtime:', e);
}

/**
 * Áp dụng thiết lập ánh sáng, camera và chất lượng vào 3D Renderer
 */
function applyActiveSettingsToRenderer() {
  if (renderer3d) {
    renderer3d.setLighting({
      ambientIntensity: appSettings.ambientIntensity,
      keyIntensity: appSettings.keyIntensity,
      tintColor: appSettings.tintColor
    });
    renderer3d.setCameraZoom(appSettings.cameraDistance, appSettings.cameraTargetY);
    renderer3d.setQuality(appSettings.quality);
  }
}

/**
 * Tải manifest của nhân vật được chọn và thiết lập Renderer tương ứng (2D hoặc 3D)
 */
async function loadCharacter(charId) {
  const charConfig = CHARACTER_CATALOG[charId] || CHARACTER_CATALOG.hina;
  currentCharacterId = charId;
  localStorage.setItem('anima_active_character', charId);

  // Cập nhật giao diện menu ngữ cảnh
  document.querySelectorAll('.char-option').forEach((el) => {
    if (el.dataset.char === charId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
  renderInstalledCharList();

  try {
    if (charConfig.manifest) {
      currentManifest = charConfig.manifest;
    } else {
      const res = await fetch(charConfig.path);
      currentManifest = await res.json();
    }
    logToBackend(`[Character] Loaded manifest for "${charId}": ${currentManifest.name}`);
  } catch (err) {
    logToBackend(`[Character ERROR] Failed to load manifest for "${charId}": ${err}`);
    return;
  }

  // Chuyển đổi giữa chế độ 2D Sprite và 3D Three.js
  if (currentManifest.type === '3d') {
    chibiImg.classList.add('hidden');
    chibiCanvas.classList.remove('hidden');

    if (!renderer3d) {
      renderer3d = new ThreeMascotRenderer(chibiCanvas);
    }

    const modelUrl = currentManifest.customBlobUrl || `/characters/${charId}/${currentManifest.model || 'model.glb'}`;
    await renderer3d.loadModel(modelUrl, currentManifest.camera, () => {
      applyStateToRenderer(currentState);
    });

    applyActiveSettingsToRenderer();
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
      const soundUrl = (sound.startsWith('/') || sound.startsWith('blob:'))
        ? sound
        : `/characters/${currentCharacterId}/${sound}`;
      playVoice(soundUrl);
    }
  }
}

/**
 * Thực thi một hành động tương tác tức thời (Salute, Praise, Focus, Teatime, Poke, Shake)
 */
function triggerAction(actionName, customDialogue = null, customSound = null) {
  if (!currentManifest) return;

  const stateData = currentManifest.states?.[actionName];
  if (!stateData) {
    console.warn(`[Action] Hành động "${actionName}" không có trong manifest`);
    return;
  }

  // Hiệu ứng chóng mặt khi bị lắc mạnh
  if (actionName === 'shake') {
    chibiWrapper.classList.add('dizzy-shake');
    setTimeout(() => {
      chibiWrapper.classList.remove('dizzy-shake');
    }, 2200);
  }

  // 1. Âm thanh
  const sound = customSound || stateData.sound;
  if (sound) {
    const soundUrl = (sound.startsWith('/') || sound.startsWith('blob:'))
      ? sound
      : `/characters/${currentCharacterId}/${sound}`;
    playVoice(soundUrl);
  }

  // 2. Lời thoại
  const dialogues = stateData.dialogues || [];
  const text = customDialogue || (dialogues.length > 0 ? dialogues[Math.floor(Math.random() * dialogues.length)] : null);
  if (text) {
    showSpeech(text, 4000);
  }

  // 3. Hoạt ảnh tương ứng
  if (currentManifest.type === '3d' && renderer3d && stateData.clip) {
    renderer3d.playOneShot(stateData.clip, 'Cafe_Idle', 3800);
  } else if (currentManifest.type === '2d' && stateData.asset) {
    chibiImg.src = `/characters/${currentCharacterId}/${stateData.asset}`;
    setTimeout(() => {
      if (currentState === 'idle') {
        applyStateToRenderer('idle');
      }
    }, 3500);
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
    voicePlayer.volume = (appSettings.volume ?? 100) / 100;
    voicePlayer.currentTime = 0;
    voicePlayer.play().catch((e) => {
      console.warn('[Audio] Autoplay prevented or error:', e);
    });
  } catch (e) {
    console.error('[Audio] Error:', e);
  }
}

/**
 * Đóng / Mở Modal Cài đặt & Tinh chỉnh chi tiết
 */
async function toggleSettingsModal(open) {
  if (open) {
    settingsModal.classList.remove('hidden');
    contextMenu.classList.add('hidden');
    syncSettingsUI();
    renderInstalledCharList();
    if (currentWindow) {
      try {
        await currentWindow.setSize(new LogicalSize(360, 520));
      } catch {}
    }
  } else {
    settingsModal.classList.add('hidden');
    if (currentWindow) {
      try {
        await currentWindow.setSize(new LogicalSize(320, 400));
      } catch {}
    }
  }
}

/**
 * Đồng bộ giá trị giao diện Cài đặt
 */
function syncSettingsUI() {
  if (!sliderAmbient) return;
  sliderAmbient.value = appSettings.ambientIntensity;
  valAmbient.textContent = appSettings.ambientIntensity + 'x';

  sliderKeylight.value = appSettings.keyIntensity;
  valKeylight.textContent = appSettings.keyIntensity + 'x';

  pickerTint.value = appSettings.tintColor;

  sliderCameraDist.value = appSettings.cameraDistance;
  valCameraDist.textContent = String(appSettings.cameraDistance);

  sliderCameraY.value = appSettings.cameraTargetY;
  valCameraY.textContent = String(appSettings.cameraTargetY);

  selectQuality.value = appSettings.quality;

  sliderVolume.value = appSettings.volume;
  valVolume.textContent = appSettings.volume + '%';

  selectAmbientFreq.value = String(appSettings.ambientFreq);
  selectShakeSens.value = appSettings.shakeSens;
}

/**
 * Hiển thị danh sách nhân vật đã cài đặt trong Character Studio
 */
function renderInstalledCharList() {
  if (!installedCharList) return;
  installedCharList.innerHTML = '';

  Object.keys(CHARACTER_CATALOG).forEach((charId) => {
    const info = CHARACTER_CATALOG[charId];
    const isAct = charId === currentCharacterId;
    const card = document.createElement('div');
    card.className = `char-card ${isAct ? 'active' : ''}`;
    const badgeHtml = info.defaultType === '2d'
      ? '<span class="char-badge-2d">2D</span>'
      : '<span class="char-badge-3d">3D</span>';

    card.innerHTML = `
      <div class="char-card-info">
        ${badgeHtml}
        <span>${info.name || charId}</span>
      </div>
      <button class="char-card-btn">${isAct ? 'Đang dùng' : 'Kích hoạt'}</button>
    `;

    card.querySelector('.char-card-btn').addEventListener('click', async () => {
      await loadCharacter(charId);
      toggleSettingsModal(false);
      showSpeech(`Đã chuyển sang ${info.name || charId}! 💕`);
    });

    installedCharList.appendChild(card);
  });
}

/**
 * Thiết lập các sự kiện cho Modal Cài đặt & Character Studio
 */
function setupSettingsAndStudio() {
  // Mở Settings từ Context Menu
  menuSettings?.addEventListener('click', () => {
    toggleSettingsModal(true);
  });

  // Đóng Settings
  settingsCloseBtn?.addEventListener('click', () => {
    toggleSettingsModal(false);
  });

  // Chuyển Tab
  document.querySelectorAll('.settings-tab-btn').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.settings-tab-pane').forEach((p) => p.classList.remove('active'));

      tabBtn.classList.add('active');
      const targetPane = document.getElementById(tabBtn.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Điều khiển Sliders Live
  sliderAmbient?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    valAmbient.textContent = val + 'x';
    appSettings.ambientIntensity = val;
    renderer3d?.setLighting({ ambientIntensity: val });
  });

  sliderKeylight?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    valKeylight.textContent = val + 'x';
    appSettings.keyIntensity = val;
    renderer3d?.setLighting({ keyIntensity: val });
  });

  pickerTint?.addEventListener('input', (e) => {
    appSettings.tintColor = e.target.value;
    renderer3d?.setLighting({ tintColor: e.target.value });
  });

  document.querySelectorAll('.color-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const col = chip.dataset.color;
      pickerTint.value = col;
      appSettings.tintColor = col;
      renderer3d?.setLighting({ tintColor: col });
    });
  });

  sliderCameraDist?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    valCameraDist.textContent = String(val);
    appSettings.cameraDistance = val;
    renderer3d?.setCameraZoom(val, appSettings.cameraTargetY);
  });

  sliderCameraY?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    valCameraY.textContent = String(val);
    appSettings.cameraTargetY = val;
    renderer3d?.setCameraZoom(appSettings.cameraDistance, val);
  });

  selectQuality?.addEventListener('change', (e) => {
    appSettings.quality = e.target.value;
    renderer3d?.setQuality(e.target.value);
  });

  sliderVolume?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    valVolume.textContent = val + '%';
    appSettings.volume = val;
    voicePlayer.volume = val / 100;
  });

  selectAmbientFreq?.addEventListener('change', (e) => {
    appSettings.ambientFreq = Number(e.target.value);
    startAmbientTimer();
  });

  selectShakeSens?.addEventListener('change', (e) => {
    appSettings.shakeSens = e.target.value;
  });

  // Lưu cài đặt
  btnSaveSettings?.addEventListener('click', () => {
    localStorage.setItem('anima_engine_settings', JSON.stringify(appSettings));
    showSpeech('Đã lưu thiết lập thành công! ✨', 2500);
    toggleSettingsModal(false);
  });

  // Khôi phục mặc định
  btnResetSettings?.addEventListener('click', () => {
    appSettings = Object.assign({}, DEFAULT_SETTINGS);
    syncSettingsUI();
    applyActiveSettingsToRenderer();
    voicePlayer.volume = 1.0;
    startAmbientTimer();
    showSpeech('Đã khôi phục cài đặt mặc định!', 2500);
  });

  // Xử lý Character Studio tự thêm Model & Voice
  let uploadedModelBlobUrl = null;
  let uploadedVoiceBlobUrl = null;
  let foundClips = [];

  customModelFile?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    modelInspectInfo.classList.remove('hidden');
    modelInspectInfo.textContent = 'Đang phân tích mô hình 3D...';

    try {
      const arrayBuffer = await file.arrayBuffer();
      uploadedModelBlobUrl = URL.createObjectURL(file);

      const loader = new GLTFLoader();
      loader.parse(arrayBuffer, '', (gltf) => {
        foundClips = (gltf.animations || []).map((a) => a.name);

        modelInspectInfo.innerHTML = `
          <strong>✓ Đã tìm thấy ${foundClips.length} Animation Clips:</strong><br/>
          <span style="opacity:0.85">${foundClips.slice(0, 8).join(', ')}${foundClips.length > 8 ? '...' : ''}</span>
        `;

        // Điền vào các dropdown mapping
        const mappingSelects = [
          { id: 'map-clip-idle', pattern: /idle/i },
          { id: 'map-clip-typing', pattern: /start|attack|tactical|victory/i },
          { id: 'map-clip-dragged', pattern: /pickup|formation/i },
          { id: 'map-clip-poke', pattern: /reaction|touch|cafe/i },
          { id: 'map-clip-salute', pattern: /start|victory|login/i },
          { id: 'map-clip-praise', pattern: /end|victory|gacha/i },
          { id: 'map-clip-shake', pattern: /pickup|reaction/i }
        ];

        mappingSelects.forEach(({ id, pattern }) => {
          const sel = document.getElementById(id);
          if (!sel) return;
          sel.innerHTML = '';
          let matched = false;
          foundClips.forEach((clip) => {
            const opt = document.createElement('option');
            opt.value = clip;
            opt.textContent = clip;
            if (!matched && pattern.test(clip)) {
              opt.selected = true;
              matched = true;
            }
            sel.appendChild(opt);
          });
        });

        clipMappingContainer.classList.remove('hidden');
        btnSaveCustomChar.removeAttribute('disabled');
        if (!customCharName.value) {
          customCharName.value = file.name.replace(/\.[^/.]+$/, '');
        }
      });
    } catch (err) {
      modelInspectInfo.textContent = 'Lỗi phân tích file 3D: ' + err.message;
    }
  });

  customVoiceFile?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadedVoiceBlobUrl = URL.createObjectURL(file);
    }
  });

  btnSaveCustomChar?.addEventListener('click', async () => {
    if (!uploadedModelBlobUrl || foundClips.length === 0) return;

    const charName = customCharName.value.trim() || 'Custom Mascot';
    const charId = 'custom_' + Date.now();

    const getVal = (id) => document.getElementById(id)?.value || foundClips[0];

    const newManifest = {
      id: charId,
      name: `${charName} (Custom 3D)`,
      type: '3d',
      customBlobUrl: uploadedModelBlobUrl,
      camera: { fov: 32, distance: 2.5, targetY: 0.5 },
      states: {
        idle: {
          clip: getVal('map-clip-idle'),
          loop: true,
          dialogues: [`Chào Sensei! Tôi là ${charName}. Rất vui được đồng hành cùng người!`]
        },
        typing: {
          clip: getVal('map-clip-typing'),
          loop: true,
          dialogues: [`Sensei gõ phím nhanh quá! Cố gắng lên nhé!`]
        },
        panic_shutdown: {
          clip: getVal('map-clip-dragged'),
          dialogues: [`Khoan đã Sensei, chưa kịp lưu dữ liệu mà!`]
        },
        dragged: {
          clip: getVal('map-clip-dragged'),
          dialogues: [`Oa... Sensei bế tôi đi đâu thế này!`]
        },
        poke: {
          clip: getVal('map-clip-poke'),
          dialogues: [`Sensei đừng chọc má tôi chứ nhột lắm!`]
        },
        salute: {
          clip: getVal('map-clip-salute'),
          dialogues: [`${charName} điểm danh! Chúc Sensei một ngày tuyệt vời!`]
        },
        praise: {
          clip: getVal('map-clip-praise'),
          dialogues: [`Cảm ơn Sensei đã khen ngợi! Tôi sẽ cố gắng hơn nữa! 💕`]
        },
        focus: {
          clip: getVal('map-clip-idle'),
          dialogues: [`Tập trung làm việc nào Sensei, tôi luôn ở đây cạnh người.`]
        },
        teatime: {
          clip: getVal('map-clip-poke'),
          dialogues: [`Nghỉ giải lao một chút uống trà thôi Sensei ơi!`]
        },
        shake: {
          clip: getVal('map-clip-shake'),
          dialogues: [`Oa oa! Chóng mặt quá rồi Sensei ơi, nhẹ tay thôi!`]
        }
      }
    };

    if (uploadedVoiceBlobUrl) {
      newManifest.states.idle.sound = uploadedVoiceBlobUrl;
      newManifest.states.poke.sound = uploadedVoiceBlobUrl;
      newManifest.states.salute.sound = uploadedVoiceBlobUrl;
    }

    customCharacters[charId] = {
      path: null,
      manifest: newManifest,
      defaultType: '3d',
      name: `✨ ${charName} (Custom)`
    };

    localStorage.setItem('anima_custom_characters', JSON.stringify(customCharacters));
    CHARACTER_CATALOG[charId] = customCharacters[charId];

    await loadCharacter(charId);
    toggleSettingsModal(false);
    showSpeech(`Đã nạp thành công nhân vật mới: ${charName}! ✨`);
  });
}

/**
 * Thiết lập sự kiện kéo thả chuột, lắc chuột và tương tác UI
 */
function setupMouseInteractions() {
  let dragStartTime = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lastShakeTime = 0;
  let shakeCounter = 0;

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
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      shakeCounter = 0;
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
      triggerAction('poke');
    }
  });

  // Double Click vào chibi -> Khen thưởng / Cưng chiều (Praise)
  chibiWrapper.addEventListener('dblclick', (e) => {
    e.preventDefault();
    triggerAction('praise');
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

  // Các nút hành động tương tác nhanh trong menu
  document.querySelectorAll('.action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      contextMenu.classList.add('hidden');
      triggerAction(btn.dataset.action);
    });
  });

  // Bật/Tắt âm thanh
  menuMute.addEventListener('click', () => {
    isMuted = !isMuted;
    menuMute.textContent = isMuted ? 'Bật âm thanh 🔈' : 'Tắt âm thanh 🔊';
    contextMenu.classList.add('hidden');
    showSpeech(isMuted ? 'Đã tắt âm thanh!' : 'Đã bật lại âm thanh!');
  });

  // Chọn nhân vật từ Menu ngữ cảnh
  document.querySelectorAll('.char-option').forEach((optionEl) => {
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

  // Xử lý xoay nhìn theo chuột & Nhận diện lắc chuột Webview fallback
  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      const speed = Math.sqrt(dx * dx + dy * dy);
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      const thresholdSpeed = appSettings.shakeSens === 'high' ? 28 : (appSettings.shakeSens === 'low' ? 55 : 38);
      if (speed > thresholdSpeed) {
        shakeCounter++;
        if (shakeCounter >= 3 && Date.now() - lastShakeTime > 3500) {
          lastShakeTime = Date.now();
          shakeCounter = 0;
          triggerAction('shake');
        }
      } else {
        shakeCounter = Math.max(0, shakeCounter - 0.4);
      }
    } else {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      shakeCounter = 0;
    }

    // Look-at chuột cục bộ (khi chuột trong cửa sổ)
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
 * Hành vi ngẫu nhiên khi nhàn rỗi (Ambient Idle Fidget)
 */
function startAmbientTimer() {
  if (ambientInterval) clearInterval(ambientInterval);

  const freq = appSettings?.ambientFreq ?? 30000;
  if (!freq || freq <= 0) return;

  ambientInterval = setInterval(() => {
    if (currentState === 'idle' && !isDragging && contextMenu.classList.contains('hidden') && settingsModal.classList.contains('hidden')) {
      const ambientChoices = ['focus', 'teatime', 'salute', 'poke'];
      const action = ambientChoices[Math.floor(Math.random() * ambientChoices.length)];
      triggerAction(action);
    }
  }, freq);
}

/**
 * Lắng nghe sự kiện cảm biến từ Rust backend
 */
async function setupTauriListeners() {
  try {
    // 0. Cảm biến rung lắc mạnh khi đang kéo thả (OS Native Hook)
    await listen('sensor:drag_shake', () => {
      logToBackend('[Sensor] Received sensor:drag_shake -> triggerAction("shake")');
      triggerAction('shake');
    });

    // 1. Cảm biến nhịp gõ phím toàn cục
    await listen('sensor:typing', () => {
      if (isDragging || currentState === 'panic_shutdown') return;

      if (typingTimeout) clearTimeout(typingTimeout);
      setState('typing');

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
          const mascotGlobalX = winPos.x + 160;
          const mascotGlobalY = winPos.y + 240;

          const dx = globalX - mascotGlobalX;
          const dy = globalY - mascotGlobalY;
          const angle = Math.atan2(dy, dx);
          const distance = Math.sqrt(dx * dx + dy * dy);
          renderer3d.updateMouseLook(angle, distance);
        } catch {}
      }
    });

    console.log('[Anima Engine] Tauri listeners registered successfully.');
  } catch (err) {
    console.warn('[Anima Engine] Error setting up Tauri listeners:', err);
  }
}

/**
 * Khởi chạy ứng dụng
 */
async function init() {
  logToBackend('[Init] Anima Engine starting...');
  await loadCharacter(currentCharacterId);
  setupMouseInteractions();
  setupSettingsAndStudio();
  await setupTauriListeners();
  startAmbientTimer();
  logToBackend(`[Init] Anima Engine started successfully with character: ${currentCharacterId}`);

  setTimeout(() => {
    showSpeech(`Chào Sensei! ${currentManifest?.name || 'Hina'} đã sẵn sàng đồng hành cùng người.`, 4000);
  }, 600);
}

init();
