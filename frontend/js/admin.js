'use strict';

let adminCalendar = null;

document.addEventListener('DOMContentLoaded', function () {
    if (!checkAuth()) return;
    
    // Configuración inicial de UI
    const avatar = document.getElementById('user-avatar-sidebar');
    if(avatar) avatar.style.backgroundImage = `url(LOGOMEKA.png)`;

    const user = JSON.parse(localStorage.getItem('usuario'));

    // Configurar navegación y botones
    setupNavigation();
    
    const logoutBtnAdmin = document.getElementById('logout-button-admin');
    if (logoutBtnAdmin) logoutBtnAdmin.addEventListener('click', logout);
    
    setupModalControls();
    setupPhotoUploader();
    setupFormListeners();

    // Cargar la página inicial (Usuarios)
    document.querySelector('.nav-link[data-page="users"]').click();

    // --- CORRECCIÓN AQUÍ ---
    // Llamamos a la función GLOBAL que actualiza el sidebar y las tablas
    loadNotifications(); 
    
    // Y dejamos un intervalo para que siga buscando avisos cada 10 seg
    setInterval(loadNotifications, 10000); 
});

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page-content');
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetPage = this.getAttribute('data-page');

            navLinks.forEach(l => l.classList.remove('bg-primary/20', 'text-white'));
            this.classList.add('bg-primary/20', 'text-white');

            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(targetPage + '-page').classList.add('active');

            switch (targetPage) {
                case 'users': loadUsers(); break;
                case 'providers': loadProviders(); break;
                case 'stock':
                case 'materials': loadMaterials(); break;
                case 'calendar': loadCalendar(); break;
                case 'notifications': loadNotifications(); break;
            }
        });
    });
}

function setupModalControls() {
    document.querySelectorAll('.btn-cancel-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-backdrop').classList.remove('flex');
        });
    });
}

function setupFormListeners() {
    document.getElementById('btn-abrir-modal-add-user').addEventListener('click', () => openUserModal());
    document.getElementById('form-user').addEventListener('submit', handleUserSubmit);

    document.getElementById('btn-abrir-modal-add-provider').addEventListener('click', () => openProviderModal());
    document.getElementById('form-provider').addEventListener('submit', handleProviderSubmit);

    document.getElementById('btn-abrir-modal-add-material').addEventListener('click', () => openMaterialModal());
    document.getElementById('form-material').addEventListener('submit', handleMaterialSubmit);

    document.getElementById('btn-abrir-modal-add-evento').addEventListener('click', () => openEventoModal());
    document.getElementById('form-evento').addEventListener('submit', handleEventoSubmit);
}

async function loadUsers() {
    try {
        const response = await authenticatedFetch(`${API_URL}/usuarios`);
        const users = await response.json();

        const container = document.getElementById('user-grid-container');
        container.innerHTML = '';
        users.forEach(user => {
            const imageUrl = user.foto_perfil
                ? `${API_URL.replace('/api', '')}/uploads/profiles/${user.foto_perfil}?t=${new Date().getTime()}`
                : `https://avatar.vercel.sh/${user.email}.svg`;

            const card = document.createElement('div');
            card.className = 'group bg-card-dark p-4 rounded-lg text-center';
            card.innerHTML = `
        <img src="${imageUrl}" 
             class="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-transparent group-hover:border-primary transition-colors cursor-pointer profile-avatar"
             data-user-id="${user.id_usuario}">
        <p class="text-white font-bold">${user.nombre} ${user.apellido}</p>
        <p class="text-gray-400 text-sm">${user.nombre_rol}</p>
        <div class="mt-4 flex justify-center gap-2">
            <button onclick="editUser(${user.id_usuario})" class="p-2 rounded-full hover:bg-input-dark"><span class="material-symbols-outlined">edit</span></button>
            <button onclick="deleteUser(${user.id_usuario})" class="p-2 rounded-full hover:bg-input-dark"><span class="material-symbols-outlined text-red-400">delete</span></button>
        </div>
    `;
            container.appendChild(card);
        });
    } catch (error) {
        alert(error.message);
    }
}

