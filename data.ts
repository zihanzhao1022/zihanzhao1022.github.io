import { Profile, Publication, Project, Talk, Award, Experience } from './types';

export const profile: Profile = {
  name: {
    first: "Zihan",
    last: "ZHAO",
    chinese: "子涵 赵"
  },
  title: "PhD Candidate",
  affiliation: "Onizuka Lab, The University of Osaka, Japan",
  email: "zihanzhao1022@gmail.com",
  avatar: "/images/zzh.png", // Placeholder
  bio: [
    "I am Zihan Zhao (子涵 赵 in Chinese), currently a Ph.D. candidate under the supervision of Professor Makoto Onizuka at the University of Osaka. My research interests focus on Self-Evolving AI Agents. Researchers and collaborators interested in Self-Evolving AI Agents are welcome to contact me via email: <a href='mailto:zihan.zhao@ieee.org' target='_blank' rel='noreferrer' class='text-purple-600 hover:underline font-medium'>zihan.zhao@ieee.org</a> or <a href='mailto:zihanzhao1022@gmail.com' target='_blank' rel='noreferrer' class='text-purple-600 hover:underline font-medium'>zihanzhao1022@gmail.com</a>.",
    "I received the Bachelor’s degree in Computer Science and Technology from Southwest University of Science and Technology in July 2023, where I was enrolled in the Outstanding Engineer Education and Training Program, and graduated as an Outstanding Graduate under the supervision of Associate Professor Jue Wu. In September 2025, I received the Master's degree in the Applied Informatics program (SGU Program) at Hosei University. My master's research concentrated on the application of Large Language Models to IoT security."
  ],
  socials: [
    { platform: 'email', url: 'mailto:zihanzhao1022@gmail.com' },
    { platform: 'github', url: 'https://github.com/zihanzhao1022' },
    { platform: 'linkedin', url: 'https://www.linkedin.com/in/zihan-zhao-652378264/' },
    { platform: 'orcid', url: 'https://orcid.org/0009-0001-2305-7689' },
    // WeChat with QR Code
    { 
      platform: 'wechat', 
      url: '#', 
      qrCode: "/images/wechat_qr.jpg" // Placeholder QR Code
    },
  ],
  news: [
    { date: "Jan 20, 2025", content: "My academic homepage was successfully deployed! 🚀" },
    // { date: "Nov 15, 2025", content: "One paper accepted to AAAI 2026." },
    // { date: "Sep 01, 2025", content: "Started my Ph.D. journey at Osaka University." }
  ],
  education: [
    {
      degree: "Ph.D. in Information Science and Technology",
      institution: "Osaka University",
      location: "Osaka, Japan",
      year: "Sep. 2025 - Present",
      details: [
        "Advisor: Prof. Makoto Onizuka",
        "Research: Self-Evolving AI Agents"
      ]
    },
    {
      degree: "Master of Science in Applied Informatics (SGU Program)",
      institution: "Hosei University",
      location: "Tokyo, Japan",
      year: "Sep. 2023 - Sep. 2025",
      details: [
        "Focus: LLMs for IoT Security"
      ]
    },
    {
      degree: "Bachelor of Engineering in Computer Science and Technology",
      institution: "Southwest University of Science and Technology",
      location: "Mianyang, China",
      year: "Sep. 2019 - July 2023",
      details: [
        "Outstanding Graduate Award"
      ]
    }
  ],
  researchInterests: [
    "Self-Evolving AI Agents",
    "Large Language Models (LLMs)",
    "IoT Security & Edge AI",
    "Data-Centric AI"
  ],
  awards: [
    { id: "a1", title: "University Scholarship for Outstanding Students", date: "Oct 2024", year: 2024, issuer: "Hosei University", type: "scholarship" },
    { id: "a2", title: "Best Paper Award", date: "Aug 2023", year: 2023, issuer: "ICICS Conference", type: "international" }
  ],
  skills: [
    "Python (PyTorch, TensorFlow)",
    "C++ / Java",
    "Docker / Kubernetes",
    "Latex / Markdown"
  ],
  languages: [
    { language: "Chinese", proficiency: "Native Speaker" },
    { language: "English", proficiency: "IETLS Academic overall band 7.5; TOEIC L&R 935" },
    { language: "Japanese", proficiency: "About JLPT N3 level" }
  ]
};

