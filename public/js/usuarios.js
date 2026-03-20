document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';

    // DOM
    const tbodyUsuarios   = document.getElementById('tbodyUsuarios');
    const btnNuevoUsuario = document.getElementById('btnNuevoUsuario');
    const searchInput     = document.getElementById('searchUsuario');

    // Modal crear/editar
    const modalUsuario    = document.getElementById('modalUsuario');
    const formUsuario     = document.getElementById('formUsuario');
    const modalTitle      = document.getElementById('modalTitle');
    const editMode        = document.getElementById('editMode');
    const editPlacaOrig   = document.getElementById('editPlacaOriginal');
    const mensajeModal    = document.getElementById('mensajeModal');

    // Campos del modal
    const uPlaca     = document.getElementById('uPlaca');
    const uTipo      = document.getElementById('uTipo');
    const uColor     = document.getElementById('uColor');
    const uCelda     = document.getElementById('uCelda');
    const uNombre    = document.getElementById('uNombre');
    const uTelefono  = document.getElementById('uTelefono');
    const uPagarMens = document.getElementById('uPagarMensualidad');

    // Modal historial
    const modalHistorial   = document.getElementById('modalHistorial');
    const historialTitle   = document.getElementById('historialTitle');
    const resumenHistorial = document.getElementById('resumenHistorial');
    const tbodyHistorial   = document.getElementById('tbodyHistorial');

    let todosLosUsuarios = [];

    // ─────────────────────────────────────────
    // Utilidades
    // ─────────────────────────────────────────
    const formatFecha = iso => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
               ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    };

    const duracion = (entrada, salida) => {
        if (!entrada || !salida) return 'En curso';
        const ms = new Date(salida) - new Date(entrada);
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const showModalMsg = (type, text) => {
        mensajeModal.textContent = text;
        mensajeModal.className = `mensaje mensaje-${type === 'success' ? 'exito' : 'error'}`;
        mensajeModal.style.display = 'block';
    };

    // ─────────────────────────────────────────
    // Cargar Usuarios
    // ─────────────────────────────────────────
    const loadUsuarios = async () => {
        try {
            const res  = await fetch(`${API_URL}/usuarios`);
            const data = await res.json();
            if (!data.success) return;
            todosLosUsuarios = data.usuarios;
            renderTabla(todosLosUsuarios);
        } catch (err) {
            tbodyUsuarios.innerHTML = `<tr><td colspan="8" class="text-center" style="color:red;">Error al cargar usuarios.</td></tr>`;
        }
    };

    const renderTabla = (lista) => {
        if (lista.length === 0) {
            tbodyUsuarios.innerHTML = `<tr><td colspan="8" class="text-center loading-row">No hay usuarios registrados. Crea el primero con "+ Registrar Usuario".</td></tr>`;
            return;
        }

        tbodyUsuarios.innerHTML = lista.map(u => {
            const vencida = !u.mensualidadActiva;
            const estadoMens = vencida
                ? `<span class="estado-mens mens-vencida">Vencida</span>`
                : `<span class="estado-mens mens-activa">Activa (${u.diasDisponibles}d)</span>`;

            const celdaTexto = u.celda_numero
                ? `<strong>${u.celda_numero}</strong>`
                : '<span style="color:#aaa">Sin asignar</span>';

            return `
            <tr>
                <td>${celdaTexto}</td>
                <td><strong>${u.placa}</strong></td>
                <td>${u.nombre_propietario || '<span style="color:#aaa">—</span>'}</td>
                <td>${u.telefono || '<span style="color:#aaa">—</span>'}</td>
                <td>
                    <span class="tag-tipo">${u.tipo}</span>
                    <br><small style="color:#888">${u.color || ''}</small>
                </td>
                <td>
                    ${estadoMens}
                    <br><small style="color:#888">${u.fecha_vencimiento ? 'Vence: ' + formatFecha(u.fecha_vencimiento) : 'Sin pago'}</small>
                </td>
                <td>
                    <span class="estado-mens ${u.celda_estado === 'Ocupada' ? 'mens-vencida' : 'mens-activa'}">
                        ${u.celda_estado === 'Ocupada' ? 'Dentro' : 'Fuera'}
                    </span>
                </td>
                <td>
                    <div class="acciones">
                        <button class="btn btn-primary btn-sm" onclick="abrirHistorial('${u.placa}')">Historial</button>
                        <button class="btn btn-warning btn-sm" onclick="editarUsuario('${u.placa}')">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="eliminarUsuario('${u.placa}')">Eliminar</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    };

    // ─────────────────────────────────────────
    // Búsqueda
    // ─────────────────────────────────────────
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            const filtrados = todosLosUsuarios.filter(u =>
                u.placa.toLowerCase().includes(q) ||
                (u.nombre_propietario || '').toLowerCase().includes(q) ||
                (u.celda_numero || '').toLowerCase().includes(q)
            );
            renderTabla(filtrados);
        });
    }

    // ─────────────────────────────────────────
    // Modal: Abrir / Cerrar
    // ─────────────────────────────────────────
    const abrirModal = () => { modalUsuario.style.display = 'flex'; };
    const cerrarModal = () => {
        modalUsuario.style.display = 'none';
        formUsuario.reset();
        mensajeModal.style.display = 'none';
        uCelda.innerHTML = '<option value="">Seleccione tipo primero...</option>';
        uPlaca.disabled = false;
        uTipo.disabled  = false;
        uCelda.disabled = false;
    };

    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    document.getElementById('btnCancelarModal').addEventListener('click', cerrarModal);
    modalUsuario.addEventListener('click', e => { if (e.target === modalUsuario) cerrarModal(); });

    if (btnNuevoUsuario) {
        btnNuevoUsuario.addEventListener('click', () => {
            editMode.value = 'crear';
            modalTitle.textContent = 'Registrar Nuevo Usuario';
            document.getElementById('btnGuardarUsuario').textContent = 'Guardar Usuario';
            abrirModal();
        });
    }

    // ─────────────────────────────────────────
    // Cargar Celdas disponibles por tipo
    // ─────────────────────────────────────────
    const cargarCeldasDisponibles = async (tipo, celdaActual = null) => {
        uCelda.innerHTML = '<option value="">Cargando...</option>';
        try {
            const res  = await fetch(`${API_URL}/celdas-disponibles?tipo=${tipo}`);
            const data = await res.json();
            uCelda.innerHTML = '<option value="">Seleccionar celda...</option>';

            if (celdaActual) {
                // En modo edición la celda actual siempre aparece seleccionada
                const opt = document.createElement('option');
                opt.value = celdaActual;
                opt.textContent = `📍 ${celdaActual} (actual)`;
                uCelda.appendChild(opt);
            }

            data.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id_celda;
                opt.textContent = `${c.numero} (${c.tipo})`;
                uCelda.appendChild(opt);
            });
        } catch (err) {
            uCelda.innerHTML = '<option value="">Error al cargar celdas</option>';
        }
    };

    uTipo.addEventListener('change', () => {
        if (uTipo.value) cargarCeldasDisponibles(uTipo.value);
        else uCelda.innerHTML = '<option value="">Seleccione tipo primero...</option>';
    });

    // ─────────────────────────────────────────
    // Editar Usuario (global)
    // ─────────────────────────────────────────
    window.editarUsuario = (placa) => {
        const u = todosLosUsuarios.find(x => x.placa === placa);
        if (!u) return;

        editMode.value = 'editar';
        editPlacaOrig.value = u.placa;
        modalTitle.textContent = `Editar Usuario — ${u.placa}`;
        document.getElementById('btnGuardarUsuario').textContent = 'Guardar Cambios';

        uPlaca.value    = u.placa;
        uPlaca.disabled = true;
        uColor.value    = u.color || '';
        uNombre.value   = u.nombre_propietario || '';
        uTelefono.value = u.telefono || '';
        uTipo.value     = u.tipo;
        uTipo.disabled  = true;
        uPagarMens.checked = false;

        // Para editar no se cambia celda (simplificación)
        uCelda.innerHTML = `<option value="${u.id_celda}">${u.celda_numero || 'Sin celda'} (actual)</option>`;
        uCelda.disabled = true;

        abrirModal();
    };

    // ─────────────────────────────────────────
    // Guardar Formulario
    // ─────────────────────────────────────────
    formUsuario.addEventListener('submit', async e => {
        e.preventDefault();
        const modo   = editMode.value;
        const placa  = modo === 'editar' ? editPlacaOrig.value : uPlaca.value.trim().toUpperCase();

        const body = {
            placa,
            tipo:               uTipo.value,
            color:              uColor.value.trim(),
            nombre_propietario: uNombre.value.trim(),
            telefono:           uTelefono.value.trim(),
            pagarMensualidad:   uPagarMens.checked
        };

        let url    = `${API_URL}/usuarios`;
        let method = 'POST';

        if (modo === 'editar') {
            url    = `${API_URL}/usuarios/${placa}`;
            method = 'PUT';
        } else {
            if (!uCelda.value) {
                showModalMsg('error', 'Seleccione una celda disponible.');
                return;
            }
            body.id_celda = parseInt(uCelda.value);
        }

        try {
            const res    = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await res.json();

            if (result.success) {
                showModalMsg('success', result.message);
                setTimeout(() => { cerrarModal(); loadUsuarios(); }, 1200);
            } else {
                showModalMsg('error', result.message || 'Error al guardar.');
            }
        } catch (err) {
            showModalMsg('error', 'Error de conexión.');
        }
    });

    // ─────────────────────────────────────────
    // Eliminar Usuario (global)
    // ─────────────────────────────────────────
    window.eliminarUsuario = async (placa) => {
        if (!confirm(`¿Seguro que deseas eliminar al usuario con placa ${placa}?\nEsta acción no se puede deshacer.`)) return;
        try {
            const res    = await fetch(`${API_URL}/usuarios/${placa}`, { method: 'DELETE' });
            const result = await res.json();
            alert(result.message);
            if (result.success) loadUsuarios();
        } catch (err) {
            alert('Error de conexión.');
        }
    };

    // ─────────────────────────────────────────
    // Historial (global)
    // ─────────────────────────────────────────
    window.abrirHistorial = async (placa) => {
        historialTitle.textContent = `📋 Historial — ${placa}`;
        resumenHistorial.innerHTML = 'Cargando...';
        tbodyHistorial.innerHTML   = '<tr><td colspan="5" class="text-center">Cargando...</td></tr>';
        modalHistorial.style.display = 'flex';

        try {
            const res  = await fetch(`${API_URL}/historial`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ placa })
            });
            const data = await res.json();

            if (!data.success) {
                resumenHistorial.innerHTML = `<p style="color:red">${data.message}</p>`;
                return;
            }

            const v = data.vehiculo;
            const venc = v.fecha_vencimiento ? new Date(v.fecha_vencimiento) : null;
            const activa = venc && venc >= new Date();

            resumenHistorial.innerHTML = `
                <div class="resumen-item">
                    <span class="label">Placa</span>
                    <span class="value">${v.placa}</span>
                </div>
                <div class="resumen-item">
                    <span class="label">Propietario</span>
                    <span class="value">${v.nombre_propietario || '—'}</span>
                </div>
                <div class="resumen-item">
                    <span class="label">Celda</span>
                    <span class="value">${v.celda_numero || '—'}</span>
                </div>
                <div class="resumen-item">
                    <span class="label">Tipo / Color</span>
                    <span class="value">${v.tipo} / ${v.color || '—'}</span>
                </div>
                <div class="resumen-item">
                    <span class="label">Mensualidad</span>
                    <span class="value" style="color: ${activa ? 'green' : 'red'}">
                        ${activa ? `Activa (${data.diasDisponibles} dias restantes)` : 'Vencida'}
                    </span>
                </div>
                <div class="resumen-item">
                    <span class="label">Total Visitas</span>
                    <span class="value">${data.totalVisitas}</span>
                </div>
            `;

            if (data.movimientos.length === 0) {
                tbodyHistorial.innerHTML = '<tr><td colspan="5" class="text-center" style="color:#aaa">Sin movimientos registrados.</td></tr>';
                return;
            }

            tbodyHistorial.innerHTML = data.movimientos.map((m, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${formatFecha(m.hora_entrada)}</td>
                    <td>${m.hora_salida ? formatFecha(m.hora_salida) : '<em style="color:#888">En curso</em>'}</td>
                    <td>${m.celda}</td>
                    <td>${duracion(m.hora_entrada, m.hora_salida)}</td>
                </tr>
            `).join('');

        } catch (err) {
            resumenHistorial.innerHTML = '<p style="color:red">Error al cargar historial.</p>';
        }
    };

    document.getElementById('btnCerrarHistorial').addEventListener('click', () => {
        modalHistorial.style.display = 'none';
    });
    modalHistorial.addEventListener('click', e => {
        if (e.target === modalHistorial) modalHistorial.style.display = 'none';
    });

    // ─────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────
    loadUsuarios();
});
