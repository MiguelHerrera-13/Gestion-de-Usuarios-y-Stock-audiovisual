const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const transporter = require('../config/mailer');

// --- USUARIOS ---

router.get('/usuarios', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const [usuarios] = await db.query(
      `SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.foto_perfil, r.nombre_rol
       FROM usuario u
       INNER JOIN roles r ON u.rol_id = r.id_rol`
    );
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/usuarios', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol_id } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await db.query(
      'INSERT INTO usuario (nombre, apellido, email, password, rol_id) VALUES (?, ?, ?, ?, ?)',
      [nombre, apellido, email, hashedPassword, rol_id]
    );

    // Enviar correo (usando el transporter de config/mailer.js)
    const mailOptions = {
        from: `"Sistema MEKA" <${process.env.MAIL_USER}>`,
        to: email,
        subject: 'Bienvenido al equipo MEKA - Credenciales de Acceso',
        html: `
            <div style="font-family: Arial, sans-serif;">
                <h1>¡Bienvenido/a ${nombre}!</h1>
                <p>Usuario: ${email}</p>
                <p>Contraseña: ${password}</p>
                <small>Por seguridad, cambia tu contraseña al ingresar.</small>
            </div>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.error('Error enviando correo:', error);
    });

    res.status(201).json({ id: result.insertId, mensaje: 'Usuario creado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// backend/routes/admin.routes.js (o donde tengas la ruta PUT /usuarios/:id)

// En backend/routes/admin.routes.js (o donde manejes usuarios)

router.put('/usuarios/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    // Extraemos password aparte del resto de datos
    const { password, ...restoDeDatos } = req.body; 

    try {
        // 1. SI HAY CONTRASEÑA, LA ENCRIPTAMOS
        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Actualizamos TODO, incluyendo contraseña
            await db.query(
                'UPDATE usuario SET nombre=?, apellido=?, email=?, rol_id=?, password=?, foto_perfil=? WHERE id_usuario=?',
                [restoDeDatos.nombre, restoDeDatos.apellido, restoDeDatos.email, restoDeDatos.rol_id, hashedPassword, restoDeDatos.foto_perfil, id]
            );
        } 
        // 2. SI NO HAY CONTRASEÑA (El campo vino vacío), NO TOCAMOS LA COLUMNA PASSWORD
        else {
            await db.query(
                'UPDATE usuario SET nombre=?, apellido=?, email=?, rol_id=?, foto_perfil=? WHERE id_usuario=?',
                [restoDeDatos.nombre, restoDeDatos.apellido, restoDeDatos.email, restoDeDatos.rol_id, restoDeDatos.foto_perfil, id]
            );
        }

        res.json({ mensaje: 'Usuario actualizado correctamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

router.delete('/usuarios/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM usuario WHERE id_usuario = ?', [req.params.id]);
    res.json({ mensaje: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Ruta para subir foto (usa el middleware upload que creamos antes)
// Nota: Necesitamos importar upload si vamos a usarlo aquí.
const upload = require('../middleware/upload');

router.put('/usuarios/:id/foto', authenticateToken, authorizeAdmin, upload.single('foto'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) return res.status(400).json({ error: 'No se ha subido archivo.' });
        
        const foto_perfil = req.file.filename;
        await db.query('UPDATE usuario SET foto_perfil = ? WHERE id_usuario = ?', [foto_perfil, id]);
        
        res.json({ 
            mensaje: 'Foto actualizada',
            filePath: `/uploads/profiles/${foto_perfil}` 
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar foto' });
    }
});

// --- PROVEEDORES ---

router.get('/proveedores', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const [proveedores] = await db.query('SELECT * FROM proveedor');
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

router.post('/proveedores', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { nombre_proveedor, contacto, telefono, email, observaciones } = req.body;
    const [result] = await db.query(
      'INSERT INTO proveedor (nombre_proveedor, contacto, telefono, email, observaciones) VALUES (?, ?, ?, ?, ?)',
      [nombre_proveedor, contacto, telefono, email, observaciones]
    );
    res.status(201).json({ id: result.insertId, mensaje: 'Proveedor creado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

router.put('/proveedores/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
      const { id } = req.params;
      const { nombre_proveedor, contacto, telefono, email, observaciones } = req.body;
      await db.query(
        'UPDATE proveedor SET nombre_proveedor = ?, contacto = ?, telefono = ?, email = ?, observaciones = ? WHERE id_proveedor = ?',
        [nombre_proveedor, contacto, telefono, email, observaciones, id]
      );
      res.json({ mensaje: 'Proveedor actualizado' });
  } catch (e) { res.status(500).json({ error: 'Error actualizando proveedor' }); }
});

router.delete('/proveedores/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM proveedor WHERE id_proveedor = ?', [req.params.id]);
        res.json({ mensaje: 'Proveedor eliminado' });
    } catch (e) { res.status(500).json({ error: 'Error eliminando proveedor' }); }
});

// --- ROLES y CATEGORIAS ---

router.get('/roles', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const [roles] = await db.query('SELECT * FROM roles');
    res.json(roles);
  } catch (error) { res.status(500).json({ error: 'Error obteniendo roles' }); }
});

router.get('/categorias', authenticateToken, async (req, res) => {
  try {
    const [categorias] = await db.query('SELECT * FROM categoria_material');
    res.json(categorias);
  } catch (error) { res.status(500).json({ error: 'Error obteniendo categorías' }); }
});

// --- NOTIFICACIONES ---

router.get('/notificaciones', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const [notif] = await db.query('SELECT * FROM notificaciones WHERE leido = 0 ORDER BY fecha DESC LIMIT 10');
        res.json(notif);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener notificaciones' });
    }
});

router.put('/notificaciones/:id/leer', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        await db.query('UPDATE notificaciones SET leido = 1 WHERE id_notificacion = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al marcar como leído' });
    }
});

module.exports = router;