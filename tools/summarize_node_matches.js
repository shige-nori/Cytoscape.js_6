#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readJSON(p) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const networkPath = process.argv[2] || 'network_files/network2.cx2';
const matchesPath = process.argv[3] || 'tools/node_matches_details.json';

const network = readJSON(networkPath);
const matches = readJSON(matchesPath);

const nodes = Array.isArray(network.nodes) ? network.nodes : [];
const edges = Array.isArray(network.edges) ? network.edges : [];

// build edgesByNode map
const edgesByNode = new Map();
edges.forEach(e => {
    const s = e.s || e.source || e.source_id || e.sourceId;
    const t = e.t || e.target || e.target_id || e.targetId;
    if (s) { if (!edgesByNode.has(s)) edgesByNode.set(s, []); edgesByNode.get(s).push(e); }
    if (t) { if (!edgesByNode.has(t)) edgesByNode.set(t, []); edgesByNode.get(t).push(e); }
});

const matchedNodes = matches.nodes || [];
const incidentCounts = [];
let totalEdgesChecked = 0;
let count所属1Empty = 0;
let count所属2Empty = 0;
let countBothEmpty = 0;

const perNode = matchedNodes.map(n => {
    const nid = n.id;
    const incident = edgesByNode.get(nid) || [];
    incidentCounts.push(incident.length);
    totalEdgesChecked += incident.length;
    let node所属1Empty = 0, node所属2Empty = 0, nodeBothEmpty = 0;
    incident.forEach(e => {
        const a1 = e.v && e.v['所属1'];
        const a2 = e.v && e.v['所属2'];
        const empty1 = (a1 === undefined || a1 === null || (Array.isArray(a1) && a1.every(x=>String(x).trim()==='')) || (String(a1).trim()===''));
        const empty2 = (a2 === undefined || a2 === null || (Array.isArray(a2) && a2.every(x=>String(x).trim()==='')) || (String(a2).trim()===''));
        if (empty1) { count所属1Empty++; node所属1Empty++; }
        if (empty2) { count所属2Empty++; node所属2Empty++; }
        if (empty1 && empty2) { countBothEmpty++; nodeBothEmpty++; }
    });
    return { id: nid, incidentCount: incident.length, 所属1Empty: node所属1Empty, 所属2Empty: node所属2Empty, bothEmpty: nodeBothEmpty };
});

function stats(arr) {
    const sorted = arr.slice().sort((a,b)=>a-b);
    const sum = arr.reduce((s,x)=>s+x,0);
    const mean = arr.length ? sum/arr.length : 0;
    const median = arr.length ? (sorted.length%2===1 ? sorted[(sorted.length-1)/2] : (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2) : 0;
    return { count: arr.length, min: sorted[0]||0, max: sorted[sorted.length-1]||0, mean, median };
}

const s = stats(incidentCounts);
const topNodes = perNode.slice().sort((a,b)=>b.incidentCount-a.incidentCount).slice(0,10);

const out = {
    matchedNodeCount: matchedNodes.length,
    totalEdgesChecked,
    incidentStats: s,
    count所属1Empty,
    count所属2Empty,
    countBothEmpty,
    topNodes,
};

fs.writeFileSync(path.join(process.cwd(), 'tools', 'node_matches_summary.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote tools/node_matches_summary.json');
console.log('Summary:', JSON.stringify(out, null, 2));
