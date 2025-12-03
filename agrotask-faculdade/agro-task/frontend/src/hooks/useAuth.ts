import { useState, useEffect, createContext, useContext } from 'react';
import { authService, User, LoginCredentials, RegisterData } from '../services/authService';
import { useToast } from './use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  recoverPassword: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthProvider = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const isAuthenticated = !!user;

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await authService.login(credentials);

      if (response.success && response.data) {
        setUser(response.data.user);
        toast({
          title: "Sucesso",
          description: "Login realizado com sucesso!",
        });
        return true;
      } else {
        toast({
          title: "Erro",
          description: response.error || "Credenciais inválidas",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro de conexão com o servidor",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await authService.register(userData);

      if (response.success) {
        toast({
          title: "Sucesso",
          description: "Conta de administrador criada com sucesso!",
        });
        return true;
      } else {
        toast({
          title: "Erro",
          description: response.error || "Falha ao criar conta",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro de conexão com o servidor",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
      setUser(null);
      toast({
        title: "Sucesso",
        description: "Logout realizado com sucesso",
      });
    } catch (error) {
      // Even if logout fails on server, clear local state
      setUser(null);
      authService.clearAuth();
    }
  };

  const recoverPassword = async (email: string): Promise<boolean> => {
    try {
      const response = await authService.sendPasswordReset(email);

      if (response.success) {
        toast({
          title: "Sucesso",
          description: "Se o email existir, você receberá um link de recuperação",
        });
        return true;
      } else {
        toast({
          title: "Erro",
          description: response.error || "Falha ao enviar email de recuperação",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro de conexão com o servidor",
        variant: "destructive",
      });
      return false;
    }
  };

  const checkAuth = async (forceRefresh = false): Promise<void> => {
    try {
      setLoading(true);
      
      // First check if we have a token
      const token = authService.getToken();
      const storedUser = authService.getUser();
      
      if (!token) {
        // No token means definitely not authenticated
        setUser(null);
        setLoading(false);
        return;
      }

      // If we have cached user and valid admin check, use it immediately (fast path)
      if (!forceRefresh && storedUser) {
        const cachedAdmin = authService.getCachedAdminCheck();
        if (cachedAdmin && cachedAdmin.isAdmin) {
          // Use cached data immediately - user appears authenticated
          setUser(storedUser);
          setLoading(false);
          
          // Verify in background (non-blocking)
          authService.verifySession().then(response => {
            if (response.success && response.data) {
              setUser(response.data.user);
            } else {
              // Background verification failed, refresh auth
              checkAuth(true);
            }
          }).catch(() => {
            // Silent fail - user already sees authenticated UI
          });
          return;
        }
      }

      // No cache or force refresh - verify with server
      const response = await authService.verifySession(forceRefresh);
      
      if (response.success && response.data) {
        // Token is valid, set user data
        setUser(response.data.user);
        authService.setUser(response.data.user);
      } else {
        // Token is invalid, clear all auth data
        authService.clearAuth();
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      // On any error, clear auth to be safe
      authService.clearAuth();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    checkAuth,
    recoverPassword,
  };
};

export { AuthContext };

