let tecnicoCalendar = null; 
let eventoSeleccionado = null; 
let allEventos = []; 
let materialSeleccionadoParaAsignar = null;
let filtroEstadoActual = 'All'; 

document.addEventListener('DOMContentLoaded', async function () {
  if (!checkAuth()) return;

  const usuario = JSON.parse(localStorage.getItem('usuario'));

  if (usuario.rol !== 'Tecnico' && usuario.rol !== 'Admin') {
    alert('No tienes permisos para acceder a esta página');
    logout();
    return;
  }

  setupTecnicoNavigation();
  const logoutBtnTecnico = document.getElementById('logout-button-tecnico');
  if (logoutBtnTecnico) {
      logoutBtnTecnico.addEventListener('click', logout);
  }
  await cargarEventos();
  configurarBusqueda(); 
  configurarFiltros(); 

  const btnAbrirModalAsignar = document.querySelector('#btn-abrir-modal-asignar');
  if (btnAbrirModalAsignar) {
    btnAbrirModalAsignar.addEventListener('click', openAsignarModal);
  }

  document.getElementById('btn-cancelar-modal-asignar').addEventListener('click', () => {
    cerrarModal('modal-asignar-material');
  });

  document.getElementById('form-asignar-material').addEventListener('submit', handleAsignarSubmit);

  document.getElementById('modal-search-material').addEventListener('input', filtrarMaterialesModal);
});

// --- FUNCIONES AUXILIARES DE MODAL (FIX VISIBILIDAD) ---
function abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function cerrarModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function setupTecnicoNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const pages = document.querySelectorAll('.page-content');

  navLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const targetPage = this.getAttribute('data-page');

      navLinks.forEach(l => l.classList.remove('bg-primary/20', 'text-white'));
      this.classList.add('bg-primary/20', 'text-white');

      pages.forEach(page => page.classList.remove('active'));
      const targetElement = document.getElementById(targetPage + '-page');
      if (targetElement) {
        targetElement.classList.add('active');
      }

      if (targetPage === 'event-calendar') {
        inicializarCalendario();
      }
    });
  });

  const initialLink = document.querySelector('.nav-link[data-page="event-materials"]');
  if (initialLink) {
    initialLink.classList.add('bg-primary/20', 'text-white');
  }
}

async function cargarEventos() {
  try {
    const response = await authenticatedFetch(`${API_URL}/eventos`);
    allEventos = await response.json();

    mostrarEventosTabs(allEventos);

    if (allEventos.length > 0) {
      eventoSeleccionado = allEventos[0].id;
      await cargarMaterialesEvento(eventoSeleccionado);
    } else {
      mostrarMaterialesTabla([]);
    }

  } catch (error) {
    console.error('Error al cargar eventos:', error);
  }
}

function mostrarEventosTabs(eventos) {
  const tabsContainer = document.querySelector('#event-materials-page .border-b nav');
  if (!tabsContainer) return;

  if (!eventos || eventos.length === 0) {
    tabsContainer.innerHTML = '<p class="text-white/60 p-4">No hay eventos programados.</p>';
    return;
  }

  tabsContainer.innerHTML = eventos.map((evento, index) => `
        <a class="flex flex-col items-center justify-center cursor-pointer border-b-[3px] ${index === 0 ? 'border-b-primary text-white' : 'border-b-transparent text-[#a49db9]'} pb-[13px] pt-4 hover:border-b-primary/50 hover:text-white"
            data-evento-id="${evento.id}">
            <p class="text-sm font-bold leading-normal tracking-[0.015em]">${evento.title}</p>
        </a>
    `).join('');

  tabsContainer.querySelectorAll('a').forEach((tab) => {
    tab.addEventListener('click', async (e) => {
      e.preventDefault();
      tabsContainer.querySelectorAll('a').forEach(t => {
        t.classList.remove('border-b-primary', 'text-white');
        t.classList.add('border-b-transparent', 'text-[#a49db9]');
      });
      tab.classList.add('border-b-primary', 'text-white');
      tab.classList.remove('border-b-transparent', 'text-[#a49db9]');

      eventoSeleccionado = tab.dataset.eventoId;
      await cargarMaterialesEvento(eventoSeleccionado);
    });
  });
}

