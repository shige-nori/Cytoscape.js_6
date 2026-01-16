/**
 * MenuManager - メニューバー管理クラス
 */
class MenuManager {
    constructor() {
        this.init();
    }

    /**
     * 初期化
     */
    init() {
        this.setupMenuEvents();
        this.setupFileInputs();
    }

    /**
     * メニューイベントを設定
     */
    setupMenuEvents() {
        // Import Network File
        document.getElementById('import-network').addEventListener('click', () => {
            document.getElementById('file-input-network').click();
            this.closeAllMenus();
        });

        // Import Table File
        document.getElementById('import-table').addEventListener('click', () => {
            if (!networkManager.hasNetwork()) {
                alert('Please import a network file first.');
                this.closeAllMenus();
                return;
            }
            document.getElementById('file-input-table').click();
            this.closeAllMenus();
        });

        // Layout - Dagre (Defaults)
        document.getElementById('layout-dagre').addEventListener('click', () => {
            if (networkManager.hasNetwork()) {
                progressOverlay.show('Applying layout...');
                setTimeout(() => {
                    layoutManager.applyDagreLayout();
                    progressOverlay.hide();
                }, 50);
            }
            this.closeAllMenus();
        });

        // Layout - Equal
        document.getElementById('layout-equal').addEventListener('click', () => {
            if (networkManager.hasNetwork()) {
                progressOverlay.show('Applying layout...');
                setTimeout(() => {
                    layoutManager.applyEqualLayout();
                    progressOverlay.hide();
                }, 50);
            }
            this.closeAllMenus();
        });

        // Layout - Tools
        document.getElementById('layout-tools').addEventListener('click', () => {
            if (networkManager.hasNetwork()) {
                edgeBends.closePanel(); // Edge Bendsパネルを閉じる
                sortNodesPanel.closePanel(); // Sort Nodesパネルを閉じる
                layoutTools.openPanel();
            }
            this.closeAllMenus();
        });

        // Edge Bends
        document.getElementById('edge-bends').addEventListener('click', () => {
            if (networkManager.hasNetwork()) {
                layoutTools.closePanel(); // Layout Toolsパネルを閉じる
                sortNodesPanel.closePanel(); // Sort Nodesパネルを閉じる
                edgeBends.openPanel();
            }
            this.closeAllMenus();
        });

        // Sort Nodes (A-Z)
        document.getElementById('sort-nodes-az').addEventListener('click', () => {
            if (networkManager.hasNetwork()) {
                layoutTools.closePanel();
                edgeBends.closePanel();
                sortNodesPanel.openPanel();
            }
            this.closeAllMenus();
        });

        // メニュー外クリックで閉じる
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menubar')) {
                this.closeAllMenus();
            }
        });
    }

    /**
     * ファイル入力イベントを設定
     */
    setupFileInputs() {
        // Network File入力
        document.getElementById('file-input-network').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await fileHandler.startNetworkImport(file);
            }
            e.target.value = ''; // リセット
        });

        // Table File入力
        document.getElementById('file-input-table').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await fileHandler.startTableImport(file);
            }
            e.target.value = ''; // リセット
        });
    }

    /**
     * すべてのメニューを閉じる
     */
    closeAllMenus() {
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    /**
     * レイアウトメニューのチェックマークを更新
     */
    updateLayoutCheckmarks() {
        const dagreItem = document.getElementById('layout-dagre');
        const equalItem = document.getElementById('layout-equal');
        const hierarchicalMenu = document.querySelector('[data-submenu="hierarchical"]');
        
        if (!layoutManager) return;
        
        // すべてのチェックマークを削除
        if (dagreItem) dagreItem.classList.remove('checked');
        if (equalItem) equalItem.classList.remove('checked');
        if (hierarchicalMenu) hierarchicalMenu.classList.remove('checked');
        
        // 現在のレイアウトに応じてチェックマークを追加
        if (layoutManager.currentLayout === 'dagre') {
            if (dagreItem) dagreItem.classList.add('checked');
            if (hierarchicalMenu) hierarchicalMenu.classList.add('checked');
        } else if (layoutManager.currentLayout === 'equal') {
            if (equalItem) equalItem.classList.add('checked');
            if (hierarchicalMenu) hierarchicalMenu.classList.add('checked');
        }
    }
}

// グローバルインスタンス
let menuManager;
