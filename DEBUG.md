Used the debug npm module

**Models (10 archivos):**

- easyinjection:models:severity - nivel_severidad.js - Logs de SeverityLevel (fromMongoose, save)
- easyinjection:models:vulntype - tipo_vulnerabilidad.js - Logs de VulnerabilityType (fromMongoose, save)
- easyinjection:models:authtype - tipo_autenticacion.js - Logs de AuthType (fromMongoose, save)
- easyinjection:models:gestordb - gestor_db.js - Logs de GestorBD (fromMongoose, save)
- easyinjection:models:question - pregunta.js - Logs de Question (fromMongoose, save, random)
- easyinjection:models:answer - respuesta.js - Logs de Answer (fromMongoose, save)
- easyinjection:models:vulnerability - vulnerabilidad.js - Logs de Vulnerability (fromMongoose, save, getRiskScore)
- easyinjection:models:report - reporte.js - Logs de Report y ReportSummary (fromVulnerabilities, save)
- easyinjection:models:scan - escaneo.js - Logs de Scan (start, finish, calculateScore, save)
- easyinjection:models:user - usuario.js - Logs de User (activate, verifyEmail, addNotification, generateAuthToken, save)

Routes (6 archivos):

- easyinjection:routes:register - register.js - Logs de registro (POST, user exists check)
- easyinjection:routes:login - login.js - Logs de login (POST, login success)
- easyinjection:routes:verify-email - verify-email.js - Logs de verificación de email (POST)
- easyinjection:routes:user - user.js - Logs de perfil de usuario (GET/PUT profile)
- easyinjection:routes:scans - scans.js - Logs de escaneos (GET scans, GET scan by id)
- easyinjection:routes:auth - auth.js - Logs de autenticación (GET verify, GET me)


**Services (1 archivo):**

- easyinjection:services:email - emailService.js - Logs de envío de emails (sendVerificationEmail, success/error)


**Middleware (2 archivos):**

- easyinjection:middleware:auth - auth.js - Logs de verificación de tokens (token verified)
- easyinjection:middleware:error - error.js - Logs de errores globales


**Startup (3 archivos):**

- easyinjection:startup:db - db.js - Logs de conexión a MongoDB (connecting, success/error)
- easyinjection:startup:config - config.js - Logs de validación de configuración
- easyinjection:startup:routes - routes.js - Logs de setup de rutas


**Server (1 archivo):**

- easyinjection:server - index.js - Logs de inicio de servidor (Socket.io init, server started)