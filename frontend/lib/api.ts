import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Task API calls
export const taskApi = {
  getAll: () => apiClient.get('/api/tasks'),
  getById: (id: string) => apiClient.get(`/api/tasks/${id}`),
  create: (data: any) => apiClient.post('/api/tasks', data),
  update: (id: string, data: any) => apiClient.patch(`/api/tasks/${id}`, data),
};

// Execution API calls
export const executionApi = {
  getByTaskId: (taskId: string) => apiClient.get(`/api/executions?taskId=${taskId}`),
  startExecution: (taskId: string) => apiClient.post(`/api/tasks/${taskId}/execute`),
};

// PullRequest API calls
export const prApi = {
  getByTaskId: (taskId: string) => apiClient.get(`/api/pull-requests?taskId=${taskId}`),
};
