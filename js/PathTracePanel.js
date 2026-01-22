import { appContext } from './AppContext.js';

/**
 * PathTracePanel - Path Trace機能の管理クラス
 */
export class PathTracePanel {
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

    /**
     * パネルを開く
     */
    openPanel() {
        if (!this.panel) return;
        
        // 他のパネルを閉じる
        if (appContext.layoutTools) appContext.layoutTools.closePanel();
        if (appContext.edgeBends) appContext.edgeBends.closePanel();
        if (appContext.sortNodesPanel) appContext.sortNodesPanel.closePanel();
        if (appContext.stylePanel) appContext.stylePanel.closePanel();
        
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

        // UIトグルを状態に同期
        const toggleSwitch = document.getElementById('path-trace-toggle');
        if (toggleSwitch && toggleSwitch.checked !== enabled) {
            toggleSwitch.checked = enabled;
        }
        
        if (appContext.networkManager) {
            // ONにする場合、既存の選択をすべて解除
            if (enabled && appContext.networkManager.cy) {
                appContext.networkManager.cy.elements().unselect();
            }
            
            // ホバーハイライトの有効/無効を切り替え
            appContext.networkManager.toggleHoverHighlight(enabled);
            
            // 選択機能の有効/無効を切り替え
            appContext.networkManager.toggleSelection(!enabled);
            
        }
    }

}
