'use strict';

const config = window.APP_CONFIG || {};
if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || !window.supabase) {
  alert('Falta configurar Supabase en config.js.');
  window.location.replace('login.html');
  throw new Error('Supabase no está configurado.');
}

const db = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let currentUser = null;
let currentProfile = null;
let professors = [];
let students = [];
let subjects = [];
let assignments = [];
let incidentTypes = [];
let incidents = [];
let followUps = [];
let chartInstances = {};
let realtimeChannel = null;
let reloadTimer = null;

const $ = (id) => document.getElementById(id);
const isAdmin = () => ['admin', 'administrador'].includes(String(currentProfile?.rol || '').toLowerCase());
const clean = (value) => String(value ?? '').trim();
const lower = (value) => clean(value).toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

const pageNames = {
  dashboard: 'Dashboard',
  registro: 'Registrar incidencia',
  incidencias: 'Registro de incidencias',
  seguimiento: 'Seguimiento',
  graficas: 'Gráficas',
  profesores: 'Profesores',
  alumnos: 'Alumnos',
  materias: 'Materias y grupos',
  reportes: 'Reportes',
  usuarios: 'Usuarios'
};

function normalizeStatus(value) {
  const status = lower(value);
  return status === 'resuelta' || status === 'cerrada' ? 'Resuelta' : 'Pendiente';
}

function normalizeCategory(value) {
  const category = lower(value);
  return category.startsWith('admin') ? 'Administrativa' : 'Operativa';
}

function initials(name) {
  return clean(name).split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'US';
}

function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-MX');
}

