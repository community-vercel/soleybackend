

const admin = require('../config/firebase'); // Adjust path to your Firebase initialization



const sendNotificationToDevice = async (fcmToken, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      token: fcmToken,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'order_updates'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

// Send notification to multiple devices
const sendNotificationToMultipleDevices = async (fcmTokens, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      tokens: fcmTokens,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'order_updates'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message)
;
    console.log(`Successfully sent ${response.successCount} notifications`);
    return { success: true, response };
  } catch (error) {
    console.error('Error sending notifications:', error);
    return { success: false, error: error.message };
  }
};

// Send notification to topic
const sendNotificationToTopic = async (topic, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      topic,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'order_updates'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification to topic:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Error sending notification to topic:', error);
    return { success: false, error: error.message };
  }
};

// Subscribe user to topic
const subscribeToTopic = async (fcmTokens, topic) => {
  try {
    const response = await admin.messaging().subscribeToTopic(fcmTokens, topic);
    console.log('Successfully subscribed to topic:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    return { success: false, error: error.message };
  }
};

// Unsubscribe user from topic
const unsubscribeFromTopic = async (fcmTokens, topic) => {
  try {
    const response = await admin.messaging().unsubscribeFromTopic(fcmTokens, topic);
    console.log('Successfully unsubscribed from topic:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendNotificationToDevice,
  sendNotificationToMultipleDevices,
  sendNotificationToTopic,
  subscribeToTopic,
  unsubscribeFromTopic
};