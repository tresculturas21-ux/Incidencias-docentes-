(() => {
  'use strict';

  const config = window.APP_CONFIG || {};
  const session = JSON.parse(localStorage.getItem('utc_docentes_session') || 'null');
  if (!session) {
    window.location.replace('login.html');
    return;
  }

  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || config.SUPABASE_URL.includes('PEGA_AQUI')) {
    alert('Falta configurar Supabase en config.js');
    return;
  }

  const db = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  const currentUser = {
    id: session.id || null,
    username: session.username || '',
    name: session.name || 'Usuario',
    role: String(session.role || 'operativo').toLowerCase(),
    initials: session.initials || 'US'
  };

  let professors = [];
  let students = [];
  let subjects = [];
  let incidents = [];
  let followUps = [];
  let chartInstances = {};
  let realtimeChannel = null;

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

  const pageNames = {
    dashboard: 'Dashboard', registro: 'Registrar incidencia', incidencias: 'Registro de incidencias',
    seguimiento: 'Seguimiento', graficas: 'Gráficas', profesores: 'Profesores',
    alumnos: 'Alumnos', materias: 'Materias y grupos', reportes: 'Reportes', usuarios: 'Usuarios'
  };

  const $ = id => document.getElementById(id);
  const val = id => ($(id)?.value || '').trim();
  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function normalizeProfessor(row) {
    return {
      id: String(row.id_banner ?? row.profesor_id ?? row.codigo ?? row.id ?? ''),
      dbId: row.id,
      name: row.nombre ?? row.name ?? row.profesor ?? ''
    };
  }

  function normalizeStudent(row) {
    return {
      dbId: row.id,
      matricula: String(row.matricula ?? ''),
      name: row.nombre ?? row.name ?? '',
      group: row.grupo ?? row.group ?? '',
      career: row.carrera ?? row.career ?? '',
      shift: row.turno ?? row.shift ?? ''
    };
  }

  function normalizeSubject(row) {
    return {
      dbId: row.id,
      subject: row.materia ?? row.nombre ?? row.subject ?? '',
      group: row.grupo ?? row.group ?? '',
      teacherId: String(row.profesor_id_banner ?? row.profesor_id ?? row.teacher_id ?? ''),
      schedule: row.horario ?? row.schedule ?? ''
    };
  }

  function normalizeIncident(row) {
    return {
      id: row.id,
      date: row.fecha ?? '',
      time: String(row.hora ?? '').slice(0, 5),
      classroom: row.aula ?? '',
      teacherId: String(row.profesor_id_banner ?? row.profesor_id ?? ''),
      teacher: row.profesor_nombre ?? row.profesor ?? '',
      subject: row.materia ?? '',
      group: row.grupo ?? '',
      student: row.alumno_nombre ?? row.alumno ?? '',
      matricula: String(row.matricula ?? ''),
      type: row.tipo_incidencia ?? row.tipo ?? '',
      involved: row.involucrado ?? '',
      category: row.categoria ?? 'Operativa',
      status: row.estatus ?? row.status ?? 'Pendiente',
      description: row.descripcion ?? '',
      registeredBy: row.usuario_registro ?? row.registrado_por ?? '',
      createdAt: row.created_at ?? ''
    };
  }

  function normalizeFollowUp(row) {
    const incident = incidents.find(i => String(i.id) === String(row.incidencia_id));
    return {
      id: row.id,
      incidentId: row.incidencia_id,
      date: row.fecha ?? String(row.created_at || '').slice(0, 10),
      teacher: row.profesor_nombre ?? incident?.teacher ?? '',
      result: row.resultado ?? row.estatus ?? '',
      action: row.accion ?? '',
      comment: row.comentario ?? '',
      nextReview: row.proxima_revision ?? '',
      user: row.usuario_nombre ?? row.usuario ?? ''
    };
  }

  async function fetchTable(table, orderColumn = 'id') {
    const { data, error } = await db.from(table).select('*').order(orderColumn, { ascending: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    return data || [];
  }

  async function loadAll(showMessage = false) {
    setLoading(true);
    try {
      const [profData, studentData, subjectData, incidentData] = await Promise.all([
        fetchTable('profesores'), fetchTable('alumnos'), fetchTable('materias'),
        db.from('incidencias').select('*').order('created_at', { ascending: true })
      ]);

      if (incidentData.error) throw new Error(`incidencias: ${incidentData.error.message}`);
      professors = profData.map(normalizeProfessor);
      students = studentData.map(normalizeStudent);
      subjects = subjectData.map(normalizeSubject);
      incidents = (incidentData.data || []).map(normalizeIncident);

      const followResult = await db.from('seguimientos').select('*').order('created_at', { ascending: true });
      if (followResult.error) throw new Error(`seguimientos: ${followResult.error.message}`);
      followUps = (followResult.data || []).map(normalizeFollowUp);

      renderAll();
      if (showMessage) showToast('Información actualizada');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'No se pudo cargar la información');
    } finally {
      setLoading(false);
    }
  }

  function setLoading(loading) {
    document.body.classList.toggle('loading', loading);
  }

  function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-button').forEach(b => b.classList.toggle('active', b.dataset.section === id));
    $(id)?.classList.add('active');
    if ($('pageTitle')) $('pageTitle').textContent = pageNames[id] || id;
    if (id === 'graficas') setTimeout(renderCharts, 50);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  window.showSection = showSection;

  function currentMonthIncidents() {
    const month = new Date().toISOString().slice(0, 7);
    return incidents.filter(i => String(i.date).startsWith(month));
  }

  function getTeacherCounts() {
    return currentMonthIncidents().reduce((acc, item) => {
      const key = item.teacher || 'Sin profesor';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function renderAll() {
    const monthData = currentMonthIncidents();
    const counts = getTeacherCounts();
    const pending = incidents.filter(i => i.status !== 'Resuelta');
    const resolved = incidents.filter(i => i.status === 'Resuelta');
    const alertTeachers = Object.entries(counts).filter(([, count]) => count >= 3);

    $('heroMonthTotal').textContent = monthData.length;
    $('metricMonth').textContent = monthData.length;
    $('metricAlerts').textContent = alertTeachers.length;
    $('metricPending').textContent = pending.length;
    $('metricResolved').textContent = resolved.length;
    $('sumPending').textContent = pending.length;
    $('sumResolved').textContent = resolved.length;
    $('sumAdministrative').textContent = incidents.filter(i => i.category === 'Administrativa').length;
    $('sumTotal').textContent = incidents.length;

    $('dashboardTable').innerHTML = [...incidents].reverse().slice(0, 5).map(i => `
      <tr><td>${formatDate(i.date)}</td><td class="${counts[i.teacher] >= 3 ? 'teacher-alert' : ''}">${escapeHtml(i.teacher)}</td>
      <td>${escapeHtml(i.group)}</td><td>${escapeHtml(i.type)}</td><td>${statusBadge(i.status)}</td></tr>`
    ).join('') || '<tr><td colspan="5">No hay incidencias registradas.</td></tr>';

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
    const teacher = val('filterTeacher').toLowerCase();
    const group = val('filterGroup').toLowerCase();
    const category = val('filterCategory');
    const type = val('filterType');
    const status = val('filterStatus');
    const month = val('filterDate');
    const counts = getTeacherCounts();

    const data = incidents.filter(i =>
      i.teacher.toLowerCase().includes(teacher) && i.group.toLowerCase().includes(group) &&
      (!category || i.category === category) && (!type || i.type === type) &&
      (!status || i.status === status) && (!month || i.date.startsWith(month))
    );

    $('incidentsTable').innerHTML = [...data].reverse().map(i => `
      <tr>
        <td>${formatDate(i.date)}</td><td>${escapeHtml(i.time)}</td>
        <td class="${counts[i.teacher] >= 3 ? 'teacher-alert' : ''}">${escapeHtml(i.teacher)}${counts[i.teacher] >= 3 ? ' ⚠' : ''}</td>
        <td>${escapeHtml(i.subject)}</td><td>${escapeHtml(i.group)}</td>
        <td>${i.student ? `${escapeHtml(i.student)}<br><small>${escapeHtml(i.matricula)}</small>` : 'No aplica'}</td>
        <td><span class="badge info">${escapeHtml(i.category)}</span></td><td title="${escapeHtml(i.description)}">${escapeHtml(i.type)}</td>
        <td>${statusBadge(i.status)}</td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="openFollow('${i.id}')">Seguimiento</button>
          ${currentUser.role === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteIncident('${i.id}')">Borrar</button>` : ''}
        </div></td>
      </tr>`).join('') || '<tr><td colspan="10">No se encontraron resultados.</td></tr>';
  }

  function renderPending() {
    $('pendingTable').innerHTML = incidents.filter(i => i.status !== 'Resuelta').reverse().map(i => `
      <tr><td>${formatDate(i.date)}</td><td>${escapeHtml(i.teacher)}</td><td>${escapeHtml(i.type)}</td>
      <td><button class="btn btn-warning btn-sm" onclick="openFollow('${i.id}')">Atender</button></td></tr>`
    ).join('') || '<tr><td colspan="4">No hay seguimientos pendientes.</td></tr>';
  }

  function renderFollowUps() {
    $('followTable').innerHTML = [...followUps].reverse().map(f => `
      <tr><td>${formatDate(f.date)}</td><td>${escapeHtml(f.teacher)}</td><td>${escapeHtml(f.result)}</td>
      <td>${escapeHtml(f.comment)}</td><td>${escapeHtml(f.user)}</td></tr>`
    ).join('') || '<tr><td colspan="5">No hay seguimientos registrados.</td></tr>';
  }

  function renderProfessors() {
    const counts = getTeacherCounts();
    $('teachersTable').innerHTML = professors.map(p => {
      const count = counts[p.name] || 0;
      return `<tr><td>${escapeHtml(p.id)}</td><td class="${count >= 3 ? 'teacher-alert' : ''}">${escapeHtml(p.name)}</td>
      <td>${count}</td><td>${count >= 3 ? '<span class="badge alert">En alerta</span>' : '<span class="badge resolved">Normal</span>'}</td></tr>`;
    }).join('') || '<tr><td colspan="4">No hay profesores registrados.</td></tr>';
  }

  function renderStudents() {
    $('studentsTable').innerHTML = students.map(s => `<tr><td>${escapeHtml(s.matricula)}</td><td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.group)}</td><td>${escapeHtml(s.career || '-')}</td></tr>`).join('') || '<tr><td colspan="4">No hay alumnos registrados.</td></tr>';
  }

  function renderSubjects() {
    $('subjectsTable').innerHTML = subjects.map(s => {
      const teacher = professors.find(p => p.id === s.teacherId)?.name || s.teacherId;
      return `<tr><td>${escapeHtml(s.subject)}</td><td>${escapeHtml(s.group)}</td><td>${escapeHtml(teacher)}</td><td>${escapeHtml(s.schedule || '-')}</td></tr>`;
    }).join('') || '<tr><td colspan="4">No hay materias registradas.</td></tr>';
  }

  function populateLists() {
    $('profesoresList').innerHTML = professors.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.id)}</option>`).join('');
    const types = [...new Set(incidents.map(i => i.type).filter(Boolean))];
    const select = $('filterType');
    const current = select.value;
    select.innerHTML = '<option value="">Todas las incidencias</option>' + types.map(t => `<option>${escapeHtml(t)}</option>`).join('');
    select.value = current;
  }

  function countBy(field) {
    return incidents.reduce((acc, i) => {
      const key = i[field] || 'Sin dato';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function topKey(obj) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  function renderChartSummaries() {
    $('topType').textContent = topKey(countBy('type')) || '-';
    $('topGroup').textContent = topKey(countBy('group')) || '-';
    $('topTeacher').textContent = topKey(countBy('teacher')) || '-';
    $('resolvedRate').textContent = incidents.length
      ? Math.round(incidents.filter(i => i.status === 'Resuelta').length / incidents.length * 100) + '%'
      : '0%';
  }

  function renderCharts() {
    if (!window.Chart) return;
    Object.values(chartInstances).forEach(c => c?.destroy());
    chartInstances = {};
    chartInstances.type = makeChart('typeChart', 'bar', countBy('type'), 'Incidencias');
    chartInstances.teacher = makeChart('teacherChart', 'bar', countBy('teacher'), 'Incidencias');
    chartInstances.group = makeChart('groupChart', 'bar', countBy('group'), 'Incidencias');
    chartInstances.status = new Chart($('statusChart'), {
      type: 'doughnut',
      data: { labels: ['Pendiente', 'Resuelta'], datasets: [{ data: [incidents.filter(i => i.status !== 'Resuelta').length, incidents.filter(i => i.status === 'Resuelta').length] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  function makeChart(id, type, obj, label) {
    return new Chart($(id), {
      type,
      data: { labels: Object.keys(obj), datasets: [{ label, data: Object.values(obj), borderRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
    });
  }

  async function saveIncident(event) {
    event.preventDefault();
    const teacher = val('profesor');
    const professor = professors.find(p => p.name.toLowerCase() === teacher.toLowerCase());
    const payload = {
      fecha: val('fecha'), hora: val('hora'), aula: val('aula') || null,
      profesor_id_banner: val('profesorId') || professor?.id || null,
      profesor_nombre: teacher, materia: val('materia'), grupo: val('grupo'),
      categoria: val('categoria'), tipo_incidencia: val('tipo'), involucrado: val('involucrado'),
      matricula: val('matricula') || null, alumno_nombre: val('alumno') || null,
      descripcion: val('descripcion'), estatus: 'Pendiente',
      usuario_registro: currentUser.name, usuario_id: currentUser.id
    };

    try {
      const { error } = await db.from('incidencias').insert(payload);
      if (error) throw error;
      event.target.reset();
      $('fecha').valueAsDate = new Date();
      $('hora').value = new Date().toTimeString().slice(0, 5);
      showToast('Incidencia guardada en Supabase');
      showSection('incidencias');
      await loadAll();
    } catch (error) {
      console.error(error);
      showToast(`No se pudo guardar: ${error.message}`);
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
    const id = $('followIncidentId').value;
    const incident = incidents.find(i => String(i.id) === String(id));
    if (!incident) return showToast('No se encontró la incidencia');

    const result = val('followResult');
    const status = result === 'Resuelta' || result === 'Se dio seguimiento' ? 'Resuelta' : 'Pendiente';
    try {
      const { error: followError } = await db.from('seguimientos').insert({
        incidencia_id: incident.id,
        fecha: new Date().toISOString().slice(0, 10),
        profesor_nombre: incident.teacher,
        resultado: result,
        accion: val('followAction') || null,
        comentario: val('followComment'),
        proxima_revision: val('followNext') || null,
        usuario_id: currentUser.id,
        usuario_nombre: currentUser.name
      });
      if (followError) throw followError;

      const { error: incidentError } = await db.from('incidencias').update({ estatus: status }).eq('id', incident.id);
      if (incidentError) throw incidentError;

      closeModal();
      showToast('Seguimiento guardado');
      await loadAll();
    } catch (error) {
      console.error(error);
      showToast(`No se pudo guardar: ${error.message}`);
    }
  }

  async function addProfessor(event) {
    event.preventDefault();
    try {
      const { error } = await db.from('profesores').insert({ id_banner: val('newTeacherId'), nombre: val('newTeacherName') });
      if (error) throw error;
      event.target.reset();
      showToast('Profesor agregado');
      await loadAll();
    } catch (error) { showToast(`No se pudo agregar: ${error.message}`); }
  }

  async function addStudent(event) {
    event.preventDefault();
    try {
      const { error } = await db.from('alumnos').insert({
        matricula: val('newStudentMat'), nombre: val('newStudentName'), grupo: val('newStudentGroup'), carrera: val('newStudentCareer') || null
      });
      if (error) throw error;
      event.target.reset();
      showToast('Alumno agregado');
      await loadAll();
    } catch (error) { showToast(`No se pudo agregar: ${error.message}`); }
  }

  async function addSubject(event) {
    event.preventDefault();
    try {
      const { error } = await db.from('materias').insert({
        materia: val('subjectName'), grupo: val('subjectGroup'), profesor_id_banner: val('subjectTeacherId'), horario: val('subjectSchedule') || null
      });
      if (error) throw error;
      event.target.reset();
      showToast('Asignación guardada');
      await loadAll();
    } catch (error) { showToast(`No se pudo guardar: ${error.message}`); }
  }

  async function deleteIncident(id) {
    if (currentUser.role !== 'admin') return showToast('Solo el administrador puede borrar incidencias');
    const incident = incidents.find(i => String(i.id) === String(id));
    if (!incident || !confirm(`¿Deseas borrar la incidencia de ${incident.teacher}?`)) return;
    try {
      const { error } = await db.from('incidencias').delete().eq('id', id);
      if (error) throw error;
      showToast('Incidencia borrada');
      await loadAll();
    } catch (error) { showToast(`No se pudo borrar: ${error.message}`); }
  }
  window.deleteIncident = deleteIncident;

  function normalizeHeader(value) {
    return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
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
      return showToast('Solo el administrador puede importar bases');
    }
    const file = event.target.files[0];
    if (!file) return;
    const infoId = kind === 'teachers' ? 'teacherUploadInfo' : 'studentUploadInfo';
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false });
      if (!rows.length) throw new Error('El archivo está vacío.');

      if (kind === 'teachers') {
        const records = rows.map(row => ({
          id_banner: firstValue(row, ['ID Banner', 'id', 'codigo']),
          nombre: firstValue(row, ['nombre', 'nombre profesor', 'profesor', 'docente', 'nombre completo'])
        })).filter(x => x.id_banner && x.nombre);
        if (!records.length) throw new Error('Se necesitan las columnas ID Banner y Nombre.');
        const { error } = await db.from('profesores').upsert(records, { onConflict: 'id_banner' });
        if (error) throw error;
        $(infoId).textContent = `${records.length} profesores importados desde ${file.name}.`;
      } else {
        const records = rows.map(row => ({
          matricula: firstValue(row, ['matricula', 'matrícula', 'id alumno', 'numero cuenta']),
          nombre: firstValue(row, ['nombre', 'nombre alumno', 'alumno', 'nombre completo']),
          grupo: firstValue(row, ['grupo', 'grado y grupo']),
          carrera: firstValue(row, ['carrera', 'programa', 'licenciatura']) || null,
          turno: firstValue(row, ['turno']) || null
        })).filter(x => x.matricula && x.nombre);
        if (!records.length) throw new Error('Se necesitan las columnas Matrícula y Nombre.');
        const { error } = await db.from('alumnos').upsert(records, { onConflict: 'matricula' });
        if (error) throw error;
        $(infoId).textContent = `${records.length} alumnos importados desde ${file.name}.`;
      }
      showToast('Importación terminada');
      await loadAll();
    } catch (error) {
      console.error(error);
      $(infoId).textContent = `No se pudo importar: ${error.message}`;
      showToast('No se pudo importar el archivo');
    } finally {
      event.target.value = '';
    }
  }

  function applyPermissions() {
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'administrador';
    $('currentUserName').textContent = currentUser.name;
    $('currentUserRole').textContent = `${isAdmin ? 'Administrador' : 'Operativo'} · Plantel UTC`;
    $('currentUserAvatar').textContent = currentUser.initials;
    if ($('sessionInfo')) $('sessionInfo').value = `${currentUser.name} — ${isAdmin ? 'Administrador' : 'Operativo'}`;
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
    document.querySelector('[data-section="reportes"]')?.classList.toggle('hidden', !isAdmin);
  }

  function statusBadge(status) {
    return status === 'Resuelta' ? '<span class="badge resolved">Resuelta</span>' : '<span class="badge pending">Pendiente</span>';
  }

  function formatDate(date) {
    if (!date) return '-';
    return new Date(`${date}T00:00:00`).toLocaleDateString('es-MX');
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function exportCSV() {
    if (currentUser.role !== 'admin' && currentUser.role !== 'administrador') return showToast('Solo el administrador puede descargar reportes');
    const headers = ['Fecha', 'Hora', 'ID Profesor', 'Profesor', 'Materia', 'Grupo', 'Matrícula', 'Alumno', 'Categoría', 'Incidencia', 'Estatus', 'Descripción', 'Registró'];
    const rows = incidents.map(i => [i.date, i.time, i.teacherId, i.teacher, i.subject, i.group, i.matricula, i.student, i.category, i.type, i.status, i.description, i.registeredBy]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'reporte_incidencias_utc.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  window.exportCSV = exportCSV;
  window.fakeExport = name => showToast(`${name}: usa el reporte CSV general por el momento`);

  function subscribeRealtime() {
    realtimeChannel = db.channel('utc-incidencias-tiempo-real')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencias' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seguimientos' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profesores' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alumnos' }, () => loadAll())
      .subscribe();
  }

  function bindEvents() {
    document.querySelectorAll('.nav-button').forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));
    $('incidentForm').addEventListener('submit', saveIncident);
    $('followForm').addEventListener('submit', saveFollowUp);
    $('teacherForm').addEventListener('submit', addProfessor);
    $('studentForm').addEventListener('submit', addStudent);
    $('subjectForm').addEventListener('submit', addSubject);
    $('teacherFile').addEventListener('change', e => importDatabaseFile(e, 'teachers'));
    $('studentFile').addEventListener('change', e => importDatabaseFile(e, 'students'));

    $('categoria').addEventListener('change', e => {
      const options = incidentTypes[e.target.value] || [];
      $('tipo').disabled = !options.length;
      $('tipo').innerHTML = options.length
        ? '<option value="">Selecciona una opción</option>' + options.map(item => `<option>${escapeHtml(item)}</option>`).join('')
        : '<option value="">Primero selecciona una categoría</option>';
    });

    $('profesor').addEventListener('change', e => {
      const p = professors.find(x => x.name.toLowerCase() === e.target.value.toLowerCase());
      if (p) $('profesorId').value = p.id;
    });

    $('matricula').addEventListener('change', e => {
      const s = students.find(x => x.matricula === e.target.value.trim());
      if (s) { $('alumno').value = s.name; $('grupo').value = s.group; }
    });

    ['filterTeacher', 'filterGroup', 'filterCategory', 'filterType', 'filterStatus', 'filterDate']
      .forEach(id => $(id).addEventListener('input', renderIncidents));

    $('logoutButton').addEventListener('click', () => {
      if (realtimeChannel) db.removeChannel(realtimeChannel);
      localStorage.removeItem('utc_docentes_session');
      window.location.href = 'login.html';
    });
  }

  async function init() {
    $('currentDate').textContent = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(new Date());
    $('fecha').valueAsDate = new Date();
    $('hora').value = new Date().toTimeString().slice(0, 5);
    applyPermissions();
    bindEvents();
    await loadAll();
    subscribeRealtime();
  }

  init();
})();
