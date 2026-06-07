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
