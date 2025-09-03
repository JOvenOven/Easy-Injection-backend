const jwt = require('jsonwebtoken');
const config = require('config');
const { User } = require('../models/usuario');

module.exports = async function(req, res, next) {
    const token = req.header('x-auth-token');
    
    if (!token) {
        return res.status(401).json({ 
            error: 'Acceso denegado. No se proporcionó token.' 
        });
    }

    try {
        const decoded = jwt.verify(token, config.get('jwtPrivateKey'));
        
        // Verify user still exists and is active
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
