export type PainMapView = "front" | "back";

export type RegionPath = {
  common?: string[];
  left?: string[];
  right?: string[];
};

export type PainRegion = {
  id: string;
  label: string;
  view: PainMapView;
  path: RegionPath;
  mapTo: "neck" | "upper-back" | "lower-back" | "left-arm" | "right-arm" | "left-leg" | "right-leg" | "central";
  routeGroup: "cervical" | "thoracic" | "lumbar" | "peripheral";
};

export type NervePath = {
  id: string;
  label: string;
  side: "left" | "right" | "both";
  view: "back";
  pathD: string;
  hitPathD: string;
  routeGroup: "cervical" | "lumbar";
  defaultSeverity: number;
};

export const painMapImages: Record<PainMapView, string> = {
  front: "/illustrations/pain-map/nerve-spine-front.svg",
  back: "/illustrations/pain-map/nerve-spine-back.svg",
};

export const painRegions: PainRegion[] = [
  {
    id: "cervical",
    label: "Cervical spine",
    view: "back",
    path: { common: ["M47 13 C47 10 49 8 52 8 C55 8 57 10 57 13 C57 17 55 20 52 20 C49 20 47 17 47 13 Z"] },
    mapTo: "neck",
    routeGroup: "cervical",
  },
  {
    id: "thoracic",
    label: "Thoracic spine",
    view: "back",
    path: { common: ["M46 22 C46 20 48 18 52 18 C56 18 58 20 58 22 L58 37 C58 40 56 42 52 42 C48 42 46 40 46 37 Z"] },
    mapTo: "upper-back",
    routeGroup: "thoracic",
  },
  {
    id: "lumbar",
    label: "Lumbar spine",
    view: "back",
    path: { common: ["M46 41 C46 39 48 37 52 37 C56 37 58 39 58 41 L58 55 C58 58 56 60 52 60 C48 60 46 58 46 55 Z"] },
    mapTo: "lower-back",
    routeGroup: "lumbar",
  },
  {
    id: "sacral",
    label: "Sacral / SI zone",
    view: "back",
    path: { common: ["M44 56 C47 54 57 54 60 56 L62 61 C60 66 56 69 52 69 C48 69 44 66 42 61 Z"] },
    mapTo: "lower-back",
    routeGroup: "lumbar",
  },
  {
    id: "left-cerv-rad",
    label: "Left cervical radicular",
    view: "back",
    path: { left: ["M33 23 C39 19 44 20 47 24 L41 31 C36 30 33 27 33 23 Z"] },
    mapTo: "left-arm",
    routeGroup: "cervical",
  },
  {
    id: "right-cerv-rad",
    label: "Right cervical radicular",
    view: "back",
    path: { right: ["M71 23 C65 19 60 20 57 24 L63 31 C68 30 71 27 71 23 Z"] },
    mapTo: "right-arm",
    routeGroup: "cervical",
  },
  {
    id: "left-lumbar-rad",
    label: "Left lumbar radicular",
    view: "back",
    path: { left: ["M34 61 C40 58 45 58 48 63 C45 70 40 75 34 76 C31 72 31 66 34 61 Z"] },
    mapTo: "left-leg",
    routeGroup: "lumbar",
  },
  {
    id: "right-lumbar-rad",
    label: "Right lumbar radicular",
    view: "back",
    path: { right: ["M70 61 C64 58 59 58 56 63 C59 70 64 75 70 76 C73 72 73 66 70 61 Z"] },
    mapTo: "right-leg",
    routeGroup: "lumbar",
  },
  {
    id: "front-neck",
    label: "Anterior neck",
    view: "front",
    path: { common: ["M47 15 C47 12 49 10 52 10 C55 10 57 12 57 15 C57 18 55 20 52 20 C49 20 47 18 47 15 Z"] },
    mapTo: "neck",
    routeGroup: "cervical",
  },
  {
    id: "front-chest-center",
    label: "Anterior central",
    view: "front",
    path: { common: ["M43 26 C46 22 58 22 61 26 L62 39 C59 43 45 43 42 39 Z"] },
    mapTo: "central",
    routeGroup: "thoracic",
  },
  {
    id: "front-left-arm",
    label: "Left arm pathway",
    view: "front",
    path: { left: ["M29 32 C35 29 39 31 41 36 C38 44 34 49 29 52 C26 47 26 38 29 32 Z"] },
    mapTo: "left-arm",
    routeGroup: "cervical",
  },
  {
    id: "front-right-arm",
    label: "Right arm pathway",
    view: "front",
    path: { right: ["M75 32 C69 29 65 31 63 36 C66 44 70 49 75 52 C78 47 78 38 75 32 Z"] },
    mapTo: "right-arm",
    routeGroup: "cervical",
  },
  {
    id: "front-left-leg",
    label: "Left leg pathway",
    view: "front",
    path: { left: ["M43 61 C46 58 49 58 50 63 C49 74 47 84 44 92 C40 87 39 72 43 61 Z"] },
    mapTo: "left-leg",
    routeGroup: "lumbar",
  },
  {
    id: "front-right-leg",
    label: "Right leg pathway",
    view: "front",
    path: { right: ["M61 61 C58 58 55 58 54 63 C55 74 57 84 60 92 C64 87 65 72 61 61 Z"] },
    mapTo: "right-leg",
    routeGroup: "lumbar",
  },
];

export const nervePaths: NervePath[] = [
  {
    id: "rad-right-leg",
    label: "Radiating pain down right leg (sciatic pattern)",
    side: "right",
    view: "back",
    pathD: "M50 43 C58 46, 64 52, 67 62 C69 73, 66 84, 63 92",
    hitPathD: "M50 43 C58 46, 64 52, 67 62 C69 73, 66 84, 63 92",
    routeGroup: "lumbar",
    defaultSeverity: 6,
  },
  {
    id: "rad-left-leg",
    label: "Radiating pain down left leg (sciatic pattern)",
    side: "left",
    view: "back",
    pathD: "M50 43 C42 46, 36 52, 33 62 C31 73, 34 84, 37 92",
    hitPathD: "M50 43 C42 46, 36 52, 33 62 C31 73, 34 84, 37 92",
    routeGroup: "lumbar",
    defaultSeverity: 6,
  },
  {
    id: "rad-right-arm",
    label: "Radiating pain down right arm",
    side: "right",
    view: "back",
    pathD: "M50 30 C58 31, 66 35, 72 41 C76 46, 79 52, 81 57",
    hitPathD: "M50 30 C58 31, 66 35, 72 41 C76 46, 79 52, 81 57",
    routeGroup: "cervical",
    defaultSeverity: 5,
  },
  {
    id: "rad-left-arm",
    label: "Radiating pain down left arm",
    side: "left",
    view: "back",
    pathD: "M50 30 C42 31, 34 35, 28 41 C24 46, 21 52, 19 57",
    hitPathD: "M50 30 C42 31, 34 35, 28 41 C24 46, 21 52, 19 57",
    routeGroup: "cervical",
    defaultSeverity: 5,
  },
  {
    id: "rad-bilateral-leg",
    label: "Radiating pain down both legs",
    side: "both",
    view: "back",
    pathD: "M50 44 C45 48, 41 54, 39 63 C37 72, 38 83, 40 92 M50 44 C55 48, 59 54, 61 63 C63 72, 62 83, 60 92",
    hitPathD: "M50 44 C45 48, 41 54, 39 63 C37 72, 38 83, 40 92 M50 44 C55 48, 59 54, 61 63 C63 72, 62 83, 60 92",
    routeGroup: "lumbar",
    defaultSeverity: 7,
  },
];
