/**
 * Network Visualizer - メインアプリケーション
 */
import { appContext } from './AppContext.js';
import { progressOverlay } from './ProgressOverlay.js';
import { NetworkManager } from './NetworkManager.js';
import { FileHandler } from './FileHandler.js';
import { LayoutManager } from './LayoutManager.js';
import { LayoutTools } from './LayoutTools.js';
import { EdgeBends } from './EdgeBendsPanel.js';
import { SortNodesPanel } from './SortNodesPanel.js';
import { StylePanel } from './StylePanel.js';
import { TablePanel } from './TablePanel.js';
import { FilterPanel } from './FilterPanel.js';
import { PathTracePanel } from './PathTracePanel.js';
import { ModalManager } from './ModalManager.js';
import { MenuManager } from './MenuManager.js';
import { LayerManager } from './LayerManager.js';
import { AnnotationPanel } from './AnnotationPanel.js';
import { HistoryManager } from './HistoryManager.js';

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    
    // プログレスオーバーレイ初期化
    progressOverlay.init();
    
    // 各マネージャーを初期化
    appContext.networkManager = new NetworkManager();
    // 互換性のためグローバル参照を保持
    window.networkManager = appContext.networkManager;
    appContext.fileHandler = new FileHandler();
    appContext.layoutManager = new LayoutManager();
    appContext.layoutTools = new LayoutTools();
    appContext.layoutTools.initialize();
    appContext.edgeBends = new EdgeBends();
    appContext.edgeBends.initialize();
    appContext.sortNodesPanel = new SortNodesPanel();
    appContext.sortNodesPanel.initialize();
    appContext.stylePanel = new StylePanel();
    appContext.stylePanel.initialize();
    appContext.tablePanel = new TablePanel();
    appContext.tablePanel.initialize();
    appContext.filterPanel = new FilterPanel();
    appContext.filterPanel.initialize();
    appContext.pathTracePanel = new PathTracePanel();
    appContext.pathTracePanel.initialize();
    
    // Annotation機能関連
    appContext.layerManager = new LayerManager();
    appContext.layerManager.initialize();
    appContext.annotationPanel = new AnnotationPanel();
    appContext.annotationPanel.initialize();

    appContext.historyManager = new HistoryManager(10);
    appContext.historyManager.captureState('init');
    
    appContext.modalManager = new ModalManager();
    appContext.menuManager = new MenuManager();
    
    // 初期メニュー状態を設定
    appContext.menuManager.updateMenuStates();
    
    // ウィンドウリサイズ対応
    window.addEventListener('resize', () => {
        if (appContext.networkManager && appContext.networkManager.cy) {
            appContext.networkManager.cy.resize();
        }
    });
    
});
