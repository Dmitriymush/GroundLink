import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { createInitiatorService } from '@/services/api';
import type { Device, GetDevicesListResponse, SetCommandResponse } from '@/services/api/initiator-service';

export function useInitiatorConnection(endpoint?: string, accessToken?: string) {
  const service = createInitiatorService(endpoint, accessToken);
  
  return useQuery({
    queryKey: service.getConnectionQueryKey(),
    queryFn: () => service.ping(),
    refetchInterval: 5000, // 5 seconds
    initialData: false,
  });
}

export function useInitiatorDevicesList(endpoint?: string, accessToken?: string) {
  const service = createInitiatorService(endpoint, accessToken);
  
  return useQuery({
    queryKey: service.getDevicesListQueryKey(),
    queryFn: () => service.getDevicesList(),
    enabled: false, // Only fetch when explicitly called
  });
}

export function useInitiatorDeviceCommand(id: string, endpoint?: string, accessToken?: string) {
  const service = createInitiatorService(endpoint, accessToken);
  
  return useQuery({
    queryKey: service.getDeviceCommandQueryKey(id),
    queryFn: () => service.getDeviceCommand(id),
    enabled: !!id,
  });
}

// Mutations
export function useSetInitiatorDeviceCommand(endpoint?: string, accessToken?: string) {
  const service = createInitiatorService(endpoint, accessToken);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: string }) => 
      service.setDeviceCommand(id, command),
    onSuccess: (_, { id }) => {
      // Invalidate the specific device command query
      queryClient.invalidateQueries({ 
        queryKey: service.getDeviceCommandQueryKey(id) 
      });
    },
  });
}

export function useBroadcastInitiatorCommand(endpoint?: string, accessToken?: string) {
  const service = createInitiatorService(endpoint, accessToken);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (command: string) => service.broadcastCommand(command),
    onSuccess: () => {
      // Invalidate all device commands after broadcast
      queryClient.invalidateQueries({ 
        queryKey: service.getDevicesListQueryKey() 
      });
    },
  });
}

export function useInitiatorRequestWithTimeout(endpoint?: string, accessToken?: string) {
  const service = createInitiatorService(endpoint, accessToken);
  
  return useMutation({
    mutationFn: (timeSeconds: number) => service.requestWithTimeout(timeSeconds),
  });
}
