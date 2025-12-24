import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  Controls,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Handle,
  Position,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { apiUrl } from '../../lib/api';
import { useAuth } from '../context/AuthContext';

type Workflow = {
  id: string;
  name: string;
  isActive: boolean;
  nodes: Node[];
  edges: Edge[];
};

type NodeData = {
  label: string;
  description?: string;
  services?: string[];
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
};

type LogEntry = {
  id: string;
  timestamp: string;
  nodeName: string;
  eventType: 'info' | 'warning' | 'error' | 'debug';
  payload: any;
  duration?: number;
  status?: string;
};

const SERVICES = ['Roofing', 'Plumbing', 'Electrical', 'HVAC', 'Painting', 'Flooring'];
const nodeDefaults = { sourcePosition: Position.Right, targetPosition: Position.Left };

const paletteByType: Record<string, { border: string; dot: string; badge: string; label: string }> = {
  trigger: { border: 'border-sky-400/40', dot: 'bg-sky-400', badge: 'bg-sky-500/20 text-sky-100', label: 'Trigger' },
  filter_service: { border: 'border-amber-400/40', dot: 'bg-amber-400', badge: 'bg-amber-500/20 text-amber-100', label: 'Service Filter' },
  http_action: { border: 'border-emerald-400/40', dot: 'bg-emerald-400', badge: 'bg-emerald-500/20 text-emerald-100', label: 'HTTP Call' },
  end: { border: 'border-emerald-400/40', dot: 'bg-emerald-400', badge: 'bg-emerald-500/20 text-emerald-100', label: 'End' },
  branch: { border: 'border-purple-400/40', dot: 'bg-purple-400', badge: 'bg-purple-500/20 text-purple-100', label: 'Branch' },
};

const edgeColor: Record<string, string> = {
  success: '#38bdf8',
  error: '#ef4444',
  duplicate: '#f59e0b',
  default: '#94a3b8',
};