async function openUserModal(user = null) {
    const modal = document.getElementById('modal-user');
    const form = document.getElementById('form-user');
    const title = document.getElementById('modal-user-title');
    form.reset();

    try {
        const response = await authenticatedFetch(`${API_URL}/roles`);
        const roles = await response.json();

        const rolSelect = form.querySelector('select[name="rol_id"]');
        rolSelect.innerHTML = roles.map(r => `<option value="${r.id_rol}">${r.nombre_rol}</option>`).join('');

        if (user) {
            title.textContent = 'Modificar Usuario';
            form.querySelector('input[name="id_usuario"]').value = user.id_usuario;
            form.querySelector('input[name="nombre"]').value = user.nombre;
            form.querySelector('input[name="apellido"]').value = user.apellido;
            form.querySelector('input[name="email"]').value = user.email;
            rolSelect.value = roles.find(r => r.nombre_rol === user.nombre_rol)?.id_rol || '';
            form.querySelector('input[name="password"]').placeholder = 'Nueva contraseña (opcional)';
        } else {
            title.textContent = 'Añadir Usuario';
            form.querySelector('input[name="id_usuario"]').value = '';
            form.querySelector('input[name="password"]').placeholder = 'Contraseña';
        }
        modal.classList.add('flex');

    } catch (error) {
        alert(error.message);
    }
}

async function handleUserSubmit(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());
    const id = data.id_usuario;
    let endpoint = '/usuarios';
    let method = 'POST';

    if (id) {
        endpoint += `/${id}`;
        method = 'PUT';
        if (!data.password) delete data.password;
    }

    try {
        await authenticatedFetch(API_URL + endpoint, { method, body: JSON.stringify(data) });
        alert(`Usuario ${id ? 'actualizado' : 'creado'} con éxito.`);
        document.getElementById('modal-user').classList.remove('flex');
        loadUsers();
    } catch (error) {
        alert(error.message);
    }
}

async function editUser(id) {
    try {
        const response = await authenticatedFetch(`${API_URL}/usuarios`);
        const users = await response.json();
        const user = users.find(u => u.id_usuario === id);
        if (user) openUserModal(user);
    } catch (error) {
        alert(error.message);
    }
}

async function deleteUser(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
        try {
            await authenticatedFetch(`${API_URL}/usuarios/${id}`, { method: 'DELETE' });
            alert('Usuario eliminado con éxito.');
            loadUsers();
        } catch (error) {
            alert(error.message);
        }
    }
}

