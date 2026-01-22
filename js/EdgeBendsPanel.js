import { appContext } from './AppContext.js';

/**
 * EdgeBends - 03_Cytoscape.js と互換のエッジ曲げ強度ツール
 */
export class EdgeBends {
    constructor() {
        this.panel = null;
        this.currentBendStrength = 40;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    initialize() {
        this.panel = document.getElementById('edge-bends-panel');
        if (!this.panel) {
            console.error('EdgeBends: panel element not found');
            return;
        }
        this.setupEventListeners();
        this.setupPanelDrag();
    }

    setupEventListeners() {
        // サポートする複数IDを探す
        const bendStrengthSlider = document.getElementById('bend-strength-slider') || document.getElementById('edge-bends-slider');
        const bendValueEl = document.getElementById('bend-strength-value') || document.getElementById('edge-bends-value-input');

        if (bendStrengthSlider) {
            bendStrengthSlider.addEventListener('input', (e) => {
                this.currentBendStrength = parseFloat(e.target.value);
                if (bendValueEl) {
                    if ('value' in bendValueEl) bendValueEl.value = this.currentBendStrength;
                    else bendValueEl.textContent = this.currentBendStrength;
                }
                this.applyEdgeBends();
            });
        }

        // 入力ボックスとの連動
        if (bendValueEl && 'value' in bendValueEl) {
            bendValueEl.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value >= 0 && value <= 80) {
                    this.currentBendStrength = value;
                    if (bendStrengthSlider) bendStrengthSlider.value = value;
                    this.applyEdgeBends();
                }
            });
        }

        // ネットワーク図の空白クリックでパネルを閉じる
        if (appContext.networkManager && appContext.networkManager.cy) {
            appContext.networkManager.cy.on('tap', (e) => {
                if (e.target === appContext.networkManager.cy && this.panel && this.panel.classList.contains('active')) {
                    this.closePanel();
                }
            });
        }
    }

    setupPanelDrag() {
        if (!this.panel) return;
        const header = this.panel.querySelector('.tools-panel-header');
        if (!header) return;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('tools-panel-close')) return;
            this.isDragging = true;
            const rect = this.panel.getBoundingClientRect();
            this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;
            this.panel.style.left = `${x}px`;
            this.panel.style.top = `${y}px`;
            this.panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                const header = this.panel.querySelector('.tools-panel-header');
                if (header) header.style.cursor = 'grab';
            }
        });
    }

    openPanel() {
        if (!this.panel) return;
        this.panel.classList.add('active');
        this.panel.style.top = '50px';
        this.panel.style.right = '10px';
        this.panel.style.left = 'auto';
        
        // パネルを開いたときに現在の設定を適用
        this.applyEdgeBends();
    }

    closePanel() {
        if (this.panel) this.panel.classList.remove('active');
    }

    resetToDefault() {
        this.currentBendStrength = 40;
        
        // UIを更新
        const slider = document.getElementById('bend-strength-slider');
        const valueInput = document.getElementById('bend-strength-value');
        if (slider) slider.value = 40;
        if (valueInput) valueInput.value = 40;
        
        // すべてのエッジのcurve-styleをデフォルトにリセット
        if (appContext.networkManager && appContext.networkManager.cy) {
            appContext.networkManager.cy.edges().forEach(edge => {
                edge.style({
                    'curve-style': 'bezier',
                    'control-point-distances': undefined,
                    'control-point-weights': undefined,
                    'control-point-step-size': undefined
                });
            });
        }
    }

    applyEdgeBends() {
        if (!appContext.networkManager || !appContext.networkManager.cy) {
            return;
        }
        const edges = appContext.networkManager.cy.edges();
        if (edges.length === 0) {
            return;
        }
        
        // 同じノード間の複数エッジを検出
        const edgeGroups = {};
        edges.forEach(edge => {
            const source = edge.source().id();
            const target = edge.target().id();
            const key = source < target ? `${source}-${target}` : `${target}-${source}`;
            if (!edgeGroups[key]) edgeGroups[key] = [];
            edgeGroups[key].push(edge);
        });
        
        // エッジのスタイルを適用
        edges.forEach(edge => {
            const source = edge.source().id();
            const target = edge.target().id();
            const key = source < target ? `${source}-${target}` : `${target}-${source}`;
            const group = edgeGroups[key];
            
            if (group.length > 1) {
                // 複数エッジの場合、unbundled-bezierを使用
                const index = group.indexOf(edge);
                const offset = (index - (group.length - 1) / 2) * this.currentBendStrength;
                edge.style({
                    'curve-style': 'unbundled-bezier',
                    'control-point-distances': offset,
                    'control-point-weights': 0.5
                });
            } else {
                // 単一エッジの場合、bezierを使用
                edge.style({
                    'curve-style': 'bezier',
                    'control-point-step-size': this.currentBendStrength
                });
            }
        });
        
    }
}

// グローバルインスタンスは app.js で生成
