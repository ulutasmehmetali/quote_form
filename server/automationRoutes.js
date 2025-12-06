import express from 'express';
import crypto from 'crypto';
import { requireAuth, requireRole, requireCSRF } from './adminRoutes.js';
import { pool } from './db.js';

const router = express.Router();

const mapRow = (row) => ({
  id: row.id,
  name: row.name,
  isActive: row.is_active,
  nodes: row.nodes || [],
  edges: row.edges || [],
});

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, is_active, nodes, edges FROM automation_workflows ORDER BY created_at ASC`,
    );
    return res.json({ workflows: rows.map(mapRow) });
  } catch (error) {
    console.error('List automations failed:', error);
    return res.status(500).json({ error: 'Failed to load workflows' });
  }
});

router.post('/', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }
  try {
    const id = crypto.randomUUID();
    const { rows } = await pool.query(
      `INSERT INTO automation_workflows (id, name, is_active, nodes, edges) VALUES ($1, $2, TRUE, '[]'::jsonb, '[]'::jsonb) RETURNING id, name, is_active, nodes, edges`,
      [id, name.trim()],
    );
    return res.json({ workflow: mapRow(rows[0]) });
  } catch (error) {
    console.error('Create automation failed:', error);
    return res.status(500).json({ error: 'Failed to create workflow' });
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  const { name, isActive } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE automation_workflows
       SET name = COALESCE($2, name),
           is_active = COALESCE($3, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, is_active, nodes, edges`,
      [req.params.id, typeof name === 'string' ? name.trim() : null, typeof isActive === 'boolean' ? isActive : null],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json({ workflow: mapRow(rows[0]) });
  } catch (error) {
    console.error('Update automation failed:', error);
    return res.status(500).json({ error: 'Failed to update workflow' });
  }
});

router.post('/:id/save', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  const { nodes, edges } = req.body || {};
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return res.status(400).json({ error: 'nodes and edges must be arrays' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE automation_workflows
       SET nodes = $2::jsonb, edges = $3::jsonb, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, is_active, nodes, edges`,
      [req.params.id, JSON.stringify(nodes), JSON.stringify(edges)],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json({ workflow: mapRow(rows[0]) });
  } catch (error) {
    console.error('Save automation failed:', error);
    return res.status(500).json({ error: 'Failed to save workflow' });
  }
});

router.post('/:id/test', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, is_active, nodes, edges FROM automation_workflows WHERE id = $1 LIMIT 1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true, workflow: mapRow(rows[0]) });
  } catch (error) {
    console.error('Automation test failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM automation_workflows WHERE id = $1`, [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete automation failed:', error);
    return res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

const execHttp = async (node, workflow, submission) => {
  const url = node.data?.url;
  const method = node.data?.method || 'POST';
  if (!url) return;
  await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(node.data?.headers || {}) },
    body: JSON.stringify({ submission, meta: { workflowId: workflow.id, nodeId: node.id, testRun: true } }),
    signal: AbortSignal.timeout(Math.min(Number(node.data?.timeout || 5000), 30000)),
  });
};

const executeFromNode = async (workflow, nodeId, submission, nodes, edges, visited = new Set()) => {
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
    try {
      await execHttp(node, workflow, submission);
    } catch (err) {
      console.warn('Test HTTP failed', err?.message);
    }
  }

  const outgoing = edges.filter((e) => e.source === nodeId);
  for (const edge of outgoing) {
    await executeFromNode(workflow, edge.target, submission, nodes, edges, visited);
  }
};

router.post('/:id/test-run', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, is_active, nodes, edges FROM automation_workflows WHERE id = $1 LIMIT 1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const workflow = mapRow(rows[0]);
    const nodes = workflow.nodes || [];
    const edges = workflow.edges || [];
    const submission = {
      serviceType: 'Test',
      createdAt: new Date().toISOString(),
      testRun: true,
    };
    const startNodes = nodes.filter((n) => n.type === 'trigger');
    if (startNodes.length === 0 && nodes[0]) {
      await executeFromNode(workflow, nodes[0].id, submission, nodes, edges);
    } else {
      for (const start of startNodes) {
        await executeFromNode(workflow, start.id, submission, nodes, edges);
      }
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Automation test-run failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
