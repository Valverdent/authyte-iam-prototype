import { DataLayer } from './dataLayer.js';
import { SecurityService } from './security.js';

// Validaciones Sintácticas
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

export const AuthService = {
    SESSION_KEY: 'authyte_active_session',

    getCurrentUser() {
        const session = sessionStorage.getItem(this.SESSION_KEY);
        return session ? JSON.parse(session) : null;
    },

    async registerUser(tipoDoc, cedula, nombre, correo, password, confirmPassword, rol = 'Usuario Estándar') {
        const cedulaLimpia = cedula.trim().replace(/[-\s]/g, '');

        if (!validarIdentificacion(tipoDoc, cedulaLimpia)) {
            throw new Error(`El número de ${tipoDoc} no posee un formato válido.`);
        }
        if (!validarNombreEspaniol(nombre)) {
            throw new Error('El nombre solo debe contener caracteres alfabéticos en español.');
        }
        if (!validarEmail(correo)) {
            throw new Error('El correo electrónico no posee un formato válido.');
        }
        if (password !== confirmPassword) {
            throw new Error('Las contraseñas no coinciden.');
        }
        if (!validarPasswordSegura(password)) {
            throw new Error('La contraseña debe tener al menos 9 caracteres, incluir una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&._-#).');
        }

        const users = DataLayer.getUsers();

        if (users.some(u => u.cedula === cedulaLimpia)) {
            throw new Error('El número de documento ya se encuentra registrado.');
        }
        if (users.some(u => u.correo.toLowerCase() === correo.toLowerCase())) {
            throw new Error('El correo electrónico ya se encuentra registrado.');
        }

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

        // Protección: impedir que el administrador modifique su propio rol
        if (currentUser && (currentUser.id === userId || currentUser.correo.toLowerCase() === user?.correo.toLowerCase())) {
            throw new Error('No puedes modificar tu propio rol de administrador.');
        }

        if (user) {
            user.rol = user.rol === 'Administrador' ? 'Usuario Estándar' : 'Administrador';
            DataLayer.saveUsers(users);
            return user;
        }
        throw new Error('Usuario no encontrado.');
    },

    deleteUser(userId) {
        const currentUser = this.getCurrentUser();
        const users = DataLayer.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            throw new Error('Usuario no encontrado.');
        }

        const user = users[userIndex];

        // Protección: no eliminar la sesión activa
        if (currentUser && (currentUser.id === userId || currentUser.correo.toLowerCase() === user.correo.toLowerCase())) {
            throw new Error('No puedes eliminar tu propia cuenta de sesión activa.');
        }

        // Regla de Negocio: solo eliminar si el usuario está inactivo
        if (user.estado !== 'Inactivo') {
            throw new Error('Solo se pueden eliminar permanentemente aquellos usuarios que se encuentren desactivados.');
        }

        users.splice(userIndex, 1);
        DataLayer.saveUsers(users);
        return user;
    }
};