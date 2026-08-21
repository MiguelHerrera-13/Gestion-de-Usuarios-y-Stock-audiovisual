// Detecta automáticamente si estás en localhost o en otro lado
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api'; // Asume que en producción el backend sirve el frontend en el mismo dominio