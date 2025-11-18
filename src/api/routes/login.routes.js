const express = require('express');
const bcrypt = require('bcrypt');
const { User } = require('../../models/user/user.model');
const router = express.Router();

const { createSessionData } = require('../middleware/session-tracker.middleware');

router.post('/', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email y contraseña son requeridos' 
            });
        }

        const userDoc = await User.Model.findOne({ email: email });
        if (!userDoc) {
            return res.status(401).json({ 
                error: 'Credenciales inválidas' 
            });
        }

        const user = User.fromMongoose(userDoc);

        if (!user.email_verificado) {
            return res.status(401).json({ 
                error: 'Por favor verifica tu email antes de iniciar sesión' 
            });
        }

        if (user.estado_cuenta !== 'activo') {
            return res.status(401).json({ 
                error: 'Tu cuenta no está activa. Contacta al administrador.' 
            });
        }

        const validPassword = await bcrypt.compare(password, user.contrasena_hash);
        if (!validPassword) {
            return res.status(401).json({ 
                error: 'Credenciales inválidas' 
            });
        }

        if (user.twoFactorEnabled) {
            return res.json({
                requires2FA: true,
                email: user.email,
                message: 'Se requiere autenticación de dos factores'
            });
        }

        user.updateLogin();
        
        const token = user.generateAuthToken();
        const sessionData = createSessionData(req, token);

        user.addSession(sessionData);

        if (user.getActiveSessionCount() > 10) {
            const sortedSessions = [...user.activeSessions].sort((a, b) => 
                new Date(b.lastActivity) - new Date(a.lastActivity)
            );
            user.clearAllSessions();
            sortedSessions.slice(0, 10).forEach(s => user.addSession(s));
        }
        
        await user.save();

        res.json({
            message: 'Login exitoso',
            requires2FA: false,
            token: token,
            user: user.toDTO()
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

module.exports = router;
