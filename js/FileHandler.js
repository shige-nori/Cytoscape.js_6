/**
 * FileHandler - ファイル読み込み処理クラス
 */
class FileHandler {
    constructor() {
        this.currentData = null;
        this.currentColumns = [];
        this.importMode = 'network'; // 'network' or 'table'
    }

    /**
     * Excelファイルを読み込む
     * @param {File} file - ファイルオブジェクト
     * @returns {Promise<Object>} パースされたデータ
     */
    async readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // 最初のシートを取得
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // JSONに変換
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                        header: 1,
                        raw: false,
                        defval: ''
                    });
                    
                    if (jsonData.length < 2) {
                        reject(new Error('File must contain at least header row and one data row'));
                        return;
                    }
                    
                    // ヘッダーとデータを分離
                    const headers = jsonData[0].map(h => String(h).trim());
                    const rows = jsonData.slice(1).map(row => {
                        const obj = {};
                        headers.forEach((header, index) => {
                            obj[header] = row[index] !== undefined ? row[index] : '';
                        });
                        return obj;
                    });
                    
                    resolve({
                        columns: headers,
                        data: rows
                    });
                } catch (error) {
                    reject(new Error('Failed to parse Excel file: ' + error.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Network Fileのインポート処理を開始
     * @param {File} file 
     */
    async startNetworkImport(file) {
        this.importMode = 'network';
        progressOverlay.show('Reading file...');
        
        try {
            const result = await this.readExcelFile(file);
            this.currentData = result.data;
            this.currentColumns = result.columns;
            
            progressOverlay.hide();
            modalManager.showColumnMapping(result.columns, this.importMode);
        } catch (error) {
            progressOverlay.hide();
            alert('Error: ' + error.message);
        }
    }

    /**
     * Table Fileのインポート処理を開始
     * @param {File} file 
     */
    async startTableImport(file) {
        if (!networkManager.hasNetwork()) {
            alert('Please import a network file first.');
            return;
        }

        this.importMode = 'table';
        progressOverlay.show('Reading file...');
        
        try {
            const result = await this.readExcelFile(file);
            this.currentData = result.data;
            this.currentColumns = result.columns;
            
            progressOverlay.hide();
            modalManager.showColumnMapping(result.columns, this.importMode);
        } catch (error) {
            progressOverlay.hide();
            alert('Error: ' + error.message);
        }
    }

    /**
     * マッピング設定でインポートを実行
     * @param {Object} mappings - カラムマッピング設定
     */
    executeImport(mappings) {
        try {
            if (this.importMode === 'network') {
                const result = networkManager.createNetwork(this.currentData, mappings);
                layoutManager.applyDagreLayout();
                progressOverlay.hide();
                console.log(`Network created: ${result.nodeCount} nodes, ${result.edgeCount} edges`);
            } else {
                const result = networkManager.addTableData(this.currentData, mappings);
                progressOverlay.hide();
                console.log(`Table imported: ${result.matchedCount}/${result.totalRows} rows matched`);
            }
            
            this.currentData = null;
            this.currentColumns = [];
        } catch (error) {
            progressOverlay.hide();
            alert('Import error: ' + error.message);
        }
    }

    /**
     * データ型を推測
     * @param {Array} data - データ配列
     * @param {string} column - カラム名
     * @returns {string} 推測されたデータ型
     */
    guessDataType(data, column) {
        const sampleValues = data
            .slice(0, 10)
            .map(row => row[column])
            .filter(v => v !== null && v !== undefined && v !== '');

        if (sampleValues.length === 0) return 'String';

        // 数値チェック
        const allNumbers = sampleValues.every(v => !isNaN(Number(v)));
        if (allNumbers) return 'Number';

        // ブール値チェック
        const boolValues = ['true', 'false', '0', '1', 'yes', 'no'];
        const allBooleans = sampleValues.every(v => 
            boolValues.includes(String(v).toLowerCase())
        );
        if (allBooleans) return 'Boolean';

        // 配列チェック（パイプ区切り）
        const hasDelimiter = sampleValues.some(v => String(v).includes('|'));
        if (hasDelimiter) {
            const firstWithDelimiter = sampleValues.find(v => String(v).includes('|'));
            const parts = String(firstWithDelimiter).split('|');
            const allPartsNumbers = parts.every(p => !isNaN(Number(p.trim())));
            return allPartsNumbers ? 'Number Array' : 'String Array';
        }

        return 'String';
    }
}

// グローバルインスタンス
let fileHandler;

/**
 * プログレスオーバーレイ管理
 */
const progressOverlay = {
    element: null,
    textElement: null,

    init() {
        this.element = document.getElementById('progress-overlay');
        this.textElement = this.element.querySelector('.progress-text');
    },

    show(message = 'Loading...') {
        this.textElement.textContent = message;
        this.element.classList.add('active');
    },

    hide() {
        this.element.classList.remove('active');
    }
};
