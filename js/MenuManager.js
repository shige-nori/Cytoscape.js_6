import { appContext } from './AppContext.js';
import { progressOverlay } from './ProgressOverlay.js';

/**
 * MenuManager - メニューバー管理クラス
 */
export class MenuManager {
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
        // Undo/Redo buttons
        document.getElementById('history-undo')?.addEventListener('click', () => {
            if (appContext.historyManager) {
                appContext.historyManager.undo();
            }
            this.closeAllMenus();
        });

        document.getElementById('history-redo')?.addEventListener('click', () => {
            if (appContext.historyManager) {
                appContext.historyManager.redo();
            }
            this.closeAllMenus();
        });

        // Open Network
        document.getElementById('open-network').addEventListener('click', async () => {
            this.closeAllMenus();

            if (!await this.confirmDiscardCurrentNetwork()) {
                return;
            }
            
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
                    await appContext.fileHandler.openCX2File(file, fileHandle);
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

        // (Save メニューは index.html から削除済み)

        // Save As Network
        document.getElementById('save-as-network').addEventListener('click', async () => {
            if (appContext.networkManager.hasNetwork()) {
                const saved = await appContext.fileHandler.saveCX2File(null, true); // useFileDialog = true
            }
            this.closeAllMenus();
        });

        // Export submenu - Network to Web Page
        document.getElementById('export-network-webpage')?.addEventListener('click', async () => {
            if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) {
                alert('ネットワークが開かれていません。先にネットワークを開いてください。');
                this.closeAllMenus();
                return;
            }
            try {
                progressOverlay.show('Exporting network to web page...');
                await appContext.webPageExporter.exportNetworkToWebPage();
                progressOverlay.hide();
            } catch (err) {
                progressOverlay.hide();
                console.error('Export failed:', err);
                alert('Webページのエクスポートに失敗しました: ' + err.message);
            }
            this.closeAllMenus();
        });

        // Import Network File
        document.getElementById('import-network').addEventListener('click', async () => {
            if (!await this.confirmDiscardCurrentNetwork()) {
                this.closeAllMenus();
                return;
            }
            document.getElementById('file-input-network').click();
            this.closeAllMenus();
        });

        // Import Table File
        document.getElementById('import-table').addEventListener('click', () => {
            if (!appContext.networkManager.hasNetwork()) {
                alert('Please import a network file first.');
                this.closeAllMenus();
                return;
            }
            document.getElementById('file-input-table').click();
            this.closeAllMenus();
        });

        // Close Network
        document.getElementById('close-network').addEventListener('click', async () => {
            if (appContext.networkManager.hasNetwork()) {
                // 未保存の変更がある場合は確認ダイアログを表示
                if (!await this.confirmDiscardCurrentNetwork()) {
                    this.closeAllMenus();
                    return;
                }
                appContext.networkManager.closeNetwork();
                this.updateMenuStates();
            }
            this.closeAllMenus();
        });

        // Layout - Dagre (Defaults)
        document.getElementById('layout-dagre').addEventListener('click', () => {
            if (appContext.networkManager.hasNetwork()) {
                progressOverlay.show('Applying layout...');
                setTimeout(() => {
                    appContext.layoutManager.applyDagreLayout();
                    progressOverlay.hide();
                }, 50);
            }
            this.closeAllMenus();
        });

        // Layout - Equal
        document.getElementById('layout-equal').addEventListener('click', () => {
            if (appContext.networkManager.hasNetwork()) {
                progressOverlay.show('Applying layout...');
                setTimeout(() => {
                    appContext.layoutManager.applyEqualLayout();
                    progressOverlay.hide();
                }, 50);
            }
            this.closeAllMenus();
        });

        // Layout - Tools
        document.getElementById('layout-tools').addEventListener('click', () => {
            if (appContext.networkManager.hasNetwork()) {
                appContext.edgeBends.closePanel(); // Edge Bendsパネルを閉じる
                appContext.sortNodesPanel.closePanel(); // Sort Nodesパネルを閉じる
                if (appContext.stylePanel) appContext.stylePanel.closePanel(); // Style Panelを閉じる
                if (appContext.pathTracePanel) appContext.pathTracePanel.closePanel(); // Path Traceパネルを閉じる
                if (appContext.annotationPanel) appContext.annotationPanel.closePanel(); // Annotationパネルを閉じる
                appContext.layoutTools.openPanel();
            }
            this.closeAllMenus();
        });

        // Edge Bends
        document.getElementById('edge-bends').addEventListener('click', () => {
            if (appContext.networkManager.hasNetwork()) {
                appContext.layoutTools.closePanel(); // Layout Toolsパネルを閉じる
                appContext.sortNodesPanel.closePanel(); // Sort Nodesパネルを閉じる
                if (appContext.stylePanel) appContext.stylePanel.closePanel(); // Style Panelを閉じる
                if (appContext.pathTracePanel) appContext.pathTracePanel.closePanel(); // Path Traceパネルを閉じる
                if (appContext.annotationPanel) appContext.annotationPanel.closePanel(); // Annotationパネルを閉じる
                appContext.edgeBends.openPanel();
            }
            this.closeAllMenus();
        });

        // Sort Nodes (A-Z)
        document.getElementById('sort-nodes-az').addEventListener('click', () => {
            if (appContext.networkManager.hasNetwork()) {
                appContext.layoutTools.closePanel();
                appContext.edgeBends.closePanel();
                if (appContext.stylePanel) appContext.stylePanel.closePanel();
                if (appContext.pathTracePanel) appContext.pathTracePanel.closePanel();
                if (appContext.annotationPanel) appContext.annotationPanel.closePanel();
                appContext.sortNodesPanel.openPanel();
            }
            this.closeAllMenus();
        });

        // Style Panel
        document.getElementById('open-style-panel').addEventListener('click', () => {
            if (appContext.networkManager.hasNetwork()) {
                appContext.layoutTools.closePanel();
                appContext.edgeBends.closePanel();
                appContext.sortNodesPanel.closePanel();
                if (appContext.pathTracePanel) appContext.pathTracePanel.closePanel();
                if (appContext.annotationPanel) appContext.annotationPanel.closePanel();
                if (appContext.stylePanel) appContext.stylePanel.openPanel();
            }
            this.closeAllMenus();
        });

        // Table Panel
        document.getElementById('toggle-table-panel').addEventListener('click', () => {
            if (appContext.networkManager.hasNetwork()) {
                if (appContext.tablePanel) appContext.tablePanel.togglePanel();
            }
            this.closeAllMenus();
        });

        // Filter Panel (submenu removed from DOM in index.html)
        const toggleFilterBtn = document.getElementById('toggle-filter-panel');
        if (toggleFilterBtn) {
            toggleFilterBtn.addEventListener('click', () => {
                if (appContext.networkManager.hasNetwork()) {
                    if (appContext.filterPanel) appContext.filterPanel.togglePanel();
                }
                this.closeAllMenus();
            });
        }

        // Top-level Filter menu click should open the Filter Panel directly
        const filterMenuItem = document.querySelector('.menu-item[data-menu="filter"]');
        if (filterMenuItem) {
            filterMenuItem.addEventListener('click', (e) => {
                // If the click was inside the submenu (e.g., clicking submenu items), ignore here
                if (e.target && e.target.closest && e.target.closest('.submenu')) return;
                if (appContext.networkManager.hasNetwork()) {
                    if (appContext.filterPanel) appContext.filterPanel.togglePanel();
                }
                this.closeAllMenus();
            });
        }

        // Path Trace
        document.getElementById('path-trace-menu').addEventListener('click', () => {
            if (appContext.networkManager.hasNetwork()) {
                appContext.layoutTools.closePanel();
                appContext.edgeBends.closePanel();
                appContext.sortNodesPanel.closePanel();
                if (appContext.stylePanel) appContext.stylePanel.closePanel();
                if (appContext.annotationPanel) appContext.annotationPanel.closePanel();
                if (appContext.pathTracePanel) appContext.pathTracePanel.openPanel();
            }
            this.closeAllMenus();
        });

        // ============================================
        // Annotation メニュー
        // ============================================
        
        // Open Annotation Panel (close other panels first)
        document.getElementById('open-annotation-panel')?.addEventListener('click', () => {
            if (appContext.networkManager.hasNetwork()) {
                appContext.layoutTools.closePanel();
                appContext.edgeBends.closePanel();
                appContext.sortNodesPanel.closePanel();
                if (appContext.stylePanel) appContext.stylePanel.closePanel();
                if (appContext.pathTracePanel) appContext.pathTracePanel.closePanel();
                if (appContext.annotationPanel) appContext.annotationPanel.openPanel();
            }
            this.closeAllMenus();
        });

        // Layers Panel（削除 - 統合済み）

        // メニュー外クリックで閉じる
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menubar')) {
                this.closeAllMenus();
            }
        });

        // メニューのクリックで少し凹む（押下）エフェクトを追加
        const menuItems = document.querySelectorAll('.menubar .menu-item');
        menuItems.forEach(mi => {
            const hasSubmenu = !!mi.querySelector('.submenu');
            // マウス操作
            mi.addEventListener('mousedown', (ev) => {
                if (hasSubmenu) return;
                mi.classList.add('depressed');
            });
            mi.addEventListener('mouseup', (ev) => {
                if (hasSubmenu) return;
                mi.classList.remove('depressed');
            });
            mi.addEventListener('mouseleave', (ev) => {
                if (hasSubmenu) return;
                mi.classList.remove('depressed');
            });

            // キーボード操作（Enter / Space）で視覚効果を短く出す
            mi.addEventListener('keydown', (ev) => {
                if (hasSubmenu) return;
                if (ev.key === 'Enter' || ev.key === ' ') {
                    mi.classList.add('depressed');
                    setTimeout(() => mi.classList.remove('depressed'), 150);
                }
            });
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
                if (!await this.confirmDiscardCurrentNetwork()) {
                    e.target.value = '';
                    return;
                }
                await appContext.fileHandler.openCX2File(file);
                if (appContext.menuManager) {
                    appContext.menuManager.updateMenuStates();
                }
            }
            e.target.value = ''; // リセット
        });

        // Network File入力
        document.getElementById('file-input-network').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                if (!await this.confirmDiscardCurrentNetwork()) {
                    e.target.value = '';
                    return;
                }
                await appContext.fileHandler.startNetworkImport(file);
            }
            e.target.value = ''; // リセット
        });

        // Table File入力
        document.getElementById('file-input-table').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await appContext.fileHandler.startTableImport(file);
            }
            e.target.value = ''; // リセット
        });

        // Image File入力（Annotation用）
        document.getElementById('file-input-image')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && appContext.layerManager) {
                try {
                    await appContext.layerManager.addImageFromFile(file);
                    appContext.annotationPanel?.openPanel();
                } catch (err) {
                    console.error('Failed to load image:', err);
                    alert('画像の読み込みに失敗しました。');
                }
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
     * 現在のネットワーク破棄の確認（Open/Import 共通）
     * @returns {Promise<boolean>} 続行する場合 true
     */
    async confirmDiscardCurrentNetwork() {
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return true;
        // 変更がない場合は確認不要
        if (!appContext.hasUnsavedChanges) return true;
        const currentFileName = appContext.fileHandler && appContext.fileHandler.currentFilePath
            ? appContext.fileHandler.currentFilePath
            : null;

        const message = currentFileName
            ? `${currentFileName}の変更は保存されません。よろしいですか？`
            : '現在のネットワーク図は破棄されます。よろしいですか？';

        const result = await appContext.modalManager.showDynamicConfirm(message, 'OK', 'キャンセル');
        return result === 'primary';
    }

    /**
     * メニュー項目の有効/無効状態を更新
     */
    updateMenuStates() {
        const hasNetwork = appContext.networkManager && appContext.networkManager.hasNetwork();
        const hasSavePath = appContext.fileHandler && appContext.fileHandler.currentFilePath;
        
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

        this.updateHistoryButtons();
    }

    /**
     * Undo/Redoボタンの有効/無効状態を更新
     */
    updateHistoryButtons() {
        const undoBtn = document.getElementById('history-undo');
        const redoBtn = document.getElementById('history-redo');
        const canUndo = appContext.historyManager ? appContext.historyManager.canUndo() : false;
        const canRedo = appContext.historyManager ? appContext.historyManager.canRedo() : false;

        if (undoBtn) undoBtn.disabled = !canUndo;
        if (redoBtn) redoBtn.disabled = !canRedo;
    }

    /**
     * レイアウトメニューのチェックマークを更新
     */
    updateLayoutCheckmarks() {
        const dagreItem = document.getElementById('layout-dagre');
        const equalItem = document.getElementById('layout-equal');
        const hierarchicalMenu = document.querySelector('[data-submenu="hierarchical"]');
        
        if (!appContext.layoutManager) return;
        
        // すべてのチェックマークを削除
        if (dagreItem) dagreItem.classList.remove('checked');
        if (equalItem) equalItem.classList.remove('checked');
        if (hierarchicalMenu) hierarchicalMenu.classList.remove('checked');
        
        // 現在のレイアウトに応じてチェックマークを追加
        if (appContext.layoutManager.currentLayout === 'dagre') {
            if (dagreItem) dagreItem.classList.add('checked');
            if (hierarchicalMenu) hierarchicalMenu.classList.add('checked');
        } else if (appContext.layoutManager.currentLayout === 'equal') {
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
        
        if (appContext.tablePanel && appContext.tablePanel.isVisible) {
            tablePanelItem.classList.add('checked');
        } else {
            tablePanelItem.classList.remove('checked');
        }
    }
}
