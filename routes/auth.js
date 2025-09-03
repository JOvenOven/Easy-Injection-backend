const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/auth/verify - Verify token and get user info
router.get('/verify', auth, async (req, res) => {
    try {
        // If we reach here, the token is valid and user is authenticated
        res.json({
            message: 'Token válido',
            user: req.user
        });
    } catch (error) {
        console.error('Error en verificación de token:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

// GET /api/auth/me - Get current user profile
router.get('/me', auth, async (req, res) => {
    try {
        const { User } = require('../models/usuario');
        const user = await User.findById(req.user._id).select('-contrasena_hash -token_verificacion');
        
        if (!user) {
            return res.status(404).json({ 
                error: 'Usuario no encontrado' 
            });
        }

        res.json({
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                fecha_registro: user.fecha_registro,
                ultimo_login: user.ultimo_login,
                estado_cuenta: user.estado_cuenta,
                email_verificado: user.email_verificado,
                perfil: user.perfil
            }
        });
    } catch (error) {
        console.error('Error obteniendo perfil de usuario:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

module.exports = router;
