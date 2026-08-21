const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// --- EVENTOS (CRUD BÁSICO) ---


router.get('/', authenticateToken, async (req, res) => {
  try {
    const [eventos] = await db.query('SELECT * FROM evento WHERE activo = 1 ORDER BY fecha DESC');
    
    // AQUÍ ESTÁ EL CAMBIO: Agregamos "hora: evento.hora" al objeto
    const eventosParaCalendario = eventos.map(evento => ({
      id: evento.id_evento,
      title: evento.nombre_evento,
      start: evento.fecha + (evento.hora ? 'T' + evento.hora : ''),
      descripcion: evento.descripcion,
      notas_internas: evento.notas_internas,
      hora: evento.hora 
    }));
    
    res.json(eventosParaCalendario);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

router.post('/', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { nombre_evento, fecha, hora, descripcion, notas_internas, plantilla } = req.body;
    const [result] = await db.query(
      'INSERT INTO evento (nombre_evento, fecha, hora, descripcion, notas_internas, plantilla, activo) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [nombre_evento, fecha, hora, descripcion, notas_internas, plantilla]
    );
    res.status(201).json({ id: result.insertId, mensaje: 'Evento creado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

router.delete('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE evento SET activo = 0 WHERE id_evento = ?', [id]);
    res.json({ mensaje: 'Evento archivado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
});

// --- GESTIÓN DE MATERIALES ---

router.get('/:id/materiales', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [materiales] = await db.query(
      `SELECT m.id_material, m.nombre_material, me.cantidad_asignada, me.estado_devolucion
       FROM material_evento me
       INNER JOIN material m ON me.material_id = m.id_material
       WHERE me.evento_id = ?`, [id]
    );
    res.json(materiales);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener materiales' });
  }
});

router.post('/:id/materiales', authenticateToken, async (req, res) => {
  const { id: evento_id } = req.params;
  const { material_id, cantidad_asignada } = req.body;
  const cantidad = parseInt(cantidad_asignada);

  if (isNaN(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'Cantidad inválida' });

  try {
    const sqlQueryAsignacion = `
      INSERT INTO material_evento (material_id, evento_id, cantidad_asignada, estado_devolucion) 
      VALUES (?, ?, ?, 'Pendiente')
      ON DUPLICATE KEY UPDATE
        cantidad_asignada = cantidad_asignada + VALUES(cantidad_asignada),
        estado_devolucion = 'Pendiente'
    `;
    await db.query(sqlQueryAsignacion, [material_id, evento_id, cantidad]);
    
    // Notificar al admin de nueva solicitud
    const [info] = await db.query('SELECT nombre FROM usuario WHERE id_usuario = ?', [req.user.id]);
    const nombreTecnico = info[0]?.nombre || 'Un técnico';
    await db.query('INSERT INTO notificaciones (mensaje) VALUES (?)', [`${nombreTecnico} solicitó material para un evento.`]);

    res.status(201).json({ mensaje: 'Solicitud enviada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear solicitud' });
  }
});

// PUT: Modificar cantidad o Devolver material (Parcialmente)
router.put('/:id/materiales/:materialId', authenticateToken, async (req, res) => {
    const { id: evento_id, materialId: material_id } = req.params;
    const { nueva_cantidad } = req.body; 
    const cantidadNew = parseInt(nueva_cantidad);
    const usuario_id = req.user.id;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            `SELECT me.cantidad_asignada, me.estado_devolucion, m.nombre_material, u.nombre as nombre_tecnico
             FROM material_evento me
             JOIN material m ON me.material_id = m.id_material
             LEFT JOIN usuario u ON u.id_usuario = ?
             WHERE me.evento_id = ? AND me.material_id = ? FOR UPDATE`,
            [usuario_id, evento_id, material_id]
        );

        if (rows.length === 0) throw new Error('Material no encontrado en este evento');
        const { cantidad_asignada: cantidadDb, estado_devolucion: estadoDb, nombre_material, nombre_tecnico } = rows[0];

        if (estadoDb === 'Pendiente') {
            await connection.query(
                'UPDATE material_evento SET cantidad_asignada = ? WHERE evento_id = ? AND material_id = ?',
                [cantidadNew, evento_id, material_id]
            );
        } else if (estadoDb === 'Asignado') {
            if (cantidadNew > cantidadDb) throw new Error('No puedes aumentar material asignado.');

            const cantidadDevuelta = cantidadDb - cantidadNew;

            if (cantidadDevuelta > 0) {
                await connection.query('UPDATE material SET cantidad = cantidad + ? WHERE id_material = ?', [cantidadDevuelta, material_id]);
                await connection.query('UPDATE material_evento SET cantidad_asignada = ? WHERE evento_id = ? AND material_id = ?', [cantidadNew, evento_id, material_id]);

                // Historial
                await connection.query(
                    `INSERT INTO historial_movimiento (cantidad, fecha_movimiento, tipo_movimiento, observaciones, material_id, evento_id) 
                     VALUES (?, NOW(), 'ENTRADA', ?, ?, ?)`,
                    [cantidadDevuelta, `Devolución parcial por ${nombre_tecnico}`, material_id, evento_id]
                );

                // --- NOTIFICACIÓN AL ADMIN ---
                await connection.query(
                    'INSERT INTO notificaciones (mensaje) VALUES (?)', 
                    [`🔔 ${nombre_tecnico || 'Técnico'} devolvió ${cantidadDevuelta} unidades de ${nombre_material} (Parcial).`]
                );
            }
        }

        await connection.commit();
        res.json({ mensaje: 'Actualizado correctamente' });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE: Devolución TOTAL (Aquí arreglamos que se vea en la tabla Devueltos)
router.delete('/:id/materiales/:materialId', authenticateToken, async (req, res) => {
    const { id: evento_id, materialId: material_id } = req.params;
    const usuario_id = req.user.id;
    
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            `SELECT me.cantidad_asignada, me.estado_devolucion, m.nombre_material, u.nombre as nombre_tecnico
             FROM material_evento me
             JOIN material m ON me.material_id = m.id_material
             LEFT JOIN usuario u ON u.id_usuario = ?
             WHERE me.evento_id = ? AND me.material_id = ? FOR UPDATE`,
            [usuario_id, evento_id, material_id]
        );

        if (rows.length === 0) {
            await connection.commit();
            return res.json({ mensaje: 'Ya estaba eliminado' });
        }

        const { cantidad_asignada, estado_devolucion, nombre_material, nombre_tecnico } = rows[0];

        if (estado_devolucion === 'Pendiente') {
            await connection.query('DELETE FROM material_evento WHERE evento_id = ? AND material_id = ?', [evento_id, material_id]);
        } else if (estado_devolucion === 'Asignado') {
            // 1. Devolvemos al stock
            await connection.query('UPDATE material SET cantidad = cantidad + ? WHERE id_material = ?', [cantidad_asignada, material_id]);
            
            // 2. Marcamos como "Devuelto" PERO MANTENEMOS LA CANTIDAD para que se vea en la tabla
            await connection.query(
                'UPDATE material_evento SET estado_devolucion = "Devuelto" WHERE evento_id = ? AND material_id = ?', 
                [evento_id, material_id]
            );

            // 3. Historial
            await connection.query(
                `INSERT INTO historial_movimiento (cantidad, fecha_movimiento, tipo_movimiento, observaciones, material_id, evento_id) 
                 VALUES (?, NOW(), 'ENTRADA', ?, ?, ?)`,
                [cantidad_asignada, `Devolución TOTAL por ${nombre_tecnico}`, material_id, evento_id]
            );

            // --- NOTIFICACIÓN AL ADMIN ---
            await connection.query(
                'INSERT INTO notificaciones (mensaje) VALUES (?)', 
                [`✅ ${nombre_tecnico || 'Técnico'} devolvió toda/s la/s ${cantidad_asignada} unidades de ${nombre_material}.`]
            );
        }

        await connection.commit();
        res.json({ mensaje: 'Devolución procesada correctamente' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Error al procesar la baja' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
