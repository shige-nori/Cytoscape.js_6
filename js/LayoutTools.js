import { appContext } from './AppContext.js';

/**
 * LayoutTools - 03_Cytoscape.js と互換のレイアウト調整ツール
 */
export class LayoutTools {
    constructor() {
        this.panel = null;
        this.scaleSlider = null;
        this.rotateSlider = null;
        this.originalPositions = new Map();
        this.originalCenter = { x: 0, y: 0 };
        this.currentScale = 1;
        this.baseRotation = 0;
        this.currentRotation = 0;
        this.currentScaleAxis = 'width';
        
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.animationFrameId = null;
        this.pendingTransform = false;
    }

    initialize() {
        this.panel = document.getElementById('layout-tools-panel');
        this.scaleSlider = document.getElementById('scale-slider');
        this.rotateSlider = document.getElementById('rotate-slider');

        this.setupEventListeners();
        this.setupDraggable();

    }

    setupEventListeners() {
        if (this.scaleSlider) {
            this.scaleSlider.addEventListener('input', (e) => {
                this.handleScaleChange(parseFloat(e.target.value));
            });
        }

        if (this.rotateSlider) {
            this.rotateSlider.addEventListener('input', (e) => {
                this.handleRotateChange(parseFloat(e.target.value));
            });
        }

        // 数値入力との連動
        const scaleValueInput = document.getElementById('scale-value-input');
        if (scaleValueInput) {
            scaleValueInput.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value >= 0.125 && value <= 8) {
                    const logValue = Math.log2(value);
                    if (this.scaleSlider) this.scaleSlider.value = logValue;
                    this.currentScale = value;
                    this.scheduleTransform();
                }
            });
        }

        const rotateValueInput = document.getElementById('rotate-value-input');
        if (rotateValueInput) {
            rotateValueInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= -180 && value <= 180) {
                    if (this.rotateSlider) this.rotateSlider.value = value;
                    this.currentRotation = value;
                    this.scheduleTransform();
                }
            });
        }

        document.querySelectorAll('input[name="scale-axis"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handleScaleAxisChange(e.target.value));
        });

        // ネットワーク図の空白クリックでパネルを閉じる
        if (appContext.networkManager && appContext.networkManager.cy) {
            appContext.networkManager.cy.on('tap', (e) => {
                if (e.target === appContext.networkManager.cy && this.panel && this.panel.classList.contains('active')) {
                    this.closePanel();
                }
            });
        }
    }

    setupDraggable() {
        if (!this.panel) return;
        const header = this.panel.querySelector('.tools-panel-header');
        if (!header) return;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('tools-panel-close')) return;
            this.isDragging = true;
            const rect = this.panel.getBoundingClientRect();
            this.dragOffset.x = e.clientX - rect.left;
            this.dragOffset.y = e.clientY - rect.top;
            this.panel.style.transition = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;
            const maxX = window.innerWidth - this.panel.offsetWidth;
            const maxY = window.innerHeight - this.panel.offsetHeight;
            this.panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            this.panel.style.top = Math.max(40, Math.min(y, maxY)) + 'px';
            this.panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            if (this.panel) this.panel.style.transition = '';
        });
    }

    openPanel() {
        if (!this.panel) return;
        this.panel.classList.add('active');
        
        // パネルを開いた時：現在の変換を確定して値をリセット
        if (this.currentScale !== 1 || this.currentRotation !== 0) {
            // 現在のスケールと回転を適用して位置を確定（図の描画はそのまま）
            this.applyTransform();
        }
        
        // 現在の位置を新しい基準位置として保存
        this.storeOriginalPositions();
        
        this.currentScale = 1;
        this.currentRotation = 0;
        this.baseRotation = 0;
        
        if (this.scaleSlider) this.scaleSlider.value = 0;
        this.updateDisplay('scale', '1.00');
        
        if (this.rotateSlider) this.rotateSlider.value = 0;
        this.updateDisplay('rotate', '0');
    }

    closePanel() {
        if (!this.panel) return;
        this.panel.classList.remove('active');
        // パネルを閉じても設定値は維持（リセットしない）
    }

    storeOriginalPositions() {
        this.originalPositions.clear();
        if (!appContext.networkManager || !appContext.networkManager.cy) return;
        const nodes = appContext.networkManager.cy.nodes();
        nodes.forEach(node => {
            const pos = node.position();
            this.originalPositions.set(node.id(), { x: pos.x, y: pos.y });
        });
        if (nodes.length > 0) {
            const bb = nodes.boundingBox();
            this.originalCenter = { x: (bb.x1 + bb.x2) / 2, y: (bb.y1 + bb.y2) / 2 };
        }
    }

    updateDisplay(type, value) {
        const elementId = type === 'scale' ? 'scale-value' : 'rotate-value';
        const inputId = type === 'scale' ? 'scale-value-input' : 'rotate-value-input';
        const element = document.getElementById(elementId) || document.getElementById(inputId);
        if (element) {
            if ('value' in element) element.value = value;
            else element.textContent = value;
        }
    }

    resetOriginalPositions() {
        this.originalPositions.clear();
    }

    handleScaleAxisChange(axis) {
        // 現在のスケールと回転をすべて適用して確定
        if (this.currentScale !== 1 || this.currentRotation !== 0) {
            this.applyTransform();
        }
        
        // スケール軸を変更
        this.currentScaleAxis = axis;
        
        // 現在の位置を新しい基準位置として保存
        this.storeOriginalPositions();
        
        this.currentScale = 1;
        this.currentRotation = 0;
        this.baseRotation = 0;
        
        if (this.scaleSlider) this.scaleSlider.value = 0;
        this.updateDisplay('scale', '1.00');
        
        if (this.rotateSlider) this.rotateSlider.value = 0;
        this.updateDisplay('rotate', '0');
    }

    handleScaleChange(logValue) {
        // Scale操作時：現在の回転を確定してリセット
        if (this.currentRotation !== 0) {
            // 現在のスケールと回転を適用して位置を確定
            this.applyTransform();
            
            // 確定した位置（スケール+回転済み）を新しいoriginalPositionsとして保存
            this.storeOriginalPositions();
            
            // 回転をリセット
            this.baseRotation = 0;
            this.currentRotation = 0;
            
            if (this.rotateSlider) this.rotateSlider.value = 0;
            this.updateDisplay('rotate', '0');
            
            this.currentScale = 1;
        }
        
        const scale = Math.pow(2, logValue);
        this.updateDisplay('scale', scale.toFixed(2));
        this.currentScale = scale;
        this.scheduleTransform();
    }

    handleRotateChange(angle) {
        // Rotate操作時：現在のスケールを確定してリセット
        if (this.currentScale !== 1) {
            // 現在のスケールと回転を適用して位置を確定
            this.applyTransform();
            
            // 確定した位置（スケール+回転済み）を新しいoriginalPositionsとして保存
            this.storeOriginalPositions();
            
            this.baseRotation = 0;
            this.currentScale = 1;
            
            if (this.scaleSlider) this.scaleSlider.value = 0;
            this.updateDisplay('scale', '1.00');
        }
        
        this.updateDisplay('rotate', Math.round(angle).toString());
        this.currentRotation = angle;
        this.scheduleTransform();
    }

    scheduleTransform() {
        if (this.pendingTransform) return;
        this.pendingTransform = true;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        this.animationFrameId = requestAnimationFrame(() => {
            this.applyTransform();
            this.pendingTransform = false;
            this.animationFrameId = null;
        });
    }

    applyTransform() {
        if (!appContext.networkManager || !appContext.networkManager.cy) return;
        const nodes = appContext.networkManager.cy.nodes();
        if (nodes.length === 0) return;
        
        appContext.networkManager.cy.batch(() => {
            const centerX = this.originalCenter.x;
            const centerY = this.originalCenter.y;
            const scale = this.currentScale;
            const totalRotation = this.baseRotation + this.currentRotation;
            const angleRadians = (totalRotation * Math.PI) / 180;
            
            let scaleX = 1, scaleY = 1;
            if (this.currentScaleAxis === 'width') {
                scaleX = scale;
            } else if (this.currentScaleAxis === 'height') {
                scaleY = scale;
            }
            
            nodes.forEach(node => {
                const originalPos = this.originalPositions.get(node.id());
                if (!originalPos) return;
                
                let dx = originalPos.x - centerX;
                let dy = originalPos.y - centerY;
                
                dx = dx * scaleX;
                dy = dy * scaleY;
                
                if (totalRotation !== 0) {
                    const rotatedX = dx * Math.cos(angleRadians) - dy * Math.sin(angleRadians);
                    const rotatedY = dx * Math.sin(angleRadians) + dy * Math.cos(angleRadians);
                    dx = rotatedX;
                    dy = rotatedY;
                }
                
                node.position({ x: centerX + dx, y: centerY + dy });
            });
        });
    }
}

// グローバルインスタンスは app.js で生成
