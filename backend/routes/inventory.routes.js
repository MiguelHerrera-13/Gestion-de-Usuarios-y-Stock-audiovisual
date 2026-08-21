const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// --- MATERIALES CRUD ---
router.get('/materiales', authenticateToken, async (req, res) => {
  try {
    const [materiales] = await db.query(
      `SELECT m.*, c.nombre_categoria FROM material m LEFT JOIN categoria_material c ON m.categoria_id = c.id_categoria`
    );
    res.json(materiales);
  } catch (error) { res.status(500).json({ error: 'Error al obtener materiales' }); }
});

router.post('/materiales', authenticateToken, authorizeAdmin, async (req, res) => {
    // ... Copia la lógica de tu server.js original para crear material ...
    // Por brevedad, asumo que sabes copiar el INSERT INTO material...
    try {
        const { nombre_material, descripcion_material, umbral_minimo, cantidad, estado, categoria_id } = req.body;
        const [result] = await db.query(
          'INSERT INTO material (nombre_material, descripcion_material, umbral_minimo, cantidad, estado, categoria_id) VALUES (?, ?, ?, ?, ?, ?)',
          [nombre_material, descripcion_material, umbral_minimo, cantidad, estado, categoria_id]
        );
        res.status(201).json({ id: result.insertId, mensaje: 'Material creado' });
    } catch (e) { res.status(500).json({ error: 'Error creando material' }); }
});
// AGREGAR ESTO EN inventory.routes.js

router.put('/materiales/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_material, descripcion_material, umbral_minimo, cantidad, estado, categoria_id } = req.body;
    
    await db.query(
      'UPDATE material SET nombre_material = ?, descripcion_material = ?, umbral_minimo = ?, cantidad = ?, estado = ?, categoria_id = ? WHERE id_material = ?',
      [nombre_material, descripcion_material, umbral_minimo, cantidad, estado, categoria_id, id]
    );
    res.json({ mensaje: 'Material actualizado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar material' });
  }
});

router.delete('/materiales/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM material WHERE id_material = ?', [req.params.id]);
        res.json({ mensaje: 'Material eliminado' });
    } catch (e) { res.status(500).json({ error: 'Error eliminando material' }); }
});

// --- LÓGICA DE APROBACIÓN (TRANSACCIONES) ---

router.get('/asignaciones/pendientes', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const [solicitudes] = await db.query(
          `SELECT me.evento_id, me.material_id, me.cantidad_asignada, e.nombre_evento, m.nombre_material, m.cantidad as stock_actual
           FROM material_evento me
           JOIN evento e ON me.evento_id = e.id_evento
           JOIN material m ON me.material_id = m.id_material
           WHERE me.estado_devolucion = 'Pendiente' AND e.activo = 1
           ORDER BY e.fecha ASC`
        );
        res.json(solicitudes);
    } catch (e) { res.status(500).json({ error: 'Error obteniendo pendientes' }); }
});

router.post('/asignaciones/aprobar', authenticateToken, authorizeAdmin, async (req, res) => {
    const { evento_id, material_id, cantidad_asignada } = req.body;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Verificar stock actual antes de restar
        const [stockCheck] = await connection.query(
            'SELECT cantidad, umbral_minimo, nombre_material FROM material WHERE id_material = ? FOR UPDATE',
            [material_id]
        );

        if (stockCheck.length === 0) throw new Error('Material no encontrado');
        
        const { cantidad: stockActual, umbral_minimo, nombre_material } = stockCheck[0];

        if (stockActual < cantidad_asignada) {
            throw new Error(`Stock insuficiente. Quedan ${stockActual} unidades.`);
        }

        // 2. Restar el stock
        await connection.query(
            'UPDATE material SET cantidad = cantidad - ? WHERE id_material = ?',
            [cantidad_asignada, material_id]
        );

        // 3. Cambiar estado a "Asignado"
        await connection.query(
            'UPDATE material_evento SET estado_devolucion = "Asignado" WHERE evento_id = ? AND material_id = ?',
            [evento_id, material_id]
        );

        // 4. Registrar Movimiento en Historial (Salida)
        await connection.query(
            `INSERT INTO historial_movimiento (cantidad, fecha_movimiento, tipo_movimiento, observaciones, material_id, evento_id) 
             VALUES (?, NOW(), 'SALIDA', ?, ?, ?)`,
            [cantidad_asignada, `Asignación aprobada para evento`, material_id, evento_id]
        );

        // --- 🔔 NUEVA LÓGICA: ALERTA DE STOCK BAJO ---
        // Calculamos cuánto quedó después de la resta
        const stockRestante = stockActual - cantidad_asignada;

        // Si el stock restante es menor o igual al umbral... ¡Notificación!
        if (stockRestante <= umbral_minimo) {
            await connection.query(
                'INSERT INTO notificaciones (mensaje) VALUES (?)',
                [`⚠️ ALERTA STOCK: Quedan pocas unidades de ${nombre_material} (${stockRestante} restantes).`]
            );
        }
        // ---------------------------------------------

        await connection.commit();
        res.json({ mensaje: 'Solicitud aprobada y stock actualizado.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(error);
        res.status(500).json({ error: error.message || 'Error al aprobar solicitud' });
    } finally {
        if (connection) connection.release();
    }
});

router.post('/asignaciones/denegar', authenticateToken, authorizeAdmin, async (req, res) => {
    const { evento_id, material_id } = req.body;
    try {
        await db.query('DELETE FROM material_evento WHERE evento_id = ? AND material_id = ? AND estado_devolucion = "Pendiente"', [evento_id, material_id]);
        res.json({ mensaje: 'Solicitud denegada.' });
    } catch (e) { res.status(500).json({ error: 'Error al denegar' }); }
});

module.exports = router;