const NodeCard = ({ data, type }: { data: NodeData; type: string }) => {
  const palette = paletteByType[type] || paletteByType.trigger;
  return (
    <div className={`min-w-[200px] max-w-[260px] rounded-xl bg-slate-900/95 border ${palette.border} shadow-lg shadow-black/30 ring-1 ring-white/5`}>
      <Handle type="target" position={Position.Left} className={`w-3 h-3 rounded-full border border-white/40 ${palette.dot}`} />
      <div className="px-3 py-2 space-y-1">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${palette.badge}`}>
          {palette.label}
        </span>
        <p className="text-sm font-semibold text-white">{data.label}</p>
        {data.description && <p className="text-xs text-slate-500 mt-1 line-clamp-3">{data.description}</p>}
      </div>
      <Handle type="source" position={Position.Right} className={`w-3 h-3 rounded-full border border-white/40 ${palette.dot}`} />
    </div>
  );
};

const nodeTypes = {
  trigger: (props: any) => <NodeCard {...props} />,
  filter_service: (props: any) => <NodeCard {...props} />,
  http_action: (props: any) => <NodeCard {...props} />,
  end: (props: any) => <NodeCard {...props} />,
  branch: (props: any) => <NodeCard {...props} />,
};

function PaletteButton({ label, onClick, accent }: { label: string; onClick: () => void; accent: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition hover:-translate-y-[1px] hover:shadow-lg hover:shadow-black/30"
      style={{ borderColor: accent, color: '#e2e8f0', background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' }}
    >
      <span>{label}</span>
      <span className="text-xs opacity-70">+ add</span>
    </button>
  );
}

function Editor() {
  const { getAuthHeaders } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'debug'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedFlowId, setExpandedFlowId] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const focusWorkflowRef = useRef<string | null>(null);

  const appendLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const now = new Date().toISOString();
    setLogs((prev) => [...prev.slice(-200), { ...entry, id: crypto.randomUUID(), timestamp: now }]);
  }, []);

  const clearLogs = () => setLogs([]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, logFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const focusWorkflowId = sessionStorage.getItem('focusWorkflowId');
    if (focusWorkflowId) {
      focusWorkflowRef.current = focusWorkflowId;
      sessionStorage.removeItem('focusWorkflowId');
    }
  }, []);

  const buildPreset = useCallback(() => {
    const base = (id: string, type: string, x: number, y: number, label: string, description?: string, extra: Record<string, unknown> = {}) => ({
      id,
      type,
      position: { x, y },
      data: { label, description, ...extra },
      ...nodeDefaults,
    });

    const presetNodes: Node[] = [
      base('t1', 'trigger', 80, 180, 'Form Trigger', 'When a new form arrives'),
      base('f1', 'filter_service', 320, 140, 'Service Filter', 'Route by service', { services: ['Roofing'] }),
      base('h1', 'http_action', 560, 140, 'API Call', 'Call partner API', { url: '', method: 'POST', headers: {}, timeout: 5000 }),
      base('e1', 'end', 820, 160, 'End', 'Completed'),
    ];

    const presetEdges: Edge[] = [
      { id: 'e1', source: 't1', target: 'f1', type: 'smoothstep', data: { status: 'success' } },
      { id: 'e2', source: 'f1', target: 'h1', type: 'smoothstep', data: { status: 'success' } },
      { id: 'e3', source: 'h1', target: 'e1', type: 'smoothstep', data: { status: 'success' } },
    ];

    return { nodes: presetNodes, edges: presetEdges };
  }, []);

  const syncFromWorkflow = useCallback(
    (wf?: Workflow | null) => {
      if (!wf) return;
      if (Array.isArray(wf.nodes) && wf.nodes.length > 0) {
        setNodes(wf.nodes);
        setEdges(wf.edges || []);
      } else {
        const preset = buildPreset();
        setNodes(preset.nodes);
        setEdges(preset.edges);
      }
      setSelectedNodeId(null);
    },
    [buildPreset],
  );

  const createWorkflow = useCallback(
    async (name: string) => {
      const res = await fetch(apiUrl('/api/admin/automations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        appendLog({ nodeName: 'Workflow', eventType: 'error', payload: { action: 'create', status: res.status }, status: 'error' });
        alert('Could not create workflow. Check your session or permissions.');
        return;
      }
      const json = await res.json();
      if (json.workflow) {
        setWorkflows((prev) => [...prev, json.workflow]);
        setActiveId(json.workflow.id);
        syncFromWorkflow(json.workflow);
      }
    },
    [appendLog, getAuthHeaders, syncFromWorkflow],
  );

  const loadWorkflows = useCallback(async ({ syncNodes = true } = {}) => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/automations'), { credentials: 'include', headers: getAuthHeaders() });
      const json = await res.json();
      const list: Workflow[] = json.workflows || [];
      setWorkflows(list);
      if (syncNodes) {
        if (list[0]) {
          const focusId = focusWorkflowRef.current;
          const target = focusId ? list.find((w) => w.id === focusId) : null;
          if (target) {
            focusWorkflowRef.current = null;
            setActiveId(target.id);
            syncFromWorkflow(target);
          } else {
            setActiveId(list[0].id);
            syncFromWorkflow(list[0]);
          }
        } else {
          await createWorkflow('Default Workflow');
        }
      }
    } catch (error) {
      console.error('Load automations failed', error);
    } finally {
      setLoading(false);
    }
  }, [createWorkflow, getAuthHeaders, syncFromWorkflow]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleAddWorkflow = async () => {
    const name = prompt('Workflow name?');
    if (!name) return;
    await createWorkflow(name);
  };

  const handleNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const handleEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const handleConnect: OnConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep' }, eds)), []);

  const addNode = (type: 'trigger' | 'filter_service' | 'http_action', label: string, data: Record<string, unknown> = {}) => {
    setNodes((prev) => [
      ...prev,
      {
        id: `${type}-${crypto.randomUUID()}`,
        type,
        position: { x: 100 + prev.length * 20, y: 120 + prev.length * 20 },
        data: { label, ...data },
        ...nodeDefaults,
      },
    ]);
  };

  const save = async () => {
    if (!activeId) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/automations/${activeId}/save`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ nodes, edges }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        appendLog({ nodeName: 'Save', eventType: 'error', payload: { status: res.status, body: json }, status: 'error' });
        alert('Save failed. Session or network error is possible.');
        return;
      }
      await loadWorkflows(); // reload to confirm the changes persist
    } catch (error) {
      console.error('Save failed', error);
      appendLog({ nodeName: 'Save', eventType: 'error', payload: { message: (error as any)?.message }, status: 'error' });
      alert('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (value: boolean, idOverride?: string) => {
    const id = idOverride || activeId;
    if (!id) return;
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, isActive: value } : w)));
    const res = await fetch(apiUrl(`/api/admin/automations/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({ isActive: value }),
    });
    if (!res.ok) {
      appendLog({ nodeName: 'Toggle', eventType: 'error', payload: { status: res.status }, status: 'error' });
      alert('Could not update active state. Check your session.');
    } else {
      await loadWorkflows({ syncNodes: false });
    }
  };

  const renameWorkflow = async () => {
    if (!activeId) return;
    const wf = workflows.find((w) => w.id === activeId);
    const name = prompt('Rename workflow', wf?.name || '');
    if (!name) return;
    setWorkflows((prev) => prev.map((w) => (w.id === activeId ? { ...w, name } : w)));
    await fetch(apiUrl(`/api/admin/automations/${activeId}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
  };

  const handleSelectWorkflow = (id: string) => {
    setActiveId(id);
    const wf = workflows.find((w) => w.id === id);
    syncFromWorkflow(wf);
  };

  const handleTestWorkflow = async (idOverride?: string) => {
    const id = idOverride || activeId;
    if (!id) return;
    try {
      appendLog({ nodeName: 'Test Runner', eventType: 'info', payload: { workflowId: id, action: 'manual-test' }, status: 'pending' });
      const res = await fetch(apiUrl(`/api/admin/automations/${id}/test-run`), {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        credentials: 'include',
      });
      const json = await res.json();
      appendLog({ nodeName: 'Test Runner', eventType: res.ok ? 'info' : 'error', payload: { response: json }, status: res.ok ? 'success' : 'error' });
      if (!res.ok) {
        alert('Test failed: session or API error.');
      }
    } catch (error: any) {
      appendLog({ nodeName: 'Test Runner', eventType: 'error', payload: { message: error?.message }, status: 'error' });
      alert('An error occurred while running the test.');
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/automations/${id}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });

      if (!res.ok) {
        const fallback = await fetch(apiUrl(`/api/admin/automations/${id}/delete`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          credentials: 'include',
        });
        if (!fallback.ok) {
          appendLog({ nodeName: 'Delete', eventType: 'error', payload: { status: res.status, fallbackStatus: fallback.status }, status: 'error' });
          alert('Delete failed. Session or permission issues may exist.');
          return;
        }
      }

      await loadWorkflows();
      if (activeId === id) {
        setActiveId(null);
        setNodes([]);
        setEdges([]);
        setSelectedNodeId(null);
      }
    } catch (error: any) {
      appendLog({ nodeName: 'Delete', eventType: 'error', payload: { message: error?.message }, status: 'error' });
      alert('Error during delete. Check network/CORS settings.');
    }
  };

  const edgesWithStyles = useMemo(
    () =>
      edges.map((e) => {
        const status = (e.data as any)?.status || 'default';
        const color = edgeColor[status] || edgeColor.default;
        return { ...e, style: { strokeWidth: 2, stroke: color }, markerEnd: { type: MarkerType.ArrowClosed, color } };
      }),
    [edges],
  );

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId), [nodes, selectedNodeId]);

  const renderNodeInspector = () => {
    if (!selectedNode) return <div className="text-slate-400 text-sm">Select a block or add one from the palette.</div>;

    const common = (
      <>
        <label className="text-xs text-slate-400">Title</label>
        <input
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/5 text-white mb-3"
          value={selectedNode.data?.label || ''}
          onChange={(e) => setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, label: e.target.value } } : n)))}
        />
        <label className="text-xs text-slate-400">Description</label>
        <textarea
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/5 text-white mb-3"
          value={selectedNode.data?.description || ''}
          onChange={(e) => setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, description: e.target.value } } : n)))}
          rows={2}
        />
      </>
    );

    if (selectedNode.type === 'filter_service') {
      const selected = Array.isArray(selectedNode.data?.services) ? selectedNode.data.services : [];
      return (
        <div className="space-y-2">
          {common}
          <p className="text-xs text-slate-400">Target services</p>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {SERVICES.map((srv) => {
              const checked = selected.includes(srv);
              return (
                <label key={srv} className="flex items-center gap-2 text-sm text-slate-200 bg-slate-800 rounded-lg px-2 py-1.5 border border-white/5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setNodes((prev) =>
                        prev.map((n) => {
                          if (n.id !== selectedNode.id) return n;
                          const next = new Set((n.data as any)?.services || []);
                          if (e.target.checked) next.add(srv);
                          else next.delete(srv);
                          return { ...n, data: { ...n.data, services: Array.from(next) } };
                        }),
                      )
                    }
                  />
                  {srv}
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    if (selectedNode.type === 'http_action') {
      const method = selectedNode.data?.method || 'POST';
      const url = selectedNode.data?.url || '';
      const timeout = selectedNode.data?.timeout || 5000;
      const headersText = JSON.stringify(selectedNode.data?.headers || {}, null, 2);
      return (
        <div className="space-y-3">
          {common}
          <div className="grid grid-cols-3 gap-2 items-center">
            <div>
              <label className="text-xs text-slate-400">Method</label>
              <select
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/5 text-white"
                value={method}
                onChange={(e) =>
                  setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, method: e.target.value } } : n)))}
              >
                {['POST', 'PUT', 'PATCH', 'GET'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400">URL</label>
              <input
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/5 text-white"
                value={url}
                onChange={(e) =>
                  setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, url: e.target.value } } : n)))}
                placeholder="https://partner.api/endpoint"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 items-center">
            <div>
              <label className="text-xs text-slate-400">Timeout (ms)</label>
              <input
                type="number"
                min={1000}
                max={30000}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/5 text-white"
                value={timeout}
                onChange={(e) =>
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === selectedNode.id ? { ...n, data: { ...n.data, timeout: Number(e.target.value || 5000) } } : n,
                    ),
                  )
                }
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Add headers (JSON)</label>
              <textarea
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/5 text-white"
                rows={3}
                value={headersText}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value || '{}');
                    setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, headers: parsed } } : n)));
                  } catch {
                    // ignore
                  }
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    return common;
  };

  const activeWorkflow = useMemo(() => workflows.find((w) => w.id === activeId), [workflows, activeId]);

  return (
    <div className="min-h-screen bg-slate-950 text-white px-3 sm:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="rounded-2xl border border-white/5 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-800/70 shadow-2xl shadow-black/40 p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Automation Studio</p>
              <h1 className="text-3xl font-semibold">Automation Designer</h1>
              <p className="text-slate-400 text-sm">Route by service, call APIs, connect blocks, and test.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleAddWorkflow} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm shadow-lg shadow-emerald-900/40">
                New Workflow
              </button>
              <button onClick={() => handleTestWorkflow()} disabled={!activeId} className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm">
                Run Test
              </button>
              <button onClick={renameWorkflow} disabled={!activeId} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-100 border border-white/10 text-sm disabled:opacity-50">
                Rename
              </button>
              <button onClick={save} disabled={saving || !activeId} className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3 items-center bg-slate-900/60 border border-white/5 rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Workflow</span>
              <select value={activeId || ''} onChange={(e) => handleSelectWorkflow(e.target.value)} className="bg-slate-800 text-white text-sm rounded-lg border border-white/10 px-2 py-1.5">
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">{activeWorkflow?.nodes?.length || 0} blocks / {activeWorkflow?.edges?.length || 0} connections</div>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Flow Status</p>
            <div className="space-y-2">
              {workflows.map((wf) => (
                <div key={wf.id} className="text-sm bg-slate-800/60 rounded-xl px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <button className="flex items-center gap-2 text-white font-semibold" onClick={() => setExpandedFlowId(expandedFlowId === wf.id ? null : wf.id)}>
                      <span className="text-slate-400 text-lg">{expandedFlowId === wf.id ? 'v' : '>'}</span>
                      {wf.name}
                    </button>
                    <div className="flex items-center gap-2">
                      <div className={`relative w-12 h-6 rounded-full cursor-pointer transition ${wf.isActive ? 'bg-emerald-500' : 'bg-slate-600'}`} onClick={() => toggleActive(!wf.isActive, wf.id)}>
                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${wf.isActive ? 'right-0.5' : 'left-0.5'}`} />
                      </div>
                    </div>
                  </div>
                  {expandedFlowId === wf.id && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
                      <span className="text-slate-400">{(wf.nodes?.length || 0)} blocks, {(wf.edges?.length || 0)} connections</span>
                      <button
                        className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600"
                        onClick={() => {
                          setActiveId(wf.id);
                          syncFromWorkflow(wf);
                        }}
                      >
                        Open
                      </button>
                      <button className="px-2 py-1 rounded-lg bg-amber-700 hover:bg-amber-600" onClick={() => handleTestWorkflow(wf.id)}>
                        Test
                      </button>
                      <button className="px-2 py-1 rounded-lg bg-red-700 hover:bg-red-600" onClick={() => handleDeleteWorkflow(wf.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 lg:col-span-2 space-y-3 bg-slate-900/60 border border-white/5 rounded-2xl p-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Palette</p>
              <PaletteButton label="Trigger (Form)" accent="#38bdf8" onClick={() => addNode('trigger', 'Form Submission', { description: 'Runs when a new form arrives' })} />
              <PaletteButton label="Service Filter" accent="#f97316" onClick={() => addNode('filter_service', 'Service Filter', { services: ['Roofing'], description: 'Proceed for selected services' })} />
              <PaletteButton label="HTTP Call" accent="#22c55e" onClick={() => addNode('http_action', 'API Call', { url: '', method: 'POST', headers: {}, timeout: 5000, description: 'Call partner API' })} />
              <div className="text-xs text-slate-500 pt-2 border-t border-white/5">Create connections by dragging from the left/right handles of a node.</div>
              {selectedNode && (
                <button onClick={() => setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id))} className="w-full px-3 py-2 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30 text-sm">
                  Delete selected block
                </button>
              )}
            </div>

            <div className="col-span-12 lg:col-span-7 h-[600px] bg-slate-900/60 border border-white/5 rounded-2xl">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading...</div>
              ) : (
                <ReactFlow
                  nodes={nodes}
                  edges={edgesWithStyles}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onConnect={handleConnect}
                  onNodeClick={(_, n) => setSelectedNodeId(n.id)}
                  onNodeContextMenu={(_, n) => setSelectedNodeId(n.id)}
                  onEdgeContextMenu={(_, edge) => setEdges((eds) => eds.filter((e) => e.id !== edge.id))}
                  fitView
                  nodeTypes={nodeTypes}
                >
                  <Background />
                  <MiniMap />
                  <Controls />
                </ReactFlow>
              )}
            </div>

            <div className="col-span-12 lg:col-span-3 space-y-3 bg-slate-900/60 border border-white/5 rounded-2xl p-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Settings</p>
              {renderNodeInspector()}
            </div>
          </div>

          <div className="bg-slate-900/70 border border-white/5 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <span className="font-semibold text-white">Live Logs</span>
                <span className="text-xs text-slate-500">(auto-scroll, filter, export)</span>
              </div>
              <div className="flex items-center gap-2">
                {['all', 'info', 'error', 'warning', 'debug'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLogFilter(lvl as any)}
                    className={`px-2 py-1 rounded-lg text-xs border ${logFilter === lvl ? 'border-sky-400 text-white' : 'border-white/10 text-slate-300'}`}
                  >
                    {lvl.toUpperCase()}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `workflow-logs-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-800 border border-white/10 text-xs text-white"
                >
                  Export Logs (JSON)
                </button>
                <button onClick={clearLogs} className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                  Clear
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  appendLog({
                    nodeName: 'Primary API Call',
                    eventType: 'info',
                    payload: { message: 'API response OK', status: 200 },
                    duration: 320,
                    status: 'success',
                  })
                }
                className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200"
              >
                Sample Success Log
              </button>
              <button
                onClick={() =>
                  appendLog({
                    nodeName: 'Error Categorizer',
                    eventType: 'error',
                    payload: { code: 'RATE_LIMIT', retryAfter: 30 },
                    duration: 120,
                    status: 'error',
                  })
                }
                className="px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200"
              >
                Sample Error Log
              </button>
            </div>

            <div className="h-[220px] overflow-auto rounded-xl bg-slate-950/70 border border-white/5 px-3 py-2 space-y-2 custom-scroll">
              {logs
                .filter((l) => logFilter === 'all' || l.eventType === logFilter)
                .map((log) => {
                  const color =
                    log.eventType === 'error'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                      : log.eventType === 'warning'
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                        : log.eventType === 'debug'
                          ? 'border-slate-500/40 bg-slate-500/10 text-slate-200'
                          : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100';
                  const expanded = expandedLogId === log.id;
                  return (
                    <div key={log.id} className={`rounded-lg border px-3 py-2 text-xs ${color}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{log.nodeName}</span>
                          <span className="uppercase text-[10px] tracking-wide opacity-80">{log.eventType}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          {log.duration != null && <span>{log.duration} ms</span>}
                          <span className="opacity-70">{log.timestamp}</span>
                          <button onClick={() => setExpandedLogId(expanded ? null : log.id)} className="underline">
                            {expanded ? 'Close' : 'Details'}
                          </button>
                        </div>
                      </div>
                      {expanded && <pre className="mt-2 whitespace-pre-wrap break-all text-slate-200">{JSON.stringify(log.payload, null, 2)}</pre>}
                    </div>
                  );
                })}
              {logs.length === 0 && <div className="text-slate-500 text-sm">No logs yet. They will appear as workflows run.</div>}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminAutomations(props: { onNavigate: (page: string) => void }) {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
