/**
 * src/renderer3d.js
 * Bộ dựng hình 3D Three.js cho Mascot Chibi (GLB/GLTF)
 * Hỗ trợ nền trong suốt 100%, ánh sáng Anime Cel-Shaded, chuyển đổi Animation mượt mà và xoay nhìn theo chuột.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ThreeMascotRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.loader = new GLTFLoader();
    this.mixer = null;
    this.actions = new Map();
    this.currentAction = null;
    this.currentModel = null;
    this.clock = new THREE.Clock();
    this.animationFrameId = null;

    // Tương tác chuột (Look-at cursor)
    this.targetRotationY = 0;
    this.targetRotationX = 0;
    this.currentRotationY = 0;
    this.currentRotationX = 0;

    this.init();
  }

  init() {
    const width = this.canvas.clientWidth || 320;
    const height = this.canvas.clientHeight || 350;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera (FOV 35 độ tạo góc nhìn thoáng đãng, không bị cấn đạo cụ)
    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);
    this.camera.position.set(0, 0.45, 3.0);
    this.camera.lookAt(0, 0.45, 0);

    // 3. Renderer (Nền trong suốt, tương thích Webview2)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power' // Tiết kiệm pin và GPU
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    // 4. Ánh sáng phong cách Anime (Sáng đều, màu sắc tươi tắn)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.keyLight.position.set(1.5, 3, 2);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xffeedd, 0.4);
    this.fillLight.position.set(-1.5, 1, 1);
    this.scene.add(this.fillLight);

    // 5. Tự động thích ứng kích thước Canvas (Responsive Window Resize)
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    // 6. Bắt đầu Render loop
    this.animate = this.animate.bind(this);
    this.animate();
  }

  /**
   * Tự động điều chỉnh tỷ lệ khung hình khi kích thước Canvas / Cửa sổ thay đổi
   */
  handleResize() {
    if (!this.canvas || !this.renderer || !this.camera) return;
    const width = this.canvas.clientWidth || 320;
    const height = this.canvas.clientHeight || 350;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Tinh chỉnh ánh sáng thời gian thực
   */
  setLighting({ ambientIntensity = null, keyIntensity = null, tintColor = null }) {
    if (ambientIntensity !== null && this.ambientLight) {
      this.ambientLight.intensity = Number(ambientIntensity);
    }
    if (keyIntensity !== null && this.keyLight) {
      this.keyLight.intensity = Number(keyIntensity);
    }
    if (tintColor && this.ambientLight) {
      this.ambientLight.color.set(tintColor);
    }
  }

  /**
   * Tinh chỉnh Camera / Zoom khoảng cách
   */
  setCameraZoom(distance, targetY = null) {
    if (!this.camera) return;
    if (distance) this.camera.position.z = Number(distance);
    if (targetY !== null) {
      this.camera.position.y = Number(targetY);
      this.camera.lookAt(0, Number(targetY), 0);
    }
    this.camera.updateProjectionMatrix();
  }

  /**
   * Tinh chỉnh chất lượng hiển thị
   */
  setQuality(quality) {
    if (!this.renderer) return;
    if (quality === 'ultra') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }
  }

  /**
   * Tải mô hình .glb và căn chỉnh kích thước, vị trí tự động
   */
  async loadModel(url, cameraConfig = null, onReady = null) {
    // Dọn dẹp model cũ nếu có
    this.unloadCurrentModel();

    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          this.currentModel = gltf.scene;

          // Căn chỉnh trục và tâm (Bounding Box)
          const box = new THREE.Box3().setFromObject(this.currentModel);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          // Đưa nhân vật về chính giữa trục X/Z và đặt chân chạm sàn (Y = 0)
          this.currentModel.position.x = -center.x;
          this.currentModel.position.z = -center.z;
          this.currentModel.position.y = -box.min.y;

          // Vô hiệu hóa Frustum Culling để tránh Three.js cắt mất mesh khi xương/đạo cụ vươn rộng
          this.currentModel.traverse((child) => {
            if (child.isMesh || child.isSkinnedMesh) {
              child.frustumCulled = false;
            }
          });

          this.scene.add(this.currentModel);

          // Căn chỉnh Camera theo cấu hình hoặc kích thước tự động với lề an toàn (Safe Margin)
          const targetY = cameraConfig?.targetY ?? (size.y * 0.46);
          const distance = cameraConfig?.distance ?? Math.max(size.y * 2.3, 2.9);
          const fov = cameraConfig?.fov ?? 35;

          this.camera.fov = fov;
          this.camera.position.set(0, targetY, distance);
          this.camera.lookAt(0, targetY, 0);
          this.camera.updateProjectionMatrix();

          // Thiết lập Animation Mixer
          if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.currentModel);
            this.actions.clear();

            for (const clip of gltf.animations) {
              const action = this.mixer.clipAction(clip);
              this.actions.set(clip.name, action);
            }
          }

          if (onReady) onReady();
          resolve(gltf);
        },
        undefined,
        (error) => {
          console.error('[ThreeMascotRenderer] Lỗi nạp GLB:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Phát hoạt ảnh theo tên clip với hiệu ứng chuyển cảnh mượt (cross-fade)
   */
  playAnimation(clipName, loop = true, fadeDuration = 0.25) {
    if (!this.mixer || !clipName) return;

    const nextAction = this.actions.get(clipName);
    if (!nextAction) {
      console.warn(`[ThreeMascotRenderer] Không tìm thấy animation clip: "${clipName}"`);
      return;
    }

    if (this.currentAction === nextAction && nextAction.isRunning()) {
      return;
    }

    nextAction.reset();
    nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
    nextAction.clampWhenFinished = !loop;

    if (this.currentAction) {
      this.currentAction.fadeOut(fadeDuration);
      nextAction.fadeIn(fadeDuration);
    }

    nextAction.play();
    this.currentAction = nextAction;
  }

  /**
   * Phát hoạt ảnh một lần (One-shot) rồi tự động quay lại clip trước đó hoặc idle
   */
  playOneShot(clipName, returnClip = 'Cafe_Idle', duration = 3500, fadeDuration = 0.25) {
    if (!this.mixer || !clipName) return;

    if (this.oneShotTimeout) {
      clearTimeout(this.oneShotTimeout);
      this.oneShotTimeout = null;
    }

    this.playAnimation(clipName, false, fadeDuration);

    this.oneShotTimeout = setTimeout(() => {
      this.playAnimation(returnClip, true, fadeDuration);
      this.oneShotTimeout = null;
    }, duration);
  }

  /**
   * Phản xạ hướng đầu / cơ thể nhìn theo tọa độ con trỏ chuột
   * angle: radian (-PI đến PI), distance: khoảng cách px
   */
  updateMouseLook(angle, distance) {
    if (!this.currentModel) return;

    // Giới hạn góc xoay tối đa khoảng +/- 20 độ để tự nhiên
    const maxAngle = 0.35;
    const factor = Math.min(distance / 200, 1.0);

    // Tính toán góc xoay quanh trục Y (quay trái/phải) và X (ngước lên/cúi xuống)
    this.targetRotationY = Math.cos(angle) * maxAngle * factor;
    this.targetRotationX = -Math.sin(angle) * (maxAngle * 0.5) * factor;
  }

  /**
   * Vòng lặp render liên tục 60 FPS
   */
  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();

    // 1. Cập nhật Animation Mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // 2. Nội suy mượt mà chuyển động xoay nhìn theo chuột (Smooth Dampening)
    if (this.currentModel) {
      this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.1;
      this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.1;

      this.currentModel.rotation.y = this.currentRotationY;
      this.currentModel.rotation.x = this.currentRotationX;
    }

    // 3. Render khung hình
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  unloadCurrentModel() {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.actions.clear();

    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
      this.currentModel = null;
    }

    this.targetRotationY = 0;
    this.targetRotationX = 0;
    this.currentRotationY = 0;
    this.currentRotationX = 0;
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.unloadCurrentModel();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
