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
    const { placa, tipo, color, pagarMensualidad } = req.body;
    const placaUpper = placa ? placa.toUpperCase() : '';

    if (!placaUpper) {
        return res.status(400).json({ success: false, message: 'Faltan la placa' });
    }

    try {
        // Evitar que el mismo vehículo ingrese dos veces (2 placas iguales dentro)
        const vehiculoDentro = db.prepare('SELECT id_mov FROM tbl_movimiento WHERE placa = ? AND hora_salida IS NULL').get(placaUpper);
        if (vehiculoDentro) {
            return res.status(400).json({ success: false, message: 'El vehículo ya se encuentra dentro del parqueadero.' });
        }

        const vehiculoExistente = db.prepare('SELECT * FROM tbl_vehiculo WHERE placa = ?').get(placaUpper);
        let tipoVehiculo = vehiculoExistente ? vehiculoExistente.tipo : tipo;

        // Buscar celda libre ANTES de validar mensualidad
        const celda = db.prepare(
            'SELECT id_celda, numero FROM tbl_celda WHERE estado = ? AND tipo = ? LIMIT 1'
        ).get('Libre', tipoVehiculo);

        if (!celda) {
            return res.status(400).json({ success: false, message: 'No hay celdas disponibles para este tipo de vehículo, no puede ingresar ni pagar mensualidad.' });
        }

        // Lógica de Mensualidad
        const ahora = new Date();
        const fechaVencAct = vehiculoExistente && vehiculoExistente.fecha_vencimiento
            ? new Date(vehiculoExistente.fecha_vencimiento)
            : null;

        let tieneMensualidadActiva = fechaVencAct && fechaVencAct >= ahora;
        let esRenovacionOPrimeraVez = false;

        if (!tieneMensualidadActiva) {
            if (!pagarMensualidad) {
                return res.status(403).json({
                    success: false,
                    message: vehiculoExistente
                        ? 'La mensualidad ha vencido. Marque la casilla "Pagar Mensualidad" para renovar por 1 mes.'
                        : 'El vehículo no está registrado. Para ingresar debe marcar la casilla "Pagar Mensualidad".'
                });
            } else {
                if (!vehiculoExistente && (!tipo || !color)) {
                    return res.status(400).json({ success: false, message: 'Debe ingresar tipo y color para el nuevo registro' });
                }

                esRenovacionOPrimeraVez = true;

                // Calcular nueva fecha (1 mes a partir de hoy, o si tenía días a favor acumulárselos, pero típicamente es a partir de hoy)
                const nuevaFechaVencimiento = new Date();
                nuevaFechaVencimiento.setMonth(nuevaFechaVencimiento.getMonth() + 1);
                const strFechaVencimiento = nuevaFechaVencimiento.toISOString();

                if (!vehiculoExistente) {
                    db.prepare('INSERT INTO tbl_vehiculo (placa, tipo, color, fecha_vencimiento) VALUES (?, ?, ?, ?)')
                        .run(placaUpper, tipo, color, strFechaVencimiento);
                } else {
                    db.prepare('UPDATE tbl_vehiculo SET fecha_vencimiento = ? WHERE placa = ?')
                        .run(strFechaVencimiento, placaUpper);
                }
            }
        }

        const horaEntrada = new Date().toISOString();

        // Registrar movimiento
        db.prepare(
            'INSERT INTO tbl_movimiento (id_celda, placa, hora_entrada, tipo_movimiento) VALUES (?, ?, ?, ?)'
        ).run(celda.id_celda, placaUpper, horaEntrada, 'Entrada');

        // Actualizar estado de celda
        db.prepare('UPDATE tbl_celda SET estado = ? WHERE id_celda = ?')
            .run('Ocupada', celda.id_celda);

        let msg = `Entrada registrada: Placa ${placaUpper} en Celda ${celda.numero}.`;
        if (esRenovacionOPrimeraVez) {
            msg += ` Se activó la mensualidad de ${tipoVehiculo} por 1 mes.`;
        }

        res.json({
            success: true,
            message: msg,
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

        // Calcular días disponibles
        const ahora = new Date();
        const fechaVenc = infoVehiculo.fecha_vencimiento ? new Date(infoVehiculo.fecha_vencimiento) : null;
        let diasDisponibles = 0;

        if (fechaVenc && fechaVenc >= ahora) {
            const diferenciaTiempo = fechaVenc.getTime() - ahora.getTime();
            diasDisponibles = Math.ceil(diferenciaTiempo / (1000 * 3600 * 24));
        }

        res.json({
            success: true,
            movimientos: movimientos,
            totalVisitas: movimientos.length,
            vehiculo: infoVehiculo,
            diasDisponibles: diasDisponibles
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const consultarHistorialPorCelda = (req, res) => {
    const { celda } = req.body;
    const celdaUpper = celda ? celda.toUpperCase() : '';

    if (!celdaUpper) {
        return res.status(400).json({ success: false, message: 'Falta el número de celda' });
    }

    try {
        const celdaInfo = db.prepare('SELECT * FROM tbl_celda WHERE numero = ?').get(celdaUpper);

        if (!celdaInfo) {
            return res.status(404).json({ success: false, message: 'Celda no encontrada' });
        }

        const movimientos = db.prepare(`
            SELECT m.hora_entrada, m.hora_salida, m.valor, m.placa, c.numero as celda, v.tipo, v.color
            FROM tbl_movimiento m
            JOIN tbl_celda c ON m.id_celda = c.id_celda
            JOIN tbl_vehiculo v ON m.placa = v.placa
            WHERE c.numero = ?
            ORDER BY m.hora_entrada DESC
        `).all(celdaUpper);

        res.json({
            success: true,
            movimientos: movimientos,
            totalVisitas: movimientos.length,
            celda: celdaInfo
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const testModificarDias = (req, res) => {
    const { placa, dias } = req.body;
    const placaUpper = placa ? placa.toUpperCase() : '';

    if (!placaUpper || !dias) {
        return res.status(400).json({ success: false, message: 'Falta la placa o la cantidad de días a modificar' });
    }

    try {
        const vehiculoExistente = db.prepare('SELECT * FROM tbl_vehiculo WHERE placa = ?').get(placaUpper);

        if (!vehiculoExistente) {
            return res.status(404).json({ success: false, message: 'El vehículo no está registrado.' });
        }

        const fechaVencAct = vehiculoExistente.fecha_vencimiento
            ? new Date(vehiculoExistente.fecha_vencimiento)
            : new Date();

        // Sumar o restar la cantidad de días indicada
        fechaVencAct.setDate(fechaVencAct.getDate() + parseInt(dias));
        const nuevaStrFecha = fechaVencAct.toISOString();

        db.prepare('UPDATE tbl_vehiculo SET fecha_vencimiento = ? WHERE placa = ?')
            .run(nuevaStrFecha, placaUpper);

        res.json({
            success: true,
            message: `Fecha de vencimiento modificada (${dias > 0 ? '+' : ''}${dias} día${Math.abs(dias) !== 1 ? 's' : ''}) `
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getCeldas,
    registrarEntrada,
    registrarSalida,
    consultarHistorial,
    consultarHistorialPorCelda,
    testModificarDias
};