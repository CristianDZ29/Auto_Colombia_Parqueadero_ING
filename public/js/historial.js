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

    if (formHistorial) {
        formHistorial.addEventListener('submit', async (e) => {
            e.preventDefault();

            const placa = document.getElementById('busPlaca').value;

            try {
                const res = await fetch(`${API_URL}/historial`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ placa })
                });
                const result = await res.json();

                if (result.success && result.vehiculo) {
                    // Populate vehiculo info
                    infoPlaca.textContent = result.vehiculo.placa;
                    infoTipo.textContent = result.vehiculo.tipo;
                    infoColor.textContent = result.vehiculo.color;
                    infoVisitas.textContent = result.totalVisitas;

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
                                <td>${mov.celda}</td>
                                <td>${mov.tipo}</td>
                                <td>${mov.valor ? '$' + mov.valor : 'N/A'}</td>
                            `;
                            tbodyHistorial.appendChild(tr);
                        });
                    }

                    resultados.style.display = 'block';
                    mensajeHistorial.style.display = 'none';
                } else {
                    resultados.style.display = 'none';
                    showMessage(mensajeHistorial, 'error', result.message || 'No se encontró el vehículo');
                }
            } catch (error) {
                console.error(error);
                showMessage(mensajeHistorial, 'error', 'Error al consultar historial');
            }
        });
    }
});
