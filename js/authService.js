import { DataLayer } from './dataLayer.js';
import { SecurityService } from './security.js';


// ==========================================
// Funciones de Validación Sintáctica
// ==========================================
function validarIdentificacion(tipo, identificacion) {
    const limpia = identificacion.trim().replace(/[-\s]/g, '');

    if (tipo === 'Cédula') {
        return /^[1-9]\d{8}$/.test(limpia) || /^3\d{9}$/.test(limpia) || /^4\d{9}$/.test(limpia);
    } else if (tipo === 'DIMEX') {
        return /^\d{11,12}$/.test(limpia);
    } else if (tipo === 'Pasaporte') {
        return /^[a-zA-Z0-9]{6,15}$/.test(limpia);
    }
    return false;
}

function validarNombreEspaniol(nombre) {
    const regexNombre = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    return regexNombre.test(nombre.trim());
}

function validarEmail(email) {
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regexEmail.test(email.trim());
}

function validarPasswordSegura(password) {
    const regexPass = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&._\-#])[A-Za-z\d@$!\%*?&._\-#]{9,}$/;
    return regexPass.test(password);
}

// ========================================
// Servicio Autenticación
// ========================================
export const AuthService = {
    SESSION_KEY: 'authyte_active_session',

    getCurrentUser() {
        const session = sessionStorage.getItem(this.SESSION_KEY);
        return session ? JSON.parse(session) : null;
    },

    async registerUser(tipoDoc, cedula, nombre, correo, password, confirmPassword, rol = 'Usuario Estándar') {
        const cedulaLimpia = cedula.trim().replace(/[-\s]/g, '');

        // 1. Validar Tipo e Identificación (Cédula, DIMEX, Pasaporte)
        if (!validarIdentificacion(tipoDoc, cedulaLimpia)) {
            throw new Error(`El número de ${tipoDoc} no posee un formato válido.`);
        }

        // 2. Validar Nombre en Español (letras, tildes, ñ)
        if (!validarNombreEspaniol(nombre)) {
            throw new Error('El nombre solo debe contener caracteres alfabéticos en español.');
        }

        // 3. Validar Correo Electrónico
        if (!validarEmail(correo)) {
            throw new Error('El correo electrónico no posee un formato válido.');
        }

        // 4. Validar Coincidencia de Contraseñas
        if (password !== confirmPassword) {
            throw new Error('Las contraseñas no coinciden.');
        }

        // 5. Validar Fortaleza de Contraseña (mín 9 chars, mayúscula, minúscula, número y especial)
        if (!validarPasswordSegura(password)) {
            throw new Error('La contraseña debe tener al menos 9 caracteres, incluir una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&._-#).');
        }

        const users = DataLayer.getUsers();

        // Validar duplicados en la base de datos
        if (users.some(u => u.cedula === cedulaLimpia)) {
            throw new Error('El número de documento ya se encuentra registrado.');
        }
        if (users.some(u => u.correo.toLowerCase() === correo.toLowerCase())) {
            throw new Error('El correo electrónico ya se encuentra registrado.');
        }

        // Generar Hash SHA-256
        const passwordHash = await SecurityService.hashPassword(password);

        const newUser = {
            id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
            tipoDoc,
            cedula: cedulaLimpia,
            nombre: nombre.trim(),
            correo: correo.trim().toLowerCase(),
            passwordHash,
            rol,
            estado: 'Activo'
        };

        users.push(newUser);
        DataLayer.saveUsers(users);
        return newUser;
    },

    async login(correo, password) {
        const users = DataLayer.getUsers();
        const inputHash = await SecurityService.hashPassword(password);

        const user = users.find(u => u.correo.toLowerCase() === correo.toLowerCase() && u.passwordHash === inputHash);

        if (!user) {
            throw new Error('Credenciales incorrectas (Correo o Contraseña).');
        }

        if (user.estado !== 'Activo') {
            throw new Error('Tu cuenta se encuentra desactivada. Contacta al administrador.');
        }

        const sessionData = { 
            id: user.id, 
            tipoDoc: user.tipoDoc || 'Cédula', 
            cedula: user.cedula, 
            nombre: user.nombre, 
            correo: user.correo, 
            rol: user.rol, 
            estado: user.estado 
        };
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
        return user;
    },

    logout() {
        sessionStorage.removeItem(this.SESSION_KEY);
        
        if (window.showAlert) {
            window.showAlert('Has cerrado sesión correctamente.', 'success');
        }
        if (window.switchView) {
            window.switchView('view-home');
        }
    },

    toggleUserStatus(userId) {
        const users = DataLayer.getUsers();
        const user = users.find(u => u.id === userId);
        if (user) {
            user.estado = user.estado === 'Activo' ? 'Inactivo' : 'Activo';
            DataLayer.saveUsers(users);

            const currentUser = this.getCurrentUser();
            if (currentUser && currentUser.id === userId && user.estado === 'Inactivo') {
                this.logout();
            }
            return user;
        }
        throw new Error('Usuario no encontrado.');
    },

    toggleUserRole(userId) {
        const currentUser = this.getCurrentUser();
        const users = DataLayer.getUsers();
        const user = users.find(u => u.id === userId);

        if (currentUser && (currentUser.id === userId || currentUser.correo === user?.correo)) {
            throw new Error('No puedes modificar tu propio rol de administrador.');
        }

        if (user) {
            user.rol = user.rol === 'Administrador' ? 'Usuario Estándar' : 'Administrador';
            DataLayer.saveUsers(users);
            return user;
        }
        throw new Error('Usuario no encontrado.');
    }
};