const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/usuario');
const debug = require('debug')('easyinjection:routes:login');
const router = express.Router();

// POST /api/login
router.post('/', async (req, res) => {
    try {
        debug('POST /login - email: %s', req.body.email);
        // Validate request body
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email y contraseña son requeridos' 
            });
        }

        // Find user by email
        const user = await User.findOne({ email: email });
        debug('User found: %s', user ? 'YES' : 'NO');
        if (!user) {
            debug('User not found for email: %s', email);
            return res.status(401).json({ 
                error: 'Credenciales inválidas' 
            });
        }

        debug('User data - username: %s, email_verificado: %s, estado_cuenta: %s, activo: %s', 
            user.username, user.email_verificado, user.estado_cuenta, user.activo);

        // Check if email is verified
        if (!user.email_verificado) {
            debug('Email not verified for user: %s', user.username);
            return res.status(401).json({ 
                error: 'Por favor verifica tu email antes de iniciar sesión' 
            });
        }

        // Check if account is active
        if (user.estado_cuenta !== 'activo') {
            debug('Account not active. Current state: %s for user: %s', user.estado_cuenta, user.username);
            return res.status(401).json({ 
                error: 'Tu cuenta no está activa. Contacta al administrador.' 
            });
        }

        // Verify password
        debug('Verifying password for user: %s', user.username);
        const validPassword = await bcrypt.compare(password, user.contrasena_hash);
        debug('Password valid: %s', validPassword);
        if (!validPassword) {
            debug('Invalid password for user: %s', user.username);
            return res.status(401).json({ 
                error: 'Credenciales inválidas' 
            });
        }

        // Update last login
        debug('Updating last login for user: %s', user.username);
        user.ultimo_login = new Date();
        await user.save();
        debug('Last login updated successfully');

        debug('Login successful for user: %s', user.username);

        // Generate JWT token
        debug('Generating auth token for user: %s', user.username);
        const token = user.generateAuthToken();
        debug('Token generated successfully');

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
