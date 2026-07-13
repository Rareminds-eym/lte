// Authentication functions

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: string;
  email: string;
}

export const login = async (request: LoginRequest): Promise<LoginResponse> => {
  // Mock implementation - replace with actual authentication logic
  if (!request.email || !request.password) {
    throw new Error('Email and password are required');
  }

  return {
    token: 'jwt-token-mock',
    userId: 'user-123',
    email: request.email,
  };
};

export const logout = async (): Promise<void> => {
  // Clear session/token logic here
};
