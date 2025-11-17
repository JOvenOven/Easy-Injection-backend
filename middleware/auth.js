const jwt = require('jsonwebtoken');
const config = require('config');
const User = require('../models/usuario');
const debug = require('debug')('easyinjection:middleware:auth');

module.exports = async function (req, res, next) {
    // Obtener el header "Authorization"
    const authHeader = req.header('Authorization');
    
    // Verificar que existe y tiene el formato correcto
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'Acceso denegado. No se proporcionó un token válido en el encabezado Authorization.' 
        });
    }

    // Extraer el token (quitar "Bearer ")
    const token = authHeader.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, config.get('jwtPrivateKey'));
        debug('Token verified for user: %s', decoded._id);
        
        // Verificar que el usuario aún existe y está activo
        const user = await User.findById(decoded._id);
        if (!user) {
            return res.status(401).json({ 
                error: 'Token inválido. Usuario no encontrado.' 
            });
        }

        if (user.estado_cuenta !== 'activo') {
            return res.status(401).json({ 
                error: 'Cuenta inactiva.' 
            });
        }

        req.user = decoded;
        next();
    } catch (ex) {
        res.status(400).json({ 
            error: 'Token inválido.' 
        });
    }
};
