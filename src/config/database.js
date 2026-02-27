const Database = require('better-sqlite3');
const path = require('path');

// Ubicar la base de datos en la raíz del proyecto
const dbPath = path.resolve(__dirname, '../../parqueadero.db');
const db = new Database(dbPath);

// Inicializar tablas
function initDatabase() {
    // Tabla Celdas
    db.exec(`
        CREATE TABLE IF NOT EXISTS tbl_celda (
            id_celda INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT UNIQUE,
            tipo TEXT,
            estado TEXT DEFAULT 'Libre'
        )
    `);

    // Tabla Vehículos
    db.exec(`
        CREATE TABLE IF NOT EXISTS tbl_vehiculo (
            placa TEXT PRIMARY KEY,
            tipo TEXT,
            color TEXT
        )
    `);

    // Tabla Movimientos
    db.exec(`
        CREATE TABLE IF NOT EXISTS tbl_movimiento (
            id_mov INTEGER PRIMARY KEY AUTOINCREMENT,
            id_celda INTEGER,
            placa TEXT,
            hora_entrada TEXT,
            hora_salida TEXT,
            valor REAL,
            tipo_movimiento TEXT,
            FOREIGN KEY(id_celda) REFERENCES tbl_celda(id_celda),
            FOREIGN KEY(placa) REFERENCES tbl_vehiculo(placa)
        )
    `);

    // Seed data: crear celdas si no existen
    const result = db.prepare('SELECT count(*) as count FROM tbl_celda').get();

    if (result && result.count === 0) {
        const insert = db.prepare('INSERT INTO tbl_celda (numero, tipo, estado) VALUES (?, ?, ?)');

        // Transaction para mayor desempeño
        const seedCeldas = db.transaction(() => {
            for (let i = 1; i <= 10; i++) {
                insert.run(`A-${i}`, 'Carro', 'Libre');
            }
            for (let i = 1; i <= 5; i++) {
                insert.run(`M-${i}`, 'Moto', 'Libre');
            }
        });

        seedCeldas();
        console.log('✅ Celdas inicializadas en la base de datos');
    }
}

module.exports = { db, initDatabase };
