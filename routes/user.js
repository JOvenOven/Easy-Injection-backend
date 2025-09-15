const express = require('express');
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/user/profile - Get user profile
router.get('/profile', auth, async (req, res) => {
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

// PUT /api/user/profile - Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { User } = require('../models/usuario');
        const { username, email, avatarId } = req.body;

        // Validate required fields
        if (!username || !email) {
            return res.status(400).json({
                error: 'Username y email son requeridos'
            });
        }

        // Check if username is already taken by another user
        const existingUser = await User.findOne({ 
            username: username,
            _id: { $ne: req.user._id }
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'El nombre de usuario ya está en uso'
            });
        }

        // Check if email is already taken by another user
        const existingEmail = await User.findOne({ 
            email: email,
            _id: { $ne: req.user._id }
        });

        if (existingEmail) {
            return res.status(400).json({
                error: 'El email ya está en uso'
            });
        }

        // Update user profile
        const updateData = {
            username: username,
            email: email
        };

        // Add avatar if provided
        if (avatarId) {
            updateData.perfil = {
                ...req.user.perfil,
                avatarId: avatarId
            };
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true, select: '-contrasena_hash -token_verificacion' }
        );

        res.json({
            message: 'Perfil actualizado exitosamente',
            user: {
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                fecha_registro: updatedUser.fecha_registro,
                ultimo_login: updatedUser.ultimo_login,
                estado_cuenta: updatedUser.estado_cuenta,
                email_verificado: updatedUser.email_verificado,
                perfil: updatedUser.perfil
            }
        });
    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

// PUT /api/user/password - Change password
router.put('/password', auth, async (req, res) => {
    try {
        const { User } = require('../models/usuario');
        const { currentPassword, newPassword } = req.body;

        // Validate required fields
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Contraseña actual y nueva contraseña son requeridas'
            });
        }

        // Validate new password strength
        if (newPassword.length < 8) {
            return res.status(400).json({
                error: 'La nueva contraseña debe tener al menos 8 caracteres'
            });
        }

        // Get user with password
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                error: 'Usuario no encontrado'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.contrasena_hash);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                error: 'La contraseña actual es incorrecta'
            });
        }

        // Hash new password
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await User.findByIdAndUpdate(req.user._id, {
            contrasena_hash: newPasswordHash
        });

        res.json({
            message: 'Contraseña actualizada exitosamente'
        });
    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

// POST /api/user/logout - Logout user
router.post('/logout', auth, async (req, res) => {
    try {
        // In a real application, you might want to:
        // 1. Add the token to a blacklist
        // 2. Update user's last logout time
        // 3. Clear any session data
        
        // For now, we'll just return a success message
        // The client should remove the token from localStorage
        
        res.json({
            message: 'Sesión cerrada exitosamente'
        });
    } catch (error) {
        console.error('Error en logout:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

// GET /api/user/sessions - Get active sessions (mock data for now)
router.get('/sessions', auth, async (req, res) => {
    try {
        // In a real application, you would track active sessions
        // For now, return mock data
        const sessions = [
            {
                id: 's1',
                device: 'PC',
                browser: 'Chrome',
                location: 'Ciudad de México',
                lastActive: 'Activo ahora',
                isCurrent: true
            }
        ];

        res.json({
            sessions: sessions
        });
    } catch (error) {
        console.error('Error obteniendo sesiones:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

// DELETE /api/user/sessions/:sessionId - Close specific session
router.delete('/sessions/:sessionId', auth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // In a real application, you would invalidate the specific session
        // For now, just return success
        
        res.json({
            message: 'Sesión cerrada exitosamente'
        });
    } catch (error) {
        console.error('Error cerrando sesión:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

// DELETE /api/user/sessions - Close all sessions except current
router.delete('/sessions', auth, async (req, res) => {
    try {
        // In a real application, you would invalidate all sessions except current
        // For now, just return success
        
        res.json({
            message: 'Todas las sesiones cerradas exitosamente'
        });
    } catch (error) {
        console.error('Error cerrando todas las sesiones:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

module.exports = router;
