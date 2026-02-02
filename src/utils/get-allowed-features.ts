export const getAllowedFeatures = (): string[] => {
  return import.meta.env.VITE_APP_BUILD_FEATURES?.split(",").map((feature: string) =>
    feature.trim().replaceAll(/['"]+/g, "")
  ) || [];
};