function setupPhotoUploader() {
    const photoUploader = document.getElementById('photo-uploader');
    let currentUserIdForPhotoUpload = null;

    document.getElementById('user-grid-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('profile-avatar')) {
            currentUserIdForPhotoUpload = e.target.dataset.userId;
            photoUploader.click();
        }
    });

    photoUploader.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !currentUserIdForPhotoUpload) return;

        const formData = new FormData();
        formData.append('foto', file);
        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${API_URL}/usuarios/${currentUserIdForPhotoUpload}/foto`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al subir la imagen.');
            }

            alert('Foto de perfil actualizada con éxito.');
            setTimeout(loadUsers, 500);

        } catch (error) {
            alert(error.message);
        } finally {
            currentUserIdForPhotoUpload = null;
            e.target.value = '';
        }
    });
}
async function loadProviders() {
    try {
        const response = await authenticatedFetch(`${API_URL}/proveedores`);
        const providers = await response.json();

        const tbody = document.getElementById('providers-tbody');
        tbody.innerHTML = '';
        providers.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[#211c27]';
            tr.innerHTML = `
        <td class="px-6 py-4">${p.nombre_proveedor}</td>
        <td class="px-6 py-4 text-gray-400">${p.contacto || '-'}</td>
        <td class="px-6 py-4 text-gray-400">${p.telefono || '-'}</td>
        <td class="px-6 py-4 text-gray-400">${p.email || '-'}</td>
        <td class="px-6 py-4 text-right">
            <button onclick="editProvider(${p.id_proveedor})" class="p-2 rounded-full hover:bg-input-dark"><span class="material-symbols-outlined">edit</span></button>
            <button onclick="deleteProvider(${p.id_proveedor})" class="p-2 rounded-full hover:bg-input-dark"><span class="material-symbols-outlined text-red-400">delete</span></button>
        </td>
    `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        alert(error.message);
    }
}

function openProviderModal(provider = null) {
    const modal = document.getElementById('modal-provider');
    const form = document.getElementById('form-provider');
    const title = document.getElementById('modal-provider-title');
    form.reset();

    if (provider) {
        title.textContent = 'Modificar Proveedor';
        form.querySelector('input[name="id_proveedor"]').value = provider.id_proveedor;
        form.querySelector('input[name="nombre_proveedor"]').value = provider.nombre_proveedor;
        form.querySelector('input[name="contacto"]').value = provider.contacto;
        form.querySelector('input[name="telefono"]').value = provider.telefono;
        form.querySelector('input[name="email"]').value = provider.email;
        form.querySelector('textarea[name="observaciones"]').value = provider.observaciones;
    } else {
        title.textContent = 'Añadir Proveedor';
        form.querySelector('input[name="id_proveedor"]').value = '';
    }
    modal.classList.add('flex');
}

async function handleProviderSubmit(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());
    const id = data.id_proveedor;
    let endpoint = '/proveedores';
    let method = 'POST';
    if (id) {
        endpoint += `/${id}`;
        method = 'PUT';
    }
    try {
        await authenticatedFetch(API_URL + endpoint, { method, body: JSON.stringify(data) });
        alert(`Proveedor ${id ? 'actualizado' : 'creado'} con éxito.`);
        document.getElementById('modal-provider').classList.remove('flex');
        loadProviders();
    } catch (error) {
        alert(error.message);
    }
}

async function editProvider(id) {
    try {
        const response = await authenticatedFetch(`${API_URL}/proveedores`);
        const providers = await response.json();
        const provider = providers.find(p => p.id_proveedor === id);
        if (provider) openProviderModal(provider);
    } catch (error) {
        alert(error.message);
    }
}

async function deleteProvider(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
        try {
            await authenticatedFetch(`${API_URL}/proveedores/${id}`, { method: 'DELETE' });
            alert('Proveedor eliminado con éxito.');
            loadProviders();
        } catch (error) {
            alert(error.message);
        }
    }
}


async function loadMaterials() {
    try {
        const response = await authenticatedFetch(`${API_URL}/materiales`);
        const materials = await response.json();

        const container = document.getElementById('stock-grid-container');
        container.innerHTML = '';
        
        materials.forEach(m => {
            // --- AQUÍ ESTÁ EL CAMBIO DE COLORES ---
            let stockStatusClass = 'bg-green-500/20 text-green-400'; // Por defecto: Verde (Disponible)

            if (m.estado === 'Fuera de Servicio') {
                // Rojo si está roto
                stockStatusClass = 'bg-red-500/20 text-red-400';
            } else if (m.estado === 'En Mantenimiento') {
                // Amarillo si está en reparación
                stockStatusClass = 'bg-yellow-500/20 text-yellow-400';
            } else {
                // Si está "Disponible", miramos el stock
                if (m.cantidad === 0) {
                    stockStatusClass = 'bg-red-500/20 text-red-400'; // Sin stock
                } else if (m.cantidad <= m.umbral_minimo) {
                    stockStatusClass = 'bg-yellow-500/20 text-yellow-400'; // Stock bajo
                }
            }

            const card = document.createElement('div');
            card.className = 'bg-[#191022] rounded-lg p-4 border border-[#302839]';
            card.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <h3 class="text-white text-lg font-bold">${m.nombre_material}</h3>
            <span class="${stockStatusClass} text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider text-[10px]">${m.estado}</span>
        </div>
        <p class="text-gray-400 text-sm mb-4">${m.descripcion_material || 'Sin descripción'}</p>
        <div class="flex justify-between items-center">
            <span class="text-white font-medium">Cantidad: ${m.cantidad}</span>
            <div class="flex gap-2">
                <button onclick="editMaterial(${m.id_material})" class="p-1 rounded hover:bg-input-dark"><span class="material-symbols-outlined text-white text-sm">edit</span></button>
                <button onclick="deleteMaterial(${m.id_material})" class="p-1 rounded hover:bg-input-dark"><span class="material-symbols-outlined text-red-400 text-sm">delete</span></button>
            </div>
        </div>
    `;
            container.appendChild(card);
        });
    } catch (error) {
        alert(error.message);
    }
}


