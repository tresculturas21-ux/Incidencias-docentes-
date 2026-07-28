// Arreglos de datos iniciales totalmente vacíos
const professors = [];
const students = [];
const subjects = [];
let incidents = [];
let followUps = [];

const users = [
  { id: 1, name: 'Administrador', initials: 'AR', role: 'admin' },
  { id: 2, name: 'Operativo 1', initials: 'O1', role: 'operativo' },
  { id: 3, name: 'Operativo 2', initials: 'O2', role: 'operativo' },
  { id: 4, name: 'Operativo 3', initials: 'O3', role: 'operativo' }
];

const storedSession = JSON.parse(localStorage.getItem('utc_docentes_session') || 'null');
if (!storedSession) window.location.replace('login.html');

let currentUser = users.find(user => user.role === storedSession?.role) || users[0];
if (storedSession?.name) {
  currentUser = { 
    ...currentUser, 
    name: storedSession.name, 
    initials: storedSession.initials || currentUser.initials 
  };
}

const incidentTypes = {
  Operativa: [
    'Profesor fuera del salón', 'Alumnos sentados en otro orden', 'Alumnos dormidos',
    'Alumnos maquillándose', 'Alumnos sin playera', 'Alumnos y/o profesor comiendo',
    'Profesor y/o alumnos en el celular', 'Alumnos fuera de clase', 'Guardia de receso',
    'El profesor falta al respeto al alumno', 'Evaluación incorrecta al alumno',
    'Queja de padre de familia o tutor', 'Acoso a alumnos', 'Otra incidencia operativa'
  ],
  Administrativa: [
    'No entregó a tiempo disponibilidad horaria', 'Llegó tarde',
    'Falta al trabajo sin justificante', 'No entregó dosificación a tiempo',
    'Otra incidencia administrativa'
  ]
};

let chartInstances = {};

// Inicialización de fecha/hora si existen los elementos
const currentDateEl = document.getElementById('currentDate');
if (currentDateEl) currentDateEl.textContent = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(new Date());

const fechaInput = document.getElementById('fecha');
if (fechaInput) fechaInput.valueAsDate = new Date();

const horaInput = document.getElementById('hora');
if (horaInput) horaInput.value = new Date().toTimeString().slice(0, 5);

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

document.querySelectorAll('.nav-button').forEach(btn => {
  btn.addEventListener('click', () => showSection(btn.dataset.section));
});

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-button').forEach(b => b.classList.toggle('active', b.dataset.section === id));
  
  const sectionEl = document.getElementById(id);
  if (sectionEl) sectionEl.classList.add('active');
  
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = pageNames[id] || id;
  
  if (id === 'graficas') setTimeout(renderCharts, 50);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getTeacherCounts() {
  return incidents.reduce((acc, item) => {
    if (item.teacher) {
      acc[item.teacher] = (acc[item.teacher] || 0) + 1;
    }
    return acc;
  }, {});
}

