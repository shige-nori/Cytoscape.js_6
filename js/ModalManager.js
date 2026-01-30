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
        
        // 確認モーダルの初期化
        this.confirmModal = document.getElementById('confirm-modal');
        this.confirmModalMessage = document.getElementById('confirm-modal-message');
        this.confirmModalOk = document.getElementById('confirm-modal-ok');
        this.confirmModalCancel = document.getElementById('confirm-modal-cancel');
        this.confirmModalClose = document.getElementById('confirm-modal-close');
        
        // 確認モーダルイベントリスナー
        this.confirmModalClose.addEventListener('click', () => this.hideConfirm());
        this.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.confirmModal) {
                this.hideConfirm();
            }
        });
        
        // 3ボタン確認モーダルの初期化
        this.threeButtonConfirmModal = document.getElementById('three-button-confirm-modal');
        this.threeButtonConfirmMessage = document.getElementById('three-button-confirm-message');
        this.threeButtonConfirmApply = document.getElementById('three-button-confirm-apply');
        this.threeButtonConfirmDiscard = document.getElementById('three-button-confirm-discard');
        this.threeButtonConfirmClose = document.getElementById('three-button-confirm-close');
        
        // 3ボタン確認モーダルイベントリスナー
        this.threeButtonConfirmClose.addEventListener('click', () => this.hideThreeButtonConfirm());
        this.threeButtonConfirmModal.addEventListener('click', (e) => {
            if (e.target === this.threeButtonConfirmModal) {
                this.hideThreeButtonConfirm();
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
        
        const dataTypes = ['String', 'Number', 'Boolean', 'String Array', 'Number Array'];
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

    /**
     * 確認モーダルを表示
     * @param {string} message - 表示するメッセージ
     * @returns {Promise<boolean>} OKがクリックされた場合true、キャンセルの場合false
     */
    showConfirm(message) {
        return new Promise((resolve) => {
            this.confirmModalMessage.textContent = message;
            this.confirmModal.classList.add('active');
            
            const handleOk = () => {
                cleanup();
                resolve(true);
            };
            
            const handleCancel = () => {
                cleanup();
                resolve(false);
            };
            
            const cleanup = () => {
                this.confirmModalOk.removeEventListener('click', handleOk);
                this.confirmModalCancel.removeEventListener('click', handleCancel);
                this.hideConfirm();
            };
            
            this.confirmModalOk.addEventListener('click', handleOk);
            this.confirmModalCancel.addEventListener('click', handleCancel);
        });
    }

    /**
     * 確認モーダルを非表示
     */
    hideConfirm() {
        this.confirmModal.classList.remove('active');
    }

    /**
     * 3ボタン確認モーダルを表示
     * @param {string} message - 表示するメッセージ
     * @param {string} applyLabel - 適用ボタンのラベル
     * @param {string} discardLabel - 破棄ボタンのラベル
     * @returns {Promise<string>} 'apply', 'discard', 'cancel'のいずれか
     */
    showThreeButtonConfirm(message, applyLabel = '適用', discardLabel = '破棄') {
        return new Promise((resolve) => {
            this.threeButtonConfirmMessage.textContent = message;
            this.threeButtonConfirmApply.textContent = applyLabel;
            this.threeButtonConfirmDiscard.textContent = discardLabel;
            this.threeButtonConfirmModal.classList.add('active');
            
            const handleApply = () => {
                cleanup();
                resolve('apply');
            };
            
            const handleDiscard = () => {
                cleanup();
                resolve('discard');
            };
            
            const handleClose = () => {
                cleanup();
                resolve('cancel');
            };
            
            const cleanup = () => {
                this.threeButtonConfirmApply.removeEventListener('click', handleApply);
                this.threeButtonConfirmDiscard.removeEventListener('click', handleDiscard);
                this.threeButtonConfirmClose.removeEventListener('click', handleClose);
                this.hideThreeButtonConfirm();
            };
            
            this.threeButtonConfirmApply.addEventListener('click', handleApply);
            this.threeButtonConfirmDiscard.addEventListener('click', handleDiscard);
            this.threeButtonConfirmClose.addEventListener('click', handleClose);
        });
    }

    /**
     * 3ボタン確認モーダルを非表示
     */
    hideThreeButtonConfirm() {
        this.threeButtonConfirmModal.classList.remove('active');
    }

    /**
     * カスタム確認ダイアログを動的に表示（以前のStylePanelの実装）
     * @param {string} message - 表示するメッセージ
     * @param {string} primaryLabel - プライマリボタンのラベル
     * @param {string} secondaryLabel - セカンダリボタンのラベル
     * @returns {Promise<string>} 'primary', 'secondary', 'cancel'のいずれか
     */
    showDynamicConfirm(message, primaryLabel = 'OK', secondaryLabel = 'キャンセル') {
        return new Promise((resolve, reject) => {
            // 既に同一モーダルが存在する場合は拒否
            if (document.getElementById('dynamic-confirm-overlay')) {
                return reject(new Error('Confirm dialog already shown'));
            }

            const overlay = document.createElement('div');
            overlay.id = 'dynamic-confirm-overlay';
            overlay.className = 'modal-overlay active';

            const content = document.createElement('div');
            content.className = 'modal-content';
            content.style.maxWidth = '420px';

            content.innerHTML = `
                <div class="modal-header">
                    <h2>確認</h2>
                    <button class="modal-close" id="dynamic-confirm-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="dynamic-confirm-secondary">${secondaryLabel}</button>
                    <button class="btn btn-primary" id="dynamic-confirm-primary">${primaryLabel}</button>
                </div>
            `;

            overlay.appendChild(content);
            document.body.appendChild(overlay);

            const cleanup = () => {
                overlay.remove();
            };

            // ボタンハンドラ
            document.getElementById('dynamic-confirm-primary').addEventListener('click', () => {
                cleanup();
                resolve('primary');
            });
            document.getElementById('dynamic-confirm-secondary').addEventListener('click', () => {
                cleanup();
                resolve('secondary');
            });
            document.getElementById('dynamic-confirm-close').addEventListener('click', () => {
                cleanup();
                resolve('cancel');
            });

            // ESC キーでキャンセル
            const onKey = (ev) => {
                if (ev.key === 'Escape') {
                    cleanup();
                    document.removeEventListener('keydown', onKey);
                    resolve('cancel');
                }
            };
            document.addEventListener('keydown', onKey);
        });
    }
}
