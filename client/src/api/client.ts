import axios, { type AxiosError } from 'axios';
import logger from '../lib/logger';

const log = logger.child('api');

const client = axios.create({ baseURL: '/api/v1' });

client.interceptors.request.use((config) => {
  log.debug(`→ ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

client.interceptors.response.use(
  (response) => {
    log.debug(`← ${response.status} ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const message = (error.response?.data as { message?: string })?.message ?? error.message;

    if (status && status >= 500) {
      log.error(`← ${status} ${url}`, { message });
    } else if (status) {
      log.warn(`← ${status} ${url}`, { message });
    } else {
      log.error(`Network error: ${url}`, { message });
    }

    return Promise.reject(error);
  },
);

export default client;
