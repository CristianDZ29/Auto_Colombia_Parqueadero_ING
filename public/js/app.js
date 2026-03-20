document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';

    const formEntrada   = document.getElementById('formEntrada');
    const formSalida    = document.getElementById('formSalida');
    const gridCeldas    = document.getElementById('gridCeldas');
    const mensajeEntrada = document.getElementById('mensajeEntrada');
    const mensajeSalida  = document.getElementById('mensajeSalida');
    const selectVehiculoEntrada = document.getElementById('selectVehiculoEntrada');
    const infoVehiculoEntrada   = document.getElementById('infoVehiculoEntrada');
    const selectSalidaCeldas    = document.getElementById('selectSalidaCeldas');

    let todasLasCeldas = [];
    let filtroActual = 'all';

    // ─────────────────────────────────────────
    // Mensajes
    // ─────────────────────────────────────────
    const showMessage = (el, type, text) => {
        el.textContent = text;
        el.className = `mensaje mensaje-${type === 'success' ? 'exito' : 'error'}`;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 6000);
    };

    // ─────────────────────────────────────────
    // Cargar Vehículos Registrados (Entrada)
    // ─────────────────────────────────────────
    const loadVehiculosEntrada = async () => {
        try {
            const res = await fetch(`${API_URL}/usuarios`);
            const data = await res.json();

            if (!data.success) return;

            selectVehiculoEntrada.innerHTML = '<option value="">-- Seleccionar vehículo --</option>';

            const ahora = new Date();
            data.usuarios.forEach(u => {
                const vencida = !u.fecha_vencimiento || new Date(u.fecha_vencimiento) < ahora;
                const option = document.createElement('option');
                option.value = u.placa;
                option.textContent = `${u.placa} — Celda ${u.celda_numero || 'Sin asignar'}${vencida ? ' [Mensualidad Vencida]' : ''}`;
                option.dataset.celda = u.celda_numero || '';
                option.dataset.tipo  = u.tipo || '';
                option.dataset.nombre = u.nombre_propietario || '';
                option.dataset.vencida = vencida ? '1' : '0';
                selectVehiculoEntrada.appendChild(option);
            });

            if (data.usuarios.length === 0) {
                selectVehiculoEntrada.innerHTML = '<option value="">Sin usuarios registrados — Ve a Gestionar Usuarios</option>';
            }
        } catch (err) {
            console.error('Error cargando vehículos:', err);
        }
    };

    // Mostrar info del vehículo seleccionado
    if (selectVehiculoEntrada) {
        selectVehiculoEntrada.addEventListener('change', () => {
            const opt = selectVehiculoEntrada.selectedOptions[0];
            if (opt && opt.value) {
                const vencida = opt.dataset.vencida === '1';
                infoVehiculoEntrada.textContent = vencida
                    ? `Mensualidad vencida — Celda ${opt.dataset.celda} — ${opt.dataset.tipo}`
                    : `Celda ${opt.dataset.celda} — ${opt.dataset.tipo} — ${opt.dataset.nombre || 'Sin nombre'}`;
                infoVehiculoEntrada.style.color = vencida ? '#C62828' : '#2E7D32';
            } else {
                infoVehiculoEntrada.textContent = '';
            }
        });
    }

    // ─────────────────────────────────────────
    // Cargar Celdas
    // ─────────────────────────────────────────
    const loadCeldas = async () => {
        try {
            const res = await fetch(`${API_URL}/celdas`);
            todasLasCeldas = await res.json();
            renderCeldas();
            actualizarSelectSalida();
        } catch (err) {
            console.error('Error cargando celdas:', err);
        }
    };

    const renderCeldas = () => {
        if (!gridCeldas) return;
        gridCeldas.innerHTML = '';

        const filtradas = filtroActual === 'all'
            ? todasLasCeldas
            : todasLasCeldas.filter(c => c.tipo === filtroActual);

        filtradas.forEach(celda => {
            const asignada   = !!celda.placa_asignada;
            const estaDentro = !!celda.placa_dentro;

            let claseEstado = 'sin-asignar';
            if (asignada && estaDentro) claseEstado = 'ocupada';
            else if (asignada && !estaDentro) claseEstado = 'libre';

            const div = document.createElement('div');
            div.className = `celda ${claseEstado}`;

            const estadoTexto = !asignada ? 'Sin usuario' : estaDentro ? 'Ocupada' : 'Libre';

            div.innerHTML = `
                <h3>${celda.numero}</h3>
                <p>${celda.tipo}</p>
                <strong>${estadoTexto}</strong>
                ${asignada ? `<div class="celda-placa">${celda.placa_asignada}</div>` : ''}
                ${asignada && celda.nombre_propietario ? `<div class="celda-propietario">${celda.nombre_propietario}</div>` : ''}
            `;
            gridCeldas.appendChild(div);
        });
    };

    // Filtros por tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActual = btn.dataset.filter;
            renderCeldas();
        });
    });

    // ─────────────────────────────────────────
    // Select de Salida
    // ─────────────────────────────────────────
    const actualizarSelectSalida = () => {
        if (!selectSalidaCeldas) return;
        selectSalidaCeldas.innerHTML = '<option value="">Seleccione una celda ocupada...</option>';

        todasLasCeldas.forEach(celda => {
            if (celda.placa_dentro) {
                const opt = document.createElement('option');
                opt.value = celda.placa_dentro;
                opt.textContent = `Celda ${celda.numero} — ${celda.placa_dentro}`;
                selectSalidaCeldas.appendChild(opt);
            }
        });
    };

    if (selectSalidaCeldas) {
        selectSalidaCeldas.addEventListener('change', e => {
            if (e.target.value) {
                document.getElementById('salPlaca').value = e.target.value;
            }
        });
    }

    // ─────────────────────────────────────────
    // REGISTRAR ENTRADA
    // ─────────────────────────────────────────
    if (formEntrada) {
        formEntrada.addEventListener('submit', async e => {
            e.preventDefault();
            const placa = selectVehiculoEntrada ? selectVehiculoEntrada.value : '';
            if (!placa) {
                showMessage(mensajeEntrada, 'error', 'Seleccione un vehículo de la lista.');
                return;
            }

            try {
                const res = await fetch(`${API_URL}/entrada`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ placa })
                });
                const result = await res.json();
                showMessage(mensajeEntrada, result.success ? 'success' : 'error', result.message);
                if (result.success) {
                    formEntrada.reset();
                    infoVehiculoEntrada.textContent = '';
                    loadCeldas();
                    loadVehiculosEntrada();
                }
            } catch (err) {
                showMessage(mensajeEntrada, 'error', 'Error de conexión con el servidor.');
            }
        });
    }

    // ─────────────────────────────────────────
    // REGISTRAR SALIDA
    // ─────────────────────────────────────────
    if (formSalida) {
        formSalida.addEventListener('submit', async e => {
            e.preventDefault();
            const placa = document.getElementById('salPlaca').value;

            try {
                const res = await fetch(`${API_URL}/salida`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ placa })
                });
                const result = await res.json();
                showMessage(mensajeSalida, result.success ? 'success' : 'error', result.message);
                if (result.success) {
                    formSalida.reset();
                    loadCeldas();
                    loadVehiculosEntrada();
                }
            } catch (err) {
                showMessage(mensajeSalida, 'error', 'Error de conexión con el servidor.');
            }
        });
    }

    // ─────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────
    loadVehiculosEntrada();
    loadCeldas();

    // Refrescar celdas cada 30 segundos
    setInterval(() => {
        loadCeldas();
        loadVehiculosEntrada();
    }, 30000);
});
