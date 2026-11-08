# Workfront Board

A simple, Monday-style board on top of **Adobe Workfront**. It reads your projects and tasks from Workfront and writes every change straight back, so Workfront stays the single source of truth. Your team gets a lighter screen for day-to-day updates.


## What you get

| | |
|---|---|
| **Table view** | Tasks grouped by status, with colored status and priority pills, owner, due date and a progress bar. You edit everything inline. |
| **Kanban view** | Drag a card to another column to change its status in Workfront. |
| **Timeline view** | A simple Gantt from planned start to planned completion dates, with a "today" line. |
| **My work** | Your open tasks across all projects. |
| **Task drawer** | Start/due dates, description, delete, and an **Open in Workfront ↗** link. |
| **Filters** | Search, filter by person, hide completed tasks. |
| **Sync** | Edits save to Workfront right away. If Workfront rejects one, the board rolls it back and shows Workfront's error. The board also re-reads Workfront every 30 s (configurable), so changes made in Workfront show up. |

Custom task statuses on your Workfront instance (for example "In Review") are loaded automatically, with their colors.

## Try it (no Workfront account needed)

Requires Node.js 18 or newer. There is nothing to install.

```bash
cd workfront-board
npm run demo
# open http://localhost:3000
```

Demo mode uses sample data held in memory.

## Connect to Workfront

1. In Workfront, create an API key: **Setup → System → Customer Info → API key settings**, or ask your Workfront admin. The board acts as the user who owns the key and can only see and change what that user can.
2. `cp .env.example .env` and fill in:
   ```
   WF_DOMAIN=yourcompany.my.workfront.com
   WF_API_KEY=your-key
   ```
3. `npm start` and open http://localhost:3000.

The API key stays on the server and is never sent to the browser. The server only listens on `localhost`. If you want to share it with your team, put it behind your company's SSO/reverse proxy first, because everyone who can open the page acts as the key's owner.

## What syncs

| Board field | Workfront field | Editable |
|---|---|---|
| Task name | `name` | ✔ |
| Status | `status` | ✔ |
| Owner | `assignedToID` | ✔ |
| Priority | `priority` (0 None … 4 Urgent) | ✔ |
| Start / due date | `plannedStartDate` / `plannedCompletionDate` | ✔ |
| Progress | `percentComplete` | ✔ |
| Description | `description` | ✔ |
| New task | `POST /task` on the project | ✔ |
| Delete task | `DELETE /task/{id}` | ✔ |

The server only accepts these fields, and it checks every value before it reaches Workfront.

**Things Workfront decides, not the board:**
- **Parent tasks** get their dates and progress rolled up from subtasks, so the board shows those fields read-only.
- **Dates** can be moved by Workfront's scheduling (task constraints, predecessors, the project schedule). After a save, the board shows what Workfront actually stored.
- **Owner** sets the primary assignee. Tasks with several assignees keep their other assignments.
- **Approvals, permissions and locked tasks** apply as usual. If Workfront refuses a change, the board shows the reason.
- If two people edit the same field, the last save wins (as in Workfront itself).

## Project layout

```
server.js          HTTP server: JSON API + static files (no dependencies)
lib/workfront.js   Workfront REST client (attask/api/v15.0)
lib/mock.js        In-memory stand-in used by demo mode and tests
lib/mapping.js     Field mapping and validation between Workfront and the board
public/            The board UI (plain HTML/CSS/JS)
test/              npm test
```

## Settings (`.env`)

| Variable | Default | |
|---|---|---|
| `WF_DOMAIN` | — | e.g. `acme.my.workfront.com`. Leave empty for demo mode. |
| `WF_API_KEY` | — | Workfront API key |
| `WF_API_VERSION` | `v15.0` | Workfront API version |
| `PORT` | `3000` | |
| `POLL_SECONDS` | `30` | How often the open board re-reads Workfront |
| `WF_MODE` | — | Set to `mock` to force demo mode |

## Ideas for next "extras"

The same server pattern works for other lightweight Workfront add-ons:
- a weekly **workload view** (hours per person from `assignments`/`workRequired`),
- a **request intake form** that creates Workfront issues (`OPTASK`),
- **Slack/Teams digests** of overdue tasks,
- **custom-form fields** as extra board columns (`DE:Field Name` in the API).
