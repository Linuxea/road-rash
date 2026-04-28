import type { TrackDescription, TrackData, RoadSegment } from './types';
import { SEGMENT_LENGTH } from './types';

const TEST_TRACK_DESCRIPTIONS: TrackDescription[] = [
  { length: 10000, curve: 0,  hill: 0 },
  { length: 5000,  curve: 3,  hill: 0 },
  { length: 8000,  curve: 0,  hill: 0 },
  { length: 6000,  curve: -3, hill: 0 },
  { length: 4000,  curve: 0,  hill: 0 },
  { length: 4000,  curve: 4,  hill: 0 },
  { length: 10000, curve: 0,  hill: 0 },
  { length: 5000,  curve: 0,  hill: 2 },
  { length: 3000,  curve: -2, hill: 0 },
  { length: 5000,  curve: 0,  hill: -2 },
  { length: 6000,  curve: 2,  hill: 0 },
  { length: 5000,  curve: 3,  hill: 2 },
  { length: 10000, curve: 0,  hill: 0 },
];

export function buildTrackData(descriptions: TrackDescription[]): TrackData {
  const segments: RoadSegment[] = [];
  for (const desc of descriptions) {
    const count = Math.ceil(desc.length / SEGMENT_LENGTH);
    for (let i = 0; i < count; i++) {
      segments.push({ curve: desc.curve, hill: desc.hill });
    }
  }
  return segments;
}

export function getSegmentAtZ(trackData: TrackData, worldZ: number): RoadSegment {
  if (trackData.length === 0) throw new Error('Cannot query segment from empty track data');
  const totalLength = trackData.length * SEGMENT_LENGTH;
  const wrappedZ = ((worldZ % totalLength) + totalLength) % totalLength;
  return trackData[Math.floor(wrappedZ / SEGMENT_LENGTH)];
}

export const testTrackData: TrackData = buildTrackData(TEST_TRACK_DESCRIPTIONS);