// Mock Publications Data
export const publications: Publication[] = [
  {
    id: "p1",
    title: "Large Language Models for Temporal Sensor Networks: Graph-Constrained Multi-LLM Ensembles via Structural Causal Models",
    authors: [
        "Franck Junior Aboya Messou",
        "**Zihan Zhao**",
        "Jinhua Chen",
        "Alice Smith",
        "Bob Johnson",
        "Charlie Lee",
        "David Kim"
    ],
    year: 2026,
    venue: "IEEE International Conference on Communications (ICC)",
    type: "conference",
    rank: "CORE-B",
    image: "",
    highlight: true,
    links: { abs: "#", doi: "#", pdf: "#" }
  },
  {
    id: "p2",
    title: "Federated Large Domain Model System",
    authors: [
        "Chunming Rong",
        "Jungwon Seo",
        "**Zihan Zhao**",
        "Ferhat Ozgur Catak",
        "Jiahui Geng",
        "Martin Gilje Jaatun"
    ],
    year: 2025,
    venue: "Blockchain: Research and Applications",
    type: "journal",
    rank: "Q1",
    impactFactor: "6.9",
    image: "",
    links: { abs: "#", doi: "#", pdf: '#' }
  },
  {
    id: "p3",
    title: "WMPA-ConvBERT-BM: A hybrid deep learning model optimized by whale-marine predator algorithm for IoT-enabled malicious URL detection",
    authors: ["**Zihan Zhao**", "**Yulin Zhu**", "Shilong Zhang", "Amr Tolba", "Osama Alfarraj", "Keping Yu"],
    year: 2025,
    venue: "Internet of Things",
    type: "journal",
    rank: "Q1",
    impactFactor: "7.6",
    links: { abs: "#", doi: "#", pdf: '#' }
  },
  {
    id: "p4",
    title: "UnifiedLLM: Parameter-Efficient Fine-Tuning of Large Language Models for Time Series Forecasting: A Systematic Study of LoRA Configurations and Strategies",
    authors: ["Franck Junior Aboya Messou", "**Zihan Zhao**", "et al."],
    year: 2026,
    venue: "IEEE Internet of Things Journal",
    type: "journal",
    rank: "Q1",
    impactFactor: "8.9",
    links: { abs: "#", doi: "#", pdf: '#' }
  },
  {
    id: "p5",
    title: "MauBa: A Multi-Agent Coordination Framework for Vision-Language-Guided Zero-Shot Control of Unmanned Aerial Vehicles",
    authors: ["**Yulin Zhu**", "**Zihan Zhao**", "Shilong Zhang", "Junzhe Sun", "Keping Yu"],
    year: 2025,
    venue: "IEEE Global Communications Conference (Globecom)",
    type: "conference",
    rank: "CORE-B",
    links: { abs: "#", doi: "#", pdf: '#' }
  },
  {
    id: "p6",
    title: "FortiFed-SP: Client-Side Defense Against Label-Flipping Attacks in Federated Learning",
    authors: ["Robert Katabarwa", "Jinhua Chen", "**Zihan Zhao**", "et al."],
    year: 2025,
    venue: "The 2025 5th International Conference on Intelligent Communications and Computing (ICICC)",
    type: "conference",
    rank: "Unranked",
    links: { abs: "https://ieeexplore.ieee.org/abstract/document/11199513", doi: "#", pdf: '#' }
  },
  {
    id: "p7",
    title: "A Resource-efficient Text-to-Text Transfer Transformer Encoder-based Vertical Hybrid Model for Malicious URLs Detection",
    authors: ["**Zihan Zhao**", "et al."],
    year: 2024,
    venue: "The 2024 IEEE 100th Vehicular Technology Conference (VTC2024-Fall)",
    type: "conference",
    rank: "CORE-B",
    links: { abs: "https://ieeexplore.ieee.org/document/10757492", doi: "#", pdf: '#' }
  },
  {
    id: "p8",
    title: "A Byzantine-Fault-Tolerant Federated Learning Method Using Tree-Decentralized Network and Knowledge Distillation for Internet of Vehicles",
    authors: ["Jinhua Chen", "**Zihan Zhao**", "et al."],
    year: 2024,
    venue: "The 2024 IEEE 100th Vehicular Technology Conference (VTC2024-Fall)",
    type: "conference",
    rank: "CORE-B",
    links: { abs: "https://ieeexplore.ieee.org/document/10757805", doi: "#", pdf: '#' }
  },
  {
    id: "p9",
    title: "Enhancing Short-Term Load Forecasting in Internet of Things: A Hybrid Attention-based CNN-BiLSTM with Data Augmentation Approach",
    authors: ["Franck Junior Aboya Messou", "Jinhua Chen", "Robert Katabarwa", "**Zihan Zhao**", "Keping Yu"],
    year: 2024,
    venue: "The 2024 IEEE 100th Vehicular Technology Conference (VTC2024-Fall)",
    type: "conference",
    rank: "CORE-B",
    links: { abs: "https://ieeexplore.ieee.org/document/10757868", doi: "#", pdf: '#' }
  },
  {
    id: "p10",
    title: "Enhancing Production Planning in the Internet of Vehicles: A Transformer-based Federated Reinforcement Learning Approach",
    authors: ["Jinhua Chen", "**Zihan Zhao**", "et al."],
    year: 2024,
    venue: "The 2024 IEEE 99th Vehicular Technology Conference (VTC2024-Spring)",
    type: "conference",
    rank: "CORE-B",
    links: { abs: "https://ieeexplore.ieee.org/document/10683236", doi: "#", pdf: '#' }
  }
];

