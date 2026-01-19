/**
 * TablePanel - テーブルパネル管理クラス
 * 画面下部にNode/Edge tableを表示し、ソート・選択連動・カラム設定などを提供
 */
class TablePanel {
    constructor() {
        this.panel = null;
        this.resizeHandle = null;
        this.isVisible = false;
        this.currentTab = 'node'; // 'node' or 'edge'
        this.sortColumn = null;
        this.sortOrder = 'asc'; // 'asc' or 'desc'
        this.nodeColumns = ['id', 'name', 'label']; // デフォルトカラム
        this.edgeColumns = ['id', 'source', 'target', 'interaction']; // デフォルトカラム
        this.visibleNodeColumns = new Set(this.nodeColumns);
        this.visibleEdgeColumns = new Set(this.edgeColumns);
        this.nodeColumnWidths = {}; // ノードカラムの幅を保存
        this.edgeColumnWidths = {}; // エッジカラムの幅を保存
        this.isResizing = false;
        this.startY = 0;
        this.startHeight = 0;
        this.minHeight = 150;
        this.defaultHeight = 300;
    }

    initialize() {
        this.panel = document.getElementById('table-panel');
        this.resizeHandle = document.getElementById('table-resize-handle');
        
        if (!this.panel || !this.resizeHandle) {
            console.error('Table panel elements not found');
            return;
        }

        this.setupEventListeners();
        
        // 初期高さ設定
        this.panel.style.height = `${this.defaultHeight}px`;
        
        // 互換性のためグローバルに登録
        window.tablePanel = this;
    }

    setupEventListeners() {
        // タブ切り替え
        const nodeTblTab = document.getElementById('node-table-tab');
        const edgeTableTab = document.getElementById('edge-table-tab');
        
        if (nodeTblTab) {
            nodeTblTab.addEventListener('click', () => this.switchTab('node'));
        }
        if (edgeTableTab) {
            edgeTableTab.addEventListener('click', () => this.switchTab('edge'));
        }

        // リサイズハンドル
        this.resizeHandle.addEventListener('mousedown', (e) => this.startResize(e));
        document.addEventListener('mousemove', (e) => this.doResize(e));
        document.addEventListener('mouseup', () => this.stopResize());

        // カラム設定ボタン
        const columnBtn = document.getElementById('table-column-settings-btn');
        if (columnBtn) {
            columnBtn.addEventListener('click', () => this.openColumnSettings());
        }

        // カラム設定モーダルのイベント
        const columnModal = document.getElementById('column-settings-modal');
        if (columnModal) {
            const closeBtn = columnModal.querySelector('.modal-close');
            const applyBtn = document.getElementById('column-settings-apply');
            const cancelBtn = document.getElementById('column-settings-cancel');
            
            if (closeBtn) closeBtn.addEventListener('click', () => this.closeColumnSettings());
            if (applyBtn) applyBtn.addEventListener('click', () => this.applyColumnSettings());
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeColumnSettings());
            
            // モーダル外クリックで閉じる
            columnModal.addEventListener('click', (e) => {
                if (e.target === columnModal) {
                    this.closeColumnSettings();
                }
            });
        }

