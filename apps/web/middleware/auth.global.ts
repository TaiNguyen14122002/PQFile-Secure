export default defineNuxtRouteMiddleware(async to=>{
  if(import.meta.server)return;
  const publicRoutes=['/','/login','/register','/onboarding'];
  const {user,loaded,load}=useAuth();
  if(!loaded.value)await load();
  if(!user.value && !publicRoutes.includes(to.path))return navigateTo('/login');
  if(user.value && (to.path==='/login'||to.path==='/register'))return navigateTo('/dashboard');
});