async function openMaterialModal(material = null) {
    const modal = document.getElementById('modal-material');
    const form = document.getElementById('form-material');
    const title = document.getElementById('modal-material-title');
    form.reset();

    const categoriaSelect = form.querySelector('select[name="categoria_id"]');
    try {
        const response = await authenticatedFetch(`${API_URL}/categorias`);
        const categorias = await response.json();

        if (categorias && categorias.length > 0) {
            categoriaSelect.innerHTML = categorias.map(c =>
                `<option value="${c.id_categoria}">${c.nombre_categoria}</option>`
            ).join('');
        } else {
            categoriaSelect.innerHTML = `<option value="">-- No hay categorías creadas --</option>`;
        }
    } catch (e) {
        console.warn("No se pudieron cargar categorías:", e);
        categoriaSelect.innerHTML = `<option value="">-- Error al cargar categorías --</option>`;
    }

    if (material) {
        title.textContent = 'Modificar Material';
        form.querySelector('input[name="id_material"]').value = material.id_material;
        form.querySelector('input[name="nombre_material"]').value = material.nombre_material;
        form.querySelector('textarea[name="descripcion_material"]').value = material.descripcion_material;
        form.querySelector('input[name="cantidad"]').value = material.cantidad;
        form.querySelector('input[name="umbral_minimo"]').value = material.umbral_minimo;
        form.querySelector('select[name="estado"]').value = material.estado;
        categoriaSelect.value = material.categoria_id;
    } else {
        title.textContent = 'Añadir Material';
        form.querySelector('input[name="id_material"]').value = '';
    }
    modal.classList.add('flex');
}

async function handleMaterialSubmit(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());
    const id = data.id_material;
    let endpoint = '/materiales';
    let method = 'POST';
    if (id) {
        endpoint += `/${id}`;
        method = 'PUT';
    }
    try {
        await authenticatedFetch(API_URL + endpoint, { method, body: JSON.stringify(data) });
        alert(`Material ${id ? 'actualizado' : 'creado'} con éxito.`);
        document.getElementById('modal-material').classList.remove('flex');
        loadMaterials();
    } catch (error) {
        alert(error.message);
    }
}

async function editMaterial(id) {
    try {
        const response = await authenticatedFetch(`${API_URL}/materiales`);
        const materials = await response.json();
        const material = materials.find(m => m.id_material === id);
        if (material) openMaterialModal(material);
    } catch (error) {
        alert(error.message);
    }
}

async function deleteMaterial(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este material?')) {
        try {
            await authenticatedFetch(`${API_URL}/materiales/${id}`, { method: 'DELETE' });
            alert('Material eliminado con éxito.');
            loadMaterials();
        } catch (error) {
            alert(error.message);
        }
    }
}

async function loadCalendar() {
    if (adminCalendar) {
        adminCalendar.updateSize();
        return;
    }

    const calendarEl = document.getElementById('admin-calendar');
    if (!calendarEl) return;

    adminCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek',
        },
        buttonText: {
            prev: "Ant",
            next: "Sig",
            today: "Hoy",
            month: "Mes",
            week: "Semana",
            day: "Día",
            list: "Agenda",
        },
        dayGridMonth: 'Dia',
        themeSystem: 'standard',
        height: 'auto',
        navLinks: true,
        editable: false,
        selectable: true,
        firstDay: 0,
        locale: 'esLocale',
        eventClick: function (info) {
            const evento = {
                id: info.event.id,
                title: info.event.title,
                start: info.event.start,
                ...info.event.extendedProps // Para traer descripción, hora, etc.
            };
            // Aseguramos que tenga el ID correcto para el formulario
            evento.id_evento = info.event.id;

            openEventoModal(evento);
        },

        events: async function (fetchInfo, successCallback, failureCallback) {
            try {
                const response = await authenticatedFetch(`${API_URL}/eventos?cacheBust=${new Date().getTime()}`);
                if (!response.ok) {
                    throw new Error('Respuesta de red no fue OK');
                }
                const eventos = await response.json();
                successCallback(eventos);
            } catch (error) {
                console.error('Error al cargar eventos del calendario:', error);
                failureCallback(error);
                alert('Error al cargar los eventos del calendario.');
            }
        }
    });

    adminCalendar.render();
}
function openEventoModal(evento = null) {
    const modal = document.getElementById('modal-evento');
    const form = document.getElementById('form-evento');
    const title = document.getElementById('modal-evento-title');
    const btnDelete = document.getElementById('btn-delete-evento');

    form.reset();

    if (evento) {
        title.textContent = 'Modificar Evento';
        form.querySelector('input[name="id_evento"]').value = evento.id_evento || evento.id;
        form.querySelector('input[name="nombre_evento"]').value = evento.nombre_evento || evento.title;
        
        // --- 1. RECUPERAR DESCRIPCIÓN Y NOTAS ---
        // FullCalendar guarda los campos extra en 'extendedProps'
        // Si viene directo del click, usa extendedProps. Si viene de otro lado, usa evento directo.
        const props = evento.extendedProps || evento;
        
        form.querySelector('textarea[name="descripcion"]').value = props.descripcion || '';
        form.querySelector('textarea[name="notas_internas"]').value = props.notas_internas || '';

        // --- 2. RECUPERAR FECHA (YYYY-MM-DD) ---
        // Intentamos usar la fecha cruda si existe, sino la extraemos del objeto Date
        let fechaISO = '';
        if (evento.start) {
            // FullCalendar convierte 'start' a objeto Date, lo pasamos a ISO
            const fechaObj = new Date(evento.start);
            // Ajustamos a local para que no cambie el día por la zona horaria
            const offset = fechaObj.getTimezoneOffset() * 60000;
            const localDate = new Date(fechaObj.getTime() - offset);
            fechaISO = localDate.toISOString().split('T')[0];
        } else if (evento.fecha) {
            fechaISO = evento.fecha;
        }
        form.querySelector('input[name="fecha"]').value = fechaISO;

        // --- 3. RECUPERAR HORA (HH:MM) ---
        // Aquí está la solución a tu problema
        // Buscamos 'hora' en el objeto principal o en extendedProps
        const horaRaw = props.hora || evento.hora; 
        
        if (horaRaw) {
            // Aseguramos formato HH:mm (a veces viene con segundos HH:mm:ss)
            form.querySelector('input[name="hora"]').value = horaRaw.substring(0, 5);
        }

        // Mostrar botón eliminar
        if (btnDelete) {
            btnDelete.classList.remove('hidden');
            btnDelete.onclick = () => deleteEvento(evento.id_evento || evento.id);
        }

    } else {
        // MODO CREAR (LIMPIO)
        title.textContent = 'Añadir Evento';
        form.querySelector('input[name="id_evento"]').value = '';
        if (btnDelete) btnDelete.classList.add('hidden');
    }
    
    modal.classList.add('flex');
}

