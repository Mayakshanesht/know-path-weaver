// Course data for KnowGraph marketing site

export interface CourseData {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  emoji: string;
  description: string;
  fullDescription: string;
  curriculum: string[];
  priceIndia: number;
  priceInternational?: number;
  paymentReference: string;
  domains: string[];
}

export const PAYMENT_DETAILS = {
  accountName: 'CloudBee Robotics',
  accountHolder: 'Rajendra Dyandev Waghachoure',
  bank: 'Pune District Central Co-Op Bank Ltd., Pune',
  branch: 'Ranjangaon Sandas',
  accountNumber: '183001600000130',
  ifsc: 'HDFC0CPDCCB',
  email: 'mayur.waghchoure@cloudbeerobotics-ai.com',
  whatsapp: '+91 88305 79377',
};

export const DOMAINS = [
  { name: 'AI', icon: '🤖' },
  { name: 'Autonomous Driving', icon: '🚗' },
  { name: 'Perception & Computer Vision', icon: '👁️' },
  { name: 'Control Systems', icon: '🎛️' },
  { name: 'Robotics', icon: '🦾' },
];

export const COURSES: CourseData[] = [
  {
    id: 'ai-bootcamp',
    slug: 'ai-bootcamp',
    emoji: '🚀',
    shortTitle: 'AI Course — ML → LLMs → Generative AI',
    title: 'AI Bootcamp: From Machine Learning to Generative AI',
    description: 'Comprehensive journey from machine learning fundamentals through deep learning to large language models and generative AI.',
    fullDescription: 'Concepts. Math. Systems. Real Projects.\n\nA 5-lecture, concept-first AI bootcamp covering ML, Deep Learning, 3D Perception, Large Language Models, Vision-Language systems, and Generative AI — designed for engineers and serious learners.',
    curriculum: [
      'Lecture 1: Machine Learning Foundations',
      'Lecture 2: Deep Learning & Reinforcement Learning',
      'Lecture 3: Computer Vision & 3D Perception',
      'Lecture 4: Large Language Models & Vision-Language Systems',
      'Lecture 5: Generative AI, Diffusion & Vision-Language-Action',
    ],
    priceIndia: 20999,
    paymentReference: 'AI_BOOTCAMP_2025',
    domains: ['AI', 'Perception & Computer Vision'],
  },
  {
    id: 'autonomous-driving',
    slug: 'autonomous-driving',
    emoji: '🚗',
    shortTitle: 'Autonomous Driving Systems',
    title: 'Autonomous Driving Bootcamp — End-to-End ADAS Engineering',
    description: 'Complete coverage of autonomous driving technology including perception, sensor fusion, prediction, planning, control, and functional safety.',
    fullDescription: 'End-to-end ADAS & Autonomous Driving engineering — from ML to control to safety, including a full industry-style capstone project.',
    curriculum: [
      'Module 1: ADAS Fundamentals & Sensor Technologies',
      'Module 2: Perception & Sensor Fusion',
      'Module 3: Prediction & Planning',
      'Module 4: Vehicle Control & Actuation',
      'Module 5: Functional Safety & Validation',
      'Capstone: Industry-Style Project',
    ],
    priceIndia: 36999,
    paymentReference: 'ADAS_COURSE_2025',
    domains: ['Autonomous Driving', 'AI', 'Control Systems'],
  },
  {
    id: 'vehicle-control',
    slug: 'vehicle-control',
    emoji: '🎛️',
    shortTitle: 'Modern Vehicle Control — PID → LQR → MPC',
    title: 'Modern Vehicle Control — PID → LQR → MPC',
    description: 'From classical PID control through optimal control theory to model predictive control for autonomous vehicles.',
    fullDescription: 'Advanced vehicle dynamics and control for ADAS & autonomous driving, covering longitudinal, lateral, and trajectory control.',
    curriculum: [
      'Module 1: Vehicle Dynamics Fundamentals',
      'Module 2: Classical PID Control',
      'Module 3: State-Space & LQR Control',
      'Module 4: Model Predictive Control (MPC)',
      'Module 5: Trajectory Tracking & Path Following',
    ],
    priceIndia: 15999,
    priceInternational: 150,
    paymentReference: 'CONTROL_COURSE_2025',
    domains: ['Control Systems', 'Autonomous Driving'],
  },
  {
    id: 'motion-planning',
    slug: 'motion-planning',
    emoji: '🗺️',
    shortTitle: 'Motion Prediction & Planning',
    title: 'Motion Prediction & Planning for Autonomous Driving',
    description: 'Understanding and implementing motion prediction and trajectory planning systems for autonomous vehicles.',
    fullDescription: 'Industry-aligned planning and prediction workflows, from rule-based planners to ML-driven and risk-aware decision making.',
    curriculum: [
      'Module 1: Planning Fundamentals & Graph Search',
      'Module 2: Motion Prediction Methods',
      'Module 3: Trajectory Optimization',
      'Module 4: ML-Based Planning & Prediction',
      'Module 5: Risk-Aware Decision Making',
    ],
    priceIndia: 20999,
    priceInternational: 200,
    paymentReference: 'MPP_COURSE_2025',
    domains: ['Autonomous Driving', 'AI'],
  },
];

export function getCourseBySlug(slug: string): CourseData | undefined {
  return COURSES.find((c) => c.slug === slug);
}
