self.onmessage = (event) => {
    const { text } = event.data || {};
    if (typeof text !== 'string') {
        self.postMessage({ type: 'error', message: 'Invalid CSV text' });
        return;
    }

    try {
        const rows = [];
        let currentRow = [];
        let currentValue = '';
        let inQuotes = false;

        const totalLength = text.length || 1;
        const progressInterval = 100000;
        let nextProgressUpdate = progressInterval;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentValue += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (char === ',' && !inQuotes) {
                currentRow.push(currentValue);
                currentValue = '';
                continue;
            }

            if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                currentRow.push(currentValue);
                if (currentRow.some(value => value !== '')) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentValue = '';
                continue;
            }

            currentValue += char;

            if (i >= nextProgressUpdate) {
                self.postMessage({
                    type: 'progress',
                    value: Math.min(0.99, i / totalLength)
                });
                nextProgressUpdate += progressInterval;
            }
        }

        currentRow.push(currentValue);
        if (currentRow.some(value => value !== '')) {
            rows.push(currentRow);
        }

        self.postMessage({ type: 'result', rows });
    } catch (error) {
        self.postMessage({ type: 'error', message: error.message || String(error) });
    }
};
