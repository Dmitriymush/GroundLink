import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { createHardwareService } from '@/services/api';
import type { 
  RelayState, 
  ModemState, 
  CanDevice, 
  ChangeRelayStateParams, 
  ChangeLeadStateParams 
} from '@/services/api/hardware-service';

// ===== CONNECTION =====
export function useHardwareConnection(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  
  return useQuery({
    queryKey: service.getConnectionQueryKey(),
    queryFn: () => service.ping(),
    refetchInterval: 5000, // 5 seconds
    initialData: false,
  });
}

// ===== RELAY CONTROL =====
export function useRelayState(relay: number, host?: string, port?: number) {
  const service = createHardwareService(host, port);
  
  return useQuery({
    queryKey: service.getRelayStateQueryKey(relay),
    queryFn: () => Promise.resolve(false), // Hardware doesn't provide state reading, so we assume false
    enabled: false,
    initialData: false,
  });
}

export function useChangeRelayState(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ relay, state }: { relay: number; state: boolean }) => 
      service.changeRelayState(relay, state),
    onSuccess: (_, { relay }) => {
      // Invalidate the specific relay state query
      queryClient.invalidateQueries({ 
        queryKey: service.getRelayStateQueryKey(relay) 
      });
    },
  });
}

export function useChangeMultipleRelays(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (states: RelayState[]) => service.changeMultipleRelays(states),
    onSuccess: (_, states) => {
      // Invalidate all relay state queries that were changed
      states.forEach(({ relay }) => {
        queryClient.invalidateQueries({ 
          queryKey: service.getRelayStateQueryKey(relay) 
        });
      });
    },
  });
}

// ===== MODEM CONTROL =====
export function useModemState(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  
  return useQuery({
    queryKey: service.getModemStateQueryKey(),
    queryFn: () => service.getModemState(),
    refetchInterval: 1000, // 1 second for real-time data
    enabled: false, // Only fetch when explicitly called
  });
}

export function useStartModemTimer(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => service.startModemTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: service.getModemStateQueryKey() 
      });
    },
  });
}

export function useSetModemTimer(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (timer: number) => service.setModemTimer(timer),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: service.getModemStateQueryKey() 
      });
    },
  });
}

export function useStopModemTimer(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => service.stopModemTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: service.getModemStateQueryKey() 
      });
    },
  });
}

export function useDisableModem(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => service.disableModem(),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: service.getModemStateQueryKey() 
      });
    },
  });
}

export function useEnableModem(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => service.enableModem(),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: service.getModemStateQueryKey() 
      });
    },
  });
}

// ===== CAN DEVICE CONTROL =====
export function useCanDevices(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  
  return useQuery({
    queryKey: service.getCanDevicesQueryKey(),
    queryFn: () => service.getCanDevices(),
    refetchInterval: 1000, // 1 second for real-time data
    enabled: false, // Only fetch when explicitly called
  });
}

export function useCanRelayState(type: string, id: number, host?: string, port?: number) {
  const service = createHardwareService(host, port);
  
  return useQuery({
    queryKey: service.getCanRelayStateQueryKey(type, id),
    queryFn: () => Promise.resolve(false), // CAN doesn't provide state reading, so we assume false
    enabled: false,
    initialData: false,
  });
}

export function useCanLeadState(id: number, host?: string, port?: number) {
  const service = createHardwareService(host, port);
  
  return useQuery({
    queryKey: service.getCanLeadStateQueryKey(id),
    queryFn: () => Promise.resolve(false), // CAN doesn't provide state reading, so we assume false
    enabled: false,
    initialData: false,
  });
}

export function useChangeCanRelayState(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: ChangeRelayStateParams) => service.changeCanRelayState(params),
    onSuccess: (_, { type, id }) => {
      // Invalidate the specific CAN relay state query
      queryClient.invalidateQueries({ 
        queryKey: service.getCanRelayStateQueryKey(type, id) 
      });
      // Also invalidate CAN devices list
      queryClient.invalidateQueries({ 
        queryKey: service.getCanDevicesQueryKey() 
      });
    },
  });
}

export function useChangeCanLeadState(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: ChangeLeadStateParams) => service.changeCanLeadState(params),
    onSuccess: (_, { id }) => {
      // Invalidate the specific CAN lead state query
      queryClient.invalidateQueries({ 
        queryKey: service.getCanLeadStateQueryKey(id) 
      });
      // Also invalidate CAN devices list
      queryClient.invalidateQueries({ 
        queryKey: service.getCanDevicesQueryKey() 
      });
    },
  });
}

export function useTestCanCartridge(host?: string, port?: number) {
  const service = createHardwareService(host, port);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => service.testCanCartridge(id),
    onSuccess: () => {
      // Invalidate CAN devices list after cartridge test
      queryClient.invalidateQueries({ 
        queryKey: service.getCanDevicesQueryKey() 
      });
    },
  });
}
