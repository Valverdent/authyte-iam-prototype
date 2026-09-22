import { SecurityService } from './security.js';

export const DataLayer = {
    STORAGE_KEY: 'authyte_users',

    getUsers() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    saveUsers(users) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(users));
    },

    async seedInitialData() {
        if (this.getUsers().length === 0) {
            const defaultAdminPass = await SecurityService.hashPassword('Admin123!');
            const defaultUserPass = await SecurityService.hashPassword('User123!');

            const initialUsers = [
                {
                    id: 1,
                    tipoDoc: 'Cédula',
                    cedula: '101110222',
                    nombre: 'Carlos Admin',
                    correo: 'carlos@empresa.com',
                    passwordHash: defaultAdminPass,
                    rol: 'Administrador',
                    estado: 'Activo'
                },
                {
                    id: 2,
                    tipoDoc: 'Cédula',
                    cedula: '202220333',
                    nombre: 'Laura Gómez',
                    correo: 'laura@correo.com',
                    passwordHash: defaultUserPass,
                    rol: 'Usuario Estándar',
                    estado: 'Activo'
                }
            ];
            this.saveUsers(initialUsers);
        }
    }
};