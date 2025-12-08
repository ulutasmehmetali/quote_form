import { pool } from './db.js';

export async function runAutomations(submission) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, is_active, nodes, edges FROM automation_workflows WHERE is_active = TRUE`,
    );
    const active = rows.map((row) => ({
      id: row.id,
      name: row.name,
      isActive: row.is_active,
      nodes: row.nodes || [],
      edges: row.edges || [],
    }));
    for (const wf of active) {
      const nodes = wf.nodes || [];
      const edges = wf.edges || [];
      const startNodes = nodes.filter((n) => n.type === 'trigger');
      for (const start of startNodes) {
        await executeFromNode(wf, start.id, submission, nodes, edges);
      }
    }
  } catch (error) {
    console.error('Automation runtime error:', error);
  }
}

async function executeFromNode(workflow, nodeId, submission, nodes, edges, visited = new Set()) {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;

  if (node.type === 'filter_service') {
    const allowed = Array.isArray(node.data?.services) ? node.data.services : [];
    if (allowed.length && !allowed.includes(submission.serviceType)) {
      return;
    }
  }

  if (node.type === 'http_action') {
    const url = node.data?.url;
    const method = node.data?.method || 'POST';
    if (url) {
      try {
        await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...(node.data?.headers || {}) },
          body: JSON.stringify({ submission, meta: { workflowId: workflow.id, nodeId } }),
          signal: AbortSignal.timeout(Math.min(Number(node.data?.timeout || 5000), 30000)),
        });
      } catch (error) {
        console.warn('HTTP action failed', error?.message);
      }
    }
  }

  const outgoing = edges.filter((e) => e.source === nodeId);
  for (const edge of outgoing) {
    await executeFromNode(workflow, edge.target, submission, nodes, edges, visited);
  }
}
