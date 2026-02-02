import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { createDroneService } from '@/services/api';
import type { Drone, LeadState } from '@/services/api/drone-service';

export function useDroneConnection(host?: string, port?: number) {
  const service = createDroneService(host, port);
  
  return useQuery({
    queryKey: service.getConnectionQueryKey(),
    queryFn: () => service.ping(),
    refetchInterval: 1000, // 1 second for real-time data
    initialData: false,
  });
}

export function useDrones(host?: string, port?: number) {
  const service = createDroneService(host, port);
  
  return useQuery({
    queryKey: service.getDronesQueryKey(),
    queryFn: () => service.getDrones(),
    refetchInterval: 60000, // 60 seconds
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}

export function useDrone(id: string, host?: string, port?: number) {
  const service = createDroneService(host, port);
  
  return useQuery({
    queryKey: service.getDroneQueryKey(id),
    queryFn: () => service.getDrone(id),
    enabled: !!id,
  });
}

export function useDroneLeadState(droneId: string, host?: string, port?: number) {
  const service = createDroneService(host, port);
  
  return useQuery({
    queryKey: service.getLeadStateQueryKey(droneId),
    queryFn: () => Promise.resolve(LeadState.close), // Default state
    enabled: !!droneId,
    initialData: LeadState.close,
  });
}

// Mutations
export function useChangeDroneLeadState(host?: string, port?: number) {
  const service = createDroneService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ droneId, leadState }: { droneId: string; leadState: LeadState.open | LeadState.close }) => 
      service.changeLeadState(droneId, leadState),
    onSuccess: (data, { droneId }) => {
      // Invalidate the specific drone query
      queryClient.invalidateQueries({ 
        queryKey: service.getDroneQueryKey(droneId) 
      });
      // Invalidate lead state query
      queryClient.invalidateQueries({ 
        queryKey: service.getLeadStateQueryKey(droneId) 
      });
      // Invalidate drones list
      queryClient.invalidateQueries({ 
        queryKey: service.getDronesQueryKey() 
      });
    },
  });
}

export function useUnloadDrone(host?: string, port?: number) {
  const service = createDroneService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (droneId: string) => service.unloadDrone(droneId),
    onSuccess: (_, droneId) => {
      // Invalidate the specific drone query
      queryClient.invalidateQueries({ 
        queryKey: service.getDroneQueryKey(droneId) 
      });
      // Invalidate drones list
      queryClient.invalidateQueries({ 
        queryKey: service.getDronesQueryKey() 
      });
    },
  });
}
