import { appContext } from './AppContext.js';
import { progressOverlay } from './ProgressOverlay.js';

/**
 * ModalManager - モーダルウィンドウ管理クラス
 */
export class ModalManager {
    constructor() {
        this.modal = null;
        this.tableBody = null;
        this.currentMappings = {};
        this.init();
    }

    /**
     * 初期化
     */
    init() {
        this.modal = document.getElementById('column-mapping-modal');
        this.tableBody = document.getElementById('mapping-table-body');
        
        // イベントリスナー設定
        document.getElementById('modal-close').addEventListener('click', () => this.hide());
        document.getElementById('modal-cancel').addEventListener('click', () => this.hide());
        document.getElementById('modal-import').addEventListener('click', () => this.handleImport());
        
        // 背景クリックで閉じる
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
    }

    /**
     * カラムマッピングモーダルを表示
     * @param {Array} columns - カラム名の配列
     * @param {string} mode - 'network' または 'table'
     */
    showColumnMapping(columns, mode) {
        this.tableBody.innerHTML = '';
        this.currentMappings = {};
        
        columns.forEach((column, index) => {
            // データ型を推測
            const guessedType = appContext.fileHandler.guessDataType(appContext.fileHandler.currentData, column);
            
            // デフォルトロールを設定
            let defaultRole = 'Attribute';
            if (mode === 'network') {
                if (index === 0) defaultRole = 'Source';
                else if (index === 1) defaultRole = 'Target';
            } else {
                if (index === 0) defaultRole = 'Source';
            }
            
            const row = this.createMappingRow(column, defaultRole, guessedType, mode);
            this.tableBody.appendChild(row);
            
            this.currentMappings[column] = {
                role: defaultRole,
                dataType: guessedType,
                delimiter: '|'
            };
        });
        
        this.show();
    }

    /**
     * マッピング行を作成
     */
    createMappingRow(column, defaultRole, defaultType, mode) {
        const row = document.createElement('tr');
        
        // カラム名
        const nameCell = document.createElement('td');
        nameCell.textContent = column;
        row.appendChild(nameCell);
        
        // Role選択
        const roleCell = document.createElement('td');
        const roleSelect = document.createElement('select');
        roleSelect.dataset.column = column;
        roleSelect.dataset.field = 'role';
        
        const roles = mode === 'network' 
            ? ['Source', 'Target', 'Attribute', 'None']
            : ['Source', 'Attribute', 'None'];
        
        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role;
            option.textContent = role;
            if (role === defaultRole) option.selected = true;
            roleSelect.appendChild(option);
        });
        
        roleSelect.addEventListener('change', (e) => {
            this.currentMappings[column].role = e.target.value;
        });
        
        roleCell.appendChild(roleSelect);
        row.appendChild(roleCell);
        
        // Data Type選択
        const typeCell = document.createElement('td');
        const typeSelect = document.createElement('select');
        typeSelect.dataset.column = column;
        typeSelect.dataset.field = 'dataType';
        
        const dataTypes = ['String', 'Number', 'Boolean', 'Date', 'String Array', 'Number Array', 'Date Array'];
        dataTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            if (type === defaultType) option.selected = true;
            typeSelect.appendChild(option);
        });
        
        typeSelect.addEventListener('change', (e) => {
            this.currentMappings[column].dataType = e.target.value;
            // Array型の場合はDelimiter入力を有効化
            this.updateDelimiterState(row, e.target.value);
        });
        
        typeCell.appendChild(typeSelect);
        row.appendChild(typeCell);
        
        // Delimiter入力
        const delimiterCell = document.createElement('td');
        const delimiterInput = document.createElement('input');
        delimiterInput.type = 'text';
        delimiterInput.value = '|';
        delimiterInput.className = 'delimiter-input';
        delimiterInput.dataset.column = column;
        delimiterInput.dataset.field = 'delimiter';
        
        // Array型でない場合は非表示
        const isArrayType = defaultType.includes('Array');
        if (!isArrayType) {
            delimiterCell.style.display = 'none';
        }
        
        delimiterInput.addEventListener('change', (e) => {
            this.currentMappings[column].delimiter = e.target.value || '|';
        });
        
        delimiterCell.appendChild(delimiterInput);
        row.appendChild(delimiterCell);
        
        return row;
    }

    /**
     * Delimiter入力の状態を更新
     */
    updateDelimiterState(row, dataType) {
        const delimiterCell = row.querySelector('.delimiter-input').closest('td');
        if (delimiterCell) {
            const isArrayType = dataType.includes('Array');
            delimiterCell.style.display = isArrayType ? '' : 'none';
        }
    }

    /**
     * インポート処理
     */
    handleImport() {
        // Source列があるか確認
        const hasSource = Object.values(this.currentMappings).some(m => m.role === 'Source');
        if (!hasSource) {
            alert('Please select a Source column.');
            return;
        }
        
        this.hide();
        
        // プログレスオーバーレイを表示
        progressOverlay.show('Importing data...');
        
        // UIをブロックしないよう非同期処理
        setTimeout(() => {
            appContext.fileHandler.executeImport(this.currentMappings).catch(error => {
                progressOverlay.hide();
                alert('Import error: ' + error.message);
            });
        }, 50);
    }

    /**
     * モーダルを表示
     */
    show() {
        this.modal.classList.add('active');
    }

    /**
     * モーダルを非表示
     */
    hide() {
        this.modal.classList.remove('active');
    }
}
