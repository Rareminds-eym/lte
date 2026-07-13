// User management functions

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const getUser = async (userId: string): Promise<User> => {
  // Mock implementation - replace with actual database query
  if (!userId) {
    throw new Error('User ID is required');
  }

  return {
    id: userId,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
  };
};

export const createUser = async (userData: Omit<User, 'id'>): Promise<User> => {
  const id = Math.random().toString(36).substr(2, 9);
  return { ...userData, id };
};

export const updateUser = async (
  userId: string,
  updates: Partial<User>
): Promise<User> => {
  const user = await getUser(userId);
  return { ...user, ...updates };
};
