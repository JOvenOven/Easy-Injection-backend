const express = require('express');
const crypto = require('crypto');
const { User } = require('../../models/user/user.model');
const emailService = require('../../services/email.service');
const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ 
                error: 'Token de verificación requerido' 
            });
        }

        const user = await User.findOne({ 
            token_verificacion: token,
            fecha_expiracion_token: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ 
                error: 'Token de verificación inválido o expirado' 
            });
        }

        user.email_verificado = true;
        user.estado_cuenta = 'activo';
        user.token_verificacion = undefined;
        user.fecha_expiracion_token = undefined;

        await user.save();

        res.json({
            message: 'Email verificado exitosamente',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                email_verificado: user.email_verificado,
                estado_cuenta: user.estado_cuenta
            }
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const user = await User.findOne({ 
            token_verificacion: token,
            fecha_expiracion_token: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ 
                error: 'Token de verificación inválido o expirado' 
            });
        }

        user.email_verificado = true;
        user.estado_cuenta = 'activo';
        user.token_verificacion = undefined;
        user.fecha_expiracion_token = undefined;

        await user.save();

        res.json({
            message: 'Email verificado exitosamente',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                email_verificado: user.email_verificado,
                estado_cuenta: user.estado_cuenta
            }
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

router.post('/resend', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                error: 'Email requerido' 
            });
        }

        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ 
                error: 'Usuario no encontrado' 
            });
        }

        if (user.email_verificado) {
            return res.status(400).json({ 
                error: 'El email ya está verificado' 
            });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 24);

        user.token_verificacion = verificationToken;
        user.fecha_expiracion_token = expirationDate;
        await user.save();

        const emailSent = await emailService.sendVerificationEmail(
            user.email, 
            user.username, 
            verificationToken
        );

        if (emailSent) {
            res.json({
                message: 'Email de verificación reenviado exitosamente'
            });
        } else {
            res.status(500).json({
                error: 'Error al enviar el email de verificación'
            });
        }

    } catch (error) {
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

module.exports = router;
