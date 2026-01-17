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
        this.currentScale = 1;          // スライダーで操作中のスケール（追加分）
        this.baseScale = 1;             // 確定済みスケール（累積分）
        this.currentScaleAxis = 'width'; // 'width' or 'height'
        this.currentRotation = 0;       // スライダーで操作中の回転（追加分）
        this.baseRotation = 0;          // 確定済み回転（累積分）
        
        // Width/Height別の保存値
        this.widthScale = 1;
        this.widthBaseScale = 1;
        this.widthRotation = 0;
        this.widthBaseRotation = 0;
        this.heightScale = 1;
        this.heightBaseScale = 1;
        this.heightRotation = 0;
        this.heightBaseRotation = 0;
        
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
        
        // パネルを開いた時：現在の変換を確定して値をリセット
        if (this.currentScale !== 1 || this.currentRotation !== 0) {
            // 現在のスケールと回転を適用して位置を確定（図の描画はそのまま）
            this.applyTransform();
        }
        
        // 現在の位置を新しい基準位置として保存
        this.storeOriginalPositions();
        
        // すべての値をリセット
        this.currentScale = 1;
        this.baseScale = 1;
        this.widthScale = 1;
        this.widthBaseScale = 1;
        this.heightScale = 1;
        this.heightBaseScale = 1;
        this.currentRotation = 0;
        this.baseRotation = 0;
        this.widthRotation = 0;
        this.widthBaseRotation = 0;
        this.heightRotation = 0;
        this.heightBaseRotation = 0;
        
        // UIを更新
        if (this.scaleSlider) this.scaleSlider.value = 0;
        const scaleValueEl = document.getElementById('scale-value') || document.getElementById('scale-value-input');
        if (scaleValueEl) {
            if ('value' in scaleValueEl) scaleValueEl.value = '1.00';
            else scaleValueEl.textContent = '1.00';
        }
        
        if (this.rotateSlider) this.rotateSlider.value = 0;
        const rotateValueEl = document.getElementById('rotate-value') || document.getElementById('rotate-value-input');
        if (rotateValueEl) {
            if ('value' in rotateValueEl) rotateValueEl.value = '0';
            else rotateValueEl.textContent = '0';
        }
    }

    closePanel() {
        if (!this.panel) return;
        this.panel.classList.remove('active');
        // パネルを閉じても設定値は維持（リセットしない）
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
        
        // 現在の位置を新しい基準位置として保存
        this.storeOriginalPositions();
        
        // HeightとWidthの値を両方とも1にリセット
        this.currentScale = 1;
        this.baseScale = 1;
        this.widthScale = 1;
        this.widthBaseScale = 1;
        this.heightScale = 1;
        this.heightBaseScale = 1;
        
        // Rotateを0°にリセット
        this.currentRotation = 0;
        this.baseRotation = 0;
        this.widthRotation = 0;
        this.widthBaseRotation = 0;
        this.heightRotation = 0;
        this.heightBaseRotation = 0;
        
        // UIを更新（全て初期値）
        if (this.scaleSlider) this.scaleSlider.value = 0;
        const scaleValueEl = document.getElementById('scale-value') || document.getElementById('scale-value-input');
        if (scaleValueEl) {
            if ('value' in scaleValueEl) scaleValueEl.value = '1.00';
            else scaleValueEl.textContent = '1.00';
        }
        
        if (this.rotateSlider) this.rotateSlider.value = 0;
        const rotateValueEl = document.getElementById('rotate-value') || document.getElementById('rotate-value-input');
        if (rotateValueEl) {
            if ('value' in rotateValueEl) rotateValueEl.value = '0';
            else rotateValueEl.textContent = '0';
        }
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
            
            // RotateのUIを0°に更新
            if (this.rotateSlider) this.rotateSlider.value = 0;
            const rotateValueEl = document.getElementById('rotate-value') || document.getElementById('rotate-value-input');
            if (rotateValueEl) {
                if ('value' in rotateValueEl) rotateValueEl.value = '0';
                else rotateValueEl.textContent = '0';
            }
            
            // スケールもリセット
            this.currentScale = 1;
            this.baseScale = 1;
        }
        
        const scale = Math.pow(2, logValue);
        const scaleValueEl = document.getElementById('scale-value') || document.getElementById('scale-value-input');
        if (scaleValueEl) { if ('value' in scaleValueEl) scaleValueEl.value = scale.toFixed(2); else scaleValueEl.textContent = scale.toFixed(2); }
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
            
            // 回転はすべて確定したのでbaseRotationを0にリセット
            this.baseRotation = 0;
            
            // HeightとWidthの値を両方とも1にリセット
            this.currentScale = 1;
            this.baseScale = 1;
            if (this.currentScaleAxis === 'width') {
                this.widthScale = 1;
                this.widthBaseScale = 1;
            } else if (this.currentScaleAxis === 'height') {
                this.heightScale = 1;
                this.heightBaseScale = 1;
            }
            
            // スケールUIを更新
            if (this.scaleSlider) this.scaleSlider.value = 0;
            const scaleValueEl = document.getElementById('scale-value') || document.getElementById('scale-value-input');
            if (scaleValueEl) {
                if ('value' in scaleValueEl) scaleValueEl.value = '1.00';
                else scaleValueEl.textContent = '1.00';
            }
        }
        
        // Rotate値を更新
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
        const nodes = networkManager.cy.nodes();
        if (nodes.length === 0) return;
        
        // バッチ更新を使用してパフォーマンスを向上
        networkManager.cy.batch(() => {
            // 基準となる中心（軸変更時に保存された中心）
            const centerX = this.originalCenter.x;
            const centerY = this.originalCenter.y;
            
            // 現在のスケール（currentScaleのみ、baseScaleは既にoriginalPositionsに反映済み）
            const scale = this.currentScale;
            
            // 合計回転：baseRotation（確定済み） + currentRotation（追加分）
            const totalRotation = this.baseRotation + this.currentRotation;
            const angleRadians = (totalRotation * Math.PI) / 180;
            
            // 常に画面基準（キャンバス座標系）でスケール
            // Width = X軸（水平方向）、Height = Y軸（垂直方向）
            let scaleX = 1, scaleY = 1;
            if (this.currentScaleAxis === 'width') {
                scaleX = scale; // Width は常に水平方向
            } else if (this.currentScaleAxis === 'height') {
                scaleY = scale; // Height は常に垂直方向
            }
            
            nodes.forEach(node => {
                const originalPos = this.originalPositions.get(node.id());
                if (!originalPos) return;
                
                // 元の基準位置（軸変更時の位置、既に確定済み変換が適用されている）から中心への相対位置
                let dx = originalPos.x - centerX;
                let dy = originalPos.y - centerY;
                
                // 1. 画面基準（X/Y軸）でスケールを適用
                dx = dx * scaleX;
                dy = dy * scaleY;
                
                // 2. 合計回転を適用（baseRotation + currentRotation）
                if (totalRotation !== 0) {
                    const rotatedX = dx * Math.cos(angleRadians) - dy * Math.sin(angleRadians);
                    const rotatedY = dx * Math.sin(angleRadians) + dy * Math.cos(angleRadians);
                    dx = rotatedX;
                    dy = rotatedY;
                }
                
                // 3. 中心座標に戻す
                const newX = centerX + dx;
                const newY = centerY + dy;
                node.position({ x: newX, y: newY });
            });
        });
    }
}

// グローバルインスタンスは app.js で生成
