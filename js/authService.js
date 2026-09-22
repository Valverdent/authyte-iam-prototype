import { DataLayer } from './dataLayer.js';
import { SecurityService } from './security.js';

export const AuthService = {
    SESSION_KEY: 'authyte_active_session',

    getCurrentUser() {
        const session = sessionStorage.getItem(this.SESSION_KEY);
        return session ? JSON.parse(session) : null;
    },

    async registerUser(tipoDoc, cedula, nombre, correo, password, confirmPassword, rol = 'Usuario Estándar') {
        const cedulaLimpia = cedula.trim().replace(/[-\s]/g, '');

        if (password !== confirmPassword) {
            throw new Error('Las contraseñas no coinciden.');
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