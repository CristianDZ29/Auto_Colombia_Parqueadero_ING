document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';

    const formHistorial = document.getElementById('formHistorial');
    const mensajeHistorial = document.getElementById('mensajeHistorial');
    const resultados = document.getElementById('resultados');
    const tbodyHistorial = document.getElementById('tbodyHistorial');

    // Elementos de resumen
    const infoPlaca = document.getElementById('infoPlaca');
    const infoTipo = document.getElementById('infoTipo');
    const infoColor = document.getElementById('infoColor');
    const infoVisitas = document.getElementById('infoVisitas');

    const showMessage = (element, type, text) => {
        element.textContent = text;
        element.className = `mensaje mensaje-${type === 'success' ? 'exito' : 'error'}`;
        element.style.display = 'block';
        setTimeout(() => { element.style.display = 'none'; }, 5000);
    };

    const selectCeldasOcupadas = document.getElementById('selectCeldasOcupadas');
    const selectBusquedaCelda = document.getElementById('selectBusquedaCelda');
    const busPlaca = document.getElementById('busPlaca');
    const resumenVehiculo = document.getElementById('resumenVehiculo');
    const resumenCelda = document.getElementById('resumenCelda');

    // Cargar celdas para los selects
    const cargarCeldasSelect = async () => {
        try {
            const res = await fetch(`${API_URL}/celdas`);
            const celdas = await res.json();

            if (selectCeldasOcupadas) {
                celdas.forEach(celda => {
                    // Llenar select de búsqueda de historial de celda completa 
                    if (selectBusquedaCelda) {
                        const optionCelda = document.createElement('option');
                        optionCelda.value = celda.numero;
                        optionCelda.textContent = `Celda ${celda.numero} (${celda.tipo}) - Historial completo`;
                        selectBusquedaCelda.appendChild(optionCelda);
                    }

                    // Llenar select de celdas ocupadas como autocompletar
                    if (celda.estado === 'Ocupada' && celda.placa) {
                        const option = document.createElement('option');
                        option.value = celda.placa;
                        option.textContent = `Celda ${celda.numero} [Ocupada] - Placa: ${celda.placa}`;
                        selectCeldasOcupadas.appendChild(option);
                    }
                });

                selectCeldasOcupadas.addEventListener('change', (e) => {
                    if (e.target.value) {
                        busPlaca.value = e.target.value;
                        if (selectBusquedaCelda) selectBusquedaCelda.value = "";
                    }
                });

                if (selectBusquedaCelda) {
                    selectBusquedaCelda.addEventListener('change', (e) => {
                        if (e.target.value) {
                            busPlaca.value = "";
                            selectCeldasOcupadas.value = "";
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error cargando celdas para select:', error);
        }
    };

    // Iniciar carga de celdas
    cargarCeldasSelect();

    if (formHistorial) {
        formHistorial.addEventListener('submit', async (e) => {
            e.preventDefault();

            const placa = busPlaca.value.trim();
            const celdaBusqueda = selectBusquedaCelda ? selectBusquedaCelda.value : "";

            if (!placa && !celdaBusqueda) {
                showMessage(mensajeHistorial, 'error', 'Por favor ingresa una placa o selecciona una celda específica');
                return;
            }

            try {
                let res, result;
                let isBusquedaPorCelda = celdaBusqueda !== "";

                if (isBusquedaPorCelda) {
                    res = await fetch(`${API_URL}/historial-celda`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ celda: celdaBusqueda })
                    });
                } else {
                    res = await fetch(`${API_URL}/historial`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ placa })
                    });
                }

                result = await res.json();

                if (result.success) {
                    if (isBusquedaPorCelda) {
                        resumenVehiculo.style.display = 'none';
                        resumenCelda.style.display = 'block';
                        document.getElementById('infoCeldaNum').textContent = result.celda.numero;
                        document.getElementById('infoCeldaTipo').textContent = result.celda.tipo;
                        document.getElementById('infoCeldaMovs').textContent = result.totalVisitas;
                    } else {
                        resumenCelda.style.display = 'none';
                        resumenVehiculo.style.display = 'block';
                        infoPlaca.textContent = result.vehiculo.placa;
                        infoTipo.textContent = result.vehiculo.tipo;
                        infoColor.textContent = result.vehiculo.color;
                        infoVisitas.textContent = `${result.diasDisponibles} días`;
                    }

                    // Populate table
                    tbodyHistorial.innerHTML = '';
                    if (result.movimientos.length === 0) {
                        tbodyHistorial.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay movimientos</td></tr>';
                    } else {
                        result.movimientos.forEach(mov => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td>${new Date(mov.hora_entrada).toLocaleString()}</td>
                                <td>${mov.hora_salida ? new Date(mov.hora_salida).toLocaleString() : 'En Parqueadero'}</td>
                                <td>${isBusquedaPorCelda ? mov.placa : mov.celda}</td>
                                <td>${mov.tipo}</td>
                                <td>${mov.tipo === 'Carro' ? '$60,000' : '$30,000'}</td>
                            `;
                            tbodyHistorial.appendChild(tr);
                        });
                    }

                    resultados.style.display = 'block';
                    mensajeHistorial.style.display = 'none';

                    // Mostrar botones de prueba asegurándonos de que haya una placa válida
                    const btnRestarDia = document.getElementById('btnRestarDia');
                    const btnSumarDia = document.getElementById('btnSumarDia');
                    if (btnRestarDia && btnSumarDia && !isBusquedaPorCelda) {
                        btnRestarDia.style.display = 'inline-block';
                        btnSumarDia.style.display = 'inline-block';

                        btnRestarDia.onclick = () => modificarDias(-1, placa);
                        btnSumarDia.onclick = () => modificarDias(1, placa);
                    } else if (btnRestarDia && btnSumarDia) {
                        btnRestarDia.style.display = 'none';
                        btnSumarDia.style.display = 'none';
                    }

                } else {
                    resultados.style.display = 'none';
                    showMessage(mensajeHistorial, 'error', result.message || 'No se encontró el registro');
                }
            } catch (error) {
                console.error(error);
                showMessage(mensajeHistorial, 'error', 'Error al consultar historial');
            }
        });
    }

    const modificarDias = async (dias, placa) => {
        try {
            const res = await fetch(`${API_URL}/test-modificar-dias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ placa, dias })
            });
            const result = await res.json();
            if (result.success) {
                showMessage(mensajeHistorial, 'success', result.message);
                // Disparar submit automático para refrescar
                document.getElementById('btnBuscarHistorial').click();
            } else {
                showMessage(mensajeHistorial, 'error', result.message);
            }
        } catch (error) {
            console.error(error);
            showMessage(mensajeHistorial, 'error', 'Error modificando días de prueba');
        }
    };
});
