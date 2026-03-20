const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/parking.controller');

// Celdas
router.get('/celdas', ctrl.getCeldas);
router.get('/celdas-disponibles', ctrl.getCeldasDisponibles);

// Usuarios
router.get('/usuarios', ctrl.getUsuarios);
router.post('/usuarios', ctrl.crearUsuario);
router.put('/usuarios/:placa', ctrl.actualizarUsuario);
router.delete('/usuarios/:placa', ctrl.eliminarUsuario);

// Entrada / Salida
router.post('/entrada', ctrl.registrarEntrada);
router.post('/salida', ctrl.registrarSalida);

// Historial
router.post('/historial', ctrl.consultarHistorial);
router.post('/historial-celda', ctrl.consultarHistorialPorCelda);

module.exports = router;
