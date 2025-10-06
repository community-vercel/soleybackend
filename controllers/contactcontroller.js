const Contact = require('../models/contact');
const { 
  sendContactNotificationToAdmin, 
  sendContactConfirmationToUser 
} = require('../utils/contactservice');

/**
 * @desc    Submit contact form
 * @route   POST /api/contact
 * @access  Public
 */
exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message, phone } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Por favor proporciona todos los campos requeridos'
      });
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Por favor proporciona un correo electrónico válido'
      });
    }

    // Validate message length
    if (message.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'El mensaje debe tener al menos 10 caracteres'
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'El mensaje no puede exceder 2000 caracteres'
      });
    }

    // Get user IP and user agent
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Check if user is authenticated
    const userId = req.user ? req.user.id : null;

    // Create contact entry
    const contact = await Contact.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      subject: subject.trim(),
      message: message.trim(),
      phone: phone ? phone.trim() : undefined,
      userId,
      ipAddress,
      userAgent
    });

    // Send emails asynchronously (don't wait for them)
    Promise.all([
      sendContactNotificationToAdmin({
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        message: contact.message,
        phone: contact.phone
      }),
      sendContactConfirmationToUser({
        name: contact.name,
        email: contact.email,
        subject: contact.subject
      })
    ]).catch(err => {
      console.error('Error sending contact emails:', err);
      // Don't fail the request if emails fail
    });

    res.status(201).json({
      success: true,
      message: 'Tu mensaje ha sido enviado correctamente. Te responderemos pronto.',
      data: {
        id: contact._id,
        createdAt: contact.createdAt
      }
    });

  } catch (error) {
    console.error('Error in submitContactForm:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar el mensaje. Por favor intenta de nuevo.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get all contact submissions (Admin only)
 * @route   GET /api/contact
 * @access  Private/Admin
 */
exports.getAllContacts = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const query = {};
    
    // Filter by status
    if (status && ['pending', 'read', 'replied', 'archived'].includes(status)) {
      query.status = status;
    }

    // Search by name, email, or subject
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    const contacts = await Contact.find(query)
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Contact.countDocuments(query);

    res.status(200).json({
      success: true,
      data: contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error in getAllContacts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los mensajes de contacto',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get single contact submission (Admin only)
 * @route   GET /api/contact/:id
 * @access  Private/Admin
 */
exports.getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('userId', 'firstName lastName email phone')
      .populate('repliedBy', 'firstName lastName email');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje de contacto no encontrado'
      });
    }

    // Mark as read if it's pending
    if (contact.status === 'pending') {
      contact.status = 'read';
      await contact.save();
    }

    res.status(200).json({
      success: true,
      data: contact
    });

  } catch (error) {
    console.error('Error in getContactById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el mensaje de contacto',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update contact status (Admin only)
 * @route   PUT /api/contact/:id/status
 * @access  Private/Admin
 */
exports.updateContactStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!['pending', 'read', 'replied', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje de contacto no encontrado'
      });
    }

    contact.status = status;
    if (notes) contact.notes = notes;

    if (status === 'replied' && !contact.replied) {
      contact.replied = true;
      contact.repliedAt = new Date();
      contact.repliedBy = req.user.id;
    }

    await contact.save();

    res.status(200).json({
      success: true,
      message: 'Estado actualizado correctamente',
      data: contact
    });

  } catch (error) {
    console.error('Error in updateContactStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el estado',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Reply to contact (Admin only)
 * @route   POST /api/contact/:id/reply
 * @access  Private/Admin
 */
exports.replyToContact = async (req, res) => {
  try {
    const { replyMessage } = req.body;

    if (!replyMessage || replyMessage.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Por favor proporciona un mensaje de respuesta'
      });
    }

    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje de contacto no encontrado'
      });
    }

    contact.replyMessage = replyMessage.trim();
    contact.replied = true;
    contact.repliedAt = new Date();
    contact.repliedBy = req.user.id;
    contact.status = 'replied';

    await contact.save();

    // Here you could send an email to the user with the reply
    // sendReplyEmailToUser(contact, replyMessage);

    res.status(200).json({
      success: true,
      message: 'Respuesta enviada correctamente',
      data: contact
    });

  } catch (error) {
    console.error('Error in replyToContact:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar la respuesta',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Delete contact (Admin only)
 * @route   DELETE /api/contact/:id
 * @access  Private/Admin
 */
exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje de contacto no encontrado'
      });
    }

    await contact.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Mensaje de contacto eliminado correctamente'
    });

  } catch (error) {
    console.error('Error in deleteContact:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el mensaje de contacto',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get contact statistics (Admin only)
 * @route   GET /api/contact/stats
 * @access  Private/Admin
 */
exports.getContactStats = async (req, res) => {
  try {
    const stats = await Contact.aggregate([
      {
        $facet: {
          statusCount: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          totalCount: [
            { $count: 'total' }
          ],
          recentCount: [
            {
              $match: {
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
              }
            },
            { $count: 'recent' }
          ]
        }
      }
    ]);

    const statusMap = {};
    stats[0].statusCount.forEach(item => {
      statusMap[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      data: {
        total: stats[0].totalCount[0]?.total || 0,
        recent: stats[0].recentCount[0]?.recent || 0,
        pending: statusMap.pending || 0,
        read: statusMap.read || 0,
        replied: statusMap.replied || 0,
        archived: statusMap.archived || 0
      }
    });

  } catch (error) {
    console.error('Error in getContactStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};