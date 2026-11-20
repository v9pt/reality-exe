/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  REALITY.EXE — the one file to edit.
 *
 *  Everything a visitor reads comes from here. Facts come from the previous
 *  site's data (kept on the old-remix-site branch), the NSUT project reports
 *  and the brief. Nothing is invented: no scores, ratings or metrics beyond what those
 *  sources state. Optional fields are hidden when left out.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Achievement, Profile, Quest, Role, SkillCategory } from "./types";

export const profile: Profile = {
  name: "Huzaifa Mulla",
  handle: "v9pt",
  title: "Software Engineer",
  location: "New Delhi, India",
  bio: [
    "Software engineer working across full-stack products, backend services and applied machine learning.",
    "Most recently I built REST APIs, client message serialization and a provider-agnostic LLM layer for a cross-device knowledge platform, and finished a B.Tech thesis on low-light face super-resolution at NSUT.",
  ],
  interests: [
    "Full-stack development",
    "Backend engineering",
    "AI and machine learning",
    "Emerging technologies",
  ],
  education: {
    school: "Netaji Subhas University of Technology, New Delhi",
    short: "NSUT",
    // From the title pages of both NSUT project reports (roll no. 2022UCS1510).
    degree: "B.Tech, Computer Science and Engineering",
    period: "2022 to 2026",
  },
  contact: {
    email: "huzaifa4g@gmail.com",
    github: "https://github.com/v9pt",
    linkedin: "https://www.linkedin.com/in/kaunzaifa",
    leetcode: "https://leetcode.com/u/v9pt/",
    // resume: "/resume.pdf",  ← drop a PDF in /public and uncomment to show the button
  },
};

