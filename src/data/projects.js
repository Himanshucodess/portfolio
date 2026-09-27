export const CONTACT = {
  name: 'Himanshu Singh',
  email: 'hello@himanshusingh.tech',
  github: 'https://github.com/Himanshucodess',
  linkedin: 'https://in.linkedin.com/in/himanshu-singh-a808892a1',
  instagram: 'https://www.instagram.com/_fithimanshu',
  location: 'Bengaluru, India',
};

// Real repositories only. `demo` stays null until a live URL exists —
// the tooltip renders "Live Demo" solely when demo is a real URL.
export const PROJECTS = [
  {
    id: 'circle-store',
    title: 'Circle Store',
    description: 'schema-driven second-hand marketplace.',
    stack: ['React', 'Node.js', 'PostgreSQL', 'Prisma', 'Redis', 'Docker'],
    features: [
      'dynamic category schemas',
      'dynamic listing forms',
      'seller workflow',
      'admin category management',
      'competitive pricing feedback',
      'marketplace activity',
      'redis caching',
      'image uploads',
      'docker compose',
      'caddy reverse proxy',
    ],
    detail: {
      frontend: ['React', 'Vite', 'Tailwind CSS', 'ShadCN UI', 'Zod'],
      backend: ['Node.js', 'REST APIs', 'Prisma', 'PostgreSQL'],
      infra: ['Docker Compose', 'Caddy', 'Redis', 'Cloudinary'],
    },
    github: 'https://github.com/Himanshucodess/Circle',
    demo: null,
  },
  {
    id: 'attendance',
    title: 'NMIT Attendance Automation',
    description: 'browser automation for the NMIT parent portal.',
    stack: ['Node.js', 'Playwright'],
    features: ['automated portal navigation', 'session handling', 'data retrieval'],
    github: 'https://github.com/Himanshucodess/Nmit-automatic-attendance-',
    demo: null,
  },
  {
    id: 'go-webapp',
    title: 'Go Web App',
    description: 'a go web application deployed end to end — containerized, shipped through ci, run on kubernetes.',
    stack: ['Go', 'Docker', 'Kubernetes', 'AWS', 'GitHub Actions'],
    features: ['containerized go service', 'kubernetes manifests', 'ingress routing', 'ci pipeline', 'end-to-end deployment'],
    journey: ['code', 'build', 'push', 'deploy'],
    github: 'https://github.com/Himanshucodess/go-web-app-devops',
    demo: null,
  },
];

// Compact stacks live only inside tooltips — never as a section.
export const STACK_NOTES = {
  backend: ['Node.js', 'Express', 'REST APIs', 'PostgreSQL', 'Prisma', 'Redis'],
  cloud: ['AWS', 'Docker', 'Kubernetes', 'GitHub Actions', 'Cloudflare', 'Linux'],
  languages: ['C', 'C++', 'JavaScript'],
  frontend: ['React', 'Vite', 'Tailwind CSS', 'ShadCN'],
  aiml: ['ai/ml basics'],
};
