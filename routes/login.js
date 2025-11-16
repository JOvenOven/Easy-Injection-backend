const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/usuario');
const router = express.Router();

// POST /api/login
router.post('/', async (req, res) => {
    try {
        // Validate request body
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email y contraseña son requeridos' 
            });
        }

        // Find user by email
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(401).json({ 
                error: 'Credenciales inválidas' 
            });
        }

        // Check if email is verified
        if (!user.email_verificado) {
            return res.status(401).json({ 
                error: 'Por favor verifica tu email antes de iniciar sesión' 
            });
        }

        // Check if account is active
        if (user.estado_cuenta !== 'activo') {
            return res.status(401).json({ 
                error: 'Tu cuenta no está activa. Contacta al administrador.' 
            });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.contrasena_hash);
        if (!validPassword) {
            return res.status(401).json({ 
                error: 'Credenciales inválidas' 
            });
        }

        // Update last login
        user.ultimo_login = new Date();
        await user.save();

        // Generate JWT token
        const token = user.generateAuthToken();

        // Return user data and token
        res.json({
            message: 'Login exitoso',
            token: token,
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
        console.error('Error en login:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

module.exports = router;
