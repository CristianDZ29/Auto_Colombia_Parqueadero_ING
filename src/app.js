const express = require('express');
const cors = require('cors');
const path = require('path');

const parkingRoutes = require('./routes/parking.routes');
const { initDatabase } = require('./config/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Inicializar base de datos
initDatabase();

// Rutas
app.use('/api', parkingRoutes);

module.exports = app;
