/**
 * LayoutTools - 03_Cytoscape.js と互換のレイアウト調整ツール
 */
class LayoutTools {
    constructor() {
        this.panel = null;
        this.scaleSlider = null;
        this.rotateSlider = null;
        this.originalPositions = new Map();
        this.originalCenter = { x: 0, y: 0 };
        this.currentScale = 1;
        this.currentScaleAxis = 'width'; // 'width', 'height', 'selected'
        this.currentRotation = 0;
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

        // 互換性のためグローバルに登録
        window.layoutTools = this;
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
        if (networkManager && networkManager.cy) {
            networkManager.cy.on('tap', (e) => {
                if (e.target === networkManager.cy && this.panel && this.panel.classList.contains('active')) {
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
        // 基準位置が未設定の場合のみ保存（パネルを閉じて再度開いたときは保存しない）
        if (this.originalPositions.size === 0) {
            this.storeOriginalPositions();
        }
        // 既存の値を維持するため、resetSlidersは呼ばない
    }

    closePanel() {
        if (!this.panel) return;
        this.panel.classList.remove('active');
        // パネルを閉じても設定値は維持（リセットしない）
    }

    resetSliders() {
        if (this.scaleSlider) this.scaleSlider.value = 0;
        if (this.rotateSlider) this.rotateSlider.value = 0;
        this.currentScale = 1;
        this.currentRotation = 0;
        // 表示用要素があれば更新
        const scaleValueEl = document.getElementById('scale-value') || document.getElementById('scale-value-input');
        const rotateValueEl = document.getElementById('rotate-value') || document.getElementById('rotate-value-input');
        if (scaleValueEl) {
            if ('value' in scaleValueEl) scaleValueEl.value = '1.00'; else scaleValueEl.textContent = '1.00';
        }
        if (rotateValueEl) {
            if ('value' in rotateValueEl) rotateValueEl.value = '0'; else rotateValueEl.textContent = '0';
        }
        // Width を既定に
        const widthRadio = document.getElementById('scale-width'); if (widthRadio) widthRadio.checked = true;
        this.currentScaleAxis = 'width';
    }

    storeOriginalPositions() {
        this.originalPositions.clear();
        if (!networkManager || !networkManager.cy) return;
        const nodes = networkManager.cy.nodes();
        nodes.forEach(node => {
            const pos = node.position();
            this.originalPositions.set(node.id(), { x: pos.x, y: pos.y });
        });
        if (nodes.length > 0) {
            const bb = nodes.boundingBox();
            this.originalCenter = { x: (bb.x1 + bb.x2) / 2, y: (bb.y1 + bb.y2) / 2 };
        }
    }

    resetOriginalPositions() {
        // 基準位置をクリアして、次回パネルを開いたときに新しい位置を保存する
        this.originalPositions.clear();
    }

    handleScaleAxisChange(axis) {
        // 現在のスケールと回転をすべて適用して確定
        if (this.currentScale !== 1 || this.currentRotation !== 0) {
            this.applyTransform();
        }
        
        // スケール軸を変更
        this.currentScaleAxis = axis;
        
        // 現在の位置を新しい基準位置として保存（変換後の位置が新しい基準になる）
        this.storeOriginalPositions();
        
        // スケール値をリセット
        this.currentScale = 1;
        if (this.scaleSlider) this.scaleSlider.value = 0;
        const scaleValueEl = document.getElementById('scale-value') || document.getElementById('scale-value-input');
        if (scaleValueEl) { if ('value' in scaleValueEl) scaleValueEl.value = '1.00'; else scaleValueEl.textContent = '1.00'; }
        
        // 回転値を0°にリセット
        this.currentRotation = 0;
        if (this.rotateSlider) this.rotateSlider.value = 0;
        const rotateValueEl = document.getElementById('rotate-value') || document.getElementById('rotate-value-input');
        if (rotateValueEl) { if ('value' in rotateValueEl) rotateValueEl.value = '0'; else rotateValueEl.textContent = '0'; }
    }

    handleScaleChange(logValue) {
        const scale = Math.pow(2, logValue);
        const scaleValueEl = document.getElementById('scale-value') || document.getElementById('scale-value-input');
        if (scaleValueEl) { if ('value' in scaleValueEl) scaleValueEl.value = scale.toFixed(2); else scaleValueEl.textContent = scale.toFixed(2); }
        this.currentScale = scale;
        this.scheduleTransform();
    }

    handleRotateChange(angle) {
        const rotateValueEl = document.getElementById('rotate-value') || document.getElementById('rotate-value-input');
        if (rotateValueEl) { if ('value' in rotateValueEl) rotateValueEl.value = Math.round(angle).toString(); else rotateValueEl.textContent = Math.round(angle).toString(); }
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
        if (!networkManager || !networkManager.cy) return;
        const isSelectedOnly = this.currentScaleAxis === 'selected';
        const nodes = isSelectedOnly ? networkManager.cy.nodes(':selected') : networkManager.cy.nodes();
        if (nodes.length === 0) return;
        
        // バッチ更新を使用してパフォーマンスを向上
        networkManager.cy.batch(() => {
            const centerX = this.originalCenter.x;
            const centerY = this.originalCenter.y;
            const angleRadians = (this.currentRotation * Math.PI) / 180;
            
            // 回転角度に応じてWidth/Heightを逆転
            // 45°～135° または -135°～-45° の範囲で逆転
            const normalizedAngle = ((this.currentRotation % 360) + 360) % 360; // 0-360の範囲に正規化
            const shouldSwap = (normalizedAngle > 45 && normalizedAngle < 135) || 
                              (normalizedAngle > 225 && normalizedAngle < 315);
            
            let scaleX = 1, scaleY = 1;
            switch (this.currentScaleAxis) {
                case 'width': 
                    if (shouldSwap) {
                        scaleY = this.currentScale; // 逆転：Widthが縦方向に作用
                    } else {
                        scaleX = this.currentScale; // 通常：Widthが横方向に作用
                    }
                    break;
                case 'height': 
                    if (shouldSwap) {
                        scaleX = this.currentScale; // 逆転：Heightが横方向に作用
                    } else {
                        scaleY = this.currentScale; // 通常：Heightが縦方向に作用
                    }
                    break;
                case 'selected': 
                    scaleX = this.currentScale; 
                    scaleY = this.currentScale; 
                    break;
            }
            
            nodes.forEach(node => {
                const originalPos = this.originalPositions.get(node.id());
                if (!originalPos) return;
                let dx = originalPos.x - centerX;
                let dy = originalPos.y - centerY;
                dx = dx * scaleX; dy = dy * scaleY;
                const rotatedX = dx * Math.cos(angleRadians) - dy * Math.sin(angleRadians);
                const rotatedY = dx * Math.sin(angleRadians) + dy * Math.cos(angleRadians);
                const newX = centerX + rotatedX;
                const newY = centerY + rotatedY;
                node.position({ x: newX, y: newY });
            });
        });
    }

    applyScaleOnly() {
        // スケールのみを適用（回転は適用しない）
        if (!networkManager || !networkManager.cy) return;
        const isSelectedOnly = this.currentScaleAxis === 'selected';
        const nodes = isSelectedOnly ? networkManager.cy.nodes(':selected') : networkManager.cy.nodes();
        if (nodes.length === 0) return;
        
        networkManager.cy.batch(() => {
            const centerX = this.originalCenter.x;
            const centerY = this.originalCenter.y;
            let scaleX = 1, scaleY = 1;
            switch (this.currentScaleAxis) {
                case 'width': scaleX = this.currentScale; break;
                case 'height': scaleY = this.currentScale; break;
                case 'selected': scaleX = this.currentScale; scaleY = this.currentScale; break;
            }
            
            nodes.forEach(node => {
                const originalPos = this.originalPositions.get(node.id());
                if (!originalPos) return;
                let dx = originalPos.x - centerX;
                let dy = originalPos.y - centerY;
                // スケールのみ適用（回転は適用しない）
                const newX = centerX + dx * scaleX;
                const newY = centerY + dy * scaleY;
                node.position({ x: newX, y: newY });
            });
        });
    }

    applyCurrentTransform() {
        this.storeOriginalPositions();
        this.resetSliders();
    }

    equalizeLayout() {
        // delegate to layoutManager's equal implementation
        if (typeof layoutManager !== 'undefined' && layoutManager && layoutManager.applyEqualLayout) {
            layoutManager.applyEqualLayout();
        }
    }
}

// グローバルインスタンスは app.js で生成
