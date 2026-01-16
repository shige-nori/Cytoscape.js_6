/**
 * EdgeBends - 03_Cytoscape.js と互換のエッジ曲げ強度ツール
 */
class EdgeBends {
    constructor() {
        this.panel = null;
        this.currentBendStrength = 40;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    initialize() {
        this.panel = document.getElementById('edge-bends-panel');
        if (!this.panel) return;
        this.setupEventListeners();
        this.setupPanelDrag();
        // グローバルに公開
        window.edgeBends = this;
    }

    setupEventListeners() {
        // サポートする複数IDを探す
        const bendStrengthSlider = document.getElementById('bend-strength-slider') || document.getElementById('edge-bends-slider');
        const bendValueEl = document.getElementById('bend-strength-value') || document.getElementById('edge-bends-value-input');

        if (bendStrengthSlider) {
            bendStrengthSlider.addEventListener('input', (e) => {
                this.currentBendStrength = parseInt(e.target.value);
                if (bendValueEl) {
                    if ('value' in bendValueEl) bendValueEl.value = this.currentBendStrength;
                    else bendValueEl.textContent = this.currentBendStrength;
                }
                this.applyEdgeBends();
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
    }

    closePanel() {
        if (this.panel) this.panel.classList.remove('active');
    }

    applyEdgeBends() {
        if (!window.networkManager || !networkManager.cy) return;
        const edges = networkManager.cy.edges();
        if (edges.length === 0) return;
        edges.style({ 'curve-style': 'bezier', 'control-point-step-size': this.currentBendStrength });
    }
}

// グローバルインスタンスは app.js で生成
