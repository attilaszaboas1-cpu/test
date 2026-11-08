'use strict';

// Translation between Workfront's API objects and the board's simpler model.
// Board fields are the only ones the UI can edit; everything else in
// Workfront is left alone.

const TASK_FIELDS = [
  'ID', 'name', 'status', 'percentComplete', 'priority',
  'plannedStartDate', 'plannedCompletionDate', 'description',
  'projectID', 'assignedToID', 'assignedTo:name', 'lastUpdateDate',
  'numberOfChildren',
].join(',');

const PROJECT_FIELDS = [
  'ID', 'name', 'status', 'percentComplete', 'plannedCompletionDate',
  'ownerID', 'owner:name', 'lastUpdateDate',
].join(',');

const USER_FIELDS = 'ID,name,emailAddr';

// Workfront's built-in task statuses. Custom statuses are loaded from the
// instance when available (see WorkfrontClient.listStatuses).
const DEFAULT_STATUSES = [
  { value: 'NEW', label: 'New', color: '#c4c4c4' },
  { value: 'INP', label: 'In Progress', color: '#fdab3d' },
  { value: 'CPL', label: 'Complete', color: '#00c875' },
];

const PRIORITIES = [
  { value: 0, label: 'None', color: '#c4c4c4' },
  { value: 1, label: 'Low', color: '#579bfc' },
  { value: 2, label: 'Normal', color: '#5559df' },
  { value: 3, label: 'High', color: '#fdab3d' },
  { value: 4, label: 'Urgent', color: '#e2445c' },
];

// Board field -> Workfront field
const EDITABLE = {
  name: 'name',
  status: 'status',
  percentComplete: 'percentComplete',
  priority: 'priority',
  startDate: 'plannedStartDate',
  dueDate: 'plannedCompletionDate',
  assigneeId: 'assignedToID',
  description: 'description',
};

function toDay(value) {
  if (!value) return null;
  // Workfront dates look like "2026-11-08T17:00:00:000-0500"
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return m ? m[1] : null;
}

function taskFromWorkfront(t) {
  return {
    id: t.ID,
    projectId: t.projectID,
    name: t.name || '',
    status: t.status || 'NEW',
    percentComplete: Number(t.percentComplete) || 0,
    priority: Number(t.priority) || 0,
    startDate: toDay(t.plannedStartDate),
    dueDate: toDay(t.plannedCompletionDate),
    assigneeId: t.assignedToID || null,
    assigneeName: (t.assignedTo && t.assignedTo.name) || null,
    description: t.description || '',
    updatedAt: t.lastUpdateDate || null,
    // Parent tasks get their dates and progress rolled up by Workfront.
    isParent: Number(t.numberOfChildren) > 0,
  };
}

function projectFromWorkfront(p) {
  return {
    id: p.ID,
    name: p.name || '',
    status: p.status || null,
    percentComplete: Number(p.percentComplete) || 0,
    dueDate: toDay(p.plannedCompletionDate),
    ownerName: (p.owner && p.owner.name) || null,
    updatedAt: p.lastUpdateDate || null,
  };
}

function userFromWorkfront(u) {
  return { id: u.ID, name: u.name || '', email: u.emailAddr || '' };
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// Validate a patch from the browser and translate it to Workfront fields.
function patchToWorkfront(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new ValidationError('Body must be a JSON object');
  }
  const out = {};
  for (const [key, value] of Object.entries(patch)) {
    const wfKey = EDITABLE[key];
    if (!wfKey) throw new ValidationError(`Field "${key}" cannot be edited`);
    switch (key) {
      case 'name':
        if (typeof value !== 'string' || !value.trim()) throw new ValidationError('Name cannot be empty');
        out[wfKey] = value.trim().slice(0, 255);
        break;
      case 'status':
        if (typeof value !== 'string' || !/^[A-Z0-9]{3}$/.test(value)) throw new ValidationError('Invalid status');
        out[wfKey] = value;
        break;
      case 'percentComplete': {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0 || n > 100) throw new ValidationError('Progress must be 0–100');
        out[wfKey] = Math.round(n);
        break;
      }
      case 'priority': {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0 || n > 4) throw new ValidationError('Priority must be 0–4');
        out[wfKey] = n;
        break;
      }
      case 'startDate':
      case 'dueDate':
        if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError('Dates must be YYYY-MM-DD');
        out[wfKey] = value;
        break;
      case 'assigneeId':
        if (value !== null && (typeof value !== 'string' || !/^[A-Za-z0-9]+$/.test(value))) throw new ValidationError('Invalid assignee');
        out[wfKey] = value;
        break;
      case 'description':
        if (typeof value !== 'string') throw new ValidationError('Description must be text');
        out[wfKey] = value.slice(0, 4000);
        break;
    }
  }
  if (!Object.keys(out).length) throw new ValidationError('Nothing to update');
  return out;
}

module.exports = {
  TASK_FIELDS, PROJECT_FIELDS, USER_FIELDS, DEFAULT_STATUSES, PRIORITIES,
  taskFromWorkfront, projectFromWorkfront, userFromWorkfront,
  patchToWorkfront, toDay, ValidationError,
};
