import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { createRPanionService } from '@/services/api';
import type { VideoSettings, VideoSettingsShortParmas, TelemetrySettings } from '@/services/api/rpanion-service';

export function useRPanionConnection(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: service.getConnectionQueryKey(host),
    queryFn: () => service.checkConnection(),
    refetchInterval: 5000, // 5 seconds
    initialData: false,
  });
}

export function useRPanionVideoSettings(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: service.getVideoSettingsQueryKey(),
    queryFn: () => service.getVideoSettings(),
    enabled: false, // Only fetch when explicitly called
  });
}

export function useRPanionVideoDevices(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: ['rpanion-video-devices'],
    queryFn: () => service.getVideoDevices(),
    enabled: false,
  });
}

export function useRPanionTelemetrySettings(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: service.getTelemetrySettingsQueryKey(),
    queryFn: () => service.getTelemetrySettings(),
    enabled: false,
  });
}

export function useRPanionFCDetails(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: service.getFCDetailsQueryKey(),
    queryFn: () => service.getFCDetails(),
    refetchInterval: 1000, // 1 second for real-time data
  });
}

export function useRPanionFCOutputs(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: service.getFCOutputsQueryKey(),
    queryFn: () => service.getFCOutputs(),
    refetchInterval: 1000, // 1 second for real-time data
  });
}

export function useRPanionSerialPorts(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: service.getSerialPortsQueryKey(),
    queryFn: () => service.getSerialPorts(),
    enabled: false,
  });
}

export function useRPanionMavVersions(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: service.getMavVersionsQueryKey(),
    queryFn: () => service.getMavVersions(),
    enabled: false,
  });
}

export function useRPanionBaudRates(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: service.getBaudRatesQueryKey(),
    queryFn: () => service.getBaudRates(),
    enabled: false,
  });
}

export function useRPanionEthernetSettings(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: service.getEthernetSettingsQueryKey(),
    queryFn: () => service.getEthernetSettings(),
    enabled: false,
  });
}

export function useRPanionVpnConfig(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: service.getVpnConfigQueryKey(),
    queryFn: () => service.getVpnConfig(),
    enabled: false,
  });
}

export function useRPanionVersionInfo(host?: string) {
  const service = createRPanionService(host);
  
  return useQuery({
    queryKey: service.getVersionInfoQueryKey(),
    queryFn: () => service.getVersionInfo(),
    enabled: false,
  });
}

// Mutations
export function useUpdateRPanionVideoSettings(host?: string) {
  const service = createRPanionService(host);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (settings: Partial<VideoSettings>) => service.updateVideoSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: service.getVideoSettingsQueryKey() });
    },
  });
}

export function useUpdateRPanionTelemetrySettings(host?: string) {
  const service = createRPanionService(host);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (settings: Partial<TelemetrySettings>) => service.updateTelemetrySettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: service.getTelemetrySettingsQueryKey() });
    },
  });
}

export function useStartRPanionVideoStream(host?: string) {
  const service = createRPanionService(host);
  
  return useMutation({
    mutationFn: (params: VideoSettingsShortParmas) => service.startVideoStream(params),
  });
}

export function useStopRPanionVideoStream(host?: string) {
  const service = createRPanionService(host);
  
  return useMutation({
    mutationFn: () => service.stopVideoStream(),
  });
}

export function useRPanionReboot(host?: string) {
  const service = createRPanionService(host);
  
  return useMutation({
    mutationFn: () => service.reboot(),
  });
}

export function useRPanionShutdown(host?: string) {
  const service = createRPanionService(host);
  
  return useMutation({
    mutationFn: () => service.shutdown(),
  });
}

export function useUpdateRPanionEthernetSettings(host?: string) {
  const service = createRPanionService(host);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (settings: { gateway: string }) => service.updateEthernetSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: service.getEthernetSettingsQueryKey() });
    },
  });
}

export function useUpdateRPanionVpnConfig(host?: string) {
  const service = createRPanionService(host);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (config: any) => service.updateVpnConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: service.getVpnConfigQueryKey() });
    },
  });
}

export function useActivateRPanionVpn(host?: string) {
  const service = createRPanionService(host);

  return useMutation({
    mutationFn: () => service.activateVpn(),
  });
}

// Gateway hooks (aliases for ethernet settings)
export function useRPanionGateway(host?: string) {
  const service = createRPanionService(host);

  return useQuery({
    queryKey: service.getEthernetSettingsQueryKey(),
    queryFn: () => service.getEthernetSettings(),
    refetchInterval: 5000,
  });
}

export function useSetRPanionGateway(host?: string) {
  const service = createRPanionService(host);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gateway: string) => service.updateEthernetSettings({ gateway }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: service.getEthernetSettingsQueryKey() });
    },
  });
}

// Alias for telemetry settings mutation
export function useChangeRPanionTelemetrySettings(host?: string) {
  return useUpdateRPanionTelemetrySettings(host);
}

// Alias for video settings mutation
export function useChangeRPanionVideoSettings(host?: string) {
  return useUpdateRPanionVideoSettings(host);
}

// Video settings list (alias for video settings)
export function useRPanionVideoSettingsList(host?: string) {
  return useRPanionVideoSettings(host);
}

// Fix video (alias for stop)
export function useFixRPanionVideo(host?: string) {
  return useStopRPanionVideoStream(host);
}

// Alias for stop video
export function useStopRPanionVideo(host?: string) {
  return useStopRPanionVideoStream(host);
}