        // Cytoscape選択イベントとの連動
        if (networkManager && networkManager.cy) {
            networkManager.cy.on('select', (e) => {
                if (this.isVisible) {
                    this.highlightSelectedElements();
                }
            });
            
            networkManager.cy.on('unselect', (e) => {
                if (this.isVisible) {
                    this.highlightSelectedElements();
                }
            });
        }
    }

    openPanel() {
        if (!this.panel) return;
        this.isVisible = true;
        this.panel.classList.add('active');
        
        // cy-containerのサイズを調整
        const cyContainer = document.getElementById('cy-container');
        if (cyContainer) {
            const panelHeight = this.panel.offsetHeight;
            cyContainer.style.bottom = `${panelHeight}px`;
        }
        
        // Cytoscapeをリサイズ
        if (networkManager && networkManager.cy) {
            networkManager.cy.resize();
        }
        
        // テーブルデータを更新
        this.refreshTable();
        
        // メニューのチェックマークを更新
        if (menuManager) {
            menuManager.updateTablePanelCheckmark();
        }
    }

    closePanel() {
        if (!this.panel) return;
        this.isVisible = false;
        this.panel.classList.remove('active');
        
        // cy-containerのサイズを元に戻す
        const cyContainer = document.getElementById('cy-container');
        if (cyContainer) {
            cyContainer.style.bottom = '0';
        }
        
        // Cytoscapeをリサイズ
        if (networkManager && networkManager.cy) {
            networkManager.cy.resize();
        }
        
        // メニューのチェックマークを更新
        if (menuManager) {
            menuManager.updateTablePanelCheckmark();
        }
    }

    togglePanel() {
        if (this.isVisible) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // タブのアクティブ状態を更新
        const nodeTab = document.getElementById('node-table-tab');
        const edgeTab = document.getElementById('edge-table-tab');
        
        if (nodeTab && edgeTab) {
            if (tab === 'node') {
                nodeTab.classList.add('active');
                edgeTab.classList.remove('active');
            } else {
                nodeTab.classList.remove('active');
                edgeTab.classList.add('active');
            }
        }
        
        // テーブルを更新
        this.refreshTable();
    }

    refreshTable() {
        if (!networkManager || !networkManager.hasNetwork()) {
            this.renderEmptyTable();
            return;
        }

        if (this.currentTab === 'node') {
            this.renderNodeTable();
        } else {
            this.renderEdgeTable();
        }
    }

    /**
     * 全カラムを表示するようにリセット（ファイル読み込み時に使用）
     */
    resetToShowAllColumns() {
        if (!networkManager || !networkManager.hasNetwork()) return;
        
        const nodes = networkManager.cy.nodes();
        const edges = networkManager.cy.edges();
        
        // 全カラムを表示するよう更新
        this.updateAvailableColumns('node', nodes, true);
        this.updateAvailableColumns('edge', edges, true);
        
        // テーブルが表示されている場合は更新
        if (this.isVisible) {
            this.refreshTable();
        }
    }

    renderNodeTable() {
        const tbody = document.querySelector('#table-panel tbody');
        const thead = document.querySelector('#table-panel thead');
        
        if (!tbody || !thead) return;

        const nodes = networkManager.cy.nodes();
        
        // 利用可能なカラムを更新
        this.updateAvailableColumns('node', nodes);
        
        // ヘッダーを生成
        thead.innerHTML = '';
        const headerRow = document.createElement('tr');
        
        Array.from(this.visibleNodeColumns).forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            th.classList.add('sortable');
            th.dataset.column = col;
            
            // 保存された幅があればそれを使用、なければデフォルト
            const savedWidth = this.nodeColumnWidths[col];
            const width = savedWidth || '120px';
            th.style.width = width;
            if (savedWidth) {
                th.style.minWidth = width;
            }
            
            // ソートアイコン
            if (this.sortColumn === col) {
                th.classList.add(this.sortOrder);
                const icon = this.sortOrder === 'asc' ? ' ▲' : ' ▼';
                th.textContent += icon;
            }
            
            // ソートイベント
            th.addEventListener('click', () => this.sortTable(col));
            
            // カラム幅リサイズ
            this.makeColumnResizable(th, 'node');
            
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        
        // データ行を生成
        tbody.innerHTML = '';
        
        let nodeData = nodes.map(node => {
            const data = node.data();
            const row = {};
            Array.from(this.visibleNodeColumns).forEach(col => {
                row[col] = data[col] !== undefined ? data[col] : '';
            });
            row._element = node;
            return row;
        });
        
        // ソート適用
        if (this.sortColumn && this.visibleNodeColumns.has(this.sortColumn)) {
            nodeData = this.sortData(nodeData, this.sortColumn);
        }
        
        nodeData.forEach(rowData => {
            const tr = document.createElement('tr');
            tr.dataset.elementId = rowData._element.id();
            
            // 選択状態を反映
            if (rowData._element.selected()) {
                tr.classList.add('selected');
            }
            
            // 行クリックで選択
            tr.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    // Ctrl/Cmdキーで複数選択
                    if (rowData._element.selected()) {
                        rowData._element.unselect();
                    } else {
                        rowData._element.select();
                    }
                } else {
                    // 通常クリックで単一選択
                    networkManager.cy.elements().unselect();
                    rowData._element.select();
                }
            });
            
            Array.from(this.visibleNodeColumns).forEach(col => {
                const td = document.createElement('td');
                td.textContent = rowData[col];
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
    }

    renderEdgeTable() {
        const tbody = document.querySelector('#table-panel tbody');
        const thead = document.querySelector('#table-panel thead');
        
        if (!tbody || !thead) return;

        const edges = networkManager.cy.edges();
        
        // 利用可能なカラムを更新
        this.updateAvailableColumns('edge', edges);
        
        // ヘッダーを生成
        thead.innerHTML = '';
        const headerRow = document.createElement('tr');
        
        Array.from(this.visibleEdgeColumns).forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            th.classList.add('sortable');
            th.dataset.column = col;
            
            // 保存された幅があればそれを使用、なければデフォルト
            const savedWidth = this.edgeColumnWidths[col];
            const width = savedWidth || '120px';
            th.style.width = width;
            if (savedWidth) {
                th.style.minWidth = width;
            }
            
            // ソートアイコン
            if (this.sortColumn === col) {
                th.classList.add(this.sortOrder);
                const icon = this.sortOrder === 'asc' ? ' ▲' : ' ▼';
                th.textContent += icon;
            }
            
            // ソートイベント
            th.addEventListener('click', () => this.sortTable(col));
            
            // カラム幅リサイズ
            this.makeColumnResizable(th, 'edge');
            
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        
        // データ行を生成
        tbody.innerHTML = '';
        
        let edgeData = edges.map(edge => {
            const data = edge.data();
            const row = {};
            Array.from(this.visibleEdgeColumns).forEach(col => {
                row[col] = data[col] !== undefined ? data[col] : '';
            });
            row._element = edge;
            return row;
        });
        
        // ソート適用
        if (this.sortColumn && this.visibleEdgeColumns.has(this.sortColumn)) {
            edgeData = this.sortData(edgeData, this.sortColumn);
        }
        
        edgeData.forEach(rowData => {
            const tr = document.createElement('tr');
            tr.dataset.elementId = rowData._element.id();
            
            // 選択状態を反映
            if (rowData._element.selected()) {
                tr.classList.add('selected');
            }
            
            // 行クリックで選択
            tr.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    // Ctrl/Cmdキーで複数選択
                    if (rowData._element.selected()) {
                        rowData._element.unselect();
                    } else {
                        rowData._element.select();
                    }
                } else {
                    // 通常クリックで単一選択
                    networkManager.cy.elements().unselect();
                    rowData._element.select();
                }
            });
            
            Array.from(this.visibleEdgeColumns).forEach(col => {
                const td = document.createElement('td');
                td.textContent = rowData[col];
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
    }

    renderEmptyTable() {
        const tbody = document.querySelector('#table-panel tbody');
        const thead = document.querySelector('#table-panel thead');
        
        if (thead) thead.innerHTML = '';
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="100" style="text-align: center; padding: 20px; color: #999;">No data available</td></tr>';
        }
    }

    updateAvailableColumns(type, elements, showAll = false) {
        const allColumns = new Set();
        
        elements.forEach(ele => {
            const data = ele.data();
            Object.keys(data).forEach(key => {
                if (key !== 'id' || type === 'node') { // edgeの場合はidを除外しない
                    allColumns.add(key);
                }
            });
        });
        
        if (type === 'node') {
            // 基本カラムを保持
            ['id', 'name', 'label'].forEach(col => allColumns.add(col));
            this.nodeColumns = Array.from(allColumns);
            
            if (showAll) {
                // 全カラムを表示
                this.visibleNodeColumns = new Set(this.nodeColumns);
            } else {
                // 既存の表示設定を維持
                this.visibleNodeColumns = new Set(
                    this.nodeColumns.filter(col => 
                        this.visibleNodeColumns.has(col) || 
                        ['id', 'name', 'label'].includes(col)
                    )
                );
            }
        } else {
            // 基本カラムを保持
            ['id', 'source', 'target', 'interaction'].forEach(col => allColumns.add(col));
            this.edgeColumns = Array.from(allColumns);
            
            if (showAll) {
                // 全カラムを表示
                this.visibleEdgeColumns = new Set(this.edgeColumns);
            } else {
                // 既存の表示設定を維持
                this.visibleEdgeColumns = new Set(
                    this.edgeColumns.filter(col => 
                        this.visibleEdgeColumns.has(col) || 
                        ['id', 'source', 'target', 'interaction'].includes(col)
                    )
                );
            }
        }
    }

    sortTable(column) {
        if (this.sortColumn === column) {
            // 同じカラムをクリックした場合は昇順/降順を切り替え
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortOrder = 'asc';
        }
        
        this.refreshTable();
    }

    sortData(data, column) {
        return data.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];
            
            // 数値として比較可能か確認
            const numA = parseFloat(valA);
            const numB = parseFloat(valB);
            
            if (!isNaN(numA) && !isNaN(numB)) {
                return this.sortOrder === 'asc' ? numA - numB : numB - numA;
            }
            
            // 文字列として比較
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            
            if (this.sortOrder === 'asc') {
                return valA < valB ? -1 : valA > valB ? 1 : 0;
            } else {
                return valA > valB ? -1 : valA < valB ? 1 : 0;
            }
        });
    }

    highlightSelectedElements() {
        const tbody = document.querySelector('#table-panel tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const elementId = row.dataset.elementId;
            if (elementId) {
                const element = networkManager.cy.getElementById(elementId);
                if (element.length > 0 && element.selected()) {
                    row.classList.add('selected');
                } else {
                    row.classList.remove('selected');
                }
            }
        });
    }

    openColumnSettings() {
        const modal = document.getElementById('column-settings-modal');
        if (!modal) return;

        // チェックボックスリストを生成
        const checkboxList = document.getElementById('column-checkboxes');
        if (!checkboxList) return;

        checkboxList.innerHTML = '';
        
        const columns = this.currentTab === 'node' ? this.nodeColumns : this.edgeColumns;
        const visibleColumns = this.currentTab === 'node' ? this.visibleNodeColumns : this.visibleEdgeColumns;
        
        columns.forEach(col => {
            const label = document.createElement('label');
            label.classList.add('column-checkbox-item');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = col;
            checkbox.checked = visibleColumns.has(col);
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(col));
            
            checkboxList.appendChild(label);
        });
        
        modal.classList.add('active');
    }

    closeColumnSettings() {
        const modal = document.getElementById('column-settings-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    applyColumnSettings() {
        const checkboxList = document.getElementById('column-checkboxes');
        if (!checkboxList) return;

        const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
        const selectedColumns = new Set();
        
        checkboxes.forEach(cb => {
            if (cb.checked) {
                selectedColumns.add(cb.value);
            }
        });
        
        if (this.currentTab === 'node') {
            this.visibleNodeColumns = selectedColumns;
        } else {
            this.visibleEdgeColumns = selectedColumns;
        }
        
        this.closeColumnSettings();
        this.refreshTable();
    }

    makeColumnResizable(th, type) {
        const resizer = document.createElement('div');
        resizer.classList.add('column-resizer');
        th.appendChild(resizer);
        
        let startX = 0;
        let startWidth = 0;
        
        resizer.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startX = e.pageX;
            startWidth = th.offsetWidth;
            
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            
            const mouseMoveHandler = (e) => {
                const newWidth = startWidth + (e.pageX - startX);
                if (newWidth > 50) { // 最小幅
                    th.style.width = `${newWidth}px`;
                    th.style.minWidth = `${newWidth}px`;
                }
            };
            
            const mouseUpHandler = () => {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                // リサイズ後の幅を保存
                const columnName = th.dataset.column;
                const finalWidth = th.style.width;
                if (type === 'node') {
                    this.nodeColumnWidths[columnName] = finalWidth;
                } else {
                    this.edgeColumnWidths[columnName] = finalWidth;
                }
                
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
    }

    startResize(e) {
        this.isResizing = true;
        this.startY = e.clientY;
        this.startHeight = this.panel.offsetHeight;
        e.preventDefault();
    }

    doResize(e) {
        if (!this.isResizing) return;
        
        const deltaY = this.startY - e.clientY; // 上にドラッグで高さが増える
        const newHeight = this.startHeight + deltaY;
        
        if (newHeight >= this.minHeight) {
            this.panel.style.height = `${newHeight}px`;
            
            // cy-containerのサイズを調整
            const cyContainer = document.getElementById('cy-container');
            if (cyContainer) {
                cyContainer.style.bottom = `${newHeight}px`;
            }
            
            // Cytoscapeをリサイズ
            if (networkManager && networkManager.cy) {
                networkManager.cy.resize();
            }
        }
    }

    stopResize() {
        if (this.isResizing) {
            this.isResizing = false;
        }
    }
}

// グローバルインスタンスは app.js で生成
