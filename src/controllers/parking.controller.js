const { db } = require('../config/database');

// ─────────────────────────────────────────────
//  CELDAS
// ─────────────────────────────────────────────

const getCeldas = (req, res) => {
    try {
        const celdas = db.prepare(`
            SELECT 
                c.id_celda,
                c.numero,
                c.tipo,
                c.estado,
                v.placa        AS placa_asignada,
                v.nombre_propietario,
                m.placa        AS placa_dentro
            FROM tbl_celda c
            LEFT JOIN tbl_vehiculo v ON v.id_celda = c.id_celda
            LEFT JOIN tbl_movimiento m ON c.id_celda = m.id_celda AND m.hora_salida IS NULL
            ORDER BY c.numero
        `).all();
        res.json(celdas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getCeldasDisponibles = (req, res) => {
    const { tipo } = req.query;
    try {
        let query = `
            SELECT c.id_celda, c.numero, c.tipo
            FROM tbl_celda c
            LEFT JOIN tbl_vehiculo v ON v.id_celda = c.id_celda
            WHERE v.placa IS NULL
        `;
        const params = [];
        if (tipo) {
            query += ' AND c.tipo = ?';
            params.push(tipo);
        }
        query += ' ORDER BY c.numero';
        const celdas = db.prepare(query).all(...params);
        res.json(celdas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────
//  USUARIOS / VEHÍCULOS REGISTRADOS
// ─────────────────────────────────────────────

const getUsuarios = (req, res) => {
    try {
        const usuarios = db.prepare(`
            SELECT 
                v.placa,
                v.tipo,
                v.color,
                v.nombre_propietario,
                v.telefono,
                v.fecha_vencimiento,
                v.id_celda,
                c.numero AS celda_numero,
                c.estado AS celda_estado
            FROM tbl_vehiculo v
            LEFT JOIN tbl_celda c ON v.id_celda = c.id_celda
            ORDER BY c.numero
        `).all();

        const ahora = new Date();
        const result = usuarios.map(u => {
            const fechaVenc = u.fecha_vencimiento ? new Date(u.fecha_vencimiento) : null;
            const diasDisponibles = fechaVenc && fechaVenc >= ahora
                ? Math.ceil((fechaVenc - ahora) / (1000 * 3600 * 24))
                : 0;
            return { ...u, diasDisponibles, mensualidadActiva: diasDisponibles > 0 };
        });

        res.json({ success: true, usuarios: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const crearUsuario = (req, res) => {
    const { placa, tipo, color, nombre_propietario, telefono, id_celda, pagarMensualidad } = req.body;
    const placaUpper = placa ? placa.toUpperCase().trim() : '';

    if (!placaUpper || !tipo || !id_celda) {
        return res.status(400).json({ success: false, message: 'Placa, tipo y celda son obligatorios.' });
    }

    try {
        // Verificar que la placa no esté ya registrada
        const existente = db.prepare('SELECT placa FROM tbl_vehiculo WHERE placa = ?').get(placaUpper);
        if (existente) {
            return res.status(400).json({ success: false, message: 'Ya existe un usuario con esa placa.' });
        }

        // Verificar que la celda no esté ya asignada
        const celdaOcupada = db.prepare('SELECT placa FROM tbl_vehiculo WHERE id_celda = ?').get(id_celda);
        if (celdaOcupada) {
            return res.status(400).json({ success: false, message: 'Esa celda ya está asignada a otro vehículo.' });
        }

        // Verificar que el tipo de celda coincide
        const celdaInfo = db.prepare('SELECT tipo FROM tbl_celda WHERE id_celda = ?').get(id_celda);
        if (!celdaInfo) {
            return res.status(400).json({ success: false, message: 'La celda seleccionada no existe.' });
        }
        if (celdaInfo.tipo !== tipo) {
            return res.status(400).json({ success: false, message: `La celda es para ${celdaInfo.tipo}, pero el vehículo es ${tipo}.` });
        }

        // Calcular fecha vencimiento mensualidad si pagó
        let fechaVencimiento = null;
        if (pagarMensualidad) {
            const nuevaFecha = new Date();
            nuevaFecha.setMonth(nuevaFecha.getMonth() + 1);
            fechaVencimiento = nuevaFecha.toISOString();
        }

        db.prepare(`
            INSERT INTO tbl_vehiculo (placa, tipo, color, nombre_propietario, telefono, id_celda, fecha_vencimiento)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(placaUpper, tipo, color || '', nombre_propietario || '', telefono || '', id_celda, fechaVencimiento);

        res.json({ success: true, message: `Usuario ${placaUpper} registrado correctamente.` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const actualizarUsuario = (req, res) => {
    const { placa } = req.params;
    const placaUpper = placa ? placa.toUpperCase() : '';
    const { color, nombre_propietario, telefono, pagarMensualidad } = req.body;

    try {
        const vehiculo = db.prepare('SELECT * FROM tbl_vehiculo WHERE placa = ?').get(placaUpper);
        if (!vehiculo) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        let nuevaFechaVencimiento = vehiculo.fecha_vencimiento;
        let msg = `Usuario ${placaUpper} actualizado.`;

        if (pagarMensualidad) {
            const ahora = new Date();
            const fechaActual = vehiculo.fecha_vencimiento ? new Date(vehiculo.fecha_vencimiento) : ahora;
            const base = fechaActual > ahora ? fechaActual : ahora;
            base.setMonth(base.getMonth() + 1);
            nuevaFechaVencimiento = base.toISOString();
            msg += ' Mensualidad renovada por 1 mes.';
        }

        db.prepare(`
            UPDATE tbl_vehiculo
            SET color = ?, nombre_propietario = ?, telefono = ?, fecha_vencimiento = ?
            WHERE placa = ?
        `).run(
            color ?? vehiculo.color,
            nombre_propietario ?? vehiculo.nombre_propietario,
            telefono ?? vehiculo.telefono,
            nuevaFechaVencimiento,
            placaUpper
        );

        res.json({ success: true, message: msg });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const eliminarUsuario = (req, res) => {
    const { placa } = req.params;
    const placaUpper = placa ? placa.toUpperCase() : '';

    try {
        const vehiculo = db.prepare('SELECT * FROM tbl_vehiculo WHERE placa = ?').get(placaUpper);
        if (!vehiculo) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        // Verificar que no esté actualmente dentro
        const dentroAhora = db.prepare('SELECT id_mov FROM tbl_movimiento WHERE placa = ? AND hora_salida IS NULL').get(placaUpper);
        if (dentroAhora) {
            return res.status(400).json({ success: false, message: 'El vehículo está actualmente dentro. Registre la salida primero.' });
        }

        db.prepare('DELETE FROM tbl_vehiculo WHERE placa = ?').run(placaUpper);

        res.json({ success: true, message: `Usuario ${placaUpper} eliminado.` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ─────────────────────────────────────────────
//  ENTRADA / SALIDA
// ─────────────────────────────────────────────

const registrarEntrada = (req, res) => {
    const { placa } = req.body;
    const placaUpper = placa ? placa.toUpperCase().trim() : '';

    if (!placaUpper) {
        return res.status(400).json({ success: false, message: 'Falta la placa del vehículo.' });
    }

    try {
        // Buscar vehículo registrado con su celda asignada
        const vehiculo = db.prepare(`
            SELECT v.*, c.numero AS celda_numero, c.id_celda AS celda_id, c.estado AS celda_estado
            FROM tbl_vehiculo v
            JOIN tbl_celda c ON v.id_celda = c.id_celda
            WHERE v.placa = ?
        `).get(placaUpper);

        if (!vehiculo) {
            return res.status(404).json({ success: false, message: 'Vehículo no registrado. Regístrelo primero en Gestión de Usuarios.' });
        }

        // Verificar que no esté ya dentro
        const yaDentro = db.prepare('SELECT id_mov FROM tbl_movimiento WHERE placa = ? AND hora_salida IS NULL').get(placaUpper);
        if (yaDentro) {
            return res.status(400).json({ success: false, message: 'El vehículo ya se encuentra dentro del parqueadero.' });
        }

        // Verificar celda libre
        if (vehiculo.celda_estado === 'Ocupada') {
            return res.status(400).json({ success: false, message: `La celda ${vehiculo.celda_numero} asignada está ocupada.` });
        }

        // Verificar mensualidad activa
        const ahora = new Date();
        const fechaVenc = vehiculo.fecha_vencimiento ? new Date(vehiculo.fecha_vencimiento) : null;
        if (!fechaVenc || fechaVenc < ahora) {
            return res.status(403).json({
                success: false,
                message: 'La mensualidad está vencida o no fue pagada. Renueve desde Gestión de Usuarios.',
                requierePago: true
            });
        }

        // Registrar entrada a la celda asignada
        const horaEntrada = new Date().toISOString();
        db.prepare('INSERT INTO tbl_movimiento (id_celda, placa, hora_entrada, tipo_movimiento) VALUES (?, ?, ?, ?)')
            .run(vehiculo.celda_id, placaUpper, horaEntrada, 'Entrada');

        db.prepare('UPDATE tbl_celda SET estado = ? WHERE id_celda = ?')
            .run('Ocupada', vehiculo.celda_id);

        res.json({
            success: true,
            message: `✅ Entrada registrada: ${placaUpper} en Celda ${vehiculo.celda_numero}.`,
            celda: vehiculo.celda_numero
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const registrarSalida = (req, res) => {
    const { placa } = req.body;
    const placaUpper = placa ? placa.toUpperCase() : '';

    if (!placaUpper) {
        return res.status(400).json({ success: false, message: 'Falta la placa del vehículo.' });
    }

    try {
        const movimiento = db.prepare(`
            SELECT m.id_mov, m.hora_entrada, c.numero, c.id_celda
            FROM tbl_movimiento m
            JOIN tbl_celda c ON m.id_celda = c.id_celda
            WHERE m.placa = ? AND m.hora_salida IS NULL
            ORDER BY m.hora_entrada DESC LIMIT 1
        `).get(placaUpper);

        if (!movimiento) {
            return res.status(404).json({ success: false, message: 'Vehículo no encontrado o ya salió.' });
        }

        const horaSalida = new Date().toISOString();

        db.prepare('UPDATE tbl_movimiento SET hora_salida = ?, valor = 0, tipo_movimiento = ? WHERE id_mov = ?')
            .run(horaSalida, 'Salida', movimiento.id_mov);

        // Liberar celda (volver a Libre, el vehículo sigue asignado)
        db.prepare('UPDATE tbl_celda SET estado = ? WHERE id_celda = ?')
            .run('Libre', movimiento.id_celda);

        res.json({
            success: true,
            message: `✅ Salida registrada. Placa: ${placaUpper}, Celda: ${movimiento.numero}.`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ─────────────────────────────────────────────
//  HISTORIAL
// ─────────────────────────────────────────────

const consultarHistorial = (req, res) => {
    const { placa } = req.body;
    const placaUpper = placa ? placa.toUpperCase() : '';

    if (!placaUpper) {
        return res.status(400).json({ success: false, message: 'Falta la placa del vehículo.' });
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

        const infoVehiculo = db.prepare(`
            SELECT v.*, c.numero AS celda_numero
            FROM tbl_vehiculo v
            LEFT JOIN tbl_celda c ON v.id_celda = c.id_celda
            WHERE v.placa = ?
        `).get(placaUpper);

        if (!infoVehiculo) {
            return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
        }

        const ahora = new Date();
        const fechaVenc = infoVehiculo.fecha_vencimiento ? new Date(infoVehiculo.fecha_vencimiento) : null;
        const diasDisponibles = fechaVenc && fechaVenc >= ahora
            ? Math.ceil((fechaVenc - ahora) / (1000 * 3600 * 24))
            : 0;

        res.json({
            success: true,
            movimientos,
            totalVisitas: movimientos.length,
            vehiculo: infoVehiculo,
            diasDisponibles
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const consultarHistorialPorCelda = (req, res) => {
    const { celda } = req.body;
    const celdaUpper = celda ? celda.toUpperCase() : '';

    if (!celdaUpper) {
        return res.status(400).json({ success: false, message: 'Falta el número de celda.' });
    }

    try {
        const celdaInfo = db.prepare('SELECT * FROM tbl_celda WHERE numero = ?').get(celdaUpper);
        if (!celdaInfo) {
            return res.status(404).json({ success: false, message: 'Celda no encontrada.' });
        }

        const movimientos = db.prepare(`
            SELECT m.hora_entrada, m.hora_salida, m.valor, m.placa, c.numero as celda, v.tipo, v.color
            FROM tbl_movimiento m
            JOIN tbl_celda c ON m.id_celda = c.id_celda
            JOIN tbl_vehiculo v ON m.placa = v.placa
            WHERE c.numero = ?
            ORDER BY m.hora_entrada DESC
        `).all(celdaUpper);

        res.json({ success: true, movimientos, totalVisitas: movimientos.length, celda: celdaInfo });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getCeldas,
    getCeldasDisponibles,
    getUsuarios,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
    registrarEntrada,
    registrarSalida,
    consultarHistorial,
    consultarHistorialPorCelda
};