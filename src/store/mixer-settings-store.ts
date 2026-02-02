import { useStorage } from "@vueuse/core";
import { defineStore } from "pinia";
import { rcMixes, type Mix } from "@/controllers/rc-mixes";
import { config } from "@/config";

export const useMixerStettings = defineStore("mixer-settings", () => {
  const mixes = useStorage<Mix[] | null>("mixes", []);

  const setDefaultMixes = () => {
    rcMixes.resetMixes();

    if (config.defaultMixer == null) {
      return;
    }
    
    config.defaultMixer.split(",").forEach((mix: string) => {
      const [input, output, reverse] = mix.split("-");

      rcMixes.changeMix({
        min: 0,
        max: 100,
        input,
        output,
        reverse: reverse === "R",
      });
    });
  };

  const restoreValues = () => {
    if (mixes.value == null || mixes.value.length === 0) {
      setDefaultMixes();
      mixes.value = [...rcMixes.mixes];
    }

    rcMixes.setMixes(mixes.value);
  };

  const setMixes = (input: Mix[]) => {
    for (const mix of input) {
      rcMixes.changeMix(mix);
    }

    mixes.value = [...rcMixes.mixes];
  };

  const setMix = (mix: Mix) => {
    rcMixes.changeMix(mix);
    mixes.value = [...rcMixes.mixes];
  };

  restoreValues();

  return { mixes, setMixes, setMix, restoreValues };
});
