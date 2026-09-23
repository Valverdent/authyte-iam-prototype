import { DataLayer } from './dataLayer.js';
import { SecurityService } from './security.js';
import { AuthService } from './authService.js';

// 1. Inicialización al cargar el documento
window.addEventListener('DOMContentLoaded', async () => {
    await DataLayer.seedInitialData(SecurityService);
    
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) {
        if (currentUser.rol === 'Administrador') {
            switchView('view-admin');
        } else {
            switchView('view-user-panel');
        }
    } else {
        switchView('view-home');
    }
});

// 2. Control de alertas visuales
function showAlert(message, type = 'error') {
    const alertBox = document.getElementById('global-alert');
    alertBox.className = `alert alert-${type}`;
    alertBox.innerText = message;
    alertBox.style.display = 'block';

    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 5000);
}

// 3. Renderizado de Perfil de Usuario Estándar
function renderUserProfile() {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) return;

    document.getElementById('user-profile-tipo-doc').innerText = currentUser.tipoDoc || 'Cédula';
    document.getElementById('user-profile-cedula').innerText = currentUser.cedula || 'N/A';
    document.getElementById('user-profile-nombre').innerText = currentUser.nombre || 'N/A';
    document.getElementById('user-profile-correo').innerText = currentUser.correo || 'N/A';
    document.getElementById('user-profile-rol').innerText = currentUser.rol || 'N/A';
    document.getElementById('user-profile-estado').innerText = currentUser.estado || 'Activo';
}

// 4. Navegador y cambio de vistas
function switchView(targetViewId) {
    const currentUser = AuthService.getCurrentUser();

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
    if (targetViewId === 'view-admin') {
        card.classList.add('wide');
        renderUsersTable();
    } else if (targetViewId === 'view-user-panel') {
        card.classList.remove('wide');
        renderUserProfile();
    } else {
        card.classList.remove('wide');
    }
}

// 5. Manejador Evento Registro
async function handleRegister(event, defaultRole = null) {
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
            switchView('view-admin');
        } else {
            switchView('view-login');
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// 6. Manejador del Evento Login
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const user = await AuthService.login(email, password);
        showAlert(`Bienvenido/a, ${user.nombre}`, 'success');
        
        const form = document.getElementById('form-login');
        if (form) form.reset();

        if (user.rol === 'Administrador') {
            switchView('view-admin');
        } else {
            switchView('view-user-panel');
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// 7. Renderizado de Tabla de Administración
function renderUsersTable() {
    const users = DataLayer.getUsers();
    const currentUser = AuthService.getCurrentUser();
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    users.forEach(user => {
        const tr = document.createElement('tr');
        const badgeRol = user.rol === 'Administrador' ? 'accent' : 'neutral';
        const badgeEstado = user.estado === 'Activo' ? 'fill' : 'outline';
        const isSelf = currentUser && (currentUser.id === user.id || currentUser.correo.toLowerCase() === user.correo.toLowerCase());
        const isInactive = user.estado === 'Inactivo';

        tr.innerHTML = `
            <td>#${String(user.id).padStart(3, '0')}</td>
            <td>${user.tipoDoc || 'Cédula'}</td>
            <td>${user.cedula}</td>
            <td>${user.nombre}</td>
            <td>${user.correo}</td>
            <td><fluent-badge appearance="${badgeRol}">${user.rol}</fluent-badge></td>
            <td><fluent-badge appearance="${badgeEstado}">${user.estado}</fluent-badge></td>
            <td class="actions-cell">
                <fluent-button 
                    appearance="neutral" 
                    style="min-width: 0; width: auto; padding: 0 8px;"
                    onclick="handleToggleRole(${user.id})"
                    ${isSelf ? 'disabled' : ''}
                >
                    Cambiar Rol
                </fluent-button>

                <fluent-button 
                    appearance="${user.estado === 'Activo' ? 'outline' : 'accent'}" 
                    style="min-width: 0; width: auto; padding: 0 8px;"
                    onclick="handleToggleStatus(${user.id})"
                    ${isSelf ? 'disabled' : ''}
                >
                    ${isSelf ? 'Sesión Actual' : (user.estado === 'Activo' ? 'Desactivar' : 'Activar')}
                </fluent-button>

                ${isInactive && !isSelf ? `
                    <fluent-button 
                        appearance="stealth" 
                        style="min-width: 0; width: auto; padding: 0 8px; color: #a80000;" 
                        onclick="handleDeleteUser(${user.id})"
                    >
                        Eliminar
                    </fluent-button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 8. Manejo cambio de rol de un usuario
function handleToggleRole(userId) {
    try {
        const updatedUser = AuthService.toggleUserRole(userId);
        showAlert(`El rol de ${updatedUser.nombre} ha sido cambiado a: ${updatedUser.rol}.`, 'success');
        renderUsersTable();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}
 
// 9. Manejo cambio estatus de usuario (Activado / Desactivado)
function handleToggleStatus(userId) {
    try {
        const updatedUser = AuthService.toggleUserStatus(userId);
        showAlert(`Estado de ${updatedUser.nombre} actualizado a ${updatedUser.estado}.`, 'success');
        renderUsersTable();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// 10. Manejo eliminación de usuario
function handleDeleteUser(userId) {
    if (confirm('¿Deseas eliminar permanentemente a este usuario inactivo? Esta acción no se puede deshacer.')) {
        try {
            const deletedUser = AuthService.deleteUser(userId);
            showAlert(`El usuario ${deletedUser.nombre} ha sido eliminado del sistema.`, 'success');
            renderUsersTable();
        } catch (error) {
            showAlert(error.message, 'error');
        }
    }
}

// 11. Manejo logout
function logout() {
    AuthService.logout();
    showAlert('Has cerrado sesión correctamente.', 'success');
    switchView('view-home');
}

// Exponer funciones necesarias al objeto global window para los eventos onclick del HTML
window.switchView = switchView;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleToggleStatus = handleToggleStatus;
window.handleToggleRole = handleToggleRole;
window.handleDeleteUser = handleDeleteUser;
window.logout = logout;
window.showAlert = showAlert;