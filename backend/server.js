const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- ARCHIVOS ESTÁTICOS ---
// Sirve las fotos de perfil subidas
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Sirve el frontend (ajusta '../frontend' si tu carpeta se llama distinto)
app.use(express.static(path.join(__dirname, '../frontend'))); 

// --- RUTAS DE LA API (AQUÍ ESTÁ LA CLAVE) ---
// Conectamos los archivos de rutas que creaste en la carpeta 'routes'
app.use('/api/auth', require('./routes/auth.routes'));       // Login
app.use('/api/eventos', require('./routes/event.routes'));   // ¡AQUÍ ESTÁ EL ARREGLO! (Gestión de eventos y materiales)
app.use('/api', require('./routes/inventory.routes'));       // Inventario general
app.use('/api', require('./routes/admin.routes'));           // Usuarios y proveedores

// --- MANEJO DE ERRORES ---
// Si la ruta no existe, devolvemos un JSON claro
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint no encontrado. Verifica la URL o el método (GET/POST/PUT/DELETE).' });
});

// Arrancamos el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor MEKA corriendo en http://localhost:${PORT}`);
  console.log(`📁 Sirviendo frontend desde: ${path.join(__dirname, '../frontend')}`);
});