function renderAll() {
  const counts = getTeacherCounts();
  const pending = incidents.filter(i => i.status === 'Pendiente');
  const resolved = incidents.filter(i => i.status === 'Resuelta');
  const alertTeachers = Object.entries(counts).filter(([, count]) => count >= 3);

  const setContent = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setContent('heroMonthTotal', incidents.length);
  setContent('metricMonth', incidents.length);
  setContent('metricAlerts', alertTeachers.length);
  setContent('metricPending', pending.length);
  setContent('metricResolved', resolved.length);
  setContent('sumPending', pending.length);
  setContent('sumResolved', resolved.length);
  setContent('sumAdministrative', incidents.filter(i => i.category === 'Administrativa').length);
  setContent('sumTotal', incidents.length);

  const dashboardTable = document.getElementById('dashboardTable');
  if (dashboardTable) {
    const dashboardRows = [...incidents].reverse().slice(0, 5).map(i => `
      <tr>
        <td>${formatDate(i.date)}</td>
        <td class="${counts[i.teacher] >= 3 ? 'teacher-alert' : ''}">${i.teacher}</td>
        <td>${i.group}</td>
        <td>${i.type}</td>
        <td>${statusBadge(i.status)}</td>
      </tr>`).join('');
    dashboardTable.innerHTML = dashboardRows || '<tr><td colspan="5">No hay incidencias recientes.</td></tr>';
  }

  const alertsContainer = document.getElementById('alertsContainer');
  if (alertsContainer) {
    alertsContainer.innerHTML = alertTeachers.length ? alertTeachers.map(([teacher, count]) => `
      <div class="alert-box">
        <div>⚠</div>
        <div><strong>${teacher}</strong> Ha acumulado ${count} incidencias durante el mes actual.</div>
      </div>`).join('') : '<p class="help">No hay profesores en nivel de alerta.</p>';
  }

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
  const table = document.getElementById('incidentsTable');
  if (!table) return;

  const teacher = (document.getElementById('filterTeacher')?.value || '').toLowerCase();
  const group = (document.getElementById('filterGroup')?.value || '').toLowerCase();
  const category = document.getElementById('filterCategory')?.value || '';
  const type = document.getElementById('filterType')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const month = document.getElementById('filterDate')?.value || '';
  
  const counts = getTeacherCounts();
  const data = incidents.filter(i =>
    (i.teacher || '').toLowerCase().includes(teacher) && 
    (i.group || '').toLowerCase().includes(group) && 
    (!category || (i.category || 'Operativa') === category) && 
    (!type || i.type === type) && 
    (!status || i.status === status) && 
    (!month || (i.date && i.date.startsWith(month)))
  );

  table.innerHTML = data.map(i => `
    <tr>
      <td>${formatDate(i.date)}</td>
      <td>${i.time}</td>
      <td class="${counts[i.teacher] >= 3 ? 'teacher-alert' : ''}">${i.teacher}${counts[i.teacher] >= 3 ? ' ⚠' : ''}</td>
      <td>${i.subject}</td>
      <td>${i.group}</td>
      <td>${i.student ? `${i.student}<br><small>${i.matricula}</small>` : 'No aplica'}</td>
      <td><span class="badge info">${i.category || 'Operativa'}</span></td>
      <td>${i.type}</td>
      <td>${statusBadge(i.status)}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="openFollow(${i.id})">Seguimiento</button>
          ${currentUser.role === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteIncident(${i.id})">Borrar</button>` : ''}
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="10">No se encontraron resultados.</td></tr>';
}

function renderPending() {
  const table = document.getElementById('pendingTable');
  if (!table) return;

  table.innerHTML = incidents.filter(i => i.status === 'Pendiente').map(i => `
    <tr>
      <td>${formatDate(i.date)}</td>
      <td>${i.teacher}</td>
      <td>${i.type}</td>
      <td><button class="btn btn-warning btn-sm" onclick="openFollow(${i.id})">Atender</button></td>
    </tr>`).join('') || '<tr><td colspan="4">No hay seguimientos pendientes.</td></tr>';
}

function renderFollowUps() {
  const table = document.getElementById('followTable');
  if (!table) return;

  table.innerHTML = [...followUps].reverse().map(f => `
    <tr>
      <td>${formatDate(f.date)}</td>
      <td>${f.teacher}</td>
      <td>${f.result}</td>
      <td>${f.comment}</td>
      <td>${f.user}</td>
    </tr>`).join('') || '<tr><td colspan="5">No hay seguimientos registrados.</td></tr>';
}