export const projects: Project[] = [
  {
    id: "prj1",
    title: "Large Language Models based Malware Analysis and Detection System",
    description: "Research on applying Large Language Models for automated malware analysis and effective threat detection.",
    year: "Mar. 2023 - May 2023",
    level: "Provincial Key R&D Program",
    role: "Project Leader",
    image: ""
  },
  {
    id: "prj2",
    title: "A Mask-Wearing Detection Platform for COVID-19 Prevention and Control Based on YOLOv5",
    description: "Developed a real-time computer vision system to detect mask usage in public spaces using YOLOv5.",
    year: "Feb. 2022 - Aug. 2022",
    level: "Software Copyright Certificate (SCC)",
    role: "Lead Developer",
    image: ""
  },
  {
    id: "prj3",
    title: "Multi-source Heterogeneous Data-based Scene Modeling Technology",
    description: "Investigation into 3D scene reconstruction techniques utilizing multi-source heterogeneous data.",
    year: "Apr. 2021 - Sep. 2021",
    level: "National Key R&D Program",
    role: "Research Assistant",
    image: ""
  },
  {
    id: "prj4",
    title: "Intelligent Evaluation Subsystem and Visualization Platform for Aero-Engine Thermochromic Coatings",
    description: "Designed a visualization platform to evaluate the performance of thermochromic coatings on aero-engines.",
    year: "Sep. 2020 - Sep. 2021",
    level: "National Key R&D Program",
    role: "Research Assistant",
    image: ""
  },
  {
    id: "prj5",
    title: "Data-Driven Visual Analytics System for Corporate Anomaly Early Warning",
    description: "Built a visual analytics system to detect and provide early warnings for corporate data anomalies.",
    year: "Sep. 2020 - Dec. 2020",
    level: "Provincial Key R&D Program",
    role: "Main Developer",
    image: ""
  },
  {
    id: "prj6",
    title: "Official Website of the SWUST Virtual Reality and Visualization Research Group",
    description: "Designed, developed, and maintained the official website for the university research group.",
    year: "Jan. 2020 - Jan. 2021",
    level: "University Program, SWUST",
    role: "Main Developer",
    image: ""
  }
];