function statusBadge(status) {
  return normalizeStatus(status) === 'Resuelta'
    ? '<span class="badge resolved">Resuelta</span>'
    : '<span class="badge pending">Pendiente</span>';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function requireSession() {
  const { data, error } = await db.auth.getSession();
  if (error || !data.session) {
    window.location.replace('login.html');
    throw error || new Error('Sesión no encontrada.');
  }

  currentUser = data.session.user;
  const { data: profile, error: profileError } = await db
    .from('perfiles')
    .select('id,nombre,rol,activo')
    .eq('id', currentUser.id)
    .single();

  if (profileError || !profile || profile.activo === false) {
    await db.auth.signOut();
    alert('Tu perfil no existe o está desactivado.');
    window.location.replace('login.html');
    throw profileError || new Error('Perfil no disponible.');
  }

  currentProfile = profile;
}

async function loadData({ silent = false } = {}) {
  if (!silent) showToast('Actualizando información...');

  const [
    professorsResult,
    studentsResult,
    subjectsResult,
    assignmentsResult,
    typesResult,
    incidentsResult,
    followUpsResult
  ] = await Promise.all([
    db.from('profesores').select('*').order('nombre'),
    db.from('alumnos').select('*').order('nombre'),
    db.from('materias').select('*').order('nombre'),
    db.from('asignaciones_docentes').select('*'),
    db.from('tipos_incidencia').select('*').order('nombre'),
    db.from('incidencias').select('*').order('created_at', { ascending: false }),
    db.from('seguimientos').select('*').order('created_at', { ascending: false })
  ]);

  const errors = [professorsResult, studentsResult, subjectsResult, assignmentsResult, typesResult, incidentsResult, followUpsResult]
    .map(result => result.error)
    .filter(Boolean);
  if (errors.length) {
    console.error(errors);
    throw new Error(errors[0].message);
  }

  professors = (professorsResult.data || []).map(row => ({
    raw: row,
    id: row.id,
    bannerId: row.id_banner ?? row.banner_id ?? row.clave ?? row.id,
    name: row.nombre ?? row.name ?? '',
    active: row.activo !== false
  })).filter(item => item.active);

  students = (studentsResult.data || []).map(row => ({
    raw: row,
    id: row.id,
    matricula: row.matricula ?? '',
    name: row.nombre ?? row.name ?? '',
    group: row.grupo ?? '',
    career: row.carrera ?? '',
    shift: row.turno ?? '',
    active: row.activo !== false
  })).filter(item => item.active);

  subjects = (subjectsResult.data || []).map(row => ({
    raw: row,
    id: row.id,
    name: row.nombre ?? row.materia ?? row.name ?? '',
    active: row.activo !== false
  })).filter(item => item.active);

  assignments = (assignmentsResult.data || []).map(row => ({
    raw: row,
    id: row.id,
    teacherId: row.profesor_id,
    subjectId: row.materia_id,
    group: row.grupo ?? '',
    schedule: row.horario ?? ''
  }));

  incidentTypes = (typesResult.data || []).map(row => ({
    raw: row,
    id: row.id,
    name: row.nombre ?? row.tipo ?? '',
    category: normalizeCategory(row.categoria),
    active: row.activo !== false
  })).filter(item => item.active);

  incidents = (incidentsResult.data || []).map(row => mapIncident(row));
  followUps = (followUpsResult.data || []).map(row => mapFollowUp(row));

  renderAll();
}

function mapIncident(row) {
  const professor = professors.find(item => item.id === row.profesor_id);
  const subject = subjects.find(item => item.id === row.materia_id);
  const student = students.find(item => item.id === row.alumno_id);
  const type = incidentTypes.find(item => item.id === row.tipo_incidencia_id);

  return {
    raw: row,
    id: row.id,
    date: row.fecha ?? String(row.created_at || '').slice(0, 10),
    time: String(row.hora ?? '').slice(0, 5),
    classroom: row.aula ?? '',
    teacherId: professor?.bannerId ?? row.profesor_id ?? '',
    professorDbId: row.profesor_id,
    teacher: professor?.name ?? row.profesor_nombre ?? 'Profesor no disponible',
    subjectId: row.materia_id,
    subject: subject?.name ?? row.materia_capturada ?? '-',
    group: row.grupo ?? '',
    studentId: row.alumno_id,
    student: student?.name ?? row.alumno_nombre ?? '',
    matricula: student?.matricula ?? row.matricula_capturada ?? '',
    typeId: row.tipo_incidencia_id,
    type: type?.name ?? row.tipo_capturado ?? 'Incidencia',
    category: type?.category ?? normalizeCategory(row.categoria),
    involved: row.involucrado ?? row.persona_involucrada ?? '',
    status: normalizeStatus(row.estado),
    description: row.observaciones ?? row.descripcion ?? '',
    registeredBy: row.registrado_por ?? row.usuario_id ?? null,
    createdAt: row.created_at
  };
}

function mapFollowUp(row) {
  const incident = incidents.find(item => item.id === row.incidencia_id);
  return {
    raw: row,
    id: row.id,
    incidentId: row.incidencia_id,
    date: String(row.fecha ?? row.created_at ?? '').slice(0, 10),
    teacher: incident?.teacher ?? '-',
    result: row.resultado ?? row.estado ?? '-',
    action: row.accion_realizada ?? row.accion ?? '',
    comment: row.comentario ?? row.observaciones ?? '',
    nextReview: row.proxima_revision ?? '',
    userId: row.registrado_por ?? row.usuario_id ?? null,
    user: row.usuario_nombre ?? (row.registrado_por === currentProfile?.id ? currentProfile.nombre : 'Usuario del sistema')
  };
}

function showSection(id) {
  document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
  document.querySelectorAll('.nav-button').forEach(button => button.classList.toggle('active', button.dataset.section === id));
  const section = $(id);
  if (section) section.classList.add('active');
  if ($('pageTitle')) $('pageTitle').textContent = pageNames[id] || id;
  if (id === 'graficas') setTimeout(renderCharts, 60);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showSection = showSection;

function currentMonthIncidents() {
  const month = today().slice(0, 7);
  return incidents.filter(item => item.date?.startsWith(month));
}

function getTeacherCounts() {
  return currentMonthIncidents().reduce((result, item) => {
    result[item.teacher] = (result[item.teacher] || 0) + 1;
    return result;
  }, {});
}

function renderAll() {
  const monthData = currentMonthIncidents();
  const counts = getTeacherCounts();
  const pending = monthData.filter(item => item.status === 'Pendiente');
  const resolved = monthData.filter(item => item.status === 'Resuelta');
  const alertTeachers = Object.entries(counts).filter(([, count]) => count >= 3);

  $('heroMonthTotal').textContent = monthData.length;
  $('metricMonth').textContent = monthData.length;
  $('metricAlerts').textContent = alertTeachers.length;
  $('metricPending').textContent = pending.length;
  $('metricResolved').textContent = resolved.length;
  $('sumPending').textContent = pending.length;
  $('sumResolved').textContent = resolved.length;
  $('sumAdministrative').textContent = monthData.filter(item => item.category === 'Administrativa').length;
  $('sumTotal').textContent = monthData.length;

  $('dashboardTable').innerHTML = incidents.slice(0, 5).map(item => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td class="${counts[item.teacher] >= 3 ? 'teacher-alert' : ''}">${escapeHtml(item.teacher)}</td>
      <td>${escapeHtml(item.group)}</td>
      <td>${escapeHtml(item.type)}</td>
      <td>${statusBadge(item.status)}</td>
    </tr>`).join('') || '<tr><td colspan="5">No hay incidencias registradas.</td></tr>';

  $('alertsContainer').innerHTML = alertTeachers.length
    ? alertTeachers.map(([teacher, count]) => `<div class="alert-box"><div>⚠</div><div><strong>${escapeHtml(teacher)}</strong>Ha acumulado ${count} incidencias durante el mes actual.</div></div>`).join('')
    : '<p class="help">No hay profesores en nivel de alerta.</p>';

  renderIncidents();
  renderPending();
  renderFollowUps();
  renderProfessors();
  renderStudents();
  renderSubjects();
  populateLists();
  renderChartSummaries();
}

function renderIncidents() {
  const teacher = lower($('filterTeacher').value);
  const group = lower($('filterGroup').value);
  const category = $('filterCategory').value;
  const type = $('filterType').value;
  const status = $('filterStatus').value;
  const month = $('filterDate').value;
  const counts = getTeacherCounts();

  const data = incidents.filter(item =>
    lower(item.teacher).includes(teacher) &&
    lower(item.group).includes(group) &&
    (!category || item.category === category) &&
    (!type || item.type === type) &&
    (!status || item.status === status) &&
    (!month || item.date?.startsWith(month))
  );

  $('incidentsTable').innerHTML = data.map(item => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td>${escapeHtml(item.time || '-')}</td>
      <td class="${counts[item.teacher] >= 3 ? 'teacher-alert' : ''}">${escapeHtml(item.teacher)}${counts[item.teacher] >= 3 ? ' ⚠' : ''}</td>
      <td>${escapeHtml(item.subject)}</td>
      <td>${escapeHtml(item.group)}</td>
      <td>${item.student ? `${escapeHtml(item.student)}<br><small>${escapeHtml(item.matricula)}</small>` : 'No aplica'}</td>
      <td><span class="badge info">${escapeHtml(item.category)}</span></td>
      <td title="${escapeHtml(item.description)}">${escapeHtml(item.type)}</td>
      <td>${statusBadge(item.status)}</td>
      <td><div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="openFollow('${item.id}')">Seguimiento</button>
        ${isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="deleteIncident('${item.id}')">Borrar</button>` : ''}
      </div></td>
    </tr>`).join('') || '<tr><td colspan="10">No se encontraron resultados.</td></tr>';
}

function renderPending() {
  $('pendingTable').innerHTML = incidents.filter(item => item.status === 'Pendiente').map(item => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td>${escapeHtml(item.teacher)}</td>
      <td>${escapeHtml(item.type)}</td>
      <td><button class="btn btn-warning btn-sm" onclick="openFollow('${item.id}')">Atender</button></td>
    </tr>`).join('') || '<tr><td colspan="4">No hay seguimientos pendientes.</td></tr>';
}

function renderFollowUps() {
  $('followTable').innerHTML = followUps.map(item => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td>${escapeHtml(item.teacher)}</td>
      <td>${escapeHtml(item.result)}</td>
      <td>${escapeHtml(item.comment)}</td>
      <td>${escapeHtml(item.user)}</td>
    </tr>`).join('') || '<tr><td colspan="5">No hay seguimientos registrados.</td></tr>';
}

function renderProfessors() {
  const counts = getTeacherCounts();
  $('teachersTable').innerHTML = professors.map(item => {
    const count = counts[item.name] || 0;
    return `<tr><td>${escapeHtml(item.bannerId)}</td><td class="${count >= 3 ? 'teacher-alert' : ''}">${escapeHtml(item.name)}</td><td>${count}</td><td>${count >= 3 ? '<span class="badge alert">En alerta</span>' : '<span class="badge resolved">Normal</span>'}</td></tr>`;
  }).join('') || '<tr><td colspan="4">No hay profesores registrados.</td></tr>';
}

function renderStudents() {
  $('studentsTable').innerHTML = students.map(item => `<tr><td>${escapeHtml(item.matricula)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.group)}</td><td>${escapeHtml(item.career || '-')}</td></tr>`).join('') || '<tr><td colspan="4">No hay alumnos registrados.</td></tr>';
}

function renderSubjects() {
  $('subjectsTable').innerHTML = assignments.map(item => {
    const subject = subjects.find(subjectItem => subjectItem.id === item.subjectId);
    const teacher = professors.find(professorItem => professorItem.id === item.teacherId);
    return `<tr><td>${escapeHtml(subject?.name || '-')}</td><td>${escapeHtml(item.group)}</td><td>${escapeHtml(teacher?.name || '-')}</td><td>${escapeHtml(item.schedule || '-')}</td></tr>`;
  }).join('') || '<tr><td colspan="4">No hay asignaciones registradas.</td></tr>';
}

function populateLists() {
  $('profesoresList').innerHTML = professors.map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.bannerId)}</option>`).join('');

  const filter = $('filterType');
  const current = filter.value;
  filter.innerHTML = '<option value="">Todas las incidencias</option>' + incidentTypes.map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('');
  filter.value = current;
}

