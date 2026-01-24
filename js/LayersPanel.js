import { appContext } from './AppContext.js';

/**
 * LayersPanel - レイヤー一覧・順序変更・表示/非表示パネル
 */
export class LayersPanel {
    constructor() {
        this.panel = null;
        this.isInitialized = false;
    }

    /**
     * 初期化
     */
    initialize() {
        if (this.isInitialized) return;
        this.createPanel();
        this.isInitialized = true;
    }

    /**
     * パネルHTMLを作成
     */
    createPanel() {
        const panelHTML = `
            <div class="layers-panel" id="layers-panel">
                <div class="tools-panel-header">
                    <h3>Layers</h3>
                    <button class="tools-panel-close" id="layers-panel-close-btn">&times;</button>
                </div>
                <div class="layers-panel-body">
                    <div class="layers-toolbar">
                        <button class="layers-toolbar-btn" id="layer-bring-front" title="Bring to Front">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M3 11h10V9H3v2zm0-4h10V5H3v2zm5-5l4 4H4l4-4z"/>
                            </svg>
                        </button>
                        <button class="layers-toolbar-btn" id="layer-send-back" title="Send to Back">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M3 5h10v2H3V5zm0 4h10v2H3V9zm5 5l-4-4h8l-4 4z"/>
                            </svg>
                        </button>
                        <button class="layers-toolbar-btn" id="layer-delete" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
                                <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1z"/>
                            </svg>
                        </button>
                        <span class="layers-toolbar-separator"></span>
                        <button class="layers-toolbar-btn" id="layer-lock" title="Lock/Unlock">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 1a2 2 0 00-2 2v4H5a2 2 0 00-2 2v3a2 2 0 002 2h6a2 2 0 002-2V9a2 2 0 00-2-2H6V3a2 2 0 012-2h.01a2 2 0 012 2v1h1V3a3 3 0 00-3-3z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="layers-list" id="layers-list">
                        <!-- レイヤー項目がここに動的に追加される -->
                        <div class="layers-empty">No layers</div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        this.panel = document.getElementById('layers-panel');
        this.setupEventListeners();
    }

    /**
     * イベントリスナーをセットアップ
     */
    setupEventListeners() {
        // 閉じるボタン
        document.getElementById('layers-panel-close-btn')?.addEventListener('click', () => {
            this.closePanel();
        });

        // ツールバーボタン
        document.getElementById('layer-bring-front')?.addEventListener('click', () => {
            const selected = appContext.layerManager?.selectedLayer;
            if (selected) {
                appContext.layerManager.bringToFront(selected.id);
            }
        });

        document.getElementById('layer-send-back')?.addEventListener('click', () => {
            const selected = appContext.layerManager?.selectedLayer;
            if (selected) {
                appContext.layerManager.sendToBack(selected.id);
            }
        });

        document.getElementById('layer-delete')?.addEventListener('click', () => {
            const selected = appContext.layerManager?.selectedLayer;
            if (selected) {
                appContext.layerManager.removeObject(selected.id);
            }
        });

        document.getElementById('layer-lock')?.addEventListener('click', () => {
            const selected = appContext.layerManager?.selectedLayer;
            if (selected) {
                selected.locked = !selected.locked;
                appContext.layerManager.renderObject(selected);
                this.refresh();
            }
        });
    }

    /**
     * パネルを開く
     */
    openPanel() {
        if (!this.panel) this.initialize();
        this.panel.classList.add('active');
        this.refresh();
    }

    /**
     * パネルを閉じる
     */
    closePanel() {
        if (this.panel) {
            this.panel.classList.remove('active');
        }
    }

    /**
     * パネルのトグル
     */
    togglePanel() {
        if (this.panel?.classList.contains('active')) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    /**
     * レイヤーリストを更新
     */
    refresh() {
        const listContainer = document.getElementById('layers-list');
        if (!listContainer) return;

        const layers = appContext.layerManager?.layers || [];
        
        if (layers.length === 0) {
            listContainer.innerHTML = '<div class="layers-empty">No layers</div>';
            return;
        }

        // z-indexの逆順で表示（上にあるものが上に表示）
        const sortedLayers = [...layers].reverse();
        
        listContainer.innerHTML = sortedLayers.map(layer => `
            <div class="layer-item ${layer.id === appContext.layerManager?.selectedLayer?.id ? 'selected' : ''} ${layer.locked ? 'locked' : ''}" 
                 data-layer-id="${layer.id}">
                <button class="layer-visibility-btn ${layer.visible ? 'visible' : ''}" 
                        data-layer-id="${layer.id}" title="Toggle Visibility">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        ${layer.visible ? 
                            '<path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 011.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 011.172 8z"/><path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM4.5 8a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"/>' :
                            '<path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 00-2.79.588l.77.771A5.944 5.944 0 018 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 00-4.474-4.474l.823.823a2.5 2.5 0 012.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 01-4.474-4.474l.823.823a2.5 2.5 0 002.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 001.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 018 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884l-12-12 .708-.708 12 12-.708.708z"/>'
                        }
                    </svg>
                </button>
                <span class="layer-icon">${this.getLayerIcon(layer.type)}</span>
                <span class="layer-name">${this.escapeHtml(layer.name)}</span>
                ${layer.locked ? '<span class="layer-lock-icon">🔒</span>' : ''}
            </div>
        `).join('');

        // イベントを設定
        listContainer.querySelectorAll('.layer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.layer-visibility-btn')) return;
                const layerId = item.dataset.layerId;
                const layer = appContext.layerManager?.layers.find(l => l.id === layerId);
                if (layer) {
                    appContext.layerManager.selectObject(layer);
                    this.refresh();
                }
            });
        });

        listContainer.querySelectorAll('.layer-visibility-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const layerId = btn.dataset.layerId;
                const layer = appContext.layerManager?.layers.find(l => l.id === layerId);
                if (layer) {
                    layer.visible = !layer.visible;
                    appContext.layerManager.renderObject(layer);
                    this.refresh();
                }
            });
        });
    }

    /**
     * 選択状態を更新
     */
    updateSelection(selectedLayer) {
        const items = document.querySelectorAll('.layer-item');
        items.forEach(item => {
            if (item.dataset.layerId === selectedLayer?.id) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * レイヤータイプに応じたアイコンを取得
     */
    getLayerIcon(type) {
        const icons = {
            rectangle: '▢',
            ellipse: '○',
            line: '─',
            arrow: '→',
            text: 'T',
            image: '🖼'
        };
        return icons[type] || '?';
    }

    /**
     * HTMLエスケープ
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