async function handleEventoSubmit(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());
    const id = data.id_evento;

    if (data.hora === '') {
        data.hora = null;
    }

    let endpoint = '/eventos';
    let method = 'POST';
    if (id) {
        endpoint += `/${id}`;
        method = 'PUT';
    }

    try {
        const response = await authenticatedFetch(API_URL + endpoint, {
            method,
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error en el servidor');
        }

        alert(`Evento ${id ? 'actualizado' : 'creado'} con éxito.`);
        document.getElementById('modal-evento').classList.remove('flex');

        if (adminCalendar) {
            adminCalendar.refetchEvents();
        }

    } catch (error) {
        console.error('Error al guardar evento:', error);
        alert('Error al guardar evento: ' + error.message);
    }
}


async function loadNotifications() {
    // 1. CARGAR SOLICITUDES PENDIENTES
    try {
        const responseSolicitudes = await authenticatedFetch(`${API_URL}/asignaciones/pendientes`);
        if (responseSolicitudes.ok) {
            const solicitudes = await responseSolicitudes.json();
            const tbody = document.getElementById('notifications-tbody');

            // Verificamos si existe la tabla antes de intentar escribir (por seguridad)
            if (tbody) {
                tbody.innerHTML = '';

                if (solicitudes.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-400">No hay solicitudes pendientes.</td></tr>`;
                } else {
                    solicitudes.forEach(s => {
                        const tr = document.createElement('tr');
                        tr.className = 'hover:bg-[#211c27] transition-colors';
                        const stockInsuficiente = s.cantidad_asignada > s.stock_actual;
                        tr.innerHTML = `
                            <td class="px-6 py-4 text-white font-medium">${s.nombre_evento}</td>
                            <td class="px-6 py-4 text-gray-300">${s.nombre_material}</td>
                            <td class="px-6 py-4 font-bold ${stockInsuficiente ? 'text-red-400' : 'text-white'} text-lg">${s.cantidad_asignada}</td>
                            <td class="px-6 py-4 ${stockInsuficiente ? 'text-red-400' : 'text-gray-400'}">${s.stock_actual}</td>
                            <td class="px-6 py-4 text-right">
                                <div class="flex justify-end gap-2">
                                    <button onclick="aprobarSolicitud(${s.evento_id}, ${s.material_id}, ${s.cantidad_asignada})" 
                                            class="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors" title="Aprobar">
                                        <span class="material-symbols-outlined">check</span>
                                    </button>
                                    <button onclick="denegarSolicitud(${s.evento_id}, ${s.material_id})" 
                                            class="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Denegar">
                                        <span class="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }
        }
    } catch (e) { console.error("Error cargando solicitudes:", e); }

    // 2. CARGAR HISTORIAL DE AVISOS (Devoluciones)
    try {
        const responseNotif = await authenticatedFetch(`${API_URL}/notificaciones`);
        if (responseNotif.ok) {
            const notificaciones = await responseNotif.json();
            const tbodyHistory = document.getElementById('history-notifications-tbody');
            const badge = document.getElementById('sidebar-notif-badge');

            if (tbodyHistory) {
                tbodyHistory.innerHTML = '';

                if (notificaciones.length > 0) {
                    // MOSTRAR PUNTITO ROJO
                    if (badge) badge.classList.remove('hidden');

                    notificaciones.forEach(n => {
                        const tr = document.createElement('tr');
                        // Si no está leída, fondo un poco más claro. Si está leída, más transparente.
                        tr.className = n.leido
                            ? 'bg-transparent text-gray-500'
                            : 'bg-[#2c2839]/50 text-white border-l-2 border-primary';

                        let icono = 'notifications';
                        let color = 'text-gray-400';

                        // Iconos dinámicos según el mensaje
                        if (n.mensaje.toLowerCase().includes('devolvió')) {
                            icono = 'keyboard_return';
                            color = 'text-green-400';
                        } else if (n.mensaje.toLowerCase().includes('solicitó')) {
                            icono = 'add_shopping_cart';
                            color = 'text-blue-400';
                        }

                        tr.innerHTML = `
                            <td class="px-6 py-4">
                                <div class="flex items-start gap-3">
                                    <span class="material-symbols-outlined ${color} mt-0.5">${icono}</span>
                                    <div>
                                        <p class="text-sm font-medium">${n.mensaje}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-4 text-right text-xs opacity-70 whitespace-nowrap">
                                ${new Date(n.fecha).toLocaleString()}
                            </td>
                            <td class="px-6 py-4 text-right">
                                 ${!n.leido ? `
                                    <button onclick="marcarLeida(${n.id_notificacion})" 
                                            class="text-xs font-bold text-primary hover:text-white border border-primary hover:bg-primary px-3 py-1 rounded transition-colors">
                                        Marcar leído
                                    </button>`
                                : '<span class="text-xs text-gray-600 italic">Leído</span>'}
                            </td>
                        `;
                        tbodyHistory.appendChild(tr);
                    });
                } else {
                    // OCULTAR PUNTITO ROJO si no hay nada
                    if (badge) badge.classList.add('hidden');
                    tbodyHistory.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-gray-500 italic">Sin novedades recientes.</td></tr>`;
                }
            }
        }
    } catch (e) { console.error("Error cargando notificaciones:", e); }
}

async function marcarLeida(id) {
    try {
        await authenticatedFetch(`${API_URL}/notificaciones/${id}/leer`, { method: 'PUT' });
        loadNotifications(); // Recargar para actualizar vista
    } catch (error) { console.error(error); }
}

async function marcarTodasLeidas() {
    // Opción rápida: recargar la página o implementar endpoint masivo
    // Por simplicidad en este paso, hacemos un loop (idealmente sería 1 endpoint)
    const btns = document.querySelectorAll('#history-notifications-tbody button');
    btns.forEach(b => b.click());
}
async function aprobarSolicitud(evento_id, material_id, cantidad_asignada) {
    if (!confirm(`¿Aprobar ${cantidad_asignada} de este material?\nEsta acción restará el stock.`)) return;

    try {
        const response = await authenticatedFetch(`${API_URL}/asignaciones/aprobar`, {
            method: 'POST',
            body: JSON.stringify({ evento_id, material_id, cantidad_asignada })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        alert(result.mensaje);
        loadNotifications();

    } catch (error) {
        alert('Error al aprobar: ' + error.message);
    }
}

async function denegarSolicitud(evento_id, material_id) {
    if (!confirm('¿Denegar esta solicitud?\nLa solicitud será eliminada.')) return;

    try {
        const response = await authenticatedFetch(`${API_URL}/asignaciones/denegar`, {
            method: 'POST',
            body: JSON.stringify({ evento_id, material_id })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        alert(result.mensaje);
        loadNotifications();

    } catch (error) {
        alert('Error al denegar: ' + error.message);
    }
}
async function deleteEvento(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este evento?')) return;

    try {
        const response = await authenticatedFetch(`${API_URL}/eventos/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Error al eliminar el evento');

        alert('Evento eliminado correctamente.');
        document.getElementById('modal-evento').classList.remove('flex');

        if (adminCalendar) adminCalendar.refetchEvents();

    } catch (error) {
        console.error(error);
        alert('Error: ' + error.message);
    }
}