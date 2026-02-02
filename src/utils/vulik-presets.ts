type Preset = {
  name: string;
  host: string;
  port: number;
};

export const getVulikPresets = (): Preset[] => {
  const presetsString = import.meta.env.VITE_APP_VULIK_PRESETS;
  if (!presetsString) {
    return [];
  }

  return presetsString.split(",").map((preset: string) => {
    const [name, host, port] = preset.split(":");
    return {
      name,
      host,
      port: parseInt(port, 10),
    };
  });
};