function renderProfessors() {
  const table = document.getElementById('teachersTable');
  if (!table) return;

  const counts = getTeacherCounts();
  table.innerHTML = professors.map(p => {
    const count = counts[p.name] || 0;
    return `
      <tr>
        <td>${p.id}</td>
        <td class="${count >= 3 ? 'teacher-alert' : ''}">${p.name}</td>
        <td>${count}</td>
        <td>${count >= 3 ? '<span class="badge alert">En alerta</span>' : '<span class="badge resolved">Normal</span>'}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="4">No hay profesores registrados. Importa o agrega uno.</td></tr>';
}

function renderStudents() {
  const table = document.getElementById('studentsTable');
  if (!table) return;

  table.innerHTML = students.map(s => `
    <tr>
      <td>${s.matricula}</td>
      <td>${s.name}</td>
      <td>${s.group}</td>
      <td>${s.career || '-'}</td>
    </tr>`).join('') || '<tr><td colspan="4">No hay alumnos registrados. Importa o agrega uno.</td></tr>';
}

function renderSubjects() {
  const table = document.getElementById('subjectsTable');
  if (!table) return;

  table.innerHTML = subjects.map(s => {
    const teacher = professors.find(p => p.id === s.teacherId)?.name || s.teacherId;
    return `
      <tr>
        <td>${s.subject}</td>
        <td>${s.group}</td>
        <td>${teacher}</td>
        <td>${s.schedule || '-'}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="4">No hay materias ni asignaciones agregadas.</td></tr>';
}

function populateLists() {
  const profList = document.getElementById('profesoresList');
  if (profList) {
    profList.innerHTML = professors.map(p => `<option value="${p.name}">${p.id}</option>`).join('');
  }

  const select = document.getElementById('filterType');
  if (select) {
    const types = [...new Set(incidents.map(i => i.type))];
    const current = select.value;
    select.innerHTML = '<option value="">Todas las incidencias</option>' + types.map(t => `<option>${t}</option>`).join('');
    select.value = current;
  }
}

function renderChartSummaries() {
  const typeCounts = countBy('type');
  const groupCounts = countBy('group');
  const teacherCounts = countBy('teacher');

  const setContent = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setContent('topType', topKey(typeCounts) || '-');
  setContent('topGroup', topKey(groupCounts) || '-');
  setContent('topTeacher', topKey(teacherCounts) || '-');
  setContent('resolvedRate', incidents.length ? Math.round(incidents.filter(i => i.status === 'Resuelta').length / incidents.length * 100) + '%' : '0%');
}

function countBy(field) {
  return incidents.reduce((acc, i) => { 
    if (i[field]) acc[i[field]] = (acc[i[field]] || 0) + 1; 
    return acc; 
  }, {});
}

function topKey(obj) { return Object.entries(obj).sort((a,b) => b[1]-a[1])[0]?.[0]; }

function renderCharts() {
  if (typeof Chart === 'undefined') return;

  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  if (document.getElementById('typeChart')) chartInstances.type = makeChart('typeChart', 'bar', countBy('type'), 'Incidencias');
  if (document.getElementById('teacherChart')) chartInstances.teacher = makeChart('teacherChart', 'bar', countBy('teacher'), 'Incidencias');
  if (document.getElementById('groupChart')) chartInstances.group = makeChart('groupChart', 'bar', countBy('group'), 'Incidencias');
  
  const statusEl = document.getElementById('statusChart');
  if (statusEl) {
    chartInstances.status = new Chart(statusEl, {
      type: 'doughnut',
      data: { 
        labels: ['Pendiente', 'Resuelta'], 
        datasets: [{ 
          data: [
            incidents.filter(i => i.status === 'Pendiente').length, 
            incidents.filter(i => i.status === 'Resuelta').length
          ], 
          backgroundColor: ['#f2c230','#0d5d98'] 
        }] 
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

function makeChart(id, type, obj, label) {
  const el = document.getElementById(id);
  if (!el) return null;
  return new Chart(el, {
    type,
    data: { labels: Object.keys(obj), datasets: [{ label, data: Object.values(obj), backgroundColor: '#0d5d98', borderRadius: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
  });
}

// Event Listeners de formularios de forma segura
document.getElementById('incidentForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const teacherInput = document.getElementById('profesor');
  const profIdInput = document.getElementById('profesorId');
  const matInput = document.getElementById('materia');
  const grpInput = document.getElementById('grupo');
  const almInput = document.getElementById('alumno');
  const matrInput = document.getElementById('matricula');
  const catInput = document.getElementById('categoria');
  const tipInput = document.getElementById('tipo');
  const invInput = document.getElementById('involucrado');
  const descInput = document.getElementById('descripcion');

  const teacher = teacherInput?.value.trim() || '';
  const p = professors.find(x => x.name.toLowerCase() === teacher.toLowerCase());

  incidents.push({
    id: Date.now(), 
    date: document.getElementById('fecha')?.value || '', 
    time: document.getElementById('hora')?.value || '', 
    teacherId: profIdInput?.value.trim() || p?.id || '', 
    teacher,
    subject: matInput?.value.trim() || '', 
    group: grpInput?.value.trim() || '', 
    student: almInput?.value.trim() || '', 
    matricula: matrInput?.value.trim() || '', 
    category: catInput?.value || '', 
    type: tipInput?.value || '',
    involved: invInput?.value || '', 
    status: 'Pendiente', 
    description: descInput?.value.trim() || ''
  });

  e.target.reset();
  if (fechaInput) fechaInput.valueAsDate = new Date(); 
  if (horaInput) horaInput.value = new Date().toTimeString().slice(0, 5);
  
  renderAll(); 
  showToast('Incidencia guardada correctamente'); 
  showSection('incidencias');
});

document.getElementById('categoria')?.addEventListener('change', e => {
  const select = document.getElementById('tipo');
  if (!select) return;
  const options = incidentTypes[e.target.value] || [];
  select.disabled = !options.length;
  select.innerHTML = options.length ? '<option value="">Selecciona una opción</option>' + options.map(item => `<option>${item}</option>`).join('') : '<option value="">Primero selecciona una categoría</option>';
});

document.getElementById('profesor')?.addEventListener('change', e => {
  const p = professors.find(x => x.name.toLowerCase() === e.target.value.toLowerCase());
  const profIdEl = document.getElementById('profesorId');
  if (p && profIdEl) profIdEl.value = p.id;
});

document.getElementById('matricula')?.addEventListener('change', e => {
  const s = students.find(x => x.matricula === e.target.value.trim());
  if (s) { 
    const alm = document.getElementById('alumno');
    const grp = document.getElementById('grupo');
    if (alm) alm.value = s.name; 
    if (grp) grp.value = s.group; 
  }
});

['filterTeacher','filterGroup','filterCategory','filterType','filterStatus','filterDate'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', renderIncidents);
});

function openFollow(id) {
  const followIdEl = document.getElementById('followIncidentId');
  const modalEl = document.getElementById('followModal');
  if (followIdEl) followIdEl.value = id;
  if (modalEl) modalEl.classList.add('show');
}

function closeModal() { 
  const modalEl = document.getElementById('followModal');
  const formEl = document.getElementById('followForm');
  if (modalEl) modalEl.classList.remove('show'); 
  if (formEl) formEl.reset(); 
}

document.getElementById('followForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const id = Number(document.getElementById('followIncidentId')?.value);
  const incident = incidents.find(i => i.id === id);
  const resultVal = document.getElementById('followResult')?.value || '';
  const commentVal = document.getElementById('followComment')?.value || '';

  if (incident) {
    followUps.push({ 
      date: new Date().toISOString().slice(0, 10), 
      teacher: incident.teacher, 
      result: resultVal, 
      comment: commentVal.trim(), 
      user: currentUser.name 
    });
    if (resultVal === 'Resuelta' || resultVal === 'Se dio seguimiento') incident.status = 'Resuelta';
  }

  renderAll(); 
  closeModal(); 
  showToast('Seguimiento registrado');
});

document.getElementById('teacherForm')?.addEventListener('submit', e => {
  e.preventDefault(); 
  const idVal = document.getElementById('newTeacherId')?.value.trim();
  const nameVal = document.getElementById('newTeacherName')?.value.trim();
  if (idVal && nameVal) {
    professors.push({ id: idVal, name: nameVal }); 
    localStorage.setItem('utc_professors', JSON.stringify(professors)); 
    e.target.reset(); 
    renderAll(); 
    showToast('Profesor agregado');
  }
});

document.getElementById('studentForm')?.addEventListener('submit', e => {
  e.preventDefault(); 
  const matVal = document.getElementById('newStudentMat')?.value.trim();
  const nameVal = document.getElementById('newStudentName')?.value.trim();
  const groupVal = document.getElementById('newStudentGroup')?.value.trim();
  const careerVal = document.getElementById('newStudentCareer')?.value.trim();
  
  if (matVal && nameVal) {
    students.push({ matricula: matVal, name: nameVal, group: groupVal, career: careerVal }); 
    localStorage.setItem('utc_students', JSON.stringify(students)); 
    e.target.reset(); 
    renderAll(); 
    showToast('Alumno agregado');
  }
});

document.getElementById('subjectForm')?.addEventListener('submit', e => {
  e.preventDefault(); 
  const nameVal = document.getElementById('subjectName')?.value.trim();
  const grpVal = document.getElementById('subjectGroup')?.value.trim();
  const teachIdVal = document.getElementById('subjectTeacherId')?.value.trim();
  const schedVal = document.getElementById('subjectSchedule')?.value.trim();

  subjects.push({ subject: nameVal, group: grpVal, teacherId: teachIdVal, schedule: schedVal }); 
  e.target.reset(); 
  renderAll(); 
  showToast('Asignación guardada');
});

document.getElementById('teacherFile')?.addEventListener('change', e => importDatabaseFile(e, 'teachers'));
document.getElementById('studentFile')?.addEventListener('change', e => importDatabaseFile(e, 'students'));

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function firstValue(row, aliases) {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  for (const alias of aliases) {
    const value = normalized[normalizeHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

async function importDatabaseFile(event, kind) {
  if (currentUser.role !== 'admin') {
    event.target.value = '';
    return showToast('Solo el administrador puede importar bases de datos');
  }

  const file = event.target.files[0];
  if (!file) return;
  const infoId = kind === 'teachers' ? 'teacherUploadInfo' : 'studentUploadInfo';
  const infoEl = document.getElementById(infoId);

  try {
    if (typeof XLSX === 'undefined') throw new Error('La librería XLSX no está disponible.');
    
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
    if (!rows.length) throw new Error('El archivo no contiene registros.');

    if (kind === 'teachers') {
      const imported = rows.map((row) => ({
        id: firstValue(row, ['ID Banner', 'id', 'idbanner', 'clave']),
        name: firstValue(row, ['nombre', 'nombre profesor', 'nombre del profesor', 'profesor', 'docente', 'nombre completo'])
      })).filter(item => item.name);

      if (!imported.length) throw new Error('No se encontraron registros válidos. El Excel debe incluir las columnas ID Banner y Nombre.');
      if (imported.some(item => !item.id)) throw new Error('Uno o más profesores no tienen ID Banner. El valor debe copiarse tal cual desde el Excel.');
      
      imported.forEach(item => {
        const existing = professors.find(p => p.id.toLowerCase() === item.id.toLowerCase() || p.name.toLowerCase() === item.name.toLowerCase());
        if (existing) Object.assign(existing, item); else professors.push(item);
      });
      localStorage.setItem('utc_professors', JSON.stringify(professors));
      if (infoEl) infoEl.textContent = `Archivo: ${file.name}. ${imported.length} profesores importados correctamente.`;
      showToast(`${imported.length} profesores importados`);
    } else {
      const imported = rows.map(row => ({
        matricula: firstValue(row, ['matricula', 'matrícula', 'id alumno', 'numero cuenta', 'no cuenta']),
        name: firstValue(row, ['nombre', 'nombre alumno', 'nombre del alumno', 'alumno', 'nombre completo']),
        group: firstValue(row, ['grupo', 'grado y grupo', 'grado grupo']),
        career: firstValue(row, ['carrera', 'programa', 'licenciatura']),
        shift: firstValue(row, ['turno'])
      })).filter(item => item.matricula && item.name);

      if (!imported.length) throw new Error('No se encontraron las columnas matrícula y nombre del alumno.');
      imported.forEach(item => {
        const existing = students.find(s => s.matricula.toLowerCase() === item.matricula.toLowerCase());
        if (existing) Object.assign(existing, item); else students.push(item);
      });
      localStorage.setItem('utc_students', JSON.stringify(students));
      if (infoEl) infoEl.textContent = `Archivo: ${file.name}. ${imported.length} alumnos importados correctamente.`;
      showToast(`${imported.length} alumnos importados`);
    }

    renderAll();
  } catch (error) {
    console.error(error);
    if (infoEl) infoEl.textContent = `No se pudo importar ${file.name}: ${error.message}`;
    showToast('No se pudo leer el archivo');
  } finally {
    event.target.value = '';
  }
}

function deleteIncident(id) {
  if (currentUser.role !== 'admin') return showToast('Solo el administrador puede borrar incidencias');
  const incident = incidents.find(i => i.id === id);
  if (!incident || !confirm(`¿Deseas borrar la incidencia de ${incident.teacher}?`)) return;
  incidents = incidents.filter(i => i.id !== id);
  renderAll();
  showToast('Incidencia borrada correctamente');
}

function renderUsers() {
  const selector = document.getElementById('userSelector');
  if (!selector) return;

  selector.innerHTML = users.map(u => `<option value="${u.id}">${u.name} — ${u.role === 'admin' ? 'Administrador' : 'Operativo'}</option>`).join('');
  selector.value = currentUser.id;
  selector.onchange = () => {
    currentUser = users.find(u => u.id === Number(selector.value)) || users[0];
    applyPermissions();
    renderAll();
  };
}

function applyPermissions() {
  const isAdmin = currentUser.role === 'admin';
  
  const nameEl = document.getElementById('currentUserName');
  if (nameEl) nameEl.textContent = currentUser.name;

  const roleEl = document.getElementById('currentUserRole');
  if (roleEl) roleEl.textContent = `${isAdmin ? 'Administrador' : 'Operativo'} · Plantel UTC`;

  const avatarEl = document.querySelector('.avatar');
  if (avatarEl) avatarEl.textContent = currentUser.initials;

  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
  
  const reportNav = document.querySelector('[data-section="reportes"]');
  if (reportNav) reportNav.classList.toggle('hidden', !isAdmin);

  const reportesSec = document.getElementById('reportes');
  if (!isAdmin && reportesSec && reportesSec.classList.contains('active')) showSection('dashboard');
}

function statusBadge(status) { return status === 'Resuelta' ? '<span class="badge resolved">Resuelta</span>' : '<span class="badge pending">Pendiente</span>'; }

function formatDate(date) { 
  if (!date) return '-';
  return new Date(date + 'T00:00:00').toLocaleDateString('es-MX'); 
}

function showToast(message) { 
  const t = document.getElementById('toast'); 
  if (!t) return;
  t.textContent = message; 
  t.classList.add('show'); 
  setTimeout(() => t.classList.remove('show'), 2200); 
}

function exportCSV() {
  if (currentUser.role !== 'admin') return showToast('Solo el administrador puede descargar reportes');
  const headers = ['Fecha','Hora','ID Profesor','Profesor','Materia','Grupo','Matrícula','Alumno','Categoría','Incidencia','Estatus','Descripción'];
  const rows = incidents.map(i => [i.date, i.time, i.teacherId, i.teacher, i.subject, i.group, i.matricula, i.student, i.category || 'Operativa', i.type, i.status, i.description]);
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); 
  a.href = URL.createObjectURL(blob); 
  a.download = 'reporte_incidencias_utc.csv'; 
  a.click(); 
  URL.revokeObjectURL(a.href);
}

// Cargar bases guardadas si existen en LocalStorage
try {
  const savedProfessors = JSON.parse(localStorage.getItem('utc_professors') || 'null');
  const savedStudents = JSON.parse(localStorage.getItem('utc_students') || 'null');
  if (Array.isArray(savedProfessors) && savedProfessors.length) professors.splice(0, professors.length, ...savedProfessors);
  if (Array.isArray(savedStudents) && savedStudents.length) students.splice(0, students.length, ...savedStudents);
} catch (error) {
  console.warn('No fue posible recuperar las bases locales.', error);
}

renderUsers();
applyPermissions();
renderAll();

document.getElementById('logoutButton')?.addEventListener('click', () => {
  localStorage.removeItem('utc_docentes_session');
  window.location.href = 'login.html';
});
