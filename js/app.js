import { DataLayer } from './dataLayer.js';
import { SecurityService } from './security.js';
import { AuthService } from './authService.js';

// 1. Exponer servicios a 'window' para que los onclick/onsubmit del HTML los reconozcan
window.AuthService = AuthService;
window.DataLayer = DataLayer;
window.SecurityService = SecurityService;

// 2. Control de Alertas Visuales
window.showAlert = function(message, type = 'error') {
    const alertBox = document.getElementById('global-alert');
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.innerText = message;
    alertBox.style.display = 'block';

    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 4500);
};

// 3. Renderizado de Perfil de Usuario Estándar
window.renderUserProfile = function() {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) return;

    const elTipoDoc = document.getElementById('user-profile-tipo-doc');
    const elCedula = document.getElementById('user-profile-cedula');
    const elNombre = document.getElementById('user-profile-nombre');
    const elCorreo = document.getElementById('user-profile-correo');
    const elRol = document.getElementById('user-profile-rol');
    const elEstado = document.getElementById('user-profile-estado');

    if (elTipoDoc) elTipoDoc.innerText = currentUser.tipoDoc || 'Cédula';
    if (elCedula) elCedula.innerText = currentUser.cedula || 'N/A';
    if (elNombre) elNombre.innerText = currentUser.nombre || 'N/A';
    if (elCorreo) elCorreo.innerText = currentUser.correo || 'N/A';
    if (elRol) elRol.innerText = currentUser.rol || 'N/A';
    if (elEstado) elEstado.innerText = currentUser.estado || 'Activo';
};

// 4. Renderizado de Tabla de Administración
window.renderUsersTable = function() {
    const users = DataLayer.getUsers();
    const currentUser = AuthService.getCurrentUser();
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    users.forEach(user => {
        const tr = document.createElement('tr');
        const badgeRol = user.rol === 'Administrador' ? 'badge-admin' : 'badge-user';
        const badgeEstado = user.estado === 'Activo' ? 'badge-active' : 'badge-inactive';
        const isSelf = currentUser && (currentUser.id === user.id || currentUser.correo === user.correo);

        tr.innerHTML = `
            <td>#${String(user.id).padStart(3, '0')}</td>
            <td>${user.tipoDoc || 'Cédula'}</td>
            <td>${user.cedula}</td>
            <td>${user.nombre}</td>
            <td>${user.correo}</td>
            <td><span class="badge ${badgeRol}">${user.rol}</span></td>
            <td><span class="badge ${badgeEstado}">${user.estado}</span></td>
            <td class="actions-cell">
                <button 
                    class="btn btn-neutral" 
                    style="padding: 4px 8px; font-size: 12px; width: auto; margin-right: 4px;" 
                    onclick="handleToggleRole(${user.id})"
                    ${isSelf ? 'disabled title="No puedes cambiar tu propio rol"' : ''}
                >
                    Cambiar Rol
                </button>
                <button 
                    class="btn ${user.estado === 'Activo' ? 'btn-neutral' : 'btn-accent'}" 
                    style="padding: 4px 8px; font-size: 12px; width: auto;" 
                    onclick="handleToggleStatus(${user.id})"
                    ${isSelf ? 'disabled title="No puedes desactivar tu propia cuenta"' : ''}
                >
                    ${isSelf ? 'Sesión Actual' : (user.estado === 'Activo' ? 'Desactivar' : 'Activar')}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// 5. Navegador y Cambio de Vistas
window.switchView = function(targetViewId) {
    const currentUser = AuthService.getCurrentUser();

    // Protección de rutas
    if (targetViewId === 'view-admin' || targetViewId === 'view-admin-signup') {
        if (!currentUser || currentUser.rol !== 'Administrador') {
            targetViewId = 'view-denied';
        }
    }

    if (targetViewId === 'view-user-panel') {
        if (!currentUser) {
            targetViewId = 'view-login';
        }
    }

    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const targetElement = document.getElementById(targetViewId);
    if (targetElement) {
        targetElement.classList.add('active');
    }

    const card = document.getElementById('main-card');
    if (card) {
        if (targetViewId === 'view-admin') {
            card.classList.add('wide');
            window.renderUsersTable();
        } else if (targetViewId === 'view-user-panel') {
            card.classList.remove('wide');
            window.renderUserProfile();
        } else {
            card.classList.remove('wide');
        }
    }
};

// 6. Manejadores de Eventos (Acciones de Administrador)
window.handleToggleRole = function(userId) {
    try {
        const updatedUser = AuthService.toggleUserRole(userId);
        showAlert(`El rol de ${updatedUser.nombre} ha sido actualizado a: ${updatedUser.rol}.`, 'success');
        window.renderUsersTable();
    } catch (error) {
        showAlert(error.message, 'error');
    }
};

window.handleToggleStatus = function(userId) {
    try {
        const updatedUser = AuthService.toggleUserStatus(userId);
        showAlert(`Estado de ${updatedUser.nombre} actualizado a ${updatedUser.estado}.`, 'success');
        window.renderUsersTable();
    } catch (error) {
        showAlert(error.message, 'error');
    }
};

// 7. Manejador del Evento Registro
window.handleRegister = async function(event, defaultRole = null) {
    event.preventDefault();
    
    const isAdminForm = defaultRole === null;
    const prefix = isAdminForm ? 'admin-signup-' : 'signup-';

    const tipoDoc = document.getElementById(`${prefix}tipo-doc`).value;
    const cedula = document.getElementById(`${prefix}cedula`).value;
    const name = document.getElementById(`${prefix}name`).value;
    const email = document.getElementById(`${prefix}email`).value;
    const password = document.getElementById(`${prefix}password`).value;
    const confirm = document.getElementById(`${prefix}confirm`).value;
    const role = defaultRole || document.getElementById('admin-signup-role').value;

    try {
        await AuthService.registerUser(tipoDoc, cedula, name, email, password, confirm, role);
        showAlert('Usuario registrado con éxito.', 'success');
        event.target.reset();

        if (isAdminForm) {
            window.switchView('view-admin');
        } else {
            window.switchView('view-login');
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
};

// 8. Manejador del Evento Login
window.handleLogin = async function(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const user = await AuthService.login(email, password);
        showAlert(`Bienvenido/a, ${user.nombre}`, 'success');
        
        const form = document.getElementById('form-login');
        if (form) form.reset();

        if (user.rol === 'Administrador') {
            window.switchView('view-admin');
        } else {
            window.switchView('view-user-panel');
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
};

// 9. Inicialización al cargar el documento
document.addEventListener('DOMContentLoaded', async () => {
    await DataLayer.seedInitialData();
    
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) {
        if (currentUser.rol === 'Administrador') {
            window.switchView('view-admin');
        } else {
            window.switchView('view-user-panel');
        }
    } else {
        window.switchView('view-home');
    }
});