function inicializarCalendario() {
  const calendarEl = document.getElementById('tecnico-calendar');
  if (!calendarEl) return;

  if (!tecnicoCalendar) {
    tecnicoCalendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listWeek'
      },
      buttonText: { prev: "Ant", next: "Sig", today: "Hoy", month: "Mes", week: "Semana", day: "Día", list: "Agenda" },
      themeSystem: 'standard',
      height: 'auto',
      navLinks: true,
      editable: false,
      selectable: false,
      events: allEventos
    });
    tecnicoCalendar.render();
  } else {
    tecnicoCalendar.updateSize();
  }
}

async function cargarMaterialesEvento(eventoId) {
  if (!eventoId) return;
  try {
    const response = await authenticatedFetch(`${API_URL}/eventos/${eventoId}/materiales`);
    const materiales = await response.json();
    mostrarMaterialesTabla(materiales);
  } catch (error) {
    console.error('Error al cargar materiales del evento:', error);
  }
}

function mostrarMaterialesTabla(materiales) {
    const tbody = document.querySelector('#event-materials-page tbody');
    tbody.innerHTML = '';

    if (!materiales || materiales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-400">No hay materiales asignados a este evento.</td></tr>';
        return;
    }

    materiales.forEach(material => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-[#302839] hover:bg-[#2c2839] transition-colors';
        
        let estadoClass = 'text-gray-400'; 
        if (material.estado_devolucion === 'Asignado') estadoClass = 'text-blue-400 font-bold';
        if (material.estado_devolucion === 'Devuelto') estadoClass = 'text-green-400 font-bold';
        if (material.estado_devolucion === 'Pendiente') estadoClass = 'text-yellow-400 font-bold';

        // FIX: Escapamos las comillas simples en el nombre del material para que no rompa el onclick
        const nombreSafe = material.nombre_material.replace(/'/g, "\\'");

        tr.innerHTML = `
            <td class="p-4 text-white font-medium">${material.nombre_material}</td>
            <td class="p-4 text-center text-white text-lg">${material.cantidad_asignada}</td>
            <td class="p-4 text-center">
                <span class="${estadoClass}">${material.estado_devolucion}</span>
            </td>
            <td class="p-4 text-right">
                <button 
                    onclick="abrirModalEdicion(${material.id_material}, '${nombreSafe}', ${material.cantidad_asignada}, '${material.estado_devolucion}')"
                    class="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                    title="Gestionar Material">
                    <span class="material-symbols-outlined">edit</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    aplicarFiltros(); 
}

async function openAsignarModal() {
  if (!eventoSeleccionado) {
    alert('Por favor, selecciona un evento primero.');
    return;
  }
  const listContainer = document.getElementById('modal-material-list');
  listContainer.innerHTML = '<p class="text-gray-400">Cargando materiales...</p>';
  document.getElementById('modal-selected-material-name').textContent = '-- Ninguno --';
  document.getElementById('form-asignar-material').reset();
  materialSeleccionadoParaAsignar = null;
  
  abrirModal('modal-asignar-material'); // Usamos la nueva función

  try {
    const response = await authenticatedFetch(`${API_URL}/materiales`);
    if (!response.ok) throw new Error('No se pudo cargar el stock');
    const materiales = await response.json();
    popularListaMateriales(materiales);
  } catch (error) {
    console.error('Error al cargar stock:', error);
    listContainer.innerHTML = `<p class="text-red-400">Error al cargar materiales: ${error.message}</p>`;
  }
}

function popularListaMateriales(materiales) {
  const listContainer = document.getElementById('modal-material-list');
  
  if (materiales.length === 0) {
    listContainer.innerHTML = '<p class="text-gray-400">No hay materiales en el stock.</p>';
    return;
  }

  listContainer.innerHTML = materiales.map(m => {
    let estadoEtiqueta = '';
    let claseStock = 'text-green-400';

    if (m.estado === 'Fuera de Servicio') {
        estadoEtiqueta = '<span class="ml-2 text-xs font-bold text-red-500 uppercase border border-red-500 px-1 rounded">FUERA DE SERVICIO</span>';
        claseStock = 'text-red-500';
    } else if (m.estado === 'En Mantenimiento') {
        estadoEtiqueta = '<span class="ml-2 text-xs font-bold text-yellow-400 uppercase border border-yellow-400 px-1 rounded">MANTENIMIENTO</span>';
        claseStock = 'text-yellow-400';
    } else if (m.cantidad <= m.umbral_minimo) {
        claseStock = 'text-yellow-400';
    }

    return `
    <div class="material-item p-3 rounded-lg flex justify-between cursor-pointer hover:bg-input-dark border border-transparent transition-all" 
         data-id-material="${m.id_material}" 
         data-nombre-material="${m.nombre_material}"
         data-estado="${m.estado}"> <div>
        <p class="font-bold text-white flex items-center">
            ${m.nombre_material}
            ${estadoEtiqueta}
        </p>
        <p class="text-sm text-gray-400">${m.descripcion_material || 'Sin descripción'}</p>
      </div>
      <div class="text-right">
         <p class="text-sm text-gray-300">Stock:</p>
         <p class="font-bold text-lg ${claseStock}">
           ${m.cantidad}
         </p>
      </div>
    </div>
  `}).join('');

  listContainer.querySelectorAll('.material-item').forEach(item => {
    item.addEventListener('click', () => {
      const estado = item.dataset.estado;
      if (estado === 'Fuera de Servicio' || estado === 'En Mantenimiento') {
        alert('Este material no está disponible para asignación.');
        return; 
      }
      listContainer.querySelectorAll('.material-item').forEach(i => {
          i.classList.remove('selected', 'bg-primary/20', 'border-primary');
          i.classList.add('border-transparent');
      });
      item.classList.remove('border-transparent');
      item.classList.add('selected', 'bg-primary/20', 'border-primary');
      materialSeleccionadoParaAsignar = item.dataset.idMaterial;
      document.getElementById('modal-selected-material-name').textContent = item.dataset.nombreMaterial;
    });
  });
}

function filtrarMaterialesModal() {
  const searchTerm = document.getElementById('modal-search-material').value.toLowerCase();
  const items = document.querySelectorAll('#modal-material-list .material-item');
  items.forEach(item => {
    const nombre = item.dataset.nombreMaterial.toLowerCase();
    item.style.display = nombre.includes(searchTerm) ? 'flex' : 'none';
  });
}

async function handleAsignarSubmit(e) {
  e.preventDefault();
  const cantidad = e.target.querySelector('input[name="cantidad_asignada"]').value;
  if (!materialSeleccionadoParaAsignar) { alert('Debes seleccionar un material.'); return; }
  if (!cantidad || parseInt(cantidad) <= 0) { alert('Cantidad inválida.'); return; }

  try {
    const response = await authenticatedFetch(`${API_URL}/eventos/${eventoSeleccionado}/materiales`, {
      method: 'POST',
      body: JSON.stringify({
        material_id: parseInt(materialSeleccionadoParaAsignar),
        cantidad_asignada: parseInt(cantidad)
      })
    });
    const result = await response.json();
    if (response.ok) {
      alert('Solicitud enviada para aprobación.');
      cerrarModal('modal-asignar-material');
      await cargarMaterialesEvento(eventoSeleccionado);
    } else { throw new Error(result.error); }
  } catch (error) { alert('Error: ' + error.message); }
}

// --- MODAL DE EDICIÓN ---

function abrirModalEdicion(materialId, nombreMaterial, cantidadActual, estadoActual) {
    const form = document.getElementById('form-editar-cantidad');
    
    document.getElementById('modal-edit-material-name').textContent = nombreMaterial;
    form.querySelector('input[name="material_id"]').value = materialId;
    form.querySelector('input[name="cantidad_actual"]').value = cantidadActual;
    form.querySelector('input[name="estado_actual"]').value = estadoActual;
    
    const inputCantidad = form.querySelector('input[name="nueva_cantidad"]');
    const selectAccion = document.getElementById('accion-select');

    if (estadoActual === 'Pendiente') {
        selectAccion.value = 'modificar';
        selectAccion.disabled = true; 
        inputCantidad.value = cantidadActual;
        inputCantidad.placeholder = "Nueva cantidad solicitada";
    } else {
        selectAccion.disabled = false;
        selectAccion.value = 'devolver';
        inputCantidad.value = '';
        inputCantidad.placeholder = "Cantidad a devolver";
    }

    abrirModal('modal-editar-cantidad'); // Usamos la nueva función que quita el hidden
}

document.getElementById('form-editar-cantidad').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const materialId = formData.get('material_id');
    const cantidadActual = parseInt(formData.get('cantidad_actual'));
    const estadoActual = formData.get('estado_actual');
    const accion = document.getElementById('accion-select').value;
    let inputValor = parseInt(formData.get('nueva_cantidad'));

    if (isNaN(inputValor) || inputValor < 0) { alert("Número inválido"); return; }

    try {
        if (estadoActual === 'Pendiente') {
            if (inputValor === 0) {
                await eliminarMaterialAsignado(materialId, '', cantidadActual, estadoActual, true); 
            } else {
                await enviarActualizacion(materialId, inputValor, cantidadActual, estadoActual);
            }
        } 
        else {
            if (accion === 'devolver') {
                if (inputValor > cantidadActual) { alert("No puedes devolver más de lo asignado."); return; }
                const nuevaCantidadAsignada = cantidadActual - inputValor;
                if (nuevaCantidadAsignada === 0) {
                    await eliminarMaterialAsignado(materialId, '', cantidadActual, estadoActual, true);
                } else {
                    await enviarActualizacion(materialId, nuevaCantidadAsignada, cantidadActual, estadoActual);
                }
            } else {
                await enviarActualizacion(materialId, inputValor, cantidadActual, estadoActual);
            }
        }
        cerrarModal('modal-editar-cantidad');
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
});

async function enviarActualizacion(materialId, nuevaCantidad, cantidadActual, estadoActual) {
    const response = await authenticatedFetch(`${API_URL}/eventos/${eventoSeleccionado}/materiales/${materialId}`, {
        method: 'PUT',
        body: JSON.stringify({
            nueva_cantidad: nuevaCantidad,
            cantidad_actual: cantidadActual,
            estado_actual: estadoActual 
        })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    alert('Actualizado correctamente');
    await cargarMaterialesEvento(eventoSeleccionado);
}

// FIX: Agregado el parámetro skipConfirm para que funcione cuando se llama desde el modal
async function eliminarMaterialAsignado(materialId, nombreMaterial, cantidadActual, estadoActual, skipConfirm = false) {
  if (!skipConfirm) {
      let confirmMessage = `¿Estás seguro de que quieres eliminar la solicitud de "${nombreMaterial}"?`;
      if (estadoActual === 'Asignado' || estadoActual === 'Devuelto') {
        confirmMessage = `¿Estás seguro de que quieres eliminar TODAS las ${cantidadActual} unidades de "${nombreMaterial}"?\n\nEsta acción devolverá ${cantidadActual} al stock general.`
      }
      if (!confirm(confirmMessage)) return;
  }

  try {
    const response = await authenticatedFetch(`${API_URL}/eventos/${eventoSeleccionado}/materiales/${materialId}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (!skipConfirm) alert(result.mensaje || 'Material eliminado.'); // Solo mostramos alerta si fue manual
    await cargarMaterialesEvento(eventoSeleccionado);
  } catch (error) {
    console.error('Error al eliminar:', error);
    alert('Error: ' + error.message);
  }
}

function configurarBusqueda() {
  const searchInput = document.querySelector('#event-materials-page input[placeholder*="Buscar Materiales"]');
  if (searchInput) searchInput.addEventListener('input', aplicarFiltros);
}

function configurarFiltros() {
  const botonesFiltro = [
    { id: 'btn-filter-all', estado: 'All' },
    { id: 'btn-filter-stock', estado: 'Pendiente' },
    { id: 'btn-filter-assigned', estado: 'Asignado' },
    { id: 'btn-filter-returned', estado: 'Devuelto' }
  ];

  botonesFiltro.forEach(btnInfo => {
    const boton = document.getElementById(btnInfo.id);
    if (boton) {
      boton.addEventListener('click', () => {
        filtroEstadoActual = btnInfo.estado;
        document.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.remove('bg-primary', 'text-white');
          b.classList.add('bg-[#2c2839]', 'hover:bg-primary/30');
        });
        boton.classList.add('bg-primary', 'text-white');
        boton.classList.remove('bg-[#2c2839]', 'hover:bg-primary/30');
        aplicarFiltros();
      });
    }
  });
  document.getElementById('btn-filter-all')?.click();
}

function aplicarFiltros() {
  const searchInput = document.querySelector('#event-materials-page input[placeholder*="Buscar Materiales"]');
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  const filas = document.querySelectorAll('#event-materials-page tbody tr');

  filas.forEach(fila => {
    if (fila.querySelector('td[colspan="4"]')) {
      fila.style.display = ''; return;
    }
    const nombre = fila.querySelector('td:first-child')?.textContent.toLowerCase();
    const coincideBusqueda = nombre && nombre.includes(searchTerm);
    let coincideEstado = false;
    if (filtroEstadoActual === 'All') {
      coincideEstado = true;
    } else {
      const estado = fila.querySelector('td:nth-child(3) span')?.textContent.trim();
      coincideEstado = (estado === filtroEstadoActual);
    }
    fila.style.display = (coincideBusqueda && coincideEstado) ? '' : 'none';
  });
}
