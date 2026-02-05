#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function usage() {
    console.log('Usage: node tools/check_filter_parity.js <network.cx2> "Node FILTER" "Edge FILTER"');
    console.log('Example: node tools/check_filter_parity.js network_files/network2.cx2 "Node 所属2 = 東北大 AND Node 所属1 <> 東大" "Edge 所属2 = 東北大 AND Edge 所属1 <> 東大"');
    process.exit(1);
}

if (process.argv.length < 5) usage();

const networkPath = process.argv[2];
const nodeFilterStr = process.argv[3];
const edgeFilterStr = process.argv[4];

function readNetwork(p) {
    const raw = fs.readFileSync(p, 'utf8');
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error('Failed to parse JSON:', e.message);
        process.exit(2);
    }
}

// --- FilterEval helpers (copied/adapted) ---
function evaluateSingleValue(value, operator, targetValue) {
    if (value === null || value === undefined) value = '';
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

function evaluateExternalConditionSequence(value, conditions) {
    if (!conditions || conditions.length === 0) return false;
    let result = true;
    let lastLogicalOp = 'OR';
    for (let i = 0; i < conditions.length; i++) {
        const condition = conditions[i];
        const conditionResult = evaluateSingleValue(value, condition.operator, condition.value);
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

function getMatchedIndicesForArray(items, conditions) {
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

// --- simple parser for expressions of form: Entity Column OP Value [LOGICAL Entity Column OP Value ...]
function parseFilterString(str) {
    // Tokenize by spaces; values with spaces are not supported in this simple tool
    const tokens = str.trim().split(/\s+/);
    const conditions = [];
    let i = 0;
    while (i < tokens.length) {
        const entity = tokens[i++];
        const col = tokens[i++];
        const op = tokens[i++];
        const val = tokens[i++];
        if (!entity || !col || !op || val === undefined) {
            console.error('Failed to parse condition near:', tokens.slice(Math.max(0, i-4), i).join(' '));
            process.exit(3);
        }
        const logicalOp = (i < tokens.length) ? tokens[i++] : null; // consume logical op if present
        conditions.push({ column: (entity.toLowerCase() === 'node' ? 'node.' : 'edge.') + col, operator: op, value: val, logicalOp: logicalOp ? logicalOp.toUpperCase() : undefined });
    }
    return conditions;
}

function groupByColumn(conditions) {
    const map = new Map();
    conditions.forEach(c => {
        // remove possible prefix
        let col = c.column;
        if (col.startsWith('node.')) col = col.slice(5);
        if (col.startsWith('edge.')) col = col.slice(5);
        if (!map.has(col)) map.set(col, []);
        map.get(col).push(c);
    });
    return map;
}

function evaluateEdgeDirect(edgeObj, condMap) {
    for (const [col, conds] of condMap.entries()) {
        const edgeVal = edgeObj.v && (edgeObj.v[col] !== undefined) ? edgeObj.v[col] : undefined;
        if (edgeVal === undefined || edgeVal === null) return false;
        if (Array.isArray(edgeVal) || (typeof edgeVal === 'string' && (String(edgeVal).includes('|') || String(edgeVal).includes('\n')))) {
            let items = Array.isArray(edgeVal) ? edgeVal.map(v => String(v)) : String(edgeVal).split(/\|/).map(v => String(v));
            const matchedIdx = getMatchedIndicesForArray(items, conds);
            if (!matchedIdx || matchedIdx.length === 0) return false;
        } else {
            if (!evaluateExternalConditionSequence(edgeVal, conds)) return false;
        }
    }
    return true;
}

function evaluateNode(obj, nodeCondMap) {
    // For node matching, require all columns to be satisfied
    for (const [col, conds] of nodeCondMap.entries()) {
        const nodeVal = obj.v && (obj.v[col] !== undefined) ? obj.v[col] : undefined;
        if (nodeVal === undefined || nodeVal === null) return false;
        if (Array.isArray(nodeVal) || (typeof nodeVal === 'string' && (String(nodeVal).includes('|') || String(nodeVal).includes('\n')))) {
            let items = Array.isArray(nodeVal) ? nodeVal.map(v => String(v)) : String(nodeVal).split(/\|/).map(v => String(v));
            const matchedIdx = getMatchedIndicesForArray(items, conds);
            if (!matchedIdx || matchedIdx.length === 0) return false;
        } else {
            if (!evaluateExternalConditionSequence(nodeVal, conds)) return false;
        }
    }
    return true;
}

// Main
const network = readNetwork(networkPath);
const nodes = Array.isArray(network.nodes) ? network.nodes : [];
const edges = Array.isArray(network.edges) ? network.edges : [];

console.log('Network loaded:', nodes.length, 'nodes,', edges.length, 'edges');

const nodeConds = parseFilterString(nodeFilterStr);
const edgeConds = parseFilterString(edgeFilterStr);

// Evaluate edge direct
const edgeCondMap = groupByColumn(edgeConds.map(c => ({ ...c, column: c.column.replace(/^edge\./i, '') })));
const edgesMatchedDirect = edges.filter(e => evaluateEdgeDirect(e, edgeCondMap)).map(e => e.id);

// Evaluate node filter to get matched nodes
const nodeCondMap = groupByColumn(nodeConds.map(c => ({ ...c, column: c.column.replace(/^node\./i, '') })));
const matchedNodeIds = nodes.filter(n => evaluateNode(n, nodeCondMap)).map(n => n.id);
console.log('Matched nodes (count):', matchedNodeIds.length);

// Infer edges from matched nodes using the same logic as FilterPanel
const nodeInferredEdges = [];
const seen = new Set();
// Precompute edges incident by node id
const edgesByNode = new Map();
edges.forEach(e => {
    const s = e.s || e.source || e.source_id || e.sourceId;
    const t = e.t || e.target || e.target_id || e.targetId;
    if (s) {
        if (!edgesByNode.has(s)) edgesByNode.set(s, []);
        edgesByNode.get(s).push(e);
    }
    if (t) {
        if (!edgesByNode.has(t)) edgesByNode.set(t, []);
        edgesByNode.get(t).push(e);
    }
});

const nodeCondOnly = nodeConds.filter(c => c.column.startsWith('node.'));
if (nodeCondOnly.length > 0 && matchedNodeIds.length > 0) {
    const nodeCondMapSimple = groupByColumn(nodeCondOnly.map(c => ({ ...c, column: c.column.replace(/^node\./i, '') })));
    matchedNodeIds.forEach(nid => {
        const incident = edgesByNode.get(nid) || [];
        incident.forEach(edge => {
            // For each column group, evaluate against edge.v
            let edgeMatchesAllNonArray = true;
            const arrayIndexSets = [];
            for (const [colName, conds] of nodeCondMapSimple.entries()) {
                const edgeVal = edge.v && (edge.v[colName] !== undefined) ? edge.v[colName] : undefined;
                if (edgeVal === undefined || edgeVal === null) { edgeMatchesAllNonArray = false; break; }
                if (Array.isArray(edgeVal) || (typeof edgeVal === 'string' && (String(edgeVal).includes('|') || String(edgeVal).includes('\n')))) {
                    let items = Array.isArray(edgeVal) ? edgeVal.map(v => String(v)) : String(edgeVal).split(/\|/).map(v => String(v));
                    const matchedIdx = getMatchedIndicesForArray(items, conds);
                    arrayIndexSets.push(new Set(matchedIdx));
                } else {
                    const ok = evaluateExternalConditionSequence(edgeVal, conds);
                    if (!ok) { edgeMatchesAllNonArray = false; break; }
                }
            }
            if (!edgeMatchesAllNonArray) return;
            if (arrayIndexSets.length > 0) {
                let inter = arrayIndexSets[0];
                for (let i = 1; i < arrayIndexSets.length; i++) {
                    inter = new Set([...inter].filter(x => arrayIndexSets[i].has(x)));
                    if (inter.size === 0) return;
                }
                if (inter.size === 0) return;
            }
            if (!seen.has(edge.id)) { seen.add(edge.id); nodeInferredEdges.push(edge.id); }
        });
    });
}

console.log('Edges matched by direct Edge filter:', edgesMatchedDirect.length);
console.log('Edges inferred from Node filter:', nodeInferredEdges.length);

const directSet = new Set(edgesMatchedDirect);
const inferredSet = new Set(nodeInferredEdges);
const onlyDirect = edgesMatchedDirect.filter(id => !inferredSet.has(id));
const onlyInferred = nodeInferredEdges.filter(id => !directSet.has(id));

console.log('Only in Edge filter (count):', onlyDirect.length);
console.log('Only in Node-inferred (count):', onlyInferred.length);
if (onlyDirect.length > 0) console.log('Sample only-Edge IDs:', onlyDirect.slice(0, 20).join(', '));
if (onlyInferred.length > 0) console.log('Sample only-Node-inferred IDs:', onlyInferred.slice(0, 20).join(', '));

// Write detailed diff to a file
const out = {
    nodeFilter: nodeFilterStr,
    edgeFilter: edgeFilterStr,
    matchedNodeCount: matchedNodeIds.length,
    edgesMatchedDirectCount: edgesMatchedDirect.length,
    edgesInferredCount: nodeInferredEdges.length,
    onlyDirect: onlyDirect.slice(0, 200),
    onlyInferred: onlyInferred.slice(0, 200)
};
fs.writeFileSync(path.join(process.cwd(), 'tools', 'filter_parity_report.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('Report written to tools/filter_parity_report.json');
