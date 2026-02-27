const express = require('express');
const router = express.Router();

const parkingController = require('../controllers/parking.controller');

// Obtener todas las celdas
router.get('/celdas', parkingController.getCeldas);

// Registrar entrada de vehículo
router.post('/entrada', parkingController.registrarEntrada);

// Registrar salida de vehículo
router.post('/salida', parkingController.registrarSalida);

// Consultar historial de vehículo
router.post('/historial', parkingController.consultarHistorial);

module.exports = router;
