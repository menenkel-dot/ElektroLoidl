// Visual fixtures for the isolated agent-browser session. Never uses real credentials.
// Start app on :3100, open it in agent-browser, then pass its CDP HTTP port here.
const port = process.argv[2];
const role = process.argv[3] || 'admin';
if (!port || !/^\d+$/.test(port)) throw new Error('Usage: node tests/browser-fixtures.mjs <CDP port> [admin|employee]');
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find(t => t.type === 'page' && t.url.startsWith('http://localhost:3100/'));
if (!target) throw new Error('Open the isolated localhost:3100 tab first.');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
const adminId = '10000000-0000-0000-0000-000000000001';
const employeeId = '10000000-0000-0000-0000-000000000002';
const absenceId = '50000000-0000-0000-0000-000000000001';
const legacyAbsenceId = '50000000-0000-0000-0000-000000000002';
const projectId = '20000000-0000-0000-0000-000000000001';
const archivedProjectId = '20000000-0000-0000-0000-000000000002';
const clientId = '40000000-0000-0000-0000-000000000001';
const documentKeys = new Map();
const newTimeEntries = [];
const reportProjects = [
  { id: projectId, name: 'Neubau Musterstraße' },
  { id: archivedProjectId, name: 'Sanierung Altbau' },
  ...Array.from({ length: 7 }, (_, index) => ({
    id: `20000000-0000-0000-0000-${String(index + 3).padStart(12, '0')}`,
    name: `Langer Auftragsname für Legendentest ${index + 1}`,
  })),
];
const permissions = { visible_menu_items: ['dashboard','clients','projects','schedule','time','absence','team','reports'] };
const admin = { id: adminId, first_name: 'Test', last_name: 'Admin', role: 'admin', target_hours_monthly: 160, vacation_total: 30, vacation_used: 0, overtime_base: 20, permissions };
const employee = { ...admin, id: employeeId, first_name: 'Muster', last_name: 'Mitarbeiter', role: 'employee', target_hours_monthly: 169, overtime_base: 15 };
const profile = role === 'employee' ? employee : admin;
const authUser = { id: profile.id, email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', created_at: '2026-01-01T00:00:00Z' };
const session = { access_token: 'fixture.fake.token', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: 2208988800, expires_in: 86400, user: authUser };
const balance = { user_id: employeeId, balance_hours: 15, today_target_hours: 5, month_target_hours: 173, accounting_since: '2026-09-01' };
const preview = { token: 'fixture-preview', effective_from: '2026-09-01', before: balance, after: { ...balance, balance_hours: 17.68 }, vacation_refund_days: 0,
  absence_changes: [{ id: 'fixture', type: 'comp_time', start_date: '2026-09-04', end_date: '2026-09-04', old_hours: 7.68, new_hours: 5, old_days: 0, new_days: 0 }] };
function responseData(request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith('/object/list/project-documents')) {
    const { prefix, offset, limit } = JSON.parse(request.postData);
    return [...documentKeys]
      .filter(([key]) => key.startsWith(`${prefix}/`))
      .map(([key, id]) => ({ id, name: key.slice(prefix.length + 1) }))
      .slice(offset, offset + limit);
  }
  const documentPath = '/object/project-documents/';
  if (request.method === 'POST' && url.pathname.includes(documentPath)) {
    const key = url.pathname.split(documentPath)[1];
    documentKeys.set(key, crypto.randomUUID());
    return { Key: key };
  }
  if (url.pathname.endsWith('/user')) return authUser;
  if (url.pathname.endsWith('/token')) return session;
  if (url.pathname.endsWith('/profiles')) return url.searchParams.has('id') ? profile : role === 'employee' ? [employee] : [admin, employee];
  if (url.pathname.endsWith('/get_employee_directory')) return [admin, employee].map(({ id, first_name, last_name, role }) => ({ id, first_name, last_name, role, avatar_url: null }));
  if (url.pathname.endsWith('/absences')) return [
    { id: absenceId, user_id: employeeId, type: 'vacation', start_date: '2026-12-10', end_date: '2026-12-11', status: 'approved' },
    { id: legacyAbsenceId, user_id: employeeId, type: 'sick', start_date: '2026-11-01', end_date: '2026-11-01', status: 'rejected' },
  ];
  if (url.pathname.endsWith('/absence_history')) {
    const legacy = url.searchParams.get('absence_id') === `eq.${legacyAbsenceId}`;
    return legacy ? [
      { id: 4, action: 'submitted', occurred_at: '2026-10-27T10:30:00Z', actor_name: null, changes: null },
      { id: 5, action: 'rejected', occurred_at: null, actor_name: null, changes: null },
    ] : [
      { id: 1, action: 'submitted', occurred_at: '2026-11-02T10:30:00Z', actor_name: 'Muster Mitarbeiter', changes: null },
      { id: 2, action: 'edited', occurred_at: '2026-11-03T10:30:00Z', actor_name: 'Muster Mitarbeiter',
        changes: { type: ['comp_time', 'vacation'], period: [['2026-12-10', '2026-12-10'], ['2026-12-10', '2026-12-11']] } },
      { id: 3, action: 'approved', occurred_at: '2026-11-04T10:30:00Z', actor_name: 'Test Admin', changes: null },
    ];
  }
  if (url.pathname.endsWith('/project_notes')) return [{ id: 'note-1', project_id: projectId, user_id: adminId, text: 'Dokumentation vom Administrator', created_at: '2026-09-03T10:30:00Z' }];
  if (url.pathname.endsWith('/project_members')) return [{ id: 'member-1', project_id: projectId, user_id: adminId }];
  if (url.pathname.endsWith('/clients')) return [{ id: clientId, name: 'Testkunde' }];
  if (url.pathname.endsWith('/time_entries') && request.method === 'POST') {
    const [entry] = JSON.parse(request.postData);
    const saved = { ...entry, id: crypto.randomUUID() };
    newTimeEntries.push(saved);
    return saved;
  }
  if (url.pathname.endsWith('/time_entries') && url.searchParams.get('select') === 'id') {
    return newTimeEntries.filter(entry =>
      `eq.${entry.user_id}` === url.searchParams.get('user_id')
      && `eq.${entry.date}` === url.searchParams.get('date')
      && entry.start_time < url.searchParams.get('start_time').slice(3)
      && entry.end_time > url.searchParams.get('end_time').slice(3),
    ).slice(0, 1).map(({ id }) => ({ id }));
  }
  if (url.pathname.endsWith('/time_entries')) return [...newTimeEntries, ...reportProjects.map((project, index) => ({
    id: `30000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
    user_id: index % 2 ? employeeId : adminId,
    project_id: project.id,
    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    start_time: '08:00:00',
    end_time: '12:00:00',
    duration_minutes: 240,
    description: 'Testbuchung für die Berichtsansicht',
  }))].filter(entry => role !== 'employee' || entry.user_id === employeeId);
  if (url.pathname.endsWith('/projects')) {
    const projects = reportProjects.map(project => ({
      ...project,
      client_id: project.id === projectId || project.id === archivedProjectId ? clientId : null,
      archived_at: project.id === archivedProjectId ? '2026-09-05T12:00:00Z' : null,
      archived_by: project.id === archivedProjectId ? adminId : null,
    }));
    const visible = role === 'employee' ? projects.filter(project => project.id === projectId) : projects;
    if (!url.searchParams.has('id')) return visible;
    return visible.find(project => `eq.${project.id}` === url.searchParams.get('id')) ?? null;
  }
  if (url.pathname.endsWith('/work_time_models')) return [admin,employee].map(p => ({user_id:p.id,effective_from:'2026-09-01',daily_minutes:null,monthly_hours:p.target_hours_monthly,holiday_profile:null}));
  if (url.pathname.endsWith('/get_work_balances')) return role === 'employee' ? [balance] : [balance, { ...balance, user_id: adminId, balance_hours: 20 }];
  if (url.pathname.endsWith('/get_recent_project_notes')) return [1,2,3].map(i=>({id:`note-${i}`,project_id:projectId,project_name:'Neubau Musterstraße',author_name:'Muster Mitarbeiter',created_at:'2026-09-03T10:30:00Z',text:`Notiz ${i}: Leitungen im Erdgeschoss fertig verlegt. Material geprüft. `+'Weitere Details zur Installation. '.repeat(10)}));
  if (url.pathname.endsWith('/get_project_time_summary')) {
    const recorded = newTimeEntries.filter(entry => entry.project_id === projectId);
    const entries = recorded.map(entry => ({
      ...entry, name: entry.user_id === employeeId ? 'Muster Mitarbeiter' : 'Test Admin',
    }));
    return {
      total_minutes: 810 + recorded.reduce((total, entry) => total + entry.duration_minutes, 0),
      count: 3 + recorded.length,
      members: [{ user_id: employeeId, name: 'Muster Mitarbeiter', minutes: 810 }],
      entries: [...entries, ...[1, 2, 3].map(i => ({
        id: `entry-${i}`, name: 'Muster Mitarbeiter', date: '2026-09-03',
        start_time: '08:00:00', end_time: '12:30:00', duration_minutes: 270,
        description: 'Elektroinstallation Erdgeschoss und Prüfung der Leitungen',
      }))],
    };
  }
  if (url.pathname.endsWith('/preview_work_model') || url.pathname.endsWith('/save_work_model')) return preview;
  return [];
}
function response(request) {
  const data = responseData(request);
  const url = new URL(request.url);
  if (Array.isArray(data) && url.searchParams.has('offset')) {
    const offset = Number(url.searchParams.get('offset'));
    const limit = Number(url.searchParams.get('limit') || 500);
    return data.slice(offset, offset + limit);
  }
  return data;
}
ws.addEventListener('message', async event => {
  const message = JSON.parse(event.data);
  if (message.id) { const call=pending.get(message.id); pending.delete(message.id); if(message.error) call?.reject(new Error(message.error.message)); else call?.resolve(message.result); }
  if (message.method === 'Fetch.requestPaused') {
    const {requestId,request} = message.params;
    const result = request.method === 'OPTIONS' ? undefined : response(request);
    const responseCode = result === null ? 406 : 200;
    const body = request.method === 'OPTIONS' ? '' : JSON.stringify(result ?? { code: 'PGRST116', message: 'No rows' });
    await command('Fetch.fulfillRequest', {requestId,responseCode,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PATCH,DELETE,OPTIONS'}],body:Buffer.from(body).toString('base64')});
  }
});
await command('Network.enable');
await command('Network.setBypassServiceWorker',{bypass:true});
await command('Fetch.enable',{patterns:[{urlPattern:'*ksnujqbnaszcwgxtbweg.supabase.co/*',requestStage:'Request'}]});
await command('Runtime.evaluate',{expression:`localStorage.setItem('sb-ksnujqbnaszcwgxtbweg-auth-token',${JSON.stringify(JSON.stringify(session))}); location.href='/';`});
console.log(`Visual fixtures active (${role}); Supabase calls are mocked. Keep this process running during browser checks.`);
