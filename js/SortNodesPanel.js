import { appContext } from './AppContext.js';
import { progressOverlay } from './ProgressOverlay.js';

/**
 * SortNodesPanel - Sort Nodes (A-Z)パネル管理クラス
 */
export class SortNodesPanel {
    constructor() {
        this.panel = null;
        this.currentAxis = 'x-axis'; // デフォルトはX-axis（行単位）
    }

    initialize() {
        this.panel = document.getElementById('sort-nodes-panel');
        this.setupEventListeners();
        
    }

    setupEventListeners() {
        // ラジオボタンの変更イベント
        document.querySelectorAll('input[name="sort-axis"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentAxis = e.target.value;
            });
        });

        // Apply Sortボタンのクリックイベント
        const applyBtn = document.getElementById('sort-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applySort();
            });
        }

        // 閉じるボタン
        const closeBtn = document.getElementById('sort-nodes-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanel());
        }
    }

    openPanel() {
        if (!this.panel) return;
        this.panel.classList.add('active');
    }

    closePanel() {
        if (!this.panel) return;
        this.panel.classList.remove('active');
    }

    applySort() {
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return;

        progressOverlay.show('Sorting nodes...');
        
        setTimeout(() => {
            if (this.currentAxis === 'x-axis') {
                // X-axis: 行単位（階層単位）でソート
                appContext.layoutManager.sortNodesAZ();
            } else {
                // Y-axis: 列単位でソート
                appContext.layoutManager.sortNodesByColumn();
            }
            progressOverlay.hide();
        }, 50);
    }
}
