const { db } = require('../config/database');

const getCeldas = (req, res) => {
    try {
        const celdas = db.prepare(`
            SELECT 
                c.id_celda,
                c.numero,
                c.tipo,
                c.estado,
                m.placa
            FROM tbl_celda c
            LEFT JOIN tbl_movimiento m ON c.id_celda = m.id_celda AND m.hora_salida IS NULL
            ORDER BY c.numero
        `).all();
        res.json(celdas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const registrarEntrada = (req, res) => {
    const { placa, tipo, color, pagarMensualidad} = req.body;
    const placaUpper = placa ? placa.toUpperCase() : '';

    if (!placaUpper ) {
        return res.status(400).json({ success: false, message: 'Faltan la placa' });
    }

    try {
        // Insertar o actualizar vehículo
        const vehiculoExistente = db.prepare('SELECT * FROM tbl_vehiculo WHERE placa = ?').get(placaUpper);
        let tipoVehiculo = tipo;

        if (!vehiculoExistente) {
            if (!pagarMensualidad) {
                return res.status(403).json({
                    success: false,
                    message: 'El vehículo no está en la base de datos. Debe pagar la mensualidad para ingresar (Marque la casilla "El vehículo es nuevo").'
                });
            } else {
                if (!tipo || !color) {
                    return res.status(400).json({ success: false, message: 'Debe ingresar tipo y color para el nuevo registro' });
                }
                db.prepare('INSERT INTO tbl_vehiculo (placa, tipo, color) VALUES (?, ?, ?)')
                    .run(placaUpper, tipo, color);
            }
        } else {
            tipoVehiculo = vehiculoExistente.tipo;
        }

        // Buscar celda libre
        const celda = db.prepare(
            'SELECT id_celda, numero FROM tbl_celda WHERE estado = ? AND tipo = ? LIMIT 1'
        ).get('Libre', tipoVehiculo);

        if (!celda) {
            return res.status(400).json({ success: false, message: 'No hay celdas disponibles para este tipo de vehículo' });
        }

        const horaEntrada = new Date().toISOString();

        // Registrar movimiento
        db.prepare(
            'INSERT INTO tbl_movimiento (id_celda, placa, hora_entrada, tipo_movimiento) VALUES (?, ?, ?, ?)'
        ).run(celda.id_celda, placaUpper, horaEntrada, 'Entrada');

        // Actualizar estado de celda
        db.prepare('UPDATE tbl_celda SET estado = ? WHERE id_celda = ?')
            .run('Ocupada', celda.id_celda);

        res.json({
            success: true,
            message: `Entrada registrada: Placa ${placaUpper} en Celda ${celda.numero}`,
            celda: celda.numero
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const registrarSalida = (req, res) => {
    const { placa } = req.body;
    const placaUpper = placa ? placa.toUpperCase() : '';

    if (!placaUpper) {
        return res.status(400).json({ success: false, message: 'Falta la placa del vehículo' });
    }

    try {
        // Buscar movimiento de entrada sin salida
        const movimiento = db.prepare(`
            SELECT m.id_mov, m.hora_entrada, c.numero, v.tipo 
            FROM tbl_movimiento m
            JOIN tbl_celda c ON m.id_celda = c.id_celda
            JOIN tbl_vehiculo v ON m.placa = v.placa
            WHERE m.placa = ? AND m.hora_salida IS NULL
            ORDER BY m.hora_entrada DESC LIMIT 1
        `).get(placaUpper);

        if (!movimiento) {
            return res.status(404).json({ success: false, message: 'Vehículo no encontrado o ya salió' });
        }

        // Calcular tiempo y tarifa
        const horaEntrada = new Date(movimiento.hora_entrada);
        const horaSalida = new Date();
        const horas = (horaSalida - horaEntrada) / (1000 * 60 * 60); // horas decimales
        const horasCobradas = Math.max(1, Math.ceil(horas)); // Mínimo 1 hora
        const valorHora = movimiento.tipo === 'Carro' ? 2000 : 1000;
        const valor = 0;

        // Registrar salida
        const horaSalidaStr = horaSalida.toISOString();
        db.prepare(
            'UPDATE tbl_movimiento SET hora_salida = ?, valor = ?, tipo_movimiento = ? WHERE id_mov = ?'
        ).run(horaSalidaStr, valor, 'Salida', movimiento.id_mov);

        // Liberar celda
        db.prepare('UPDATE tbl_celda SET estado = ? WHERE numero = ?')
            .run('Libre', movimiento.numero);

        res.json({
            success: true,
            message: `Salida registrada. Placa: ${placaUpper}, (Sistema por mensualudad)`,
            valor: valor,
            horas: horasCobradas
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const consultarHistorial = (req, res) => {
    const { placa } = req.body;
    const placaUpper = placa ? placa.toUpperCase() : '';

    if (!placaUpper) {
        return res.status(400).json({ success: false, message: 'Falta la placa del vehículo' });
    }

    try {
        const movimientos = db.prepare(`
            SELECT m.hora_entrada, m.hora_salida, m.valor, c.numero as celda, v.tipo, v.color
            FROM tbl_movimiento m
            JOIN tbl_celda c ON m.id_celda = c.id_celda
            JOIN tbl_vehiculo v ON m.placa = v.placa
            WHERE m.placa = ?
            ORDER BY m.hora_entrada DESC
        `).all(placaUpper);

        const infoVehiculo = db.prepare('SELECT * FROM tbl_vehiculo WHERE placa = ?').get(placaUpper);

        if (!infoVehiculo) {
            return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
        }

        res.json({
            success: true,
            movimientos: movimientos,
            totalVisitas: movimientos.length,
            vehiculo: infoVehiculo
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getCeldas,
    registrarEntrada,
    registrarSalida,
    consultarHistorial
};
