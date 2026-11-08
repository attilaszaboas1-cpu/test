'use strict';

const M = require('./mapping');

// In-memory stand-in for Workfront, so the board can be tried without an
// account. It speaks the same interface as WorkfrontClient.
function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function seed() {
  const users = [
    { id: 'U1', name: 'Alex Kim', email: 'alex@example.com' },
    { id: 'U2', name: 'Bea Novak', email: 'bea@example.com' },
    { id: 'U3', name: 'Chris Diaz', email: 'chris@example.com' },
    { id: 'U4', name: 'Dana Ivanova', email: 'dana@example.com' },
  ];
  const projects = [
    { id: 'P1', name: 'Q1 Brand Campaign', status: 'CUR', ownerName: 'Alex Kim' },
    { id: 'P2', name: 'Website Refresh', status: 'CUR', ownerName: 'Bea Novak' },
    { id: 'P3', name: 'Product Launch – Spring', status: 'PLN', ownerName: 'Chris Diaz' },
  ];
  const rows = [
    ['P1', 'Creative brief', 'CPL', 100, 2, -10, -3, 'U1'],
    ['P1', 'Key visual concepts', 'INP', 60, 3, -4, 3, 'U2'],
    ['P1', 'Social media banners', 'NEW', 0, 2, 2, 9, 'U3'],
    ['P1', 'Legal review', 'RVW', 80, 4, -1, 1, 'U4'],
    ['P1', 'Media plan', 'NEW', 0, 1, 5, 14, null],
    ['P2', 'Sitemap & IA', 'CPL', 100, 2, -20, -12, 'U2'],
    ['P2', 'Homepage design', 'INP', 45, 3, -6, 4, 'U2'],
    ['P2', 'CMS migration', 'INP', 20, 4, -3, -1, 'U3'],
    ['P2', 'Accessibility audit', 'NEW', 0, 2, 8, 15, 'U4'],
    ['P3', 'Launch plan', 'INP', 30, 3, -2, 6, 'U1'],
    ['P3', 'Press kit', 'NEW', 0, 2, 4, 20, 'U3'],
  ];
  let n = 0;
  const tasks = rows.map(([projectId, name, status, pct, priority, s, e, assigneeId]) => ({
    id: `T${++n}`, projectId, name, status, percentComplete: pct, priority,
    startDate: day(s), dueDate: day(e), assigneeId, description: '',
    updatedAt: new Date().toISOString(), isParent: false,
  }));
  return { users, projects, tasks, nextId: n + 1 };
}

class MockWorkfront {
  constructor() {
    this.mode = 'mock';
    this.domain = null;
    this.db = seed();
  }

  withAssignee(t) {
    const u = this.db.users.find((x) => x.id === t.assigneeId);
    return { ...t, assigneeName: u ? u.name : null };
  }

  findTask(id) {
    const t = this.db.tasks.find((x) => x.id === id);
    if (!t) {
      const err = new Error('Task not found');
      err.status = 404;
      throw err;
    }
    return t;
  }

  async listProjects() {
    return this.db.projects.map((p) => {
      const ts = this.db.tasks.filter((t) => t.projectId === p.id);
      const pct = ts.length ? Math.round(ts.reduce((a, t) => a + t.percentComplete, 0) / ts.length) : 0;
      const due = ts.map((t) => t.dueDate).filter(Boolean).sort().pop() || null;
      return { ...p, percentComplete: pct, dueDate: due, updatedAt: null };
    });
  }

  async listTasks(projectId) {
    return this.db.tasks.filter((t) => t.projectId === projectId).map((t) => this.withAssignee(t));
  }

  async listMyTasks() {
    return this.db.tasks.filter((t) => t.assigneeId === 'U1' && t.status !== 'CPL').map((t) => this.withAssignee(t));
  }

  async listUsers() { return this.db.users.slice(); }

  async me() { return this.db.users[0]; }

  async listStatuses() {
    return [
      M.DEFAULT_STATUSES[0],
      M.DEFAULT_STATUSES[1],
      { value: 'RVW', label: 'In Review', color: '#a25ddc' },
      M.DEFAULT_STATUSES[2],
    ];
  }

  applyPatch(t, patch) {
    const wf = M.patchToWorkfront(patch); // same validation as live mode
    const back = { plannedStartDate: 'startDate', plannedCompletionDate: 'dueDate', assignedToID: 'assigneeId' };
    for (const [k, v] of Object.entries(wf)) t[back[k] || k] = v;
    if (patch.status === 'CPL') t.percentComplete = 100;
    t.updatedAt = new Date().toISOString();
  }

  async updateTask(id, patch) {
    const t = this.findTask(id);
    this.applyPatch(t, patch);
    return this.withAssignee(t);
  }

  async createTask(projectId, fields) {
    if (!this.db.projects.some((p) => p.id === projectId)) {
      const err = new Error('Project not found');
      err.status = 404;
      throw err;
    }
    const t = {
      id: `T${this.db.nextId++}`, projectId, name: '', status: 'NEW', percentComplete: 0,
      priority: 2, startDate: null, dueDate: null, assigneeId: null, description: '',
      updatedAt: null, isParent: false,
    };
    this.applyPatch(t, fields);
    this.db.tasks.push(t);
    return this.withAssignee(t);
  }

  async deleteTask(id) {
    this.findTask(id);
    this.db.tasks = this.db.tasks.filter((t) => t.id !== id);
  }
}

module.exports = { MockWorkfront };
