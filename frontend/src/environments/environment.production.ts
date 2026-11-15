export const environment = {
  production: true,
  // Same origin as the app: nginx (frontend/nginx.conf.template) forwards
  // /api/ to the backend service.
  backendUrl: '/api',
};
