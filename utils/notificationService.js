const User = require('../models/User'); // Your User model
const {
  sendNotificationToDevice,
  sendNotificationToMultipleDevices
} = require('./firebaseAdmin');

// Order notification messages
const ORDER_MESSAGES = {
  pending: {
    title: '🛍️ Order Received',
    body: 'Your order has been received and is being processed.'
  },
  confirmed: {
    title: '✅ Order Confirmed',
    body: 'Your order has been confirmed and will be prepared soon.'
  },
  preparing: {
    title: '👨‍🍳 Preparing Your Order',
    body: 'Our kitchen is preparing your delicious meal!'
  },
  ready: {
    title: '🎉 Order Ready',
    body: 'Your order is ready for pickup!'
  },
  'out-for-delivery': {
    title: '🚗 Out for Delivery',
    body: 'Your order is on its way to you!'
  },
  delivered: {
    title: '✅ Order Delivered',
    body: 'Your order has been delivered. Enjoy your meal!'
  },
  cancelled: {
    title: '❌ Order Cancelled',
    body: 'Your order has been cancelled.'
  }
};

const sendOrderStatusNotification = async (user, order, status, customMessage = null) => {
  
  const tuser = await User.findById(user);

  const fcmToken = tuser?.fcmToken;


  try {
  if (!fcmToken) {
      console.log('User has no FCM token, skipping notification');
      return { success: false, message: 'No FCM token' };
    }

    const message = ORDER_MESSAGES[status];
  

    const title = customMessage?.title || message.title;
    const body = customMessage?.body || message.body;

    const data = {
      type: 'order_update',
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: status,
      timestamp: new Date().toISOString()
    };

    return await sendNotificationToDevice(fcmToken, title, body, data);
  } catch (error) {
    console.error('Error sending order status notification:', error);
    return { success: false, error: error.message };
  }
};

// Send new order notification (for restaurant/admin)
const sendNewOrderNotification = async (adminTokens, order) => {
  try {
    if (!adminTokens || adminTokens.length === 0) {
      return { success: false, message: 'No admin tokens' };
    }

    const title = '🔔 New Order Received';
    const body = `Order #${order.orderNumber} - €${order.total.toFixed(2)}`;

    const data = {
      type: 'new_order',
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      total: order.total.toString(),
      timestamp: new Date().toISOString()
    };

    return await sendNotificationToMultipleDevices(adminTokens, title, body, data);
  } catch (error) {
    console.error('Error sending new order notification:', error);
    return { success: false, error: error.message };
  }
};

// Send delivery agent assignment notification
const sendDeliveryAssignmentNotification = async (deliveryAgent, order) => {
  try {
    if (!deliveryAgent.fcmToken) {
      return { success: false, message: 'No FCM token' };
    }

    const title = '📦 New Delivery Assignment';
    const body = `Order #${order.orderNumber} assigned to you`;

    const data = {
      type: 'delivery_assignment',
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      deliveryAddress: JSON.stringify(order.deliveryAddress),
      timestamp: new Date().toISOString()
    };

    return await sendNotificationToDevice(deliveryAgent.fcmToken, title, body, data);
  } catch (error) {
    console.error('Error sending delivery assignment notification:', error);
    return { success: false, error: error.message };
  }
};

// Send promotional notification
const sendPromotionalNotification = async (userTokens, title, body, promoData = {}) => {
  try {
    const data = {
      type: 'promotion',
      ...promoData,
      timestamp: new Date().toISOString()
    };

    return await sendNotificationToMultipleDevices(userTokens, title, body, data);
  } catch (error) {
    console.error('Error sending promotional notification:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOrderStatusNotification,
  sendNewOrderNotification,
  sendDeliveryAssignmentNotification,
  sendPromotionalNotification
};