const professors = [
      { id: '100001', name: 'Carlos Hernández' },
      { id: '100002', name: 'María López' },
      { id: '100003', name: 'Jorge Ramírez' },
      { id: '100004', name: 'Ana Torres' }
    ];

    const students = [
      { matricula: '2026001', name: 'Luis Martínez', group: '301-A', career: 'Sistemas' },
      { matricula: '2026002', name: 'Fernanda Ruiz', group: '301-A', career: 'Sistemas' },
      { matricula: '2026003', name: 'Diego Sánchez', group: '202-B', career: 'Administración' }
    ];

    const subjects = [
      { subject: 'Matemáticas', group: '301-A', teacherId: '100001', schedule: 'Lun 08:00-10:00' },
      { subject: 'Programación', group: '301-A', teacherId: '100001', schedule: 'Mar 10:00-12:00' },
      { subject: 'Inglés', group: '202-B', teacherId: '100002', schedule: 'Mié 09:00-11:00' }
    ];

    let incidents = [
      { id: 1, date: '2026-07-02', time: '08:20', teacherId: '100001', teacher: 'Carlos Hernández', subject: 'Matemáticas', group: '301-A', student: '', matricula: '', type: 'Profesor fuera del salón', involved: 'Profesor', category: 'Operativa', status: 'Pendiente', description: 'El grupo se encontraba sin profesor.' },
      { id: 2, date: '2026-07-05', time: '10:15', teacherId: '100001', teacher: 'Carlos Hernández', subject: 'Programación', group: '301-A', student: 'Luis Martínez', matricula: '2026001', type: 'Profesor y/o alumnos en el celular', involved: 'Ambos', category: 'Operativa', status: 'Resuelta', description: 'Se observó uso de celular durante clase.' },
      { id: 3, date: '2026-07-08', time: '12:05', teacherId: '100002', teacher: 'María López', subject: 'Inglés', group: '202-B', student: 'Diego Sánchez', matricula: '2026003', type: 'Alumnos dormidos', involved: 'Alumno', category: 'Operativa', status: 'Pendiente', description: 'Alumno dormido durante la clase.' },
      { id: 4, date: '2026-07-11', time: '09:40', teacherId: '100001', teacher: 'Carlos Hernández', subject: 'Matemáticas', group: '301-A', student: '', matricula: '', type: 'Alumnos y/o profesor comiendo', involved: 'Ambos', category: 'Operativa', status: 'Pendiente', description: 'Se observó consumo de alimentos.' },
      { id: 5, date: '2026-07-14', time: '11:30', teacherId: '100003', teacher: 'Jorge Ramírez', subject: 'Historia', group: '101-C', student: '', matricula: '', type: 'Alumnos fuera de clase', involved: 'Alumno', category: 'Operativa', status: 'Resuelta', description: 'Tres alumnos permanecían fuera del salón.' },
      { id: 6, date: '2026-07-18', time: '13:00', teacherId: '100004', teacher: 'Ana Torres', subject: 'Ética', group: '401-A', student: '', matricula: '', type: 'Guardia de receso', involved: 'Profesor', category: 'Operativa', status: 'Resuelta', description: 'No se encontró al profesor en el área asignada.' },
      { id: 7, date: '2026-07-21', time: '07:50', teacherId: '100002', teacher: 'María López', subject: 'Inglés', group: '202-B', student: 'Fernanda Ruiz', matricula: '2026002', type: 'Alumnos sin playera', involved: 'Alumno', category: 'Operativa', status: 'Pendiente', description: 'La alumna no portaba la playera institucional.' }
    ];

    let followUps = [
      { date: '2026-07-06', teacher: 'Carlos Hernández', result: 'Resuelta', comment: 'Se recordó el reglamento sobre uso de celular.', user: 'Administrador' },
      { date: '2026-07-16', teacher: 'Jorge Ramírez', result: 'Resuelta', comment: 'Se habló con el grupo y se registró acuerdo.', user: 'Administrador' }
    ];

    const users = [
      { id: 1, name: 'Administrador', initials: 'AR', role: 'admin' },
      { id: 2, name: 'Operativo 1', initials: 'O1', role: 'operativo' },
      { id: 3, name: 'Operativo 2', initials: 'O2', role: 'operativo' },
      { id: 4, name: 'Operativo 3', initials: 'O3', role: 'operativo' }
    ];
    const storedSession = JSON.parse(localStorage.getItem('utc_docentes_session') || 'null');
    if (!storedSession) window.location.replace('login.html');
    let currentUser = users.find(user => user.role === storedSession?.role) || users[0];
    if (storedSession?.name) currentUser = { ...currentUser, name: storedSession.name, initials: storedSession.initials || currentUser.initials };

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

    document.getElementById('currentDate').textContent = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(new Date());
    document.getElementById('fecha').valueAsDate = new Date();
    document.getElementById('hora').value = new Date().toTimeString().slice(0,5);

    const pageNames = {
      dashboard: 'Dashboard', registro: 'Registrar incidencia', incidencias: 'Registro de incidencias', seguimiento: 'Seguimiento', graficas: 'Gráficas', profesores: 'Profesores', alumnos: 'Alumnos', materias: 'Materias y grupos', reportes: 'Reportes', usuarios: 'Usuarios'
    };

    document.querySelectorAll('.nav-button').forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));

    function showSection(id) {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-button').forEach(b => b.classList.toggle('active', b.dataset.section === id));
      document.getElementById(id).classList.add('active');
      document.getElementById('pageTitle').textContent = pageNames[id];
      if (id === 'graficas') setTimeout(renderCharts, 50);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function getTeacherCounts() {
      return incidents.reduce((acc, item) => {
        acc[item.teacher] = (acc[item.teacher] || 0) + 1;
        return acc;
      }, {});
    }

    function renderAll() {
      const counts = getTeacherCounts();
      const pending = incidents.filter(i => i.status === 'Pendiente');
      const resolved = incidents.filter(i => i.status === 'Resuelta');
      const alertTeachers = Object.entries(counts).filter(([,count]) => count >= 3);

      document.getElementById('heroMonthTotal').textContent = incidents.length;
      document.getElementById('metricMonth').textContent = incidents.length;
      document.getElementById('metricAlerts').textContent = alertTeachers.length;
      document.getElementById('metricPending').textContent = pending.length;
      document.getElementById('metricResolved').textContent = resolved.length;
      document.getElementById('sumPending').textContent = pending.length;
      document.getElementById('sumResolved').textContent = resolved.length;
      document.getElementById('sumAdministrative').textContent = incidents.filter(i => i.category === 'Administrativa').length;
      document.getElementById('sumTotal').textContent = incidents.length;

      const dashboardRows = [...incidents].reverse().slice(0,5).map(i => `
        <tr><td>${formatDate(i.date)}</td><td class="${counts[i.teacher] >= 3 ? 'teacher-alert':''}">${i.teacher}</td><td>${i.group}</td><td>${i.type}</td><td>${statusBadge(i.status)}</td></tr>`).join('');
      document.getElementById('dashboardTable').innerHTML = dashboardRows;

      document.getElementById('alertsContainer').innerHTML = alertTeachers.length ? alertTeachers.map(([teacher,count]) => `
        <div class="alert-box"><div>⚠</div><div><strong>${teacher}</strong>Ha acumulado ${count} incidencias durante el mes actual.</div></div>`).join('') : '<p class="help">No hay profesores en nivel de alerta.</p>';

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
      const teacher = document.getElementById('filterTeacher').value.toLowerCase();
      const group = document.getElementById('filterGroup').value.toLowerCase();
      const category = document.getElementById('filterCategory').value;
      const type = document.getElementById('filterType').value;
      const status = document.getElementById('filterStatus').value;
      const month = document.getElementById('filterDate').value;
      const counts = getTeacherCounts();
      const data = incidents.filter(i =>
        i.teacher.toLowerCase().includes(teacher) && i.group.toLowerCase().includes(group) && (!category || (i.category || 'Operativa') === category) && (!type || i.type === type) && (!status || i.status === status) && (!month || i.date.startsWith(month))
      );
      document.getElementById('incidentsTable').innerHTML = data.map(i => `
        <tr>
          <td>${formatDate(i.date)}</td><td>${i.time}</td>
          <td class="${counts[i.teacher] >= 3 ? 'teacher-alert':''}">${i.teacher}${counts[i.teacher] >= 3 ? ' ⚠':''}</td>
          <td>${i.subject}</td><td>${i.group}</td><td>${i.student ? `${i.student}<br><small>${i.matricula}</small>` : 'No aplica'}</td>
          <td><span class="badge info">${i.category || 'Operativa'}</span></td><td>${i.type}</td><td>${statusBadge(i.status)}</td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" onclick="openFollow(${i.id})">Seguimiento</button>${currentUser.role === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteIncident(${i.id})">Borrar</button>` : ''}</div></td>
        </tr>`).join('') || '<tr><td colspan="10">No se encontraron resultados.</td></tr>';
    }

    function renderPending() {
      document.getElementById('pendingTable').innerHTML = incidents.filter(i => i.status === 'Pendiente').map(i => `
        <tr><td>${formatDate(i.date)}</td><td>${i.teacher}</td><td>${i.type}</td><td><button class="btn btn-warning btn-sm" onclick="openFollow(${i.id})">Atender</button></td></tr>`).join('') || '<tr><td colspan="4">No hay seguimientos pendientes.</td></tr>';
    }

    function renderFollowUps() {
      document.getElementById('followTable').innerHTML = [...followUps].reverse().map(f => `<tr><td>${formatDate(f.date)}</td><td>${f.teacher}</td><td>${f.result}</td><td>${f.comment}</td><td>${f.user}</td></tr>`).join('') || '<tr><td colspan="5">No hay seguimientos registrados.</td></tr>';
    }

    function renderProfessors() {
      const counts = getTeacherCounts();
      document.getElementById('teachersTable').innerHTML = professors.map(p => {
        const count = counts[p.name] || 0;
        return `<tr><td>${p.id}</td><td class="${count >= 3 ? 'teacher-alert':''}">${p.name}</td><td>${count}</td><td>${count >= 3 ? '<span class="badge alert">En alerta</span>' : '<span class="badge resolved">Normal</span>'}</td></tr>`;
      }).join('');
    }

    function renderStudents() {
      document.getElementById('studentsTable').innerHTML = students.map(s => `<tr><td>${s.matricula}</td><td>${s.name}</td><td>${s.group}</td><td>${s.career || '-'}</td></tr>`).join('');
    }

    function renderSubjects() {
      document.getElementById('subjectsTable').innerHTML = subjects.map(s => {
        const teacher = professors.find(p => p.id === s.teacherId)?.name || s.teacherId;
        return `<tr><td>${s.subject}</td><td>${s.group}</td><td>${teacher}</td><td>${s.schedule || '-'}</td></tr>`;
      }).join('');
    }

    function populateLists() {
      document.getElementById('profesoresList').innerHTML = professors.map(p => `<option value="${p.name}">${p.id}</option>`).join('');
      const types = [...new Set(incidents.map(i => i.type))];
      const select = document.getElementById('filterType');
      const current = select.value;
      select.innerHTML = '<option value="">Todas las incidencias</option>' + types.map(t => `<option>${t}</option>`).join('');
      select.value = current;
    }

    function renderChartSummaries() {
      const typeCounts = countBy('type');
      const groupCounts = countBy('group');
      const teacherCounts = countBy('teacher');
      document.getElementById('topType').textContent = topKey(typeCounts) || '-';
      document.getElementById('topGroup').textContent = topKey(groupCounts) || '-';
      document.getElementById('topTeacher').textContent = topKey(teacherCounts) || '-';
      document.getElementById('resolvedRate').textContent = incidents.length ? Math.round(incidents.filter(i => i.status === 'Resuelta').length / incidents.length * 100) + '%' : '0%';
    }

    function countBy(field) {
      return incidents.reduce((acc, i) => { acc[i[field]] = (acc[i[field]] || 0) + 1; return acc; }, {});
    }
    function topKey(obj) { return Object.entries(obj).sort((a,b) => b[1]-a[1])[0]?.[0]; }

    function renderCharts() {
      Object.values(chartInstances).forEach(c => c.destroy());
      chartInstances = {};
      chartInstances.type = makeChart('typeChart', 'bar', countBy('type'), 'Incidencias');
      chartInstances.teacher = makeChart('teacherChart', 'bar', countBy('teacher'), 'Incidencias');
      chartInstances.group = makeChart('groupChart', 'bar', countBy('group'), 'Incidencias');
      chartInstances.status = new Chart(document.getElementById('statusChart'), {
        type: 'doughnut',
        data: { labels: ['Pendiente', 'Resuelta'], datasets: [{ data: [incidents.filter(i=>i.status==='Pendiente').length, incidents.filter(i=>i.status==='Resuelta').length], backgroundColor: ['#f2c230','#0d5d98'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position:'bottom' } } }
      });
    }

    function makeChart(id, type, obj, label) {
      return new Chart(document.getElementById(id), {
        type,
        data: { labels: Object.keys(obj), datasets: [{ label, data: Object.values(obj), backgroundColor: '#0d5d98', borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
      });
    }

    document.getElementById('incidentForm').addEventListener('submit', e => {
      e.preventDefault();
      const teacher = document.getElementById('profesor').value.trim();
      const p = professors.find(x => x.name.toLowerCase() === teacher.toLowerCase());
      incidents.push({
        id: Date.now(), date: fecha.value, time: hora.value, teacherId: profesorId.value.trim() || p?.id || '', teacher,
        subject: materia.value.trim(), group: grupo.value.trim(), student: alumno.value.trim(), matricula: matricula.value.trim(), category: categoria.value, type: tipo.value,
        involved: involucrado.value, status: 'Pendiente', description: descripcion.value.trim()
      });
      e.target.reset();
      fecha.valueAsDate = new Date(); hora.value = new Date().toTimeString().slice(0,5);
      renderAll(); showToast('Incidencia guardada correctamente'); showSection('incidencias');
    });

    document.getElementById('categoria').addEventListener('change', e => {
      const select = document.getElementById('tipo');
      const options = incidentTypes[e.target.value] || [];
      select.disabled = !options.length;
      select.innerHTML = options.length ? '<option value="">Selecciona una opción</option>' + options.map(item => `<option>${item}</option>`).join('') : '<option value="">Primero selecciona una categoría</option>';
    });

    document.getElementById('profesor').addEventListener('change', e => {
      const p = professors.find(x => x.name.toLowerCase() === e.target.value.toLowerCase());
      if (p) document.getElementById('profesorId').value = p.id;
    });

    document.getElementById('matricula').addEventListener('change', e => {
      const s = students.find(x => x.matricula === e.target.value.trim());
      if (s) { alumno.value = s.name; grupo.value = s.group; }
    });

    ['filterTeacher','filterGroup','filterCategory','filterType','filterStatus','filterDate'].forEach(id => document.getElementById(id).addEventListener('input', renderIncidents));

    function openFollow(id) {
      document.getElementById('followIncidentId').value = id;
      document.getElementById('followModal').classList.add('show');
    }
    function closeModal() { document.getElementById('followModal').classList.remove('show'); document.getElementById('followForm').reset(); }

    document.getElementById('followForm').addEventListener('submit', e => {
      e.preventDefault();
      const id = Number(document.getElementById('followIncidentId').value);
      const incident = incidents.find(i => i.id === id);
      const result = followResult.value;
      followUps.push({ date: new Date().toISOString().slice(0,10), teacher: incident.teacher, result, comment: followComment.value.trim(), user: 'Administrador' });
      if (result === 'Resuelta' || result === 'Se dio seguimiento') incident.status = 'Resuelta';
      renderAll(); closeModal(); showToast('Seguimiento registrado');
    });

    document.getElementById('teacherForm').addEventListener('submit', e => {
      e.preventDefault(); professors.push({ id: newTeacherId.value.trim(), name: newTeacherName.value.trim() }); localStorage.setItem('utc_professors', JSON.stringify(professors)); e.target.reset(); renderAll(); showToast('Profesor agregado');
    });
    document.getElementById('studentForm').addEventListener('submit', e => {
      e.preventDefault(); students.push({ matricula: newStudentMat.value.trim(), name: newStudentName.value.trim(), group: newStudentGroup.value.trim(), career: newStudentCareer.value.trim() }); localStorage.setItem('utc_students', JSON.stringify(students)); e.target.reset(); renderAll(); showToast('Alumno agregado');
    });
    document.getElementById('subjectForm').addEventListener('submit', e => {
      e.preventDefault(); subjects.push({ subject: subjectName.value.trim(), group: subjectGroup.value.trim(), teacherId: subjectTeacherId.value.trim(), schedule: subjectSchedule.value.trim() }); e.target.reset(); renderAll(); showToast('Asignación guardada');
    });

    document.getElementById('teacherFile').addEventListener('change', e => importDatabaseFile(e, 'teachers'));
    document.getElementById('studentFile').addEventListener('change', e => importDatabaseFile(e, 'students'));

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

      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
        if (!rows.length) throw new Error('El archivo no contiene registros.');

        if (kind === 'teachers') {
          const imported = rows.map((row, index) => ({
            id: firstValue(row, ['ID Banner']),
            name: firstValue(row, ['nombre', 'nombre profesor', 'nombre del profesor', 'profesor', 'docente', 'nombre completo'])
          })).filter(item => item.name);

          if (!imported.length) throw new Error('No se encontraron registros válidos. El Excel debe incluir las columnas ID Banner y Nombre.');
          if (imported.some(item => !item.id)) throw new Error('Uno o más profesores no tienen ID Banner. El valor debe copiarse tal cual desde el Excel.');
          imported.forEach(item => {
            const existing = professors.find(p => p.id.toLowerCase() === item.id.toLowerCase() || p.name.toLowerCase() === item.name.toLowerCase());
            if (existing) Object.assign(existing, item); else professors.push(item);
          });
          localStorage.setItem('utc_professors', JSON.stringify(professors));
          document.getElementById(infoId).textContent = `Archivo: ${file.name}. ${imported.length} profesores importados correctamente.`;
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
          document.getElementById(infoId).textContent = `Archivo: ${file.name}. ${imported.length} alumnos importados correctamente.`;
          showToast(`${imported.length} alumnos importados`);
        }

        renderAll();
      } catch (error) {
        console.error(error);
        document.getElementById(infoId).textContent = `No se pudo importar ${file.name}: ${error.message}`;
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
      selector.innerHTML = users.map(u => `<option value="${u.id}">${u.name} — ${u.role === 'admin' ? 'Administrador' : 'Operativo'}</option>`).join('');
      selector.value = currentUser.id;
      selector.onchange = () => {
        currentUser = users.find(u => u.id === Number(selector.value)) || users[0];
        applyPermissions();
        renderAll();
        showToast(`Sesión de prueba: ${currentUser.name}`);
      };
    }

    function applyPermissions() {
      const isAdmin = currentUser.role === 'admin';
      document.getElementById('currentUserName').textContent = currentUser.name;
      document.getElementById('currentUserRole').textContent = `${isAdmin ? 'Administrador' : 'Operativo'} · Plantel UTC`;
      document.querySelector('.avatar').textContent = currentUser.initials;
      document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
      const reportNav = document.querySelector('[data-section="reportes"]');
      reportNav.classList.toggle('hidden', !isAdmin);
      if (!isAdmin && document.getElementById('reportes').classList.contains('active')) showSection('dashboard');
    }

    function statusBadge(status) { return status === 'Resuelta' ? '<span class="badge resolved">Resuelta</span>' : '<span class="badge pending">Pendiente</span>'; }
    function formatDate(date) { return new Date(date + 'T00:00:00').toLocaleDateString('es-MX'); }
    function showToast(message) { const t = document.getElementById('toast'); t.textContent = message; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2200); }

    function exportCSV() {
      if (currentUser.role !== 'admin') return showToast('Solo el administrador puede descargar reportes');
      const headers = ['Fecha','Hora','ID Profesor','Profesor','Materia','Grupo','Matrícula','Alumno','Categoría','Incidencia','Estatus','Descripción'];
      const rows = incidents.map(i => [i.date,i.time,i.teacherId,i.teacher,i.subject,i.group,i.matricula,i.student,i.category || 'Operativa',i.type,i.status,i.description]);
      const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reporte_incidencias_utc.csv'; a.click(); URL.revokeObjectURL(a.href);
    }
    function fakeExport(name) { if (currentUser.role !== 'admin') return showToast('Solo el administrador puede descargar reportes'); showToast(`${name}: se conectará en la siguiente etapa`); }

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

// Sesión y configuración de Supabase
document.getElementById('logoutButton')?.addEventListener('click', () => {
  localStorage.removeItem('utc_docentes_session');
  window.location.href = 'login.html';
});

if (window.APP_CONFIG?.SUPABASE_URL && window.APP_CONFIG?.SUPABASE_ANON_KEY) {
  console.info('Configuración de Supabase detectada. La conexión real se activará al crear las tablas y políticas.');
}
