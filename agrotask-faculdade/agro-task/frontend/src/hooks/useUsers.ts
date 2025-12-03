import { useState, useEffect } from 'react';
import { userService, User, CreateUserData, UpdateUserData } from '../services/userService';
import { useToast } from './use-toast';

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      console.log('fetchUsers: Starting to fetch users...');
      setLoading(true);
      setError(null);
      const response = await userService.getAllUsers();
      console.log('fetchUsers: Received response:', response);
      
      if (response.success && response.data) {
        console.log('fetchUsers: Setting users data:', response.data);
        setUsers(response.data);
      } else {
        console.error('fetchUsers: Error in response:', response.error);
        setError(response.error || 'Failed to fetch users');
        toast({
          title: "Erro",
          description: response.error || 'Falha ao carregar usuários',
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('fetchUsers: Exception caught:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Erro",
        description: 'Erro de conexão com o servidor',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData: CreateUserData): Promise<boolean> => {
    try {
      const response = await userService.createUser(userData);
      
      if (response.success && response.data) {
        setUsers(prev => [response.data!, ...prev]);
        toast({
          title: "Sucesso",
          description: 'Usuário criado com sucesso',
        });
        return true;
      } else {
        toast({
          title: "Erro",
          description: response.error || 'Falha ao criar usuário',
          variant: "destructive",
        });
        return false;
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: 'Erro de conexão com o servidor',
        variant: "destructive",
      });
      return false;
    }
  };

  const updateUser = async (id: string, userData: UpdateUserData): Promise<boolean> => {
    try {
      const response = await userService.updateUser(id, userData);
      
      if (response.success && response.data) {
        setUsers(prev => 
          prev.map(user => user.id === id ? response.data! : user)
        );
        toast({
          title: "Sucesso",
          description: 'Usuário atualizado com sucesso',
        });
        return true;
      } else {
        toast({
          title: "Erro",
          description: response.error || 'Falha ao atualizar usuário',
          variant: "destructive",
        });
        return false;
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: 'Erro de conexão com o servidor',
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    try {
      const response = await userService.deleteUser(id);
      
      if (response.success) {
        setUsers(prev => prev.filter(user => user.id !== id));
        toast({
          title: "Sucesso",
          description: 'Usuário excluído com sucesso',
        });
        return true;
      } else {
        toast({
          title: "Erro",
          description: response.error || 'Falha ao excluir usuário',
          variant: "destructive",
        });
        return false;
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: 'Erro de conexão com o servidor',
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  };
};
