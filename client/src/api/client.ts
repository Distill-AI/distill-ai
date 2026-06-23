import axios, { type AxiosError } from 'axios';
import logger from '../lib/logger';

const log = logger.child('api');

const client = axios.create({ baseURL: '/api/v1' });

client.interceptors.request.use((config) => {
  const requestId = crypto.randomUUID();
  config.headers['X-Request-Id'] = requestId;
  log.debug(`→ ${config.method?.toUpperCase()} ${config.url}`, { requestId });
  return config;
});

client.interceptors.response.use(
  (response) => {
    const requestId = response.headers['x-request-id'] as string | undefined;
    log.debug(`← ${response.status} ${response.config.url}`, { requestId });
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const message = (error.response?.data as { message?: string })?.message ?? error.message;
    const requestId = (error.response?.headers['x-request-id'] ??
      error.config?.headers?.['X-Request-Id']) as string | undefined;

    if (status && status >= 500) {
      log.error(`← ${status} ${url}`, { requestId, message });
    } else if (status) {
      log.warn(`← ${status} ${url}`, { requestId, message });
    } else {
      log.error(`Network error: ${url}`, { requestId, message });
    }

    return Promise.reject(error);
  },
);

export default client;
