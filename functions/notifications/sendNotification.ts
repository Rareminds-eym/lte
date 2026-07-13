// Notification functions

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
  read: boolean;
}

export const sendNotification = async (
  userId: string,
  message: string,
  type: Notification['type'] = 'info'
): Promise<Notification> => {
  if (!userId || !message) {
    throw new Error('User ID and message are required');
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    userId,
    message,
    type,
    createdAt: new Date().toISOString(),
    read: false,
  };
};

export const getNotifications = async (userId: string): Promise<Notification[]> => {
  return [
    {
      id: 'notif-1',
      userId,
      message: 'You have been enrolled in a new course',
      type: 'info',
      createdAt: new Date().toISOString(),
      read: false,
    },
  ];
};

export const markAsRead = async (notificationId: string): Promise<Notification> => {
  return {
    id: notificationId,
    userId: 'user-123',
    message: 'Sample message',
    type: 'info',
    createdAt: new Date().toISOString(),
    read: true,
  };
};
