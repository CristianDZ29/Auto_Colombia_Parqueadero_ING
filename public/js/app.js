document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';

    const formEntrada = document.getElementById('formEntrada');
    const formSalida = document.getElementById('formSalida');
    const gridCeldas = document.getElementById('gridCeldas');
    const mensajeEntrada = document.getElementById('mensajeEntrada');
    const mensajeSalida = document.getElementById('mensajeSalida');

    // Función para mostrar mensajes
    const showMessage = (element, type, text) => {
        element.textContent = text;
        element.className = `mensaje mensaje-${type === 'success' ? 'exito' : 'error'}`;
        element.style.display = 'block';
        setTimeout(() => { element.style.display = 'none'; }, 5000);
    };

    // Función para cargar celdas
    const loadCeldas = async () => {
        try {
            const res = await fetch(`${API_URL}/celdas`);
            const celdas = await res.json();

            gridCeldas.innerHTML = '';

            celdas.forEach(celda => {
                const isLibre = celda.estado === 'Libre';
                const div = document.createElement('div');
                div.className = `celda ${isLibre ? 'libre' : 'ocupada'}`;

                div.innerHTML = `
                    <h3>${celda.numero}</h3>
                    <p>${celda.tipo}</p>
                    <strong>${celda.estado}</strong>
                    ${!isLibre && celda.placa ? `<p class="placa">${celda.placa}</p>` : ''}
                `;

                gridCeldas.appendChild(div);
            });
        } catch (error) {
            console.error('Error cargando celdas:', error);
        }
    };

    // Registrar Entrada
    if (formEntrada) {
        formEntrada.addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = {
                placa: document.getElementById('entPlaca').value,
                tipo: document.getElementById('entTipo').value,
                color: document.getElementById('entColor').value,
                pagarMensualidad: document.getElementById("entPagarMensualidad").checked
            };

            try {
                const res = await fetch(`${API_URL}/entrada`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();

                if (result.success) {
                    showMessage(mensajeEntrada, 'success', result.message);
                    formEntrada.reset();
                    loadCeldas();
                } else {
                    showMessage(mensajeEntrada, 'error', result.message);
                }
            } catch (error) {
                showMessage(mensajeEntrada, 'error', 'Error de conexión');
            }
        });
    }

    // Registrar Salida
    if (formSalida) {
        formSalida.addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = {
                placa: document.getElementById('salPlaca').value
            };

            try {
                const res = await fetch(`${API_URL}/salida`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();

                if (result.success) {
                    showMessage(mensajeSalida, 'success', result.message);
                    formSalida.reset();
                    loadCeldas();
                } else {
                    showMessage(mensajeSalida, 'error', result.message);
                }
            } catch (error) {
                showMessage(mensajeSalida, 'error', 'Error de conexión');
            }
        });
    }

    // Cargar inicialmente
    if (gridCeldas) {
        loadCeldas();
    }
});
