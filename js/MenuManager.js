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
        // Open Network
        document.getElementById('open-network').addEventListener('click', async () => {
            this.closeAllMenus();
            
            // File System Access APIを使用してファイルを開く
            if ('showOpenFilePicker' in window) {
                try {
                    const [fileHandle] = await window.showOpenFilePicker({
                        types: [{
                            description: 'CX2 Network File',
                            accept: { 'application/json': ['.cx2'] }
                        }],
                        multiple: false
                    });
                    
                    const file = await fileHandle.getFile();
                    await fileHandler.openCX2File(file, fileHandle);
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Error opening file:', err);
                    }
                }
            } else {
                // フォールバック: 従来のファイル入力
                document.getElementById('file-input-cx2').click();
            }
        });

        // Save Network
        document.getElementById('save-network').addEventListener('click', () => {
            if (fileHandler.currentFilePath) {
                fileHandler.saveCX2File(fileHandler.currentFilePath);
            }
            this.closeAllMenus();
        });

        // Save As Network
        document.getElementById('save-as-network').addEventListener('click', () => {
            if (networkManager.hasNetwork()) {
                fileHandler.saveCX2File(null, true); // useFileDialog = true
            }
            this.closeAllMenus();
        });

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

        // Close Network
        document.getElementById('close-network').addEventListener('click', () => {
            if (networkManager.hasNetwork()) {
                if (confirm('Are you sure you want to close the current network?')) {
                    networkManager.closeNetwork();
                    this.updateMenuStates();
                }
            }
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
                if (stylePanel) stylePanel.closePanel(); // Style Panelを閉じる
                layoutTools.openPanel();
            }
            this.closeAllMenus();
        });

        // Edge Bends
        document.getElementById('edge-bends').addEventListener('click', () => {
            if (networkManager.hasNetwork()) {
                layoutTools.closePanel(); // Layout Toolsパネルを閉じる
                sortNodesPanel.closePanel(); // Sort Nodesパネルを閉じる
                if (stylePanel) stylePanel.closePanel(); // Style Panelを閉じる
                edgeBends.openPanel();
            }
            this.closeAllMenus();
        });

        // Sort Nodes (A-Z)
        document.getElementById('sort-nodes-az').addEventListener('click', () => {
            if (networkManager.hasNetwork()) {
                layoutTools.closePanel();
                edgeBends.closePanel();
                if (stylePanel) stylePanel.closePanel();
                sortNodesPanel.openPanel();
            }
            this.closeAllMenus();
        });

        // Style Panel
        document.getElementById('open-style-panel').addEventListener('click', () => {
            if (networkManager.hasNetwork()) {
                layoutTools.closePanel();
                edgeBends.closePanel();
                sortNodesPanel.closePanel();
                if (stylePanel) stylePanel.openPanel();
            }
            this.closeAllMenus();
        });

        // Table Panel
        document.getElementById('toggle-table-panel').addEventListener('click', () => {
            if (networkManager.hasNetwork()) {
                if (tablePanel) tablePanel.togglePanel();
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
        // CX2 File入力
        document.getElementById('file-input-cx2').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await fileHandler.openCX2File(file);
            }
            e.target.value = ''; // リセット
        });

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
     * メニュー項目の有効/無効状態を更新
     */
    updateMenuStates() {
        const hasNetwork = networkManager && networkManager.hasNetwork();
        const hasSavePath = fileHandler && fileHandler.currentFilePath;
        
        // Saveメニュー
        const saveItem = document.getElementById('save-network');
        if (saveItem) {
            if (hasNetwork && hasSavePath) {
                saveItem.classList.remove('disabled');
            } else {
                saveItem.classList.add('disabled');
            }
        }
        
        // Save Asメニュー
        const saveAsItem = document.getElementById('save-as-network');
        if (saveAsItem) {
            if (hasNetwork) {
                saveAsItem.classList.remove('disabled');
            } else {
                saveAsItem.classList.add('disabled');
            }
        }
        
        // Closeメニュー
        const closeItem = document.getElementById('close-network');
        if (closeItem) {
            if (hasNetwork) {
                closeItem.classList.remove('disabled');
            } else {
                closeItem.classList.add('disabled');
            }
        }
        
        // Import Tableメニュー
        const importTableItem = document.getElementById('import-table');
        if (importTableItem) {
            if (hasNetwork) {
                importTableItem.classList.remove('disabled');
            } else {
                importTableItem.classList.add('disabled');
            }
        }
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

    /**
     * Table Panelメニューのチェックマークを更新
     */
    updateTablePanelCheckmark() {
        const tablePanelItem = document.getElementById('toggle-table-panel');
        if (!tablePanelItem) return;
        
        if (tablePanel && tablePanel.isVisible) {
            tablePanelItem.classList.add('checked');
        } else {
            tablePanelItem.classList.remove('checked');
        }
    }
}

// グローバルインスタンス
let menuManager;