export const quests: Quest[] = [
  {
    slug: "peerfact",
    title: "PeerFact",
    tagline: "A decentralized fact-checking platform that pairs an ensemble of language models with reputation-weighted community verification.",
    kind: "Major project",
    period: "2025",
    context: "B.Tech major project at NSUT, team of three, supervised by Dr. Ankush Jain",
    description:
      "A claim is checked twice: by three language models whose outputs are combined into one confidence score, and by community reviewers whose votes count according to their track record. Claims, evidence and reviews are kept as an append-only record, so every verdict can be traced back to what produced it.",
    problem:
      "Professional fact-checking takes days while a false claim spreads in hours, and a single central authority is easy to distrust. Pure crowd voting, on the other hand, is easy to game.",
    decisions: [
      "Three models, three jobs: GPT-4o assesses factuality, Claude 3.5 Sonnet assesses credibility and Gemini 2.0 Flash checks verification pathways. Their outputs are combined by weighted consensus rather than a majority vote.",
      "Each model's weight is multiplied by its prediction confidence and its historical reliability on similar claims, so disagreement between models is measured instead of averaged away.",
      "Reviewer reputation weights each verification by importance and accuracy, decays it over time, and adds bonuses for early, high-quality work and penalties for gaming.",
      "Anti-gaming checks: Sybil detection through graph analysis and behavioural clustering, collusion detection from timing and topic patterns, and evidence from several independent sources for high-impact claims.",
      "Claims and evidence citations are stored in MongoDB as an append-only structure. A correction is a new record, and trust scores are recomputed from that history.",
      "Polling was replaced with WebSocket event updates, so open review sessions synchronise on events instead of re-querying unchanged state.",
      "A React 19 and Vite front end over a FastAPI gateway, with stateless services, Redis caching and Docker for horizontal scaling.",
    ],
    features: [
      "In the report's evaluation on a set of about 45,000 articles, the ensemble reached 96.8% accuracy, 4.6 points above the best single model",
      "AI analysis of a new claim averaged 2.3 seconds",
      "In a simulation with 10,000 synthetic users, community verdicts agreed with expert fact-checkers on 93.7% of identical claims",
      "Bias checks across emotional, political, ideological, source and commercial dimensions",
      "Auditable review history for every claim",
    ],
    stack: ["React", "Vite", "FastAPI", "MongoDB", "Redis", "WebSockets", "Docker", "GPT-4o", "Claude 3.5 Sonnet", "Gemini 2.0 Flash"],
    pipeline: [
      { name: "Submission", method: "FastAPI validation", detail: "Basic checks in about 200 ms." },
      { name: "AI ensemble", method: "GPT-4o, Claude, Gemini", detail: "Weighted consensus score." },
      { name: "Community review", method: "Reputation-weighted votes", detail: "Live updates over WebSockets." },
      { name: "Verdict", method: "Recomputed from the record", detail: "Changes as evidence accumulates." },
    ],
    links: { github: "https://github.com/v9pt" },
    visual: "ledger",
    hue: "crimson",
  },
  {
    slug: "voyra",
    title: "Voyra",
    tagline: "An intelligent travel planning platform.",
    kind: "Project",
    // Add description, problem, decisions, features, stack and links here.
    // Sections without content stay hidden on the site.
    links: { github: "https://github.com/v9pt" },
    visual: "route",
    hue: "amber",
  },
  {
    slug: "capsulehub",
    title: "CapsuleHub",
    tagline:
      "Tilantra's context layer for AI tools: capture a session once as a Capsule and drop it into any other tool. I worked on its backend APIs, iOS client and LLM layer.",
    kind: "Internship",
    period: "2026",
    context: "Software development intern, Tilantra Technologies",
    description:
      "A Capsule is the context behind a piece of work, its goals, decisions and files, captured once so it can be injected into another AI tool or shared with a team. The product ships as a Chrome extension (ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Gmail), an MCP server for Cursor and other MCP clients, an SDK for embedding in website chatbots, and Claude skills for the terminal. Shared capsules live in team workspaces with role-based access. I worked on the REST API, the message serialization that runs on the client, and the iOS app, so conversations and session state carry across devices.",
    problem:
      "Context built up in one AI tool is lost when you switch tools, devices or hand work to someone else. On the engineering side, mobile clients update on their own schedule, model providers expect different payloads, and a session started on one device has to resume on another.",
    decisions: [
      "REST schemas evolve by adding fields, with JSON validation on the way in, so a client that has not adopted a change keeps working.",
      "React Native components inside the Swift app call native code through JSI, reducing reliance on WebView-based wrappers.",
      "One unified conversation format inside the product, translated to OpenAI's or Anthropic's schema at request time. Switching models needs no client release.",
      "Docker on AWS EC2, with GitHub Actions validating every pull request and deployment.",
    ],
    features: [
      "Three moves: generate a Capsule, drop it into another tool, share it with a teammate",
      "Conversation and session state restored across devices",
      "Versioned, additive API schemas",
      "Runtime choice of model provider",
    ],
    stack: ["Node.js", "PostgreSQL", "Swift", "React Native", "Docker", "AWS EC2", "GitHub Actions"],
    links: { demo: "https://capsulehub.tilantra.com/" },
    pipeline: [
      { name: "iOS client", method: "Swift with React Native over JSI", detail: "Serializes messages on the device." },
      { name: "REST API", method: "Node.js, versioned schemas", detail: "Validates JSON and stores state in PostgreSQL." },
      { name: "Provider layer", method: "One conversation format", detail: "Maps it to each provider's schema." },
      { name: "Model provider", method: "OpenAI or Anthropic", detail: "Chosen at runtime." },
    ],
    visual: "sync",
    hue: "cyan",
  },
  {
    slug: "anfis-lfsr",
    title: "Low-light face super-resolution",
    tagline:
      "B.Tech thesis: estimate how dark a photo is with a fuzzy inference system, then use it to steer enhancement and 8× face super-resolution.",
    kind: "Thesis",
    period: "2025 to 2026",
    context: "B.Tech thesis at NSUT, team of three, supervised by Dr. Ankush Jain",
    description:
      "A five-stage restoration pipeline judged on whether the output is still the same person, not only on how sharp it looks.",
    problem:
      "A face photographed in poor light is blurred, noisy and low in contrast at once. A super-resolution network applied directly sharpens the blur and noise along with the face.",
    decisions: [
      "An ANFIS model over five image statistics outputs a single darkness factor; its rules stay partly interpretable after training.",
      "Blur is corrected with Wiener deconvolution before anything else touches the pixels, because super-resolution amplifies blurred edges.",
      "The darkness factor conditions Zero-DCE curve strength and is injected into the 8× Swin Transformer network through SFT layers.",
      "ArcFace embeddings supply an identity term in the loss and the face-accuracy metric.",
      "Served through FastAPI with a React, TypeScript and Vite front end; models load once at startup.",
    ],
    features: [
      "On CelebA, the full pipeline reached 30.42 dB PSNR, 0.854 SSIM and 75.8 face accuracy, against 24.12 dB, 0.724 and 45.2 for bicubic upscaling; LPIPS fell from 0.354 to 0.180",
      "In the ablation, removing the ANFIS estimator cost the most PSNR, and removing the ArcFace term cost the most face accuracy",
      "Each intermediate image can be inspected on its own",
      "Seeded runs and unit tests for ANFIS, enhancement and blur analysis",
    ],
    stack: ["PyTorch", "ANFIS", "Zero-DCE", "Swin Transformer", "ArcFace", "FastAPI", "React"],
    pipeline: [
      { name: "Darkness estimation", method: "ANFIS over five statistics", detail: "Outputs one darkness factor." },
      { name: "Blur correction", method: "Wiener deconvolution", detail: "Only past a blur threshold." },
      { name: "Illumination", method: "Zero-DCE curves", detail: "Strength follows the darkness factor." },
      { name: "Super-resolution", method: "8× Swin Transformer, RRDB", detail: "Conditioned through SFT layers." },
      { name: "Identity check", method: "ArcFace embeddings", detail: "Keeps the face the same person." },
    ],
    visual: "darkness",
    hue: "violet",
  },
  {
    slug: "smart-retail",
    title: "Smart Retail Checkout",
    tagline: "Real-time product detection for retail checkout on a Raspberry Pi 4.",
    kind: "Project",
    period: "2023 to 2024",
    description:
      "Products are detected on the device at the checkout, and transactions are published over MQTT.",
    problem:
      "A checkout has to keep working on modest hardware and through network interruptions.",
    decisions: [
      "YOLOv5 fine-tuned on the retail items and converted to TensorFlow Lite with INT8 quantization: under 100 ms per inference on the Pi.",
      "Transaction events are queued on the device during a network interruption, so a dropped connection does not stop the checkout.",
    ],
    stack: ["YOLOv5", "TensorFlow Lite", "Raspberry Pi 4", "MQTT"],
    visual: "detect",
    hue: "cyan",
  },
];

