/**
 * PathTracePanel - Path Trace機能の設定パネル
 */
class PathTracePanel {
    constructor() {
        this.panel = null;
        this.isVisible = false;
        this.isPathTraceEnabled = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    initialize() {
        this.panel = document.getElementById('path-trace-panel');
        
        if (!this.panel) {
            console.error('Path Trace panel element not found');
            return;
        }

        this.setupEventListeners();
        this.setupPanelDrag();
        
        // 互換性のためグローバルに登録
        window.pathTracePanel = this;
    }

    setupEventListeners() {
        // ON/OFFスイッチ
        const toggleSwitch = document.getElementById('path-trace-toggle');
        if (toggleSwitch) {
            toggleSwitch.addEventListener('change', (e) => {
                this.isPathTraceEnabled = e.target.checked;
                this.updatePathTraceState();
                this.updateStatusLabel();
            });
        }

        // 閉じるボタン
        const closeBtn = document.getElementById('path-trace-panel-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanel());
        }
    }

    setupPanelDrag() {
        if (!this.panel) return;
        const header = this.panel.querySelector('.path-trace-panel-header');
        if (!header) return;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('path-trace-panel-close-btn')) return;
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
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                const header = this.panel.querySelector('.path-trace-panel-header');
                if (header) header.style.cursor = 'grab';
            }
        });
    }

    /**
     * Path Trace状態を更新
     */
    updatePathTraceState() {
        if (!networkManager) return;

        if (this.isPathTraceEnabled) {
            // Path Trace ON: ホバーハイライトを有効化、選択を無効化
            networkManager.toggleHoverHighlight(true);
            networkManager.setSelectionEnabled(false);
            console.log('Path Trace: ON');
        } else {
            // Path Trace OFF: ホバーハイライトを無効化、選択を有効化
            networkManager.toggleHoverHighlight(false);
            networkManager.setSelectionEnabled(true);
            console.log('Path Trace: OFF');
        }
    }

    /**
     * ステータスラベルを更新
     */
    updateStatusLabel() {
        const statusLabel = document.getElementById('path-trace-status');
        if (statusLabel) {
            statusLabel.textContent = this.isPathTraceEnabled ? 'ON' : 'OFF';
        }
    }

    /**
     * パネルを開く
     */
    openPanel() {
        if (!this.panel) return;
        
        if (!networkManager || !networkManager.hasNetwork()) {
            alert('Please load a network first.');
            return;
        }

        this.panel.classList.add('active');
        this.isVisible = true;
    }

    /**
     * パネルを閉じる
     */
    closePanel() {
        if (!this.panel) return;
        this.panel.classList.remove('active');
        this.isVisible = false;
    }

    /**
     * パネルの表示/非表示を切り替え
     */
    togglePanel() {
        if (this.isVisible) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }
}

// グローバルインスタンス
let pathTracePanel;
