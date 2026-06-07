import SettingsPage from "@/components/pages/SettingsPage.vue";
import RemoteControllPage from "@/components/pages/RemoteControllPage.vue";
import AntenaControllPage from "@/components/pages/AntenaControllPage.vue";
import SecondJrAntenaControllPage from "@/components/pages/SecondJRantennaControllPage.vue";
import BeePage from "@/components/pages/BeePage.vue";
import DroneControllPage from "@/components/pages/DroneContro0llPage.vue";
import RemoteControllV2Page from "@/components/pages/RemoteControllV2Page.vue";
import CanControllPage from "@/components/pages/CanControllPage.vue";
import VulikControllPage from "@/components/pages/VulikControllPage.vue";
import BombPage from "@/components/pages/BombPage.vue";
import AntennaFloatingPage from "@/components/pages/AntennaFloatingPage.vue";
import CameraFloatingPage from "@/components/pages/CameraFloatingPage.vue";
import CameraControllPage from "@/components/pages/CameraControllPage.vue";

import { ROUTERS } from "./const";

export const routes = [
  { path: ROUTERS.SETTINGS, component: SettingsPage },
  { path: ROUTERS.REMOTE_CONTROLL, component: RemoteControllPage },
  { path: ROUTERS.ANTENA_CONTROLL, component: AntenaControllPage },
  { path: ROUTERS.BEE, component: BeePage },
  {
    path: ROUTERS.SECOND_JR_ANTENNA_CONTROLL,
    component: SecondJrAntenaControllPage,
  },
  { path: ROUTERS.DRONE_CONTROLL, component: DroneControllPage },
  { path: ROUTERS.REMOTE_CONTROLL_V2, component: RemoteControllV2Page },
  { path: ROUTERS.CAN_CONTROLL, component: CanControllPage },
  { path: ROUTERS.VULIK_CONTROLL, component: VulikControllPage },
  { path: ROUTERS.DETONATE, component: BombPage },
  { path: ROUTERS.ANTENNA_FLOATING, component: AntennaFloatingPage },
  { path: ROUTERS.CAMERA_CONTROLL, component: CameraControllPage },
  { path: ROUTERS.CAMERA_FLOATING, component: CameraFloatingPage },
];