/** Empty quest slots shown on the board for work still to come. */
export const openQuestSlots = 1;

export const roles: Role[] = [
  {
    id: "tilantra",
    organisation: "Tilantra Technologies",
    role: "Software Development Intern",
    period: "April to June 2026",
    location: "Remote",
    points: [
      "Built REST APIs and client-side message serialization in Node.js, Swift and PostgreSQL, so conversations and session state restore across devices in CapsuleHub.",
      "Integrated React Native components with the native iOS codebase through JSI, reducing the app's reliance on WebView-based wrappers.",
      "Designed versioned REST schemas that evolve by adding fields, with JSON validation, so clients adopt API changes without synchronized releases.",
    ],
  },
  {
    id: "ras",
    organisation: "Ras Ambition",
    role: "Data Analyst Intern",
    period: "January to July 2025",
    location: "Jubail, Saudi Arabia",
    points: [
      "Automated reporting with Python, Pandas and NumPy ETL pipelines. Preparing five key business metrics went from more than four hours to under ten minutes.",
      "Combined sales, engagement and pipeline data from five sources using Power Query and a star schema in Power BI, cutting manual reconciliation in the weekly reports.",
    ],
  },
  {
    id: "ieee",
    organisation: "IEEE NSUT Student Branch and Venatus",
    role: "Executive Committee Member and General Secretary",
    period: "2023 to 2026",
    location: "New Delhi",
    points: [
      "Coordinated workshops and hackathons across more than eight campus programs, each with over 100 attendees.",
      "Led weekly competitive programming sessions on data structures and algorithms, with curated problems and editorial walkthroughs.",
    ],
  },
];

