# Backend Setup Guide for EasyInjection

## Overview
This guide will help you set up the backend registration API for the EasyInjection project.

## Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- MongoDB (local or cloud)

## Quick Start (Test Mode)

### 1. Install Dependencies
```bash
npm install
```

### 2. Test the Registration API (No Database Required)
```bash
npm run test:register
```
This starts a test server on port 3000 that simulates the registration endpoint without requiring a database connection.

### 3. Test the API
```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

## Full Setup (With Database)

### 1. Database Configuration

#### Option A: Local MongoDB
1. Install MongoDB locally
2. Start MongoDB service
3. Update `config/development.json`:
```json
{
    "jwtPrivateKey": "your_secret_key_here",
    "db": "mongodb://127.0.0.1:27017/easyInjection_dev"
}
```

#### Option B: MongoDB Atlas (Cloud)
1. Create a MongoDB Atlas account
2. Create a cluster
3. Get your connection string
4. Update `config/development.json`:
```json
{
    "jwtPrivateKey": "your_secret_key_here",
    "db": "mongodb+srv://username:password@cluster.mongodb.net/easyInjection_dev?retryWrites=true&w=majority"
}
```

### 2. Environment Setup
Set the NODE_ENV environment variable:
```bash
# Windows
set NODE_ENV=development

# Linux/Mac
export NODE_ENV=development
```

### 3. Start the Full Server
```bash
npm start
```

## API Documentation

### POST /api/register

**Endpoint:** `POST /api/register`

**Request Body:**
```json
{
  "username": "string (3-50 characters)",
  "email": "string (valid email format)",
  "password": "string (minimum 8 characters)"
}
```

**Success Response (201):**
```json
{
  "message": "Usuario registrado exitosamente",
  "user": {
    "_id": "string",
    "username": "string",
    "email": "string",
    "fecha_registro": "date",
    "estado_cuenta": "string",
    "perfil": {
      "nivel_actual": "number"
    }
  },
  "token": "string (JWT token)"
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "error": "Datos de entrada inválidos",
  "details": "specific validation message"
}
```

**400 - User Already Exists:**
```json
{
  "error": "El email ya está registrado"
}
```
or
```json
{
  "error": "El nombre de usuario ya está en uso"
}
```

**500 - Server Error:**
```json
{
  "error": "Error interno del servidor"
}
```

## Features

### Security
- Password hashing using bcrypt (salt rounds: 10)
- JWT token generation for authentication
- Input validation using Joi schema validation
- CORS enabled for frontend integration

### Data Validation
- Username: 3-50 characters, unique
- Email: valid format, unique
- Password: minimum 8 characters

### Database
- MongoDB with Mongoose ODM
- User schema with profile, notifications, and response history
- Automatic timestamps and status tracking

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Change port in `index.js` or kill existing process
   - Default port: 3000

2. **MongoDB Connection Failed**
   - Check if MongoDB is running
   - Verify connection string in config
   - Check network/firewall settings

3. **JWT Errors**
   - Ensure JWT private key is set in config
   - Check if key is properly formatted

4. **CORS Issues**
   - Verify CORS middleware is enabled
   - Check frontend URL configuration

### Logs
The server provides detailed logging:
- Database connection status
- API request details
- Error messages with stack traces

## Development

### File Structure
```
backend/
├── config/           # Configuration files
├── models/           # Database models
├── routes/           # API routes
├── middleware/       # Express middleware
├── startup/          # Application startup
└── index.js         # Main application file
```

### Adding New Features
1. Create route file in `routes/`
2. Add model in `models/` if needed
3. Update `startup/routes.js`
4. Test with appropriate validation

## Testing

### Manual Testing
Use tools like:
- Postman
- cURL
- Browser DevTools

### Automated Testing
```bash
npm test
```

## Production Deployment

### Environment Variables
- Set `NODE_ENV=production`
- Use strong JWT private keys
- Configure production database
- Set up proper CORS origins

### Security Considerations
- Use HTTPS in production
- Implement rate limiting
- Add request logging
- Set up monitoring and alerts

