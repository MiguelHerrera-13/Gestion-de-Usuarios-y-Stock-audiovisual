const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');


router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [usuarios] = await db.query(
      `SELECT u.*, r.nombre_rol 
       FROM usuario u 
       INNER JOIN roles r ON u.rol_id = r.id_rol 
       WHERE u.email = ?`,
      [email]
    );
    if (usuarios.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

    const usuario = usuarios[0];
    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: usuario.id_usuario, email: usuario.email, rol: usuario.nombre_rol },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.nombre_rol
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

module.exports = router;