export const talks: Talk[] = [
  {
    id: "t1",
    title: "Natural Language Processing (NLP) and Large Language Model (LLM) Roadmap 2024: How to Learn? Challenges and Opportunities",
    date: "Dec 2024",
    host: "Computer and Artificial Intelligence Association, SWUST",
    location: "Southwest University of Science and Technology, China",
    collaborators: "Co-hosted with Hosei Univ., Sichuan Univ., and Shenzhen Univ."
  },
  {
    id: "t2",
    title: "Building an Object Detection System from Scratch: Taking YOLOv5 as an Example",
    date: "Jan 2022",
    host: "Computer and Artificial Intelligence Association, SWUST",
    location: "Southwest University of Science and Technology, China",
    collaborators: "Co-hosted with Microsoft Student Club (MSC)"
  },
  {
    id: "t3",
    title: "Using Web Front-ends as the Platform for Scientific Visualization",
    date: "Oct 2021",
    host: "Computer and Artificial Intelligence Association, SWUST",
    location: "Southwest University of Science and Technology, China",
    collaborators: "VR&VIS Laboratory II"
  },
  {
    id: "t4",
    title: "Introduction to Visualization: Principle and Implementation",
    date: "Mar 2021",
    host: "Computer and Artificial Intelligence Association, SWUST",
    location: "Southwest University of Science and Technology, China"
  }
];

export const awardsList: Award[] = [
  {
    id: "aw1",
    title: "2025 Hosei University 100th Anniversary Master’s Course Scholarship",
    date: "Sep 2025",
    year: 2025,
    issuer: "Hosei University",
    type: "scholarship",
    prize: "JPY 200,000"
  },
  {
    id: "aw2",
    title: "Science Consortium Scholarship for International Conference Presentation",
    date: "Jan 2025",
    year: 2025,
    issuer: "Hosei University",
    type: "scholarship",
    prize: "JPY 30,000"
  },
  {
    id: "aw3",
    title: "IEEE 2024 Young Research’s Encouragement Award",
    date: "Oct 2024",
    year: 2024,
    issuer: "IEEE VTS Tokyo/Japan Chapter",
    type: "international",
    prize: "JPY 5,000"
  },
  {
    id: "aw4",
    title: "JASSO Honors Scholarship for Privately-Financed International Students",
    date: "Sep 2023",
    year: 2023,
    issuer: "JASSO Japan Student Services Organization",
    type: "scholarship",
    prize: "JPY 48,000 × 6 months"
  },
  {
    id: "aw5",
    title: "2022–2023 National College Students Algorithm Design Competition",
    date: "2023",
    year: 2023,
    issuer: "Chinese Association for Artificial Intelligence (CAAI)",
    type: "national",
    level: "Silver Award"
  },
  {
    id: "aw6",
    title: "2022 Asia-Pacific Mathematical Contest in Modeling (APMCM)",
    date: "2022",
    year: 2022,
    issuer: "APMCM Committee",
    type: "international",
    level: "Third Prize"
  },
  {
    id: "aw7",
    title: "2021 China University Big Data Challenge",
    date: "2021",
    year: 2021,
    issuer: "National Competition Committee",
    type: "national",
    level: "First Prize"
  },
  {
    id: "aw8",
    title: "2021 MathorCup University Mathematical Modeling Challenge",
    date: "2021",
    year: 2021,
    issuer: "MathorCup Organizing Committee",
    type: "national",
    level: "Third Prize"
  },
  {
    id: "aw9",
    title: "2021 Sichuan Province College Students Computer Design Competition",
    date: "2021",
    year: 2021,
    issuer: "Sichuan Provincial Department of Education",
    type: "provincial",
    level: "Second Prize"
  },
  {
    id: "aw10",
    title: "2020 Shuwei Cup International Mathematical Contest in Modeling",
    date: "2020",
    year: 2020,
    issuer: "Shuwei Cup Organizing Committee",
    type: "international",
    level: "Second Prize"
  }
];

