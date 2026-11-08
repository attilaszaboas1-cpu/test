'use strict';

const M = require('./mapping');

// Thin client for the Workfront REST API (attask/api).
// Docs: https://experienceleague.adobe.com/docs/workfront/using/adobe-workfront-api/api-general-information/api-basics.html
class WorkfrontClient {
  constructor({ domain, apiKey, version = 'v15.0', fetchImpl = fetch }) {
    if (!domain || !apiKey) throw new Error('WorkfrontClient needs a domain and an API key');
    const host = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    this.base = `https://${host}/attask/api/${version}`;
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.mode = 'live';
    this.domain = host;
  }

  async request(method, path, params = {}) {
    const url = new URL(this.base + path);
    const init = { method, headers: { apiKey: this.apiKey, Accept: 'application/json' } };
    if (method === 'GET' || method === 'DELETE') {
      for (const [k, v] of Object.entries(params)) {
        for (const item of [].concat(v)) url.searchParams.append(k, item);
      }
    } else {
      // Workfront accepts parameters as a form body for POST/PUT, which avoids
      // URL length limits on long descriptions.
      init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      init.body = new URLSearchParams(params).toString();
    }
    const res = await this.fetch(url, init);
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok || (json && json.error)) {
      const msg = (json && json.error && json.error.message) || `Workfront returned HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status >= 400 && res.status < 500 ? res.status : 502;
      throw err;
    }
    return json ? json.data : null;
  }

  async listProjects() {
    const data = await this.request('GET', '/project/search', {
      fields: M.PROJECT_FIELDS,
      // Current, planning and on-hold projects; skip completed/dead ones.
      status: ['CPL', 'DED'],
      status_Mod: 'notin',
      name_Sort: 'asc',
      $$LIMIT: '500',
    });
    return data.map(M.projectFromWorkfront);
  }

  async listTasks(projectId) {
    const data = await this.request('GET', '/task/search', {
      projectID: projectId,
      fields: M.TASK_FIELDS,
      taskNumber_Sort: 'asc',
      $$LIMIT: '2000',
    });
    return data.map(M.taskFromWorkfront);
  }

  async listMyTasks() {
    const data = await this.request('GET', '/task/search', {
      assignedToID: '$$USER.ID',
      status: 'CPL',
      status_Mod: 'ne',
      fields: M.TASK_FIELDS,
      plannedCompletionDate_Sort: 'asc',
      $$LIMIT: '500',
    });
    return data.map(M.taskFromWorkfront);
  }

  async listUsers() {
    const data = await this.request('GET', '/user/search', {
      isActive: 'true',
      fields: M.USER_FIELDS,
      name_Sort: 'asc',
      $$LIMIT: '2000',
    });
    return data.map(M.userFromWorkfront);
  }

  async me() {
    const data = await this.request('GET', '/user/search', { ID: '$$USER.ID', fields: M.USER_FIELDS });
    return data && data[0] ? M.userFromWorkfront(data[0]) : null;
  }

  // Task statuses, including custom ones configured on the instance.
  async listStatuses() {
    try {
      const data = await this.request('GET', '/CSTEM/search', {
        enumClass: 'STATUS_TSK',
        fields: 'value,label,color,isHidden',
        $$LIMIT: '200',
      });
      const seen = new Set();
      const list = [];
      for (const s of data) {
        if (s.isHidden || seen.has(s.value)) continue;
        seen.add(s.value);
        const def = M.DEFAULT_STATUSES.find((d) => d.value === s.value);
        list.push({
          value: s.value,
          label: s.label || s.value,
          color: s.color ? `#${String(s.color).replace('#', '')}` : (def ? def.color : '#a25ddc'),
        });
      }
      return list.length ? list : M.DEFAULT_STATUSES;
    } catch {
      return M.DEFAULT_STATUSES;
    }
  }

  async updateTask(id, patch) {
    const updates = M.patchToWorkfront(patch);
    const data = await this.request('PUT', `/task/${encodeURIComponent(id)}`, {
      updates: JSON.stringify(updates),
      fields: M.TASK_FIELDS,
    });
    return M.taskFromWorkfront(data);
  }

  async createTask(projectId, fields) {
    const updates = M.patchToWorkfront(fields);
    updates.projectID = projectId;
    const data = await this.request('POST', '/task', {
      updates: JSON.stringify(updates),
      fields: M.TASK_FIELDS,
    });
    return M.taskFromWorkfront(data);
  }

  async deleteTask(id) {
    await this.request('DELETE', `/task/${encodeURIComponent(id)}`, { force: 'true' });
  }
}

module.exports = { WorkfrontClient };
