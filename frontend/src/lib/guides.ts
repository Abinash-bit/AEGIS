import type { HazardId } from './types'

export interface Field { name: 'value' | 'value2'; label: string; unit: string; min: number; max: number; step: number }
export interface Guide {
  key: 'bp' | 'hr' | 'temp' | 'glucose' | 'sleep' | 'mood'
  title: string; hazard: HazardId; minutes: string
  how: string[]          // step-by-step instructions
  why: string            // why it matters in space (plain language)
  typical: string        // what is typical for a healthy adult (general reference, not a diagnosis)
  fields: Field[]
  camera?: boolean       // can be measured with the device camera
}

// Typical ranges are general adult references for orientation only; AEGIS compares each value with the
// astronaut's own baseline and NASA sources, and never diagnoses.
export const GUIDES: Guide[] = [
  {
    key: 'bp', title: 'Blood pressure', hazard: 'GRAV', minutes: '5 min',
    how: [
      'Sit and secure yourself so you are not floating; rest quietly for 5 minutes.',
      'Wrap the cuff around your bare upper left arm, about 2 cm above the elbow, at heart level.',
      'Keep your arm relaxed and supported. Do not talk or move during the reading.',
      'Start the monitor and note both numbers: systolic (top) and diastolic (bottom).',
    ],
    why: 'Without gravity, body fluids shift toward the head, which changes how the heart and blood vessels work. Blood pressure trends help catch that shift early, and after landing they show how well your body handles standing up again.',
    typical: 'Typical resting adult value is below 120/80 mmHg. AEGIS compares it with your own pre-flight baseline.',
    fields: [
      { name: 'value', label: 'Systolic (top)', unit: 'mmHg', min: 60, max: 250, step: 1 },
      { name: 'value2', label: 'Diastolic (bottom)', unit: 'mmHg', min: 30, max: 160, step: 1 },
    ],
  },
  {
    key: 'hr', title: 'Resting heart rate', hazard: 'GRAV', minutes: '2 min', camera: true,
    how: [
      'Rest quietly for 2 minutes before measuring.',
      'Either use the camera measurement below, or place two fingers on the inside of your wrist below the thumb.',
      'Count the beats for 30 seconds and multiply by 2.',
    ],
    why: 'Heart rate shows how hard your heart is working. In weightlessness the heart has less work to do and can decondition; after landing it often races when you stand up.',
    typical: 'Typical resting adult heart rate is 60–100 bpm; fit people are often lower.',
    fields: [{ name: 'value', label: 'Heart rate', unit: 'bpm', min: 30, max: 220, step: 1 }],
  },
  {
    key: 'temp', title: 'Body temperature', hazard: 'ENV', minutes: '2 min',
    how: [
      'Do not eat or drink anything hot or cold for 15 minutes beforehand.',
      'Place the thermometer under your tongue (or use the ear thermometer) and close your mouth.',
      'Wait for the beep and read the value.',
    ],
    why: 'A closed spacecraft shares its air and surfaces with the whole crew, and spaceflight stress can weaken the immune system. A raised temperature can be an early sign of infection.',
    typical: 'Typical body temperature is about 36.1–37.2 °C. 38 °C or above usually counts as a fever.',
    fields: [{ name: 'value', label: 'Temperature', unit: '°C', min: 33, max: 43, step: 0.1 }],
  },
  {
    key: 'glucose', title: 'Blood sugar (fingerstick)', hazard: 'GRAV', minutes: '3 min',
    how: [
      'Measure before eating in the morning (fasting) if you can.',
      'Wash and dry your hands; warm fingers give a better drop.',
      'Prick the side of a fingertip with the lancet and touch the drop to the glucometer strip.',
      'Read the value and dispose of the lancet in the sharps container.',
    ],
    why: 'Less movement in weightlessness can change how the body handles sugar, and food far from Earth is limited. Blood sugar helps the crew keep nutrition and energy on track.',
    typical: 'Typical fasting blood sugar is about 70–99 mg/dL (the Inspiration4 lab used 65–99).',
    fields: [{ name: 'value', label: 'Blood sugar', unit: 'mg/dL', min: 20, max: 600, step: 1 }],
  },
  {
    key: 'sleep', title: 'Last night’s sleep', hazard: 'ISO', minutes: '1 min',
    how: [
      'Think back to when you fell asleep and when you woke up.',
      'Subtract the time you lay awake in between.',
      'Enter the total hours of actual sleep.',
    ],
    why: 'Shift work, noise, light and stress make sleep in space short. Astronauts average about 6 hours a night, and sleep loss slows reactions and affects mood.',
    typical: 'Most adults need 7–9 hours. NASA schedules 8.5 hours of sleep time for crews.',
    fields: [{ name: 'value', label: 'Sleep', unit: 'hours', min: 0, max: 24, step: 0.1 }],
  },
  {
    key: 'mood', title: 'Mood check', hazard: 'ISO', minutes: '1 min',
    how: [
      'Take a moment to notice how you feel right now.',
      'Pick a number from 1 (very low) to 5 (very good).',
      'Add a short note if you want; AEGIS will remember things you share about yourself.',
    ],
    why: 'Months of isolation and confinement wear on mood, morale and teamwork. Small changes are easier to address when they are noticed early.',
    typical: 'There is no “normal” mood; AEGIS watches for changes from your own usual level.',
    fields: [{ name: 'value', label: 'Mood', unit: '1–5', min: 1, max: 5, step: 1 }],
  },
]
