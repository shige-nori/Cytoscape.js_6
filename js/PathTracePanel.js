/**
 * PathTracePanel - Path Trace機能の管理クラス
 */
class PathTracePanel {
    constructor() {
        this.panel = null;
        this.isVisible = false;
        this.isEnabled = false; // Path Traceの有効/無効状態
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
                this.togglePathTrace(e.target.checked);
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

    /**
     * パネルを開く
     */
    openPanel() {
        if (!this.panel) return;
        
        // 他のパネルを閉じる
        if (layoutTools) layoutTools.closePanel();
        if (edgeBends) edgeBends.closePanel();
        if (sortNodesPanel) sortNodesPanel.closePanel();
        if (stylePanel) stylePanel.closePanel();
        
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

    /**
     * Path Trace機能のON/OFF
     */
    togglePathTrace(enabled) {
        this.isEnabled = enabled;
        
        if (networkManager) {
            // ホバーハイライトの有効/無効を切り替え
            networkManager.toggleHoverHighlight(enabled);
            
            // 選択機能の有効/無効を切り替え
            networkManager.toggleSelection(!enabled);
            
            console.log(`Path Trace: ${enabled ? 'ON' : 'OFF'}`);
        }
    }

    /**
     * Path Trace機能の状態を取得
     */
    isPathTraceEnabled() {
        return this.isEnabled;
    }
}

// グローバルインスタンス
let pathTracePanel;
