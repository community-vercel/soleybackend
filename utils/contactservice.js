const nodemailer = require('nodemailer');

// Create email transporter (reuse from your existing code)
const createTransporter = () => {
  try {
    if (!nodemailer || typeof nodemailer.createTransport !== 'function') {
      throw new Error('Nodemailer not properly loaded');
    }

    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      throw new Error('SMTP credentials not configured');
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    return transporter;
  } catch (error) {
    console.error('Error creating email transporter:', error);
    throw error;
  }
};

/**
 * Send notification email to admin about new contact form submission
 */
const sendContactNotificationToAdmin = async (contactData) => {
  const transporter = createTransporter();

  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_EMAIL;

  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Saborly'}" <${process.env.SMTP_EMAIL}>`,
    to: adminEmail,
    subject: `Nueva Consulta de Contacto: ${contactData.subject}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nueva Consulta de Contacto</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px 20px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .content {
            padding: 30px;
          }
          .field {
            margin-bottom: 20px;
          }
          .field-label {
            font-weight: 600;
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          .field-value {
            font-size: 16px;
            color: #333;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 6px;
            border-left: 3px solid #667eea;
          }
          .message-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            margin: 20px 0;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
          }
          .action-button {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
            font-weight: 600;
          }
          .timestamp {
            color: #999;
            font-size: 13px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Nueva Consulta de Contacto</h1>
          </div>
          <div class="content">
            <div class="field">
              <div class="field-label">Nombre</div>
              <div class="field-value">${contactData.name}</div>
            </div>
            
            <div class="field">
              <div class="field-label">Email</div>
              <div class="field-value">
                <a href="mailto:${contactData.email}" style="color: #667eea; text-decoration: none;">
                  ${contactData.email}
                </a>
              </div>
            </div>
            
            ${contactData.phone ? `
            <div class="field">
              <div class="field-label">Teléfono</div>
              <div class="field-value">${contactData.phone}</div>
            </div>
            ` : ''}
            
            <div class="field">
              <div class="field-label">Asunto</div>
              <div class="field-value">${contactData.subject}</div>
            </div>
            
            <div class="field">
              <div class="field-label">Mensaje</div>
              <div class="message-box">${contactData.message.replace(/\n/g, '<br>')}</div>
            </div>
            
            <div class="timestamp">
              Recibido: ${new Date().toLocaleString('es-ES', { 
                dateStyle: 'full', 
                timeStyle: 'short' 
              })}
            </div>
            
            <center>
              <a href="mailto:${contactData.email}?subject=Re: ${encodeURIComponent(contactData.subject)}" 
                 class="action-button">
                Responder a ${contactData.name}
              </a>
            </center>
          </div>
          <div class="footer">
            <p><strong>${process.env.APP_NAME || 'Saborly'}</strong> - Sistema de Gestión</p>
            <p style="font-size: 12px; color: #999;">
              Este es un correo automático generado por el sistema
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Nueva Consulta de Contacto

Nombre: ${contactData.name}
Email: ${contactData.email}
${contactData.phone ? `Teléfono: ${contactData.phone}` : ''}
Asunto: ${contactData.subject}

Mensaje:
${contactData.message}

Recibido: ${new Date().toLocaleString('es-ES')}

Para responder, envía un correo a: ${contactData.email}
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Contact notification sent to admin:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending contact notification to admin:', error);
    throw error;
  }
};

/**
 * Send confirmation email to user who submitted contact form
 */
const sendContactConfirmationToUser = async (contactData) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Saborly'}" <${process.env.SMTP_EMAIL}>`,
    to: contactData.email,
    subject: 'Hemos Recibido tu Mensaje',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Confirmación de Mensaje</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .icon {
            font-size: 48px;
            margin-bottom: 10px;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #333;
            font-size: 22px;
            margin-top: 0;
          }
          .content p {
            margin-bottom: 15px;
            font-size: 16px;
            color: #555;
          }
          .info-box {
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 20px;
            margin: 25px 0;
            border-radius: 6px;
          }
          .info-box h3 {
            margin: 0 0 10px 0;
            color: #0d47a1;
            font-size: 16px;
          }
          .info-box p {
            margin: 5px 0;
            color: #0d47a1;
            font-size: 14px;
          }
          .contact-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
          }
          .contact-info h3 {
            margin: 0 0 15px 0;
            color: #333;
            font-size: 18px;
          }
          .contact-item {
            margin: 10px 0;
            display: flex;
            align-items: center;
          }
          .contact-icon {
            margin-right: 10px;
            color: #667eea;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="icon">✅</div>
            <h1>¡Mensaje Recibido!</h1>
          </div>
          <div class="content">
            <h2>Hola ${contactData.name}!</h2>
            <p>Gracias por ponerte en contacto con nosotros. Hemos recibido tu mensaje correctamente.</p>
            
            <div class="info-box">
              <h3>📋 Resumen de tu Consulta</h3>
              <p><strong>Asunto:</strong> ${contactData.subject}</p>
              <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES', { 
                dateStyle: 'full', 
                timeStyle: 'short' 
              })}</p>
            </div>
            
            <p>Nuestro equipo revisará tu mensaje y te responderemos lo antes posible, normalmente en un plazo de 24-48 horas.</p>
            
            <div class="contact-info">
              <h3>📞 Información de Contacto</h3>
              <div class="contact-item">
                <span class="contact-icon">📧</span>
                <span>Email: info@saborly.es</span>
              </div>
              <div class="contact-item">
                <span class="contact-icon">☎️</span>
                <span>Teléfono: +34 634 16 74 29</span>
              </div>
              <div class="contact-item">
                <span class="contact-icon">🕒</span>
                <span>Horario: Lun - Dom: 12:00 - 23:00</span>
              </div>
            </div>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              Si tu consulta es urgente, no dudes en llamarnos directamente.
            </p>
          </div>
          <div class="footer">
            <p><strong>${process.env.APP_NAME || 'Saborly'}</strong></p>
            <p>Gracias por confiar en nosotros</p>
            <p style="margin-top: 15px; color: #999; font-size: 12px;">
              Este es un correo automático. Por favor, no respondas a este mensaje.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hola ${contactData.name}!

Gracias por ponerte en contacto con nosotros. Hemos recibido tu mensaje correctamente.

Resumen de tu Consulta:
- Asunto: ${contactData.subject}
- Fecha: ${new Date().toLocaleString('es-ES')}

Nuestro equipo revisará tu mensaje y te responderemos lo antes posible, normalmente en un plazo de 24-48 horas.

Información de Contacto:
- Email: info@saborly.es
- Teléfono: +34 634 16 74 29
- Horario: Lun - Dom: 12:00 - 23:00

Si tu consulta es urgente, no dudes en llamarnos directamente.

Gracias por confiar en nosotros.

${process.env.APP_NAME || 'Saborly'}
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Contact confirmation sent to user:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending contact confirmation to user:', error);
    throw error;
  }
};

module.exports = {
  sendContactNotificationToAdmin,
  sendContactConfirmationToUser
};