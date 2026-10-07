import type { Observation } from '../types';

const now = new Date();
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

export const demoObservations: Observation[] = [
  { object: 'wallet', color: 'brown', position: 'center', location: 'on the side table near the door', timestamp: ago(2), confidence: 0.92 },
  { object: 'keys', color: 'silver', position: 'left', location: 'on the coffee table', timestamp: ago(5), confidence: 0.88 },
  { object: 'phone', color: 'black', position: 'right', location: 'on the sofa armrest', timestamp: ago(8), confidence: 0.95 },
  { object: 'glasses', color: 'black', position: 'center', location: 'on the kitchen counter', timestamp: ago(12), confidence: 0.85 },
  { object: 'remote', color: 'gray', position: 'left', location: 'between sofa cushions', timestamp: ago(15), confidence: 0.78 },
  { object: 'medicine bottle', color: 'orange', position: 'right', location: 'on the bathroom shelf', timestamp: ago(20), confidence: 0.91 },
  { object: 'book', color: 'blue', position: 'center', location: 'on the bedside table', timestamp: ago(25), confidence: 0.87 },
  { object: 'charger', color: 'white', position: 'right', location: 'plugged in near the desk', timestamp: ago(30), confidence: 0.83 },
  { object: 'water bottle', color: 'green', position: 'left', location: 'on the dining table', timestamp: ago(35), confidence: 0.90 },
  { object: 'headphones', color: 'black', position: 'center', location: 'hanging on the chair', timestamp: ago(40), confidence: 0.86 },
];
