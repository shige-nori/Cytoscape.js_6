/**
 * FilterEval - 共通のフィルター評価ユーティリティ
 * Exported functions aim to keep existing function names used across panels
 * to minimize changes required elsewhere.
 */
export function evaluateSingleValue(value, operator, targetValue) {
    if (value === null || value === undefined) {
        value = '';
    }

    const numValue = Number(value);
    const numTarget = Number(targetValue);
    const isNumeric = !isNaN(numValue) && !isNaN(numTarget) && value !== '' && targetValue !== '';

    if (isNumeric) {
        switch (operator) {
            case '=': return numValue === numTarget;
            case '>=': return numValue >= numTarget;
            case '>': return numValue > numTarget;
            case '<': return numValue < numTarget;
            case '<=': return numValue <= numTarget;
            case '<>': return numValue !== numTarget;
            default: return false;
        }
    }

    const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
    const rawValue = String(value);
    const rawTarget = String(targetValue);

    if (ymdRegex.test(rawValue) && ymdRegex.test(rawTarget)) {
        switch (operator) {
            case '=': return rawValue === rawTarget;
            case '>=': return rawValue >= rawTarget;
            case '>': return rawValue > rawTarget;
            case '<': return rawValue < rawTarget;
            case '<=': return rawValue <= rawTarget;
            case '<>': return rawValue !== rawTarget;
            default: return false;
        }
    }

    const strValue = rawValue.toLowerCase();
    const strTarget = rawTarget.toLowerCase();

    switch (operator) {
        case '=': return strValue === strTarget;
        case '>=': return strValue >= strTarget;
        case '>': return strValue > strTarget;
        case '<': return strValue < strTarget;
        case '<=': return strValue <= strTarget;
        case '<>': return strValue !== strTarget;
        case 'contains': return strValue.includes(strTarget);
        default: return false;
    }
}

export function evaluateCondition(value, operator, targetValue) {
    if (value === null || value === undefined) {
        value = '';
    }

    if (Array.isArray(value)) {
        return value.some(item => evaluateSingleValue(item, operator, targetValue));
    }

    return evaluateSingleValue(value, operator, targetValue);
}

export function evaluateExternalConditionValue(value, operator, targetValue) {
    // keep name compatibility with TablePanel
    return evaluateSingleValue(value, operator, targetValue);
}

export function evaluateExternalConditionSequence(value, conditions) {
    if (!conditions || conditions.length === 0) return false;

    let result = true;
    let lastLogicalOp = 'OR';

    for (let i = 0; i < conditions.length; i++) {
        const condition = conditions[i];
        const conditionResult = evaluateExternalConditionValue(value, condition.operator, condition.value);

        if (i === 0) {
            result = conditionResult;
        } else if (lastLogicalOp === 'AND') {
            result = result && conditionResult;
        } else if (lastLogicalOp === 'OR') {
            result = result || conditionResult;
        } else if (lastLogicalOp === 'NOT') {
            result = result && !conditionResult;
        }

        lastLogicalOp = condition.logicalOp || 'OR';
    }

    return result;
}

export function getMatchedIndicesForArray(items, conditions) {
    if (!items || items.length === 0 || !conditions || conditions.length === 0) return [];

    let resultSet = null;
    let lastLogicalOp = 'OR';

    conditions.forEach((condition, index) => {
        const matched = items
            .map((item, idx) => ({ item, idx }))
            .filter(({ item }) => evaluateSingleValue(item, condition.operator, condition.value))
            .map(({ idx }) => idx);

        const matchedSet = new Set(matched);

        if (index === 0) {
            resultSet = new Set(matched);
        } else if (lastLogicalOp === 'AND') {
            resultSet = new Set([...resultSet].filter(i => matchedSet.has(i)));
        } else if (lastLogicalOp === 'OR') {
            resultSet = new Set([...resultSet, ...matchedSet]);
        } else if (lastLogicalOp === 'NOT') {
            resultSet = new Set([...resultSet].filter(i => !matchedSet.has(i)));
        }

        lastLogicalOp = condition.logicalOp || 'OR';
    });

    return resultSet ? Array.from(resultSet).sort((a, b) => a - b) : [];
}
