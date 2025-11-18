const jwt = require('jsonwebtoken');
const config = require('config');
const { User } = require('../../models/user/user.model');

module.exports = async function (req, res, next) {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'Acceso denegado. No se proporcionó un token válido en el encabezado Authorization.' 
        });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, config.get('jwtPrivateKey'));
        
        const userDoc = await User.Model.findById(decoded._id);
        if (!userDoc) {
            return res.status(401).json({ 
                error: 'Token inválido. Usuario no encontrado.' 
            });
        }

        const user = User.fromMongoose(userDoc);

        if (user.estado_cuenta !== 'activo') {
            return res.status(401).json({ 
                error: 'Cuenta inactiva.' 
            });
        }

        if (user.activeSessions && user.activeSessions.length > 0) {
            const sessionIndex = user.activeSessions.findIndex(s => s.token === token);
            if (sessionIndex !== -1) {
                const lastActivity = new Date(user.activeSessions[sessionIndex].lastActivity);
                const now = new Date();
                const minutesSinceLastUpdate = (now - lastActivity) / (1000 * 60);
                
                if (minutesSinceLastUpdate > 5) {
                    user.activeSessions[sessionIndex].lastActivity = now;
                    await user.save();
                }
            }
        }

        req.user = decoded;
        next();
    } catch (ex) {
        res.status(400).json({ 
            error: 'Token inválido.' 
        });
    }
};
