const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { User } = require('../../models/user/user.model');
const emailService = require('../../services/email.service');
const router = express.Router();

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                error: 'El correo electrónico es requerido' 
            });
        }

        const userDoc = await User.Model.findOne({ email: email.toLowerCase() });
        
        if (!userDoc) {
            return res.status(200).json({ 
                message: 'Si el correo existe, recibirás un enlace de recuperación' 
            });
        }

        const user = User.fromMongoose(userDoc);
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.setPasswordResetToken(resetToken, 1);
        
        await user.save();

        const resetUrl = `${process.env.BASE_URL_FRONTEND}/reset-password?token=${resetToken}`;
        
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #e53966 0%, #d62d5a 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Restablecer Contraseña</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <p style="font-size: 16px; color: #111827;">Hola <strong>${user.username}</strong>,</p>
                    <p style="font-size: 15px; color: #6b7280; line-height: 1.6;">
                        Recibimos una solicitud para restablecer la contraseña de tu cuenta en EasyInjection.
                    </p>
                    <p style="font-size: 15px; color: #6b7280; line-height: 1.6;">
                        Haz clic en el siguiente botón para crear una nueva contraseña:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="background: linear-gradient(135deg, #e53966 0%, #d62d5a 100%); 
                                  color: white; 
                                  padding: 14px 32px; 
                                  text-decoration: none; 
                                  border-radius: 8px; 
                                  font-weight: 600;
                                  display: inline-block;">
                            Restablecer Contraseña
                        </a>
                    </div>
                    <p style="font-size: 13px; color: #9ca3af; line-height: 1.6;">
                        O copia y pega este enlace en tu navegador:
                    </p>
                    <p style="font-size: 13px; color: #6b7280; word-break: break-all; background: white; padding: 12px; border-radius: 6px;">
                        ${resetUrl}
                    </p>
                    <div style="margin-top: 30px; padding: 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">
                        <p style="margin: 0; font-size: 14px; color: #92400e;">
                            <strong> Importante:</strong> Este enlace expirará en 1 hora.
                        </p>
                    </div>
                    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
                        Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.
                    </p>
                </div>
                <div style="background: #111827; padding: 20px; text-align: center;">
                    <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                        © ${new Date().getFullYear()} EasyInjection. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        `;

        await emailService.sendEmail({
            to: user.email,
            subject: 'Restablecer tu contraseña - EasyInjection',
            html: emailHtml
        });

        res.json({ 
            message: 'Si el correo existe, recibirás un enlace de recuperación' 
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({ 
                error: 'Token y nueva contraseña son requeridos' 
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ 
                error: 'La contraseña debe tener al menos 8 caracteres' 
            });
        }

        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ 
                error: 'Token inválido o expirado' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        user.contrasena_hash = await bcrypt.hash(newPassword, salt);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        
        await user.save();

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">✓ Contraseña Actualizada</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <p style="font-size: 16px; color: #111827;">Hola <strong>${user.username}</strong>,</p>
                    <p style="font-size: 15px; color: #6b7280; line-height: 1.6;">
                        Tu contraseña ha sido restablecida exitosamente.
                    </p>
                    <p style="font-size: 15px; color: #6b7280; line-height: 1.6;">
                        Ya puedes iniciar sesión con tu nueva contraseña.
                    </p>
                    <div style="margin-top: 30px; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px;">
                        <p style="margin: 0; font-size: 14px; color: #991b1b;">
                            <strong>🔒 Seguridad:</strong> Si no realizaste este cambio, contacta con soporte inmediatamente.
                        </p>
                    </div>
                </div>
                <div style="background: #111827; padding: 20px; text-align: center;">
                    <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                        © ${new Date().getFullYear()} EasyInjection. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        `;

        await emailService.sendEmail({
            to: user.email,
            subject: 'Contraseña restablecida - EasyInjection',
            html: emailHtml
        });

        res.json({ 
            message: 'Contraseña restablecida exitosamente' 
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
});

module.exports = router;