export const experiences: Experience[] = [
  // Education
  {
    id: "edu1",
    category: "education",
    title: "Ph.D. candidate in Informatics",
    institution: "The University of Osaka",
    department: "Graduate School of Information Science and Technology",
    location: "Osaka, Japan",
    date: "Apr. 2026 - Apr. 2029",
    image: "/images/experiences/logo-uosaka.png",
    rank: "N/A"
  },
  {
    id: "edu2",
    category: "education",
    title: "Master of Engineering in Applied Informatics",
    institution: "Hosei University",
    department: "Graduate School of Science and Engineering",
    location: "Tokyo, Japan",
    date: "Sep. 2023 - Sep. 2025",
    image: "/images/experiences/logo-hosei.png",
    gpa: "3.5/4.0",
    rank: "Top 1%"
  },
  {
    id: "edu3",
    category: "education",
    title: "Bachelor of Engineering in Computer Science",
    institution: "Southwest University of Science and Technology",
    department: "School of Computer Science and Technology",
    location: "Mianyang, China",
    date: "Sep. 2019 - July 2023",
    image: "/images/experiences/logo-swust.png",
    gpa: "3.68/5.0",
    rank: "Top 5%"
  },
  
  // Work
  {
    id: "work1",
    category: "work",
    title: "Graduate School Tutor for Early-stage Graduate Student",
    institution: "Hosei University",
    location: "Tokyo, Japan",
    date: "Sep. 2024 - Sep. 2025",
    image: "/images/experiences/logo-hosei.png",
    description: "Give advice to lowerclassmen on research and study (e.g., assistance in writing reports), and on adjusting to life in graduate school."
  },
  {
    id: "work2",
    category: "work",
    title: "Teaching Assistant",
    institution: "Hosei University",
    location: "Tokyo, Japan",
    date: "Apr. 2024 - Apr. 2025",
    image: "/images/experiences/logo-hosei.png",
    description: "Mainly offering advice to students and assisting with classes, practical trainings, and experiments under the supervision of the assigned professors."
  },
  
  // Volunteer
  {
    id: "vol1",
    category: "volunteer",
    title: "Executive Committee Member (5th Committee) of China Computer Federation (CCF) Student Chapter",
    institution: "Southwest University of Science and Technology",
    location: "Mianyang, China",
    date: "Jun. 2021 - Jun. 2022",
    image: "/images/experiences/logo-ccf.png",
    description: "Served as a member of the executive committee, participating in the organization and coordination of academic and technical activities for student members."
  },
  {
    id: "vol2",
    category: "volunteer",
    title: "Leader of Undergraduate in Visualization and Visual Analytics Laboratory II (Virtual Reality and Visualization Group)",
    institution: "Southwest University of Science and Technology",
    location: "Mianyang, China",
    date: "Jun. 2021 - May. 2022",
    image: "/images/experiences/logo-swust.png", // No image
    description: "Led an undergraduate research team focusing on virtual reality and visualization projects, coordinating task allocation and project progress."
  },
  {
    id: "vol3",
    category: "volunteer",
    title: "Developer Member & Huawei Spark Campus Ambassador",
    institution: "Huawei Campus Developers Alliance",
    location: "Mianyang, China",
    date: "Mar. 2021 - May. 2023",
    image: "", // No image
    description: "Active member of the Huawei Campus Developers Alliance and served as a Huawei Spark Campus Ambassador at Southwest University of Science and Technology, promoting developer activities and technical exchange."
  },
  {
    id: "vol4",
    category: "volunteer",
    title: "Vice President of Computer and Artificial Intelligence Association",
    institution: "Southwest University of Science and Technology",
    location: "Mianyang, China",
    date: "Nov. 2020 - Sep. 2022",
    image: "/images/experiences/logo-swust.png", // No image
    description: "Served as Vice President of the association, organizing multiple academic activities including lectures, seminars, outreach events, and technical training sessions."
  }
];