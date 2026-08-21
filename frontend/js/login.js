async function login(email, password) {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al iniciar sesión');
    }

    // Guardamos el token (necesario)
    localStorage.setItem('token', data.token);

    // Guardamos SOLO lo necesario del usuario, no todo el objeto que podría traer password hash por error
    const userSafeInfo = {
      id: data.usuario.id_usuario || data.usuario.id, // Asegurar compatibilidad de nombres
      nombre: data.usuario.nombre,
      rol: data.usuario.rol,
      // No guardamos email ni mucho menos password
    };
    localStorage.setItem('usuario', JSON.stringify(userSafeInfo));

    if (data.usuario.rol === 'Admin') {
      window.location.href = 'admin.html';
    } else if (data.usuario.rol === 'Tecnico') {
      window.location.href = 'tecnicos.html';
    } else {
      window.location.href = 'dashboard.html';
    }

    return data;
  } catch (error) {
    console.error('Error en login:', error);
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
      errorMessage.textContent = error.message;
      errorMessage.style.display = 'block';
    }
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email-input');
  const passwordInput = document.getElementById('password-input');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        alert('Por favor ingrese email y contraseña');
        return;
      }

      try {
        await login(email, password);
      } catch (error) {
        console.log("Intento de login fallido.");
      }
    });
  }

  const togglePasswordButton = document.querySelector('button[aria-label="Toggle password visibility"]');

  if (togglePasswordButton && passwordInput) {
    const visibilityIcon = togglePasswordButton.querySelector('.material-symbols-outlined');

    togglePasswordButton.addEventListener('click', () => {
      event.preventDefault();

      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      visibilityIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
  }

});

function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'index.html';
}

async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = 'index.html';
    throw new Error('No hay token de autenticación');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 || response.status === 403) {
      logout();
      throw new Error('Sesión expirada');
    }

    return response;
  } catch (error) {
    console.error('Error en request:', error);
    throw error;
  }
}