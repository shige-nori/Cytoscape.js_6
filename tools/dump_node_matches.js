#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

if (process.argv.length < 4) {
    console.log('Usage: node tools/dump_node_matches.js <network.cx2> "Node FILTER"');
    process.exit(1);
}

const networkPath = process.argv[2];
const nodeFilterStr = process.argv[3];

function readNetwork(p) {
    const raw = fs.readFileSync(p, 'utf8');
    try { return JSON.parse(raw); } catch (e) { console.error('parse error', e); process.exit(2); }
}

function evaluateSingleValue(value, operator, targetValue) {
    if (value === null || value === undefined) value = '';
    const numValue = Number(value);
    const numTarget = Number(targetValue);
    const isNumeric = !isNaN(numValue) && !isNaN(numTarget) && value !== '' && targetValue !== '';
    if (isNumeric) {
        switch (operator) {
            case '=': return numValue === numTarget;
            case '<>': return numValue !== numTarget;
            case '>': return numValue > numTarget;
            case '<': return numValue < numTarget;
            case '>=': return numValue >= numTarget;
            case '<=': return numValue <= numTarget;
            default: return false;
        }
    }
    const rv = String(value).toLowerCase();
    const rt = String(targetValue).toLowerCase();
    switch (operator) {
        case '=': return rv === rt;
        case '<>': return rv !== rt;
        case 'contains': return rv.includes(rt);
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
        if (i === 0) result = conditionResult;
        else if (lastLogicalOp === 'AND') result = result && conditionResult;
        else if (lastLogicalOp === 'OR') result = result || conditionResult;
        else if (lastLogicalOp === 'NOT') result = result && !conditionResult;
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
        if (index === 0) resultSet = new Set(matched);
        else if (lastLogicalOp === 'AND') resultSet = new Set([...resultSet].filter(i => matchedSet.has(i)));
        else if (lastLogicalOp === 'OR') resultSet = new Set([...resultSet, ...matchedSet]);
        else if (lastLogicalOp === 'NOT') resultSet = new Set([...resultSet].filter(i => !matchedSet.has(i)));
        lastLogicalOp = condition.logicalOp || 'OR';
    });
    return resultSet ? Array.from(resultSet).sort((a,b)=>a-b) : [];
}

function parseFilterString(str) {
    const tokens = str.trim().split(/\s+/);
    const conditions = [];
    let i = 0;
    while (i < tokens.length) {
        const entity = tokens[i++];
        const col = tokens[i++];
        const op = tokens[i++];
        const val = tokens[i++];
        const logicalOp = (i < tokens.length) ? tokens[i++] : null;
        conditions.push({ column: (entity.toLowerCase() === 'node' ? 'node.' : 'edge.') + col, operator: op, value: val, logicalOp: logicalOp ? logicalOp.toUpperCase() : undefined });
    }
    return conditions;
}

function groupByColumn(conditions) {
    const map = new Map();
    conditions.forEach(c => {
        let col = c.column;
        if (col.startsWith('node.')) col = col.slice(5);
        if (col.startsWith('edge.')) col = col.slice(5);
        if (!map.has(col)) map.set(col, []);
        map.get(col).push(c);
    });
    return map;
}

const network = readNetwork(networkPath);
const nodes = Array.isArray(network.nodes) ? network.nodes : [];
const edges = Array.isArray(network.edges) ? network.edges : [];

const nodeConds = parseFilterString(nodeFilterStr);
const nodeCondMap = groupByColumn(nodeConds.map(c=>({ ...c, column: c.column.replace(/^node\./i, '') })));

const matchedNodes = nodes.filter(n => {
    for (const [col, conds] of nodeCondMap.entries()) {
        const val = n.v && (n.v[col] !== undefined) ? n.v[col] : undefined;
        if (val === undefined || val === null) return false;
        if (Array.isArray(val) || (typeof val === 'string' && (String(val).includes('|') || String(val).includes('\n')))) {
            const items = Array.isArray(val) ? val.map(v=>String(v)) : String(val).split(/\|/).map(v=>String(v));
            if (getMatchedIndicesForArray(items, conds).length === 0) return false;
        } else {
            if (!evaluateExternalConditionSequence(val, conds)) return false;
        }
    }
    return true;
});

// build edgesByNode map (node id -> edges)
const edgesByNode = new Map();
edges.forEach(e => {
    const s = e.s || e.source || e.source_id || e.sourceId;
    const t = e.t || e.target || e.target_id || e.targetId;
    if (s) { if (!edgesByNode.has(s)) edgesByNode.set(s, []); edgesByNode.get(s).push(e); }
    if (t) { if (!edgesByNode.has(t)) edgesByNode.set(t, []); edgesByNode.get(t).push(e); }
});

const out = { nodeFilter: nodeFilterStr, matchedNodeCount: matchedNodes.length, nodes: [] };

matchedNodes.forEach(n => {
    const nid = n.id;
    const incident = edgesByNode.get(nid) || [];
    const sample = incident.slice(0, 20).map(e => {
        return {
            id: e.id,
            source: e.s || e.source || e.source_id || e.sourceId,
            target: e.t || e.target || e.target_id || e.targetId,
            所属1: e.v && e.v['所属1'] !== undefined ? e.v['所属1'] : null,
            所属2: e.v && e.v['所属2'] !== undefined ? e.v['所属2'] : null,
            keysCount: e.v ? Object.keys(e.v).length : 0
        };
    });
    out.nodes.push({ id: nid, nodeAttributes: n.v || {}, incidentCount: incident.length, incidentSample: sample });
});

fs.writeFileSync(path.join(process.cwd(), 'tools', 'node_matches_details.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote tools/node_matches_details.json (nodes:', matchedNodes.length, ')');