function countBy(field) {
  return currentMonthIncidents().reduce((result, item) => {
    const key = item[field] || 'Sin información';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function topKey(object) {
  return Object.entries(object).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function renderChartSummaries() {
  const monthData = currentMonthIncidents();
  $('topType').textContent = topKey(countBy('type')) || '-';
  $('topGroup').textContent = topKey(countBy('group')) || '-';
  $('topTeacher').textContent = topKey(countBy('teacher')) || '-';
  $('resolvedRate').textContent = monthData.length ? `${Math.round(monthData.filter(item => item.status === 'Resuelta').length / monthData.length * 100)}%` : '0%';
}

function renderCharts() {
  Object.values(chartInstances).forEach(chart => chart.destroy());
  chartInstances = {};
  chartInstances.type = makeChart('typeChart', 'bar', countBy('type'), 'Incidencias');
  chartInstances.teacher = makeChart('teacherChart', 'bar', countBy('teacher'), 'Incidencias');
  chartInstances.group = makeChart('groupChart', 'bar', countBy('group'), 'Incidencias');
  chartInstances.status = new Chart($('statusChart'), {
    type: 'doughnut',
    data: {
      labels: ['Pendiente', 'Resuelta'],
      datasets: [{ data: [currentMonthIncidents().filter(item => item.status === 'Pendiente').length, currentMonthIncidents().filter(item => item.status === 'Resuelta').length] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

function makeChart(id, type, object, label) {
  return new Chart($(id), {
    type,
    data: { labels: Object.keys(object), datasets: [{ label, data: Object.values(object), borderRadius: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
  });
}

function updateIncidentTypeOptions(category) {
  const options = incidentTypes.filter(item => item.category === category);
  const select = $('tipo');
  select.disabled = !options.length;
  select.innerHTML = options.length
    ? '<option value="">Selecciona una opción</option>' + options.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')
    : '<option value="">No hay tipos registrados para esta categoría</option>';
}

function fillTeacherAssignments(professor) {
  if (!professor) return;
  $('profesorId').value = professor.bannerId;
  const teacherAssignments = assignments.filter(item => item.teacherId === professor.id);
  if (teacherAssignments.length === 1) {
    const assignment = teacherAssignments[0];
    $('materia').value = subjects.find(item => item.id === assignment.subjectId)?.name || '';
    $('grupo').value = assignment.group || '';
  }
}

async function registerIncident(event) {
  event.preventDefault();
  const teacher = professors.find(item => lower(item.name) === lower($('profesor').value));
  const subject = subjects.find(item => lower(item.name) === lower($('materia').value));
  const student = students.find(item => item.matricula === clean($('matricula').value));

  if (!teacher) return showToast('Selecciona un profesor registrado.');
  if (!subject) return showToast('La materia debe estar registrada en Supabase.');
  if (!$('tipo').value) return showToast('Selecciona el tipo de incidencia.');

  const payload = {
    fecha: $('fecha').value,
    hora: $('hora').value,
    aula: clean($('aula').value) || null,
    profesor_id: teacher.id,
    materia_id: subject.id,
    grupo: clean($('grupo').value),
    tipo_incidencia_id: $('tipo').value,
    involucrado: $('involucrado').value,
    alumno_id: student?.id || null,
    matricula_capturada: clean($('matricula').value) || null,
    observaciones: clean($('descripcion').value),
    estado: 'pendiente',
    registrado_por: currentProfile.id
  };

  const button = event.submitter;
  if (button) button.disabled = true;
  try {
    const { error } = await db.from('incidencias').insert(payload);
    if (error) throw error;
    await writeLog('CREAR_INCIDENCIA', 'incidencias', null, payload);
    event.target.reset();
    $('fecha').value = today();
    $('hora').value = nowTime();
    updateIncidentTypeOptions('');
    await loadData({ silent: true });
    showToast('Incidencia guardada y sincronizada.');
    showSection('incidencias');
  } catch (error) {
    console.error(error);
    showToast(`No se pudo guardar: ${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}

function openFollow(id) {
  $('followIncidentId').value = id;
  $('followModal').classList.add('show');
}
window.openFollow = openFollow;

function closeModal() {
  $('followModal').classList.remove('show');
  $('followForm').reset();
}
window.closeModal = closeModal;

async function saveFollowUp(event) {
  event.preventDefault();
  const incidentId = $('followIncidentId').value;
  const result = $('followResult').value;
  const resolved = ['Resuelta', 'Se dio seguimiento'].includes(result);

  const payload = {
    incidencia_id: incidentId,
    resultado: result,
    accion_realizada: clean($('followAction').value) || null,
    comentario: clean($('followComment').value),
    proxima_revision: $('followNext').value || null,
    registrado_por: currentProfile.id
  };

  try {
    const { error } = await db.from('seguimientos').insert(payload);
    if (error) throw error;

    const { error: updateError } = await db
      .from('incidencias')
      .update({ estado: resolved ? 'resuelta' : 'pendiente' })
      .eq('id', incidentId);
    if (updateError) throw updateError;

    await writeLog('CREAR_SEGUIMIENTO', 'seguimientos', incidentId, payload);
    closeModal();
    await loadData({ silent: true });
    showToast('Seguimiento registrado y sincronizado.');
  } catch (error) {
    console.error(error);
    showToast(`No se pudo registrar: ${error.message}`);
  }
}

async function addProfessor(event) {
  event.preventDefault();
  if (!isAdmin()) return showToast('Solo el administrador puede agregar profesores.');
  const payload = { id_banner: clean($('newTeacherId').value), nombre: clean($('newTeacherName').value), activo: true };
  const { error } = await db.from('profesores').insert(payload);
  if (error) return showToast(`No se pudo agregar: ${error.message}`);
  event.target.reset();
  await loadData({ silent: true });
  showToast('Profesor agregado.');
}

async function addStudent(event) {
  event.preventDefault();
  if (!isAdmin()) return showToast('Solo el administrador puede agregar alumnos.');
  const payload = {
    matricula: clean($('newStudentMat').value),
    nombre: clean($('newStudentName').value),
    grupo: clean($('newStudentGroup').value),
    carrera: clean($('newStudentCareer').value) || null,
    activo: true
  };
  const { error } = await db.from('alumnos').insert(payload);
  if (error) return showToast(`No se pudo agregar: ${error.message}`);
  event.target.reset();
  await loadData({ silent: true });
  showToast('Alumno agregado.');
}

async function addSubjectAssignment(event) {
  event.preventDefault();
  if (!isAdmin()) return showToast('Solo el administrador puede agregar materias.');

  const teacher = professors.find(item => clean(item.bannerId) === clean($('subjectTeacherId').value));
  if (!teacher) return showToast('No se encontró el ID del profesor.');

  let subject = subjects.find(item => lower(item.name) === lower($('subjectName').value));
  if (!subject) {
    const { data, error } = await db.from('materias').insert({ nombre: clean($('subjectName').value), activo: true }).select('*').single();
    if (error) return showToast(`No se pudo crear la materia: ${error.message}`);
    subject = { id: data.id, name: data.nombre };
  }

  const payload = {
    profesor_id: teacher.id,
    materia_id: subject.id,
    grupo: clean($('subjectGroup').value),
    horario: clean($('subjectSchedule').value) || null
  };
  const { error } = await db.from('asignaciones_docentes').insert(payload);
  if (error) return showToast(`No se pudo guardar: ${error.message}`);
  event.target.reset();
  await loadData({ silent: true });
  showToast('Asignación guardada.');
}

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function firstValue(row, aliases) {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  for (const alias of aliases) {
    const value = normalized[normalizeHeader(alias)];
    if (value !== undefined && value !== null && clean(value)) return clean(value);
  }
  return '';
}

async function importDatabaseFile(event, kind) {
  if (!isAdmin()) {
    event.target.value = '';
    return showToast('Solo el administrador puede importar bases.');
  }
  const file = event.target.files[0];
  if (!file) return;
  const infoId = kind === 'teachers' ? 'teacherUploadInfo' : 'studentUploadInfo';

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false });
    if (!rows.length) throw new Error('El archivo no contiene registros.');

    if (kind === 'teachers') {
      const payload = rows.map(row => ({
        id_banner: firstValue(row, ['ID Banner', 'id', 'clave']),
        nombre: firstValue(row, ['nombre', 'nombre profesor', 'profesor', 'docente', 'nombre completo']),
        activo: true
      })).filter(item => item.id_banner && item.nombre);
      if (!payload.length) throw new Error('Se requieren las columnas ID Banner y Nombre.');
      const { error } = await db.from('profesores').upsert(payload, { onConflict: 'id_banner' });
      if (error) throw error;
      $(infoId).textContent = `${payload.length} profesores importados desde ${file.name}.`;
    } else {
      const payload = rows.map(row => ({
        matricula: firstValue(row, ['matricula', 'matrícula', 'id alumno', 'numero cuenta']),
        nombre: firstValue(row, ['nombre', 'nombre alumno', 'alumno', 'nombre completo']),
        grupo: firstValue(row, ['grupo', 'grado y grupo']),
        carrera: firstValue(row, ['carrera', 'programa', 'licenciatura']) || null,
        turno: firstValue(row, ['turno']) || null,
        activo: true
      })).filter(item => item.matricula && item.nombre);
      if (!payload.length) throw new Error('Se requieren las columnas Matrícula y Nombre.');
      const { error } = await db.from('alumnos').upsert(payload, { onConflict: 'matricula' });
      if (error) throw error;
      $(infoId).textContent = `${payload.length} alumnos importados desde ${file.name}.`;
    }

    await loadData({ silent: true });
    showToast('Importación terminada.');
  } catch (error) {
    console.error(error);
    $(infoId).textContent = `No se pudo importar ${file.name}: ${error.message}`;
    showToast('No se pudo importar el archivo.');
  } finally {
    event.target.value = '';
  }
}

async function deleteIncident(id) {
  if (!isAdmin()) return showToast('Solo el administrador puede borrar incidencias.');
  const incident = incidents.find(item => String(item.id) === String(id));
  if (!incident || !confirm(`¿Deseas borrar la incidencia de ${incident.teacher}?`)) return;
  const { error } = await db.from('incidencias').delete().eq('id', id);
  if (error) return showToast(`No se pudo borrar: ${error.message}`);
  await writeLog('ELIMINAR_INCIDENCIA', 'incidencias', id, incident.raw);
  await loadData({ silent: true });
  showToast('Incidencia eliminada.');
}
window.deleteIncident = deleteIncident;

async function writeLog(action, tableName, recordId, details) {
  try {
    await db.from('bitacora').insert({
      usuario_id: currentProfile.id,
      accion: action,
      tabla_afectada: tableName,
      registro_id: recordId,
      detalles: details
    });
  } catch (error) {
    console.warn('No se pudo escribir en bitácora:', error.message);
  }
}

function applyPermissions() {
  const admin = isAdmin();
  $('currentUserName').textContent = currentProfile.nombre;
  $('currentUserRole').textContent = `${admin ? 'Administrador' : 'Operativo'} · Plantel UTC`;
  $('currentUserAvatar').textContent = initials(currentProfile.nombre);
  if ($('sessionInfo')) $('sessionInfo').value = `${currentProfile.nombre} — ${admin ? 'Administrador' : 'Operativo'}`;
  document.querySelectorAll('.admin-only').forEach(element => element.classList.toggle('hidden', !admin));

  ['teacherForm', 'studentForm', 'subjectForm'].forEach(id => {
    const form = $(id);
    if (form) form.querySelectorAll('input,select,button').forEach(control => control.disabled = !admin);
  });
  ['teacherFile', 'studentFile'].forEach(id => { if ($(id)) $(id).disabled = !admin; });
}

function subscribeRealtime() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  realtimeChannel = db.channel('utc-incidencias-tiempo-real');

  ['incidencias', 'seguimientos', 'profesores', 'alumnos', 'materias', 'asignaciones_docentes', 'tipos_incidencia'].forEach(table => {
    realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(async () => {
        try {
          await loadData({ silent: true });
          const messages = {
            INSERT: `Nuevo registro en ${table}`,
            UPDATE: `Información actualizada en ${table}`,
            DELETE: `Registro eliminado de ${table}`
          };
          showToast(`${messages[payload.eventType] || 'Cambio recibido'} · tiempo real`);
        } catch (error) {
          console.error('Error al refrescar Realtime:', error);
        }
      }, 250);
    });
  });

  realtimeChannel.subscribe(status => {
    if (status === 'SUBSCRIBED') console.info('Supabase Realtime conectado.');
  });
}

function exportCSV() {
  if (!isAdmin()) return showToast('Solo el administrador puede descargar reportes.');
  const headers = ['Fecha', 'Hora', 'ID profesor', 'Profesor', 'Materia', 'Grupo', 'Matrícula', 'Alumno', 'Categoría', 'Incidencia', 'Estatus', 'Descripción'];
  const rows = incidents.map(item => [item.date, item.time, item.teacherId, item.teacher, item.subject, item.group, item.matricula, item.student, item.category, item.type, item.status, item.description]);
  const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'reporte_incidencias_utc.csv';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}
window.exportCSV = exportCSV;
window.fakeExport = name => showToast(`${name}: usa el reporte CSV general.`);

function attachEvents() {
  document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => showSection(button.dataset.section)));
  $('incidentForm').addEventListener('submit', registerIncident);
  $('followForm').addEventListener('submit', saveFollowUp);
  $('teacherForm').addEventListener('submit', addProfessor);
  $('studentForm').addEventListener('submit', addStudent);
  $('subjectForm').addEventListener('submit', addSubjectAssignment);
  $('teacherFile').addEventListener('change', event => importDatabaseFile(event, 'teachers'));
  $('studentFile').addEventListener('change', event => importDatabaseFile(event, 'students'));

  $('categoria').addEventListener('change', event => updateIncidentTypeOptions(event.target.value));
  $('profesor').addEventListener('change', event => fillTeacherAssignments(professors.find(item => lower(item.name) === lower(event.target.value))));
  $('matricula').addEventListener('change', event => {
    const student = students.find(item => item.matricula === clean(event.target.value));
    if (student) {
      $('alumno').value = student.name;
      $('grupo').value = student.group;
    }
  });

  ['filterTeacher', 'filterGroup', 'filterCategory', 'filterType', 'filterStatus', 'filterDate'].forEach(id => $(id).addEventListener('input', renderIncidents));
  $('logoutButton').addEventListener('click', async () => {
    if (realtimeChannel) await db.removeChannel(realtimeChannel);
    await db.auth.signOut();
    window.location.href = 'login.html';
  });

  window.addEventListener('beforeunload', () => {
    if (realtimeChannel) db.removeChannel(realtimeChannel);
  });
}

async function startApp() {
  try {
    await requireSession();
    attachEvents();
    applyPermissions();
    $('currentDate').textContent = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(new Date());
    $('fecha').value = today();
    $('hora').value = nowTime();
    await loadData({ silent: true });
    subscribeRealtime();
  } catch (error) {
    console.error(error);
    showToast(`Error al iniciar: ${error.message}`);
  }
}

startApp();
