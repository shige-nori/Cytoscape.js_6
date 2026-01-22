import { appContext } from './AppContext.js';
import { progressOverlay } from './ProgressOverlay.js';

/**
 * FilterPanel - フィルターパネル管理クラス
 * ノードとエッジのデータをフィルタリングして選択・表示を制御
 */
export class FilterPanel {
    constructor() {
        this.panel = null;
        this.isVisible = false;
        this.conditions = []; // フィルター条件の配列
        this.nextConditionId = 0;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    initialize() {
        this.panel = document.getElementById('filter-panel');
        
        if (!this.panel) {
            console.error('Filter panel element not found');
            return;
        }

        this.setupEventListeners();
        this.setupPanelDrag();
        
        // 初期条件を1つ追加
        this.addCondition();
        
    }

    setupEventListeners() {
        // Applyボタン
        const applyBtn = document.getElementById('filter-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyFilter());
        }

        // Clearボタン
        const clearBtn = document.getElementById('filter-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearFilter());
        }

        // 閉じるボタン
        const closeBtn = document.getElementById('filter-panel-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanel());
        }
    }

    setupPanelDrag() {
        if (!this.panel) return;
        const header = this.panel.querySelector('.filter-panel-header');
        if (!header) return;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('filter-panel-close-btn')) return;
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
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                const header = this.panel.querySelector('.filter-panel-header');
                if (header) header.style.cursor = 'grab';
            }
        });
    }

    /**
     * パネルを開く
     */
    openPanel() {
        if (!this.panel) return;
        
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) {
            alert('Please load a network first.');
            return;
        }

        this.panel.classList.add('active');
        this.isVisible = true;
        
        // 最初の条件のカラムリストを更新
        this.updateAllColumnSelects();
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
     * フィルター条件を追加
     */
    addCondition(afterId = null) {
        const conditionId = this.nextConditionId++;
        const condition = {
            id: conditionId,
            column: '',
            operator: '=',
            value: '',
            logicalOp: 'OR'
        };
        
        if (afterId !== null) {
            const index = this.conditions.findIndex(c => c.id === afterId);
            this.conditions.splice(index + 1, 0, condition);
        } else {
            this.conditions.push(condition);
        }
        
        this.renderConditions();
    }

    /**
     * フィルター条件を削除
     */
    removeCondition(conditionId) {
        const index = this.conditions.findIndex(c => c.id === conditionId);
        if (index !== -1) {
            this.conditions.splice(index, 1);
        }
        
        // 最低1つは条件を残す
        if (this.conditions.length === 0) {
            this.addCondition();
        }
        
        this.renderConditions();
    }

    /**
     * 全ての条件を描画
     */
    renderConditions() {
        const container = document.getElementById('filter-conditions-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.conditions.forEach((condition, index) => {
            const conditionDiv = this.createConditionElement(condition, index);
            container.appendChild(conditionDiv);
        });
    }

    /**
     * 条件要素を作成
     */
    createConditionElement(condition, index) {
        const div = document.createElement('div');
        div.className = 'filter-condition';
        div.dataset.conditionId = condition.id;
        
        // Choose Column
        const columnSelect = document.createElement('select');
        columnSelect.className = 'filter-column-select';
        columnSelect.innerHTML = '<option value="">Choose Column</option>';
        this.populateColumnOptions(columnSelect);
        columnSelect.value = condition.column;
        columnSelect.addEventListener('change', (e) => {
            condition.column = e.target.value;
            this.updateOperatorOptions(condition.id);
        });
        
        // Operator
        const operatorSelect = document.createElement('select');
        operatorSelect.className = 'filter-operator-select';
        operatorSelect.value = condition.operator;
        operatorSelect.addEventListener('change', (e) => {
            condition.operator = e.target.value;
        });
        this.updateOperatorSelectOptions(operatorSelect, condition.column);
        
        // Value
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'filter-value-input';
        valueInput.placeholder = 'Value';
        valueInput.value = condition.value;
        valueInput.addEventListener('input', (e) => {
            condition.value = e.target.value;
        });
        
        // 削除ボタン（最初の条件以外）
        let removeBtn = null;
        if (this.conditions.length > 1) {
            removeBtn = document.createElement('button');
            removeBtn.className = 'filter-remove-btn';
            removeBtn.textContent = '✕';
            removeBtn.title = 'Remove condition';
            removeBtn.addEventListener('click', () => {
                this.removeCondition(condition.id);
            });
        }
        
        // 条件の行
        const conditionRow = document.createElement('div');
        conditionRow.className = 'filter-condition-row';
        conditionRow.appendChild(columnSelect);
        conditionRow.appendChild(operatorSelect);
        conditionRow.appendChild(valueInput);
        if (removeBtn) {
            conditionRow.appendChild(removeBtn);
        }
        
        div.appendChild(conditionRow);
        
        // 論理演算子（最後の条件以外）
        if (index < this.conditions.length - 1) {
            const logicalRow = document.createElement('div');
            logicalRow.className = 'filter-logical-row';
            
            const logicalSelect = document.createElement('select');
            logicalSelect.className = 'filter-logical-select';
            logicalSelect.innerHTML = `
                <option value="AND">AND</option>
                <option value="OR" selected>OR</option>
                <option value="NOT">NOT</option>
            `;
            logicalSelect.value = condition.logicalOp;
            logicalSelect.addEventListener('change', (e) => {
                condition.logicalOp = e.target.value;
            });
            
            logicalRow.appendChild(logicalSelect);
            div.appendChild(logicalRow);
        } else {
            // 最後の条件には「+」ボタンを追加
            const addRow = document.createElement('div');
            addRow.className = 'filter-add-row';
            
            const addBtn = document.createElement('button');
            addBtn.className = 'filter-add-btn';
            addBtn.textContent = '+ Add Condition';
            addBtn.addEventListener('click', () => {
                // この条件に論理演算子を追加
                condition.logicalOp = 'AND';
                this.addCondition(condition.id);
            });
            
            addRow.appendChild(addBtn);
            div.appendChild(addRow);
        }
        
        return div;
    }

    /**
     * カラム選択肢を設定
     */
    populateColumnOptions(selectElement) {
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return;
        
        const columns = this.getAvailableColumns();
        
        columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col.value;
            option.textContent = col.label;
            selectElement.appendChild(option);
        });
    }

    /**
     * 利用可能なカラムを取得
     */
    getAvailableColumns() {
        const columns = [];
        
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return columns;
        
        const nodes = appContext.networkManager.cy.nodes();
        const edges = appContext.networkManager.cy.edges();
        const nodeColumnMap = new Map();
        const edgeColumnMap = new Map();
        
        // ノードのカラム
        if (nodes.length > 0) {
            const excludedColumns = ['_originalBg', '_hoverOriginalBg', '_hoverOriginalOpacity', 'name', 'label', 'Label'];

            nodes.forEach(node => {
                const nodeData = node.data();
                Object.keys(nodeData).forEach(key => {
                    if (excludedColumns.includes(key)) return;
                    if (!nodeColumnMap.has(key)) {
                        nodeColumnMap.set(key, this.detectDataType(nodeData[key]));
                    }
                });
            });
        }
        
        // エッジのカラム
        if (edges.length > 0) {
            const excludedColumns = ['_originalLineColor', '_originalWidth', '_hoverOriginalLineColor', '_hoverOriginalOpacity', 'interaction'];

            edges.forEach(edge => {
                const edgeData = edge.data();
                Object.keys(edgeData).forEach(key => {
                    if (excludedColumns.includes(key)) return;
                    if (!edgeColumnMap.has(key)) {
                        edgeColumnMap.set(key, this.detectDataType(edgeData[key]));
                    }
                });
            });
        }

        nodeColumnMap.forEach((type, key) => {
            columns.push({
                value: `node.${key}`,
                label: `Node ${key}`,
                type
            });
        });

        edgeColumnMap.forEach((type, key) => {
            columns.push({
                value: `edge.${key}`,
                label: `Edge ${key}`,
                type
            });
        });
        
        return columns;
    }

    /**
     * データ型を検出
     */
    detectDataType(value) {
        if (value === null || value === undefined) return 'string';
        
        if (typeof value === 'number') return 'number';
        
        // 日付形式の検出（簡易）
        if (typeof value === 'string') {
            // ISO 8601形式やタイムスタンプなど
            if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{13}$/.test(value)) {
                return 'date';
            }
        }
        
        return 'string';
    }

    /**
     * 演算子選択肢を更新
     */
    updateOperatorSelectOptions(selectElement, columnValue) {
        // すべてのデータ型で全ての演算子を使用可能に
        selectElement.innerHTML = `
            <option value="=">=</option>
            <option value=">=">≧</option>
            <option value=">">></option>
            <option value="<"><</option>
            <option value="<=">≦</option>
            <option value="<>"><></option>
        `;
    }

    /**
     * 特定の条件の演算子選択肢を更新
     */
    updateOperatorOptions(conditionId) {
        const condition = this.conditions.find(c => c.id === conditionId);
        if (!condition) return;
        
        const conditionDiv = this.panel.querySelector(`[data-condition-id="${conditionId}"]`);
        if (!conditionDiv) return;
        
        const operatorSelect = conditionDiv.querySelector('.filter-operator-select');
        if (operatorSelect) {
            this.updateOperatorSelectOptions(operatorSelect, condition.column);
            condition.operator = operatorSelect.value;
        }
    }

    /**
     * 全てのカラム選択肢を更新
     */
    updateAllColumnSelects() {
        const selects = this.panel.querySelectorAll('.filter-column-select');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Choose Column</option>';
            this.populateColumnOptions(select);
            select.value = currentValue;
        });
    }

    /**
     * フィルターを適用
     */
    applyFilter() {
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return;

        // Path TraceがONならOFFにしてから適用
        if (appContext.pathTracePanel && appContext.pathTracePanel.isEnabled) {
            appContext.pathTracePanel.togglePathTrace(false);
        }

        // UIの最新値を条件に反映
        this.syncConditionsFromUI();
        
        // 条件の検証
        const validConditions = this.conditions.filter(c => c.column && c.value);
        
        if (validConditions.length === 0) {
            alert('Please specify at least one filter condition.');
            return;
        }
        
        // プログレスオーバーレイを表示
        progressOverlay.show('Applying filter...');
        
        // フィルター処理を非同期で実行（UIをブロックしないため）
        setTimeout(() => {
            // フィルター処理
            const nodes = appContext.networkManager.cy.nodes();
            const edges = appContext.networkManager.cy.edges();
            
            const matchedNodes = [];
            const matchedEdges = [];
            
            // ノードをフィルタリング
            nodes.forEach(node => {
                if (this.evaluateConditions(node, 'node', validConditions)) {
                    matchedNodes.push(node);
                }
            });
            
            // エッジをフィルタリング
            edges.forEach(edge => {
                if (this.evaluateConditions(edge, 'edge', validConditions)) {
                    matchedEdges.push(edge);
                }
            });
            
            // 結果を適用
            this.applyFilterResults(matchedNodes, matchedEdges);
            
            // プログレスオーバーレイを非表示
            progressOverlay.hide();
        }, 50);
    }

    /**
     * 画面上の入力値をconditionsに同期
     */
    syncConditionsFromUI() {
        const container = document.getElementById('filter-conditions-container');
        if (!container) return;

        container.querySelectorAll('.filter-condition').forEach(conditionDiv => {
            const id = Number(conditionDiv.dataset.conditionId);
            const condition = this.conditions.find(c => c.id === id);
            if (!condition) return;

            const columnSelect = conditionDiv.querySelector('.filter-column-select');
            const operatorSelect = conditionDiv.querySelector('.filter-operator-select');
            const valueInput = conditionDiv.querySelector('.filter-value-input');
            const logicalSelect = conditionDiv.querySelector('.filter-logical-select');

            if (columnSelect) condition.column = columnSelect.value;
            if (operatorSelect) condition.operator = operatorSelect.value;
            if (valueInput) condition.value = valueInput.value;
            if (logicalSelect) condition.logicalOp = logicalSelect.value;
        });
    }

    /**
     * 条件を評価
     */
    evaluateConditions(element, elementType, conditions) {
        // この要素タイプに関連する条件のみを抽出
        const relevantConditions = conditions.filter(c => {
            const [type] = c.column.split('.');
            return type === elementType;
        });
        
        // この要素タイプに関連する条件がない場合はfalseを返す
        if (relevantConditions.length === 0) {
            return false;
        }
        
        let result = true;
        let lastLogicalOp = 'OR'; // 初期値（最初の条件用、実際には使われない）
        
        for (let i = 0; i < relevantConditions.length; i++) {
            const condition = relevantConditions[i];
            const [type, columnName] = condition.column.split('.');
            
            const value = element.data(columnName);
            const conditionResult = this.evaluateCondition(value, condition.operator, condition.value);
            
            // 最初の条件はそのまま使用
            if (i === 0) {
                result = conditionResult;
            } else {
                // 論理演算子で結合
                if (lastLogicalOp === 'AND') {
                    result = result && conditionResult;
                } else if (lastLogicalOp === 'OR') {
                    result = result || conditionResult;
                } else if (lastLogicalOp === 'NOT') {
                    result = result && !conditionResult;
                }
            }
            
            // 次の条件のために論理演算子を保存
            lastLogicalOp = condition.logicalOp || 'OR';
        }
        
        return result;
    }

    /**
     * 単一条件を評価
     */
    evaluateCondition(value, operator, targetValue) {
        // nullやundefinedの処理
        if (value === null || value === undefined) {
            value = '';
        }
        
        // 配列の場合は各要素をチェック
        if (Array.isArray(value)) {
            // 配列の要素のいずれかが条件に合致すればtrueを返す
            return value.some(item => this.evaluateSingleValue(item, operator, targetValue));
        }
        
        // 単一値の場合
        return this.evaluateSingleValue(value, operator, targetValue);
    }

    /**
     * 単一値に対する条件評価
     */
    evaluateSingleValue(value, operator, targetValue) {
        // nullやundefinedの処理
        if (value === null || value === undefined) {
            value = '';
        }
        
        // 数値変換を試みる
        const numValue = Number(value);
        const numTarget = Number(targetValue);
        const isNumeric = !isNaN(numValue) && !isNaN(numTarget) && value !== '' && targetValue !== '';
        
        if (isNumeric) {
            // 数値比較
            switch (operator) {
                case '=': return numValue === numTarget;
                case '>=': return numValue >= numTarget;
                case '>': return numValue > numTarget;
                case '<': return numValue < numTarget;
                case '<=': return numValue <= numTarget;
                case '<>': return numValue !== numTarget;
                default: return false;
            }
        } else {
            // 文字列比較（辞書順）
            const strValue = String(value).toLowerCase();
            const strTarget = String(targetValue).toLowerCase();
            
            switch (operator) {
                case '=': return strValue === strTarget;
                case '>=': return strValue >= strTarget;
                case '>': return strValue > strTarget;
                case '<': return strValue < strTarget;
                case '<=': return strValue <= strTarget;
                case '<>': return strValue !== strTarget;
                default: return false;
            }
        }
    }

    /**
     * フィルター結果を適用
     */
    applyFilterResults(matchedNodes, matchedEdges) {
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return;
        
        const allNodes = appContext.networkManager.cy.nodes();
        const allEdges = appContext.networkManager.cy.edges();
        
        // すべての選択を解除
        appContext.networkManager.cy.elements().unselect();
        
        // 選択可能にしてから選択（Path Trace等で選択が無効でも反映するため）
        matchedNodes.forEach(node => node.selectify());
        matchedEdges.forEach(edge => edge.selectify());

        // 条件に合致した要素を選択
        matchedNodes.forEach(node => node.select());
        matchedEdges.forEach(edge => edge.select());
        
        // 条件に合致しない要素を薄く表示（透明度80%）
        allNodes.forEach(node => {
            if (!matchedNodes.includes(node)) {
                node.style('opacity', 0.8);
            } else {
                node.style('opacity', 1);
            }
        });
        
        allEdges.forEach(edge => {
            if (!matchedEdges.includes(edge)) {
                edge.style('opacity', 0.8);
            } else {
                edge.style('opacity', 1);
            }
        });
        
        // Table Panelを更新
        if (appContext.tablePanel && appContext.tablePanel.isVisible) {
            appContext.tablePanel.refreshTable();
        }
        
    }

    /**
     * フィルターをクリア
     */
    clearFilter() {
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return;
        
        // すべての選択を解除
        appContext.networkManager.cy.elements().unselect();
        
        // すべての要素の透明度をリセット
        appContext.networkManager.cy.elements().style('opacity', 1);
        
        // 条件をリセット
        this.conditions = [];
        this.addCondition();
        
        // Table Panelを更新
        if (appContext.tablePanel && appContext.tablePanel.isVisible) {
            appContext.tablePanel.refreshTable();
        }
        
    }
}
