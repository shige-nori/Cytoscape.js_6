/**
 * SortNodesPanel - Sort Nodes (A-Z)パネル管理クラス
 */
class SortNodesPanel {
    constructor() {
        this.panel = null;
        this.currentAxis = 'x-axis'; // デフォルトはX-axis（行単位）
    }

    initialize() {
        this.panel = document.getElementById('sort-nodes-panel');
        this.setupEventListeners();
        
        // 互換性のためグローバルに登録
        window.sortNodesPanel = this;
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

        // ネットワーク図の空白クリックでパネルを閉じる
        if (networkManager && networkManager.cy) {
            networkManager.cy.on('tap', (e) => {
                if (e.target === networkManager.cy && this.panel && this.panel.classList.contains('active')) {
                    this.closePanel();
                }
            });
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
        if (!networkManager || !networkManager.hasNetwork()) return;

        progressOverlay.show('Sorting nodes...');
        
        setTimeout(() => {
            if (this.currentAxis === 'x-axis') {
                // X-axis: 行単位（階層単位）でソート
                layoutManager.sortNodesAZ();
            } else {
                // Y-axis: 列単位でソート
                layoutManager.sortNodesByColumn();
            }
            progressOverlay.hide();
        }, 50);
    }
}

// グローバルインスタンスは app.js で生成
