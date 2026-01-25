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
        this.setupTabs();
        this.setupAlignDistribute();
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

        const closeBtn = document.getElementById('layout-tools-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanel());
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
            const closeBtn = document.getElementById('layout-tools-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closePanel());
            }
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

    /**
     * タブ切り替えのセットアップ
     */
    setupTabs() {
        const tabs = document.querySelectorAll('.tools-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                
                // タブのアクティブ状態を切り替え
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                // コンテンツの表示を切り替え
                document.querySelectorAll('.tools-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(targetTab + '-tab').classList.add('active');
            });
        });
    }

    /**
     * Align/Distribute機能のセットアップ
     */
    setupAlignDistribute() {
        // Align buttons
        document.getElementById('align-left')?.addEventListener('click', () => this.alignElements('left'));
        document.getElementById('align-center-h')?.addEventListener('click', () => this.alignElements('center-h'));
        document.getElementById('align-right')?.addEventListener('click', () => this.alignElements('right'));
        document.getElementById('align-top')?.addEventListener('click', () => this.alignElements('top'));
        document.getElementById('align-center-v')?.addEventListener('click', () => this.alignElements('center-v'));
        document.getElementById('align-bottom')?.addEventListener('click', () => this.alignElements('bottom'));

        // Distribute buttons
        document.getElementById('distribute-h')?.addEventListener('click', () => this.distributeElements('horizontal'));
        document.getElementById('distribute-v')?.addEventListener('click', () => this.distributeElements('vertical'));

        // Stack buttons
        document.getElementById('stack-v')?.addEventListener('click', () => this.stackElements('vertical'));
        document.getElementById('stack-h')?.addEventListener('click', () => this.stackElements('horizontal'));
    }

    /**
     * 選択中のノードとオーバーレイ図形を取得
     */
    getSelectedElements() {
        const elements = [];
        
        // Cytoscapeノードを取得
        if (appContext.networkManager && appContext.networkManager.cy) {
            const selectedNodes = appContext.networkManager.cy.nodes(':selected');
            selectedNodes.forEach(node => {
                const pos = node.position();
                elements.push({
                    type: 'node',
                    element: node,
                    x: pos.x,
                    y: pos.y,
                    width: node.width(),
                    height: node.height()
                });
            });
        }
        
        // オーバーレイ図形を取得（複数選択対応）
        if (appContext.layerManager) {
            const selectedLayers = appContext.layerManager.selectedLayers?.length
                ? appContext.layerManager.selectedLayers
                : (appContext.layerManager.selectedLayer ? [appContext.layerManager.selectedLayer] : []);

            selectedLayers.forEach(layer => {
                if (!layer) return;
                // ライン/矢印は除外（位置の概念が異なるため）
                if (layer.type !== 'line' && layer.type !== 'arrow') {
                    elements.push({
                        type: 'overlay',
                        element: layer,
                        x: layer.x,
                        y: layer.y,
                        width: layer.width || 100,
                        height: layer.height || 80
                    });
                }
            });
        }
        
        return elements;
    }

    /**
     * 要素を整列
     */
    alignElements(direction) {
        const elements = this.getSelectedElements();
        if (elements.length < 2) {
            alert('Please select at least 2 nodes or shapes to align.');
            return;
        }

        let targetValue;
        
        switch (direction) {
            case 'left':
                targetValue = Math.min(...elements.map(el => el.x - el.width / 2));
                elements.forEach(el => {
                    if (el.type === 'node') {
                        el.element.position({ x: targetValue + el.width / 2, y: el.element.position().y });
                    } else {
                        el.element.x = targetValue;
                        appContext.layerManager.renderObject(el.element);
                    }
                });
                break;
                
            case 'center-h':
                const avgX = elements.reduce((sum, el) => sum + el.x, 0) / elements.length;
                elements.forEach(el => {
                    if (el.type === 'node') {
                        el.element.position({ x: avgX, y: el.element.position().y });
                    } else {
                        el.element.x = avgX;
                        appContext.layerManager.renderObject(el.element);
                    }
                });
                break;
                
            case 'right':
                targetValue = Math.max(...elements.map(el => el.x + el.width / 2));
                elements.forEach(el => {
                    if (el.type === 'node') {
                        el.element.position({ x: targetValue - el.width / 2, y: el.element.position().y });
                    } else {
                        el.element.x = targetValue - el.width;
                        appContext.layerManager.renderObject(el.element);
                    }
                });
                break;
                
            case 'top':
                targetValue = Math.min(...elements.map(el => el.y - el.height / 2));
                elements.forEach(el => {
                    if (el.type === 'node') {
                        el.element.position({ x: el.element.position().x, y: targetValue + el.height / 2 });
                    } else {
                        el.element.y = targetValue;
                        appContext.layerManager.renderObject(el.element);
                    }
                });
                break;
                
            case 'center-v':
                const avgY = elements.reduce((sum, el) => sum + el.y, 0) / elements.length;
                elements.forEach(el => {
                    if (el.type === 'node') {
                        el.element.position({ x: el.element.position().x, y: avgY });
                    } else {
                        el.element.y = avgY;
                        appContext.layerManager.renderObject(el.element);
                    }
                });
                break;
                
            case 'bottom':
                targetValue = Math.max(...elements.map(el => el.y + el.height / 2));
                elements.forEach(el => {
                    if (el.type === 'node') {
                        el.element.position({ x: el.element.position().x, y: targetValue - el.height / 2 });
                    } else {
                        el.element.y = targetValue - el.height;
                        appContext.layerManager.renderObject(el.element);
                    }
                });
                break;
        }
        
        if (appContext.layerManager && appContext.layerManager.selectedLayer) {
            appContext.layerManager.selectObject(appContext.layerManager.selectedLayer);
        }
    }

    /**
     * 要素を等間隔に配置
     */
    distributeElements(direction) {
        const elements = this.getSelectedElements();
        if (elements.length < 3) {
            alert('Please select at least 3 nodes or shapes to distribute.');
            return;
        }

        if (direction === 'horizontal') {
            // X座標でソート
            elements.sort((a, b) => a.x - b.x);
            const first = elements[0];
            const last = elements[elements.length - 1];
            const totalSpace = (last.x + last.width / 2) - (first.x - first.width / 2);
            const spacing = totalSpace / (elements.length - 1);
            
            elements.forEach((el, index) => {
                if (index === 0 || index === elements.length - 1) return; // 両端は固定
                const targetX = (first.x - first.width / 2) + (spacing * index);
                
                if (el.type === 'node') {
                    el.element.position({ x: targetX, y: el.element.position().y });
                } else {
                    el.element.x = targetX;
                    appContext.layerManager.renderObject(el.element);
                }
            });
        } else {
            // Y座標でソート
            elements.sort((a, b) => a.y - b.y);
            const first = elements[0];
            const last = elements[elements.length - 1];
            const totalSpace = (last.y + last.height / 2) - (first.y - first.height / 2);
            const spacing = totalSpace / (elements.length - 1);
            
            elements.forEach((el, index) => {
                if (index === 0 || index === elements.length - 1) return; // 両端は固定
                const targetY = (first.y - first.height / 2) + (spacing * index);
                
                if (el.type === 'node') {
                    el.element.position({ x: el.element.position().x, y: targetY });
                } else {
                    el.element.y = targetY;
                    appContext.layerManager.renderObject(el.element);
                }
            });
        }
        
        if (appContext.layerManager && appContext.layerManager.selectedLayer) {
            appContext.layerManager.selectObject(appContext.layerManager.selectedLayer);
        }
    }

    /**
     * 要素を隙間なく並べる
     */
    stackElements(direction) {
        const elements = this.getSelectedElements();
        if (elements.length < 2) {
            alert('Please select at least 2 nodes or shapes to stack.');
            return;
        }

        const spacing = 5; // 要素間のスペース（ピクセル）

        if (direction === 'vertical') {
            // Y座標でソート
            elements.sort((a, b) => a.y - b.y);
            let currentY = elements[0].y;
            
            elements.forEach((el, index) => {
                if (index === 0) {
                    currentY = el.y + el.height;
                    return;
                }
                
                if (el.type === 'node') {
                    el.element.position({ x: el.element.position().x, y: currentY + el.height / 2 });
                    currentY += el.height + spacing;
                } else {
                    el.element.y = currentY;
                    appContext.layerManager.renderObject(el.element);
                    currentY += el.height + spacing;
                }
            });
        } else {
            // X座標でソート
            elements.sort((a, b) => a.x - b.x);
            let currentX = elements[0].x;
            
            elements.forEach((el, index) => {
                if (index === 0) {
                    currentX = el.x + el.width;
                    return;
                }
                
                if (el.type === 'node') {
                    el.element.position({ x: currentX + el.width / 2, y: el.element.position().y });
                    currentX += el.width + spacing;
                } else {
                    el.element.x = currentX;
                    appContext.layerManager.renderObject(el.element);
                    currentX += el.width + spacing;
                }
            });
        }
        
        if (appContext.layerManager && appContext.layerManager.selectedLayer) {
            appContext.layerManager.selectObject(appContext.layerManager.selectedLayer);
        }
    }
}

// グローバルインスタンスは app.js で生成
