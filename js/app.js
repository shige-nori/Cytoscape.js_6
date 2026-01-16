/**
 * Network Visualizer - メインアプリケーション
 */

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('Network Visualizer initializing...');
    
    // プログレスオーバーレイ初期化
    progressOverlay.init();
    
    // 各マネージャーを初期化
    networkManager = new NetworkManager();
    fileHandler = new FileHandler();
    layoutManager = new LayoutManager();
    layoutTools = new LayoutTools();
    layoutTools.initialize();
    edgeBends = new EdgeBends();
    edgeBends.initialize();
    modalManager = new ModalManager();
    menuManager = new MenuManager();
    
    // ウィンドウリサイズ対応
    window.addEventListener('resize', () => {
        if (networkManager && networkManager.cy) {
            networkManager.cy.resize();
        }
    });
    
    console.log('Network Visualizer ready!');
});
