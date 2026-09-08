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
const projectId = '20000000-0000-0000-0000-000000000001';
const archivedProjectId = '20000000-0000-0000-0000-000000000002';
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
  if (url.pathname.endsWith('/user')) return authUser;
  if (url.pathname.endsWith('/token')) return session;
  if (url.pathname.endsWith('/profiles')) return url.searchParams.has('id') ? profile : role === 'employee' ? [employee] : [admin, employee];
  if (url.pathname.endsWith('/get_employee_directory')) return [admin, employee].map(({ id, first_name, last_name, role }) => ({ id, first_name, last_name, role, avatar_url: null }));
  if (url.pathname.endsWith('/project_notes')) return [{ id: 'note-1', project_id: projectId, user_id: adminId, text: 'Dokumentation vom Administrator', created_at: '2026-09-03T10:30:00Z' }];
  if (url.pathname.endsWith('/project_members')) return [{ id: 'member-1', project_id: projectId, user_id: adminId }];
  if (url.pathname.endsWith('/projects')) {
    const projects = [
      { id: projectId, name: 'Neubau Musterstraße', client_id: null, archived_at: null, archived_by: null },
      { id: archivedProjectId, name: 'Sanierung Altbau', client_id: null, archived_at: '2026-09-05T12:00:00Z', archived_by: adminId },
    ];
    if (!url.searchParams.has('id')) return projects;
    return url.searchParams.get('id')?.includes(archivedProjectId) ? projects[1] : projects[0];
  }
  if (url.pathname.endsWith('/work_time_models')) return [admin,employee].map(p => ({user_id:p.id,effective_from:'2026-09-01',daily_minutes:null,monthly_hours:p.target_hours_monthly,holiday_profile:null}));
  if (url.pathname.endsWith('/get_work_balances')) return role === 'employee' ? [balance] : [balance, { ...balance, user_id: adminId, balance_hours: 20 }];
  if (url.pathname.endsWith('/get_recent_project_notes')) return [1,2,3].map(i=>({id:`note-${i}`,project_id:projectId,project_name:'Neubau Musterstraße',author_name:'Muster Mitarbeiter',created_at:'2026-09-03T10:30:00Z',text:`Notiz ${i}: Leitungen im Erdgeschoss fertig verlegt. Material geprüft. `+'Weitere Details zur Installation. '.repeat(10)}));
  if (url.pathname.endsWith('/get_project_time_summary')) return {total_minutes:810,count:3,members:[{user_id:employeeId,name:'Muster Mitarbeiter',minutes:810}],entries:[1,2,3].map(i=>({id:`entry-${i}`,name:'Muster Mitarbeiter',date:'2026-09-03',start_time:'08:00:00',end_time:'12:30:00',duration_minutes:270,description:'Elektroinstallation Erdgeschoss und Prüfung der Leitungen'}))};
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
    const body = request.method === 'OPTIONS' ? '' : JSON.stringify(response(request));
    await command('Fetch.fulfillRequest', {requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PATCH,DELETE,OPTIONS'}],body:Buffer.from(body).toString('base64')});
  }
});
await command('Network.enable');
await command('Network.setBypassServiceWorker',{bypass:true});
await command('Fetch.enable',{patterns:[{urlPattern:'*ksnujqbnaszcwgxtbweg.supabase.co/*',requestStage:'Request'}]});
await command('Runtime.evaluate',{expression:`localStorage.setItem('sb-ksnujqbnaszcwgxtbweg-auth-token',${JSON.stringify(JSON.stringify(session))}); location.href='/';`});
console.log(`Visual fixtures active (${role}); Supabase calls are mocked. Keep this process running during browser checks.`);