export const achievements: Achievement[] = [
  { title: "Codeforces Specialist", detail: "Max rating 1448" },
  { title: "CodeChef 4-star" },
  { title: "HackerRank 5-star", detail: "C, Java and C++" },
  { title: "Open source contributor", detail: "Hacktoberfest 2023 and GSSoC 2024" },
];

export const skillTree: SkillCategory[] = [
  {
    id: "languages",
    name: "Languages",
    glyph: "言",
    note: "Python for services, pipelines and model training. TypeScript and JavaScript for Node.js services and React clients. Swift for native iOS work.",
    skills: [
      { name: "Python" },
      { name: "TypeScript" },
      { name: "JavaScript" },
      { name: "C++" },
      { name: "Java" },
      { name: "Swift" },
      { name: "SQL" },
    ],
  },
  {
    id: "frontend",
    name: "Frontend",
    glyph: "画",
    note: "Application interfaces and dashboards on the web; React Native bridged into a Swift codebase on iOS.",
    skills: [{ name: "React" }, { name: "Next.js" }, { name: "React Native" }, { name: "Vite" }],
  },
  {
    id: "backend",
    name: "Backend",
    glyph: "核",
    note: "REST API design with versioned, additive schemas and JSON validation. JWT auth and WebSockets.",
    skills: [
      { name: "Node.js" },
      { name: "Express" },
      { name: "FastAPI" },
      { name: "Flask" },
      { name: "Spring Boot" },
      { name: "WebSockets", aliases: ["WebSocket"] },
      { name: "REST APIs", aliases: ["REST API", "REST schemas"] },
      { name: "MQTT" },
      { name: "Blockchain" },
    ],
  },
  {
    id: "databases",
    name: "Databases",
    glyph: "蔵",
    skills: [{ name: "PostgreSQL" }, { name: "MongoDB" }, { name: "Redis" }],
  },
  {
    id: "cloud",
    name: "Cloud and infrastructure",
    glyph: "雲",
    note: "Containerized deployments with CI/CD that validates every pull request.",
    skills: [
      { name: "AWS", aliases: ["AWS EC2", "EC2"] },
      { name: "Docker" },
      { name: "GitHub Actions" },
      { name: "Linux" },
      { name: "Raspberry Pi", aliases: ["Raspberry Pi 4"] },
    ],
  },
  {
    id: "ai",
    name: "AI and ML",
    glyph: "脳",
    note: "Image restoration and super-resolution research. Detection fine-tuning and INT8 quantization for edge devices. LLM provider integration, retrieval-augmented generation and vector search.",
    skills: [
      { name: "PyTorch" },
      { name: "TensorFlow Lite" },
      { name: "OpenCV" },
      { name: "YOLOv5" },
      { name: "scikit-learn" },
      { name: "LLM integration", aliases: ["OpenAI", "Anthropic", "LLM", "GPT-4o", "Claude 3.5 Sonnet", "Gemini 2.0 Flash", "language models"] },
      { name: "Fuzzy inference", aliases: ["ANFIS"] },
    ],
  },
  {
    id: "tools",
    name: "Tools and practices",
    glyph: "術",
    note: "API testing, workflow automation, and data work in Pandas and Power BI.",
    skills: [
      { name: "Git" },
      { name: "Postman" },
      { name: "cURL" },
      { name: "Pandas" },
      { name: "NumPy" },
      { name: "Power BI" },
      { name: "n8n" },
      { name: "Zapier" },
      { name: "Unit testing", aliases: ["unit tests"] },
    ],
  },
];
