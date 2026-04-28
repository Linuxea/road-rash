export interface RoadSegment {
  curve: number;
  hill: number;
}

export interface TrackDescription {
  length: number;
  curve: number;
  hill: number;
}

export type TrackData = RoadSegment[];

export const SEGMENT_LENGTH = 200;
export const ROAD_HALF_WIDTH = 2000;
export const CURVE_SEGMENT_FACTOR = 2;
export const HILL_SEGMENT_FACTOR = 5;
