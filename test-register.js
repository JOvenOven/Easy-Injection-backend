const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mock register endpoint for testing
app.post('/api/register', (req, res) => {
    console.log('Register request received:', req.body);
    
    // Validate required fields
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({
            error: 'Todos los campos son requeridos'
        });
    }
    
    if (password.length < 8) {
        return res.status(400).json({
            error: 'La contraseña debe tener al menos 8 caracteres'
        });
    }
    
    // Mock successful registration
    res.status(201).json({
        message: 'Usuario registrado exitosamente (TEST)',
        user: {
            _id: 'test_id_123',
            username: username,
            email: email,
            fecha_registro: new Date(),
            estado_cuenta: 'activo',
            perfil: { nivel_actual: 1 }
        },
        token: 'test_jwt_token_123'
    });
});

const port = 3000;
app.listen(port, () => {
    console.log(`Test server running on port ${port}`);
    console.log('This is a test version without database connection');
    console.log('Use this to test the frontend integration');
});
