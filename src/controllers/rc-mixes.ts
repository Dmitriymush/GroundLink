import { ipcRenderer } from "electron";
import _ from 'lodash';

export type Mix = {
  input: string; //readony
  output: string;
  reverse: boolean;
  min: number;
  max: number;
};

class RcMixes {
  public mixes: Array<Mix>;

  constructor() {
    this.mixes = [];
  }

  public setMixes(mixes: Array<Mix>): RcMixes {
    this.mixes = mixes;
    ipcRenderer.invoke("hid", {
      mixes: _.cloneDeep(this.mixes),
    });
    return this;
  }

  public changeMix(mix: Mix): RcMixes {
    this.mixes = this.mixes.map((m) => {
      return m.output === mix.output ? mix : m;
    });

    ipcRenderer.invoke("hid", {
      mixes: _.cloneDeep(this.mixes),
    });
    return this;
  }

  public resetMixes(): RcMixes {
    this.mixes = [
      {
        input: "CH1",
        output: "CH1",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH2",
        output: "CH2",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH3",
        output: "CH3",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH4",
        output: "CH4",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH5",
        output: "CH5",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH6",
        output: "CH6",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH7",
        output: "CH7",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH8",
        output: "CH8",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH9",
        output: "CH9",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH10",
        output: "CH10",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH11",
        output: "CH11",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH12",
        output: "CH12",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH13",
        output: "CH13",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH14",
        output: "CH14",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH15",
        output: "CH15",
        reverse: false,
        min: 0,
        max: 100,
      },
      {
        input: "CH16",
        output: "CH16",
        reverse: false,
        min: 0,
        max: 100,
      },
    ];

    ipcRenderer.invoke("hid", {
      mixes: _.cloneDeep(this.mixes),
    });
    return this;
  }

  
}

export const rcMixes = new RcMixes();
