const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/usuario');
const emailService = require('../services/emailService');
const debug = require('debug')('easyinjection:routes:register');
const router = express.Router();

// POST /api/register
router.post('/', async (req, res) => {
    try {
        debug('POST /register - username: %s, email: %s', req.body.username, req.body.email);
        // Validate the request body
        const { error } = User.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                error: 'Datos de entrada inválidos',
                details: error.details[0].message 
            });
        }

        // Check if user already exists
        let user = await User.findOne({ 
            $or: [
                { email: req.body.email },
                { username: req.body.username }
            ]
        });

        if (user) {
            debug('User already exists - email or username taken');
            if (user.email === req.body.email) {
                return res.status(400).json({ 
                    error: 'El email ya está registrado' 
                });
            }
            if (user.username === req.body.username) {
                return res.status(400).json({ 
                    error: 'El nombre de usuario ya está en uso' 
                });
            }
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt);

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 24); // 24 hours from now

        // Create new user
        debug('Creating new user with username: %s, email: %s', req.body.username, req.body.email);
        user = new User({
            username: req.body.username,
            email: req.body.email,
            contrasena_hash: hashedPassword,
            token_verificacion: verificationToken,
            fecha_expiracion_token: expirationDate
        });

        debug('Saving user to database...');
        await user.save();
        debug('User saved successfully. User ID: %s, estado_cuenta: %s, email_verificado: %s', 
            user._id, user.estado_cuenta, user.email_verificado);

        // Send verification email
        const emailSent = await emailService.sendVerificationEmail(
            user.email, 
            user.username, 
            verificationToken
        );

        // Return user data (without password) and verification status
        res.status(201).json({
            message: 'Usuario registrado exitosamente. Por favor verifica tu email para activar tu cuenta.',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                fecha_registro: user.fecha_registro,
                estado_cuenta: user.estado_cuenta,
                email_verificado: user.email_verificado,
                perfil: user.perfil
            },
            emailSent: emailSent,
            requiresVerification: true
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

module.exports = router;
