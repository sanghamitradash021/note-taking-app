export interface IUser {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITag {
  id: string;
  name: string;
}

export interface INote {
  id: string;
  userId: string;
  title: string;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: ITag[];
}

export interface IApiError {
  code: string;
  message: string;
  fields?: string[];
}

export interface IApiResponse<T> {
  data: T;
}

export interface IApiErrorResponse {
  error: IApiError;
}

// Auth response shapes

export interface IRegisterResponse {
  userId: string;
}

export interface ILoginUser {
  id: string;
  email: string;
}

export interface ILoginResponse {
  accessToken: string;
  refreshToken: string;
  user: ILoginUser;
}

export interface IRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// JWT payload shapes (not API responses — used by tokenHelpers + authMiddleware)

export interface IAccessTokenPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface IRefreshTokenPayload {
  sub: string;
  iat?: number;
  exp?: number;
}
