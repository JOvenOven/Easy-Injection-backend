# EasyInjection Backend

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (running locally or accessible via connection string)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - Copy `config/development.json` and modify as needed
   - Set `NODE_ENV=development` to use development config
   - Ensure MongoDB is running on the configured connection string

3. Start the server:
```bash
npm start
```

The server will start on port 3000 by default.

## API Endpoints

### POST /api/register
Registers a new user.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "message": "Usuario registrado exitosamente",
  "user": {
    "_id": "string",
    "username": "string",
    "email": "string",
    "fecha_registro": "date",
    "estado_cuenta": "string",
    "perfil": "object"
  },
  "token": "string"
}
```

## Features
- User registration with password hashing
- JWT token generation
- Input validation using Joi
- MongoDB integration with Mongoose
- CORS enabled for frontend integration
- Error handling middleware
