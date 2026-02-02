import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { createMegaServerService } from '@/services/api';
import type { CanDevice, ChangeRelayStateParams, ChangeLeadStateParams } from '@/services/api/mega-server-service';

export function useMegaServerConnection(host?: string, port?: number) {
  const service = createMegaServerService(host, port);
  
  return useQuery({
    queryKey: service.getConnectionQueryKey(),
    queryFn: () => service.ping(),
    refetchInterval: 5000, // 5 seconds
    initialData: false,
  });
}

export function useMegaServerCanDevices(host?: string, port?: number) {
  const service = createMegaServerService(host, port);
  
  return useQuery({
    queryKey: service.getCanDevicesQueryKey(),
    queryFn: () => service.getCanDevices(),
    refetchInterval: 1000, // 1 second for real-time data
    enabled: false, // Only fetch when explicitly called
  });
}

export function useMegaServerRelayState(type: string, id: number, host?: string, port?: number) {
  const service = createMegaServerService(host, port);
  
  return useQuery({
    queryKey: service.getRelayStateQueryKey(type, id),
    queryFn: () => Promise.resolve(false), // MegaServer doesn't provide state reading, so we assume false
    enabled: false,
    initialData: false,
  });
}

export function useMegaServerLeadState(id: number, host?: string, port?: number) {
  const service = createMegaServerService(host, port);
  
  return useQuery({
    queryKey: service.getLeadStateQueryKey(id),
    queryFn: () => Promise.resolve(false), // MegaServer doesn't provide state reading, so we assume false
    enabled: false,
    initialData: false,
  });
}

// Mutations
export function useChangeMegaServerRelayState(host?: string, port?: number) {
  const service = createMegaServerService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: ChangeRelayStateParams) => service.changeRelayState(params),
    onSuccess: (_, { type, id }) => {
      // Invalidate the specific relay state query
      queryClient.invalidateQueries({ 
        queryKey: service.getRelayStateQueryKey(type, id) 
      });
      // Also invalidate CAN devices list
      queryClient.invalidateQueries({ 
        queryKey: service.getCanDevicesQueryKey() 
      });
    },
  });
}

export function useChangeMegaServerLeadState(host?: string, port?: number) {
  const service = createMegaServerService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: ChangeLeadStateParams) => service.changeLeadState(params),
    onSuccess: (_, { id }) => {
      // Invalidate the specific lead state query
      queryClient.invalidateQueries({ 
        queryKey: service.getLeadStateQueryKey(id) 
      });
      // Also invalidate CAN devices list
      queryClient.invalidateQueries({ 
        queryKey: service.getCanDevicesQueryKey() 
      });
    },
  });
}

export function useTestMegaServerCartridge(host?: string, port?: number) {
  const service = createMegaServerService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => service.testCartridge(id),
    onSuccess: () => {
      // Invalidate CAN devices list after cartridge test
      queryClient.invalidateQueries({ 
        queryKey: service.getCanDevicesQueryKey() 
      });
    },
  });
}
